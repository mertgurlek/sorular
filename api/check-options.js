require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkOptions() {
    try {
        // Total questions
        const total = await pool.query('SELECT COUNT(*) FROM questions');
        console.log('Total questions:', total.rows[0].count);

        // Empty options
        const empty = await pool.query("SELECT COUNT(*) FROM questions WHERE options IS NULL OR options::text = '[]'");
        console.log('Questions with empty options:', empty.rows[0].count);

        // Sample with options
        const sample = await pool.query("SELECT id, category, options FROM questions WHERE options::text != '[]' LIMIT 1");
        if (sample.rows.length > 0) {
            console.log('\nSample question with options:');
            console.log('ID:', sample.rows[0].id);
            console.log('Category:', sample.rows[0].category);
            console.log('Options:', JSON.stringify(sample.rows[0].options, null, 2));
        }

        // Sample without options
        const sampleEmpty = await pool.query("SELECT id, category, question_text FROM questions WHERE options::text = '[]' LIMIT 1");
        if (sampleEmpty.rows.length > 0) {
            console.log('\nSample question WITHOUT options:');
            console.log('ID:', sampleEmpty.rows[0].id);
            console.log('Category:', sampleEmpty.rows[0].category);
            console.log('Question:', sampleEmpty.rows[0].question_text.substring(0, 100) + '...');
        }

        pool.end();
    } catch (err) {
        console.error('Error:', err);
        pool.end();
    }
}

checkOptions();
