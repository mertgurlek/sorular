const { Pool } = require('pg');

let pool = null;

function getPool() {
    if (!pool) {
        const dbUrl = process.env.DATABASE_URL || '';
        const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
        
        pool = new Pool({
            connectionString: dbUrl,
            ssl: isLocalDb ? false : { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });

        pool.on('error', (err) => {
            console.error('Unexpected database error:', err);
        });
    }
    return pool;
}

async function query(text, params) {
    const client = await getPool().connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

async function transaction(callback) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    getPool,
    query,
    transaction
};
