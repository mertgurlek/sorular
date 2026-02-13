const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { asyncHandler } = require('../middleware');
const { optionalAuth } = require('../authMiddleware');
const { 
    YDS_DISTRIBUTION, ROOM_TEMPLATES, 
    generateRoomCode, calculatePoints, awardBadge, finishGame 
} = require('../services/challengeService');

// Create Room
router.post('/create', optionalAuth, asyncHandler(async (req, res) => {
    const { name, adminId, adminName, mode, categoryQuestions, timeLimit, enableLives, maxLives, shuffleQuestions, scoringMode } = req.body;
    
    if (!adminName) {
        return res.status(400).json({ success: false, error: 'Kullanıcı adı gerekli' });
    }

    let roomCode;
    let codeExists = true;
    while (codeExists) {
        roomCode = generateRoomCode();
        const check = await query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
        codeExists = check.rows.length > 0;
    }

    let questionsToSelect = [];
    let totalQuestionCount = 0;
    let categories = [];

    if (mode === 'mini-yds' || mode === 'orta-yds' || mode === 'yds') {
        const divisor = mode === 'mini-yds' ? 4 : mode === 'orta-yds' ? 2 : 1;
        
        for (const [category, count] of Object.entries(YDS_DISTRIBUTION)) {
            const adjustedCount = Math.max(1, Math.round(count / divisor));
            const catQuestions = await query(`
                SELECT id, category FROM questions 
                WHERE category = $1
                ORDER BY RANDOM()
                LIMIT $2
            `, [category, adjustedCount]);
            
            questionsToSelect.push(...catQuestions.rows);
            if (catQuestions.rows.length > 0) {
                categories.push(category);
            }
        }
        totalQuestionCount = questionsToSelect.length;
    } 
    else if (categoryQuestions && Object.keys(categoryQuestions).length > 0) {
        for (const [category, count] of Object.entries(categoryQuestions)) {
            if (count > 0) {
                const catQuestions = await query(`
                    SELECT id, category FROM questions 
                    WHERE category = $1
                    ORDER BY RANDOM()
                    LIMIT $2
                `, [category, count]);
                
                questionsToSelect.push(...catQuestions.rows);
                if (catQuestions.rows.length > 0) {
                    categories.push(category);
                }
            }
        }
        totalQuestionCount = questionsToSelect.length;
    } else {
        return res.status(400).json({ success: false, error: 'Mod veya kategori seçimi gerekli' });
    }

    if (questionsToSelect.length === 0) {
        return res.status(400).json({ success: false, error: 'Seçilen kategorilerde soru bulunamadı' });
    }

    const shouldShuffle = shuffleQuestions !== false;
    if (shouldShuffle) {
        questionsToSelect = questionsToSelect.sort(() => Math.random() - 0.5);
    }

    const roomResult = await query(`
        INSERT INTO challenge_rooms (room_code, name, admin_id, admin_name, question_count, categories, status, time_limit, enable_lives, max_lives, shuffle_questions, scoring_mode)
        VALUES ($1, $2, $3, $4, $5, $6, 'waiting', $7, $8, $9, $10, $11)
        RETURNING id, room_code, name, admin_name, question_count, categories, status, created_at, time_limit, enable_lives, max_lives, shuffle_questions, scoring_mode
    `, [roomCode, name || `${adminName}'in Odası`, adminId || null, adminName, totalQuestionCount, JSON.stringify(categories), timeLimit || 0, enableLives || false, maxLives || 3, shouldShuffle, scoringMode || 'speed']);

    const room = roomResult.rows[0];

    await query(`
        INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready, lives)
        VALUES ($1, $2, $3, TRUE, TRUE, $4)
    `, [room.id, adminId || null, adminName, maxLives || 3]);

    for (let i = 0; i < questionsToSelect.length; i++) {
        await query(`
            INSERT INTO room_questions (room_id, question_id, question_index)
            VALUES ($1, $2, $3)
        `, [room.id, questionsToSelect[i].id, i]);
    }

    res.json({
        success: true,
        room: { ...room, actualQuestionCount: questionsToSelect.length },
        mode: mode || 'custom'
    });
}));

// Join Room
router.post('/join', optionalAuth, asyncHandler(async (req, res) => {
    const { roomCode, userId, username } = req.body;

    if (!roomCode || !username) {
        return res.status(400).json({ success: false, error: 'Oda kodu ve kullanıcı adı gerekli' });
    }

    const roomResult = await query(`
        SELECT * FROM challenge_rooms WHERE room_code = $1
    `, [roomCode.toUpperCase()]);

    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    const room = roomResult.rows[0];

    if (room.status === 'finished') {
        return res.status(400).json({ success: false, error: 'Bu oda sonlanmış' });
    }

    const existingParticipant = await query(`
        SELECT * FROM room_participants WHERE room_id = $1 AND username = $2
    `, [room.id, username]);

    let participant;
    if (existingParticipant.rows.length > 0) {
        await query(`
            UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP WHERE id = $1
        `, [existingParticipant.rows[0].id]);
        participant = existingParticipant.rows[0];
    } else {
        if (room.status !== 'waiting') {
            return res.status(400).json({ success: false, error: 'Yarışma başlamış, katılamazsınız' });
        }
        const newParticipant = await query(`
            INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready, lives)
            VALUES ($1, $2, $3, FALSE, FALSE, $4)
            RETURNING *
        `, [room.id, userId || null, username, room.max_lives || 3]);
        participant = newParticipant.rows[0];
    }

    res.json({ success: true, room, participant });
}));

// Get Room State
router.get('/:code', asyncHandler(async (req, res) => {
    const roomCode = req.params.code.toUpperCase();
    const username = req.query.username;

    const roomResult = await query(`
        SELECT * FROM challenge_rooms WHERE room_code = $1
    `, [roomCode]);

    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    const room = roomResult.rows[0];

    const participantsResult = await query(`
        SELECT id, username, is_admin, is_ready, total_correct, total_wrong, last_seen, score, is_eliminated
        FROM room_participants WHERE room_id = $1
        ORDER BY is_admin DESC, joined_at ASC
    `, [room.id]);

    if (username) {
        await query(`
            UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP 
            WHERE room_id = $1 AND username = $2
        `, [room.id, username]);
    }

    let currentQuestion = null;
    let answers = [];
    
    if (room.status === 'active') {
        const questionResult = await query(`
            SELECT q.id, q.question_text, q.options, q.correct_answer, q.category, rq.question_index
            FROM room_questions rq
            JOIN questions q ON rq.question_id = q.id
            WHERE rq.room_id = $1 AND rq.question_index = $2
        `, [room.id, room.current_question_index]);

        if (questionResult.rows.length > 0) {
            currentQuestion = questionResult.rows[0];
            currentQuestion.options = typeof currentQuestion.options === 'string' 
                ? JSON.parse(currentQuestion.options) 
                : currentQuestion.options;
        }

        const answersResult = await query(`
            SELECT ra.participant_id, ra.selected_answer, ra.is_correct, rp.username
            FROM room_answers ra
            JOIN room_participants rp ON ra.participant_id = rp.id
            WHERE ra.room_id = $1 AND ra.question_index = $2
        `, [room.id, room.current_question_index]);
        answers = answersResult.rows;
    }

    const questionCountResult = await query(`
        SELECT COUNT(*) as count FROM room_questions WHERE room_id = $1
    `, [room.id]);

    const activeParticipants = participantsResult.rows.filter(p => !p.is_eliminated);
    const answeredCount = answers.length;
    const allAnswered = room.status === 'active' && activeParticipants.length > 0 && answeredCount >= activeParticipants.length;

    res.json({
        success: true,
        room: { ...room, totalQuestions: parseInt(questionCountResult.rows[0].count) },
        participants: participantsResult.rows,
        currentQuestion: room.status === 'active' ? currentQuestion : null,
        answers,
        answeredCount,
        activeParticipantCount: activeParticipants.length,
        allAnswered
    });
}));

// Set Ready
router.post('/ready', asyncHandler(async (req, res) => {
    const { roomCode, username, isReady } = req.body;

    await query(`
        UPDATE room_participants rp
        SET is_ready = $3
        FROM challenge_rooms cr
        WHERE cr.id = rp.room_id AND cr.room_code = $1 AND rp.username = $2
    `, [roomCode.toUpperCase(), username, isReady]);

    res.json({ success: true });
}));

// Start Game
router.post('/start', optionalAuth, asyncHandler(async (req, res) => {
    const { roomCode, adminName } = req.body;

    const roomResult = await query(`
        SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
    `, [roomCode.toUpperCase(), adminName]);

    if (roomResult.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
    }

    const room = roomResult.rows[0];

    if (room.status !== 'waiting') {
        return res.status(400).json({ success: false, error: 'Oyun zaten başlamış' });
    }

    await query(`
        UPDATE challenge_rooms 
        SET status = 'active', started_at = CURRENT_TIMESTAMP, current_question_index = 0, question_started_at = CURRENT_TIMESTAMP
        WHERE id = $1
    `, [room.id]);

    res.json({ success: true });
}));

// Submit Answer
router.post('/answer', optionalAuth, asyncHandler(async (req, res) => {
    const { roomCode, username, questionIndex, answer, answerTimeMs } = req.body;

    const roomResult = await query(`
        SELECT cr.*, rp.id as participant_id, rp.current_streak, rp.max_streak, rp.lives, rp.is_eliminated, rp.user_id, rp.score
        FROM challenge_rooms cr
        JOIN room_participants rp ON rp.room_id = cr.id
        WHERE cr.room_code = $1 AND rp.username = $2
    `, [roomCode.toUpperCase(), username]);

    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda veya katılımcı bulunamadı' });
    }

    const room = roomResult.rows[0];

    if (room.status !== 'active') {
        return res.status(400).json({ success: false, error: 'Oyun aktif değil' });
    }

    if (room.is_eliminated) {
        return res.status(400).json({ success: false, error: 'Elendiniz' });
    }

    const questionResult = await query(`
        SELECT q.correct_answer
        FROM room_questions rq
        JOIN questions q ON rq.question_id = q.id
        WHERE rq.room_id = $1 AND rq.question_index = $2
    `, [room.id, questionIndex]);

    if (questionResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Soru bulunamadı' });
    }

    const correctAnswer = questionResult.rows[0].correct_answer;
    const isCorrect = answer === correctAnswer;

    let newStreak = isCorrect ? room.current_streak + 1 : 0;
    let maxStreak = Math.max(room.max_streak, newStreak);
    let pointsEarned = 0;
    let newLives = room.lives;
    let isEliminated = false;

    if (isCorrect) {
        pointsEarned = calculatePoints(true, answerTimeMs, room.current_streak, room.scoring_mode || 'speed');

        if (room.user_id) {
            if (newStreak >= 5) await awardBadge(room.user_id, 'streak_5');
            if (newStreak >= 10) await awardBadge(room.user_id, 'streak_10');
            if (newStreak >= 20) await awardBadge(room.user_id, 'streak_20');
            
            if (answerTimeMs && answerTimeMs < 5000) {
                await awardBadge(room.user_id, 'speed_demon');
            }
        }
    } else {
        if (room.enable_lives) {
            newLives = room.lives - 1;
            if (newLives <= 0) {
                isEliminated = true;
            }
        }
    }

    await query(`
        INSERT INTO room_answers (room_id, participant_id, question_index, selected_answer, is_correct, answer_time_ms, points_earned)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (room_id, participant_id, question_index) 
        DO UPDATE SET selected_answer = $4, is_correct = $5, answer_time_ms = $6, points_earned = $7, answered_at = CURRENT_TIMESTAMP
    `, [room.id, room.participant_id, questionIndex, answer, isCorrect, answerTimeMs || 0, pointsEarned]);

    if (isCorrect) {
        await query(`
            UPDATE room_participants 
            SET total_correct = total_correct + 1, 
                current_streak = $2, 
                max_streak = $3,
                score = score + $4
            WHERE id = $1
        `, [room.participant_id, newStreak, maxStreak, pointsEarned]);
    } else {
        await query(`
            UPDATE room_participants 
            SET total_wrong = total_wrong + 1, 
                current_streak = 0,
                lives = $2,
                is_eliminated = $3
            WHERE id = $1
        `, [room.participant_id, newLives, isEliminated]);
    }

    res.json({ 
        success: true, 
        isCorrect, 
        correctAnswer, 
        pointsEarned,
        newStreak,
        newLives,
        isEliminated,
        totalScore: room.score + pointsEarned
    });
}));

// Next Question
router.post('/next', asyncHandler(async (req, res) => {
    const { roomCode, adminName } = req.body;

    const roomResult = await query(`
        SELECT cr.*, (SELECT COUNT(*) FROM room_questions WHERE room_id = cr.id) as total_questions
        FROM challenge_rooms cr
        WHERE cr.room_code = $1 AND cr.admin_name = $2
    `, [roomCode.toUpperCase(), adminName]);

    if (roomResult.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
    }

    const room = roomResult.rows[0];
    const nextIndex = room.current_question_index + 1;

    if (nextIndex >= parseInt(room.total_questions)) {
        await finishGame(room.id);
        return res.json({ success: true, finished: true });
    }

    await query(`UPDATE challenge_rooms SET current_question_index = $2, question_started_at = CURRENT_TIMESTAMP WHERE id = $1`, [room.id, nextIndex]);

    res.json({ success: true, nextIndex });
}));

// End Game Early
router.post('/end', optionalAuth, asyncHandler(async (req, res) => {
    const { roomCode, adminName } = req.body;

    const roomResult = await query(`
        SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
    `, [roomCode.toUpperCase(), adminName]);

    if (roomResult.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Yetkiniz yok' });
    }

    await finishGame(roomResult.rows[0].id);

    res.json({ success: true });
}));

// Get Results
router.get('/:code/results', asyncHandler(async (req, res) => {
    const roomCode = req.params.code.toUpperCase();

    const roomResult = await query(`SELECT * FROM challenge_rooms WHERE room_code = $1`, [roomCode]);

    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    const room = roomResult.rows[0];

    const participantsResult = await query(`
        SELECT id, username, is_admin, total_correct, total_wrong, score, max_streak,
               CASE WHEN (total_correct + total_wrong) > 0 
                    THEN ROUND(total_correct * 100.0 / (total_correct + total_wrong), 1)
                    ELSE 0 END as percentage
        FROM room_participants WHERE room_id = $1
        ORDER BY score DESC, total_correct DESC, total_wrong ASC
    `, [room.id]);

    const answersResult = await query(`
        SELECT ra.question_index, ra.participant_id, ra.selected_answer, ra.is_correct,
               rp.username, q.category, q.question_text, q.correct_answer
        FROM room_answers ra
        JOIN room_participants rp ON ra.participant_id = rp.id
        JOIN room_questions rq ON rq.room_id = ra.room_id AND rq.question_index = ra.question_index
        JOIN questions q ON rq.question_id = q.id
        WHERE ra.room_id = $1
        ORDER BY ra.question_index, rp.username
    `, [room.id]);

    const categoryStats = {};
    for (const answer of answersResult.rows) {
        if (!categoryStats[answer.username]) categoryStats[answer.username] = {};
        if (!categoryStats[answer.username][answer.category]) {
            categoryStats[answer.username][answer.category] = { correct: 0, total: 0 };
        }
        categoryStats[answer.username][answer.category].total++;
        if (answer.is_correct) categoryStats[answer.username][answer.category].correct++;
    }

    res.json({ success: true, room, participants: participantsResult.rows, answers: answersResult.rows, categoryStats });
}));

// Get User History
router.get('/history/:username', asyncHandler(async (req, res) => {
    const username = decodeURIComponent(req.params.username);

    const roomsResult = await query(`
        SELECT cr.*, rp.total_correct, rp.total_wrong, rp.is_admin,
               (SELECT COUNT(*) FROM room_participants WHERE room_id = cr.id) as participant_count
        FROM challenge_rooms cr
        JOIN room_participants rp ON rp.room_id = cr.id
        WHERE rp.username = $1
        ORDER BY cr.created_at DESC
        LIMIT 50
    `, [username]);

    res.json({ success: true, rooms: roomsResult.rows });
}));

// Leave Room
router.post('/leave', asyncHandler(async (req, res) => {
    const { roomCode, username } = req.body;

    const roomResult = await query(`
        SELECT cr.id, cr.admin_name, cr.status FROM challenge_rooms cr WHERE cr.room_code = $1
    `, [roomCode.toUpperCase()]);

    if (roomResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    const room = roomResult.rows[0];

    if (room.admin_name === username && room.status === 'waiting') {
        await query('DELETE FROM challenge_rooms WHERE id = $1', [room.id]);
    } else {
        await query(`DELETE FROM room_participants WHERE room_id = $1 AND username = $2`, [room.id, username]);
    }

    res.json({ success: true });
}));

// Update room settings
router.put('/:roomCode/settings', asyncHandler(async (req, res) => {
    const { roomCode } = req.params;
    const { timeLimit, enableLives, maxLives, gameMode, adminName, scoringMode, shuffleQuestions } = req.body;

    const room = await query('SELECT * FROM challenge_rooms WHERE room_code = $1', [roomCode]);
    if (room.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    if (room.rows[0].admin_name !== adminName) {
        return res.status(403).json({ success: false, error: 'Sadece admin ayarları değiştirebilir' });
    }

    await query(`
        UPDATE challenge_rooms 
        SET time_limit = COALESCE($1, time_limit),
            enable_lives = COALESCE($2, enable_lives),
            max_lives = COALESCE($3, max_lives),
            game_mode = COALESCE($4, game_mode),
            scoring_mode = COALESCE($5, scoring_mode),
            shuffle_questions = COALESCE($6, shuffle_questions)
        WHERE room_code = $7
    `, [timeLimit, enableLives, maxLives, gameMode, scoringMode, shuffleQuestions, roomCode]);

    res.json({ success: true });
}));

// Room chat - send message
router.post('/:roomCode/chat', asyncHandler(async (req, res) => {
    const { roomCode } = req.params;
    const { username, message, emoji, messageType } = req.body;

    const room = await query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
    if (room.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    await query(
        'INSERT INTO room_messages (room_id, username, message, emoji, message_type) VALUES ($1, $2, $3, $4, $5)',
        [room.rows[0].id, username, message || null, emoji || null, messageType || 'text']
    );

    res.json({ success: true });
}));

// Room chat - get messages
router.get('/:roomCode/chat', asyncHandler(async (req, res) => {
    const { roomCode } = req.params;
    const { since } = req.query;

    const room = await query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
    if (room.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Oda bulunamadı' });
    }

    let sql = 'SELECT * FROM room_messages WHERE room_id = $1';
    const params = [room.rows[0].id];
    
    if (since) {
        sql += ' AND created_at > $2';
        params.push(since);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const result = await query(sql, params);

    res.json({ success: true, messages: result.rows.reverse() });
}));

// Room templates
router.get('/templates/list', (req, res) => {
    res.json({ success: true, templates: ROOM_TEMPLATES });
});

module.exports = router;
