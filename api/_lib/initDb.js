const { getPool } = require('./db');

async function initDatabase() {
    const pool = getPool();
    
    try {
        // ==================== QUESTIONS ====================
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
                question_tr TEXT,
                explanation_tr TEXT,
                tested_skill VARCHAR(200),
                difficulty VARCHAR(20) DEFAULT 'medium',
                tip TEXT,
                is_valid BOOLEAN DEFAULT true,
                gpt_status VARCHAR(20),
                gpt_verified_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category)`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_text_category ON questions(md5(question_text), category)`);
        
        // ==================== USERS ====================
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
        
        // ==================== USER STATS ====================
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
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id)`);
        
        // ==================== USER WRONG ANSWERS ====================
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
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_wrong_answers_user_id ON user_wrong_answers(user_id)`);
        
        // ==================== GPT EXPLANATIONS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS gpt_explanations (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(50) UNIQUE NOT NULL,
                question_text TEXT,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // ==================== USER UNKNOWN WORDS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_unknown_words (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                word VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, word)
            )
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_unknown_words_user_id ON user_unknown_words(user_id)`);
        
        // ==================== USER ANSWER HISTORY ====================
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
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_answer_history_user_question ON user_answer_history(user_id, question_hash)`);
        
        // ==================== USER FAVORITES ====================
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
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id)`);
        
        // ==================== USER LEARNED WORDS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_learned_words (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                expression VARCHAR(200) NOT NULL,
                learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, expression)
            )
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_learned_words_user_id ON user_learned_words(user_id)`);
        
        // ==================== USER DAILY STATS ====================
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
        
        // ==================== QUESTION FEEDBACK ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS question_feedback (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(100) NOT NULL,
                user_id INTEGER,
                username VARCHAR(50),
                feedback_type VARCHAR(30) NOT NULL,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(question_hash, user_id, feedback_type)
            )
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_question_feedback_hash ON question_feedback(question_hash)`);
        
        // ==================== QUESTION RATINGS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS question_ratings (
                id SERIAL PRIMARY KEY,
                question_hash VARCHAR(100) NOT NULL,
                user_id INTEGER,
                username VARCHAR(50),
                rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_question_ratings_hash ON question_ratings(question_hash)`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_question_ratings_unique ON question_ratings(question_hash, COALESCE(user_id, 0), COALESCE(username, ''))`);
        
        // ==================== CHALLENGE ROOMS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS challenge_rooms (
                id SERIAL PRIMARY KEY,
                room_code VARCHAR(8) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                admin_id INTEGER,
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
        
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'normal'`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS enable_lives BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS max_lives INTEGER DEFAULT 3`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT TRUE`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) DEFAULT 'speed'`);

        // ==================== ROOM PARTICIPANTS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_participants (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                user_id INTEGER,
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
        
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS lives INTEGER DEFAULT 3`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_eliminated BOOLEAN DEFAULT FALSE`);

        // ==================== ROOM QUESTIONS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_questions (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                question_id INTEGER,
                question_index INTEGER NOT NULL,
                UNIQUE(room_id, question_index)
            )
        `);

        // ==================== ROOM ANSWERS ====================
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
        
        await pool.query(`ALTER TABLE room_answers ADD COLUMN IF NOT EXISTS answer_time_ms INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_answers ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0`);

        // ==================== FRIENDSHIPS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS friendships (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accepted_at TIMESTAMP,
                UNIQUE(user_id, friend_id)
            )
        `);

        // ==================== USER BADGES ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                badge_id VARCHAR(50) NOT NULL,
                earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, badge_id)
            )
        `);

        // ==================== CHALLENGE STATS ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS challenge_stats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE,
                total_games INTEGER DEFAULT 0,
                total_wins INTEGER DEFAULT 0,
                total_points INTEGER DEFAULT 0,
                highest_streak INTEGER DEFAULT 0,
                elo_rating INTEGER DEFAULT 1000,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // ==================== ROOM MESSAGES ====================
        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                username VARCHAR(50) NOT NULL,
                message TEXT,
                emoji VARCHAR(10),
                message_type VARCHAR(20) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

module.exports = { initDatabase };
