const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { asyncHandler } = require('../middleware');

// Get challenge stats
router.get('/challenge-stats/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;

    let stats = await query('SELECT * FROM challenge_stats WHERE user_id = $1', [userId]);
    
    if (stats.rows.length === 0) {
        await query(
            'INSERT INTO challenge_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
            [userId]
        );
        stats = await query('SELECT * FROM challenge_stats WHERE user_id = $1', [userId]);
    }

    const leaderboard = await query(
        'SELECT user_id, elo_rating, RANK() OVER (ORDER BY elo_rating DESC) as rank FROM challenge_stats'
    );
    const userRank = leaderboard.rows.find(r => r.user_id == userId)?.rank || 0;

    res.json({ success: true, stats: stats.rows[0], rank: userRank });
}));

// Get leaderboard
router.get('/leaderboard', asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT cs.*, u.username,
               RANK() OVER (ORDER BY cs.elo_rating DESC) as rank
        FROM challenge_stats cs
        JOIN users u ON cs.user_id = u.id
        ORDER BY cs.elo_rating DESC
        LIMIT 100
    `);

    res.json({ success: true, leaderboard: result.rows });
}));

module.exports = router;
