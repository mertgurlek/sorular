const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
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

module.exports = app;
