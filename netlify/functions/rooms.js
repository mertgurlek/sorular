const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// Generate random room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const path = event.path.replace('/.netlify/functions/rooms', '').replace('/api/rooms', '');
    const method = event.httpMethod;

    try {
        // CREATE ROOM - POST /rooms/create
        if (path === '/create' && method === 'POST') {
            const { name, adminId, adminName, questionCount, categories } = JSON.parse(event.body || '{}');
            
            if (!adminName || !questionCount || !categories || categories.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Eksik bilgi' })
                };
            }

            // Generate unique room code
            let roomCode;
            let codeExists = true;
            while (codeExists) {
                roomCode = generateRoomCode();
                const check = await pool.query('SELECT id FROM challenge_rooms WHERE room_code = $1', [roomCode]);
                codeExists = check.rows.length > 0;
            }

            // Create room
            const roomResult = await pool.query(`
                INSERT INTO challenge_rooms (room_code, name, admin_id, admin_name, question_count, categories, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'waiting')
                RETURNING id, room_code, name, admin_name, question_count, categories, status, created_at
            `, [roomCode, name, adminId || null, adminName, questionCount, JSON.stringify(categories)]);

            const room = roomResult.rows[0];

            // Add admin as first participant
            await pool.query(`
                INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready)
                VALUES ($1, $2, $3, TRUE, TRUE)
            `, [room.id, adminId || null, adminName]);

            // Select random questions from categories
            let questionsQuery = `
                SELECT id, category FROM questions 
                WHERE category = ANY($1)
                ORDER BY RANDOM()
                LIMIT $2
            `;
            const questionsResult = await pool.query(questionsQuery, [categories, questionCount]);

            // Insert room questions
            for (let i = 0; i < questionsResult.rows.length; i++) {
                await pool.query(`
                    INSERT INTO room_questions (room_id, question_id, question_index)
                    VALUES ($1, $2, $3)
                `, [room.id, questionsResult.rows[i].id, i]);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    room: {
                        ...room,
                        actualQuestionCount: questionsResult.rows.length
                    }
                })
            };
        }

        // JOIN ROOM - POST /rooms/join
        if (path === '/join' && method === 'POST') {
            const { roomCode, userId, username } = JSON.parse(event.body || '{}');

            if (!roomCode || !username) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda kodu ve kullanıcı adı gerekli' })
                };
            }

            // Find room
            const roomResult = await pool.query(`
                SELECT * FROM challenge_rooms WHERE room_code = $1
            `, [roomCode.toUpperCase()]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda bulunamadı' })
                };
            }

            const room = roomResult.rows[0];

            if (room.status === 'finished') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Bu oda sonlanmış' })
                };
            }

            // Check if user already in room
            const existingParticipant = await pool.query(`
                SELECT * FROM room_participants WHERE room_id = $1 AND username = $2
            `, [room.id, username]);

            let participant;
            if (existingParticipant.rows.length > 0) {
                // Update last_seen
                await pool.query(`
                    UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP WHERE id = $1
                `, [existingParticipant.rows[0].id]);
                participant = existingParticipant.rows[0];
            } else {
                if (room.status !== 'waiting') {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ success: false, error: 'Yarışma başlamış, katılamazsınız' })
                    };
                }
                // Add new participant
                const newParticipant = await pool.query(`
                    INSERT INTO room_participants (room_id, user_id, username, is_admin, is_ready)
                    VALUES ($1, $2, $3, FALSE, FALSE)
                    RETURNING *
                `, [room.id, userId || null, username]);
                participant = newParticipant.rows[0];
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    room,
                    participant
                })
            };
        }

        // GET ROOM STATE - GET /rooms/:code
        if (path.match(/^\/[A-Z0-9]{6}$/i) && method === 'GET') {
            const roomCode = path.substring(1).toUpperCase();
            const username = event.queryStringParameters?.username;

            const roomResult = await pool.query(`
                SELECT * FROM challenge_rooms WHERE room_code = $1
            `, [roomCode]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda bulunamadı' })
                };
            }

            const room = roomResult.rows[0];

            // Get participants
            const participantsResult = await pool.query(`
                SELECT id, username, is_admin, is_ready, total_correct, total_wrong, last_seen
                FROM room_participants WHERE room_id = $1
                ORDER BY is_admin DESC, joined_at ASC
            `, [room.id]);

            // Update last_seen for current user
            if (username) {
                await pool.query(`
                    UPDATE room_participants SET last_seen = CURRENT_TIMESTAMP 
                    WHERE room_id = $1 AND username = $2
                `, [room.id, username]);
            }

            // Get current question if game is active
            let currentQuestion = null;
            let answers = [];
            
            if (room.status === 'active') {
                const questionResult = await pool.query(`
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

                // Get answers for current question
                const answersResult = await pool.query(`
                    SELECT ra.participant_id, ra.selected_answer, ra.is_correct, rp.username
                    FROM room_answers ra
                    JOIN room_participants rp ON ra.participant_id = rp.id
                    WHERE ra.room_id = $1 AND ra.question_index = $2
                `, [room.id, room.current_question_index]);
                answers = answersResult.rows;
            }

            // Get total question count
            const questionCountResult = await pool.query(`
                SELECT COUNT(*) as count FROM room_questions WHERE room_id = $1
            `, [room.id]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    room: {
                        ...room,
                        totalQuestions: parseInt(questionCountResult.rows[0].count)
                    },
                    participants: participantsResult.rows,
                    currentQuestion: room.status === 'active' ? currentQuestion : null,
                    answers
                })
            };
        }

        // SET READY - POST /rooms/ready
        if (path === '/ready' && method === 'POST') {
            const { roomCode, username, isReady } = JSON.parse(event.body || '{}');

            await pool.query(`
                UPDATE room_participants rp
                SET is_ready = $3
                FROM challenge_rooms cr
                WHERE cr.id = rp.room_id AND cr.room_code = $1 AND rp.username = $2
            `, [roomCode.toUpperCase(), username, isReady]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // START GAME - POST /rooms/start
        if (path === '/start' && method === 'POST') {
            const { roomCode, adminName } = JSON.parse(event.body || '{}');

            // Verify admin
            const roomResult = await pool.query(`
                SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
            `, [roomCode.toUpperCase(), adminName]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Yetkiniz yok' })
                };
            }

            const room = roomResult.rows[0];

            if (room.status !== 'waiting') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oyun zaten başlamış' })
                };
            }

            // Start the game
            await pool.query(`
                UPDATE challenge_rooms 
                SET status = 'active', started_at = CURRENT_TIMESTAMP, current_question_index = 0
                WHERE id = $1
            `, [room.id]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // SUBMIT ANSWER - POST /rooms/answer
        if (path === '/answer' && method === 'POST') {
            const { roomCode, username, questionIndex, answer } = JSON.parse(event.body || '{}');

            // Get room and participant
            const roomResult = await pool.query(`
                SELECT cr.*, rp.id as participant_id
                FROM challenge_rooms cr
                JOIN room_participants rp ON rp.room_id = cr.id
                WHERE cr.room_code = $1 AND rp.username = $2
            `, [roomCode.toUpperCase(), username]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda veya katılımcı bulunamadı' })
                };
            }

            const room = roomResult.rows[0];

            if (room.status !== 'active') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oyun aktif değil' })
                };
            }

            // Get correct answer
            const questionResult = await pool.query(`
                SELECT q.correct_answer
                FROM room_questions rq
                JOIN questions q ON rq.question_id = q.id
                WHERE rq.room_id = $1 AND rq.question_index = $2
            `, [room.id, questionIndex]);

            if (questionResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Soru bulunamadı' })
                };
            }

            const correctAnswer = questionResult.rows[0].correct_answer;
            const isCorrect = answer === correctAnswer;

            // Save answer (upsert)
            await pool.query(`
                INSERT INTO room_answers (room_id, participant_id, question_index, selected_answer, is_correct)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (room_id, participant_id, question_index) 
                DO UPDATE SET selected_answer = $4, is_correct = $5, answered_at = CURRENT_TIMESTAMP
            `, [room.id, room.participant_id, questionIndex, answer, isCorrect]);

            // Update participant stats
            if (isCorrect) {
                await pool.query(`
                    UPDATE room_participants SET total_correct = total_correct + 1 WHERE id = $1
                `, [room.participant_id]);
            } else {
                await pool.query(`
                    UPDATE room_participants SET total_wrong = total_wrong + 1 WHERE id = $1
                `, [room.participant_id]);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    isCorrect,
                    correctAnswer
                })
            };
        }

        // NEXT QUESTION - POST /rooms/next
        if (path === '/next' && method === 'POST') {
            const { roomCode, adminName } = JSON.parse(event.body || '{}');

            // Verify admin
            const roomResult = await pool.query(`
                SELECT cr.*, (SELECT COUNT(*) FROM room_questions WHERE room_id = cr.id) as total_questions
                FROM challenge_rooms cr
                WHERE cr.room_code = $1 AND cr.admin_name = $2
            `, [roomCode.toUpperCase(), adminName]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Yetkiniz yok' })
                };
            }

            const room = roomResult.rows[0];
            const nextIndex = room.current_question_index + 1;

            if (nextIndex >= parseInt(room.total_questions)) {
                // End the game
                await pool.query(`
                    UPDATE challenge_rooms 
                    SET status = 'finished', ended_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [room.id]);

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, finished: true })
                };
            }

            // Move to next question
            await pool.query(`
                UPDATE challenge_rooms SET current_question_index = $2 WHERE id = $1
            `, [room.id, nextIndex]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, nextIndex })
            };
        }

        // END GAME EARLY - POST /rooms/end
        if (path === '/end' && method === 'POST') {
            const { roomCode, adminName } = JSON.parse(event.body || '{}');

            // Verify admin
            const roomResult = await pool.query(`
                SELECT * FROM challenge_rooms WHERE room_code = $1 AND admin_name = $2
            `, [roomCode.toUpperCase(), adminName]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 403,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Yetkiniz yok' })
                };
            }

            await pool.query(`
                UPDATE challenge_rooms 
                SET status = 'finished', ended_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [roomResult.rows[0].id]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        // GET RESULTS - GET /rooms/:code/results
        if (path.match(/^\/[A-Z0-9]{6}\/results$/i) && method === 'GET') {
            const roomCode = path.split('/')[1].toUpperCase();

            const roomResult = await pool.query(`
                SELECT * FROM challenge_rooms WHERE room_code = $1
            `, [roomCode]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda bulunamadı' })
                };
            }

            const room = roomResult.rows[0];

            // Get participants with scores
            const participantsResult = await pool.query(`
                SELECT id, username, is_admin, total_correct, total_wrong,
                       CASE WHEN (total_correct + total_wrong) > 0 
                            THEN ROUND(total_correct * 100.0 / (total_correct + total_wrong), 1)
                            ELSE 0 END as percentage
                FROM room_participants 
                WHERE room_id = $1
                ORDER BY total_correct DESC, total_wrong ASC
            `, [room.id]);

            // Get detailed answers per question
            const answersResult = await pool.query(`
                SELECT ra.question_index, ra.participant_id, ra.selected_answer, ra.is_correct,
                       rp.username, q.category, q.question_text, q.correct_answer
                FROM room_answers ra
                JOIN room_participants rp ON ra.participant_id = rp.id
                JOIN room_questions rq ON rq.room_id = ra.room_id AND rq.question_index = ra.question_index
                JOIN questions q ON rq.question_id = q.id
                WHERE ra.room_id = $1
                ORDER BY ra.question_index, rp.username
            `, [room.id]);

            // Calculate category stats per participant
            const categoryStats = {};
            for (const answer of answersResult.rows) {
                if (!categoryStats[answer.username]) {
                    categoryStats[answer.username] = {};
                }
                if (!categoryStats[answer.username][answer.category]) {
                    categoryStats[answer.username][answer.category] = { correct: 0, total: 0 };
                }
                categoryStats[answer.username][answer.category].total++;
                if (answer.is_correct) {
                    categoryStats[answer.username][answer.category].correct++;
                }
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    room,
                    participants: participantsResult.rows,
                    answers: answersResult.rows,
                    categoryStats
                })
            };
        }

        // GET USER'S PAST ROOMS - GET /rooms/history/:username
        if (path.match(/^\/history\//) && method === 'GET') {
            const username = decodeURIComponent(path.split('/history/')[1]);

            const roomsResult = await pool.query(`
                SELECT cr.*, rp.total_correct, rp.total_wrong, rp.is_admin,
                       (SELECT COUNT(*) FROM room_participants WHERE room_id = cr.id) as participant_count
                FROM challenge_rooms cr
                JOIN room_participants rp ON rp.room_id = cr.id
                WHERE rp.username = $1
                ORDER BY cr.created_at DESC
                LIMIT 50
            `, [username]);

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    rooms: roomsResult.rows
                })
            };
        }

        // LEAVE ROOM - POST /rooms/leave
        if (path === '/leave' && method === 'POST') {
            const { roomCode, username } = JSON.parse(event.body || '{}');

            const roomResult = await pool.query(`
                SELECT cr.id, cr.admin_name, cr.status
                FROM challenge_rooms cr
                WHERE cr.room_code = $1
            `, [roomCode.toUpperCase()]);

            if (roomResult.rows.length === 0) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ success: false, error: 'Oda bulunamadı' })
                };
            }

            const room = roomResult.rows[0];

            // If admin leaves and game hasn't started, delete the room
            if (room.admin_name === username && room.status === 'waiting') {
                await pool.query('DELETE FROM challenge_rooms WHERE id = $1', [room.id]);
            } else {
                // Just remove participant
                await pool.query(`
                    DELETE FROM room_participants 
                    WHERE room_id = $1 AND username = $2
                `, [room.id, username]);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ success: false, error: 'Endpoint bulunamadı' })
        };

    } catch (error) {
        console.error('Rooms API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: 'Sunucu hatası: ' + error.message })
        };
    }
};
