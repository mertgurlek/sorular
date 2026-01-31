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
        const { username, password } = JSON.parse(event.body || '{}');
        
        if (!username || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Kullanıcı adı ve şifre gerekli' })
            };
        }
        
        const result = await pool.query(
            'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Kullanıcı bulunamadı' })
            };
        }
        
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Şifre yanlış' })
            };
        }
        
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        const statsResult = await pool.query(
            'SELECT * FROM user_stats WHERE user_id = $1',
            [user.id]
        );
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Giriş başarılı!',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    stats: statsResult.rows[0] || null
                }
            })
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Sunucu hatası' })
        };
    }
};
