const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { asyncHandler } = require('../lib/middleware');

router.post('/:userId/stats', asyncHandler(async (req, res) => {
    await userController.updateStats(req, res);
}));

router.get('/:userId/all-data', asyncHandler(async (req, res) => {
    await userController.getAllData(req, res);
}));

router.get('/:userId/unknown-words', asyncHandler(async (req, res) => {
    await userController.getUnknownWords(req, res);
}));

router.post('/:userId/unknown-words', asyncHandler(async (req, res) => {
    await userController.addUnknownWord(req, res);
}));

router.delete('/:userId/unknown-words/:word', asyncHandler(async (req, res) => {
    await userController.removeUnknownWord(req, res);
}));

router.get('/:userId/answer-history', asyncHandler(async (req, res) => {
    await userController.getAnswerHistory(req, res);
}));

router.post('/:userId/answer-history', asyncHandler(async (req, res) => {
    await userController.saveAnswerHistory(req, res);
}));

router.get('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.getFavorites(req, res);
}));

router.post('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.addFavorite(req, res);
}));

router.delete('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.removeFavorite(req, res);
}));

router.get('/:userId/wrong-answers', asyncHandler(async (req, res) => {
    await userController.getWrongAnswers(req, res);
}));

router.post('/:userId/wrong-answers', asyncHandler(async (req, res) => {
    await userController.saveWrongAnswer(req, res);
}));

router.get('/:userId/daily-stats', asyncHandler(async (req, res) => {
    await userController.getDailyStats(req, res);
}));

router.post('/:userId/daily-stats', asyncHandler(async (req, res) => {
    await userController.updateDailyStats(req, res);
}));

module.exports = router;
