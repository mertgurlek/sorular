import asyncio
from playwright.async_api import async_playwright

async def test():
    p = await async_playwright().start()
    b = await p.chromium.launch(headless=True)
    page = await b.new_page()
    
    # Başarılı URL
    url1 = "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-1414-1.html"
    # Başarısız URL  
    url2 = "https://www.sorukurdu.com/test-sorular/YDS-NOUNS-ARTICLES-QUANTIFIERS-PRONOUNS---TEST-3416-22.html"
    
    for url in [url1, url2]:
        print(f"\n{'='*60}")
        print(f"URL: {url}")
        await page.goto(url, timeout=60000)
        await asyncio.sleep(1)
        
        # Hata kontrolü
        html = await page.content()
        if "Hatalı Sayfa" in html:
            print("HATA: Sayfa bulunamadı")
        else:
            qt = await page.query_selector("span.question-text")
            if qt:
                print(f"Soru: {(await qt.inner_text())[:100]}")
            else:
                print("Soru elementi bulunamadı")
    
    url = url1  # Dummy for rest of code
    await page.goto(url, timeout=60000)
    await asyncio.sleep(2)  # JS yüklensin
    
    html = await page.content()
    # Soru kısmını bul
    if "soru" in html.lower() or "question" in html.lower():
        idx = html.lower().find("soru")
        if idx == -1:
            idx = html.lower().find("question")
        print(f"HTML içeriği (soru civarı):")
        print(html[max(0,idx-100):idx+2000])
    else:
        print(html[3000:6000])
    
    await b.close()
    await p.stop()

asyncio.run(test())
