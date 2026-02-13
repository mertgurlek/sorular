const { query } = require('../db');

class UserService {
    async updateStats(userId, { totalAnswered, totalCorrect, totalWrong, streakDays }) {
        await query(`
            UPDATE user_stats 
            SET total_answered = $1, total_correct = $2, total_wrong = $3, 
                streak_days = $4, last_activity_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
        `, [totalAnswered, totalCorrect, totalWrong, streakDays, userId]);
    }
    
    // --- UNKNOWN WORDS ---
    async getUnknownWords(userId) {
        const result = await query(
            'SELECT word FROM user_unknown_words WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows.map(r => r.word);
    }
    
    async addUnknownWord(userId, word) {
        await query(`
            INSERT INTO user_unknown_words (user_id, word)
            VALUES ($1, $2)
            ON CONFLICT (user_id, word) DO NOTHING
        `, [userId, word.toLowerCase()]);
    }
    
    async removeUnknownWord(userId, word) {
        await query(
            'DELETE FROM user_unknown_words WHERE user_id = $1 AND word = $2',
            [userId, word.toLowerCase()]
        );
    }
    
    async clearUnknownWords(userId) {
        await query('DELETE FROM user_unknown_words WHERE user_id = $1', [userId]);
    }
    
    async syncUnknownWords(userId, words) {
        if (words && words.length > 0) {
            const values = words.map((w, i) => `($1, $${i + 2})`).join(',');
            const params = [userId, ...words.map(w => w.toLowerCase())];
            await query(`
                INSERT INTO user_unknown_words (user_id, word)
                VALUES ${values}
                ON CONFLICT (user_id, word) DO NOTHING
            `, params);
        }
    }
    
    // --- ANSWER HISTORY ---
    async getAnswerHistory(userId) {
        const result = await query(`
            SELECT DISTINCT ON (question_hash) 
                question_hash, question_text, category, is_correct,
                COUNT(*) OVER (PARTITION BY question_hash) as total_attempts,
                SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) OVER (PARTITION BY question_hash) as correct_count
            FROM user_answer_history 
            WHERE user_id = $1 
            ORDER BY question_hash, created_at DESC
        `, [userId]);
        
        const history = {};
        result.rows.forEach(row => {
            history[row.question_hash] = {
                lastCorrect: row.is_correct,
                totalAttempts: parseInt(row.total_attempts),
                correctCount: parseInt(row.correct_count),
                wrongCount: parseInt(row.total_attempts) - parseInt(row.correct_count)
            };
        });
        return history;
    }
    
    async saveAnswerHistory(userId, data) {
        const { questionHash, questionText, category, userAnswer, isCorrect } = data;
        await query(`
            INSERT INTO user_answer_history 
            (user_id, question_hash, question_text, category, user_answer, is_correct)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, questionHash, questionText, category, userAnswer, isCorrect]);
    }
    
    async clearAnswerHistory(userId) {
        await query('DELETE FROM user_answer_history WHERE user_id = $1', [userId]);
    }
    
    // --- FAVORITES ---
    async getFavorites(userId) {
        const result = await query(
            'SELECT question_data FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows.map(r => r.question_data);
    }
    
    async addFavorite(userId, question) {
        await query(`
            INSERT INTO user_favorites (user_id, question_id, question_text, question_data)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, question_text) DO NOTHING
        `, [userId, question.id || null, question.question_text, JSON.stringify(question)]);
    }
    
    async removeFavorite(userId, questionText) {
        await query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND question_text = $2',
            [userId, questionText]
        );
    }
    
    async clearFavorites(userId) {
        await query('DELETE FROM user_favorites WHERE user_id = $1', [userId]);
    }
    
    // --- WRONG ANSWERS ---
    async getWrongAnswers(userId) {
        const result = await query(
            'SELECT * FROM user_wrong_answers WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }
    
    async saveWrongAnswer(userId, data) {
        const { questionText, category, userAnswer, correctAnswer } = data;
        const existing = await query(
            'SELECT id FROM user_wrong_answers WHERE user_id = $1 AND question_text = $2',
            [userId, questionText]
        );
        if (existing.rows.length === 0) {
            await query(`
                INSERT INTO user_wrong_answers (user_id, question_text, category, user_answer, correct_answer)
                VALUES ($1, $2, $3, $4, $5)
            `, [userId, questionText, category, userAnswer, correctAnswer]);
        }
    }
    
    async removeWrongAnswer(userId, id) {
        await query(
            'DELETE FROM user_wrong_answers WHERE user_id = $1 AND id = $2',
            [userId, id]
        );
    }
    
    async clearWrongAnswers(userId) {
        await query('DELETE FROM user_wrong_answers WHERE user_id = $1', [userId]);
    }
    
    // --- DAILY STATS ---
    async getDailyStats(userId) {
        const result = await query(
            'SELECT date, answered, correct FROM user_daily_stats WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
            [userId]
        );
        const stats = {};
        result.rows.forEach(row => {
            stats[row.date.toISOString().split('T')[0]] = {
                answered: row.answered,
                correct: row.correct
            };
        });
        return stats;
    }
    
    async updateDailyStats(userId, data) {
        const { date, answered, correct } = data;
        await query(`
            INSERT INTO user_daily_stats (user_id, date, answered, correct)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, date) DO UPDATE SET answered = $3, correct = $4
        `, [userId, date, answered, correct]);
    }
    
    // --- LEARNED WORDS ---
    async getLearnedWords(userId) {
        const result = await query(
            'SELECT expression, learned_at FROM user_learned_words WHERE user_id = $1 ORDER BY learned_at DESC',
            [userId]
        );
        return result.rows.map(r => r.expression);
    }
    
    async addLearnedWord(userId, expression) {
        await query(`
            INSERT INTO user_learned_words (user_id, expression)
            VALUES ($1, $2)
            ON CONFLICT (user_id, expression) DO NOTHING
        `, [userId, expression.toLowerCase()]);
    }
    
    async removeLearnedWord(userId, expression) {
        await query(
            'DELETE FROM user_learned_words WHERE user_id = $1 AND expression = $2',
            [userId, decodeURIComponent(expression).toLowerCase()]
        );
    }
    
    // --- ALL DATA ---
    async getAllUserData(userId) {
        const [wordsResult, historyResult, favoritesResult, wrongResult, dailyResult, learnedResult, statsResult] = await Promise.all([
            query('SELECT word FROM user_unknown_words WHERE user_id = $1', [userId]),
            query(`
                SELECT DISTINCT ON (question_hash) 
                    question_hash, is_correct,
                    COUNT(*) OVER (PARTITION BY question_hash) as total_attempts,
                    SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) OVER (PARTITION BY question_hash) as correct_count
                FROM user_answer_history 
                WHERE user_id = $1 
                ORDER BY question_hash, created_at DESC
            `, [userId]),
            query('SELECT question_data FROM user_favorites WHERE user_id = $1', [userId]),
            query('SELECT * FROM user_wrong_answers WHERE user_id = $1', [userId]),
            query('SELECT date, answered, correct FROM user_daily_stats WHERE user_id = $1 ORDER BY date DESC LIMIT 30', [userId]),
            query('SELECT expression FROM user_learned_words WHERE user_id = $1', [userId]),
            query('SELECT * FROM user_stats WHERE user_id = $1', [userId])
        ]);
        
        const history = {};
        historyResult.rows.forEach(row => {
            history[row.question_hash] = {
                lastCorrect: row.is_correct,
                totalAttempts: parseInt(row.total_attempts),
                correctCount: parseInt(row.correct_count),
                wrongCount: parseInt(row.total_attempts) - parseInt(row.correct_count)
            };
        });
        
        const dailyStats = {};
        dailyResult.rows.forEach(row => {
            dailyStats[row.date.toISOString().split('T')[0]] = {
                answered: row.answered,
                correct: row.correct
            };
        });
        
        return {
            data: {
                unknownWords: wordsResult.rows.map(r => r.word),
                answerHistory: history,
                favorites: favoritesResult.rows.map(r => r.question_data),
                wrongAnswers: wrongResult.rows,
                dailyStats: dailyStats,
                learnedWords: learnedResult.rows.map(r => r.expression),
                stats: statsResult.rows[0] || null
            }
        };
    }
}

module.exports = new UserService();
