import json
import os
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

CONCURRENT_LIMIT = 10  # Aynı anda max 10 GPT çağrısı


async def get_answer_from_gpt(question: dict, semaphore: asyncio.Semaphore) -> str:
    """GPT ile doğru cevabı al"""
    question_text = question.get("question_text", "")
    options = question.get("options", [])
    
    if not question_text or not options:
        return None
    
    options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
    
    prompt = f"""Bu bir YDS İngilizce sınav sorusudur. Doğru cevabın sadece harfini (A, B, C, D veya E) yaz.

Soru: {question_text}

Şıklar:
{options_text}

Doğru cevap:"""

    async with semaphore:
        try:
            response = await client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {"role": "system", "content": "Sen bir YDS İngilizce uzmanısın. Sadece doğru cevabın harfini yaz."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=5,
                temperature=0
            )
            answer = response.choices[0].message.content.strip().upper()
            if answer and answer[0] in "ABCDE":
                return answer[0]
            return None
        except Exception as e:
            print(f"GPT hatası: {e}")
            return None


async def process_file(filepath: str):
    """Bir dosyadaki tüm sorular için cevapları al"""
    print(f"\nİşleniyor: {filepath}")
    
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    questions = data.get("questions", [])
    total = len(questions)
    
    # Sadece cevabı olmayan soruları işle
    questions_to_process = [
        (i, q) for i, q in enumerate(questions) 
        if q.get("question_text") and not q.get("correct_answer")
    ]
    
    if not questions_to_process:
        print(f"  Tüm sorular zaten cevaplı veya soru yok")
        return
    
    print(f"  {len(questions_to_process)}/{total} soru için cevap alınacak")
    
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    
    # Progress tracking
    done = [0]
    
    async def process_single(idx: int, question: dict):
        answer = await get_answer_from_gpt(question, semaphore)
        questions[idx]["correct_answer"] = answer
        done[0] += 1
        if done[0] % 50 == 0:
            print(f"  İlerleme: {done[0]}/{len(questions_to_process)}")
    
    tasks = [process_single(idx, q) for idx, q in questions_to_process]
    await asyncio.gather(*tasks)
    
    # Dosyayı güncelle
    data["questions"] = questions
    data["with_answer_count"] = len([q for q in questions if q.get("correct_answer")])
    data["answers_added_at"] = datetime.now().isoformat()
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"  ✓ {data['with_answer_count']}/{total} soru cevaplı")


async def main():
    import sys
    
    questions_dir = "yds_questions"
    
    # Belirli dosya veya tüm dosyalar
    if len(sys.argv) >= 2:
        files = [os.path.join(questions_dir, sys.argv[1])]
    else:
        files = [
            os.path.join(questions_dir, f) 
            for f in os.listdir(questions_dir) 
            if f.endswith(".json") and not f.startswith("_")
        ]
    
    print(f"GPT ile cevaplar alınıyor...")
    print(f"Toplam {len(files)} dosya işlenecek")
    print(f"Paralel GPT çağrısı: {CONCURRENT_LIMIT}")
    print("="*60)
    
    start_time = datetime.now()
    
    for filepath in sorted(files):
        await process_file(filepath)
    
    elapsed = (datetime.now() - start_time).total_seconds()
    print(f"\n{'='*60}")
    print(f"TAMAMLANDI! Süre: {elapsed:.1f} saniye")
    
    # Özet güncelle
    summary_file = os.path.join(questions_dir, "_summary.json")
    if os.path.exists(summary_file):
        with open(summary_file, "r", encoding="utf-8") as f:
            summary = json.load(f)
        
        total_with_answer = 0
        for cat, info in summary.get("categories", {}).items():
            cat_file = os.path.join(questions_dir, info["file"])
            if os.path.exists(cat_file):
                with open(cat_file, "r", encoding="utf-8") as f:
                    cat_data = json.load(f)
                info["with_answer"] = cat_data.get("with_answer_count", 0)
                total_with_answer += info["with_answer"]
        
        summary["total_with_answer"] = total_with_answer
        summary["answers_added_at"] = datetime.now().isoformat()
        
        with open(summary_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        print(f"\nToplam cevaplı soru: {total_with_answer}")


if __name__ == "__main__":
    asyncio.run(main())
