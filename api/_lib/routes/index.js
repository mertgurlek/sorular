const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./users');
const questionRoutes = require('./questions');
const gptRoutes = require('./gpt');
const questionController = require('../controllers/questionController');
const { asyncHandler } = require('../lib/middleware');

router.use('/', authRoutes);
router.use('/user', userRoutes);
router.use('/questions', questionRoutes);
router.use('/', gptRoutes);

router.get('/categories', asyncHandler(async (req, res) => {
    await questionController.getCategories(req, res);
}));

router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
