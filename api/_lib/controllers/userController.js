const userService = require('../services/userService');
const { sendSuccess, sendError } = require('../middleware');

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
    
    // --- UNKNOWN WORDS ---
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
        sendSuccess(res);
    }
    
    async removeUnknownWord(req, res) {
        const { userId, word } = req.params;
        await userService.removeUnknownWord(userId, word);
        sendSuccess(res);
    }
    
    async clearUnknownWords(req, res) {
        const { userId } = req.params;
        await userService.clearUnknownWords(userId);
        sendSuccess(res);
    }
    
    async syncUnknownWords(req, res) {
        const { userId } = req.params;
        const { words } = req.body;
        await userService.syncUnknownWords(userId, words);
        sendSuccess(res);
    }
    
    // --- ANSWER HISTORY ---
    async getAnswerHistory(req, res) {
        const { userId } = req.params;
        const history = await userService.getAnswerHistory(userId);
        sendSuccess(res, { history });
    }
    
    async saveAnswerHistory(req, res) {
        const { userId } = req.params;
        await userService.saveAnswerHistory(userId, req.body);
        sendSuccess(res);
    }
    
    async clearAnswerHistory(req, res) {
        const { userId } = req.params;
        await userService.clearAnswerHistory(userId);
        sendSuccess(res);
    }
    
    // --- FAVORITES ---
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
        sendSuccess(res);
    }
    
    async removeFavorite(req, res) {
        const { userId } = req.params;
        const { questionText } = req.body;
        
        await userService.removeFavorite(userId, questionText);
        sendSuccess(res);
    }
    
    async clearFavorites(req, res) {
        const { userId } = req.params;
        await userService.clearFavorites(userId);
        sendSuccess(res);
    }
    
    // --- WRONG ANSWERS ---
    async getWrongAnswers(req, res) {
        const { userId } = req.params;
        const wrongAnswers = await userService.getWrongAnswers(userId);
        sendSuccess(res, { wrongAnswers });
    }
    
    async saveWrongAnswer(req, res) {
        const { userId } = req.params;
        await userService.saveWrongAnswer(userId, req.body);
        sendSuccess(res);
    }
    
    async removeWrongAnswer(req, res) {
        const { userId, id } = req.params;
        await userService.removeWrongAnswer(userId, id);
        sendSuccess(res);
    }
    
    async clearWrongAnswers(req, res) {
        const { userId } = req.params;
        await userService.clearWrongAnswers(userId);
        sendSuccess(res);
    }
    
    // --- DAILY STATS ---
    async getDailyStats(req, res) {
        const { userId } = req.params;
        const dailyStats = await userService.getDailyStats(userId);
        sendSuccess(res, { dailyStats });
    }
    
    async updateDailyStats(req, res) {
        const { userId } = req.params;
        await userService.updateDailyStats(userId, req.body);
        sendSuccess(res);
    }
    
    // --- LEARNED WORDS ---
    async getLearnedWords(req, res) {
        const { userId } = req.params;
        const learnedWords = await userService.getLearnedWords(userId);
        sendSuccess(res, { learnedWords });
    }
    
    async addLearnedWord(req, res) {
        const { userId } = req.params;
        const { expression } = req.body;
        await userService.addLearnedWord(userId, expression);
        sendSuccess(res);
    }
    
    async removeLearnedWord(req, res) {
        const { userId, expression } = req.params;
        await userService.removeLearnedWord(userId, expression);
        sendSuccess(res);
    }
}

module.exports = new UserController();
