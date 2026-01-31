"""Tüm JSON dosyalarında cevapsız soruları bul ve cevapla"""
import json
import glob
import asyncio
from openai import AsyncOpenAI
from dotenv import load_dotenv
import os

load_dotenv()
client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def find_unanswered():
    """Cevapsız soruları bul"""
    unanswered = []
    
    for filepath in glob.glob('**/*.json', recursive=True):
        if '_summary' in filepath:
            continue
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Liste mi dict mi?
            if isinstance(data, list):
                questions = data
            elif isinstance(data, dict) and 'questions' in data:
                questions = data['questions']
            else:
                continue
            
            for i, q in enumerate(questions):
                if q.get('question_text') and q.get('options') and not q.get('correct_answer'):
                    unanswered.append({
                        'filepath': filepath,
                        'index': i,
                        'question': q
                    })
        except Exception as e:
            print(f"Hata ({filepath}): {e}")
    
    return unanswered


async def get_answer(q):
    """GPT ile cevap al"""
    opts = '\n'.join([f"{o['letter']}) {o['text']}" for o in q['options']])
    prompt = f"""YDS sorusu. Sadece doğru cevabın harfini yaz (A-E).

Soru: {q['question_text']}

{opts}

Cevap:"""
    try:
        r = await client.chat.completions.create(
            model='gpt-4.1-nano',
            messages=[{'role':'user','content':prompt}],
            max_tokens=5, temperature=0
        )
        ans = r.choices[0].message.content.strip().upper()
        return ans[0] if ans and ans[0] in 'ABCDE' else None
    except Exception as e:
        print(f"GPT hatası: {e}")
        return None


async def answer_all():
    """Tüm cevapsız soruları cevapla"""
    unanswered = find_unanswered()
    
    if not unanswered:
        print("Cevapsız soru yok!")
        return
    
    print(f"Toplam {len(unanswered)} cevapsız soru bulundu")
    
    # Dosyaları grupla
    files_data = {}
    for item in unanswered:
        fp = item['filepath']
        if fp not in files_data:
            with open(fp, 'r', encoding='utf-8') as f:
                files_data[fp] = json.load(f)
    
    # Cevapla
    semaphore = asyncio.Semaphore(50)
    
    async def answer_one(item):
        async with semaphore:
            ans = await get_answer(item['question'])
            if ans:
                # Güncelle
                data = files_data[item['filepath']]
                if isinstance(data, list):
                    data[item['index']]['correct_answer'] = ans
                else:
                    data['questions'][item['index']]['correct_answer'] = ans
                print(f"  {item['filepath']}[{item['index']}]: {ans}")
                return True
            return False
    
    tasks = [answer_one(item) for item in unanswered]
    results = await asyncio.gather(*tasks)
    
    success = sum(1 for r in results if r)
    print(f"\n{success}/{len(unanswered)} soru cevaplandı")
    
    # Kaydet
    for fp, data in files_data.items():
        with open(fp, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Kaydedildi!")


if __name__ == "__main__":
    # Önce sadece say
    unanswered = find_unanswered()
    print(f"Cevapsız soru sayısı: {len(unanswered)}")
    
    if unanswered:
        # Dosya bazında göster
        from collections import Counter
        by_file = Counter(u['filepath'] for u in unanswered)
        for f, c in by_file.most_common():
            print(f"  {c}: {f}")
        
        print("\nCevaplıyor...")
        asyncio.run(answer_all())
