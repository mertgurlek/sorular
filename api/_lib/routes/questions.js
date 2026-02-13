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

module.exports = router;
