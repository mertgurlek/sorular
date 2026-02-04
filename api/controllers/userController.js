const userService = require('../services/userService');
const { sendSuccess, sendError } = require('../lib/middleware');

class UserController {
    async updateStats(req, res) {
        const { userId } = req.params;
        const { totalAnswered, totalCorrect, totalWrong, streakDays } = req.body;
        
        await userService.updateStats(userId, {
            totalAnswered,
            totalCorrect,
            totalWrong,
            streakDays
        });
        
        sendSuccess(res, { message: 'İstatistikler güncellendi' });
    }
    
    async getAllData(req, res) {
        const { userId } = req.params;
        const data = await userService.getAllUserData(userId);
        sendSuccess(res, data);
    }
    
    async getUnknownWords(req, res) {
        const { userId } = req.params;
        const words = await userService.getUnknownWords(userId);
        sendSuccess(res, { words });
    }
    
    async addUnknownWord(req, res) {
        const { userId } = req.params;
        const { word } = req.body;
        
        if (!word) {
            return sendError(res, 'Kelime gerekli', 400);
        }
        
        await userService.addUnknownWord(userId, word);
        sendSuccess(res, { message: 'Kelime eklendi' });
    }
    
    async removeUnknownWord(req, res) {
        const { userId, word } = req.params;
        await userService.removeUnknownWord(userId, word);
        sendSuccess(res, { message: 'Kelime kaldırıldı' });
    }
    
    async getAnswerHistory(req, res) {
        const { userId } = req.params;
        const history = await userService.getAnswerHistory(userId);
        sendSuccess(res, { history });
    }
    
    async saveAnswerHistory(req, res) {
        const { userId } = req.params;
        await userService.saveAnswerHistory(userId, req.body);
        sendSuccess(res, { message: 'Cevap geçmişi kaydedildi' });
    }
    
    async getFavorites(req, res) {
        const { userId } = req.params;
        const favorites = await userService.getFavorites(userId);
        sendSuccess(res, { favorites });
    }
    
    async addFavorite(req, res) {
        const { userId } = req.params;
        const { question } = req.body;
        
        if (!question) {
            return sendError(res, 'Soru gerekli', 400);
        }
        
        await userService.addFavorite(userId, question);
        sendSuccess(res, { message: 'Favorilere eklendi' });
    }
    
    async removeFavorite(req, res) {
        const { userId } = req.params;
        const { questionText } = req.body;
        
        if (!questionText) {
            return sendError(res, 'Soru metni gerekli', 400);
        }
        
        await userService.removeFavorite(userId, questionText);
        sendSuccess(res, { message: 'Favorilerden kaldırıldı' });
    }
    
    async getWrongAnswers(req, res) {
        const { userId } = req.params;
        const wrongAnswers = await userService.getWrongAnswers(userId);
        sendSuccess(res, { wrongAnswers });
    }
    
    async saveWrongAnswer(req, res) {
        const { userId } = req.params;
        await userService.saveWrongAnswer(userId, req.body);
        sendSuccess(res, { message: 'Yanlış cevap kaydedildi' });
    }
    
    async getDailyStats(req, res) {
        const { userId } = req.params;
        const dailyStats = await userService.getDailyStats(userId);
        sendSuccess(res, { dailyStats });
    }
    
    async updateDailyStats(req, res) {
        const { userId } = req.params;
        await userService.updateDailyStats(userId, req.body);
        sendSuccess(res, { message: 'Günlük istatistikler güncellendi' });
    }
}

module.exports = new UserController();
