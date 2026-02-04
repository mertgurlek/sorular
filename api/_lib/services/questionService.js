const { query } = require('../lib/db');

class QuestionService {
    async getCategories() {
        const result = await query(`
            SELECT category, COUNT(*) as count
            FROM questions
            GROUP BY category
            ORDER BY category
        `);
        
        const totalResult = await query('SELECT COUNT(*) as total FROM questions');
        
        return {
            categories: result.rows,
            total: parseInt(totalResult.rows[0].total)
        };
    }
    
    async getQuestions(category = null) {
        let sql = `
            SELECT id, question_number, question_text, options, correct_answer, 
                   category, url, test_url, tip, explanation_tr, question_tr, difficulty
            FROM questions
        `;
        let params = [];
        
        if (category && category !== 'all') {
            sql += ' WHERE category = $1';
            params.push(category);
        }
        
        sql += ' ORDER BY category, id';
        
        const result = await query(sql, params);
        
        const questions = result.rows.map(q => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : 
                    (typeof q.options === 'string' ? JSON.parse(q.options) : [])
        }));
        
        return questions;
    }
    
    async getQuestionById(id) {
        const result = await query(
            'SELECT * FROM questions WHERE id = $1',
            [id]
        );
        return result.rows[0] || null;
    }
}

module.exports = new QuestionService();
