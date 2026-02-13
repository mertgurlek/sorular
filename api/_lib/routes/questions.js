const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { asyncHandler } = require('../middleware');

router.get('/categories', asyncHandler(async (req, res) => {
    await questionController.getCategories(req, res);
}));

router.get('/', asyncHandler(async (req, res) => {
    await questionController.getQuestions(req, res);
}));

router.get('/:id', asyncHandler(async (req, res) => {
    await questionController.getQuestionById(req, res);
}));

// Quiz soru seçimi — sunucu tarafında shuffle + limit
router.post('/quiz', asyncHandler(async (req, res) => {
    await questionController.getQuestionsForQuiz(req, res);
}));

// Sınav modu — YDS dağılımlı soru seçimi
router.post('/exam', asyncHandler(async (req, res) => {
    await questionController.getQuestionsForExam(req, res);
}));

module.exports = router;
