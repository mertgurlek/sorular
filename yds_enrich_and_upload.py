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
from openai import AsyncOpenAI
from psycopg2.extras import Json

sys.stdout.reconfigure(line_buffering=True)

from scripts.config import get_database_url, get_openai_key
from scripts.db_utils import get_db_connection, execute_query, check_question_exists

client = AsyncOpenAI(api_key=get_openai_key())
DATABASE_URL = get_database_url()

CONCURRENT_LIMIT = 10  # Daha hızlı işlem için artırıldı

# Görseldeki kategoriler
YDS_FILES = [
    ("yds_questions/grammar_revision.json", "YDS Gramer"),
    ("yds_questions/yds_ilgisiz_cümleyi_bulma.json", "YDS İlgisiz Cümleyi Bulma"),
    ("yds_questions/yds_çeviri_soruları.json", "YDS Çeviri Soruları"),
    ("yds_questions/yds_cümle_tamamlama.json", "YDS Cümle Tamamlama"),
    ("yds_questions/yds_diyalog.json", "YDS Diyalog"),
    ("yds_questions/yds_durum.json", "YDS Durum"),
    ("yds_questions/yds_eş_anlam.json", "YDS Eş Anlam"),
    ("yds_questions/yds_paragraf_doldurma.json", "YDS Paragraf Doldurma"),
    ("yds_questions/yds_phrasal_verbs_prepositions.json", "YDS Phrasal Verbs / Prepositions"),
    ("yds_questions/yds_kelime_soruları.json", "YDS Kelime Soruları"),
    ("yds_questions/yds_okuma_soruları.json", "YDS Reading Passages"),
]

CATEGORY_PROMPTS = {
    "YDS Gramer": "genel İngilizce dilbilgisi becerisini (tenses, modals, clauses vb.)",
    "YDS Cümle Tamamlama": "cümle tamamlama becerisini (yarım bırakılmış cümleyi anlam ve dilbilgisi açısından en uygun şekilde tamamlama)",
    "YDS Diyalog": "diyalog tamamlama becerisini (konuşma akışına uygun cevap/soru bulma)",
    "YDS Durum": "duruma uygun ifade seçme becerisini (verilen durumda söylenebilecek en uygun cümle)",
    "YDS Eş Anlam": "eş anlam/yakın anlam bulma becerisini (cümledeki altı çizili ifadeye en yakın anlamlı seçenek)",
    "YDS İlgisiz Cümleyi Bulma": "paragraf bütünlüğünü bozan ilgisiz cümleyi bulma becerisini",
    "YDS Kelime Soruları": "kelime bilgisini (boşluğa en uygun kelimeyi seçme)",
    "YDS Reading Passages": "okuduğunu anlama becerisini (paragraf/metin sorularını yanıtlama)",
    "YDS Paragraf Doldurma": "paragraf tamamlama becerisini (boşluğa en uygun cümleyi yerleştirme)",
    "YDS Phrasal Verbs / Prepositions": "phrasal verb ve preposition bilgisini",
    "YDS Çeviri Soruları": "çeviri becerisini (İngilizce-Türkçe veya Türkçe-İngilizce çeviri)",
}


def get_system_prompt(category: str) -> str:
    skill = CATEGORY_PROMPTS.get(category, "İngilizce dil bilgisini")
    return f"""Sen YDS/YÖKDİL sınav uzmanısın. Bu soru {skill} sınamaktadır.

Görevin:
1. Soruyu ve şıkları dikkatlice incele
2. DOĞRU CEVABI BUL ve açıkla
3. Soru metnini Türkçeye çevir
4. Detaylı Türkçe açıklama yaz

MUTLAKA aşağıdaki JSON formatında yanıt ver:
{{
    "correct_answer": "A/B/C/D/E",
    "question_tr": "soru metninin Türkçe çevirisi",
    "explanation_tr": "Türkçe detaylı açıklama (neden bu cevap doğru, diğerleri neden yanlış)",
    "tested_skill": "sınanan spesifik beceri",
    "difficulty": "easy" | "medium" | "hard",
    "tip": "YDS/YÖKDİL için çözüm ipucu (Türkçe)"
}}

Sadece JSON döndür, başka bir şey yazma."""


async def enrich_question(question: dict, category: str, semaphore: asyncio.Semaphore, index: int) -> dict:
    """Tek bir soruyu GPT-4o-mini ile zenginleştir"""
    
    async with semaphore:
        try:
            q_text = question.get("question_text", "")
            options = question.get("options", [])
            
            if not q_text:
                return {**question, "error": "Soru metni boş", "enriched": False}
            
            options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
            
            user_prompt = f"""Soru:
{q_text}

Şıklar:
{options_text}

Kategori: {category}"""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": get_system_prompt(category)},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            result_text = result_text.strip()
            
            result = json.loads(result_text)
            
            return {
                **question,
                "correct_answer": result.get("correct_answer"),
                "question_tr": result.get("question_tr", ""),
                "explanation_tr": result.get("explanation_tr", ""),
                "tested_skill": result.get("tested_skill", ""),
                "difficulty": result.get("difficulty", "medium"),
                "tip": result.get("tip", ""),
                "enriched": True,
                "gpt_processed_at": datetime.now().isoformat()
            }
            
        except json.JSONDecodeError as e:
            return {**question, "error": f"JSON parse error: {str(e)}", "enriched": False}
        except Exception as e:
            return {**question, "error": str(e), "enriched": False}


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
            enrich_question(q, category, semaphore, idx)
            for idx, q in batch
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
