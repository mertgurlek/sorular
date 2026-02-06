const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const dbUrl = process.env.DATABASE_URL || '';
const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocalDb ? false : { rejectUnauthorized: false }
});

// Initialize database tables
async function initDatabase() {
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
        
        // User unknown words table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_unknown_words (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                word VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, word)
            )
        `);
        
        // User answer history table
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
        
        // Create index for faster answer history queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_answer_history_user_question 
            ON user_answer_history(user_id, question_hash)
        `);
        
        // User favorites table
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
        
        // User learned words table (for key words tracking)
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

        // User daily stats table
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
        
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

initDatabase();

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tüm alanları doldurun' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
        }
        
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Bu kullanıcı adı veya email zaten kayıtlı' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, email, passwordHash]
        );
        
        const user = result.rows[0];
        
        await pool.query(
            'INSERT INTO user_stats (user_id) VALUES ($1)',
            [user.id]
        );
        
        res.status(201).json({
            message: 'Kayıt başarılı!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }
        
        const result = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
        }
        
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Şifre yanlış' });
        }
        
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const statsResult = await pool.query(
            'SELECT * FROM user_stats WHERE user_id = $1',
            [user.id]
        );
        
        res.json({
            message: 'Giriş başarılı!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                stats: statsResult.rows[0] || null
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const userResult = await pool.query(
            'SELECT id, username, email, created_at, last_login FROM users WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }
        
        const statsResult = await pool.query(
            'SELECT * FROM user_stats WHERE user_id = $1',
            [userId]
        );
        
        res.json({
            user: userResult.rows[0],
            stats: statsResult.rows[0] || null
        });
        
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Update user stats
app.post('/api/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const { totalAnswered, totalCorrect, totalWrong, streakDays } = req.body;
        
        await pool.query(`
            UPDATE user_stats 
            SET total_answered = $1, total_correct = $2, total_wrong = $3, 
                streak_days = $4, last_activity_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
        `, [totalAnswered, totalCorrect, totalWrong, streakDays, userId]);
        
        res.json({ message: 'İstatistikler güncellendi' });
        
    } catch (error) {
        console.error('Update stats error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Save GPT explanation
app.post('/api/gpt-explanation', async (req, res) => {
    try {
        const { questionHash, questionText, explanation } = req.body;
        
        await pool.query(`
            INSERT INTO gpt_explanations (question_hash, question_text, explanation)
            VALUES ($1, $2, $3)
            ON CONFLICT (question_hash) DO UPDATE SET explanation = $3
        `, [questionHash, questionText, explanation]);
        
        res.json({ message: 'Açıklama kaydedildi' });
        
    } catch (error) {
        console.error('Save GPT explanation error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Get GPT explanation
app.get('/api/gpt-explanation/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM gpt_explanations WHERE question_hash = $1',
            [hash]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Açıklama bulunamadı' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Get GPT explanation error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/openai-explain', async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        const { prompt, model } = req.body || {};
        
        console.log('OpenAI explain request:', { hasPrompt: !!prompt, promptLength: prompt?.length, model });

        if (!apiKey) {
            console.error('OpenAI API key not configured');
            return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
        }

        if (!prompt || typeof prompt !== 'string') {
            console.error('Invalid prompt:', { prompt: typeof prompt, body: req.body });
            return res.status(400).json({ error: 'prompt is required' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
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
            return res.status(response.status).json({ error: errorData.error?.message || 'OpenAI request failed' });
        }

        const data = await response.json();
        const explanation = data.choices?.[0]?.message?.content || 'Açıklama alınamadı.';
        res.json({ explanation });
    } catch (error) {
        console.error('OpenAI explain error:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// ==================== CATEGORIES & QUESTIONS ROUTES ====================

// Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT category, COUNT(*) as count
            FROM questions
            GROUP BY category
            ORDER BY category
        `);
        
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM questions');
        
        res.json({
            success: true,
            categories: result.rows,
            total: parseInt(totalResult.rows[0].total)
        });
    } catch (error) {
        console.error('Categories API error:', error);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// Get questions
app.get('/api/questions', async (req, res) => {
    try {
        const { category } = req.query;
        
        let query = `
            SELECT id, question_number, question_text, options, correct_answer, 
                   category, url, test_url, tip, explanation_tr, question_tr, difficulty
            FROM questions
        `;
        let params = [];
        
        if (category && category !== 'all') {
            query += ' WHERE category = $1';
            params.push(category);
        }
        
        query += ' ORDER BY category, id';
        
        const result = await pool.query(query, params);
        
        // Parse options - handle both array and nested object formats
        const questions = result.rows.map(q => {
            let options = q.options;
            
            // If string, parse it
            if (typeof options === 'string') {
                try { options = JSON.parse(options); } catch (e) { options = []; }
            }
            
            // If nested object with 'options' key, extract inner options and extra fields
            if (options && typeof options === 'object' && !Array.isArray(options)) {
                return {
                    ...q,
                    options: Array.isArray(options.options) ? options.options : [],
                    tip: options.tip || q.tip || null,
                    explanation_tr: options.explanation_tr || q.explanation_tr || null,
                    question_tr: options.question_tr || q.question_tr || null,
                    difficulty: options.difficulty || q.difficulty || null
                };
            }
            
            // If already an array, use as-is
            return {
                ...q,
                options: Array.isArray(options) ? options : []
            };
        });
        
        res.json({
            success: true,
            questions: questions
        });
    } catch (error) {
        console.error('Questions API error:', error);
        res.status(500).json({ success: false, error: 'Veritabanı hatası' });
    }
});

// ==================== USER DATA ROUTES ====================

// --- UNKNOWN WORDS ---
// Get user's unknown words
app.get('/api/user/:userId/unknown-words', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT word FROM user_unknown_words WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, words: result.rows.map(r => r.word) });
    } catch (error) {
        console.error('Get unknown words error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Add unknown word
app.post('/api/user/:userId/unknown-words', async (req, res) => {
    try {
        const { userId } = req.params;
        const { word } = req.body;
        
        await pool.query(`
            INSERT INTO user_unknown_words (user_id, word)
            VALUES ($1, $2)
            ON CONFLICT (user_id, word) DO NOTHING
        `, [userId, word.toLowerCase()]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add unknown word error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Remove unknown word
app.delete('/api/user/:userId/unknown-words/:word', async (req, res) => {
    try {
        const { userId, word } = req.params;
        await pool.query(
            'DELETE FROM user_unknown_words WHERE user_id = $1 AND word = $2',
            [userId, word.toLowerCase()]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Remove unknown word error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Clear all unknown words
app.delete('/api/user/:userId/unknown-words', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query('DELETE FROM user_unknown_words WHERE user_id = $1', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear unknown words error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Sync unknown words (bulk add)
app.post('/api/user/:userId/unknown-words/sync', async (req, res) => {
    try {
        const { userId } = req.params;
        const { words } = req.body;
        
        if (words && words.length > 0) {
            const values = words.map((w, i) => `($1, $${i + 2})`).join(',');
            const params = [userId, ...words.map(w => w.toLowerCase())];
            await pool.query(`
                INSERT INTO user_unknown_words (user_id, word)
                VALUES ${values}
                ON CONFLICT (user_id, word) DO NOTHING
            `, params);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Sync unknown words error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- ANSWER HISTORY ---
// Get user's answer history summary (last status per question)
app.get('/api/user/:userId/answer-history', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(`
            SELECT DISTINCT ON (question_hash) 
                question_hash, question_text, category, is_correct,
                COUNT(*) OVER (PARTITION BY question_hash) as total_attempts,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) OVER (PARTITION BY question_hash) as correct_count
            FROM user_answer_history 
            WHERE user_id = $1 
            ORDER BY question_hash, created_at DESC
        `, [userId]);
        
        const history = {};
        result.rows.forEach(row => {
            history[row.question_hash] = {
                lastCorrect: row.is_correct,
                totalAttempts: parseInt(row.total_attempts),
                correctCount: parseInt(row.correct_count),
                wrongCount: parseInt(row.total_attempts) - parseInt(row.correct_count)
            };
        });
        
        res.json({ success: true, history });
    } catch (error) {
        console.error('Get answer history error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Save answer to history
app.post('/api/user/:userId/answer-history', async (req, res) => {
    try {
        const { userId } = req.params;
        const { questionHash, questionText, category, userAnswer, isCorrect } = req.body;
        
        await pool.query(`
            INSERT INTO user_answer_history (user_id, question_hash, question_text, category, user_answer, is_correct)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, questionHash, questionText, category, userAnswer, isCorrect]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Save answer history error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Clear answer history
app.delete('/api/user/:userId/answer-history', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query('DELETE FROM user_answer_history WHERE user_id = $1', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear answer history error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- FAVORITES ---
// Get user's favorites
app.get('/api/user/:userId/favorites', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT question_data FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, favorites: result.rows.map(r => r.question_data) });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Add favorite
app.post('/api/user/:userId/favorites', async (req, res) => {
    try {
        const { userId } = req.params;
        const { question } = req.body;
        
        await pool.query(`
            INSERT INTO user_favorites (user_id, question_id, question_text, question_data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, question_text) DO NOTHING
        `, [userId, question.id || null, question.question_text, JSON.stringify(question)]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Remove favorite
app.delete('/api/user/:userId/favorites', async (req, res) => {
    try {
        const { userId } = req.params;
        const { questionText } = req.body;
        
        await pool.query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND question_text = $2',
            [userId, questionText]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Clear all favorites
app.delete('/api/user/:userId/favorites/all', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear favorites error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- WRONG ANSWERS ---
// Get user's wrong answers
app.get('/api/user/:userId/wrong-answers', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT * FROM user_wrong_answers WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        res.json({ success: true, wrongAnswers: result.rows });
    } catch (error) {
        console.error('Get wrong answers error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Save wrong answer
app.post('/api/user/:userId/wrong-answers', async (req, res) => {
    try {
        const { userId } = req.params;
        const { questionText, category, userAnswer, correctAnswer } = req.body;
        
        // Check if already exists
        const existing = await pool.query(
            'SELECT id FROM user_wrong_answers WHERE user_id = $1 AND question_text = $2',
            [userId, questionText]
        );
        
        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO user_wrong_answers (user_id, question_text, category, user_answer, correct_answer)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, questionText, category, userAnswer, correctAnswer]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Save wrong answer error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Remove wrong answer
app.delete('/api/user/:userId/wrong-answers/:id', async (req, res) => {
    try {
        const { userId, id } = req.params;
        await pool.query(
            'DELETE FROM user_wrong_answers WHERE user_id = $1 AND id = $2',
            [userId, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Remove wrong answer error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Clear all wrong answers
app.delete('/api/user/:userId/wrong-answers', async (req, res) => {
    try {
        const { userId } = req.params;
        await pool.query('DELETE FROM user_wrong_answers WHERE user_id = $1', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear wrong answers error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- DAILY STATS ---
// Get user's daily stats
app.get('/api/user/:userId/daily-stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT date, answered, correct FROM user_daily_stats WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
            [userId]
        );
        
        const stats = {};
        result.rows.forEach(row => {
            stats[row.date.toISOString().split('T')[0]] = {
                answered: row.answered,
                correct: row.correct
            };
        });
        
        res.json({ success: true, dailyStats: stats });
    } catch (error) {
        console.error('Get daily stats error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Update daily stats
app.post('/api/user/:userId/daily-stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const { date, answered, correct } = req.body;
        
        await pool.query(`
            INSERT INTO user_daily_stats (user_id, date, answered, correct)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, date) DO UPDATE SET answered = $3, correct = $4
        `, [userId, date, answered, correct]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update daily stats error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- LEARNED WORDS (Key Words Tracking) ---
// Get user's learned words
app.get('/api/user/:userId/learned-words', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(
            'SELECT expression, learned_at FROM user_learned_words WHERE user_id = $1 ORDER BY learned_at DESC',
            [userId]
        );
        res.json({ success: true, learnedWords: result.rows.map(r => r.expression) });
    } catch (error) {
        console.error('Get learned words error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Add learned word
app.post('/api/user/:userId/learned-words', async (req, res) => {
    try {
        const { userId } = req.params;
        const { expression } = req.body;
        
        await pool.query(`
            INSERT INTO user_learned_words (user_id, expression)
            VALUES ($1, $2)
            ON CONFLICT (user_id, expression) DO NOTHING
        `, [userId, expression.toLowerCase()]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add learned word error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Remove learned word
app.delete('/api/user/:userId/learned-words/:expression', async (req, res) => {
    try {
        const { userId, expression } = req.params;
        await pool.query(
            'DELETE FROM user_learned_words WHERE user_id = $1 AND expression = $2',
            [userId, decodeURIComponent(expression).toLowerCase()]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Remove learned word error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// --- SYNC ALL USER DATA ---
// Get all user data at once (for initial load)
app.get('/api/user/:userId/all-data', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get unknown words
        const wordsResult = await pool.query(
            'SELECT word FROM user_unknown_words WHERE user_id = $1',
            [userId]
        );
        
        // Get answer history summary
        const historyResult = await pool.query(`
            SELECT DISTINCT ON (question_hash) 
                question_hash, is_correct,
                COUNT(*) OVER (PARTITION BY question_hash) as total_attempts,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) OVER (PARTITION BY question_hash) as correct_count
            FROM user_answer_history 
            WHERE user_id = $1 
            ORDER BY question_hash, created_at DESC
        `, [userId]);
        
        // Get favorites
        const favoritesResult = await pool.query(
            'SELECT question_data FROM user_favorites WHERE user_id = $1',
            [userId]
        );
        
        // Get wrong answers
        const wrongResult = await pool.query(
            'SELECT * FROM user_wrong_answers WHERE user_id = $1',
            [userId]
        );
        
        // Get daily stats (last 30 days)
        const dailyResult = await pool.query(
            'SELECT date, answered, correct FROM user_daily_stats WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
            [userId]
        );
        
        // Get learned words
        const learnedResult = await pool.query(
            'SELECT expression FROM user_learned_words WHERE user_id = $1',
            [userId]
        );
        
        // Get user stats
        const statsResult = await pool.query(
            'SELECT * FROM user_stats WHERE user_id = $1',
            [userId]
        );
        
        const history = {};
        historyResult.rows.forEach(row => {
            history[row.question_hash] = {
                lastCorrect: row.is_correct,
                totalAttempts: parseInt(row.total_attempts),
                correctCount: parseInt(row.correct_count),
                wrongCount: parseInt(row.total_attempts) - parseInt(row.correct_count)
            };
        });
        
        const dailyStats = {};
        dailyResult.rows.forEach(row => {
            dailyStats[row.date.toISOString().split('T')[0]] = {
                answered: row.answered,
                correct: row.correct
            };
        });
        
        res.json({
            success: true,
            data: {
                unknownWords: wordsResult.rows.map(r => r.word),
                answerHistory: history,
                favorites: favoritesResult.rows.map(r => r.question_data),
                wrongAnswers: wrongResult.rows,
                dailyStats: dailyStats,
                learnedWords: learnedResult.rows.map(r => r.expression),
                stats: statsResult.rows[0] || null
            }
        });
    } catch (error) {
        console.error('Get all user data error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== CHALLENGE ROOM ROUTES ====================

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Initialize challenge tables (single source of truth)
ensureChallengeTables();

// YDS Gerçek Sınav Soru Dağılımı (80 soru toplam)
const YDS_DISTRIBUTION = {
    'Tenses': 8,
    'Modals': 4,
    'If Clauses': 6,
    'Passive': 8,
    'Noun Clauses': 6,
    'Relative Clauses': 7,
    'Reductions': 3,
    'Nouns': 5,
    'Adjectives & Adverbs': 5,
    'Conjunctions': 6,
    'Gerunds & Infinitives': 6,
    'Grammar Revision': 16
};

// Create Room
app.post('/api/rooms/create', async (req, res) => {
    try {
        const { name, adminId, adminName, mode, categoryQuestions, timeLimit, enableLives, maxLives, shuffleQuestions, scoringMode } = req.body;
        
        if (!adminName) {
            return res.status(400).json({ success: false, error: 'Kullanıcı adı gerekli' });
        }

        // Ensure challenge tables exist
        await ensureChallengeTables();

        let roomCode;
        let codeExists = true;
        while (codeExists) {
            roomCode = generateRoomCode();
            const check = await pool.query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
            codeExists = check.rows.length > 0;
        }

        let questionsToSelect = [];
        let totalQuestionCount = 0;
        let categories = [];

        // Mode-based question selection (Mini YDS, Orta YDS, YDS)
        if (mode === 'mini-yds' || mode === 'orta-yds' || mode === 'yds') {
            const divisor = mode === 'mini-yds' ? 4 : mode === 'orta-yds' ? 2 : 1;
            
            for (const [category, count] of Object.entries(YDS_DISTRIBUTION)) {
                const adjustedCount = Math.max(1, Math.round(count / divisor));
                const catQuestions = await pool.query(`
                    SELECT id, category FROM questions 
                    WHERE category = $1
                    ORDER BY RANDOM()
                    LIMIT $2
                `, [category, adjustedCount]);
                
                questionsToSelect.push(...catQuestions.rows);
                if (catQuestions.rows.length > 0) {
                    categories.push(category);
                }
            }
            totalQuestionCount = questionsToSelect.length;
        } 
        // Custom category-based selection
        else if (categoryQuestions && Object.keys(categoryQuestions).length > 0) {
            for (const [category, count] of Object.entries(categoryQuestions)) {
                if (count > 0) {
                    const catQuestions = await pool.query(`
                        SELECT id, category FROM questions 
                        WHERE category = $1
                        ORDER BY RANDOM()
                        LIMIT $2
                    `, [category, count]);
                    
                    questionsToSelect.push(...catQuestions.rows);
                    if (catQuestions.rows.length > 0) {
                        categories.push(category);
                    }
                }
            }
            totalQuestionCount = questionsToSelect.length;
        } else {
            return res.status(400).json({ success: false, error: 'Mod veya kategori seçimi gerekli' });
        }

        if (questionsToSelect.length === 0) {
            return res.status(400).json({ success: false, error: 'Seçilen kategorilerde soru bulunamadı' });
        }

        // Shuffle questions only if setting is enabled (default: true)
        const shouldShuffle = shuffleQuestions !== false;
        if (shouldShuffle) {
            questionsToSelect = questionsToSelect.sort(() => Math.random() - 0.5);
        }

        const roomResult = await pool.query(`
            INSERT INTO challenge_rooms (room_code, name, admin_id, admin_name, question_count, categories, status, time_limit, enable_lives, max_lives, shuffle_questions, scoring_mode)
            VALUES ($1, $2, $3, $4, $5, $6, 'waiting', $7, $8, $9, $10, $11)
            RETURNING id, room_code, name, admin_name, question_count, categories, status, created_at, time_limit, enable_lives, max_lives, shuffle_questions, scoring_mode
        `, [roomCode, name || `${adminName}'in Odası`, adminId || null, adminName, totalQuestionCount, JSON.stringify(categories), timeLimit || 0, enableLives || false, maxLives || 3, shouldShuffle, scoringMode || 'speed']);

        const room = roomResult.rows[0];

        await pool.query(`
            INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready, lives)
            VALUES ($1, $2, $3, TRUE, TRUE, $4)
        `, [room.id, adminId || null, adminName, maxLives || 3]);

        for (let i = 0; i < questionsToSelect.length; i++) {
            await pool.query(`
                INSERT INTO room_questions (room_id, question_id, question_index)
                VALUES ($1, $2, $3)
            `, [room.id, questionsToSelect[i].id, i]);
        }

        res.json({
            success: true,
            room: { ...room, actualQuestionCount: questionsToSelect.length },
            mode: mode || 'custom'
        });

    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
    }
});

// Ensure challenge tables exist
async function ensureChallengeTables() {
    try {
        // Challenge rooms with timer and game mode settings
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
        
        // Add missing columns to existing table
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'normal'`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS enable_lives BOOLEAN DEFAULT FALSE`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS max_lives INTEGER DEFAULT 3`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS question_started_at TIMESTAMP`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT TRUE`);
        await pool.query(`ALTER TABLE challenge_rooms ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) DEFAULT 'speed'`);

        // Room participants with score, streak, lives
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
        
        // Add missing columns to room_participants
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS max_streak INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS lives INTEGER DEFAULT 3`);
        await pool.query(`ALTER TABLE room_participants ADD COLUMN IF NOT EXISTS is_eliminated BOOLEAN DEFAULT FALSE`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS room_questions (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES challenge_rooms(id) ON DELETE CASCADE,
                question_id INTEGER,
                question_index INTEGER NOT NULL,
                UNIQUE(room_id, question_index)
            )
        `);

        // Room answers with timing for speed bonus
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
        
        // Add missing columns to room_answers
        await pool.query(`ALTER TABLE room_answers ADD COLUMN IF NOT EXISTS answer_time_ms INTEGER DEFAULT 0`);
        await pool.query(`ALTER TABLE room_answers ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0`);

        // Friendships
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

        // User badges/achievements
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_badges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                badge_id VARCHAR(50) NOT NULL,
                earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, badge_id)
            )
        `);

        // Challenge stats per user
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

        // Room chat messages
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

    } catch (error) {
        console.error('Ensure tables error:', error);
    }
}

// Join Room
app.post('/api/rooms/join', async (req, res) => {
    try {
        const { roomCode, userId, username } = req.body;

        if (!roomCode || !username) {
            return res.status(400).json({ success: false, error: 'Oda kodu ve kullanıcı adı gerekli' });
        }

        const roomResult = await pool.query(`
            SELECT * FROM challenge_rooms WHERE room_code = $1
        `, [roomCode.toUpperCase()]);

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        const room = roomResult.rows[0];

        if (room.status === 'finished') {
            return res.status(400).json({ success: false, error: 'Bu oda sonlanmış' });
        }

        const existingParticipant = await pool.query(`
            SELECT * FROM room_participants WHERE room_id = $1 AND username = $2
        `, [room.id, username]);

        let participant;
        if (existingParticipant.rows.length > 0) {
            await pool.query(`
                UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP WHERE id = $1
            `, [existingParticipant.rows[0].id]);
            participant = existingParticipant.rows[0];
        } else {
            if (room.status !== 'waiting') {
                return res.status(400).json({ success: false, error: 'Yarışma başlamış, katılamazsınız' });
            }
            const newParticipant = await pool.query(`
                INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready, lives)
                VALUES ($1, $2, $3, FALSE, FALSE, $4)
                RETURNING *
            `, [room.id, userId || null, username, room.max_lives || 3]);
            participant = newParticipant.rows[0];
        }

        res.json({ success: true, room, participant });

    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get Room State
app.get('/api/rooms/:code', async (req, res) => {
    try {
        const roomCode = req.params.code.toUpperCase();
        const username = req.query.username;

        const roomResult = await pool.query(`
            SELECT * FROM challenge_rooms WHERE room_code = $1
        `, [roomCode]);

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        const room = roomResult.rows[0];

        const participantsResult = await pool.query(`
            SELECT id, username, is_admin, is_ready, total_correct, total_wrong, last_seen, score, is_eliminated
            FROM room_participants WHERE room_id = $1
            ORDER BY is_admin DESC, joined_at ASC
        `, [room.id]);

        if (username) {
            await pool.query(`
                UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP 
                WHERE room_id = $1 AND username = $2
            `, [room.id, username]);
        }

        let currentQuestion = null;
        let answers = [];
        
        if (room.status === 'active') {
            const questionResult = await pool.query(`
                SELECT q.id, q.question_text, q.options, q.correct_answer, q.category, rq.question_index
                FROM room_questions rq
                JOIN questions q ON rq.question_id = q.id
                WHERE rq.room_id = $1 AND rq.question_index = $2
            `, [room.id, room.current_question_index]);

            if (questionResult.rows.length > 0) {
                currentQuestion = questionResult.rows[0];
                currentQuestion.options = typeof currentQuestion.options === 'string' 
                    ? JSON.parse(currentQuestion.options) 
                    : currentQuestion.options;
            }

            const answersResult = await pool.query(`
                SELECT ra.participant_id, ra.selected_answer, ra.is_correct, rp.username
                FROM room_answers ra
                JOIN room_participants rp ON ra.participant_id = rp.id
                WHERE ra.room_id = $1 AND ra.question_index = $2
            `, [room.id, room.current_question_index]);
            answers = answersResult.rows;
        }

        const questionCountResult = await pool.query(`
            SELECT COUNT(*) as count FROM room_questions WHERE room_id = $1
        `, [room.id]);

        // Count active (non-eliminated) participants and how many answered current question
        const activeParticipants = participantsResult.rows.filter(p => !p.is_eliminated);
        const answeredCount = answers.length;
        const allAnswered = room.status === 'active' && activeParticipants.length > 0 && answeredCount >= activeParticipants.length;

        res.json({
            success: true,
            room: { ...room, totalQuestions: parseInt(questionCountResult.rows[0].count) },
            participants: participantsResult.rows,
            currentQuestion: room.status === 'active' ? currentQuestion : null,
            answers,
            answeredCount,
            activeParticipantCount: activeParticipants.length,
            allAnswered
        });

    } catch (error) {
        console.error('Get room state error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Set Ready
app.post('/api/rooms/ready', async (req, res) => {
    try {
        const { roomCode, username, isReady } = req.body;

        await pool.query(`
            UPDATE room_participants rp
            SET is_ready = $3
            FROM challenge_rooms cr
            WHERE cr.id = rp.room_id AND cr.room_code = $1 AND rp.username = $2
        `, [roomCode.toUpperCase(), username, isReady]);

        res.json({ success: true });

    } catch (error) {
        console.error('Set ready error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Start Game
app.post('/api/rooms/start', async (req, res) => {
    try {
        const { roomCode, adminName } = req.body;

        const roomResult = await pool.query(`
            SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
        `, [roomCode.toUpperCase(), adminName]);

        if (roomResult.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
        }

        const room = roomResult.rows[0];

        if (room.status !== 'waiting') {
            return res.status(400).json({ success: false, error: 'Oyun zaten başlamış' });
        }

        await pool.query(`
            UPDATE challenge_rooms 
            SET status = 'active', started_at = CURRENT_TIMESTAMP, current_question_index = 0, question_started_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [room.id]);

        res.json({ success: true });

    } catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Submit Answer
app.post('/api/rooms/answer', async (req, res) => {
    try {
        const { roomCode, username, questionIndex, answer, answerTimeMs } = req.body;

        const roomResult = await pool.query(`
            SELECT cr.*, rp.id as participant_id, rp.current_streak, rp.max_streak, rp.lives, rp.is_eliminated, rp.user_id, rp.score
            FROM challenge_rooms cr
            JOIN room_participants rp ON rp.room_id = cr.id
            WHERE cr.room_code = $1 AND rp.username = $2
        `, [roomCode.toUpperCase(), username]);

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda veya katılımcı bulunamadı' });
        }

        const room = roomResult.rows[0];

        if (room.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Oyun aktif değil' });
        }

        // Check if eliminated (lives mode)
        if (room.is_eliminated) {
            return res.status(400).json({ success: false, error: 'Elendiniz' });
        }

        const questionResult = await pool.query(`
            SELECT q.correct_answer
            FROM room_questions rq
            JOIN questions q ON rq.question_id = q.id
            WHERE rq.room_id = $1 AND rq.question_index = $2
        `, [room.id, questionIndex]);

        if (questionResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Soru bulunamadı' });
        }

        const correctAnswer = questionResult.rows[0].correct_answer;
        const isCorrect = answer === correctAnswer;

        // Calculate points using centralized scoring function
        let newStreak = isCorrect ? room.current_streak + 1 : 0;
        let maxStreak = Math.max(room.max_streak, newStreak);
        let pointsEarned = 0;
        let newLives = room.lives;
        let isEliminated = false;

        if (isCorrect) {
            // Use centralized calculatePoints with scoring_mode support
            pointsEarned = calculatePoints(true, answerTimeMs, room.current_streak, room.scoring_mode || 'speed');

            // Check streak badges
            if (room.user_id) {
                if (newStreak >= 5) await awardBadge(room.user_id, 'streak_5');
                if (newStreak >= 10) await awardBadge(room.user_id, 'streak_10');
                if (newStreak >= 20) await awardBadge(room.user_id, 'streak_20');
                
                // Speed demon badge
                if (answerTimeMs && answerTimeMs < 5000) {
                    await awardBadge(room.user_id, 'speed_demon');
                }
            }
        } else {
            // Lives system
            if (room.enable_lives) {
                newLives = room.lives - 1;
                if (newLives <= 0) {
                    isEliminated = true;
                }
            }
        }

        // Save answer with timing and points
        await pool.query(`
            INSERT INTO room_answers (room_id, participant_id, question_index, selected_answer, is_correct, answer_time_ms, points_earned)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (room_id, participant_id, question_index) 
            DO UPDATE SET selected_answer = $4, is_correct = $5, answer_time_ms = $6, points_earned = $7, answered_at = CURRENT_TIMESTAMP
        `, [room.id, room.participant_id, questionIndex, answer, isCorrect, answerTimeMs || 0, pointsEarned]);

        // Update participant stats
        if (isCorrect) {
            await pool.query(`
                UPDATE room_participants 
                SET total_correct = total_correct + 1, 
                    current_streak = $2, 
                    max_streak = $3,
                    score = score + $4
                WHERE id = $1
            `, [room.participant_id, newStreak, maxStreak, pointsEarned]);
        } else {
            await pool.query(`
                UPDATE room_participants 
                SET total_wrong = total_wrong + 1, 
                    current_streak = 0,
                    lives = $2,
                    is_eliminated = $3
                WHERE id = $1
            `, [room.participant_id, newLives, isEliminated]);
        }

        res.json({ 
            success: true, 
            isCorrect, 
            correctAnswer, 
            pointsEarned,
            newStreak,
            newLives,
            isEliminated,
            totalScore: room.score + pointsEarned
        });

    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Next Question
app.post('/api/rooms/next', async (req, res) => {
    try {
        const { roomCode, adminName } = req.body;

        const roomResult = await pool.query(`
            SELECT cr.*, (SELECT COUNT(*) FROM room_questions WHERE room_id = cr.id) as total_questions
            FROM challenge_rooms cr
            WHERE cr.room_code = $1 AND cr.admin_name = $2
        `, [roomCode.toUpperCase(), adminName]);

        if (roomResult.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
        }

        const room = roomResult.rows[0];
        const nextIndex = room.current_question_index + 1;

        if (nextIndex >= parseInt(room.total_questions)) {
            await finishGame(room.id);
            return res.json({ success: true, finished: true });
        }

        await pool.query(`UPDATE challenge_rooms SET current_question_index = $2, question_started_at = CURRENT_TIMESTAMP WHERE id = $1`, [room.id, nextIndex]);

        res.json({ success: true, nextIndex });

    } catch (error) {
        console.error('Next question error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Centralized finish game helper - updates room status, challenge_stats, ELO
async function finishGame(roomId) {
    try {
        await pool.query(`
            UPDATE challenge_rooms SET status = 'finished', ended_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [roomId]);

        // Get participants with user_ids for stats update
        const participants = await pool.query(`
            SELECT user_id, total_correct, total_wrong, score, max_streak
            FROM room_participants WHERE room_id = $1 AND user_id IS NOT NULL
            ORDER BY score DESC
        `, [roomId]);

        // Update challenge_stats for each registered user
        for (const p of participants.rows) {
            const isWinner = p === participants.rows[0] && participants.rows.length > 1;
            const isPerfect = p.total_wrong === 0 && p.total_correct > 0;

            await pool.query(`
                INSERT INTO challenge_stats (user_id, total_games, total_wins, total_points, highest_streak)
                VALUES ($1, 1, $2, $3, $4)
                ON CONFLICT (user_id) DO UPDATE SET
                    total_games = challenge_stats.total_games + 1,
                    total_wins = challenge_stats.total_wins + $2,
                    total_points = challenge_stats.total_points + $3,
                    highest_streak = GREATEST(challenge_stats.highest_streak, $4),
                    updated_at = CURRENT_TIMESTAMP
            `, [p.user_id, isWinner ? 1 : 0, p.score || 0, p.max_streak || 0]);

            // Award badges
            if (isWinner) await awardBadge(p.user_id, 'first_win');
            if (isPerfect) await awardBadge(p.user_id, 'perfect_game');

            // Games played badges
            const stats = await pool.query('SELECT total_games FROM challenge_stats WHERE user_id = $1', [p.user_id]);
            const totalGames = stats.rows[0]?.total_games || 0;
            if (totalGames >= 10) await awardBadge(p.user_id, 'games_10');
            if (totalGames >= 50) await awardBadge(p.user_id, 'games_50');
            if (totalGames >= 100) await awardBadge(p.user_id, 'games_100');
        }

        // Update ELO for top 2 players if both are registered users
        if (participants.rows.length >= 2 && participants.rows[0].user_id && participants.rows[1].user_id) {
            await updateEloRatings(participants.rows[0].user_id, participants.rows[1].user_id);
        }
    } catch (error) {
        console.error('Finish game error:', error);
    }
}

// End Game Early
app.post('/api/rooms/end', async (req, res) => {
    try {
        const { roomCode, adminName } = req.body;

        const roomResult = await pool.query(`
            SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
        `, [roomCode.toUpperCase(), adminName]);

        if (roomResult.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
        }

        await finishGame(roomResult.rows[0].id);

        res.json({ success: true });

    } catch (error) {
        console.error('End game error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get Results
app.get('/api/rooms/:code/results', async (req, res) => {
    try {
        const roomCode = req.params.code.toUpperCase();

        const roomResult = await pool.query(`SELECT * FROM challenge_rooms WHERE room_code = $1`, [roomCode]);

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        const room = roomResult.rows[0];

        const participantsResult = await pool.query(`
            SELECT id, username, is_admin, total_correct, total_wrong, score, max_streak,
                   CASE WHEN (total_correct + total_wrong) > 0 
                        THEN ROUND(total_correct * 100.0 / (total_correct + total_wrong), 1)
                        ELSE 0 END as percentage
            FROM room_participants WHERE room_id = $1
            ORDER BY score DESC, total_correct DESC, total_wrong ASC
        `, [room.id]);

        const answersResult = await pool.query(`
            SELECT ra.question_index, ra.participant_id, ra.selected_answer, ra.is_correct,
                   rp.username, q.category, q.question_text, q.correct_answer
            FROM room_answers ra
            JOIN room_participants rp ON ra.participant_id = rp.id
            JOIN room_questions rq ON rq.room_id = ra.room_id AND rq.question_index = ra.question_index
            JOIN questions q ON rq.question_id = q.id
            WHERE ra.room_id = $1
            ORDER BY ra.question_index, rp.username
        `, [room.id]);

        const categoryStats = {};
        for (const answer of answersResult.rows) {
            if (!categoryStats[answer.username]) categoryStats[answer.username] = {};
            if (!categoryStats[answer.username][answer.category]) {
                categoryStats[answer.username][answer.category] = { correct: 0, total: 0 };
            }
            categoryStats[answer.username][answer.category].total++;
            if (answer.is_correct) categoryStats[answer.username][answer.category].correct++;
        }

        res.json({ success: true, room, participants: participantsResult.rows, answers: answersResult.rows, categoryStats });

    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get User History
app.get('/api/rooms/history/:username', async (req, res) => {
    try {
        const username = decodeURIComponent(req.params.username);

        const roomsResult = await pool.query(`
            SELECT cr.*, rp.total_correct, rp.total_wrong, rp.is_admin,
                   (SELECT COUNT(*) FROM room_participants WHERE room_id = cr.id) as participant_count
            FROM challenge_rooms cr
            JOIN room_participants rp ON rp.room_id = cr.id
            WHERE rp.username = $1
            ORDER BY cr.created_at DESC
            LIMIT 50
        `, [username]);

        res.json({ success: true, rooms: roomsResult.rows });

    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Leave Room
app.post('/api/rooms/leave', async (req, res) => {
    try {
        const { roomCode, username } = req.body;

        const roomResult = await pool.query(`
            SELECT cr.id, cr.admin_name, cr.status FROM challenge_rooms cr WHERE cr.room_code = $1
        `, [roomCode.toUpperCase()]);

        if (roomResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        const room = roomResult.rows[0];

        if (room.admin_name === username && room.status === 'waiting') {
            await pool.query('DELETE FROM challenge_rooms WHERE id = $1', [room.id]);
        } else {
            await pool.query(`DELETE FROM room_participants WHERE room_id = $1 AND username = $2`, [room.id, username]);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Leave room error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== FRIENDSHIP SYSTEM ====================

// Send friend request
app.post('/api/friends/request', async (req, res) => {
    try {
        const { userId, friendUsername } = req.body;
        
        if (!userId || !friendUsername) {
            return res.status(400).json({ success: false, error: 'Eksik bilgi' });
        }

        // Find friend by username
        const friendResult = await pool.query('SELECT id FROM users WHERE username = $1', [friendUsername]);
        if (friendResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
        }
        const friendId = friendResult.rows[0].id;

        if (userId === friendId) {
            return res.status(400).json({ success: false, error: 'Kendinizi arkadaş olarak ekleyemezsiniz' });
        }

        // Check if already friends or pending
        const existing = await pool.query(
            'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [userId, friendId]
        );
        
        if (existing.rows.length > 0) {
            const status = existing.rows[0].status;
            if (status === 'accepted') {
                return res.status(400).json({ success: false, error: 'Zaten arkadaşsınız' });
            }
            return res.status(400).json({ success: false, error: 'Zaten bekleyen bir istek var' });
        }

        await pool.query(
            'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
            [userId, friendId, 'pending']
        );

        res.json({ success: true, message: 'Arkadaşlık isteği gönderildi' });
    } catch (error) {
        console.error('Friend request error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Accept/reject friend request
app.post('/api/friends/respond', async (req, res) => {
    try {
        const { userId, friendId, accept } = req.body;

        if (accept) {
            await pool.query(
                'UPDATE friendships SET status = $1, accepted_at = NOW() WHERE user_id = $2 AND friend_id = $3',
                ['accepted', friendId, userId]
            );
        } else {
            await pool.query(
                'DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2',
                [friendId, userId]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Friend respond error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get friends list
app.get('/api/friends/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(`
            SELECT u.id, u.username, f.status, f.created_at,
                   CASE WHEN f.user_id = $1 THEN 'sent' ELSE 'received' END as direction
            FROM friendships f
            JOIN users u ON (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END) = u.id
            WHERE f.user_id = $1 OR f.friend_id = $1
            ORDER BY f.status DESC, f.created_at DESC
        `, [userId]);

        const friends = result.rows.filter(r => r.status === 'accepted');
        const pending = result.rows.filter(r => r.status === 'pending' && r.direction === 'received');
        const sent = result.rows.filter(r => r.status === 'pending' && r.direction === 'sent');

        res.json({ success: true, friends, pending, sent });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Remove friend
app.delete('/api/friends/:userId/:friendId', async (req, res) => {
    try {
        const { userId, friendId } = req.params;

        await pool.query(
            'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
            [userId, friendId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== BADGE SYSTEM ====================

const BADGES = {
    'first_win': { name: 'İlk Galibiyet', icon: '🏆', description: 'İlk challenge kazanımı' },
    'streak_5': { name: '5 Streak', icon: '🔥', description: '5 üst üste doğru cevap' },
    'streak_10': { name: '10 Streak', icon: '💥', description: '10 üst üste doğru cevap' },
    'streak_20': { name: 'Streak Ustası', icon: '⚡', description: '20 üst üste doğru cevap' },
    'games_10': { name: 'Deneyimli', icon: '🎮', description: '10 oyun tamamlandı' },
    'games_50': { name: 'Veteran', icon: '🎖️', description: '50 oyun tamamlandı' },
    'games_100': { name: 'Efsane', icon: '👑', description: '100 oyun tamamlandı' },
    'perfect_game': { name: 'Mükemmel Oyun', icon: '💎', description: 'Hiç hata yapmadan oyun bitirme' },
    'speed_demon': { name: 'Hız Şeytanı', icon: '⚡', description: '5 saniyede doğru cevap' },
    'social_butterfly': { name: 'Sosyal Kelebek', icon: '🦋', description: '10 arkadaş edinme' },
    'yds_master': { name: 'YDS Ustası', icon: '📚', description: 'Tam YDS simülasyonu kazanma' },
    'elo_1200': { name: 'Bronz', icon: '🥉', description: '1200 ELO puanına ulaşma' },
    'elo_1500': { name: 'Gümüş', icon: '🥈', description: '1500 ELO puanına ulaşma' },
    'elo_1800': { name: 'Altın', icon: '🥇', description: '1800 ELO puanına ulaşma' }
};

// Get user badges
app.get('/api/badges/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await pool.query(
            'SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at DESC',
            [userId]
        );

        const earnedBadges = result.rows.map(r => ({
            ...BADGES[r.badge_id],
            id: r.badge_id,
            earned_at: r.earned_at
        }));

        const allBadges = Object.entries(BADGES).map(([id, badge]) => ({
            ...badge,
            id,
            earned: result.rows.some(r => r.badge_id === id)
        }));

        res.json({ success: true, earnedBadges, allBadges });
    } catch (error) {
        console.error('Get badges error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Award badge (internal function)
async function awardBadge(userId, badgeId) {
    try {
        await pool.query(
            'INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, badgeId]
        );
        return true;
    } catch (error) {
        console.error('Award badge error:', error);
        return false;
    }
}

// ==================== CHALLENGE STATS ====================

// Get challenge stats
app.get('/api/challenge-stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        let stats = await pool.query('SELECT * FROM challenge_stats WHERE user_id = $1', [userId]);
        
        if (stats.rows.length === 0) {
            await pool.query(
                'INSERT INTO challenge_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
                [userId]
            );
            stats = await pool.query('SELECT * FROM challenge_stats WHERE user_id = $1', [userId]);
        }

        // Get leaderboard position
        const leaderboard = await pool.query(
            'SELECT user_id, elo_rating, RANK() OVER (ORDER BY elo_rating DESC) as rank FROM challenge_stats'
        );
        const userRank = leaderboard.rows.find(r => r.user_id == userId)?.rank || 0;

        res.json({ success: true, stats: stats.rows[0], rank: userRank });
    } catch (error) {
        console.error('Get challenge stats error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT cs.*, u.username,
                   RANK() OVER (ORDER BY cs.elo_rating DESC) as rank
            FROM challenge_stats cs
            JOIN users u ON cs.user_id = u.id
            ORDER BY cs.elo_rating DESC
            LIMIT 100
        `);

        res.json({ success: true, leaderboard: result.rows });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== ROOM CHAT ====================

// Send message/emoji
app.post('/api/rooms/:roomCode/chat', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { username, message, emoji, messageType } = req.body;

        const room = await pool.query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
        if (room.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        await pool.query(
            'INSERT INTO room_messages (room_id, username, message, emoji, message_type) VALUES ($1, $2, $3, $4, $5)',
            [room.rows[0].id, username, message || null, emoji || null, messageType || 'text']
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Send chat error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// Get chat messages
app.get('/api/rooms/:roomCode/chat', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { since } = req.query;

        const room = await pool.query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
        if (room.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        let query = 'SELECT * FROM room_messages WHERE room_id = $1';
        const params = [room.rows[0].id];
        
        if (since) {
            query += ' AND created_at > $2';
            params.push(since);
        }
        
        query += ' ORDER BY created_at DESC LIMIT 50';

        const result = await pool.query(query, params);

        res.json({ success: true, messages: result.rows.reverse() });
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== ENHANCED ROOM CREATION ====================

// Update room settings
app.put('/api/rooms/:roomCode/settings', async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { timeLimit, enableLives, maxLives, gameMode, adminName, scoringMode, shuffleQuestions } = req.body;

        const room = await pool.query('SELECT * FROM challenge_rooms WHERE room_code = $1', [roomCode]);
        if (room.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
        }

        if (room.rows[0].admin_name !== adminName) {
            return res.status(403).json({ success: false, error: 'Sadece admin ayarları değiştirebilir' });
        }

        await pool.query(`
            UPDATE challenge_rooms 
            SET time_limit = COALESCE($1, time_limit),
                enable_lives = COALESCE($2, enable_lives),
                max_lives = COALESCE($3, max_lives),
                game_mode = COALESCE($4, game_mode),
                scoring_mode = COALESCE($5, scoring_mode),
                shuffle_questions = COALESCE($6, shuffle_questions)
            WHERE room_code = $7
        `, [timeLimit, enableLives, maxLives, gameMode, scoringMode, shuffleQuestions, roomCode]);

        res.json({ success: true });
    } catch (error) {
        console.error('Update room settings error:', error);
        res.status(500).json({ success: false, error: 'Sunucu hatası' });
    }
});

// ==================== SCORING SYSTEM ====================

const BASE_POINTS = 100;
const STREAK_BONUS = 10;
const MAX_SPEED_BONUS = 50;
const SPEED_BONUS_TIME = 10000; // 10 seconds for max speed bonus

function calculatePoints(isCorrect, answerTimeMs, currentStreak, scoringMode) {
    if (!isCorrect) return 0;
    
    // Normal mode: flat points per correct answer (no speed/streak bonus)
    if (scoringMode === 'normal') {
        return BASE_POINTS;
    }
    
    // Speed mode (default): base + streak bonus + speed bonus
    let points = BASE_POINTS;
    
    // Streak bonus
    points += currentStreak * STREAK_BONUS;
    
    // Speed bonus (answers under 10 seconds get bonus)
    if (answerTimeMs && answerTimeMs < SPEED_BONUS_TIME) {
        const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - answerTimeMs / SPEED_BONUS_TIME));
        points += speedBonus;
    }
    
    return points;
}

// Update ELO ratings after game
async function updateEloRatings(winnerId, loserId) {
    const K = 32;
    
    try {
        const winner = await pool.query('SELECT elo_rating FROM challenge_stats WHERE user_id = $1', [winnerId]);
        const loser = await pool.query('SELECT elo_rating FROM challenge_stats WHERE user_id = $1', [loserId]);
        
        const winnerElo = winner.rows[0]?.elo_rating || 1000;
        const loserElo = loser.rows[0]?.elo_rating || 1000;
        
        const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
        const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));
        
        const newWinnerElo = Math.round(winnerElo + K * (1 - expectedWinner));
        const newLoserElo = Math.round(loserElo + K * (0 - expectedLoser));
        
        await pool.query(
            'UPDATE challenge_stats SET elo_rating = $1, updated_at = NOW() WHERE user_id = $2',
            [newWinnerElo, winnerId]
        );
        await pool.query(
            'UPDATE challenge_stats SET elo_rating = $1, updated_at = NOW() WHERE user_id = $2',
            [Math.max(100, newLoserElo), loserId]
        );

        // Check for ELO badges
        if (newWinnerElo >= 1200) await awardBadge(winnerId, 'elo_1200');
        if (newWinnerElo >= 1500) await awardBadge(winnerId, 'elo_1500');
        if (newWinnerElo >= 1800) await awardBadge(winnerId, 'elo_1800');
        
    } catch (error) {
        console.error('Update ELO error:', error);
    }
}

// ==================== ROOM TEMPLATES ====================

const ROOM_TEMPLATES = {
    'grammar-basics': {
        name: 'Gramer Temelleri',
        categories: ['Tenses', 'Modals', 'If Clauses'],
        questionCount: 15
    },
    'advanced-grammar': {
        name: 'İleri Gramer',
        categories: ['Noun Clauses', 'Relative Clauses', 'Reductions'],
        questionCount: 20
    },
    'vocabulary-focus': {
        name: 'Kelime Odaklı',
        categories: ['Nouns', 'Adjectives & Adverbs', 'Conjunctions'],
        questionCount: 20
    },
    'quick-practice': {
        name: 'Hızlı Pratik',
        categories: ['Tenses', 'Passive'],
        questionCount: 10,
        timeLimit: 30
    }
};

app.get('/api/room-templates', (req, res) => {
    res.json({ success: true, templates: ROOM_TEMPLATES });
});

// Export for Vercel serverless
module.exports = app;
module.exports.default = app;
