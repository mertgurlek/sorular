import asyncio
from playwright.async_api import async_playwright
import json
import re

async def scrape_single_question(page) -> dict:
    """Açık sayfadan soru bilgilerini çıkar"""
    result = {
        "question_number": "",
        "question_text": "",
        "options": [],
        "correct_answer": None
    }
    
    try:
        # Soru numarası ve metni - fieldset içinde
        fieldset = await page.query_selector("#commentForm fieldset")
        if fieldset:
            # Tüm fieldset içeriğini al
            fieldset_html = await fieldset.inner_html()
            
            # Soru numarası ve metni regex ile çıkar
            # Pattern: <div style="font-weight: bold; ">1.  </div><div style="width: 590px;">SORU METNİ</div>
            
            # Soru numarası
            num_match = re.search(r'<div[^>]*font-weight[^>]*bold[^>]*>([^<]+)</div>', fieldset_html)
            if num_match:
                result["question_number"] = num_match.group(1).strip()
            
            # Soru metni - width: 590px olan div
            text_match = re.search(r'<div[^>]*width:\s*590px[^>]*>(.*?)</div>', fieldset_html, re.DOTALL)
            if text_match:
                text = text_match.group(1)
                text = text.replace("<br>", "\n").replace("<br/>", "\n")
                text = re.sub(r'<[^>]+>', '', text)
                result["question_text"] = text.strip()
        
        # Şıklar - .custom-radio label içinde
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
        print(f"Soru parse hatası: {e}")
    
    return result

async def scrape_test(base_url: str, start: int = 1, end: int = 60) -> list:
    """Bir testteki tüm soruları kazır"""
    questions = []
    
    # URL pattern'i tespit et: YDS-TENSES---TEST-6442-1.html
    # Son sayıyı değiştirerek diğer sorulara gideceğiz
    import re
    pattern = r'(.*-)\d+(\.html.*)'
    match = re.match(pattern, base_url)
    if not match:
        print(f"URL pattern tanınamadı: {base_url}")
        return questions
    
    url_prefix = match.group(1)
    url_suffix = match.group(2)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        for i in range(start, end + 1):
            url = f"{url_prefix}{i}{url_suffix}"
            print(f"Kazınıyor [{i}/{end}]: {url}")
            
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(0.5)
                
                q = await scrape_single_question(page)
                q["url"] = url
                q["index"] = i
                questions.append(q)
                
            except Exception as e:
                print(f"Hata ({url}): {e}")
                questions.append({
                    "index": i,
                    "url": url,
                    "error": str(e)
                })
        
        await browser.close()
    
    return questions

async def main():
    import sys
    
    # Varsayılan URL ve soru aralığı
    url = "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-6442-1.html"
    start = 1
    end = 60  # Bu testte 60 soru var
    
    # Komut satırı argümanları
    if len(sys.argv) >= 2:
        url = sys.argv[1]
    if len(sys.argv) >= 3:
        start = int(sys.argv[2])
    if len(sys.argv) >= 4:
        end = int(sys.argv[3])
    
    print(f"Kazıma başlıyor: {url}")
    print(f"Soru aralığı: {start} - {end}")
    print("="*60)
    
    questions = await scrape_test(url, start, end)
    
    # Özet
    success = len([q for q in questions if q.get('question_text')])
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI: {success}/{len(questions)} soru başarıyla kazındı")
    
    # JSON olarak kaydet
    output_file = "questions.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)
    print(f"Kaydedildi: {output_file}")
    
    # Örnek çıktı
    if questions:
        print(f"\nÖrnek (ilk soru):")
        q = questions[0]
        print(f"  Numara: {q.get('question_number', '')}")
        print(f"  Metin: {q.get('question_text', '')[:100]}...")
        print(f"  Şık sayısı: {len(q.get('options', []))}")

if __name__ == "__main__":
    asyncio.run(main())
