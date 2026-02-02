// API Configuration
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001/api' 
    : '/api';

// Generic fetch wrapper with error handling
async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    if (mergedOptions.body && typeof mergedOptions.body === 'object') {
        mergedOptions.body = JSON.stringify(mergedOptions.body);
    }
    
    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new APIError(data.error || 'API request failed', response.status, data);
        }
        
        return data;
    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        console.error(`API request failed: ${endpoint}`, error);
        throw new APIError('Sunucuya bağlanılamadı', 0, null);
    }
}

class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.data = data;
    }
}

// Auth API
const AuthAPI = {
    async login(username, password) {
        return apiRequest('/login', {
            method: 'POST',
            body: { username, password }
        });
    },
    
    async register(username, email, password) {
        return apiRequest('/register', {
            method: 'POST',
            body: { username, email, password }
        });
    },
    
    async getUser(userId) {
        return apiRequest(`/user/${userId}`);
    }
};

// Questions API
const QuestionsAPI = {
    async getCategories() {
        return apiRequest('/categories');
    },
    
    async getQuestions(category = null) {
        const params = category && category !== 'all' ? `?category=${encodeURIComponent(category)}` : '';
        return apiRequest(`/questions${params}`);
    }
};

// User Data API
const UserDataAPI = {
    async getAllData(userId) {
        return apiRequest(`/user/${userId}/all-data`);
    },
    
    // Unknown Words
    async getUnknownWords(userId) {
        return apiRequest(`/user/${userId}/unknown-words`);
    },
    
    async addUnknownWord(userId, word) {
        return apiRequest(`/user/${userId}/unknown-words`, {
            method: 'POST',
            body: { word }
        });
    },
    
    async removeUnknownWord(userId, word) {
        return apiRequest(`/user/${userId}/unknown-words/${encodeURIComponent(word)}`, {
            method: 'DELETE'
        });
    },
    
    // Answer History
    async getAnswerHistory(userId) {
        return apiRequest(`/user/${userId}/answer-history`);
    },
    
    async saveAnswerHistory(userId, data) {
        return apiRequest(`/user/${userId}/answer-history`, {
            method: 'POST',
            body: data
        });
    },
    
    // Favorites
    async getFavorites(userId) {
        return apiRequest(`/user/${userId}/favorites`);
    },
    
    async addFavorite(userId, question) {
        return apiRequest(`/user/${userId}/favorites`, {
            method: 'POST',
            body: { question }
        });
    },
    
    async removeFavorite(userId, questionText) {
        return apiRequest(`/user/${userId}/favorites`, {
            method: 'DELETE',
            body: { questionText }
        });
    },
    
    // Wrong Answers
    async getWrongAnswers(userId) {
        return apiRequest(`/user/${userId}/wrong-answers`);
    },
    
    async saveWrongAnswer(userId, data) {
        return apiRequest(`/user/${userId}/wrong-answers`, {
            method: 'POST',
            body: data
        });
    },
    
    // Daily Stats
    async getDailyStats(userId) {
        return apiRequest(`/user/${userId}/daily-stats`);
    },
    
    async updateDailyStats(userId, data) {
        return apiRequest(`/user/${userId}/daily-stats`, {
            method: 'POST',
            body: data
        });
    },
    
    // Stats
    async updateStats(userId, stats) {
        return apiRequest(`/user/${userId}/stats`, {
            method: 'POST',
            body: stats
        });
    }
};

// GPT API
const GPTAPI = {
    async getExplanation(prompt, model = 'gpt-4o-mini') {
        return apiRequest('/openai-explain', {
            method: 'POST',
            body: { prompt, model }
        });
    },
    
    async saveExplanation(questionHash, questionText, explanation) {
        return apiRequest('/gpt-explanation', {
            method: 'POST',
            body: { questionHash, questionText, explanation }
        });
    },
    
    async getCachedExplanation(hash) {
        try {
            return await apiRequest(`/gpt-explanation/${hash}`);
        } catch (e) {
            return null;
        }
    }
};

// Export all APIs
window.API = {
    URL: API_URL,
    request: apiRequest,
    APIError,
    Auth: AuthAPI,
    Questions: QuestionsAPI,
    UserData: UserDataAPI,
    GPT: GPTAPI
};
