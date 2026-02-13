const authService = require('../services/authService');
const { generateToken } = require('../authMiddleware');
const { sendSuccess, sendError } = require('../middleware');

class AuthController {
    async register(req, res) {
        const { username, email, password } = req.body;
        
        if (!username || !email || !password) {
            return sendError(res, 'Tüm alanları doldurun', 400);
        }
        
        if (typeof username !== 'string' || username.length < 3 || username.length > 50) {
            return sendError(res, 'Kullanıcı adı 3-50 karakter arası olmalı', 400);
        }
        
        if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
            return sendError(res, 'Şifre 6-128 karakter arası olmalı', 400);
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof email !== 'string' || !emailRegex.test(email) || email.length > 255) {
            return sendError(res, 'Geçerli bir email adresi girin', 400);
        }
        
        const exists = await authService.checkUserExists(username, email);
        if (exists) {
            return sendError(res, 'Bu kullanıcı adı veya email zaten kayıtlı', 400);
        }
        
        const user = await authService.createUser(username, email, password);
        const token = generateToken(user);
        
        res.status(201).json({
            message: 'Kayıt başarılı!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    }
    
    async login(req, res) {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return sendError(res, 'Kullanıcı adı ve şifre gerekli', 400);
        }
        
        const user = await authService.findUserByUsername(username);
        if (!user) {
            return sendError(res, 'Kullanıcı bulunamadı', 401);
        }
        
        const isMatch = await authService.verifyPassword(password, user.password_hash);
        if (!isMatch) {
            return sendError(res, 'Şifre yanlış', 401);
        }
        
        await authService.updateLastLogin(user.id);
        
        const userData = await authService.getUserWithStats(user.id);
        const token = generateToken(user);
        
        res.json({
            message: 'Giriş başarılı!',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                stats: userData ? userData.stats : null
            }
        });
    }
    
    async getUser(req, res) {
        const { userId } = req.params;
        
        const userData = await authService.getUserWithStats(userId);
        if (!userData || !userData.user) {
            return sendError(res, 'Kullanıcı bulunamadı', 404);
        }
        
        res.json({
            user: userData.user,
            stats: userData.stats
        });
    }
}

module.exports = new AuthController();
