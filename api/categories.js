const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const result = await pool.query(`
            SELECT category, COUNT(*) as count
            FROM questions
            GROUP BY category
            ORDER BY category
        `);
        
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM questions');
        
        res.status(200).json({
            success: true,
            categories: result.rows,
            total: parseInt(totalResult.rows[0].total)
        });
        
    } catch (error) {
        console.error('Categories API error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Veritabanı hatası' 
        });
    }
};
