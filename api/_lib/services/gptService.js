const { query } = require('../lib/db');

class GPTService {
    async saveExplanation(questionHash, questionText, explanation) {
        await query(`
            INSERT INTO gpt_explanations (question_hash, question_text, explanation)
            VALUES ($1, $2, $3)
            ON CONFLICT (question_hash) DO UPDATE SET explanation = $3
        `, [questionHash, questionText, explanation]);
    }
    
    async getExplanation(hash) {
        const result = await query(
            'SELECT * FROM gpt_explanations WHERE question_hash = $1',
            [hash]
        );
        return result.rows[0] || null;
    }
    
    async generateExplanation(prompt, model = 'gpt-4o-mini') {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not configured');
        }

        if (!prompt || typeof prompt !== 'string') {
            throw new Error('prompt is required');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'system',
                        content: `Sen deneyimli bir YDS/YÖKDİL İngilizce öğretmenisin. Öğrencilere gramer konularını açık, anlaşılır ve motive edici şekilde açıklıyorsun. 
                    
Kurallar:
- Türkçe açıkla
- Kısa ve öz ol (maksimum 250 kelime)
- Emoji kullan ama abartma
- Teknik terimleri basit örneklerle açıkla
- Öğrenciyi motive et, yanlış cevap için olumsuz konuşma`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 600,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || 'OpenAI request failed');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'Açıklama alınamadı.';
    }
}

module.exports = new GPTService();
