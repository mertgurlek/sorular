const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireSameUser } = require('./_lib/authMiddleware');
const { initDatabase } = require('./_lib/initDb');
const routes = require('./_lib/routes');

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS — restrict to known origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        // Allow localhost with any port (dev/preview)
        if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/)) {
            return callback(null, true);
        }
        // Allow Vercel deployments
        if (origin.match(/\.vercel\.app$/)) {
            return callback(null, true);
        }
        // Allow explicitly configured origins
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('CORS policy violation'));
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Rate limiters
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { success: false, error: 'Çok fazla istek. Lütfen biraz bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

const openaiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { success: false, error: 'GPT istek limiti aşıldı. 1 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

const feedbackLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { success: false, error: 'Çok fazla geri bildirim. 1 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply general rate limiter to all API routes
app.use('/api/', generalLimiter);

// Apply specific rate limiters
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/openai-explain', openaiLimiter);
app.use('/api/questions/feedback', feedbackLimiter);
app.use('/api/questions/rate', feedbackLimiter);

// Protect all /api/user/:userId routes — require auth + same user (IDOR protection)
app.use('/api/user/:userId', requireAuth, requireSameUser);

// Protect OpenAI endpoint
app.use('/api/openai-explain', requireAuth);
app.use('/api/gpt-explanation', requireAuth);

// Initialize database tables
initDatabase();

// Mount all routes under /api
app.use('/api', routes);

// Export for Vercel serverless
module.exports = app;
module.exports.default = app;
