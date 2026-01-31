import asyncio
import json
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Yeni kategorilerdeki dosyalar (yds_ prefix ile başlayanlar)
CATEGORY_FILES = [
    "yds_ilgisiz_cümleyi_bulma.json",
    "yds_çeviri_soruları.json",
    "yds_cümle_tamamlama.json",
    "yds_diyalog.json",
    "yds_durum.json",
    "yds_eş_anlam.json",
    "yds_paragraf_doldurma.json",
    "yds_phrasal_verbs_prepositions.json",
    "yds_kelime_soruları.json",
    "yds_okuma_soruları.json",
]

QUESTIONS_PER_CATEGORY = 300
BATCH_SIZE = 10  # Her batch'te kaç soru işlenecek
CONCURRENT_LIMIT = 5  # Aynı anda kaç API çağrısı


async def process_question_with_gpt(question: dict, semaphore: asyncio.Semaphore) -> dict:
    """Tek bir soruyu GPT ile işle - cevap bul ve hataları düzelt"""
    
    async with semaphore:
        try:
            # Soru metni ve şıkları hazırla
            q_text = question.get("question_text", "")
            options = question.get("options", [])
            
            if not q_text or not options:
                return question
            
            options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
            
            prompt = f"""Bu bir YDS (Yabancı Dil Sınavı) sorusudur. Lütfen:
1. Soruyu ve şıkları incele
2. Eğer yazım/imla hatası varsa düzelt (sadece küçük hatalar - büyük/küçük harf, noktalama, typo)
3. Doğru cevabı belirle

Soru:
{q_text}

Şıklar:
{options_text}

Yanıtını şu JSON formatında ver:
{{
    "corrected_question": "düzeltilmiş soru metni (değişiklik yoksa aynısı)",
    "corrected_options": [
        {{"letter": "A", "text": "düzeltilmiş şık metni"}},
        ...
    ],
    "correct_answer": "A/B/C/D/E",
    "explanation": "kısa açıklama (1-2 cümle)"
}}

Sadece JSON döndür, başka bir şey yazma."""

            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "Sen bir İngilizce dil uzmanısın. YDS sorularını analiz edip doğru cevabı buluyorsun. Yanıtlarını sadece JSON formatında ver."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=1500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # JSON parse et
            if result_text.startswith("```"):
                result_text = result_text.split("```")[1]
                if result_text.startswith("json"):
                    result_text = result_text[4:]
            result_text = result_text.strip()
            
            result = json.loads(result_text)
            
            # Sonuçları soruya ekle
            question["corrected_question"] = result.get("corrected_question", q_text)
            question["corrected_options"] = result.get("corrected_options", options)
            question["gpt_answer"] = result.get("correct_answer")
            question["explanation"] = result.get("explanation", "")
            question["processed"] = True
            
        except json.JSONDecodeError as e:
            question["error"] = f"JSON parse error: {str(e)}"
            question["processed"] = False
        except Exception as e:
            question["error"] = str(e)
            question["processed"] = False
        
        return question


async def process_category(category_file: str, questions_dir: str, output_dir: str, limit: int = QUESTIONS_PER_CATEGORY):
    """Bir kategorideki soruları işle"""
    
    filepath = os.path.join(questions_dir, category_file)
    
    if not os.path.exists(filepath):
        print(f"  ❌ Dosya bulunamadı: {category_file}")
        return None
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    category_name = data.get("category", category_file)
    questions = data.get("questions", [])
    
    # Sadece geçerli soruları al (question_text olan)
    valid_questions = [q for q in questions if q.get("question_text")]
    
    # Limit uygula
    questions_to_process = valid_questions[:limit]
    
    print(f"\n{'='*60}")
    print(f"Kategori: {category_name}")
    print(f"Toplam soru: {len(valid_questions)}, İşlenecek: {len(questions_to_process)}")
    
    if not questions_to_process:
        return None
    
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    start_time = datetime.now()
    
    # Progress tracking
    processed = {"count": 0, "total": len(questions_to_process)}
    
    async def process_with_progress(q):
        result = await process_question_with_gpt(q, semaphore)
        processed["count"] += 1
        if processed["count"] % 10 == 0 or processed["count"] == processed["total"]:
            pct = (processed["count"] / processed["total"]) * 100
            print(f"\r  İlerleme: {processed['count']}/{processed['total']} ({pct:.1f}%)", end="", flush=True)
        return result
    
    # Tüm soruları paralel işle
    tasks = [process_with_progress(q) for q in questions_to_process]
    processed_questions = await asyncio.gather(*tasks)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    success_count = len([q for q in processed_questions if q.get("processed")])
    
    print(f"\n  Tamamlandı: {success_count}/{len(processed_questions)} ({elapsed:.1f}sn)")
    
    # Sonuçları kaydet
    output_data = {
        "category": category_name,
        "original_file": category_file,
        "processed_at": datetime.now().isoformat(),
        "total_processed": len(processed_questions),
        "success_count": success_count,
        "questions": processed_questions
    }
    
    output_filename = f"gpt_{category_file}"
    output_path = os.path.join(output_dir, output_filename)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"  ✓ Kaydedildi: {output_filename}")
    
    return output_data


async def main():
    questions_dir = "yds_questions"
    output_dir = "yds_questions_gpt"
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("="*60)
    print("GPT Answer Generator")
    print(f"Her kategoriden {QUESTIONS_PER_CATEGORY} soru işlenecek")
    print(f"Paralel limit: {CONCURRENT_LIMIT}")
    print("="*60)
    
    start_time = datetime.now()
    all_results = []
    
    for category_file in CATEGORY_FILES:
        result = await process_category(category_file, questions_dir, output_dir)
        if result:
            all_results.append(result)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    
    # Özet
    total_processed = sum(r["total_processed"] for r in all_results)
    total_success = sum(r["success_count"] for r in all_results)
    
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI!")
    print(f"Süre: {elapsed:.1f} saniye ({elapsed/60:.1f} dakika)")
    print(f"Toplam: {total_success}/{total_processed} soru başarıyla işlendi")
    print(f"Çıktı klasörü: {output_dir}/")
    
    # Özet dosyası
    summary = {
        "processed_at": datetime.now().isoformat(),
        "total_processed": total_processed,
        "total_success": total_success,
        "elapsed_seconds": elapsed,
        "categories": [
            {
                "name": r["category"],
                "file": f"gpt_{r['original_file']}",
                "processed": r["total_processed"],
                "success": r["success_count"]
            }
            for r in all_results
        ]
    }
    
    summary_path = os.path.join(output_dir, "_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"✓ Özet: {summary_path}")


if __name__ == "__main__":
    asyncio.run(main())
