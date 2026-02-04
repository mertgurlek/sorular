"""
OpenAI Utilities
GPT-4 client ve soru zenginleştirme yönetimi
"""

import asyncio
import json
from typing import Dict, Optional, List
from openai import AsyncOpenAI
from datetime import datetime

from .config import get_openai_key
from .constants import CATEGORY_PROMPTS


class OpenAIManager:
    """Singleton OpenAI client manager"""
    _instance = None
    _client: Optional[AsyncOpenAI] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            self._client = AsyncOpenAI(api_key=get_openai_key())
    
    @property
    def client(self) -> AsyncOpenAI:
        """Get OpenAI client instance"""
        return self._client


# Global OpenAI manager instance
openai_manager = OpenAIManager()


def get_openai_client() -> AsyncOpenAI:
    """Get OpenAI async client"""
    return openai_manager.client


def get_category_system_prompt(category: str, task_type: str = "enrich") -> str:
    """
    Get system prompt for a specific category
    
    Args:
        category: Question category
        task_type: 'enrich' or 'validate'
    """
    skill = CATEGORY_PROMPTS.get(category, "İngilizce dil bilgisini")
    
    if task_type == "validate":
        return f"""Sen YDS/YÖKDİL sınav uzmanısın. Bu soru {skill} sınamaktadır.

Görevin:
1. Soruyu ve şıkları dikkatlice incele
2. Yazım/imla hatası varsa düzelt
3. Soru tamamen hatalı veya çözülemez ise, AYNI KONUYU sınayan yeni bir soru oluştur
4. Doğru cevabı belirle ve açıkla

MUTLAKA aşağıdaki JSON formatında yanıt ver:
{{
    "status": "valid" | "corrected" | "regenerated",
    "is_valid": true | false,
    "question_text": "düzeltilmiş veya yeni soru metni",
    "options": [
        {{"letter": "A", "text": "şık metni"}},
        {{"letter": "B", "text": "şık metni"}},
        {{"letter": "C", "text": "şık metni"}},
        {{"letter": "D", "text": "şık metni"}},
        {{"letter": "E", "text": "şık metni"}}
    ],
    "correct_answer": "A/B/C/D/E",
    "question_tr": "soru metninin Türkçe çevirisi",
    "explanation_tr": "Türkçe detaylı açıklama (neden bu cevap doğru, diğerleri neden yanlış)",
    "tested_skill": "sınanan spesifik dilbilgisi konusu",
    "difficulty": "easy" | "medium" | "hard",
    "tip": "YDS/YÖKDİL için çözüm ipucu (Türkçe)"
}}

Sadece JSON döndür, başka bir şey yazma."""
    
    else:  # enrich
        return f"""Sen YDS/YÖKDİL sınav uzmanısın. Bu soru {skill} sınamaktadır.

Görevin:
1. Soruyu ve şıkları dikkatlice incele
2. DOĞRU CEVABI BUL ve açıkla
3. Soru metnini Türkçeye çevir
4. Detaylı Türkçe açıklama yaz

MUTLAKA aşağıdaki JSON formatında yanıt ver:
{{
    "correct_answer": "A/B/C/D/E",
    "question_tr": "soru metninin Türkçe çevirisi",
    "explanation_tr": "Türkçe detaylı açıklama (neden bu cevap doğru, diğerleri neden yanlış)",
    "tested_skill": "sınanan spesifik beceri",
    "difficulty": "easy" | "medium" | "hard",
    "tip": "YDS/YÖKDİL için çözüm ipucu (Türkçe)"
}}

Sadece JSON döndür, başka bir şey yazma."""


def parse_gpt_response(response_text: str) -> Dict:
    """
    Parse GPT response and extract JSON
    
    Args:
        response_text: Raw GPT response
    
    Returns:
        Parsed JSON dictionary
    """
    text = response_text.strip()
    
    # Remove markdown code blocks
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    text = text.strip()
    return json.loads(text)


async def enrich_question(
    question: Dict,
    category: str,
    semaphore: asyncio.Semaphore,
    model: str = "gpt-4o-mini"
) -> Dict:
    """
    Enrich a single question with GPT
    
    Args:
        question: Question dictionary
        category: Question category
        semaphore: Asyncio semaphore for rate limiting
        model: OpenAI model to use
    
    Returns:
        Enriched question dictionary
    """
    async with semaphore:
        try:
            q_text = question.get("question_text", "")
            options = question.get("options", [])
            
            if not q_text:
                return {**question, "error": "Soru metni boş", "enriched": False}
            
            options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
            
            user_prompt = f"""Soru:
{q_text}

Şıklar:
{options_text}

Kategori: {category}"""

            client = get_openai_client()
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": get_category_system_prompt(category, "enrich")},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content.strip()
            result = parse_gpt_response(result_text)
            
            return {
                **question,
                "correct_answer": result.get("correct_answer"),
                "question_tr": result.get("question_tr", ""),
                "explanation_tr": result.get("explanation_tr", ""),
                "tested_skill": result.get("tested_skill", ""),
                "difficulty": result.get("difficulty", "medium"),
                "tip": result.get("tip", ""),
                "enriched": True,
                "gpt_processed_at": datetime.now().isoformat()
            }
            
        except json.JSONDecodeError as e:
            return {**question, "error": f"JSON parse error: {str(e)}", "enriched": False}
        except Exception as e:
            return {**question, "error": str(e), "enriched": False}


async def validate_question(
    question: Dict,
    category: str,
    semaphore: asyncio.Semaphore,
    model: str = "gpt-4o-mini"
) -> Dict:
    """
    Validate and potentially fix a question with GPT
    
    Args:
        question: Question dictionary
        category: Question category
        semaphore: Asyncio semaphore for rate limiting
        model: OpenAI model to use
    
    Returns:
        Validated question dictionary
    """
    async with semaphore:
        try:
            q_text = question.get("question_text", "")
            options = question.get("options", [])
            
            if not q_text:
                return {**question, "error": "Soru metni boş", "processed": False}
            
            options_text = "\n".join([f"{opt['letter']}) {opt['text']}" for opt in options])
            current_answer = question.get("correct_answer", "Belirtilmemiş")
            
            user_prompt = f"""Soru:
{q_text}

Şıklar:
{options_text}

Mevcut doğru cevap: {current_answer}
Kategori: {category}"""

            client = get_openai_client()
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": get_category_system_prompt(category, "validate")},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                max_tokens=2000
            )
            
            result_text = response.choices[0].message.content.strip()
            result = parse_gpt_response(result_text)
            
            return {
                "id": question["id"],
                "original_question": q_text,
                "status": result.get("status", "valid"),
                "is_valid": result.get("is_valid", True),
                "question_text": result.get("question_text", q_text),
                "options": result.get("options", options),
                "correct_answer": result.get("correct_answer"),
                "question_tr": result.get("question_tr", ""),
                "explanation_tr": result.get("explanation_tr", ""),
                "tested_skill": result.get("tested_skill", ""),
                "difficulty": result.get("difficulty", "medium"),
                "tip": result.get("tip", ""),
                "processed": True,
                "category": category
            }
            
        except json.JSONDecodeError as e:
            return {**question, "error": f"JSON parse error: {str(e)}", "processed": False}
        except Exception as e:
            return {**question, "error": str(e), "processed": False}


async def batch_process_questions(
    questions: List[Dict],
    category: str,
    process_func: callable,
    concurrent_limit: int = 10,
    batch_size: int = 50
) -> List[Dict]:
    """
    Process questions in batches with concurrency control
    
    Args:
        questions: List of questions
        category: Question category
        process_func: Processing function (enrich_question or validate_question)
        concurrent_limit: Max concurrent requests
        batch_size: Batch size
    
    Returns:
        List of processed questions
    """
    semaphore = asyncio.Semaphore(concurrent_limit)
    results = []
    
    for i in range(0, len(questions), batch_size):
        batch = questions[i:i + batch_size]
        tasks = [process_func(q, category, semaphore) for q in batch]
        batch_results = await asyncio.gather(*tasks)
        results.extend(batch_results)
        
        # Progress indicator
        processed = min(i + batch_size, len(questions))
        print(f"   İlerleme: {processed}/{len(questions)} ({(processed/len(questions)*100):.1f}%)")
    
    return results
