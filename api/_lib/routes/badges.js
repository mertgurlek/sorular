const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { asyncHandler } = require('../middleware');
const { BADGES } = require('../services/challengeService');

// Get user badges
router.get('/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const result = await query(
        'SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at DESC',
        [userId]
    );

    const earnedBadges = result.rows.map(r => ({
        ...BADGES[r.badge_id],
        id: r.badge_id,
        earned_at: r.earned_at
    }));

    const allBadges = Object.entries(BADGES).map(([id, badge]) => ({
        ...badge,
        id,
        earned: result.rows.some(r => r.badge_id === id)
    }));

    res.json({ success: true, earnedBadges, allBadges });
}));

module.exports = router;
