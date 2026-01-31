const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
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
                total_correct INTEGER DEFAULT 0,
                total_wrong INTEGER DEFAULT 0,
                category_stats JSONB DEFAULT '{}',
                daily_stats JSONB DEFAULT '{}',
                streak INTEGER DEFAULT 0,
                last_activity DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create gpt_explanations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gpt_explanations (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(64) UNIQUE NOT NULL,
                question_text TEXT,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create challenge_rooms table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS challenge_rooms (
                id SERIAL PRIMARY KEY,
                room_code VARCHAR(8) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                admin_name VARCHAR(50) NOT NULL,
                status VARCHAR(20) DEFAULT 'waiting',
                question_count INTEGER NOT NULL,
                current_question_index INTEGER DEFAULT 0,
                categories JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                ended_at TIMESTAMP
            )
        `);

        // Create room_participants table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_participants (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                username VARCHAR(50) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                is_ready BOOLEAN DEFAULT FALSE,
                total_correct INTEGER DEFAULT 0,
                total_wrong INTEGER DEFAULT 0,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(room_id, username)
            )
        `);

        // Create room_questions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_questions (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
                question_index INTEGER NOT NULL,
                UNIQUE(room_id, question_index)
            )
        `);

        // Create room_answers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_answers (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                participant_id INTEGER REFERENCES room_participants(id) ON DELETE CASCADE,
                question_index INTEGER NOT NULL,
                selected_answer VARCHAR(1),
                is_correct BOOLEAN,
                answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(room_id, participant_id, question_index)
            )
        `);

        // Create indexes for better performance
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_room_code ON challenge_rooms(room_code);
            CREATE INDEX IF NOT EXISTS idx_room_status ON challenge_rooms(status);
            CREATE INDEX IF NOT EXISTS idx_participant_room ON room_participants(room_id);
            CREATE INDEX IF NOT EXISTS idx_answers_room ON room_answers(room_id);
        `);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Database tables created successfully (including challenge tables)'
            })
        };

    } catch (error) {
        console.error('Init DB error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};
