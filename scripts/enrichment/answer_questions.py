"""questions.json dosyasındaki soruları GPT ile cevapla"""
import json
import asyncio

from scripts.openai_utils import get_openai_client

client = get_openai_client()

async def get_answer(q):
    opts = '\n'.join([f"{o['letter']}) {o['text']}" for o in q['options']])
    prompt = f"""YDS sorusu. Sadece doğru cevabın harfini yaz (A-E).

Soru: {q['question_text']}

{opts}

Cevap:"""
    r = await client.chat.completions.create(
        model='gpt-4.1-nano',
        messages=[{'role':'user','content':prompt}],
        max_tokens=5, temperature=0
    )
    return r.choices[0].message.content.strip().upper()[0]

async def main():
    with open('questions.json', 'r', encoding='utf-8') as f:
        qs = json.load(f)
    
    print(f"Toplam {len(qs)} soru")
    
    for i, q in enumerate(qs):
        if not q.get('correct_answer'):
            ans = await get_answer(q)
            q['correct_answer'] = ans
            print(f"{i+1}. Cevap: {ans}")
    
    with open('questions.json', 'w', encoding='utf-8') as f:
        json.dump(qs, f, indent=2, ensure_ascii=False)
    print('Kaydedildi!')

if __name__ == "__main__":
    asyncio.run(main())
