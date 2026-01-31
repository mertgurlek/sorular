exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'OpenAI API key not configured' })
        };
    }

    try {
        const { question, userAnswer, options, correctAnswer } = JSON.parse(event.body || '{}');
        
        if (!question) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Question is required' })
            };
        }

        const optionsText = options.map(o => `${o.letter}) ${o.text}`).join('\n');
        const correctOption = options.find(o => o.letter === correctAnswer);
        const userOption = options.find(o => o.letter === userAnswer);

        const prompt = `Sen bir YDS/YÖKDİL İngilizce sınav uzmanısın. Aşağıdaki soruyu analiz et ve öğrenciye açıkla.

**SORU:**
${question}

**SEÇENEKLER:**
${optionsText}

**ÖĞRENCİNİN CEVABI:** ${userAnswer}) ${userOption ? userOption.text : 'Süre doldu'}
**DOĞRU CEVAP:** ${correctAnswer}) ${correctOption ? correctOption.text : ''}

Lütfen şu formatta açıkla:
1. **Doğru Cevap Neden Doğru:** Kısa ve net açıkla
2. **Yanlış Cevap Neden Yanlış:** Öğrencinin seçtiği cevabın neden yanlış olduğunu açıkla
3. **Gramer/Kullanım Kuralı:** Bu soruda test edilen dilbilgisi kuralını açıkla
4. **İpucu:** Benzer sorularda dikkat edilmesi gereken 1-2 pratik ipucu

Türkçe olarak açıkla, kısa ve öz ol.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Sen bir YDS/YÖKDİL İngilizce sınav uzmanısın. Öğrencilere yardımcı olmak için kısa, net ve anlaşılır açıklamalar yaparsın.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'OpenAI API hatası' })
            };
        }

        const data = await response.json();
        const explanation = data.choices[0]?.message?.content || 'Açıklama alınamadı';

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, explanation })
        };

    } catch (error) {
        console.error('GPT Explain error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Sunucu hatası' })
        };
    }
};
