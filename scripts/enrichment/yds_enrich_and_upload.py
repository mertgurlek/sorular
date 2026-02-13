"""
YDS sorularını GPT-4o-mini ile asenkron zenginleştirip PostgreSQL'e gönder
Kategoriler:
- YDS Gramer (grammar_revision.json)
- YDS İlgisiz Cümleyi Bulma
- YDS Çeviri Soruları
- YDS Cümle Tamamlama
- YDS Diyalog
- YDS Durum
- YDS Eş Anlam
- YDS Paragraf Doldurma
- YDS Phrasal Verbs / Prepositions
- YDS Kelime Soruları
- YDS Reading Passages
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime
from psycopg2.extras import Json

sys.stdout.reconfigure(line_buffering=True)

from scripts.config import get_database_url
from scripts.db_utils import get_db_connection, execute_query, check_question_exists
from scripts.constants import YDS_FILES
from scripts.openai_utils import enrich_question

DATABASE_URL = get_database_url()

CONCURRENT_LIMIT = 10  # Daha hızlı işlem için artırıldı


def insert_to_db(questions: list, category: str) -> tuple:
    """Zenginleştirilmiş soruları PostgreSQL'e ekle - options sadece şıkları içerir, zenginleştirme alanları sütunlara yazılır"""
    inserted = 0
    skipped = 0
    
    batch_size = 50
    for batch_start in range(0, len(questions), batch_size):
        batch = questions[batch_start:batch_start + batch_size]
        
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                
                for q in batch:
                    if not q.get("enriched") or not q.get("correct_answer"):
                        skipped += 1
                        continue
                    
                    question_text = q.get("question_text", "").strip()
                    if not question_text:
                        skipped += 1
                        continue
                    
                    try:
                        if check_question_exists(question_text, category):
                            skipped += 1
                            continue
                        
                        options = q.get("options", [])
                        
                        cur.execute("""
                            INSERT INTO questions (
                                question_text, options, correct_answer, category, 
                                url, test_url, question_tr, explanation_tr, 
                                tested_skill, difficulty, tip
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            question_text,
                            Json(options),
                            q.get("correct_answer"),
                            category,
                            q.get("url", ""),
                            q.get("test_url", ""),
                            q.get("question_tr", ""),
                            q.get("explanation_tr", ""),
                            q.get("tested_skill", ""),
                            q.get("difficulty", "medium"),
                            q.get("tip", "")
                        ))
                        inserted += 1
                            
                    except Exception as e:
                        print(f"   ❌ DB Hata (soru): {e}")
                        skipped += 1
                        continue
                
                conn.commit()
                cur.close()
            
        except Exception as e:
            print(f"   ❌ DB Bağlantı Hatası: {e}")
            time.sleep(2)
            continue
    
    return inserted, skipped


async def process_category(file_path: str, category: str) -> dict:
    """Bir kategoriyi işle: zenginleştir + DB'ye ekle"""
    
    print(f"\n{'='*60}")
    print(f"📂 {category}")
    print(f"   Dosya: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"   ❌ Dosya bulunamadı!")
        return {"success": 0, "errors": 0, "db_inserted": 0}
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    questions = data.get("questions", [])
    total = len(questions)
    print(f"   Toplam soru: {total}")
    
    # Zaten zenginleştirilmiş ve correct_answer'ı olan soruları atla
    to_process = []
    already_enriched = []
    for i, q in enumerate(questions):
        if q.get("enriched") and q.get("correct_answer"):
            already_enriched.append(q)
        elif not q.get("correct_answer"):  # correct_answer yoksa işle
            to_process.append((i, q))
        else:
            already_enriched.append(q)
    
    if already_enriched:
        print(f"   ⏭️ Zaten zenginleştirilmiş: {len(already_enriched)}")
    
    print(f"   🔄 İşlenecek: {len(to_process)}")
    
    if not to_process:
        # Sadece DB'ye ekle
        print(f"   📤 Database'e ekleniyor...")
        db_inserted, db_skipped = insert_to_db(already_enriched, category)
        print(f"   ✅ DB'ye eklenen: {db_inserted}, Atlanan: {db_skipped}")
        return {"success": len(already_enriched), "errors": 0, "db_inserted": db_inserted}
    
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    success = 0
    errors = 0
    
    start_time = time.time()
    
    # Batch işleme
    batch_size = 50
    enriched_questions = list(already_enriched)  # Önceden zenginleştirilmişleri ekle
    
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
                enriched_questions.append(result)
            else:
                errors += 1
        
        # İlerleme göster
        processed = batch_start + len(batch)
        progress = (processed / len(to_process)) * 100
        print(f"   İlerleme: {processed}/{len(to_process)} ({progress:.1f}%)")
        
        # Her batch sonrası JSON'a kaydet (güvenlik için)
        data["questions"] = questions
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    elapsed = time.time() - start_time
    print(f"   ✅ Zenginleştirme: {success} başarılı, {errors} hata ({elapsed:.1f}sn)")
    
    # Database'e ekle
    print(f"   📤 Database'e ekleniyor...")
    db_inserted, db_skipped = insert_to_db(enriched_questions, category)
    print(f"   ✅ DB'ye eklenen: {db_inserted}, Atlanan: {db_skipped}")
    
    return {"success": success + len(already_enriched), "errors": errors, "db_inserted": db_inserted}


async def main():
    print("="*60)
    print("🚀 YDS Soru Zenginleştirme + PostgreSQL Upload")
    print(f"   Model: gpt-4o-mini")
    print(f"   Paralel limit: {CONCURRENT_LIMIT}")
    print("="*60)
    
    # Database bağlantısı test
    if not DATABASE_URL:
        print("❌ DATABASE_URL bulunamadı!")
        return
    
    try:
        test_conn = get_db_connection()
        test_conn.close()
        print("✅ Database bağlantısı başarılı")
    except Exception as e:
        print(f"❌ Database bağlantı hatası: {e}")
        return
    
    total_success = 0
    total_errors = 0
    total_db_inserted = 0
    
    start_time = datetime.now()
    
    for file_path, category in YDS_FILES:
        result = await process_category(file_path, category)
        total_success += result["success"]
        total_errors += result["errors"]
        total_db_inserted += result["db_inserted"]
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    print("\n" + "="*60)
    print("📊 ÖZET")
    print("="*60)
    print(f"⏱️  Süre: {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    print(f"✅ Zenginleştirilen: {total_success}")
    print(f"❌ Hatalar: {total_errors}")
    print(f"📤 DB'ye eklenen: {total_db_inserted}")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
