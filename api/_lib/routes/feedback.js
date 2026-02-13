const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { asyncHandler } = require('../middleware');
const { optionalAuth } = require('../authMiddleware');

// Submit feedback for a question
router.post('/feedback', optionalAuth, asyncHandler(async (req, res) => {
    const { questionHash, feedbackType, comment, username } = req.body;
    
    if (!questionHash || !feedbackType) {
        return res.status(400).json({ success: false, error: 'questionHash ve feedbackType gerekli' });
    }
    
    if (typeof questionHash !== 'string' || questionHash.length > 100) {
        return res.status(400).json({ success: false, error: 'Geçersiz questionHash' });
    }
    
    if (comment && (typeof comment !== 'string' || comment.length > 500)) {
        return res.status(400).json({ success: false, error: 'Yorum en fazla 500 karakter olabilir' });
    }
    
    const validTypes = ['wrong_question', 'wrong_answer', 'low_quality', 'wrong_category', 'other'];
    if (!validTypes.includes(feedbackType)) {
        return res.status(400).json({ success: false, error: 'Geçersiz feedback türü' });
    }
    
    const userId = req.user ? req.user.id : null;
    const uname = req.user ? req.user.username : (username || 'Misafir');
    
    await query(`
        INSERT INTO question_feedback (question_hash, user_id, username, feedback_type, comment)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (question_hash, user_id, feedback_type) DO UPDATE SET comment = $5, created_at = CURRENT_TIMESTAMP
    `, [questionHash, userId, uname, feedbackType, comment || null]);
    
    res.json({ success: true, message: 'Geri bildirim kaydedildi' });
}));

// Rate a question (1-5 stars)
router.post('/rate', optionalAuth, asyncHandler(async (req, res) => {
    const { questionHash, rating, username } = req.body;
    
    if (!questionHash || typeof questionHash !== 'string' || questionHash.length > 100) {
        return res.status(400).json({ success: false, error: 'Geçersiz questionHash' });
    }
    
    if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: '1-5 arası tam sayı rating gerekli' });
    }
    
    const userId = req.user ? req.user.id : null;
    const uname = req.user ? req.user.username : (username || 'Misafir');
    
    await query(`
        INSERT INTO question_ratings (question_hash, user_id, username, rating)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (question_hash, COALESCE(user_id, 0), COALESCE(username, ''))
        DO UPDATE SET rating = $4, created_at = CURRENT_TIMESTAMP
    `, [questionHash, userId, uname, rating]);
    
    const avgResult = await query(`
        SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as total_ratings
        FROM question_ratings WHERE question_hash = $1
    `, [questionHash]);
    
    res.json({
        success: true,
        avgRating: parseFloat(avgResult.rows[0].avg_rating) || 0,
        totalRatings: parseInt(avgResult.rows[0].total_ratings) || 0
    });
}));

// Get question stats (rating + feedback count + community solve rate)
router.get('/stats/:hash', asyncHandler(async (req, res) => {
    const { hash } = req.params;
    
    const ratingResult = await query(`
        SELECT ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as total_ratings
        FROM question_ratings WHERE question_hash = $1
    `, [hash]);
    
    const feedbackResult = await query(`
        SELECT feedback_type, COUNT(*) as count
        FROM question_feedback WHERE question_hash = $1
        GROUP BY feedback_type
    `, [hash]);
    
    const feedbackCounts = {};
    feedbackResult.rows.forEach(r => { feedbackCounts[r.feedback_type] = parseInt(r.count); });
    
    const solveResult = await query(`
        SELECT 
            COUNT(*) as total_users,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_users
        FROM (
            SELECT DISTINCT ON (user_id) user_id, is_correct
            FROM user_answer_history
            WHERE question_hash = $1 AND user_id IS NOT NULL
            ORDER BY user_id, created_at ASC
        ) first_attempts
    `, [hash]);
    
    const totalUsers = parseInt(solveResult.rows[0].total_users) || 0;
    const correctUsers = parseInt(solveResult.rows[0].correct_users) || 0;
    const solveRate = totalUsers > 0 ? Math.round((correctUsers / totalUsers) * 100) : null;
    
    res.json({
        success: true,
        avgRating: parseFloat(ratingResult.rows[0].avg_rating) || 0,
        totalRatings: parseInt(ratingResult.rows[0].total_ratings) || 0,
        feedbackCounts,
        totalFeedback: Object.values(feedbackCounts).reduce((a, b) => a + b, 0),
        communityStats: {
            totalUsers,
            correctUsers,
            solveRate
        }
    });
}));

// Get user's own rating for a question
router.get('/my-rating/:hash', optionalAuth, asyncHandler(async (req, res) => {
    const { hash } = req.params;
    const userId = req.user ? req.user.id : null;
    
    if (!userId) {
        return res.json({ success: true, rating: null });
    }
    
    const result = await query(
        'SELECT rating FROM question_ratings WHERE question_hash = $1 AND user_id = $2',
        [hash, userId]
    );
    
    res.json({ success: true, rating: result.rows[0]?.rating || null });
}));

// Batch get stats for multiple questions
router.post('/stats-batch', asyncHandler(async (req, res) => {
    const { hashes } = req.body;
    
    if (!hashes || !Array.isArray(hashes) || hashes.length === 0) {
        return res.json({ success: true, stats: {} });
    }
    
    const limitedHashes = hashes.slice(0, 100);
    
    const ratingsResult = await query(`
        SELECT question_hash, ROUND(AVG(rating)::numeric, 1) as avg_rating, COUNT(*) as total_ratings
        FROM question_ratings
        WHERE question_hash = ANY($1)
        GROUP BY question_hash
    `, [limitedHashes]);
    
    const solveResult = await query(`
        SELECT question_hash,
            COUNT(*) as total_users,
            SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_users
        FROM (
            SELECT DISTINCT ON (user_id, question_hash) user_id, question_hash, is_correct
            FROM user_answer_history
            WHERE question_hash = ANY($1) AND user_id IS NOT NULL
            ORDER BY user_id, question_hash, created_at ASC
        ) first_attempts
        GROUP BY question_hash
    `, [limitedHashes]);
    
    const stats = {};
    
    ratingsResult.rows.forEach(r => {
        stats[r.question_hash] = {
            avgRating: parseFloat(r.avg_rating) || 0,
            totalRatings: parseInt(r.total_ratings) || 0
        };
    });
    
    solveResult.rows.forEach(r => {
        const total = parseInt(r.total_users) || 0;
        const correct = parseInt(r.correct_users) || 0;
        if (!stats[r.question_hash]) stats[r.question_hash] = {};
        stats[r.question_hash].solveRate = total > 0 ? Math.round((correct / total) * 100) : null;
        stats[r.question_hash].totalUsers = total;
    });
    
    res.json({ success: true, stats });
}));

module.exports = router;
