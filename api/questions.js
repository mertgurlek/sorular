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
               category, url, test_url
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
        options: parseOptions(q.options)
    }));
    
    sendSuccess(res, { questions });
});
