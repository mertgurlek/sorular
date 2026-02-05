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
    
    async getAnswerHistory(userId) {
        const result = await query(
            'SELECT * FROM user_answer_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100',
            [userId]
        );
        return result.rows;
    }
    
    async saveAnswerHistory(userId, data) {
        const { questionHash, questionText, category, userAnswer, isCorrect } = data;
        await query(`
            INSERT INTO user_answer_history 
            (user_id, question_hash, question_text, category, user_answer, is_correct)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [userId, questionHash, questionText, category, userAnswer, isCorrect]);
    }
    
    async getFavorites(userId) {
        const result = await query(
            'SELECT question_data FROM user_favorites WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows.map(r => r.question_data);
    }
    
    async addFavorite(userId, question) {
        await query(`
            INSERT INTO user_favorites (user_id, question_text, question_data)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, question_text) DO NOTHING
        `, [userId, question.question_text, JSON.stringify(question)]);
    }
    
    async removeFavorite(userId, questionText) {
        await query(
            'DELETE FROM user_favorites WHERE user_id = $1 AND question_text = $2',
            [userId, questionText]
        );
    }
    
    async getWrongAnswers(userId) {
        const result = await query(
            'SELECT * FROM user_wrong_answers WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }
    
    async saveWrongAnswer(userId, data) {
        const { questionText, category, userAnswer, correctAnswer } = data;
        await query(`
            INSERT INTO user_wrong_answers (user_id, question_text, category, user_answer, correct_answer)
            VALUES ($1, $2, $3, $4, $5)
        `, [userId, questionText, category, userAnswer, correctAnswer]);
    }
    
    async getDailyStats(userId) {
        const result = await query(
            'SELECT * FROM user_daily_stats WHERE user_id = $1 ORDER BY date DESC LIMIT 30',
            [userId]
        );
        return result.rows;
    }
    
    async updateDailyStats(userId, data) {
        const { date, answered, correct } = data;
        await query(`
            INSERT INTO user_daily_stats (user_id, date, answered, correct)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, date) 
            DO UPDATE SET answered = user_daily_stats.answered + $3, 
                         correct = user_daily_stats.correct + $4
        `, [userId, date || new Date().toISOString().split('T')[0], answered || 1, correct || 0]);
    }
    
    async getAllUserData(userId) {
        const [unknownWords, answerHistory, favorites, wrongAnswers, dailyStats] = await Promise.all([
            this.getUnknownWords(userId),
            this.getAnswerHistory(userId),
            this.getFavorites(userId),
            this.getWrongAnswers(userId),
            this.getDailyStats(userId)
        ]);
        
        return {
            unknownWords,
            answerHistory,
            favorites,
            wrongAnswers,
            dailyStats
        };
    }
}

module.exports = new UserService();
