"""
Rastgele 100 soru ile kalite testi
"""

import json

from scripts.db_utils import get_db_connection

with get_db_connection(use_dict_cursor=True) as conn:
    cur = conn.cursor()
    cur.execute("""
        SELECT id, question_text, options, correct_answer, category,
               question_tr, explanation_tr, tested_skill, difficulty, tip,
               gpt_status, is_valid
        FROM questions 
        WHERE gpt_verified_at IS NOT NULL
        ORDER BY RANDOM() 
        LIMIT 100
    """)
    questions = cur.fetchall()
    cur.close()

print("="*80)
print("🔍 KALİTE TESTİ - Rastgele 100 Soru")
print("="*80)

# İstatistikler
stats = {
    "total": len(questions),
    "with_translation": 0,
    "with_explanation": 0,
    "with_skill": 0,
    "with_difficulty": 0,
    "with_tip": 0,
    "valid": 0,
    "corrected": 0,
    "regenerated": 0,
    "difficulty_dist": {"easy": 0, "medium": 0, "hard": 0},
    "categories": {},
    "issues": []
}

print("\n📋 ÖRNEK SORULAR (İlk 5):\n")

for i, q in enumerate(questions):
    # İstatistik topla
    if q.get("question_tr"): stats["with_translation"] += 1
    if q.get("explanation_tr"): stats["with_explanation"] += 1
    if q.get("tested_skill"): stats["with_skill"] += 1
    if q.get("difficulty"): 
        stats["with_difficulty"] += 1
        diff = q["difficulty"].lower()
        if diff in stats["difficulty_dist"]:
            stats["difficulty_dist"][diff] += 1
    if q.get("tip"): stats["with_tip"] += 1
    if q.get("is_valid"): stats["valid"] += 1
    if q.get("gpt_status") == "corrected": stats["corrected"] += 1
    if q.get("gpt_status") == "regenerated": stats["regenerated"] += 1
    
    cat = q.get("category", "Unknown")
    stats["categories"][cat] = stats["categories"].get(cat, 0) + 1
    
    # Sorun kontrolü
    issues = []
    if not q.get("question_tr"):
        issues.append("Türkçe çeviri yok")
    if not q.get("explanation_tr"):
        issues.append("Açıklama yok")
    if not q.get("correct_answer"):
        issues.append("Doğru cevap yok")
    if not q.get("difficulty"):
        issues.append("Zorluk yok")
    
    if issues:
        stats["issues"].append({
            "id": q["id"],
            "category": cat,
            "issues": issues
        })
    
    # İlk 5 soruyu detaylı göster
    if i < 5:
        print(f"{'─'*80}")
        print(f"📌 Soru #{i+1} (ID: {q['id']}) - {q.get('category', 'N/A')}")
        print(f"{'─'*80}")
        
        # Soru metni (kısaltılmış)
        q_text = q.get("question_text", "")[:200]
        if len(q.get("question_text", "")) > 200:
            q_text += "..."
        print(f"\n📝 Soru: {q_text}")
        
        # Şıklar
        options = q.get("options", [])
        if isinstance(options, str):
            options = json.loads(options)
        print(f"\n🔤 Şıklar:")
        for opt in options[:3]:  # İlk 3 şık
            letter = opt.get("letter", "?")
            text = opt.get("text", "")[:50]
            print(f"   {letter}) {text}...")
        if len(options) > 3:
            print(f"   ... (+{len(options)-3} şık daha)")
        
        print(f"\n✅ Doğru Cevap: {q.get('correct_answer', 'N/A')}")
        print(f"📊 Zorluk: {q.get('difficulty', 'N/A')}")
        print(f"🎯 Sınanan Beceri: {q.get('tested_skill', 'N/A')}")
        
        # Türkçe çeviri (kısaltılmış)
        tr = q.get("question_tr", "")
        if tr:
            tr_short = tr[:150] + "..." if len(tr) > 150 else tr
            print(f"\n🇹🇷 Türkçe: {tr_short}")
        
        # Açıklama (kısaltılmış)
        exp = q.get("explanation_tr", "")
        if exp:
            exp_short = exp[:200] + "..." if len(exp) > 200 else exp
            print(f"\n💡 Açıklama: {exp_short}")
        
        # İpucu
        tip = q.get("tip", "")
        if tip:
            print(f"\n💭 İpucu: {tip[:100]}...")
        
        print(f"\n📋 GPT Status: {q.get('gpt_status', 'N/A')}")
        print()

# Özet istatistikler
print("\n" + "="*80)
print("📊 İSTATİSTİKLER")
print("="*80)

print(f"\n📌 Toplam test edilen: {stats['total']} soru")
print(f"\n✅ Veri Tamamlığı:")
print(f"   - Türkçe çeviri: {stats['with_translation']}/100 ({stats['with_translation']}%)")
print(f"   - Açıklama: {stats['with_explanation']}/100 ({stats['with_explanation']}%)")
print(f"   - Sınanan beceri: {stats['with_skill']}/100 ({stats['with_skill']}%)")
print(f"   - Zorluk seviyesi: {stats['with_difficulty']}/100 ({stats['with_difficulty']}%)")
print(f"   - İpucu: {stats['with_tip']}/100 ({stats['with_tip']}%)")

print(f"\n📈 GPT İşlem Durumu:")
print(f"   - Geçerli (valid): {stats['valid']}")
print(f"   - Düzeltilen: {stats['corrected']}")
print(f"   - Yeniden oluşturulan: {stats['regenerated']}")

print(f"\n📊 Zorluk Dağılımı:")
for diff, count in stats["difficulty_dist"].items():
    bar = "█" * (count // 2)
    print(f"   - {diff.capitalize()}: {count} {bar}")

print(f"\n📚 Kategori Dağılımı:")
for cat, count in sorted(stats["categories"].items(), key=lambda x: -x[1]):
    print(f"   - {cat}: {count}")

if stats["issues"]:
    print(f"\n⚠️ SORUNLU SORULAR ({len(stats['issues'])} adet):")
    for issue in stats["issues"][:10]:
        print(f"   - ID {issue['id']} ({issue['category']}): {', '.join(issue['issues'])}")
    if len(stats["issues"]) > 10:
        print(f"   ... ve {len(stats['issues'])-10} soru daha")
else:
    print(f"\n✅ Tüm sorular eksiksiz!")

print("\n" + "="*80)
print("✅ Kalite testi tamamlandı!")
print("="*80)
