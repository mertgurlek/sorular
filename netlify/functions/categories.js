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
        const result = await pool.query(`
            SELECT category, COUNT(*) as count
            FROM questions
            GROUP BY category
            ORDER BY category
        `);
        
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM questions');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                categories: result.rows,
                total: parseInt(totalResult.rows[0].total)
            })
        };
    } catch (error) {
        console.error('Categories error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Veritabanı hatası' })
        };
    }
};
