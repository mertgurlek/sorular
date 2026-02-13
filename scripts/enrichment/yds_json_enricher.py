"""
YDS JSON dosyalarını GPT-4o-mini ile zenginleştir
- Doğru cevabı bul
- Türkçe çeviri ekle
- Açıklama ekle
- Zorluk seviyesi belirle
- Sınanan beceriyi tanımla
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(line_buffering=True)

from scripts.constants import YDS_FILES
from scripts.openai_utils import enrich_question

CONCURRENT_LIMIT = 5


async def process_file(file_path: str, category: str) -> dict:
    """Bir JSON dosyasını işle"""
    
    print(f"\n{'='*60}")
    print(f"📂 {category}")
    print(f"   Dosya: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"   ❌ Dosya bulunamadı!")
        return {"success": 0, "errors": 0, "skipped": 0}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    questions = data.get("questions", [])
    total = len(questions)
    print(f"   Toplam soru: {total}")
    
    # Zaten zenginleştirilmiş soruları atla
    to_process = []
    skipped = 0
    for i, q in enumerate(questions):
        if q.get("enriched") or q.get("gpt_processed_at"):
            skipped += 1
        else:
            to_process.append((i, q))
    
    if skipped > 0:
        print(f"   ⏭️ Zaten işlenmiş: {skipped}")
    
    if not to_process:
        print(f"   ✅ Tüm sorular zaten zenginleştirilmiş!")
        return {"success": skipped, "errors": 0, "skipped": skipped}
    
    print(f"   İşlenecek: {len(to_process)}")
    
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    success = 0
    errors = 0
    
    start_time = time.time()
    
    # Batch işleme
    batch_size = 50
    for batch_start in range(0, len(to_process), batch_size):
        batch = to_process[batch_start:batch_start + batch_size]
        
        tasks = [
            enrich_question(q, category, semaphore)
            for _, q in batch
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Sonuçları güncelle
        for (orig_idx, _), result in zip(batch, results):
            questions[orig_idx] = result
            if result.get("enriched"):
                success += 1
            else:
                errors += 1
        
        # İlerleme göster
        processed = batch_start + len(batch)
        progress = (processed / len(to_process)) * 100
        print(f"   İlerleme: {processed}/{len(to_process)} ({progress:.1f}%)")
        
        # Her batch sonrası kaydet (güvenlik için)
        data["questions"] = questions
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    elapsed = time.time() - start_time
    print(f"   ✅ Tamamlandı: {success} başarılı, {errors} hata ({elapsed:.1f}sn)")
    
    return {"success": success + skipped, "errors": errors, "skipped": skipped}


async def main():
    print("="*60)
    print("🔍 YDS Soru Zenginleştirme (GPT-4o-mini)")
    print(f"   Paralel limit: {CONCURRENT_LIMIT}")
    print("="*60)
    
    total_success = 0
    total_errors = 0
    
    start_time = datetime.now()
    
    for file_path, category in YDS_FILES:
        result = await process_file(file_path, category)
        total_success += result["success"]
        total_errors += result["errors"]
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    print("\n" + "="*60)
    print("📊 ÖZET")
    print("="*60)
    print(f"⏱️  Süre: {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    print(f"✅ Başarılı: {total_success}")
    print(f"❌ Hatalar: {total_errors}")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
