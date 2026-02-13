const questionService = require('../services/questionService');
const { sendSuccess, sendError } = require('../middleware');

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
    
    // Quiz için sunucu tarafında soru seçimi
    async getQuestionsForQuiz(req, res) {
        const { category, limit, shuffle } = req.body;
        const questions = await questionService.getQuestionsForQuiz({
            category: category || 'all',
            limit: limit || 'all',
            shuffle: shuffle !== false
        });
        sendSuccess(res, { questions });
    }
    
    // Sınav modu için YDS dağılımlı soru seçimi
    async getQuestionsForExam(req, res) {
        const { examSize, distribution } = req.body;
        
        if (!distribution || typeof distribution !== 'object') {
            return sendError(res, 'Soru dağılımı gerekli', 400);
        }
        
        const questions = await questionService.getQuestionsForExam(examSize, distribution);
        sendSuccess(res, { questions });
    }
}

module.exports = new QuestionController();
