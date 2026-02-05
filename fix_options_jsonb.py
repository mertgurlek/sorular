"""
Migration Script: JSONB options içindeki zenginleştirme alanlarını sütunlara taşı

Bu script, yds_enrich_and_upload.py'nin eski versiyonunun options JSONB alanına
gömülmüş zenginleştirme verilerini (question_tr, explanation_tr, tip, difficulty,
tested_skill) ilgili sütunlara taşır ve options alanını sadece şık dizisi olarak temizler.

Kullanım:
    python fix_options_jsonb.py

Güvenli: Sadece iç içe yapıdaki kayıtları günceller, zaten düzgün olanları atlar.
"""

import json
from scripts.config import get_database_url
from scripts.db_utils import get_db_connection

ENRICHMENT_FIELDS = ["question_tr", "explanation_tr", "tested_skill", "difficulty", "tip"]


def migrate_nested_options():
    """options JSONB içindeki zenginleştirme alanlarını sütunlara taşı"""
    
    print("=" * 60)
    print("🔄 JSONB Options Migration")
    print("   Zenginleştirme alanlarını sütunlara taşıma")
    print("=" * 60)
    
    # Önce şema güncellemesi yap (sütunlar yoksa ekle)
    ensure_columns()
    
    with get_db_connection() as conn:
        cur = conn.cursor()
        
        # İç içe yapıdaki kayıtları bul: options obje ve .options anahtarı var
        cur.execute("""
            SELECT id, options, question_tr, explanation_tr, tested_skill, difficulty, tip
            FROM questions
            WHERE jsonb_typeof(options) = 'object' 
            AND options ? 'options'
        """)
        
        rows = cur.fetchall()
        print(f"\n📊 İç içe yapıda {len(rows)} kayıt bulundu")
        
        if not rows:
            print("✅ Tüm kayıtlar zaten düzgün formatta!")
            cur.close()
            return
        
        migrated = 0
        skipped = 0
        errors = 0
        
        for row in rows:
            q_id = row[0]
            options_data = row[1]
            existing_question_tr = row[2]
            existing_explanation_tr = row[3]
            existing_tested_skill = row[4]
            existing_difficulty = row[5]
            existing_tip = row[6]
            
            try:
                # options_data zaten dict olarak geliyor (psycopg2 JSONB parse eder)
                if isinstance(options_data, str):
                    options_data = json.loads(options_data)
                
                if not isinstance(options_data, dict) or "options" not in options_data:
                    skipped += 1
                    continue
                
                # Şık dizisini çıkar
                clean_options = options_data.get("options", [])
                if not isinstance(clean_options, list):
                    clean_options = []
                
                # Zenginleştirme alanlarını çıkar (sadece sütun boşsa yaz)
                question_tr = options_data.get("question_tr", "") if not existing_question_tr else existing_question_tr
                explanation_tr = options_data.get("explanation_tr", "") if not existing_explanation_tr else existing_explanation_tr
                tested_skill = options_data.get("tested_skill", "") if not existing_tested_skill else existing_tested_skill
                difficulty = options_data.get("difficulty", "medium") if not existing_difficulty else existing_difficulty
                tip = options_data.get("tip", "") if not existing_tip else existing_tip
                
                # Güncelle: options = sadece şık dizisi, zenginleştirme alanları = sütunlara
                cur.execute("""
                    UPDATE questions SET
                        options = %s::jsonb,
                        question_tr = %s,
                        explanation_tr = %s,
                        tested_skill = %s,
                        difficulty = %s,
                        tip = %s
                    WHERE id = %s
                """, (
                    json.dumps(clean_options, ensure_ascii=False),
                    question_tr,
                    explanation_tr,
                    tested_skill,
                    difficulty,
                    tip,
                    q_id
                ))
                
                migrated += 1
                
                if migrated % 100 == 0:
                    conn.commit()
                    print(f"   İlerleme: {migrated}/{len(rows)}")
                    
            except Exception as e:
                print(f"   ❌ Hata (ID: {q_id}): {e}")
                errors += 1
                continue
        
        conn.commit()
        cur.close()
    
    print(f"\n{'=' * 60}")
    print(f"📊 SONUÇ")
    print(f"   ✅ Taşınan: {migrated}")
    print(f"   ⏭️  Atlanan: {skipped}")
    print(f"   ❌ Hata: {errors}")
    print(f"{'=' * 60}")


def ensure_columns():
    """Zenginleştirme sütunlarının var olduğundan emin ol"""
    alter_statements = [
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_tr TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_tr TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS tested_skill VARCHAR(200)",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT 'medium'",
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
                print(f"  ⚠️ {e}")
        conn.commit()
        cur.close()
    print("✅ Sütunlar kontrol edildi")


def verify_migration():
    """Migration sonrası doğrulama"""
    with get_db_connection() as conn:
        cur = conn.cursor()
        
        # Hala iç içe yapıda olan kayıt var mı?
        cur.execute("""
            SELECT COUNT(*) FROM questions
            WHERE jsonb_typeof(options) = 'object' 
            AND options ? 'options'
        """)
        nested_count = cur.fetchone()[0]
        
        # Toplam kayıt sayısı
        cur.execute("SELECT COUNT(*) FROM questions")
        total_count = cur.fetchone()[0]
        
        # options array olan kayıt sayısı
        cur.execute("""
            SELECT COUNT(*) FROM questions
            WHERE jsonb_typeof(options) = 'array'
        """)
        array_count = cur.fetchone()[0]
        
        # Zenginleştirme alanları dolu olan kayıt sayısı
        cur.execute("""
            SELECT COUNT(*) FROM questions
            WHERE question_tr IS NOT NULL AND question_tr != ''
        """)
        enriched_count = cur.fetchone()[0]
        
        cur.close()
    
    print(f"\n{'=' * 60}")
    print(f"🔍 DOĞRULAMA")
    print(f"   Toplam soru: {total_count}")
    print(f"   Options dizisi (doğru): {array_count}")
    print(f"   Options iç içe (hatalı): {nested_count}")
    print(f"   Zenginleştirilmiş (question_tr dolu): {enriched_count}")
    print(f"{'=' * 60}")
    
    if nested_count == 0:
        print("✅ Migration başarılı! Tüm kayıtlar düzgün formatta.")
    else:
        print(f"⚠️ Hala {nested_count} kayıt iç içe yapıda!")


if __name__ == "__main__":
    migrate_nested_options()
    verify_migration()
