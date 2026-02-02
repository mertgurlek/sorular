const bcrypt = require('bcryptjs');
const { query, transaction } = require('../lib/db');
const { asyncHandler, sendSuccess, sendError, validateMethod, validateRequired } = require('../lib/middleware');

module.exports = asyncHandler(async (req, res) => {
    if (!validateMethod(req, res, ['POST'])) return;
    
    const { username, email, password } = req.body;
    const validation = validateRequired({ username, email, password }, ['username', 'email', 'password']);
    if (!validation.valid) {
        return sendError(res, 'Tüm alanları doldurun', 400);
    }
    
    if (password.length < 6) {
        return sendError(res, 'Şifre en az 6 karakter olmalı', 400);
    }
    
    const existingUser = await query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
    );
    
    if (existingUser.rows.length > 0) {
        return sendError(res, 'Bu kullanıcı adı veya email zaten kayıtlı', 400);
    }
    
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    const result = await query(
        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
        [username, email, passwordHash]
    );
    
    const user = result.rows[0];
    await query('INSERT INTO user_stats (user_id) VALUES ($1)', [user.id]);
    
    sendSuccess(res, {
        message: 'Kayıt başarılı!',
        user: {
            id: user.id,
            username: user.username,
            email: user.email
        }
    }, 201);
});
