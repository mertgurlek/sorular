"""Eksik soruları yeniden scrape et ve GPT ile cevapla"""
import asyncio
import json
import glob
import os
import re
from datetime import datetime
from playwright.async_api import async_playwright

from scripts.openai_utils import get_openai_client

client = get_openai_client()

async def scrape_single_question(page) -> dict:
    """Tek bir soru sayfasını kazır - ana scraper ile aynı selector'lar"""
    result = {
        "question_number": "",
        "question_text": "",
        "options": [],
        "correct_answer": None
    }
    
    try:
        fieldset = await page.query_selector("#commentForm fieldset")
        if fieldset:
            fieldset_html = await fieldset.inner_html()
            
            num_match = re.search(r'<div[^>]*font-weight[^>]*bold[^>]*>([^<]+)</div>', fieldset_html)
            if num_match:
                result["question_number"] = num_match.group(1).strip()
            
            text_match = re.search(r'<div[^>]*width:\s*590px[^>]*>(.*?)</div>', fieldset_html, re.DOTALL)
            if text_match:
                text = text_match.group(1)
                text = text.replace("<br>", "\n").replace("<br/>", "\n")
                text = re.sub(r'<[^>]+>', '', text)
                result["question_text"] = text.strip()
        
        option_elems = await page.query_selector_all(".custom-radio")
        for opt in option_elems:
            input_elem = await opt.query_selector("input[type='radio']")
            label_elem = await opt.query_selector("label")
            if input_elem and label_elem:
                value = await input_elem.get_attribute("value")
                label_html = await label_elem.inner_html()
                label_text = label_html.replace("<br>", "").replace("<br/>", "").strip()
                label_text = re.sub(r'<[^>]+>', '', label_text).strip()
                result["options"].append({
                    "letter": value,
                    "text": label_text
                })
                
    except Exception as e:
        result["error"] = str(e)
    
    return result


async def get_answer_from_gpt(question_text: str, options: list) -> str:
    """GPT ile cevap al"""
    if not question_text or not options:
        return None
    
    options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
    prompt = f"""Bu bir YDS İngilizce sınav sorusudur. Doğru cevabın sadece harfini (A, B, C, D veya E) yaz.

Soru: {question_text}

Şıklar:
{options_text}

Doğru cevap:"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4.1-nano",
            messages=[
                {"role": "system", "content": "Sen bir YDS İngilizce uzmanısın. Sadece doğru cevabın harfini yaz."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=5,
            temperature=0
        )
        answer = response.choices[0].message.content.strip().upper()
        if answer and answer[0] in "ABCDE":
            return answer[0]
    except Exception as e:
        print(f"GPT hatası: {e}")
    return None


async def retry_failed_questions():
    """Eksik soruları yeniden dene"""
    output_dir = "yds_questions"
    
    # Eksik soruları bul
    failed_questions = []
    files_data = {}
    
    for filepath in glob.glob(f"{output_dir}/*.json"):
        if "_summary" in filepath:
            continue
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        files_data[filepath] = data
        
        for i, q in enumerate(data["questions"]):
            if not q.get("question_text"):
                failed_questions.append({
                    "filepath": filepath,
                    "index": i,
                    "url": q.get("url"),
                    "category": q.get("category")
                })
    
    if not failed_questions:
        print("Eksik soru yok!")
        return
    
    print(f"Toplam {len(failed_questions)} eksik soru bulundu")
    print("="*50)
    
    success = 0
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        for i, fq in enumerate(failed_questions):
            url = fq["url"]
            print(f"\r[{i+1}/{len(failed_questions)}] {url[:60]}...", end="", flush=True)
            
            try:
                await page.goto(url, wait_until="networkidle", timeout=60000)
                await asyncio.sleep(1)
                
                # Sayfa hata veriyorsa atla
                html = await page.content()
                if "Hatalı Sayfa" in html:
                    print(f"\n  Sayfa mevcut değil: {url[-40:]}")
                    continue
                
                q = await scrape_single_question(page)
                
                if q.get("question_text") and q.get("options"):
                    # GPT ile cevapla
                    answer = await get_answer_from_gpt(q["question_text"], q["options"])
                    q["correct_answer"] = answer
                    q["url"] = url
                    q["category"] = fq["category"]
                    q["index"] = files_data[fq["filepath"]]["questions"][fq["index"]].get("index")
                    q["test_url"] = files_data[fq["filepath"]]["questions"][fq["index"]].get("test_url")
                    
                    # Güncelle
                    files_data[fq["filepath"]]["questions"][fq["index"]] = q
                    success += 1
                    
            except Exception as e:
                print(f"\n  Hata: {str(e)[:50]}")
        
        await browser.close()
    
    print(f"\n\n{success}/{len(failed_questions)} soru tamamlandı")
    
    # Dosyaları kaydet
    for filepath, data in files_data.items():
        data["success_count"] = len([q for q in data["questions"] if q.get("question_text")])
        data["with_answer_count"] = len([q for q in data["questions"] if q.get("correct_answer")])
        data["updated_at"] = datetime.now().isoformat()
        
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    # Summary güncelle
    all_qs = []
    by_cat = {}
    for fp, data in files_data.items():
        cat = data["category"]
        by_cat[cat] = data["questions"]
        all_qs.extend(data["questions"])
    
    summary = {
        "updated_at": datetime.now().isoformat(),
        "total_questions": len(all_qs),
        "total_success": len([q for q in all_qs if q.get("question_text")]),
        "total_with_answer": len([q for q in all_qs if q.get("correct_answer")]),
        "categories": {
            cat: {
                "count": len(qs),
                "success": len([q for q in qs if q.get("question_text")]),
                "with_answer": len([q for q in qs if q.get("correct_answer")])
            }
            for cat, qs in by_cat.items()
        }
    }
    
    with open(f"{output_dir}/_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\nSonuç: {summary['total_success']}/{summary['total_questions']} başarılı")


if __name__ == "__main__":
    asyncio.run(retry_failed_questions())
