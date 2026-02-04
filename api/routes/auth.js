const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { asyncHandler } = require('../lib/middleware');

router.post('/register', asyncHandler(async (req, res) => {
    await authController.register(req, res);
}));

router.post('/login', asyncHandler(async (req, res) => {
    await authController.login(req, res);
}));

router.get('/user/:userId', asyncHandler(async (req, res) => {
    await authController.getUser(req, res);
}));

module.exports = router;
