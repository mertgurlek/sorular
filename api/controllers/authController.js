const authService = require('../services/authService');
const { validateRegistration, validateLogin } = require('../lib/validators');
const { sendSuccess, sendError } = require('../lib/middleware');

class AuthController {
    async register(req, res) {
        if (!validateRegistration(req, res)) {
            return;
        }
        
        const { username, email, password } = req.body;
        
        const exists = await authService.checkUserExists(username, email);
        if (exists) {
            return sendError(res, 'Bu kullanıcı adı veya email zaten kayıtlı', 400);
        }
        
        const user = await authService.createUser(username, email, password);
        
        sendSuccess(res, {
            message: 'Kayıt başarılı!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        }, 201);
    }
    
    async login(req, res) {
        if (!validateLogin(req, res)) {
            return;
        }
        
        const { username, password } = req.body;
        
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
        
        sendSuccess(res, {
            message: 'Giriş başarılı!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                stats: userData.stats
            }
        });
    }
    
    async getUser(req, res) {
        const { userId } = req.params;
        
        const userData = await authService.getUserWithStats(userId);
        if (!userData || !userData.user) {
            return sendError(res, 'Kullanıcı bulunamadı', 404);
        }
        
        sendSuccess(res, userData);
    }
}

module.exports = new AuthController();
