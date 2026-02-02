const { query } = require('./lib/db');
const { asyncHandler, sendSuccess } = require('./lib/middleware');

function parseOptions(options) {
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
        try { return JSON.parse(options); } catch { return []; }
    }
    return [];
}

module.exports = asyncHandler(async (req, res) => {
    const { category } = req.query;
    
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
    
    // Debug: log first question to see all fields
    if (result.rows.length > 0) {
        console.log(' First question fields:', Object.keys(result.rows[0]));
        console.log(' First question tip:', result.rows[0].tip);
    }

    const questions = result.rows.map(q => ({
        ...q,
        options: parseOptions(q.options)
    }));
    
    sendSuccess(res, { questions });
});
