const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const category = params.category;
        
        let query = `
            SELECT id, question_number, question_text, options, correct_answer, 
                   category, url, test_url
            FROM questions
        `;
        let queryParams = [];
        
        if (category && category !== 'all') {
            query += ' WHERE category = $1';
            queryParams.push(category);
        }
        
        query += ' ORDER BY category, id';
        
        const result = await pool.query(query, queryParams);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                questions: result.rows
            })
        };
    } catch (error) {
        console.error('Questions error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Veritabanı hatası' })
        };
    }
};
