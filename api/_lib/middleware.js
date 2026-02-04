function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.status(200).end();
        return true;
    }
    return false;
}

function sendSuccess(res, data, statusCode = 200) {
    setCorsHeaders(res);
    res.status(statusCode).json({
        success: true,
        ...data
    });
}

function sendError(res, message, statusCode = 500, details = null) {
    setCorsHeaders(res);
    const response = {
        success: false,
        error: message
    };
    if (details && process.env.NODE_ENV !== 'production') {
        response.details = details;
    }
    res.status(statusCode).json(response);
}

function asyncHandler(handler) {
    return async (req, res) => {
        setCorsHeaders(res);
        
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }
        
        try {
            await handler(req, res);
        } catch (error) {
            console.error(`API Error [${req.url}]:`, error);
            sendError(res, 'Sunucu hatası', 500, error.message);
        }
    };
}

function validateMethod(req, res, allowedMethods) {
    if (!allowedMethods.includes(req.method)) {
        sendError(res, 'Method not allowed', 405);
        return false;
    }
    return true;
}

function validateRequired(data, fields) {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
        return {
            valid: false,
            message: `Eksik alanlar: ${missing.join(', ')}`
        };
    }
    return { valid: true };
}

module.exports = {
    setCorsHeaders,
    handleOptions,
    sendSuccess,
    sendError,
    asyncHandler,
    validateMethod,
    validateRequired
};
