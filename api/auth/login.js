const bcrypt = require('bcryptjs');
const { query } = require('../lib/db');
const { asyncHandler, sendSuccess, sendError, validateMethod, validateRequired } = require('../lib/middleware');

module.exports = asyncHandler(async (req, res) => {
    if (!validateMethod(req, res, ['POST'])) return;
    
    const { username, password } = req.body;
    const validation = validateRequired({ username, password }, ['username', 'password']);
    if (!validation.valid) {
        return sendError(res, 'Kullanıcı adı ve şifre gerekli', 400);
    }
    
    const result = await query(
        'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
        [username]
    );
    
    if (result.rows.length === 0) {
        return sendError(res, 'Kullanıcı bulunamadı', 401);
    }
    
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
        return sendError(res, 'Şifre yanlış', 401);
    }
    
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    const statsResult = await query('SELECT * FROM user_stats WHERE user_id = $1', [user.id]);
    
    sendSuccess(res, {
        message: 'Giriş başarılı!',
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            stats: statsResult.rows[0] || null
        }
    });
});
