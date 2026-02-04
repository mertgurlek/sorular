const { getPool } = require('./db');

async function initDatabase() {
    const pool = getPool();
    
    try {
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
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_wrong_answers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                category VARCHAR(100),
                user_answer VARCHAR(10),
                correct_answer VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gpt_explanations (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(50) UNIQUE NOT NULL,
                question_text TEXT,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_unknown_words (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                word VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, word)
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_answer_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                question_hash VARCHAR(100) NOT NULL,
                question_text TEXT,
                category VARCHAR(100),
                user_answer VARCHAR(10),
                is_correct BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_answer_history_user_question 
            ON user_answer_history(user_id, question_hash)
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_favorites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                question_id INTEGER,
                question_text TEXT NOT NULL,
                question_data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, question_text)
            )
        `);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_daily_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                answered INTEGER DEFAULT 0,
                correct INTEGER DEFAULT 0,
                UNIQUE(user_id, date)
            )
        `);
        
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

module.exports = { initDatabase };
