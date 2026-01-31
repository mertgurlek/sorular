const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { category } = req.query;
        
        let query = `
            SELECT id, question_number, question_text, options, correct_answer, 
                   category, url, test_url
            FROM questions
        `;
        let params = [];
        
        if (category && category !== 'all') {
            query += ' WHERE category = $1';
            params.push(category);
        }
        
        query += ' ORDER BY category, id';
        
        const result = await pool.query(query, params);
        
        res.status(200).json({
            success: true,
            questions: result.rows
        });
        
    } catch (error) {
        console.error('Questions API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Veritabanı hatası' 
        });
    }
};
