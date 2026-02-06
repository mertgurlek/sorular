"""
Hibrit Kelime Frekans Analizi

Veritabanındaki soru ve şıklardan kelime frekansı çıkarır.
Çok kelimeli ifadeler (phrasal verbs, collocations, prepositional phrases)
önce tek birim olarak tespit edilir, sonra kalan kelimeler unigram olarak sayılır.

Kullanım:
    python word_frequency_analysis.py
    python word_frequency_analysis.py --category "YDS Gramer"
    python word_frequency_analysis.py --top 200
    python word_frequency_analysis.py --min-freq 5

Çıktı:
    word_frequency_results.json
"""

import argparse
import json
import re
import sys
import time
from collections import Counter
from datetime import datetime

from scripts.db_utils import execute_query
from scripts.english_phrases import get_phrases_by_length, get_stop_words, get_all_phrases


# ============================================================
# METİN TEMİZLEME
# ============================================================

def clean_text(text: str) -> str:
    """Metni temizle: küçük harf, gereksiz karakterleri kaldır"""
    if not text:
        return ""
    text = text.lower()
    # Boşluk bırakıcıları (____) kaldır
    text = re.sub(r'_+', ' ', text)
    # Parantez içindeki şık harflerini kaldır: (A), (B), a), b) vb.
    text = re.sub(r'\(?[a-e]\)', '', text)
    # Sayıları kaldır (soru numaraları vb.)
    text = re.sub(r'\b\d+\b', '', text)
    # Noktalama işaretlerini kaldır ama apostrof koru (don't, it's)
    text = re.sub(r"[^\w\s']", ' ', text)
    # Çoklu boşlukları tekle
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_options_text(options) -> str:
    """Options JSONB'den şık metinlerini çıkar"""
    if not options:
        return ""
    
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except:
            return ""
    
    texts = []
    if isinstance(options, list):
        for opt in options:
            if isinstance(opt, dict):
                # {"label": "A", "text": "..."} formatı
                text = opt.get("text", "") or opt.get("value", "") or ""
                texts.append(text)
            elif isinstance(opt, str):
                texts.append(opt)
    
    return " ".join(texts)


# ============================================================
# HİBRİT FREKANS ANALİZİ
# ============================================================

class HybridFrequencyAnalyzer:
    """
    Hibrit frekans analizci (sliding window — hızlı):
    1. Metni kelime dizisine çevir
    2. Uzundan kısaya sliding window ile çok kelimeli ifadeleri bul
    3. Eşleşen pozisyonları işaretle
    4. İşaretlenmemiş kelimeleri unigram olarak say
    5. Stop words filtrele
    """
    
    def __init__(self):
        self.phrases_by_length = get_phrases_by_length()
        self.stop_words = get_stop_words()
        self.all_phrases = get_all_phrases()
        
        # Uzundan kısaya sıralı kelime sayıları
        self.sorted_lengths = sorted(self.phrases_by_length.keys(), reverse=True)
        self.max_phrase_len = self.sorted_lengths[0] if self.sorted_lengths else 1
        
        # Sayaçlar
        self.phrase_counter = Counter()    # Çok kelimeli ifadeler
        self.word_counter = Counter()      # Tekil kelimeler
        self.combined_counter = Counter()  # Birleşik (hepsi)
        
        # İstatistikler
        self.total_texts = 0
        self.total_phrase_matches = 0
        self.total_word_matches = 0
    
    def analyze_text(self, text: str):
        """Tek bir metni analiz et — sliding window yaklaşımı"""
        cleaned = clean_text(text)
        if not cleaned:
            return
        
        self.total_texts += 1
        words = cleaned.split()
        n = len(words)
        used = [False] * n  # Hangi pozisyonlar çok kelimeli ifadeye ait
        
        # Adım 1: Uzundan kısaya sliding window ile phrase ara
        for length in self.sorted_lengths:
            if length < 2 or length > n:
                continue
            phrases_set = self.phrases_by_length[length]
            for i in range(n - length + 1):
                if any(used[i:i + length]):
                    continue
                candidate = " ".join(words[i:i + length])
                if candidate in phrases_set:
                    self.phrase_counter[candidate] += 1
                    self.combined_counter[candidate] += 1
                    self.total_phrase_matches += 1
                    for j in range(i, i + length):
                        used[j] = True
        
        # Adım 2: Kullanılmamış kelimeleri unigram olarak say
        for i, word in enumerate(words):
            if used[i]:
                continue
            word = word.strip("'")
            if not word or len(word) < 2:
                continue
            if word in self.stop_words:
                continue
            if not word.isalpha():
                continue
            
            self.word_counter[word] += 1
            self.combined_counter[word] += 1
            self.total_word_matches += 1
    
    def get_results(self, top_n: int = 500, min_freq: int = 2) -> dict:
        """Analiz sonuçlarını döndür"""
        
        # Birleşik sıralama
        combined_top = [
            {
                "expression": expr,
                "count": count,
                "type": "phrase" if expr in self.all_phrases else "word",
                "word_count": len(expr.split())
            }
            for expr, count in self.combined_counter.most_common(top_n)
            if count >= min_freq
        ]
        
        # Sadece çok kelimeli ifadeler
        phrases_top = [
            {"expression": expr, "count": count, "word_count": len(expr.split())}
            for expr, count in self.phrase_counter.most_common(200)
            if count >= min_freq
        ]
        
        # Sadece tekil kelimeler
        words_top = [
            {"expression": expr, "count": count}
            for expr, count in self.word_counter.most_common(300)
            if count >= min_freq
        ]
        
        return {
            "combined": combined_top,
            "phrases_only": phrases_top,
            "words_only": words_top,
            "stats": {
                "total_texts_analyzed": self.total_texts,
                "total_phrase_matches": self.total_phrase_matches,
                "total_word_matches": self.total_word_matches,
                "unique_phrases_found": len(self.phrase_counter),
                "unique_words_found": len(self.word_counter),
                "unique_combined": len(self.combined_counter),
                "phrase_dictionary_size": len(self.all_phrases),
            }
        }


# ============================================================
# VERİTABANI SORGULAMA
# ============================================================

def fetch_questions(category: str = None) -> list:
    """Veritabanından soruları çek"""
    if category:
        sql = """
            SELECT question_text, options, correct_answer, category,
                   question_tr, explanation_tr, tip
            FROM questions
            WHERE category = %s
        """
        return execute_query(sql, (category,), fetch_all=True, use_dict_cursor=True)
    else:
        sql = """
            SELECT question_text, options, correct_answer, category,
                   question_tr, explanation_tr, tip
            FROM questions
        """
        return execute_query(sql, fetch_all=True, use_dict_cursor=True)


def fetch_categories() -> list:
    """Kategorileri getir"""
    sql = """
        SELECT DISTINCT category, COUNT(*) as count
        FROM questions
        GROUP BY category
        ORDER BY count DESC
    """
    return execute_query(sql, fetch_all=True, use_dict_cursor=True)


# ============================================================
# ANA FONKSİYON
# ============================================================

def run_analysis(category: str = None, top_n: int = 500, min_freq: int = 2):
    """Ana analiz fonksiyonu"""
    
    print("=" * 70)
    print("📊 Hibrit Kelime Frekans Analizi")
    print("   Phrasal verbs + Collocations + Unigrams")
    print("=" * 70)
    
    # Kategorileri göster
    categories = fetch_categories()
    print(f"\n📋 Veritabanında {len(categories)} kategori:")
    for cat in categories:
        marker = " 👈" if category and cat['category'] == category else ""
        print(f"   - {cat['category']}: {cat['count']} soru{marker}")
    
    # Soruları çek
    print(f"\n📥 Sorular yükleniyor...")
    start = time.time()
    questions = fetch_questions(category)
    print(f"   {len(questions)} soru yüklendi ({time.time() - start:.1f}sn)")
    
    if not questions:
        print("❌ Soru bulunamadı!")
        return
    
    # Analiz başlat
    analyzer = HybridFrequencyAnalyzer()
    
    print(f"\n🔍 Analiz ediliyor...")
    start = time.time()
    
    for i, q in enumerate(questions):
        # Soru metnini analiz et
        analyzer.analyze_text(q.get('question_text', ''))
        
        # Şıkları analiz et
        options_text = extract_options_text(q.get('options'))
        analyzer.analyze_text(options_text)
        
        # Türkçe çeviri ve açıklamayı ATLA (İngilizce frekans isteniyor)
        # Ama tip alanı İngilizce olabilir
        tip = q.get('tip', '')
        if tip and not any(c in tip for c in 'çşğüöıÇŞĞÜÖİ'):
            analyzer.analyze_text(tip)
        
        if (i + 1) % 1000 == 0:
            print(f"   İlerleme: {i + 1}/{len(questions)}")
    
    elapsed = time.time() - start
    print(f"   ✅ Analiz tamamlandı ({elapsed:.1f}sn)")
    
    # Sonuçları al
    results = analyzer.get_results(top_n=top_n, min_freq=min_freq)
    
    # Konsola özet yazdır
    print(f"\n{'=' * 70}")
    print("📊 SONUÇLAR")
    print(f"{'=' * 70}")
    
    stats = results['stats']
    print(f"\n📈 İstatistikler:")
    print(f"   Analiz edilen metin sayısı: {stats['total_texts_analyzed']}")
    print(f"   Bulunan çok kelimeli ifade eşleşmesi: {stats['total_phrase_matches']}")
    print(f"   Bulunan tekil kelime: {stats['total_word_matches']}")
    print(f"   Benzersiz ifade: {stats['unique_phrases_found']}")
    print(f"   Benzersiz kelime: {stats['unique_words_found']}")
    print(f"   Sözlük boyutu: {stats['phrase_dictionary_size']} ifade")
    
    # Top 50 birleşik
    print(f"\n🏆 En Sık Geçen 50 İfade (birleşik):")
    print(f"   {'#':<4} {'İfade':<35} {'Sayı':<8} {'Tür':<10}")
    print(f"   {'-'*60}")
    for i, item in enumerate(results['combined'][:50], 1):
        type_label = "📌 ifade" if item['type'] == 'phrase' else "📝 kelime"
        print(f"   {i:<4} {item['expression']:<35} {item['count']:<8} {type_label}")
    
    # Top 30 çok kelimeli
    print(f"\n🔗 En Sık Geçen 30 Çok Kelimeli İfade:")
    print(f"   {'#':<4} {'İfade':<40} {'Sayı':<8}")
    print(f"   {'-'*55}")
    for i, item in enumerate(results['phrases_only'][:30], 1):
        print(f"   {i:<4} {item['expression']:<40} {item['count']:<8}")
    
    # Kategori bazlı analiz
    if not category:
        print(f"\n📂 Kategori Bazlı Analiz başlatılıyor...")
        category_results = {}
        
        for cat in categories:
            cat_name = cat['category']
            cat_questions = [q for q in questions if q.get('category') == cat_name]
            
            cat_analyzer = HybridFrequencyAnalyzer()
            for q in cat_questions:
                cat_analyzer.analyze_text(q.get('question_text', ''))
                options_text = extract_options_text(q.get('options'))
                cat_analyzer.analyze_text(options_text)
            
            cat_results = cat_analyzer.get_results(top_n=50, min_freq=2)
            category_results[cat_name] = {
                "question_count": len(cat_questions),
                "top_expressions": cat_results['combined'][:30],
                "top_phrases": cat_results['phrases_only'][:15],
                "stats": cat_results['stats']
            }
        
        results['by_category'] = category_results
        print(f"   ✅ {len(categories)} kategori analiz edildi")
    
    # JSON'a kaydet
    output = {
        "generated_at": datetime.now().isoformat(),
        "parameters": {
            "category": category or "ALL",
            "top_n": top_n,
            "min_freq": min_freq,
            "total_questions": len(questions)
        },
        **results
    }
    
    output_file = "word_frequency_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Sonuçlar kaydedildi: {output_file}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hibrit Kelime Frekans Analizi")
    parser.add_argument("--category", type=str, default=None, help="Belirli bir kategori filtresi")
    parser.add_argument("--top", type=int, default=500, help="En çok kaç ifade gösterilsin (varsayılan: 500)")
    parser.add_argument("--min-freq", type=int, default=2, help="Minimum frekans eşiği (varsayılan: 2)")
    
    args = parser.parse_args()
    run_analysis(category=args.category, top_n=args.top, min_freq=args.min_freq)
