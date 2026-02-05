const bcrypt = require('bcryptjs');
const { query } = require('../db');

class AuthService {
    async findUserByUsername(username) {
        const result = await query(
            'SELECT id, username, email, password_hash FROM users WHERE username = $1 OR email = $1',
            [username]
        );
        return result.rows[0] || null;
    }
    
    async findUserById(userId) {
        const result = await query(
            'SELECT id, username, email, created_at, last_login FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0] || null;
    }
    
    async checkUserExists(username, email) {
        const result = await query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        return result.rows.length > 0;
    }
    
    async createUser(username, email, password) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        const result = await query(
            'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
            [username, email, passwordHash]
        );
        
        const user = result.rows[0];
        
        await query(
            'INSERT INTO user_stats (user_id) VALUES ($1)',
            [user.id]
        );
        
        return user;
    }
    
    async verifyPassword(password, passwordHash) {
        return await bcrypt.compare(password, passwordHash);
    }
    
    async updateLastLogin(userId) {
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [userId]
        );
    }
    
    async getUserWithStats(userId) {
        const user = await this.findUserById(userId);
        if (!user) return null;
        
        const statsResult = await query(
            'SELECT * FROM user_stats WHERE user_id = $1',
            [userId]
        );
        
        return {
            user,
            stats: statsResult.rows[0] || null
        };
    }
}

module.exports = new AuthService();
