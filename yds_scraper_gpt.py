import asyncio
from playwright.async_api import async_playwright
import json
import re
import os
from datetime import datetime
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

# OpenAI async client
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# GPT rate limiting - OpenAI Tier 1: 500 RPM için optimize
GPT_CONCURRENT_LIMIT = 50

# YDS Test URL'leri ve soru sayıları
YDS_TESTS = [
    # Tenses
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-1437-0.html", "count": 30},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-2438-0.html", "count": 25},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-3439-0.html", "count": 50},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-4440-0.html", "count": 40},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-5441-0.html", "count": 60},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-6442-0.html", "count": 60},
    {"category": "Tenses", "url": "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-7443-0.html", "count": 60},
    
    # Relative Clauses
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-1431-0.html", "count": 50},
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-2432-0.html", "count": 50},
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-3433-0.html", "count": 30},
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-4434-0.html", "count": 50},
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-5435-0.html", "count": 50},
    {"category": "Relative Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-RELATIVE-CLAUSES---TEST-6436-0.html", "count": 50},
    
    # Reductions
    {"category": "Reductions", "url": "https://www.sorukurdu.com/test-sorular/YDS-REDUCTIONS---TEST-1427-0.html", "count": 15},
    {"category": "Reductions", "url": "https://www.sorukurdu.com/test-sorular/YDS-REDUCTIONS---TEST-2428-0.html", "count": 15},
    {"category": "Reductions", "url": "https://www.sorukurdu.com/test-sorular/YDS-REDUCTIONS---TEST-3429-0.html", "count": 40},
    {"category": "Reductions", "url": "https://www.sorukurdu.com/test-sorular/YDS-REDUCTIONS---TEST-4430-0.html", "count": 50},
    
    # Passive
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-1419-0.html", "count": 43},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-2420-0.html", "count": 35},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-3421-0.html", "count": 45},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-4422-0.html", "count": 50},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-5423-0.html", "count": 35},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-6424-0.html", "count": 35},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-7425-0.html", "count": 45},
    {"category": "Passive", "url": "https://www.sorukurdu.com/test-sorular/YDS-THE-PASSIVE---TEST-8426-0.html", "count": 50},
    
    # Nouns/Articles/Quantifiers/Pronouns
    {"category": "Nouns", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-1414-0.html", "count": 20},
    {"category": "Nouns", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-2415-0.html", "count": 55},
    {"category": "Nouns", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-3416-0.html", "count": 40},
    {"category": "Nouns", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-4417-0.html", "count": 40},
    {"category": "Nouns", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-5418-0.html", "count": 60},
    
    # Noun Clauses
    {"category": "Noun Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUN-CLAUSES---TEST-1410-0.html", "count": 45},
    {"category": "Noun Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUN-CLAUSES---TEST-2411-0.html", "count": 50},
    {"category": "Noun Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUN-CLAUSES---TEST-3412-0.html", "count": 55},
    {"category": "Noun Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-NOUN-CLAUSES---TEST-4413-0.html", "count": 72},
    
    # Modals
    {"category": "Modals", "url": "https://www.sorukurdu.com/test-sorular/YDS-MODALS---TEST-1407-0.html", "count": 71},
    {"category": "Modals", "url": "https://www.sorukurdu.com/test-sorular/YDS-MODALS---TEST-2408-0.html", "count": 50},
    {"category": "Modals", "url": "https://www.sorukurdu.com/test-sorular/YDS-MODALS---TEST-3409-0.html", "count": 50},
    
    # Adjectives/Adverbs
    {"category": "Adjectives Adverbs", "url": "https://www.sorukurdu.com/test-sorular/YDS-Gramer-Sorulari372-0.html", "count": 20},
    {"category": "Adjectives Adverbs", "url": "https://www.sorukurdu.com/test-sorular/YDS-Adjectives-Adverbs-TEST2373-0.html", "count": 36},
    {"category": "Adjectives Adverbs", "url": "https://www.sorukurdu.com/test-sorular/YDS-Adjectives-Adverbs-TEST3374-0.html", "count": 60},
    {"category": "Adjectives Adverbs", "url": "https://www.sorukurdu.com/test-sorular/YDS-Adjectives-Adverbs-TEST4375-0.html", "count": 20},
    {"category": "Adjectives Adverbs", "url": "https://www.sorukurdu.com/test-sorular/YDS-Adjectives-Adverbs-TEST5376-0.html", "count": 70},
    
    # Conjunctions/Transitions
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST1377-0.html", "count": 55},
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST2378-0.html", "count": 30},
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST3379-0.html", "count": 28},
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST4380-0.html", "count": 55},
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST5381-0.html", "count": 40},
    {"category": "Conjunctions", "url": "https://www.sorukurdu.com/test-sorular/Conjunctions-Transitions-TEST6382-0.html", "count": 40},
    
    # Gerunds and Infinitives
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-1383-0.html", "count": 42},
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-2384-0.html", "count": 40},
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-3385-0.html", "count": 40},
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-4386-0.html", "count": 35},
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-5387-0.html", "count": 40},
    {"category": "Gerunds Infinitives", "url": "https://www.sorukurdu.com/test-sorular/GERUNDS-AND-INFINITIVES---TEST-6388-0.html", "count": 40},
    
    # Grammar Revision
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-1389-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-2390-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-3391-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-4392-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-5393-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-6394-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-7395-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-8398-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-9399-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-10400-0.html", "count": 100},
    {"category": "Grammar Revision", "url": "https://www.sorukurdu.com/test-sorular/YDS-GRAMMAR-REVISION-TEST-11401-0.html", "count": 100},
    
    # If Clauses
    {"category": "If Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-IF-CLAUSES---TEST-1402-0.html", "count": 50},
    {"category": "If Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-IF-CLAUSES---TEST-2403-0.html", "count": 55},
    {"category": "If Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-IF-CLAUSES---TEST-3404-0.html", "count": 70},
    {"category": "If Clauses", "url": "https://www.sorukurdu.com/test-sorular/YDS-IF-CLAUSES---TEST-4405-0.html", "count": 65},
]

CONCURRENT_LIMIT = 5


async def get_correct_answer_from_gpt(question_text: str, options: list, gpt_semaphore: asyncio.Semaphore) -> str:
    """GPT-4.1 Nano ile doğru cevabı asenkron al"""
    if not question_text or not options:
        return None
    
    options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
    
    prompt = f"""Bu bir YDS İngilizce sınav sorusudur. Doğru cevabın sadece harfini (A, B, C, D veya E) yaz, başka bir şey yazma.

Soru: {question_text}

Şıklar:
{options_text}

Doğru cevap:"""

    async with gpt_semaphore:
        try:
            response = await client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {"role": "system", "content": "Sen bir YDS İngilizce uzmanısın. Sadece doğru cevabın harfini (A, B, C, D veya E) yaz."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=5,
                temperature=0
            )
            answer = response.choices[0].message.content.strip().upper()
            # Sadece harf döndür
            if answer and answer[0] in "ABCDE":
                return answer[0]
            return None
        except Exception as e:
            print(f"GPT hatası: {e}")
            return None


async def scrape_single_question(page, gpt_semaphore: asyncio.Semaphore = None) -> dict:
    """Açık sayfadan soru bilgilerini çıkar"""
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
        pass
    
    return result


async def scrape_test_questions(browser, test_info: dict, semaphore: asyncio.Semaphore, progress: dict) -> list:
    """Bir testteki tüm soruları kazır (GPT çağrısı yapılmaz)"""
    questions = []
    base_url = test_info["url"]
    count = test_info["count"]
    category = test_info["category"]
    
    pattern = r'(.*)-(\d+)(\.html.*)'
    match = re.match(pattern, base_url)
    if not match:
        return questions
    
    url_prefix = match.group(1)
    url_suffix = match.group(3)
    
    async with semaphore:
        page = await browser.new_page()
        try:
            for i in range(1, count + 1):
                url = f"{url_prefix}-{i}{url_suffix}"
                
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await asyncio.sleep(0.3)
                    
                    q = await scrape_single_question(page)
                    q["url"] = url
                    q["index"] = i
                    q["category"] = category
                    q["test_url"] = base_url
                    questions.append(q)
                    
                    progress["done"] += 1
                    
                except Exception as e:
                    questions.append({
                        "index": i,
                        "url": url,
                        "category": category,
                        "error": str(e)
                    })
                    progress["done"] += 1
        finally:
            await page.close()
    
    return questions


async def get_answers_for_questions(questions: list, gpt_semaphore: asyncio.Semaphore, progress: dict) -> None:
    """Tüm sorular için GPT'den asenkron cevap al"""
    
    async def get_single_answer(q: dict):
        if q.get("question_text") and q.get("options") and not q.get("correct_answer"):
            answer = await get_correct_answer_from_gpt(
                q["question_text"],
                q["options"],
                gpt_semaphore
            )
            q["correct_answer"] = answer
        progress["gpt_done"] += 1
    
    tasks = [get_single_answer(q) for q in questions]
    await asyncio.gather(*tasks)


def save_category_file(output_dir: str, category: str, questions: list):
    """Kategori dosyasını kaydet"""
    safe_name = category.replace(" ", "_").replace("/", "_").lower()
    filename = os.path.join(output_dir, f"{safe_name}.json")
    
    output = {
        "category": category,
        "updated_at": datetime.now().isoformat(),
        "total_questions": len(questions),
        "success_count": len([q for q in questions if q.get('question_text')]),
        "with_answer_count": len([q for q in questions if q.get('correct_answer')]),
        "questions": questions
    }
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    return filename


def save_summary(output_dir: str, by_category: dict):
    """Özet dosyasını kaydet"""
    all_questions = []
    for qs in by_category.values():
        all_questions.extend(qs)
    
    summary = {
        "updated_at": datetime.now().isoformat(),
        "total_questions": len(all_questions),
        "total_success": len([q for q in all_questions if q.get('question_text')]),
        "total_with_answer": len([q for q in all_questions if q.get('correct_answer')]),
        "categories": {
            cat: {
                "count": len(qs),
                "success": len([q for q in qs if q.get('question_text')]),
                "with_answer": len([q for q in qs if q.get('correct_answer')]),
                "file": f"{cat.replace(' ', '_').replace('/', '_').lower()}.json"
            }
            for cat, qs in by_category.items()
        }
    }
    
    summary_file = os.path.join(output_dir, "_summary.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    return summary


async def scrape_all_yds_with_save(tests: list = None, output_dir: str = "yds_questions", concurrent: int = CONCURRENT_LIMIT):
    """Tüm YDS testlerini kazır, GPT ile cevapla ve ANLIK KAYDET"""
    if tests is None:
        tests = YDS_TESTS
    
    os.makedirs(output_dir, exist_ok=True)
    
    total_questions = sum(t["count"] for t in tests)
    print(f"Toplam {len(tests)} test, {total_questions} soru")
    print(f"Scraping: {concurrent} paralel, GPT: {GPT_CONCURRENT_LIMIT} paralel")
    print(f"💾 Anlık kayıt: {output_dir}/")
    print("="*60)
    
    start_time = datetime.now()
    by_category = {}  # Kategoriye göre sorular
    progress = {"done": 0, "total": total_questions, "gpt_done": 0}
    save_lock = asyncio.Lock()
    
    async def save_progress():
        """Mevcut durumu dosyalara kaydet"""
        async with save_lock:
            for cat, qs in by_category.items():
                save_category_file(output_dir, cat, qs)
            save_summary(output_dir, by_category)
    
    async def scrape_and_save(browser, test_info: dict, semaphore: asyncio.Semaphore):
        """Bir testi scrape et ve hemen kaydet"""
        questions = []
        base_url = test_info["url"]
        count = test_info["count"]
        category = test_info["category"]
        
        pattern = r'(.*)-(\d+)(\.html.*)'
        match = re.match(pattern, base_url)
        if not match:
            return
        
        url_prefix = match.group(1)
        url_suffix = match.group(3)
        
        async with semaphore:
            page = await browser.new_page()
            try:
                for i in range(1, count + 1):
                    url = f"{url_prefix}-{i}{url_suffix}"
                    
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        await asyncio.sleep(0.3)
                        
                        q = await scrape_single_question(page)
                        q["url"] = url
                        q["index"] = i
                        q["category"] = category
                        q["test_url"] = base_url
                        questions.append(q)
                        
                    except Exception as e:
                        questions.append({
                            "index": i,
                            "url": url,
                            "category": category,
                            "error": str(e)
                        })
                    
                    progress["done"] += 1
            finally:
                await page.close()
        
        # Test tamamlandı - kategoriye ekle ve kaydet
        async with save_lock:
            if category not in by_category:
                by_category[category] = []
            by_category[category].extend(questions)
            save_category_file(output_dir, category, by_category[category])
        
        return questions
    
    async def report_scrape_progress():
        while progress["done"] < progress["total"]:
            pct = (progress["done"] / progress["total"]) * 100
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = progress["done"] / elapsed if elapsed > 0 else 0
            eta = (progress["total"] - progress["done"]) / rate if rate > 0 else 0
            print(f"\r[Scraping] {progress['done']}/{progress['total']} ({pct:.1f}%) - {rate:.1f} soru/sn - ETA: {eta:.0f}sn", end="", flush=True)
            await asyncio.sleep(2)
        print()
    
    # AŞAMA 1: Scrape et ve anlık kaydet
    print("\n📥 AŞAMA 1: Sorular scrape ediliyor (anlık kayıt)...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        semaphore = asyncio.Semaphore(concurrent)
        
        progress_task = asyncio.create_task(report_scrape_progress())
        
        tasks = [scrape_and_save(browser, test, semaphore) for test in tests]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        progress_task.cancel()
        await browser.close()
    
    scrape_elapsed = (datetime.now() - start_time).total_seconds()
    all_questions = []
    for qs in by_category.values():
        all_questions.extend(qs)
    success = len([q for q in all_questions if q.get('question_text')])
    print(f"✓ Scraping: {success}/{len(all_questions)} soru ({scrape_elapsed:.1f}sn)")
    
    # AŞAMA 2: GPT ile cevapla ve anlık kaydet
    questions_to_answer = [q for q in all_questions if q.get('question_text') and q.get('options') and not q.get('correct_answer')]
    if questions_to_answer:
        print(f"\n🤖 AŞAMA 2: GPT cevaplıyor (anlık kayıt)...")
        gpt_start = datetime.now()
        gpt_semaphore = asyncio.Semaphore(GPT_CONCURRENT_LIMIT)
        progress["gpt_done"] = 0
        last_save = [0]
        
        async def answer_and_save(q: dict):
            if q.get("question_text") and q.get("options"):
                answer = await get_correct_answer_from_gpt(q["question_text"], q["options"], gpt_semaphore)
                q["correct_answer"] = answer
            progress["gpt_done"] += 1
            
            # Her 50 cevaptan sonra kaydet
            if progress["gpt_done"] - last_save[0] >= 50:
                last_save[0] = progress["gpt_done"]
                await save_progress()
        
        async def report_gpt_progress():
            total = len(questions_to_answer)
            while progress["gpt_done"] < total:
                pct = (progress["gpt_done"] / total) * 100
                elapsed = (datetime.now() - gpt_start).total_seconds()
                rate = progress["gpt_done"] / elapsed if elapsed > 0 else 0
                eta = (total - progress["gpt_done"]) / rate if rate > 0 else 0
                print(f"\r[GPT] {progress['gpt_done']}/{total} ({pct:.1f}%) - {rate:.1f} cevap/sn - ETA: {eta:.0f}sn", end="", flush=True)
                await asyncio.sleep(2)
            print()
        
        gpt_progress_task = asyncio.create_task(report_gpt_progress())
        tasks = [answer_and_save(q) for q in questions_to_answer]
        await asyncio.gather(*tasks)
        gpt_progress_task.cancel()
        
        # Final kayıt
        await save_progress()
        
        gpt_elapsed = (datetime.now() - gpt_start).total_seconds()
        with_answer = len([q for q in all_questions if q.get('correct_answer')])
        print(f"✓ GPT: {with_answer}/{len(questions_to_answer)} cevap ({gpt_elapsed:.1f}sn)")
    
    # Final özet
    summary = save_summary(output_dir, by_category)
    total_elapsed = (datetime.now() - start_time).total_seconds()
    
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI! Süre: {total_elapsed:.1f}sn")
    print(f"Scrape: {summary['total_success']}/{summary['total_questions']}")
    print(f"Cevaplı: {summary['total_with_answer']}/{summary['total_questions']}")
    
    return by_category


async def main():
    import sys
    
    output_dir = "yds_questions"
    
    category_filter = None
    if len(sys.argv) >= 2:
        category_filter = sys.argv[1]
        print(f"Kategori filtresi: {category_filter}")
    
    if category_filter:
        tests = [t for t in YDS_TESTS if category_filter.lower() in t["category"].lower()]
    else:
        tests = YDS_TESTS
    
    if not tests:
        print("Eşleşen test bulunamadı!")
        return
    
    await scrape_all_yds_with_save(tests, output_dir)


if __name__ == "__main__":
    asyncio.run(main())
