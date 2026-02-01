"""
YDS soru tiplerini JSON dosyalarından veritabanına aktar
"""

import json
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from datetime import datetime

# Output'u hemen göster
sys.stdout.reconfigure(line_buffering=True)

load_dotenv()
load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    if DATABASE_URL.startswith("psql '"):
        DATABASE_URL = DATABASE_URL[6:-1]
    elif DATABASE_URL.startswith("psql "):
        DATABASE_URL = DATABASE_URL[5:]
    DATABASE_URL = DATABASE_URL.strip("'\"")

YDS_FILES = [
    ("yds_questions/yds_cümle_tamamlama.json", "YDS Cümle Tamamlama"),
    ("yds_questions/yds_diyalog.json", "YDS Diyalog"),
    ("yds_questions/yds_durum.json", "YDS Durum"),
    ("yds_questions/yds_eş_anlam.json", "YDS Eş Anlam"),
    ("yds_questions/yds_ilgisiz_cümleyi_bulma.json", "YDS İlgisiz Cümleyi Bulma"),
    ("yds_questions/yds_kelime_soruları.json", "YDS Kelime Soruları"),
    ("yds_questions/yds_okuma_soruları.json", "YDS Okuma Soruları"),
    ("yds_questions/yds_paragraf_doldurma.json", "YDS Paragraf Doldurma"),
    ("yds_questions/yds_phrasal_verbs_prepositions.json", "YDS Phrasal Verbs"),
    ("yds_questions/yds_çeviri_soruları.json", "YDS Çeviri Soruları"),
]

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)

def migrate_questions():
    print("="*60)
    print("📦 YDS Sorularını Veritabanına Aktarma")
    print("="*60)
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    total_inserted = 0
    total_skipped = 0
    
    for file_path, category_name in YDS_FILES:
        if not os.path.exists(file_path):
            print(f"⚠️ Dosya bulunamadı: {file_path}")
            continue
        
        print(f"\n📂 {category_name}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        questions = data.get("questions", [])
        print(f"   Toplam soru: {len(questions)}")
        
        inserted = 0
        skipped = 0
        
        for q in questions:
            question_text = q.get("question_text", "").strip()
            if not question_text:
                skipped += 1
                continue
            
            options = q.get("options", [])
            options_json = json.dumps(options, ensure_ascii=False)
            correct_answer = q.get("correct_answer")
            url = q.get("url", "")
            test_url = q.get("test_url", "")
            
            try:
                # Önce bu soru var mı kontrol et
                cur.execute("""
                    SELECT id FROM questions 
                    WHERE question_text = %s AND category = %s
                """, (question_text, category_name))
                
                if cur.fetchone():
                    skipped += 1
                    continue
                
                cur.execute("""
                    INSERT INTO questions (
                        question_text, options, correct_answer, category, url, test_url
                    ) VALUES (%s, %s::jsonb, %s, %s, %s, %s)
                """, (
                    question_text,
                    options_json,
                    correct_answer,
                    category_name,
                    url,
                    test_url
                ))
                inserted += 1
                    
            except Exception as e:
                print(f"   ❌ Hata: {e}")
                skipped += 1
                conn.rollback()
                continue
        
        conn.commit()
        print(f"   ✅ Eklenen: {inserted}, Atlanan: {skipped}")
        total_inserted += inserted
        total_skipped += skipped
    
    cur.close()
    conn.close()
    
    print("\n" + "="*60)
    print(f"📊 ÖZET")
    print(f"   Toplam eklenen: {total_inserted}")
    print(f"   Toplam atlanan: {total_skipped}")
    print("="*60)

if __name__ == "__main__":
    migrate_questions()
