const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { initDatabase } = require('./lib/initDb');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

initDatabase();

module.exports = app;
