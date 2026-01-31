import asyncio
from playwright.async_api import async_playwright
import json
import re
from datetime import datetime

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

# Paralel kazıma için semaphore (aynı anda max 5 sayfa)
CONCURRENT_LIMIT = 5


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
        
        # Doğru cevabı almak için formu gönder
        if get_answer and result["options"]:
            try:
                # İlk şıkkı seç ve formu gönder
                first_label = await page.query_selector("label[for='radio-1']")
                if first_label:
                    await first_label.click()
                    await asyncio.sleep(0.3)
                    
                    submit_btn = await page.query_selector("input#submit")
                    if submit_btn:
                        await submit_btn.click()
                        await page.wait_for_load_state("domcontentloaded", timeout=10000)
                        await asyncio.sleep(0.5)
                        
                        # Doğru cevabı bul (dogru.png olan şık)
                        fieldset_after = await page.query_selector("#commentForm fieldset")
                        if fieldset_after:
                            html_after = await fieldset_after.inner_html()
                            
                            # dogru.png'den sonraki radio value'yu bul
                            correct_match = re.search(
                                r'dogru\.png[^>]*>.*?<input[^>]*value="([A-E])"',
                                html_after,
                                re.DOTALL
                            )
                            if correct_match:
                                result["correct_answer"] = correct_match.group(1)
            except Exception as e:
                pass  # Cevap alınamazsa devam et
                
    except Exception as e:
        pass
    
    return result


async def scrape_test_questions(browser, test_info: dict, semaphore: asyncio.Semaphore, progress: dict) -> list:
    """Bir testteki tüm soruları kazır (semaphore ile sınırlı)"""
    questions = []
    base_url = test_info["url"]
    count = test_info["count"]
    category = test_info["category"]
    
    # URL pattern
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


async def scrape_all_yds(tests: list = None, concurrent: int = CONCURRENT_LIMIT):
    """Tüm YDS testlerini paralel olarak kazır"""
    if tests is None:
        tests = YDS_TESTS
    
    total_questions = sum(t["count"] for t in tests)
    print(f"Toplam {len(tests)} test, {total_questions} soru kazınacak")
    print(f"Paralel limit: {concurrent}")
    print("="*60)
    
    start_time = datetime.now()
    progress = {"done": 0, "total": total_questions}
    
    # Progress reporter
    async def report_progress():
        while progress["done"] < progress["total"]:
            pct = (progress["done"] / progress["total"]) * 100
            elapsed = (datetime.now() - start_time).total_seconds()
            rate = progress["done"] / elapsed if elapsed > 0 else 0
            eta = (progress["total"] - progress["done"]) / rate if rate > 0 else 0
            print(f"\rİlerleme: {progress['done']}/{progress['total']} ({pct:.1f}%) - {rate:.1f} soru/sn - ETA: {eta:.0f}sn", end="", flush=True)
            await asyncio.sleep(2)
        print()
    
    all_questions = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        semaphore = asyncio.Semaphore(concurrent)
        
        # Progress reporter'ı başlat
        progress_task = asyncio.create_task(report_progress())
        
        # Tüm testleri paralel kazı
        tasks = [
            scrape_test_questions(browser, test, semaphore, progress)
            for test in tests
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Sonuçları birleştir
        for result in results:
            if isinstance(result, list):
                all_questions.extend(result)
            elif isinstance(result, Exception):
                print(f"\nHata: {result}")
        
        progress_task.cancel()
        await browser.close()
    
    elapsed = (datetime.now() - start_time).total_seconds()
    success = len([q for q in all_questions if q.get('question_text')])
    
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI!")
    print(f"Süre: {elapsed:.1f} saniye")
    print(f"Başarılı: {success}/{len(all_questions)} soru")
    print(f"Hız: {len(all_questions)/elapsed:.1f} soru/saniye")
    
    return all_questions


async def main():
    import sys
    import os
    
    # Çıktı klasörü
    output_dir = "yds_questions"
    os.makedirs(output_dir, exist_ok=True)
    
    # Sadece belirli kategorileri kazımak için filtre
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
    
    questions = await scrape_all_yds(tests)
    
    # Kategoriye göre grupla
    by_category = {}
    for q in questions:
        cat = q.get("category", "Unknown")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(q)
    
    # Her kategori için ayrı dosya oluştur
    print(f"\nDosyalar kaydediliyor: {output_dir}/")
    for cat, qs in sorted(by_category.items()):
        # Dosya adı için kategori ismini düzenle
        safe_name = cat.replace(" ", "_").replace("/", "_").lower()
        filename = os.path.join(output_dir, f"{safe_name}.json")
        
        output = {
            "category": cat,
            "scraped_at": datetime.now().isoformat(),
            "total_questions": len(qs),
            "success_count": len([q for q in qs if q.get('question_text')]),
            "questions": qs
        }
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        
        print(f"  ✓ {filename} ({output['success_count']}/{len(qs)} soru)")
    
    # Özet dosyası
    summary = {
        "scraped_at": datetime.now().isoformat(),
        "total_questions": len(questions),
        "total_success": len([q for q in questions if q.get('question_text')]),
        "categories": {
            cat: {
                "count": len(qs),
                "success": len([q for q in qs if q.get('question_text')]),
                "file": f"{cat.replace(' ', '_').replace('/', '_').lower()}.json"
            }
            for cat, qs in by_category.items()
        }
    }
    
    summary_file = os.path.join(output_dir, "_summary.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Özet: {summary_file}")
    print(f"\nTOPLAM: {summary['total_success']}/{summary['total_questions']} soru başarıyla kazındı")


if __name__ == "__main__":
    asyncio.run(main())
