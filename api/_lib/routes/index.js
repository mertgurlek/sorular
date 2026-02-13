const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const questionRoutes = require('./questions');
const gptRoutes = require('./gpt');
const challengeRoutes = require('./challenge');
const friendsRoutes = require('./friends');
const badgesRoutes = require('./badges');
const feedbackRoutes = require('./feedback');
const leaderboardRoutes = require('./leaderboard');
const { asyncHandler } = require('../middleware');
const questionController = require('../controllers/questionController');

// Auth routes (register, login, get user profile)
router.use('/', authRoutes);

// User data routes (stats, unknown words, answer history, favorites, wrong answers, daily stats, learned words)
router.use('/user', userRoutes);

// Question routes
router.use('/questions', questionRoutes);

// GPT routes
router.use('/', gptRoutes);

// Challenge room routes
router.use('/rooms', challengeRoutes);

// Friends routes
router.use('/friends', friendsRoutes);

// Badges routes
router.use('/badges', badgesRoutes);

// Question feedback & ratings routes
router.use('/questions', feedbackRoutes);

// Leaderboard & challenge stats routes
router.use('/', leaderboardRoutes);

// Categories (top-level shortcut)
router.get('/categories', asyncHandler(async (req, res) => {
    await questionController.getCategories(req, res);
}));

// Health check
router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
