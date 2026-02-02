const { query } = require('./lib/db');
const { asyncHandler, sendSuccess, sendError } = require('./lib/middleware');

module.exports = asyncHandler(async (req, res) => {
    const result = await query(`
        SELECT category, COUNT(*) as count
        FROM questions
        GROUP BY category
        ORDER BY category
    `);
    
    const totalResult = await query('SELECT COUNT(*) as total FROM questions');
    
    sendSuccess(res, {
        categories: result.rows,
        total: parseInt(totalResult.rows[0].total)
    });
});
