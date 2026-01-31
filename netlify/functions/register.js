const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { username, email, password } = JSON.parse(event.body || '{}');
        
        if (!username || !email || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Tüm alanları doldurun' })
            };
        }
        
        if (password.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Şifre en az 6 karakter olmalı' })
            };
        }
        
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existingUser.rows.length > 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Bu kullanıcı adı veya email zaten kayıtlı' })
            };
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
        
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                message: 'Kayıt başarılı!',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            })
        };
    } catch (error) {
        console.error('Register error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Sunucu hatası' })
        };
    }
};
