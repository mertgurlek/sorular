"""
YDS soru tiplerini JSON dosyalarından veritabanına aktar
REFACTORED VERSION - Yeni utilities kullanıyor
"""

import json
import os
import sys
from datetime import datetime

sys.stdout.reconfigure(line_buffering=True)

from scripts.db_utils import get_db_connection, check_question_exists
from scripts.constants import YDS_FILES


def migrate_questions():
    print("="*60)
    print("📦 YDS Sorularını Veritabanına Aktarma (Refactored)")
    print("="*60)
    
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
        
        with get_db_connection() as conn:
            cur = conn.cursor()
            
            for q in questions:
                question_text = q.get("question_text", "").strip()
                if not question_text:
                    skipped += 1
                    continue
                
                # Yeni utility fonksiyonu kullan
                if check_question_exists(question_text, category_name):
                    skipped += 1
                    continue
                
                options = q.get("options", [])
                options_json = json.dumps(options, ensure_ascii=False)
                correct_answer = q.get("correct_answer")
                url = q.get("url", "")
                test_url = q.get("test_url", "")
                
                try:
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
            cur.close()
        
        print(f"   ✅ Eklenen: {inserted}, Atlanan: {skipped}")
        total_inserted += inserted
        total_skipped += skipped
    
    print("\n" + "="*60)
    print(f"📊 ÖZET")
    print(f"   Toplam eklenen: {total_inserted}")
    print(f"   Toplam atlanan: {total_skipped}")
    print("="*60)


if __name__ == "__main__":
    migrate_questions()
