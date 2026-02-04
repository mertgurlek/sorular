const { sendError } = require('./middleware');

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function validateUsername(username) {
    return username && username.length >= 3 && username.length <= 50;
}

function validateRegistration(req, res) {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        sendError(res, 'Tüm alanları doldurun', 400);
        return false;
    }
    
    if (!validateUsername(username)) {
        sendError(res, 'Kullanıcı adı 3-50 karakter arası olmalı', 400);
        return false;
    }
    
    if (!validateEmail(email)) {
        sendError(res, 'Geçerli bir email adresi girin', 400);
        return false;
    }
    
    if (!validatePassword(password)) {
        sendError(res, 'Şifre en az 6 karakter olmalı', 400);
        return false;
    }
    
    return true;
}

function validateLogin(req, res) {
    const { username, password } = req.body;
    
    if (!username || !password) {
        sendError(res, 'Kullanıcı adı ve şifre gerekli', 400);
        return false;
    }
    
    return true;
}

module.exports = {
    validateEmail,
    validatePassword,
    validateUsername,
    validateRegistration,
    validateLogin
};
