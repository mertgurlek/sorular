import asyncio
from playwright.async_api import async_playwright

async def test_get_answer():
    """Doğru cevabı almak için formu test et"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://www.sorukurdu.com/test-sorular/YDS-TENSES---TEST-6442-1.html"
        await page.goto(url, wait_until="domcontentloaded", timeout=60000)
        
        print("Sayfa yüklendi, şık seçiliyor...")
        
        # Bir şık seç (örn: A) - label'a tıkla
        await page.click("label[for='radio-1']")
        await asyncio.sleep(1)
        
        # Formu gönder
        print("Form gönderiliyor...")
        await page.click("input#submit")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        
        # Sayfa içeriğini kontrol et
        html = await page.content()
        
        # HTML'i kaydet
        with open("after_submit.html", "w", encoding="utf-8") as f:
            f.write(html)
        print(f"HTML kaydedildi: after_submit.html ({len(html)} karakter)")
        
        # Doğru/yanlış bilgisi ara
        fieldset = await page.query_selector("#commentForm fieldset")
        if fieldset:
            text = await fieldset.inner_text()
            print("\nFieldset içeriği:")
            print(text[:1000])
        
        await asyncio.sleep(5)  # Görmek için bekle
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_get_answer())
