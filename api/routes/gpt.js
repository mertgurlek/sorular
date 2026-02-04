const express = require('express');
const router = express.Router();
const gptController = require('../controllers/gptController');
const { asyncHandler } = require('../lib/middleware');

router.post('/gpt-explanation', asyncHandler(async (req, res) => {
    await gptController.saveExplanation(req, res);
}));

router.get('/gpt-explanation/:hash', asyncHandler(async (req, res) => {
    await gptController.getExplanation(req, res);
}));

router.post('/openai-explain', asyncHandler(async (req, res) => {
    await gptController.generateExplanation(req, res);
}));

module.exports = router;
