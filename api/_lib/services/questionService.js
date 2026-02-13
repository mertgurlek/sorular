const { query } = require('../db');

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
    
    // Quiz soru seçimi — sunucu tarafında shuffle + limit
    async getQuestionsForQuiz({ category, limit, shuffle = true }) {
        let sql = `
            SELECT id, question_number, question_text, options, correct_answer, 
                   category, url, test_url, tip, explanation_tr, question_tr, difficulty
            FROM questions
        `;
        const params = [];
        
        if (category && category !== 'all') {
            params.push(category);
            sql += ` WHERE category = $${params.length}`;
        }
        
        if (shuffle) {
            sql += ' ORDER BY RANDOM()';
        } else {
            sql += ' ORDER BY category, id';
        }
        
        if (limit && limit !== 'all') {
            params.push(parseInt(limit));
            sql += ` LIMIT $${params.length}`;
        }
        
        const result = await query(sql, params);
        
        return result.rows.map(q => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : 
                    (typeof q.options === 'string' ? JSON.parse(q.options) : [])
        }));
    }
    
    // Sınav modu — YDS dağılımına göre soru seçimi (sunucu tarafında)
    async getQuestionsForExam(examSize, categoryMapping) {
        // Her YDS kategorisi için belirlenen sayıda soru çek — tek sorguda
        const allSelected = [];
        
        for (const [ydsCategory, count] of Object.entries(categoryMapping)) {
            const result = await query(`
                SELECT id, question_number, question_text, options, correct_answer, 
                       category, url, test_url, tip, explanation_tr, question_tr, difficulty
                FROM questions
                WHERE category = $1
                ORDER BY RANDOM()
                LIMIT $2
            `, [ydsCategory, count]);
            
            allSelected.push(...result.rows);
        }
        
        // Eksik varsa rastgele tamamla
        const targetCount = Object.values(categoryMapping).reduce((a, b) => a + b, 0);
        if (allSelected.length < targetCount) {
            const selectedIds = allSelected.map(q => q.id);
            const needed = targetCount - allSelected.length;
            
            let fillSql = `
                SELECT id, question_number, question_text, options, correct_answer, 
                       category, url, test_url, tip, explanation_tr, question_tr, difficulty
                FROM questions
                ORDER BY RANDOM()
                LIMIT $1
            `;
            const fillParams = [needed];
            
            if (selectedIds.length > 0) {
                fillSql = `
                    SELECT id, question_number, question_text, options, correct_answer, 
                           category, url, test_url, tip, explanation_tr, question_tr, difficulty
                    FROM questions
                    WHERE id != ALL($2)
                    ORDER BY RANDOM()
                    LIMIT $1
                `;
                fillParams.push(selectedIds);
            }
            
            const fillResult = await query(fillSql, fillParams);
            allSelected.push(...fillResult.rows);
        }
        
        return allSelected.map(q => ({
            ...q,
            options: Array.isArray(q.options) ? q.options : 
                    (typeof q.options === 'string' ? JSON.parse(q.options) : [])
        }));
    }
}

module.exports = new QuestionService();
