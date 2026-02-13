const gptService = require('../services/gptService');
const { sendSuccess, sendError } = require('../middleware');

class GPTController {
    async saveExplanation(req, res) {
        const { questionHash, questionText, explanation } = req.body;
        
        if (!questionHash || !explanation) {
            return sendError(res, 'questionHash ve explanation gerekli', 400);
        }
        
        await gptService.saveExplanation(questionHash, questionText, explanation);
        sendSuccess(res, { message: 'Açıklama kaydedildi' });
    }
    
    async getExplanation(req, res) {
        const { hash } = req.params;
        const explanation = await gptService.getExplanation(hash);
        
        if (!explanation) {
            return sendError(res, 'Açıklama bulunamadı', 404);
        }
        
        sendSuccess(res, explanation);
    }
    
    async generateExplanation(req, res) {
        const { prompt, model } = req.body;
        
        if (!prompt) {
            return sendError(res, 'prompt gerekli', 400);
        }
        
        const explanation = await gptService.generateExplanation(prompt, model);
        sendSuccess(res, { explanation });
    }
}

module.exports = new GPTController();
