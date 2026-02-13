import asyncio
from playwright.async_api import async_playwright
import json
import re
from datetime import datetime

# YDS Kategori URL'leri
YDS_CATEGORIES = [
    {"name": "İlgisiz Cümleyi Bulma", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Ilgisiz-Cumleyi-Bulma140.html"},
    {"name": "Çeviri Soruları", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Ceviri-Sorulari141.html"},
    {"name": "Cümle Tamamlama", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Cumle-Tamamlama-Sorulari142.html"},
    {"name": "Diyalog", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-DIYALOG143.html"},
    {"name": "Durum", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Durum144.html"},
    {"name": "Eş Anlam", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Es-Anlam145.html"},
    {"name": "Paragraf Doldurma", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Paragraf-Doldurma146.html"},
    {"name": "Phrasal Verbs Prepositions", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Phrasal-Verbs-Prepositions.html"},
    {"name": "Kelime Soruları", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Kelime-Sorulari148.html"},
    {"name": "Okuma Soruları", "url": "https://www.sorukurdu.com/sorular-kategori/YDS-Okuma-Sorulari149.html"},
]

CONCURRENT_LIMIT = 5


async def get_test_links_from_category(page, category_url: str) -> list:
    """Kategori sayfasından test linklerini çıkar"""
    tests = []
    try:
        await page.goto(category_url, wait_until="networkidle", timeout=30000)
        await asyncio.sleep(1)
        
        # Test linklerini bul (test-sorular içeren linkler)
        links = await page.query_selector_all("a[href*='test-sorular']")
        
        for link in links:
            href = await link.get_attribute("href")
            text = await link.inner_text()
            
            if href and "test-sorular" in href:
                # Soru sayısını çıkar (örn: "( 40 Soru)")
                count_match = re.search(r'\(\s*(\d+)\s*Soru\s*\)', text)
                count = int(count_match.group(1)) if count_match else 0
                
                # URL'yi tam hale getir
                if not href.startswith("http"):
                    href = "https://www.sorukurdu.com" + href
                
                # Duplicate kontrolü
                if not any(t["url"] == href for t in tests):
                    tests.append({
                        "name": text.strip(),
                        "url": href,
                        "count": count
                    })
        
        print(f"  {len(tests)} test bulundu")
        
    except Exception as e:
        print(f"  Hata: {e}")
    
    return tests


async def scrape_single_question(page, get_answer: bool = False) -> dict:
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
            
            # Soru numarası
            num_match = re.search(r'<div[^>]*font-weight[^>]*bold[^>]*>([^<]+)</div>', fieldset_html)
            if num_match:
                result["question_number"] = num_match.group(1).strip()
            
            # Soru metni
            text_match = re.search(r'<div[^>]*width:\s*590px[^>]*>(.*?)</div>', fieldset_html, re.DOTALL)
            if text_match:
                text = text_match.group(1)
                text = text.replace("<br>", "\n").replace("<br/>", "\n")
                text = re.sub(r'<[^>]+>', '', text)
                result["question_text"] = text.strip()
        
        # Şıklar
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


async def scrape_test_questions(browser, test_info: dict, category: str, semaphore: asyncio.Semaphore, progress: dict) -> list:
    """Bir testteki tüm soruları kazır"""
    questions = []
    base_url = test_info["url"]
    count = test_info["count"]
    
    if count == 0:
        return questions
    
    # URL pattern: xxx-0.html -> xxx-1.html, xxx-2.html, ...
    pattern = r'(.*-)(\d+)(\.html.*)'
    match = re.match(pattern, base_url)
    if not match:
        return questions
    
    url_prefix = match.group(1)
    url_suffix = match.group(3)
    
    async with semaphore:
        page = await browser.new_page()
        try:
            for i in range(1, count + 1):
                url = f"{url_prefix}{i}{url_suffix}"
                
                try:
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await asyncio.sleep(0.3)
                    
                    q = await scrape_single_question(page)
                    q["url"] = url
                    q["index"] = i
                    q["category"] = category
                    q["test_name"] = test_info["name"]
                    q["test_url"] = base_url
                    questions.append(q)
                    
                    progress["done"] += 1
                    
                except Exception as e:
                    questions.append({
                        "index": i,
                        "url": url,
                        "category": category,
                        "test_name": test_info["name"],
                        "error": str(e)
                    })
                    progress["done"] += 1
        finally:
            await page.close()
    
    return questions


async def scrape_category(browser, category_info: dict, semaphore: asyncio.Semaphore) -> dict:
    """Bir kategorideki tüm testleri kazır"""
    category_name = category_info["name"]
    category_url = category_info["url"]
    
    print(f"\n{'='*60}")
    print(f"Kategori: {category_name}")
    print(f"URL: {category_url}")
    
    # Önce test linklerini al
    page = await browser.new_page()
    tests = await get_test_links_from_category(page, category_url)
    await page.close()
    
    if not tests:
        return {"category": category_name, "tests": [], "questions": []}
    
    total_questions = sum(t["count"] for t in tests)
    print(f"  Toplam {total_questions} soru kazınacak")
    
    progress = {"done": 0, "total": total_questions}
    start_time = datetime.now()
    
    # Progress reporter
    async def report_progress():
        while progress["done"] < progress["total"]:
            pct = (progress["done"] / progress["total"]) * 100 if progress["total"] > 0 else 0
            print(f"\r  İlerleme: {progress['done']}/{progress['total']} ({pct:.1f}%)", end="", flush=True)
            await asyncio.sleep(2)
        print()
    
    # Tüm testleri paralel kazı
    progress_task = asyncio.create_task(report_progress())
    
    tasks = [
        scrape_test_questions(browser, test, category_name, semaphore, progress)
        for test in tests
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    progress_task.cancel()
    
    all_questions = []
    for result in results:
        if isinstance(result, list):
            all_questions.extend(result)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    success = len([q for q in all_questions if q.get('question_text')])
    print(f"  Tamamlandı: {success}/{len(all_questions)} soru ({elapsed:.1f}sn)")
    
    return {
        "category": category_name,
        "category_url": category_url,
        "tests": tests,
        "questions": all_questions,
        "success_count": success,
        "total_count": len(all_questions)
    }


async def scrape_all_categories(categories: list = None, concurrent: int = CONCURRENT_LIMIT):
    """Tüm kategorileri kazır"""
    if categories is None:
        categories = YDS_CATEGORIES
    
    print("="*60)
    print("YDS Kategori Scraper")
    print(f"Toplam {len(categories)} kategori kazınacak")
    print(f"Paralel limit: {concurrent}")
    print("="*60)
    
    start_time = datetime.now()
    all_results = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        semaphore = asyncio.Semaphore(concurrent)
        
        for category in categories:
            result = await scrape_category(browser, category, semaphore)
            all_results.append(result)
        
        await browser.close()
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    total_questions = sum(r["total_count"] for r in all_results)
    total_success = sum(r["success_count"] for r in all_results)
    
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI!")
    print(f"Süre: {elapsed:.1f} saniye")
    print(f"Toplam: {total_success}/{total_questions} soru başarıyla kazındı")
    
    return all_results


async def main():
    import os
    
    output_dir = "yds_questions"
    os.makedirs(output_dir, exist_ok=True)
    
    results = await scrape_all_categories()
    
    # Her kategori için ayrı dosya
    all_questions = []
    
    for result in results:
        cat_name = result["category"]
        safe_name = cat_name.replace(" ", "_").replace("/", "_").lower()
        safe_name = re.sub(r'[^\w_]', '', safe_name)
        filename = os.path.join(output_dir, f"yds_{safe_name}.json")
        
        output = {
            "category": cat_name,
            "category_url": result.get("category_url", ""),
            "scraped_at": datetime.now().isoformat(),
            "tests": result["tests"],
            "total_questions": result["total_count"],
            "success_count": result["success_count"],
            "questions": result["questions"]
        }
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"✓ {filename} ({result['success_count']}/{result['total_count']} soru)")
        all_questions.extend(result["questions"])
    
    # Tüm soruları tek dosyada birleştir
    combined_file = os.path.join(output_dir, "yds_all_categories.json")
    combined = {
        "scraped_at": datetime.now().isoformat(),
        "total_questions": len(all_questions),
        "success_count": len([q for q in all_questions if q.get('question_text')]),
        "categories": [r["category"] for r in results],
        "questions": all_questions
    }
    
    with open(combined_file, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Birleşik dosya: {combined_file}")
    print(f"TOPLAM: {combined['success_count']}/{combined['total_questions']} soru")


if __name__ == "__main__":
    asyncio.run(main())
