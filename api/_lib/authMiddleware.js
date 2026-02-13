const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'yds-quiz-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

// Middleware: require valid JWT, attach user to req
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Yetkilendirme gerekli' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ success: false, error: 'Geçersiz veya süresi dolmuş token' });
    }

    req.user = decoded;
    next();
}

// Middleware: require that the authenticated user matches the :userId param (prevents IDOR)
function requireSameUser(req, res, next) {
    const paramUserId = parseInt(req.params.userId);
    if (req.user.id !== paramUserId) {
        return res.status(403).json({ success: false, error: 'Bu işlem için yetkiniz yok' });
    }
    next();
}

// Optional auth: attach user if token present, but don't block
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }
    next();
}

module.exports = { generateToken, verifyToken, requireAuth, requireSameUser, optionalAuth, JWT_SECRET };
