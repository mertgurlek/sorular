const questionService = require('../services/questionService');
const { sendSuccess, sendError } = require('../lib/middleware');

class QuestionController {
    async getCategories(req, res) {
        const data = await questionService.getCategories();
        sendSuccess(res, data);
    }
    
    async getQuestions(req, res) {
        const { category } = req.query;
        const questions = await questionService.getQuestions(category);
        sendSuccess(res, { questions });
    }
    
    async getQuestionById(req, res) {
        const { id } = req.params;
        const question = await questionService.getQuestionById(id);
        
        if (!question) {
            return sendError(res, 'Soru bulunamadı', 404);
        }
        
        sendSuccess(res, { question });
    }
}

module.exports = new QuestionController();
