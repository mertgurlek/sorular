"""
YDS/YÖKDİL Soru Kalite Kontrol ve Zenginleştirme Scripti

Bu script veritabanındaki tüm soruları GPT-4o ile kontrol eder:
- Hatalı soruları düzeltir veya yeniden oluşturur
- Türkçe çeviri ve açıklama ekler
- Zorluk seviyesi belirler
- Sınanan beceriyi tanımlar
"""

import asyncio
import json
import os
import time
from datetime import datetime
from openai import AsyncOpenAI
from psycopg2.extras import RealDictCursor

from scripts.config import get_database_url, get_openai_key
from scripts.db_utils import get_db_connection, execute_query, db_manager

client = AsyncOpenAI(api_key=get_openai_key())
DATABASE_URL = get_database_url()

CONCURRENT_LIMIT = 5
BATCH_SIZE = 10

CATEGORY_PROMPTS = {
    "Adjectives Adverbs": "sıfat ve zarf kullanımını (comparatives, superlatives, so/such, too/enough yapıları)",
    "Conjunctions": "bağlaç kullanımını (and, but, or, so, because, although, however, therefore vb.)",
    "Gerunds Infinitives": "gerund (-ing) ve infinitive (to + verb) kullanımını",
    "Grammar Revision": "genel İngilizce gramer bilgisini (karma gramer konuları)",
    "If Clauses": "koşul cümlelerini (Type 0, 1, 2, 3 ve mixed conditionals)",
    "Modals": "modal fiilleri (can, could, may, might, must, should, would, will vb.)",
    "Nouns": "isim kullanımını (countable/uncountable, articles, quantifiers)",
    "Noun Clauses": "isim cümleciklerini (that-clause, wh-clause, if/whether clause)",
    "Passive": "edilgen yapıyı (passive voice - tüm zamanlar)",
    "Reductions": "cümle kısaltmalarını (reduced relative clauses, reduced adverbial clauses)",
    "Relative Clauses": "sıfat cümleciklerini (who, which, that, whose, where, when)",
    "Tenses": "İngilizce zaman kiplerini (present, past, future - simple, continuous, perfect)",
    "Cümle Tamamlama": "cümle tamamlama becerisini (yarım cümleyi anlamlı şekilde tamamlama)",
    "Okuma Soruları": "okuduğunu anlama becerisini (reading comprehension)",
    "Çeviri Soruları": "İngilizce-Türkçe çeviri becerisini",
    "Diyalog": "diyalog tamamlama becerisini (konuşma bağlamını anlama)",
    "Durum": "durum ifade etme becerisini (verilen duruma uygun cümle seçme)",
    "Eş Anlam": "eş anlamlı cümle bulma becerisini (paraphrasing)",
    "İlgisiz Cümleyi Bulma": "paragraf tutarlılığını anlama becerisini",
    "Paragraf Doldurma": "paragraf tamamlama becerisini",
    "Phrasal Verbs Prepositions": "phrasal verb ve edat kullanımını",
    "Kelime Soruları": "kelime bilgisini (vocabulary)"
}

def get_category_prompt(category: str) -> str:
    """Kategori için özelleştirilmiş prompt döndürür"""
    skill = CATEGORY_PROMPTS.get(category, "İngilizce dil bilgisini")
    return f"""Bu bir YDS/YÖKDİL sınavına hazırlık sorusudur. Bu soru {skill} sınamaktadır.

Görevin:
1. Soruyu ve şıkları dikkatlice incele
2. Yazım/imla hatası varsa düzelt
3. Soru tamamen hatalı veya çözülemez ise, AYNI KONUYU sınayan yeni bir soru oluştur
4. Doğru cevabı belirle ve açıkla

MUTLAKA aşağıdaki JSON formatında yanıt ver:
{{
    "status": "valid" | "corrected" | "regenerated",
    "is_valid": true | false,
    "question_text": "düzeltilmiş veya yeni soru metni",
    "options": [
        {{"letter": "A", "text": "şık metni"}},
        {{"letter": "B", "text": "şık metni"}},
        {{"letter": "C", "text": "şık metni"}},
        {{"letter": "D", "text": "şık metni"}},
        {{"letter": "E", "text": "şık metni"}}
    ],
    "correct_answer": "A/B/C/D/E",
    "question_tr": "soru metninin Türkçe çevirisi",
    "explanation_tr": "Türkçe detaylı açıklama (neden bu cevap doğru, diğerleri neden yanlış)",
    "tested_skill": "sınanan spesifik dilbilgisi konusu (örn: Present Perfect vs Past Simple)",
    "difficulty": "easy" | "medium" | "hard",
    "tip": "YDS/YÖKDİL için çözüm ipucu (Türkçe)"
}}

Sadece JSON döndür, başka bir şey yazma."""


async def validate_question(question: dict, category: str, semaphore: asyncio.Semaphore) -> dict:
    """Tek bir soruyu GPT-4o ile doğrula ve zenginleştir"""
    
    async with semaphore:
        try:
            q_text = question.get("question_text", "")
            options = parse_options_from_jsonb(question.get("options", []))
            
            if not q_text:
                return {**question, "error": "Soru metni boş", "processed": False}
            
            options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
            current_answer = question.get("correct_answer", "Belirtilmemiş")
            
            user_prompt = f"""Soru:
{q_text}

Şıklar:
{options_text}

Mevcut doğru cevap: {current_answer}
Kategori: {category}"""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": get_category_prompt(category)},
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
                "id": question["id"],
                "original_question": q_text,
                "status": result.get("status", "valid"),
                "is_valid": result.get("is_valid", True),
                "question_text": result.get("question_text", q_text),
                "options": result.get("options", options),
                "correct_answer": result.get("correct_answer"),
                "question_tr": result.get("question_tr", ""),
                "explanation_tr": result.get("explanation_tr", ""),
                "tested_skill": result.get("tested_skill", ""),
                "difficulty": result.get("difficulty", "medium"),
                "tip": result.get("tip", ""),
                "processed": True,
                "category": category
            }
            
        except json.JSONDecodeError as e:
            return {**question, "error": f"JSON parse error: {str(e)}", "processed": False}
        except Exception as e:
            return {**question, "error": str(e), "processed": False}


def ensure_schema():
    """Veritabanı şemasını güncelle - yeni alanları ekle (idempotent)"""
    alter_statements = [
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_tr TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_tr TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS tested_skill VARCHAR(200)",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20)",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS tip TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT true",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS gpt_status VARCHAR(20)",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS gpt_verified_at TIMESTAMP"
    ]
    
    with get_db_connection() as conn:
        cur = conn.cursor()
        for stmt in alter_statements:
            try:
                cur.execute(stmt)
            except Exception as e:
                print(f"  ⚠️ {stmt[:50]}... - {e}")
        conn.commit()
        cur.close()
    print("✅ Veritabanı şeması güncellendi")


def parse_options_from_jsonb(options_jsonb):
    """JSONB formatındaki options'ı parse et"""
    if not options_jsonb:
        return []
    if isinstance(options_jsonb, str):
        import json
        options_jsonb = json.loads(options_jsonb)
    return options_jsonb


def get_categories():
    """Veritabanındaki kategorileri getir"""
    return execute_query(
        """SELECT DISTINCT category, COUNT(*) as count 
           FROM questions 
           WHERE category IS NOT NULL
           GROUP BY category 
           ORDER BY count DESC""",
        fetch_all=True, use_dict_cursor=True
    )


def get_questions_by_category(category: str, limit: int = None, offset: int = 0):
    """Kategoriye göre soruları getir"""
    sql = """
        SELECT id, question_text, options, correct_answer, category
        FROM questions 
        WHERE category = %s
        AND (gpt_verified_at IS NULL OR gpt_status IS NULL)
        ORDER BY id
    """
    params = (category,)
    
    if limit:
        sql += f" LIMIT {limit} OFFSET {offset}"
    
    return execute_query(sql, params, fetch_all=True, use_dict_cursor=True)


def update_question_in_db(result: dict, retries=3):
    """Doğrulanmış soruyu veritabanında güncelle - retry mekanizması ile"""
    
    for attempt in range(retries):
        try:
            with get_db_connection() as conn:
                cur = conn.cursor()
                
                options = result.get("options", [])
                options_json = json.dumps(options, ensure_ascii=False)
                
                if result.get("status") == "regenerated":
                    cur.execute("""
                        UPDATE questions SET
                            question_text = %s,
                            options = %s::jsonb,
                            correct_answer = %s,
                            question_tr = %s,
                            explanation_tr = %s,
                            tested_skill = %s,
                            difficulty = %s,
                            tip = %s,
                            is_valid = %s,
                            gpt_status = %s,
                            gpt_verified_at = %s
                        WHERE id = %s
                    """, (
                        result.get("question_text"),
                        options_json,
                        result.get("correct_answer"),
                        result.get("question_tr"),
                        result.get("explanation_tr"),
                        result.get("tested_skill"),
                        result.get("difficulty"),
                        result.get("tip"),
                        result.get("is_valid", True),
                        result.get("status"),
                        datetime.now(),
                        result.get("id")
                    ))
                else:
                    cur.execute("""
                        UPDATE questions SET
                            correct_answer = COALESCE(%s, correct_answer),
                            question_tr = %s,
                            explanation_tr = %s,
                            tested_skill = %s,
                            difficulty = %s,
                            tip = %s,
                            is_valid = %s,
                            gpt_status = %s,
                            gpt_verified_at = %s
                        WHERE id = %s
                    """, (
                        result.get("correct_answer"),
                        result.get("question_tr"),
                        result.get("explanation_tr"),
                        result.get("tested_skill"),
                        result.get("difficulty"),
                        result.get("tip"),
                        result.get("is_valid", True),
                        result.get("status"),
                        datetime.now(),
                        result.get("id")
                    ))
                
                conn.commit()
                cur.close()
            return True
            
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"  ❌ DB güncelleme hatası (ID: {result.get('id')}): {e}")
                return False


async def process_category(category: str, questions: list) -> dict:
    """Bir kategorideki soruları işle"""
    
    print(f"\n{'='*60}")
    print(f"📚 Kategori: {category}")
    print(f"   Toplam soru: {len(questions)}")
    
    if not questions:
        return {"category": category, "processed": 0, "success": 0, "errors": 0}
    
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    start_time = datetime.now()
    
    processed_count = {"count": 0, "total": len(questions)}
    
    async def process_with_progress(q):
        result = await validate_question(q, category, semaphore)
        processed_count["count"] += 1
        
        if processed_count["count"] % 5 == 0 or processed_count["count"] == processed_count["total"]:
            pct = (processed_count["count"] / processed_count["total"]) * 100
            print(f"\r   İlerleme: {processed_count['count']}/{processed_count['total']} ({pct:.1f}%)", end="", flush=True)
        
        if result.get("processed"):
            update_question_in_db(result)
        
        return result
    
    tasks = [process_with_progress(q) for q in questions]
    results = await asyncio.gather(*tasks)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    success_count = len([r for r in results if r.get("processed")])
    error_count = len([r for r in results if not r.get("processed")])
    regenerated_count = len([r for r in results if r.get("status") == "regenerated"])
    corrected_count = len([r for r in results if r.get("status") == "corrected"])
    
    print(f"\n   ✅ Tamamlandı: {success_count}/{len(questions)} ({elapsed:.1f}sn)")
    print(f"   📝 Düzeltilen: {corrected_count}, Yeniden oluşturulan: {regenerated_count}")
    if error_count > 0:
        print(f"   ❌ Hatalar: {error_count}")
    
    return {
        "category": category,
        "processed": len(questions),
        "success": success_count,
        "errors": error_count,
        "regenerated": regenerated_count,
        "corrected": corrected_count,
        "elapsed_seconds": elapsed
    }


async def main():
    """Ana fonksiyon"""
    
    print("="*60)
    print("🔍 YDS/YÖKDİL Soru Kalite Kontrol Sistemi")
    print(f"   Model: GPT-4o-mini")
    print(f"   Paralel limit: {CONCURRENT_LIMIT}")
    print("="*60)
    
    print("\n📦 Veritabanı şeması güncelleniyor...")
    ensure_schema()
    
    print("\n📋 Kategoriler yükleniyor...")
    categories = get_categories()
    
    print(f"   {len(categories)} kategori bulundu:")
    for cat in categories:
        print(f"   - {cat['category']}: {cat['count']} soru")
    
    start_time = datetime.now()
    all_results = []
    
    for cat in categories:
        category_name = cat['category']
        questions = get_questions_by_category(category_name)
        
        if not questions:
            print(f"\n⏭️ {category_name}: Tüm sorular zaten doğrulanmış")
            continue
        
        result = await process_category(category_name, questions)
        all_results.append(result)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    total_processed = sum(r["processed"] for r in all_results)
    total_success = sum(r["success"] for r in all_results)
    total_errors = sum(r["errors"] for r in all_results)
    total_regenerated = sum(r.get("regenerated", 0) for r in all_results)
    total_corrected = sum(r.get("corrected", 0) for r in all_results)
    
    print(f"\n{'='*60}")
    print("📊 ÖZET")
    print("="*60)
    print(f"⏱️  Süre: {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    print(f"✅ Başarılı: {total_success}/{total_processed}")
    print(f"📝 Düzeltilen: {total_corrected}")
    print(f"🔄 Yeniden oluşturulan: {total_regenerated}")
    print(f"❌ Hatalar: {total_errors}")
    
    summary = {
        "completed_at": datetime.now().isoformat(),
        "total_processed": total_processed,
        "total_success": total_success,
        "total_errors": total_errors,
        "total_regenerated": total_regenerated,
        "total_corrected": total_corrected,
        "elapsed_seconds": elapsed,
        "categories": all_results
    }
    
    with open("validation_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Özet kaydedildi: validation_summary.json")


if __name__ == "__main__":
    asyncio.run(main())
