const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { asyncHandler } = require('../middleware');

// Send friend request
router.post('/request', asyncHandler(async (req, res) => {
    const { userId, friendUsername } = req.body;
    
    if (!userId || !friendUsername) {
        return res.status(400).json({ success: false, error: 'Eksik bilgi' });
    }

    const friendResult = await query('SELECT id FROM users WHERE username = $1', [friendUsername]);
    if (friendResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı' });
    }
    const friendId = friendResult.rows[0].id;

    if (userId === friendId) {
        return res.status(400).json({ success: false, error: 'Kendinizi arkadaş olarak ekleyemezsiniz' });
    }

    const existing = await query(
        'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
        [userId, friendId]
    );
    
    if (existing.rows.length > 0) {
        const status = existing.rows[0].status;
        if (status === 'accepted') {
            return res.status(400).json({ success: false, error: 'Zaten arkadaşsınız' });
        }
        return res.status(400).json({ success: false, error: 'Zaten bekleyen bir istek var' });
    }

    await query(
        'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
        [userId, friendId, 'pending']
    );

    res.json({ success: true, message: 'Arkadaşlık isteği gönderildi' });
}));

// Accept/reject friend request
router.post('/respond', asyncHandler(async (req, res) => {
    const { userId, friendId, accept } = req.body;

    if (accept) {
        await query(
            'UPDATE friendships SET status = $1, accepted_at = NOW() WHERE user_id = $2 AND friend_id = $3',
            ['accepted', friendId, userId]
        );
    } else {
        await query(
            'DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2',
            [friendId, userId]
        );
    }

    res.json({ success: true });
}));

// Get friends list
router.get('/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const result = await query(`
        SELECT u.id, u.username, f.status, f.created_at,
               CASE WHEN f.user_id = $1 THEN 'sent' ELSE 'received' END as direction
        FROM friendships f
        JOIN users u ON (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END) = u.id
        WHERE f.user_id = $1 OR f.friend_id = $1
        ORDER BY f.status DESC, f.created_at DESC
    `, [userId]);

    const friends = result.rows.filter(r => r.status === 'accepted');
    const pending = result.rows.filter(r => r.status === 'pending' && r.direction === 'received');
    const sent = result.rows.filter(r => r.status === 'pending' && r.direction === 'sent');

    res.json({ success: true, friends, pending, sent });
}));

// Remove friend
router.delete('/:userId/:friendId', asyncHandler(async (req, res) => {
    const { userId, friendId } = req.params;

    await query(
        'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
        [userId, friendId]
    );

    res.json({ success: true });
}));

module.exports = router;
