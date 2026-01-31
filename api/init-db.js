const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Only allow POST with secret key
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { secret } = req.body || {};
    if (secret !== process.env.INIT_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Create questions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                question_number VARCHAR(20),
                question_text TEXT NOT NULL,
                options JSONB NOT NULL,
                correct_answer VARCHAR(5) NOT NULL,
                category VARCHAR(100) NOT NULL,
                url TEXT,
                test_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create index on category for faster queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_questions_category 
            ON questions(category)
        `);
        
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);
        
        // Create user_stats table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                total_answered INTEGER DEFAULT 0,
                total_correct INTEGER DEFAULT 0,
                total_wrong INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_activity_date DATE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create user_wrong_answers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_wrong_answers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                question_id INTEGER REFERENCES questions(id),
                user_answer VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create gpt_explanations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gpt_explanations (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(50) UNIQUE NOT NULL,
                question_text TEXT,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        res.status(200).json({ 
            success: true, 
            message: 'Database tables created successfully' 
        });
        
    } catch (error) {
        console.error('Init DB error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};
