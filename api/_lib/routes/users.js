const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { asyncHandler } = require('../middleware');

// Stats
router.post('/:userId/stats', asyncHandler(async (req, res) => {
    await userController.updateStats(req, res);
}));

// All data
router.get('/:userId/all-data', asyncHandler(async (req, res) => {
    await userController.getAllData(req, res);
}));

// Unknown words
router.get('/:userId/unknown-words', asyncHandler(async (req, res) => {
    await userController.getUnknownWords(req, res);
}));

router.post('/:userId/unknown-words', asyncHandler(async (req, res) => {
    await userController.addUnknownWord(req, res);
}));

router.delete('/:userId/unknown-words/:word', asyncHandler(async (req, res) => {
    await userController.removeUnknownWord(req, res);
}));

router.delete('/:userId/unknown-words', asyncHandler(async (req, res) => {
    await userController.clearUnknownWords(req, res);
}));

router.post('/:userId/unknown-words/sync', asyncHandler(async (req, res) => {
    await userController.syncUnknownWords(req, res);
}));

// Answer history
router.get('/:userId/answer-history', asyncHandler(async (req, res) => {
    await userController.getAnswerHistory(req, res);
}));

router.post('/:userId/answer-history', asyncHandler(async (req, res) => {
    await userController.saveAnswerHistory(req, res);
}));

router.delete('/:userId/answer-history', asyncHandler(async (req, res) => {
    await userController.clearAnswerHistory(req, res);
}));

// Favorites
router.get('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.getFavorites(req, res);
}));

router.post('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.addFavorite(req, res);
}));

router.delete('/:userId/favorites', asyncHandler(async (req, res) => {
    await userController.removeFavorite(req, res);
}));

router.delete('/:userId/favorites/all', asyncHandler(async (req, res) => {
    await userController.clearFavorites(req, res);
}));

// Wrong answers
router.get('/:userId/wrong-answers', asyncHandler(async (req, res) => {
    await userController.getWrongAnswers(req, res);
}));

router.post('/:userId/wrong-answers', asyncHandler(async (req, res) => {
    await userController.saveWrongAnswer(req, res);
}));

router.delete('/:userId/wrong-answers/:id', asyncHandler(async (req, res) => {
    await userController.removeWrongAnswer(req, res);
}));

router.delete('/:userId/wrong-answers', asyncHandler(async (req, res) => {
    await userController.clearWrongAnswers(req, res);
}));

// Daily stats
router.get('/:userId/daily-stats', asyncHandler(async (req, res) => {
    await userController.getDailyStats(req, res);
}));

router.post('/:userId/daily-stats', asyncHandler(async (req, res) => {
    await userController.updateDailyStats(req, res);
}));

// Learned words
router.get('/:userId/learned-words', asyncHandler(async (req, res) => {
    await userController.getLearnedWords(req, res);
}));

router.post('/:userId/learned-words', asyncHandler(async (req, res) => {
    await userController.addLearnedWord(req, res);
}));

router.delete('/:userId/learned-words/:expression', asyncHandler(async (req, res) => {
    await userController.removeLearnedWord(req, res);
}));

module.exports = router;
