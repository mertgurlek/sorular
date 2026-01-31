import json
import os
from collections import Counter

def analyze_quality(gpt_dir: str = "yds_questions_gpt"):
    """GPT ile işlenmiş soruların kalite analizini yap"""
    
    results = {
        "total_questions": 0,
        "processed_success": 0,
        "has_answer": 0,
        "has_explanation": 0,
        "has_correction": 0,
        "answer_distribution": Counter(),
        "categories": {},
        "sample_corrections": [],
        "issues": []
    }
    
    for filename in os.listdir(gpt_dir):
        if not filename.startswith("gpt_") or not filename.endswith(".json"):
            continue
        
        filepath = os.path.join(gpt_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        category = data.get("category", filename)
        questions = data.get("questions", [])
        
        cat_stats = {
            "total": len(questions),
            "processed": 0,
            "has_answer": 0,
            "has_explanation": 0,
            "text_corrected": 0,
            "answer_dist": Counter(),
            "issues": []
        }
        
        for i, q in enumerate(questions):
            results["total_questions"] += 1
            
            # İşlem başarılı mı?
            if q.get("processed"):
                results["processed_success"] += 1
                cat_stats["processed"] += 1
            
            # Cevap var mı?
            answer = q.get("gpt_answer")
            if answer:
                results["has_answer"] += 1
                cat_stats["has_answer"] += 1
                results["answer_distribution"][answer] += 1
                cat_stats["answer_dist"][answer] += 1
                
                # Geçerli cevap mı?
                if answer not in ["A", "B", "C", "D", "E"]:
                    issue = f"{category} - Soru {i+1}: Geçersiz cevap '{answer}'"
                    results["issues"].append(issue)
                    cat_stats["issues"].append(issue)
            else:
                issue = f"{category} - Soru {i+1}: Cevap yok"
                results["issues"].append(issue)
                cat_stats["issues"].append(issue)
            
            # Açıklama var mı?
            explanation = q.get("explanation", "")
            if explanation and len(explanation) > 5:
                results["has_explanation"] += 1
                cat_stats["has_explanation"] += 1
            
            # Metin düzeltilmiş mi?
            original = q.get("question_text", "")
            corrected = q.get("corrected_question", "")
            if corrected and original != corrected:
                results["has_correction"] += 1
                cat_stats["text_corrected"] += 1
                
                # İlk 3 düzeltme örneğini kaydet
                if len(results["sample_corrections"]) < 10:
                    results["sample_corrections"].append({
                        "category": category,
                        "original": original[:200] + "..." if len(original) > 200 else original,
                        "corrected": corrected[:200] + "..." if len(corrected) > 200 else corrected
                    })
        
        results["categories"][category] = cat_stats
    
    return results


def print_report(results: dict):
    """Kalite raporunu yazdır"""
    
    print("=" * 70)
    print("YDS SORULARI KALİTE RAPORU")
    print("=" * 70)
    
    total = results["total_questions"]
    
    print(f"\n## GENEL İSTATİSTİKLER")
    print(f"  Toplam soru: {total}")
    print(f"  İşlem başarılı: {results['processed_success']} ({results['processed_success']/total*100:.1f}%)")
    print(f"  Cevabı olan: {results['has_answer']} ({results['has_answer']/total*100:.1f}%)")
    print(f"  Açıklaması olan: {results['has_explanation']} ({results['has_explanation']/total*100:.1f}%)")
    print(f"  Metin düzeltilen: {results['has_correction']} ({results['has_correction']/total*100:.1f}%)")
    
    print(f"\n## CEVAP DAĞILIMI")
    for letter in ["A", "B", "C", "D", "E"]:
        count = results["answer_distribution"].get(letter, 0)
        pct = count / results["has_answer"] * 100 if results["has_answer"] > 0 else 0
        bar = "█" * int(pct / 2)
        print(f"  {letter}: {count:4d} ({pct:5.1f}%) {bar}")
    
    print(f"\n## KATEGORİ BAZLI ANALİZ")
    print("-" * 70)
    print(f"{'Kategori':<35} {'Toplam':>8} {'Cevap':>8} {'Açıklama':>8} {'Düzelt':>8}")
    print("-" * 70)
    
    for cat, stats in results["categories"].items():
        total_cat = stats["total"]
        ans = stats["has_answer"]
        exp = stats["has_explanation"]
        corr = stats["text_corrected"]
        print(f"{cat:<35} {total_cat:>8} {ans:>8} {exp:>8} {corr:>8}")
    
    print("-" * 70)
    
    if results["sample_corrections"]:
        print(f"\n## METİN DÜZELTMELERİ ÖRNEKLERİ (ilk 10)")
        print("-" * 70)
        for i, corr in enumerate(results["sample_corrections"][:10], 1):
            print(f"\n{i}. {corr['category']}")
            print(f"   ÖNCEKİ: {corr['original'][:100]}...")
            print(f"   SONRA:  {corr['corrected'][:100]}...")
    
    if results["issues"]:
        print(f"\n## SORUNLAR ({len(results['issues'])} adet)")
        print("-" * 70)
        for issue in results["issues"][:20]:
            print(f"  ⚠ {issue}")
        if len(results["issues"]) > 20:
            print(f"  ... ve {len(results['issues']) - 20} sorun daha")
    else:
        print(f"\n✓ Hiçbir sorun bulunamadı!")
    
    print("\n" + "=" * 70)


if __name__ == "__main__":
    results = analyze_quality()
    print_report(results)
    
    # JSON olarak da kaydet
    with open("yds_questions_gpt/quality_report.json", "w", encoding="utf-8") as f:
        # Counter'ları dict'e çevir
        results["answer_distribution"] = dict(results["answer_distribution"])
        for cat in results["categories"]:
            results["categories"][cat]["answer_dist"] = dict(results["categories"][cat]["answer_dist"])
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("\n✓ Rapor kaydedildi: yds_questions_gpt/quality_report.json")
