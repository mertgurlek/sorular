"""
Database'deki YDS sorularını analiz et ve gerçek YDS dağılımına göre
mini (20), orta (40), tam (80) quiz presetleri oluştur.

Gerçek YDS Sınav Dağılımı (80 soru):
- Kelime (Vocabulary): 10 soru
- Dilbilgisi (Grammar): 10 soru  
- Cümle Tamamlama: 10 soru
- İngilizce-Türkçe Çeviri: 6 soru
- Türkçe-İngilizce Çeviri: 6 soru
- Diyalog Tamamlama: 5 soru
- Paragraf Tamamlama: 5 soru
- Anlam Bütünlüğü (İlgisiz Cümle): 5 soru
- Okuma Parçaları (Reading): ~18 soru
- Yakın Anlam (Eş Anlam): 5 soru
"""

import json
import os
import sys
from datetime import datetime
import random

sys.stdout.reconfigure(line_buffering=True)

from scripts.db_utils import get_db_connection, execute_query
from scripts.constants import YDS_FULL_DISTRIBUTION, CATEGORY_ALIASES


def analyze_database():
    """Database'deki soruları kategorilere göre analiz et"""
    print("="*60)
    print("📊 Database Soru Analizi")
    print("="*60)
    
    with get_db_connection(use_dict_cursor=True) as conn:
        cur = conn.cursor()
        
        cur.execute("""
            SELECT category, COUNT(*) as count
            FROM questions
            GROUP BY category
            ORDER BY count DESC
        """)
        
        categories = cur.fetchall()
        total = sum(c['count'] for c in categories)
        
        print(f"\n📦 Toplam Soru: {total}")
        print("\n📂 Kategoriler:")
        print("-"*50)
        
        category_map = {}
        for cat in categories:
            print(f"   {cat['category']}: {cat['count']} soru")
            category_map[cat['category']] = cat['count']
        
        cur.execute("""
            SELECT category, COUNT(*) as count
            FROM questions
            WHERE correct_answer IS NULL OR correct_answer = ''
            GROUP BY category
        """)
        
        missing_answers = cur.fetchall()
        if missing_answers:
            print("\n⚠️ Doğru Cevabı Olmayan Sorular:")
            for ma in missing_answers:
                print(f"   {ma['category']}: {ma['count']} soru")
        
        cur.close()
    
    return category_map


def map_categories_to_yds(db_categories):
    """Database kategorilerini YDS dağılımına eşle"""
    mapped = {}
    
    for yds_cat, aliases in CATEGORY_ALIASES.items():
        mapped[yds_cat] = []
        for alias in aliases:
            if alias in db_categories:
                mapped[yds_cat].append(alias)
    
    # Eşlenemeyen kategorileri göster
    all_mapped = set()
    for cats in mapped.values():
        all_mapped.update(cats)
    
    unmapped = set(db_categories.keys()) - all_mapped
    if unmapped:
        print("\n⚠️ Eşlenemeyen Kategoriler:")
        for cat in unmapped:
            print(f"   - {cat}")
    
    return mapped


def create_quiz_preset(size: str, conn) -> dict:
    """
    Belirtilen boyutta quiz preset oluştur
    size: 'mini' (20), 'medium' (40), 'full' (80)
    """
    cur = conn.cursor()
    
    # Boyuta göre soru sayısı
    if size == 'mini':
        total_questions = 20
        multiplier = 0.25
    elif size == 'medium':
        total_questions = 40
        multiplier = 0.5
    else:  # full
        total_questions = 80
        multiplier = 1.0
    
    # YDS dağılımını uygula
    distribution = {}
    for cat, count in YDS_FULL_DISTRIBUTION.items():
        distribution[cat] = max(1, int(count * multiplier))
    
    # Toplam eşleşmezse ayarla
    current_total = sum(distribution.values())
    if current_total != total_questions:
        diff = total_questions - current_total
        # En büyük kategoriye ekle/çıkar
        max_cat = max(distribution, key=distribution.get)
        distribution[max_cat] += diff
    
    questions = []
    actual_distribution = {}
    
    # Her kategori için soruları al
    for yds_cat, needed in distribution.items():
        aliases = CATEGORY_ALIASES.get(yds_cat, [yds_cat])
        
        # Tüm alias'lardan soruları al
        placeholders = ','.join(['%s'] * len(aliases))
        cur.execute(f"""
            SELECT id, question_text, options, correct_answer, category
            FROM questions
            WHERE category IN ({placeholders})
            AND correct_answer IS NOT NULL 
            AND correct_answer != ''
            ORDER BY RANDOM()
            LIMIT %s
        """, aliases + [needed])
        
        cat_questions = cur.fetchall()
        
        if cat_questions:
            questions.extend(cat_questions)
            actual_distribution[yds_cat] = len(cat_questions)
        else:
            actual_distribution[yds_cat] = 0
    
    # Eksik soruları diğer kategorilerden tamamla
    if len(questions) < total_questions:
        needed = total_questions - len(questions)
        existing_ids = [q['id'] for q in questions]
        
        if existing_ids:
            placeholders = ','.join(['%s'] * len(existing_ids))
            cur.execute(f"""
                SELECT id, question_text, options, correct_answer, category
                FROM questions
                WHERE id NOT IN ({placeholders})
                AND correct_answer IS NOT NULL 
                AND correct_answer != ''
                ORDER BY RANDOM()
                LIMIT %s
            """, existing_ids + [needed])
        else:
            cur.execute("""
                SELECT id, question_text, options, correct_answer, category
                FROM questions
                WHERE correct_answer IS NOT NULL 
                AND correct_answer != ''
                ORDER BY RANDOM()
                LIMIT %s
            """, [needed])
        
        extra = cur.fetchall()
        questions.extend(extra)
    
    cur.close()
    
    # Soruları karıştır
    random.shuffle(questions)
    
    return {
        'size': size,
        'total_questions': len(questions),
        'target_questions': total_questions,
        'distribution': actual_distribution,
        'questions': questions
    }


def generate_quiz_presets_json():
    """Quiz presetlerini JSON dosyasına kaydet"""
    print("\n" + "="*60)
    print("🎯 Quiz Presetleri Oluşturuluyor")
    print("="*60)
    
    with get_db_connection(use_dict_cursor=True) as conn:
        presets = {}
        
        for size, name in [('mini', 'Mini Quiz (20)'), ('medium', 'Orta Quiz (40)'), ('full', 'Tam YDS (80)')]:
            print(f"\n📝 {name} oluşturuluyor...")
            preset = create_quiz_preset(size, conn)
            
            print(f"   Hedef: {preset['target_questions']}, Elde edilen: {preset['total_questions']}")
            print("   Dağılım:")
            for cat, count in preset['distribution'].items():
                if count > 0:
                    print(f"      - {cat}: {count}")
            
            presets[size] = {
                'name': name,
                'question_ids': [q['id'] for q in preset['questions']],
                'distribution': preset['distribution']
            }
    
    # JSON dosyasına kaydet
    output_path = 'quiz_presets.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(presets, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Presetler kaydedildi: {output_path}")
    
    return presets


def main():
    print("="*60)
    print("🚀 YDS Quiz Preset Oluşturucu")
    print(f"   Tarih: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # 1. Database analizi
    db_categories = analyze_database()
    
    # 2. Kategori eşleştirme
    print("\n" + "="*60)
    print("🔗 Kategori Eşleştirme")
    print("="*60)
    mapped = map_categories_to_yds(db_categories)
    for yds_cat, db_cats in mapped.items():
        if db_cats:
            print(f"   {yds_cat} ← {', '.join(db_cats)}")
    
    # 3. Quiz presetleri oluştur
    presets = generate_quiz_presets_json()
    
    print("\n" + "="*60)
    print("✅ İŞLEM TAMAMLANDI")
    print("="*60)
    print("\nSonraki adımlar:")
    print("1. quiz_presets.json dosyasını kontrol edin")


if __name__ == "__main__":
    main()
