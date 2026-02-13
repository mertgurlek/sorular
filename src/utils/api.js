// API Configuration
// Local dev: if port is not 3001 (API server), redirect API calls to localhost:3001
// Production (Vercel): use relative /api
const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('127.'))
    && window.location.port !== '3001'
    ? 'http://localhost:3001/api'
    : '/api';

// Token management
function getAuthToken() {
    return localStorage.getItem('auth_token');
}

function setAuthToken(token) {
    if (token) {
        localStorage.setItem('auth_token', token);
    } else {
        localStorage.removeItem('auth_token');
    }
}

function clearAuth() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
}

// Generic fetch wrapper with error handling
async function apiRequest(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    // Auto-attach JWT token if available
    const token = getAuthToken();
    if (token) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }
    
    const mergedOptions = {
        ...options,
        headers: {
            ...defaultHeaders,
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
            // Auto-logout on 401 (expired/invalid token)
            if (response.status === 401 && endpoint !== '/login' && endpoint !== '/register') {
                clearAuth();
            }
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
        const data = await apiRequest('/login', {
            method: 'POST',
            body: { username, password }
        });
        if (data.token) {
            setAuthToken(data.token);
        }
        return data;
    },
    
    async register(username, email, password) {
        const data = await apiRequest('/register', {
            method: 'POST',
            body: { username, email, password }
        });
        if (data.token) {
            setAuthToken(data.token);
        }
        return data;
    },
    
    async getUser(userId) {
        return apiRequest(`/user/${userId}`);
    },
    
    logout() {
        clearAuth();
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
    },
    
    // Quiz soru seçimi — sunucu tarafında shuffle + limit
    async getQuestionsForQuiz(category, limit, shuffle = true) {
        return apiRequest('/questions/quiz', {
            method: 'POST',
            body: { category, limit, shuffle }
        });
    },
    
    // Sınav modu — YDS dağılımlı soru seçimi
    async getQuestionsForExam(examSize, distribution) {
        return apiRequest('/questions/exam', {
            method: 'POST',
            body: { examSize, distribution }
        });
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
    
    async clearUnknownWords(userId) {
        return apiRequest(`/user/${userId}/unknown-words`, {
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
    
    async clearAnswerHistory(userId) {
        return apiRequest(`/user/${userId}/answer-history`, {
            method: 'DELETE'
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
    
    async clearFavorites(userId) {
        return apiRequest(`/user/${userId}/favorites/all`, {
            method: 'DELETE'
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
    
    async clearWrongAnswers(userId) {
        return apiRequest(`/user/${userId}/wrong-answers`, {
            method: 'DELETE'
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
    },
    
    // Batch sync — tek istekte birden fazla veri türünü kaydet
    async batchSync(userId, data) {
        return apiRequest(`/user/${userId}/batch-sync`, {
            method: 'POST',
            body: data
        });
    }
};

// Sync Queue — cevapları biriktirir, debounce ile toplu gönderir
const SyncQueue = {
    _queue: { answerHistory: [], wrongAnswers: [] },
    _timer: null,
    _DEBOUNCE_MS: 5000,
    
    addAnswerHistory(item) {
        this._queue.answerHistory.push(item);
        this._scheduleFlush();
    },
    
    addWrongAnswer(item) {
        this._queue.wrongAnswers.push(item);
        this._scheduleFlush();
    },
    
    _scheduleFlush() {
        if (this._timer) clearTimeout(this._timer);
        this._timer = setTimeout(() => this.flush(), this._DEBOUNCE_MS);
    },
    
    // Quiz bitince veya sayfa kapatılırken çağır
    async flush() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        
        const token = getToken();
        if (!token) return;
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        if (!currentUser?.id) return;
        
        const answerHistory = this._queue.answerHistory.splice(0);
        const wrongAnswers = this._queue.wrongAnswers.splice(0);
        
        if (answerHistory.length === 0 && wrongAnswers.length === 0) return;
        
        // Daily stats'ı da ekle
        const todayKey = new Date().toISOString().split('T')[0];
        const dailyStatsRaw = JSON.parse(localStorage.getItem('dailyStats') || '{}');
        const todayStats = dailyStatsRaw[todayKey] || { answered: 0, correct: 0 };
        
        try {
            await UserDataAPI.batchSync(currentUser.id, {
                answerHistory,
                wrongAnswers,
                dailyStats: { date: todayKey, answered: todayStats.answered, correct: todayStats.correct }
            });
        } catch (error) {
            // Başarısız olursa kuyruğa geri ekle
            this._queue.answerHistory.unshift(...answerHistory);
            this._queue.wrongAnswers.unshift(...wrongAnswers);
            console.error('Batch sync failed, will retry:', error);
        }
    },
    
    hasPending() {
        return this._queue.answerHistory.length > 0 || this._queue.wrongAnswers.length > 0;
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

// Question Feedback & Ratings API
const FeedbackAPI = {
    async submitFeedback(questionHash, feedbackType, comment) {
        return apiRequest('/questions/feedback', {
            method: 'POST',
            body: { questionHash, feedbackType, comment }
        });
    },
    
    async rateQuestion(questionHash, rating) {
        return apiRequest('/questions/rate', {
            method: 'POST',
            body: { questionHash, rating }
        });
    },
    
    async getQuestionStats(hash) {
        try {
            return await apiRequest(`/questions/stats/${hash}`);
        } catch (e) {
            return null;
        }
    },
    
    async getMyRating(hash) {
        try {
            return await apiRequest(`/questions/my-rating/${hash}`);
        } catch (e) {
            return null;
        }
    },
    
    async getBatchStats(hashes) {
        try {
            return await apiRequest('/questions/stats-batch', {
                method: 'POST',
                body: { hashes }
            });
        } catch (e) {
            return { success: true, stats: {} };
        }
    }
};

// Sayfa kapatılırken bekleyen sync verilerini gönder
window.addEventListener('beforeunload', () => {
    if (SyncQueue.hasPending()) {
        SyncQueue.flush();
    }
});

// Export all APIs
window.API = {
    URL: API_URL,
    request: apiRequest,
    APIError,
    Auth: AuthAPI,
    Questions: QuestionsAPI,
    UserData: UserDataAPI,
    GPT: GPTAPI,
    Feedback: FeedbackAPI,
    SyncQueue,
    getAuthToken,
    setAuthToken,
    clearAuth
};
