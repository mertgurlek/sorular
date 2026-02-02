// Storage Keys - Merkezi tanım
const STORAGE_KEYS = {
    WRONG_ANSWERS: 'yds_wrong_answers',
    UNKNOWN_WORDS: 'yds_unknown_words',
    STATS: 'yds_stats',
    THEME: 'yds_theme',
    DAILY_STATS: 'yds_daily_stats',
    DAILY_GOAL: 'yds_daily_goal',
    STREAK: 'yds_streak',
    FAVORITES: 'yds_favorites',
    GPT_EXPLANATIONS: 'yds_gpt_explanations',
    ANSWER_HISTORY: 'yds_answer_history',
    CURRENT_USER: 'yds_current_user'
};

// Generic storage helpers
function getItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error(`Storage get error for ${key}:`, e);
        return defaultValue;
    }
}

function setItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error(`Storage set error for ${key}:`, e);
        return false;
    }
}

function removeItem(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Storage remove error for ${key}:`, e);
        return false;
    }
}

// Wrong Answers
function getWrongAnswers() {
    return getItem(STORAGE_KEYS.WRONG_ANSWERS, []);
}

function saveWrongAnswer(question, userAnswer) {
    const wrongAnswers = getWrongAnswers();
    const exists = wrongAnswers.some(w => w.question.question_text === question.question_text);
    
    if (!exists) {
        wrongAnswers.push({
            question,
            userAnswer,
            timestamp: new Date().toISOString()
        });
        setItem(STORAGE_KEYS.WRONG_ANSWERS, wrongAnswers);
    }
    return !exists;
}

function removeWrongAnswer(index) {
    const wrongAnswers = getWrongAnswers();
    wrongAnswers.splice(index, 1);
    setItem(STORAGE_KEYS.WRONG_ANSWERS, wrongAnswers);
}

function clearWrongAnswers() {
    setItem(STORAGE_KEYS.WRONG_ANSWERS, []);
}

// Unknown Words
function getUnknownWords() {
    return getItem(STORAGE_KEYS.UNKNOWN_WORDS, []);
}

function toggleUnknownWord(word) {
    const words = getUnknownWords();
    const lowerWord = word.toLowerCase();
    const index = words.indexOf(lowerWord);
    
    if (index === -1) {
        words.push(lowerWord);
    } else {
        words.splice(index, 1);
    }
    
    setItem(STORAGE_KEYS.UNKNOWN_WORDS, words);
    return index === -1; // Returns true if word was added
}

function removeUnknownWord(word) {
    const words = getUnknownWords();
    const index = words.indexOf(word);
    if (index !== -1) {
        words.splice(index, 1);
        setItem(STORAGE_KEYS.UNKNOWN_WORDS, words);
    }
}

function clearUnknownWords() {
    setItem(STORAGE_KEYS.UNKNOWN_WORDS, []);
}

// Stats
function getStats() {
    return getItem(STORAGE_KEYS.STATS, {});
}

function updateStatsData(category, isCorrect) {
    const stats = getStats();
    
    if (!stats[category]) {
        stats[category] = { correct: 0, wrong: 0 };
    }
    
    if (isCorrect) {
        stats[category].correct++;
    } else {
        stats[category].wrong++;
    }
    
    setItem(STORAGE_KEYS.STATS, stats);
    return stats;
}

function resetStats() {
    setItem(STORAGE_KEYS.STATS, {});
    setItem(STORAGE_KEYS.DAILY_STATS, {});
    setItem(STORAGE_KEYS.STREAK, { days: 0, lastDate: null });
}

// Daily Stats
function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function getDailyStats() {
    return getItem(STORAGE_KEYS.DAILY_STATS, {});
}

function getDailyGoal() {
    return parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_GOAL) || '20');
}

function setDailyGoal(goal) {
    localStorage.setItem(STORAGE_KEYS.DAILY_GOAL, goal.toString());
}

function getStreak() {
    return getItem(STORAGE_KEYS.STREAK, { days: 0, lastDate: null });
}

function updateDailyStats() {
    const today = getTodayKey();
    const dailyStats = getDailyStats();
    
    if (!dailyStats[today]) {
        dailyStats[today] = { answered: 0, correct: 0 };
    }
    dailyStats[today].answered++;
    
    setItem(STORAGE_KEYS.DAILY_STATS, dailyStats);
    return dailyStats;
}

function updateDailyCorrect() {
    const today = getTodayKey();
    const dailyStats = getDailyStats();
    
    if (!dailyStats[today]) {
        dailyStats[today] = { answered: 0, correct: 0 };
    }
    dailyStats[today].correct++;
    
    setItem(STORAGE_KEYS.DAILY_STATS, dailyStats);
    return dailyStats;
}

// Favorites
function getFavorites() {
    return getItem(STORAGE_KEYS.FAVORITES, []);
}

function addFavorite(question) {
    const favorites = getFavorites();
    const exists = favorites.some(f => f.question_text === question.question_text);
    
    if (!exists) {
        favorites.push(question);
        setItem(STORAGE_KEYS.FAVORITES, favorites);
    }
    return !exists;
}

function removeFavorite(questionText) {
    const favorites = getFavorites();
    const index = favorites.findIndex(f => f.question_text === questionText);
    
    if (index !== -1) {
        favorites.splice(index, 1);
        setItem(STORAGE_KEYS.FAVORITES, favorites);
    }
}

function isFavorite(questionText) {
    const favorites = getFavorites();
    return favorites.some(f => f.question_text === questionText);
}

function clearFavorites() {
    setItem(STORAGE_KEYS.FAVORITES, []);
}

// Answer History
function getAnswerHistory() {
    return getItem(STORAGE_KEYS.ANSWER_HISTORY, {});
}

function getQuestionKey(question) {
    return btoa(unescape(encodeURIComponent(question.question_text.substring(0, 50)))).replace(/[^a-zA-Z0-9]/g, '');
}

function getQuestionHistory(question) {
    const history = getAnswerHistory();
    const key = getQuestionKey(question);
    return history[key] || null;
}

function saveAnswerHistory(question, userAnswer, isCorrect) {
    const history = getAnswerHistory();
    const key = getQuestionKey(question);
    
    if (!history[key]) {
        history[key] = {
            attempts: [],
            correctCount: 0,
            wrongCount: 0,
            totalAttempts: 0,
            lastCorrect: null
        };
    }
    
    history[key].attempts.push({
        answer: userAnswer,
        correct: isCorrect,
        timestamp: new Date().toISOString()
    });
    
    history[key].totalAttempts++;
    if (isCorrect) {
        history[key].correctCount++;
    } else {
        history[key].wrongCount++;
    }
    history[key].lastCorrect = isCorrect;
    
    setItem(STORAGE_KEYS.ANSWER_HISTORY, history);
    return history[key];
}

function clearAnswerHistory() {
    setItem(STORAGE_KEYS.ANSWER_HISTORY, {});
}

// Theme
function getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
}

function setTheme(theme) {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

// Current User
function getCurrentUser() {
    return getItem(STORAGE_KEYS.CURRENT_USER, null);
}

function setCurrentUser(user) {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
}

function clearCurrentUser() {
    removeItem(STORAGE_KEYS.CURRENT_USER);
}

// GPT Explanations Cache
function getGPTExplanations() {
    return getItem(STORAGE_KEYS.GPT_EXPLANATIONS, {});
}

function saveGPTExplanation(questionHash, explanation) {
    const explanations = getGPTExplanations();
    explanations[questionHash] = {
        explanation,
        timestamp: new Date().toISOString()
    };
    setItem(STORAGE_KEYS.GPT_EXPLANATIONS, explanations);
}

function getGPTExplanation(questionHash) {
    const explanations = getGPTExplanations();
    return explanations[questionHash]?.explanation || null;
}

// Export all
window.Storage = {
    KEYS: STORAGE_KEYS,
    getItem,
    setItem,
    removeItem,
    // Wrong Answers
    getWrongAnswers,
    saveWrongAnswer,
    removeWrongAnswer,
    clearWrongAnswers,
    // Unknown Words
    getUnknownWords,
    toggleUnknownWord,
    removeUnknownWord,
    clearUnknownWords,
    // Stats
    getStats,
    updateStatsData,
    resetStats,
    // Daily Stats
    getTodayKey,
    getDailyStats,
    getDailyGoal,
    setDailyGoal,
    getStreak,
    updateDailyStats,
    updateDailyCorrect,
    // Favorites
    getFavorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    clearFavorites,
    // Answer History
    getAnswerHistory,
    getQuestionKey,
    getQuestionHistory,
    saveAnswerHistory,
    clearAnswerHistory,
    // Theme
    getTheme,
    setTheme,
    // User
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    // GPT
    getGPTExplanations,
    saveGPTExplanation,
    getGPTExplanation
};
