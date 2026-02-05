// Quiz App - Main JavaScript
// Uses modular utilities from src/utils/

// Current User State
let currentUser = null;

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered:', registration.scope);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}

// ==================== AUTHENTICATION ====================
function initAuth() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('yds_current_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
    
    // Event listeners
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('guestBtn').addEventListener('click', handleGuestLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    document.getElementById('showRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
    });
    
    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
    });
    
    // Enter key support
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('registerPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    errorEl.textContent = '';
    
    if (!username || !password) {
        errorEl.textContent = 'Lütfen tüm alanları doldurun';
        return;
    }
    
    try {
        const response = await fetch(`${window.API.URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorEl.textContent = data.error || 'Giriş başarısız';
            return;
        }
        
        currentUser = data.user;
        localStorage.setItem('yds_current_user', JSON.stringify(currentUser));
        showMainApp();
        
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Sunucuya bağlanılamadı';
    }
}

async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');
    
    errorEl.textContent = '';
    
    if (!username || !email || !password) {
        errorEl.textContent = 'Lütfen tüm alanları doldurun';
        return;
    }
    
    if (password.length < 6) {
        errorEl.textContent = 'Şifre en az 6 karakter olmalı';
        return;
    }
    
    try {
        const response = await fetch(`${window.API.URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            errorEl.textContent = data.error || 'Kayıt başarısız';
            return;
        }
        
        // Auto login after registration
        currentUser = data.user;
        localStorage.setItem('yds_current_user', JSON.stringify(currentUser));
        showMainApp();
        
    } catch (error) {
        console.error('Register error:', error);
        errorEl.textContent = 'Sunucuya bağlanılamadı';
    }
}

function handleGuestLogin() {
    currentUser = { id: null, username: 'Misafir', isGuest: true };
    localStorage.setItem('yds_current_user', JSON.stringify(currentUser));
    showMainApp();
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('yds_current_user');
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    
    // Clear form fields
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
}

async function showMainApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    // Update user display
    const userInfo = document.getElementById('userInfo');
    const displayName = document.getElementById('userDisplayName');
    
    if (currentUser) {
        displayName.textContent = currentUser.username;
        if (currentUser.isGuest) {
            userInfo.classList.add('guest');
        } else {
            userInfo.classList.remove('guest');
            // Load user data from API for logged-in users
            await loadUserDataFromAPI();
        }
    }
}

// State
let allQuestions = [];
let currentQuiz = {
    questions: [],
    currentIndex: 0,
    correct: 0,
    wrong: 0,
    selectedCategory: null,
    timerLimit: 0,
    timerRemaining: 0,
    timerInterval: null,
    userAnswers: []
};

// OpenAI API Configuration - use from window.Constants (loaded from src/utils/constants.js)
// const OPENAI_CONFIG is defined in src/utils/constants.js

// Use STORAGE_KEYS from window.Storage (loaded from src/utils/storage.js)

// ==================== USER DATA SYNC ====================
// Cache for user data (loaded from API for logged-in users)
let userDataCache = {
    unknownWords: null,
    answerHistory: null,
    favorites: null,
    wrongAnswers: null,
    dailyStats: null,
    loaded: false
};

// Check if user is logged in (not guest)
function isLoggedIn() {
    return currentUser && currentUser.id && !currentUser.isGuest;
}

// Load all user data from API
async function loadUserDataFromAPI() {
    if (!isLoggedIn()) {
        userDataCache.loaded = true;
        return;
    }
    
    try {
        const response = await fetch(`${window.API.URL}/user/${currentUser.id}/all-data`);
        const data = await response.json();
        
        if (data.success) {
            userDataCache.unknownWords = data.data.unknownWords || [];
            userDataCache.answerHistory = data.data.answerHistory || {};
            userDataCache.favorites = data.data.favorites || [];
            userDataCache.wrongAnswers = data.data.wrongAnswers || [];
            userDataCache.dailyStats = data.data.dailyStats || {};
            userDataCache.loaded = true;
            
            // Also update localStorage as backup
            localStorage.setItem(window.Storage.KEYS.UNKNOWN_WORDS, JSON.stringify(userDataCache.unknownWords));
            localStorage.setItem(window.Storage.KEYS.ANSWER_HISTORY, JSON.stringify(userDataCache.answerHistory));
            localStorage.setItem(window.Storage.KEYS.FAVORITES, JSON.stringify(userDataCache.favorites));
            localStorage.setItem(window.Storage.KEYS.DAILY_STATS, JSON.stringify(userDataCache.dailyStats));
            
            console.log('✅ User data loaded from server');
        }
    } catch (error) {
        console.error('Failed to load user data from API:', error);
        // Fall back to localStorage
        userDataCache.loaded = true;
    }
}

// Sync unknown word to API
async function syncUnknownWord(word, isAdding) {
    if (!isLoggedIn()) return;
    
    try {
        if (isAdding) {
            await fetch(`${window.API.URL}/user/${currentUser.id}/unknown-words`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ word })
            });
        } else {
            await fetch(`${window.API.URL}/user/${currentUser.id}/unknown-words/${encodeURIComponent(word)}`, {
                method: 'DELETE'
            });
        }
    } catch (error) {
        console.error('Sync unknown word error:', error);
    }
}

// Sync answer history to API
async function syncAnswerHistory(question, userAnswer, isCorrect) {
    if (!isLoggedIn()) return;
    
    try {
        const questionHash = getQuestionKey(question);
        await fetch(`${window.API.URL}/user/${currentUser.id}/answer-history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionHash,
                questionText: question.question_text.substring(0, 100),
                category: question.category,
                userAnswer,
                isCorrect
            })
        });
    } catch (error) {
        console.error('Sync answer history error:', error);
    }
}

// Sync favorite to API
async function syncFavorite(question, isAdding) {
    if (!isLoggedIn()) return;
    
    try {
        if (isAdding) {
            await fetch(`${window.API.URL}/user/${currentUser.id}/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
        } else {
            await fetch(`${window.API.URL}/user/${currentUser.id}/favorites`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionText: question.question_text })
            });
        }
    } catch (error) {
        console.error('Sync favorite error:', error);
    }
}

// Sync wrong answer to API
async function syncWrongAnswer(question, userAnswer) {
    if (!isLoggedIn()) return;
    
    try {
        await fetch(`${window.API.URL}/user/${currentUser.id}/wrong-answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                questionText: question.question_text,
                category: question.category,
                userAnswer,
                correctAnswer: question.correct_answer
            })
        });
    } catch (error) {
        console.error('Sync wrong answer error:', error);
    }
}

// Sync daily stats to API
async function syncDailyStats() {
    if (!isLoggedIn()) return;
    
    try {
        const today = getTodayKey();
        const dailyStats = getDailyStats();
        const todayStats = dailyStats[today] || { answered: 0, correct: 0 };
        
        await fetch(`${window.API.URL}/user/${currentUser.id}/daily-stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: today,
                answered: todayStats.answered,
                correct: todayStats.correct
            })
        });
    } catch (error) {
        console.error('Sync daily stats error:', error);
    }
}

// Constants loaded from window.Constants (src/utils/constants.js)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTheme();
    loadCategories();
    initEventListeners();
    initFlashcardEventListeners();
    initExamEventListeners();
    initGoalEventListeners();
    initFavoriteEventListeners();
    initKeyboardShortcuts();
    updateStats();
    renderWrongAnswers();
    renderUnknownWords();
    renderFavorites();
});

// Theme
function initTheme() {
    const savedTheme = localStorage.getItem(window.Storage.KEYS.THEME);
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(window.Storage.KEYS.THEME, isDark ? 'dark' : 'light');
}

// Load Categories from PostgreSQL API
async function loadCategories() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = '<p class="loading">Sorular yükleniyor...</p>';

    try {
        // Fetch categories summary
        const categoriesResponse = await fetch(`${window.API.URL}/categories`);
        const categoriesData = await categoriesResponse.json();
        
        if (!categoriesData.success) {
            throw new Error('Failed to load categories');
        }
        
        // Fetch all questions
        const questionsResponse = await fetch(`${window.API.URL}/questions`);
        const questionsData = await questionsResponse.json();
        
        if (!questionsData.success) {
            throw new Error('Failed to load questions');
        }
        
        // Store all questions - handle nested options structure and extract extra fields
        allQuestions = questionsData.questions.map(q => {
            let optionsData = q.options;
            if (typeof optionsData === 'string') {
                try { optionsData = JSON.parse(optionsData); } catch (e) { optionsData = {}; }
            }
            
            // Extract extra fields from nested structure
            let options = [];
            let explanation_tr = null;
            let question_tr = null;
            let tip = null;
            let difficulty = null;
            let explanation = null;
            
            if (optionsData && typeof optionsData === 'object' && !Array.isArray(optionsData)) {
                options = Array.isArray(optionsData.options) ? optionsData.options : [];
                explanation_tr = optionsData.explanation_tr || null;
                question_tr = optionsData.question_tr || null;
                tip = optionsData.tip || null;
                difficulty = optionsData.difficulty || null;
                explanation = optionsData.explanation || null;
            } else if (Array.isArray(optionsData)) {
                options = optionsData;
            }
            
            // Also check top-level fields from the question object
            explanation = explanation || q.explanation || null;
            explanation_tr = explanation_tr || q.explanation_tr || null;
            tip = tip || q.tip || null;
            question_tr = question_tr || q.question_tr || null;
            
            return {
                ...q,
                options: options,
                explanation_tr: explanation_tr,
                question_tr: question_tr,
                tip: tip,
                difficulty: difficulty,
                explanation: explanation
            };
        });
        
        grid.innerHTML = '';
        
        // Create category buttons
        for (const cat of categoriesData.categories) {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.dataset.category = cat.category;
            btn.innerHTML = `
                ${cat.category}
                <span class="count">${cat.count} soru</span>
            `;
            btn.addEventListener('click', () => selectCategory(btn, cat.category));
            grid.appendChild(btn);
        }

        // Add "All Questions" option at the beginning
        const allBtn = document.createElement('button');
        allBtn.className = 'category-btn';
        allBtn.dataset.category = 'all';
        allBtn.innerHTML = `
            Tüm Sorular
            <span class="count">${categoriesData.total} soru</span>
        `;
        allBtn.addEventListener('click', () => selectCategory(allBtn, 'all'));
        grid.insertBefore(allBtn, grid.firstChild);

        // Populate filter dropdown
        const filterSelect = document.getElementById('wrongFilterCategory');
        for (const cat of categoriesData.categories) {
            const option = document.createElement('option');
            option.value = cat.category;
            option.textContent = cat.category;
            filterSelect.appendChild(option);
        }
        
        console.log(`✅ Loaded ${allQuestions.length} questions from database`);
        
    } catch (error) {
        console.error('Failed to load categories:', error);
        grid.innerHTML = `
            <p class="error-state">
                Sorular yüklenemedi. 
                <button onclick="loadCategories()" class="btn btn-small">Tekrar Dene</button>
            </p>
        `;
    }
}

function selectCategory(btn, category) {
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentQuiz.selectedCategory = category;
    document.getElementById('startQuiz').disabled = false;
}

// Event Listeners
function initEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Quiz controls
    document.getElementById('startQuiz').addEventListener('click', startQuiz);
    document.getElementById('exitQuiz').addEventListener('click', exitQuiz);
    document.getElementById('prevQuestion').addEventListener('click', prevQuestion);
    document.getElementById('nextQuestion').addEventListener('click', nextQuestion);
    document.getElementById('restartQuiz').addEventListener('click', restartQuiz);

    // Wrong answers
    document.getElementById('clearWrongAnswers').addEventListener('click', clearWrongAnswers);
    document.getElementById('wrongFilterCategory').addEventListener('change', renderWrongAnswers);

    // Unknown words
    document.getElementById('clearUnknownWords').addEventListener('click', clearUnknownWords);
    document.getElementById('wordSearch').addEventListener('input', renderUnknownWords);

    // Stats
    document.getElementById('resetStats').addEventListener('click', resetStats);
    document.getElementById('clearAnswerHistory').addEventListener('click', clearAnswerHistory);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    if (tabName === 'stats') updateStats();
    if (tabName === 'wrong-answers') renderWrongAnswers();
    if (tabName === 'unknown-words') renderUnknownWords();
    if (tabName === 'flashcards') initFlashcards();
    if (tabName === 'favorites') renderFavorites();
    if (tabName === 'challenge') loadChallengeHistory();
}

// Quiz Functions
function startQuiz() {
    const category = currentQuiz.selectedCategory;
    const countSelect = document.getElementById('questionCount').value;
    const shuffle = document.getElementById('shuffleQuestions').checked;
    const timerLimit = parseInt(document.getElementById('timerMode').value);
    const historyFilter = document.getElementById('historyFilter')?.value || 'all';

    let questions;
    
    // First filter by category
    questions = category === 'all' 
        ? [...allQuestions]
        : allQuestions.filter(q => q.category === category);
    
    // Then apply history filter
    questions = filterQuestionsByHistory(questions, historyFilter);

    if (questions.length === 0) {
        alert('Bu kategoride soru bulunamadı!');
        return;
    }

    if (shuffle) {
        questions = shuffleArray(questions);
    }

    const count = countSelect === 'all' ? questions.length : parseInt(countSelect);
    currentQuiz.questions = questions.slice(0, count);
    currentQuiz.currentIndex = 0;
    currentQuiz.correct = 0;
    currentQuiz.wrong = 0;
    currentQuiz.timerLimit = timerLimit;
    currentQuiz.timerRemaining = timerLimit;
    currentQuiz.userAnswers = new Array(questions.slice(0, count).length).fill(null);

    // Setup timer display
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerLimit > 0) {
        timerDisplay.classList.remove('hidden');
    } else {
        timerDisplay.classList.add('hidden');
    }

    document.getElementById('category-selection').classList.add('hidden');
    document.getElementById('quiz-area').classList.remove('hidden');
    document.getElementById('quiz-results').classList.add('hidden');

    document.getElementById('totalQuestions').textContent = currentQuiz.questions.length;
    showQuestion();
}

function showQuestion() {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    
    document.getElementById('currentQuestion').textContent = currentQuiz.currentIndex + 1;
    document.getElementById('correctCount').textContent = currentQuiz.correct;
    document.getElementById('wrongCount').textContent = currentQuiz.wrong;
    
    const progress = ((currentQuiz.currentIndex) / currentQuiz.questions.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // Show previous answer history if exists
    const questionHistory = getQuestionHistory(q);
    const historyIndicator = document.getElementById('historyIndicator');
    if (historyIndicator) {
        if (questionHistory) {
            const lastAttempt = questionHistory.attempts[questionHistory.attempts.length - 1];
            const statusClass = questionHistory.lastCorrect ? 'history-correct' : 'history-wrong';
            const statusIcon = questionHistory.lastCorrect ? '✓' : '✗';
            const statusText = questionHistory.lastCorrect ? 'Daha önce doğru yaptınız' : 'Daha önce yanlış yaptınız';
            historyIndicator.innerHTML = `
                <span class="history-badge ${statusClass}">
                    ${statusIcon} ${statusText} (${questionHistory.correctCount}/${questionHistory.totalAttempts})
                </span>
            `;
            historyIndicator.classList.remove('hidden');
        } else {
            historyIndicator.innerHTML = `<span class="history-badge history-new">🆕 İlk kez çözüyorsunuz</span>`;
            historyIndicator.classList.remove('hidden');
        }
    }

    // Render question text with clickable words
    const questionText = document.getElementById('questionText');
    questionText.innerHTML = makeWordsClickable(q.question_text);

    // Render options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    // Extract options - handle nested structure
    let options = q.options;
    console.log('DEBUG - Question options:', q.id, typeof options, Array.isArray(options), options);
    if (typeof options === 'string') {
        try {
            options = JSON.parse(options);
        } catch (e) {
            console.error('Failed to parse options:', e);
            options = [];
        }
    }
    // Handle nested options structure (options.options)
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else {
            options = [];
        }
    }
    if (!Array.isArray(options)) {
        options = [];
    }
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.dataset.letter = opt.letter;
        
        // Seçim butonu, metin ve üstü çiz butonu yapısı
        optionDiv.innerHTML = `
            <button class="option-select-btn" title="Cevabı Seç">${opt.letter}</button>
            <span class="text">${makeWordsClickable(opt.text)}</span>
            <button class="option-strikethrough-btn" title="Üstünü Çiz">✕</button>
        `;
        
        // Sadece butona tıklayınca cevap seçilsin
        const selectBtn = optionDiv.querySelector('.option-select-btn');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectAnswer(opt.letter);
        });
        
        // Üstü çiz butonu
        const strikeBtn = optionDiv.querySelector('.option-strikethrough-btn');
        strikeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionDiv.classList.toggle('struck-out');
        });

        optionsContainer.appendChild(optionDiv);
    });

    // Show/hide prev button
    const prevBtn = document.getElementById('prevQuestion');
    if (currentQuiz.currentIndex > 0) {
        prevBtn.classList.remove('hidden');
    } else {
        prevBtn.classList.add('hidden');
    }

    // Check if this question was already answered (revisiting)
    const previousAnswer = currentQuiz.userAnswers[currentQuiz.currentIndex];
    if (previousAnswer) {
        // Show the previous answer state - disable options and highlight
        document.querySelectorAll('#optionsContainer .option').forEach(opt => {
            opt.classList.add('disabled');
            const btn = opt.querySelector('.option-select-btn');
            if (btn) btn.disabled = true;
            
            if (opt.dataset.letter === q.correct_answer) {
                opt.classList.add('correct');
            }
            if (opt.dataset.letter === previousAnswer.letter && !previousAnswer.isCorrect) {
                opt.classList.add('wrong');
            }
            if (opt.dataset.letter === previousAnswer.letter && previousAnswer.isCorrect) {
                opt.classList.add('correct');
            }
        });
        
        // Show feedback for previously answered question
        const feedback = document.getElementById('feedback');
        feedback.classList.remove('hidden', 'correct', 'wrong');
        if (previousAnswer.isCorrect) {
            feedback.classList.add('correct');
            feedback.innerHTML = `<p id="feedbackText">✓ Doğru!</p>`;
        } else {
            feedback.classList.add('wrong');
            feedback.innerHTML = `<p id="feedbackText">✗ Yanlış! Doğru cevap: ${q.correct_answer}</p>`;
        }
        
        // Show next button if not last question
        if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
            document.getElementById('nextQuestion').classList.remove('hidden');
        } else {
            document.getElementById('nextQuestion').classList.add('hidden');
        }
    } else {
        // Reset feedback and next button for unanswered question
        document.getElementById('feedback').classList.add('hidden');
        document.getElementById('nextQuestion').classList.add('hidden');
        
        // Start timer if enabled
        startTimer();
    }

    // Add click listeners to words
    addWordClickListeners();
    
    // Update favorite button
    updateFavoriteButton();
    
    // Update GPT panel button
    if (typeof updateGPTPanelButton === 'function') {
        updateGPTPanelButton();
    }
    
    // Setup hint button
    setupHintButton(q);
}

// ==================== HINT SYSTEM ====================
function setupHintButton(question) {
    const hintArea = document.getElementById('hintArea');
    const hintBtn = document.getElementById('hintBtn');
    const hintContent = document.getElementById('hintContent');
    
    console.log('🔍 setupHintButton called:', { 
        hintArea: !!hintArea, 
        hintBtn: !!hintBtn, 
        hintContent: !!hintContent,
        tip: question.tip,
        explanation_tr: question.explanation_tr,
        question_tr: question.question_tr
    });
    
    if (!hintArea || !hintBtn || !hintContent) {
        console.error('❌ Hint elements not found!');
        return;
    }
    
    // Check if question has hint data (check multiple possible field names)
    const hasHint = question.tip || question.explanation_tr || question.question_tr || question.explanation;
    
    console.log('🔍 hasHint:', hasHint, 'fields:', {
        tip: question.tip,
        explanation_tr: question.explanation_tr,
        question_tr: question.question_tr,
        explanation: question.explanation
    });
    
    if (hasHint) {
        hintArea.classList.remove('hidden');
        hintContent.classList.add('hidden');
        hintBtn.innerHTML = '<span>💡 İpucu</span>';
        
        // Build hint content - use available fields
        let hintHtml = '';
        if (question.tip) {
            hintHtml += `<p class="hint-tip">💡 <strong>İpucu:</strong> ${question.tip}</p>`;
        }
        if (question.question_tr) {
            hintHtml += `<p class="hint-translation">🇹🇷 <strong>Türkçe:</strong> ${question.question_tr}</p>`;
        }
        // Show explanation as hint if no other hint available
        if (!question.tip && !question.question_tr) {
            const explanationText = question.explanation_tr || question.explanation;
            if (explanationText) {
                hintHtml += `<p class="hint-tip">💡 <strong>İpucu:</strong> ${explanationText}</p>`;
            }
        }
        
        hintContent.innerHTML = hintHtml || '<p>Bu soru için ipucu bulunmuyor.</p>';
        
        // Remove old listener and add new one
        const newHintBtn = hintBtn.cloneNode(true);
        hintBtn.parentNode.replaceChild(newHintBtn, hintBtn);
        newHintBtn.addEventListener('click', toggleHint);
    } else {
        hintArea.classList.add('hidden');
    }
}

function toggleHint() {
    const hintBtn = document.getElementById('hintBtn');
    const hintContent = document.getElementById('hintContent');
    
    if (!hintContent) return;
    
    const isHidden = hintContent.classList.contains('hidden');
    
    if (isHidden) {
        hintContent.classList.remove('hidden');
        hintBtn.innerHTML = '<span>💡 İpucu Gizle</span>';
        hintBtn.classList.add('active');
    } else {
        hintContent.classList.add('hidden');
        hintBtn.innerHTML = '<span>💡 İpucu</span>';
        hintBtn.classList.remove('active');
    }
}

// Timer Functions
function startTimer() {
    stopTimer(); // Clear any existing timer
    
    if (currentQuiz.timerLimit <= 0) return;
    
    currentQuiz.timerRemaining = currentQuiz.timerLimit;
    updateTimerDisplay();
    
    currentQuiz.timerInterval = setInterval(() => {
        currentQuiz.timerRemaining--;
        updateTimerDisplay();
        
        if (currentQuiz.timerRemaining <= 0) {
            stopTimer();
            timeUp();
        }
    }, 1000);
}

function stopTimer() {
    if (currentQuiz.timerInterval) {
        clearInterval(currentQuiz.timerInterval);
        currentQuiz.timerInterval = null;
    }
}

function updateTimerDisplay() {
    const timerValue = document.getElementById('timerValue');
    const timerDisplay = document.getElementById('timerDisplay');
    
    timerValue.textContent = currentQuiz.timerRemaining;
    
    // Visual feedback based on remaining time
    timerDisplay.classList.remove('warning', 'danger');
    if (currentQuiz.timerRemaining <= 10) {
        timerDisplay.classList.add('danger');
    } else if (currentQuiz.timerRemaining <= 20) {
        timerDisplay.classList.add('warning');
    }
}

function timeUp() {
    // Auto-select wrong answer when time runs out
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    
    // Disable all options
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.add('disabled');
        const btn = opt.querySelector('.option-select-btn');
        if (btn) btn.disabled = true;
        
        if (opt.dataset.letter === q.correct_answer) {
            opt.classList.add('correct');
        }
    });

    currentQuiz.wrong++;
    
    // Build explanation from database fields
    const hasDbExplanation = q.explanation_tr || q.tip || q.question_tr;
    let explanationHtml = '';
    if (hasDbExplanation) {
        explanationHtml = '<div class="db-explanation">';
        if (q.tip) explanationHtml += `<p class="explanation-tip">💡 <strong>İpucu:</strong> ${q.tip}</p>`;
        if (q.explanation_tr) explanationHtml += `<p class="explanation-text">📝 <strong>Açıklama:</strong> ${q.explanation_tr}</p>`;
        if (q.question_tr) explanationHtml += `<p class="explanation-translation">🇹🇷 <strong>Türkçe:</strong> ${q.question_tr}</p>`;
        explanationHtml += '</div>';
    }
    const gptButton = !hasDbExplanation ? `<button class="btn btn-small gpt-ask-btn" onclick="openGPTPanel()">🤖 GPT'den Açıklama İste</button>` : '';
    
    // Show feedback
    const feedback = document.getElementById('feedback');
    feedback.classList.remove('hidden', 'correct', 'wrong');
    feedback.classList.add('wrong');
    feedback.innerHTML = `
        <p id="feedbackText">⏱️ Süre doldu! Doğru cevap: ${q.correct_answer}</p>
        ${explanationHtml}
        ${gptButton}
    `;
    
    // Save wrong answer
    saveWrongAnswer(q, 'TIMEOUT');
    
    // Save answer history
    saveAnswerHistory(q, 'TIMEOUT', false);
    
    // GPT explanation disabled - user can click button manually if needed
    // if (!hasDbExplanation && typeof autoAddGPTExplanationOnWrong === 'function') {
    //     autoAddGPTExplanationOnWrong(q, 'TIMEOUT');
    // }
    
    // Update stats
    updateStatsData(q.category, false);

    // Show next button or finish
    if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
        document.getElementById('nextQuestion').classList.remove('hidden');
    } else {
        setTimeout(showResults, 1500);
    }
}

function makeWordsClickable(text) {
    const unknownWords = getUnknownWords();
    // Turkish + English characters support
    return text.replace(/([a-zA-ZçÇğĞıİöÖşŞüÜ'-]+)/g, (match) => {
        const isUnknown = unknownWords.includes(match.toLowerCase());
        return `<span class="word ${isUnknown ? 'unknown' : ''}" data-word="${match.toLowerCase()}">${match}</span>`;
    });
}

function addWordClickListeners() {
    document.querySelectorAll('.word').forEach(wordSpan => {
        wordSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            const word = wordSpan.dataset.word;
            toggleUnknownWord(word);
            
            // Update all instances of this word
            document.querySelectorAll(`.word[data-word="${word}"]`).forEach(span => {
                span.classList.toggle('unknown');
            });
        });
    });
}

function selectAnswer(letter) {
    stopTimer(); // Stop timer when answer is selected
    
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const isCorrect = letter === q.correct_answer;
    
    // Disable all options
    document.querySelectorAll('.option').forEach(opt => {
        opt.classList.add('disabled');
        const btn = opt.querySelector('.option-select-btn');
        if (btn) btn.disabled = true;
        
        if (opt.dataset.letter === q.correct_answer) {
            opt.classList.add('correct');
        }
        if (opt.dataset.letter === letter && !isCorrect) {
            opt.classList.add('wrong');
        }
    });

    // Show feedback
    const feedback = document.getElementById('feedback');
    feedback.classList.remove('hidden', 'correct', 'wrong');
    
    // Build explanation from database fields
    const hasDbExplanation = q.explanation_tr || q.tip || q.question_tr;
    let explanationHtml = '';
    if (hasDbExplanation) {
        explanationHtml = '<div class="db-explanation">';
        if (q.tip) {
            explanationHtml += `<p class="explanation-tip">💡 <strong>İpucu:</strong> ${q.tip}</p>`;
        }
        if (q.explanation_tr) {
            explanationHtml += `<p class="explanation-text">📝 <strong>Açıklama:</strong> ${q.explanation_tr}</p>`;
        }
        if (q.question_tr) {
            explanationHtml += `<p class="explanation-translation">🇹🇷 <strong>Türkçe:</strong> ${q.question_tr}</p>`;
        }
        if (q.difficulty) {
            const difficultyLabels = { easy: '🟢 Kolay', medium: '🟡 Orta', hard: '🔴 Zor' };
            explanationHtml += `<p class="explanation-difficulty"><strong>Zorluk:</strong> ${difficultyLabels[q.difficulty] || q.difficulty}</p>`;
        }
        explanationHtml += '</div>';
    }
    
    if (isCorrect) {
        currentQuiz.correct++;
        feedback.classList.add('correct');
        feedback.innerHTML = `<p id="feedbackText">✓ Doğru!</p>${explanationHtml}`;
        playSound('correct');
    } else {
        currentQuiz.wrong++;
        feedback.classList.add('wrong');
        
        // Add GPT explain button at the top for wrong answers
        const gptButtonHtml = `
            <button class="gpt-explain-inline-btn" onclick="openGPTPanel(); askGPTFromPanel();">
                🤖 Bu Soruyu Açıkla
            </button>
        `;
        
        feedback.innerHTML = `
            ${gptButtonHtml}
            <p id="feedbackText">✗ Yanlış! Doğru cevap: ${q.correct_answer}</p>
            ${explanationHtml}
        `;
        playSound('wrong');
        
        // Save wrong answer
        saveWrongAnswer(q, letter);
        
        // GPT explanation disabled - user can click button manually if needed
        // if (!hasDbExplanation && typeof autoAddGPTExplanationOnWrong === 'function') {
        //     autoAddGPTExplanationOnWrong(q, letter);
        // }
    }

    // Store user's answer for this question
    currentQuiz.userAnswers[currentQuiz.currentIndex] = { letter, isCorrect };

    // Save answer history
    saveAnswerHistory(q, letter, isCorrect);

    // Update stats
    updateStatsData(q.category, isCorrect);
    updateDailyStats();
    if (isCorrect) updateDailyCorrect();

    // Show next button or finish
    if (currentQuiz.currentIndex < currentQuiz.questions.length - 1) {
        document.getElementById('nextQuestion').classList.remove('hidden');
    } else {
        setTimeout(showResults, 1000);
    }
}

function prevQuestion() {
    if (currentQuiz.currentIndex > 0) {
        stopTimer();
        currentQuiz.currentIndex--;
        showQuestion();
    }
}

function nextQuestion() {
    currentQuiz.currentIndex++;
    showQuestion();
}

function showResults() {
    document.getElementById('quiz-area').classList.add('hidden');
    document.getElementById('quiz-results').classList.remove('hidden');

    const total = currentQuiz.correct + currentQuiz.wrong;
    const percentage = total > 0 ? Math.round((currentQuiz.correct / total) * 100) : 0;

    document.getElementById('finalCorrect').textContent = currentQuiz.correct;
    document.getElementById('finalWrong').textContent = currentQuiz.wrong;
    document.getElementById('finalPercentage').textContent = `${percentage}%`;
}

function restartQuiz() {
    document.getElementById('quiz-results').classList.add('hidden');
    document.getElementById('category-selection').classList.remove('hidden');
    currentQuiz.selectedCategory = null;
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('startQuiz').disabled = true;
}

function exitQuiz() {
    if (confirm('Quiz\'den çıkmak istediğinize emin misiniz?')) {
        stopTimer();
        restartQuiz();
        document.getElementById('quiz-area').classList.add('hidden');
    }
}

// Wrong Answers - using window.Storage from src/utils/storage.js

function saveWrongAnswer(question, userAnswer) {
    // Use storage utility and sync to API
    const wasAdded = window.Storage.saveWrongAnswer(question, userAnswer);
    
    if (wasAdded) {
        // Sync to API for logged-in users
        syncWrongAnswer(question, userAnswer);
    }
}

function removeWrongAnswer(index) {
    window.Storage.removeWrongAnswer(index);
    renderWrongAnswers();
}

async function clearWrongAnswers() {
    if (confirm('Tüm yanlış cevapları silmek istediğinize emin misiniz?')) {
        window.Storage.clearWrongAnswers();
        
        // Clear from API for logged-in users
        if (isLoggedIn()) {
            try {
                await fetch(`${window.API.URL}/user/${currentUser.id}/wrong-answers`, { method: 'DELETE' });
            } catch (error) {
                console.error('Clear wrong answers API error:', error);
            }
        }
        
        renderWrongAnswers();
    }
}

function renderWrongAnswers() {
    const container = document.getElementById('wrongAnswersList');
    const filter = document.getElementById('wrongFilterCategory').value;
    let wrongAnswers = getWrongAnswers();

    if (filter !== 'all') {
        wrongAnswers = wrongAnswers.filter(w => w.question.category === filter);
    }

    if (wrongAnswers.length === 0) {
        container.innerHTML = '<p class="empty-state">Henüz yanlış cevaplanan soru yok.</p>';
        return;
    }

    container.innerHTML = wrongAnswers.map((w, i) => `
        <div class="question-item">
            <span class="category-tag">${w.question.category}</span>
            <p class="question">${w.question.question_text}</p>
            <div class="answers">
                <span class="your-answer">Sizin cevabınız: ${w.userAnswer}</span>
                <span class="correct-answer">Doğru cevap: ${w.question.correct_answer}</span>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-primary gpt-ask-btn" onclick="askGPTExplanation(${i})">
                    🤖 GPT'ye Sor
                </button>
                <button class="btn btn-small btn-secondary" onclick="removeWrongAnswer(${i})">Kaldır</button>
            </div>
        </div>
    `).join('');
}

// ==================== ANSWER HISTORY ====================
// Using window.Storage from src/utils/storage.js

function saveAnswerHistory(question, userAnswer, isCorrect) {
    // Use storage utility for local save
    window.Storage.saveAnswerHistory(question, userAnswer, isCorrect);
    
    // Sync to API for logged-in users
    syncAnswerHistory(question, userAnswer, isCorrect);
}

function filterQuestionsByHistory(questions, filterType) {
    const history = getAnswerHistory();
    
    return questions.filter(q => {
        const key = getQuestionKey(q);
        const questionHistory = history[key];
        
        switch (filterType) {
            case 'unsolved':
                // Never attempted
                return !questionHistory;
            case 'wrong':
                // Last attempt was wrong
                return questionHistory && !questionHistory.lastCorrect;
            case 'exclude_correct':
                // Not solved correctly (unsolved OR last was wrong)
                return !questionHistory || !questionHistory.lastCorrect;
            case 'all':
            default:
                return true;
        }
    });
}

async function clearAnswerHistory() {
    if (confirm('Tüm cevap geçmişini silmek istediğinize emin misiniz?')) {
        window.Storage.clearAnswerHistory();
        
        // Clear from API for logged-in users
        if (isLoggedIn()) {
            try {
                await fetch(`${window.API.URL}/user/${currentUser.id}/answer-history`, { method: 'DELETE' });
            } catch (error) {
                console.error('Clear answer history API error:', error);
            }
        }
        
        alert('Cevap geçmişi silindi.');
    }
}

// Unknown Words - using window.Storage from src/utils/storage.js

function toggleUnknownWord(word) {
    // Use storage utility and sync to API
    const isAdding = window.Storage.toggleUnknownWord(word);
    
    // Sync to API for logged-in users
    syncUnknownWord(word.toLowerCase(), isAdding);
}

function removeUnknownWord(word) {
    window.Storage.removeUnknownWord(word);
    
    // Sync to API for logged-in users
    syncUnknownWord(word, false);
    renderUnknownWords();
}

async function clearUnknownWords() {
    if (confirm('Tüm bilmediğiniz kelimeleri silmek istediğinize emin misiniz?')) {
        window.Storage.clearUnknownWords();
        
        // Clear from API for logged-in users
        if (isLoggedIn()) {
            try {
                await fetch(`${window.API.URL}/user/${currentUser.id}/unknown-words`, { method: 'DELETE' });
            } catch (error) {
                console.error('Clear unknown words API error:', error);
            }
        }
        
        renderUnknownWords();
    }
}

function renderUnknownWords() {
    const container = document.getElementById('unknownWordsList');
    const searchTerm = document.getElementById('wordSearch').value.toLowerCase();
    let words = getUnknownWords();

    if (searchTerm) {
        words = words.filter(w => w.includes(searchTerm));
    }

    if (words.length === 0) {
        container.innerHTML = '<p class="empty-state">Henüz işaretlenmiş kelime yok.</p>';
        return;
    }

    words.sort();
    container.innerHTML = words.map(word => `
        <span class="word-tag">
            ${word}
            <span class="remove" onclick="removeUnknownWord('${word}')">&times;</span>
        </span>
    `).join('');
}

// Stats - using window.Storage from src/utils/storage.js

function updateStats() {
    const stats = getStats();
    
    let totalCorrect = 0;
    let totalWrong = 0;
    
    for (const cat of Object.values(stats)) {
        totalCorrect += cat.correct;
        totalWrong += cat.wrong;
    }
    
    const totalAnswered = totalCorrect + totalWrong;
    const percentage = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    document.getElementById('totalAnswered').textContent = totalAnswered;
    document.getElementById('totalCorrect').textContent = totalCorrect;
    document.getElementById('totalWrong').textContent = totalWrong;
    document.getElementById('overallPercentage').textContent = `${percentage}%`;
    
    // Update goal display and weekly chart
    updateGoalDisplay();
    updateWeeklyChart();

    // Category stats
    const categoryStatsContainer = document.getElementById('categoryStats');
    const categories = window.Constants.CATEGORY_NAMES;
    
    categoryStatsContainer.innerHTML = categories.map(cat => {
        const catStats = stats[cat] || { correct: 0, wrong: 0 };
        const catTotal = catStats.correct + catStats.wrong;
        const catPercentage = catTotal > 0 ? Math.round((catStats.correct / catTotal) * 100) : 0;
        
        return `
            <div class="category-stat-item">
                <span class="name">${cat}</span>
                <div class="bar">
                    <div class="bar-fill" style="width: ${catPercentage}%"></div>
                </div>
                <span class="percentage">${catPercentage}%</span>
            </div>
        `;
    }).join('');
}

function resetStats() {
    if (confirm('Tüm istatistikleri sıfırlamak istediğinize emin misiniz?')) {
        window.Storage.resetStats();
        updateStats();
    }
}

// ==================== DAILY STATS & STREAK ====================
// Using window.Storage from src/utils/storage.js

function setDailyGoal(goal) {
    window.Storage.setDailyGoal(goal);
    updateGoalDisplay();
}

function updateDailyStats() {
    // Use storage utility for local update
    window.Storage.updateDailyStats();
    
    // Update streak and goal display
    updateStreak();
    updateGoalDisplay();
    
    // Sync to API for logged-in users
    syncDailyStats();
}

function updateDailyCorrect() {
    // Use storage utility for local update
    window.Storage.updateDailyCorrect();
    
    // Sync to API for logged-in users
    syncDailyStats();
}

function updateStreak() {
    const today = getTodayKey();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];
    
    const streak = getStreak();
    const dailyStats = getDailyStats();
    const goal = getDailyGoal();
    
    // Check if goal was met today
    const todayStats = dailyStats[today] || { answered: 0 };
    
    if (todayStats.answered >= goal) {
        if (streak.lastDate === today) {
            // Already counted today
            return;
        } else if (streak.lastDate === yesterdayKey) {
            // Continue streak
            streak.days++;
            streak.lastDate = today;
        } else {
            // Start new streak
            streak.days = 1;
            streak.lastDate = today;
        }
        window.Storage.setItem(window.Storage.KEYS.STREAK, streak);
    }
}

function updateGoalDisplay() {
    const today = getTodayKey();
    const dailyStats = getDailyStats();
    const goal = getDailyGoal();
    const streak = getStreak();
    
    const todayAnswered = dailyStats[today]?.answered || 0;
    const percentage = Math.min((todayAnswered / goal) * 100, 100);
    
    document.getElementById('streakDays').textContent = streak.days;
    document.getElementById('todayAnswered').textContent = todayAnswered;
    document.getElementById('dailyGoal').textContent = goal;
    document.getElementById('goalFill').style.width = `${percentage}%`;
}

function updateWeeklyChart() {
    const chart = document.getElementById('weeklyChart');
    const dailyStats = getDailyStats();
    
    // Get last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date.toISOString().split('T')[0]);
    }
    
    // Find max value for scaling
    const values = days.map(day => dailyStats[day]?.answered || 0);
    const maxValue = Math.max(...values, 1);
    
    chart.innerHTML = days.map((day, index) => {
        const value = dailyStats[day]?.answered || 0;
        const height = (value / maxValue) * 100;
        const isToday = index === 6;
        
        return `
            <div class="chart-bar ${isToday ? 'today' : ''}">
                <div class="bar-fill" style="height: ${height}%"></div>
                ${value > 0 ? `<span class="bar-value">${value}</span>` : ''}
            </div>
        `;
    }).join('');
}

function initGoalEventListeners() {
    document.getElementById('editGoal').addEventListener('click', () => {
        document.getElementById('goalInput').value = getDailyGoal();
        document.getElementById('goalModal').classList.add('active');
    });
    
    document.getElementById('closeGoalModal').addEventListener('click', () => {
        document.getElementById('goalModal').classList.remove('active');
    });
    
    document.getElementById('goalModal').addEventListener('click', (e) => {
        if (e.target.id === 'goalModal') {
            document.getElementById('goalModal').classList.remove('active');
        }
    });
    
    document.getElementById('saveGoal').addEventListener('click', () => {
        const goal = parseInt(document.getElementById('goalInput').value) || 20;
        setDailyGoal(Math.max(5, Math.min(200, goal)));
        document.getElementById('goalModal').classList.remove('active');
    });
}

// ==================== FAVORITES ====================
// Using window.Storage from src/utils/storage.js

function toggleFavorite() {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const isCurrentlyFavorite = isFavorite(q.question_text);
    
    if (isCurrentlyFavorite) {
        window.Storage.removeFavorite(q.question_text);
    } else {
        window.Storage.addFavorite(q);
    }
    
    updateFavoriteButton();
    
    // Sync to API for logged-in users
    syncFavorite(q, !isCurrentlyFavorite);
}

function updateFavoriteButton() {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const btn = document.getElementById('favoriteBtn');
    const icon = btn.querySelector('.fav-icon');
    
    if (isFavorite(q.question_text)) {
        btn.classList.add('active');
        icon.textContent = '★';
    } else {
        btn.classList.remove('active');
        icon.textContent = '☆';
    }
}

function removeFavorite(index) {
    const favorites = getFavorites();
    const removedQuestion = favorites[index];
    
    if (removedQuestion) {
        window.Storage.removeFavorite(removedQuestion.question_text);
        // Sync to API for logged-in users
        syncFavorite(removedQuestion, false);
    }
    
    renderFavorites();
}

async function clearFavorites() {
    if (confirm('Tüm favorileri silmek istediğinize emin misiniz?')) {
        window.Storage.clearFavorites();
        
        // Clear from API for logged-in users
        if (isLoggedIn()) {
            try {
                await fetch(`${window.API.URL}/user/${currentUser.id}/favorites/all`, { method: 'DELETE' });
            } catch (error) {
                console.error('Clear favorites API error:', error);
            }
        }
        
        renderFavorites();
    }
}

function renderFavorites() {
    const container = document.getElementById('favoritesList');
    const filter = document.getElementById('favFilterCategory').value;
    let favorites = getFavorites();

    if (filter !== 'all') {
        favorites = favorites.filter(f => f.category === filter);
    }

    if (favorites.length === 0) {
        container.innerHTML = '<p class="empty-state">Henüz favori soru eklenmedi.</p>';
        return;
    }

    container.innerHTML = favorites.map((q, i) => `
        <div class="question-item favorite-item">
            <span class="category-tag">${q.category}</span>
            <p class="question">${q.question_text}</p>
            <div class="answers">
                <span class="correct-answer">Doğru cevap: ${q.correct_answer}</span>
            </div>
            <div class="actions">
                <button class="btn btn-small btn-secondary" onclick="removeFavorite(${i})">Kaldır</button>
            </div>
        </div>
    `).join('');
}

function quizFromFavorites() {
    const favorites = getFavorites();
    
    if (favorites.length === 0) {
        alert('Favorilerde soru yok!');
        return;
    }
    
    currentQuiz.questions = shuffleArray([...favorites]);
    currentQuiz.currentIndex = 0;
    currentQuiz.correct = 0;
    currentQuiz.wrong = 0;
    currentQuiz.selectedCategory = 'favorites';
    currentQuiz.timerLimit = 0;

    // Switch to quiz tab
    switchTab('quiz');
    
    document.getElementById('category-selection').classList.add('hidden');
    document.getElementById('quiz-area').classList.remove('hidden');
    document.getElementById('quiz-results').classList.add('hidden');
    document.getElementById('timerDisplay').classList.add('hidden');

    document.getElementById('totalQuestions').textContent = currentQuiz.questions.length;
    showQuestion();
}

function initFavoriteEventListeners() {
    document.getElementById('favoriteBtn').addEventListener('click', toggleFavorite);
    document.getElementById('clearFavorites').addEventListener('click', clearFavorites);
    document.getElementById('favFilterCategory').addEventListener('change', renderFavorites);
    document.getElementById('quizFromFavorites').addEventListener('click', quizFromFavorites);
    
    // Populate filter dropdown
    const filterSelect = document.getElementById('favFilterCategory');
    for (const name of window.Constants.CATEGORY_NAMES) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterSelect.appendChild(option);
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only handle shortcuts when quiz is active
        const quizArea = document.getElementById('quiz-area');
        const examArea = document.getElementById('exam-area');
        
        if (!quizArea.classList.contains('hidden')) {
            handleQuizKeyboard(e);
        } else if (!examArea.classList.contains('hidden')) {
            handleExamKeyboard(e);
        }
        
        // Flashcard shortcuts
        const flashcardArea = document.getElementById('flashcard-area');
        if (flashcardArea && !flashcardArea.classList.contains('hidden')) {
            handleFlashcardKeyboard(e);
        }
    });
}

function handleQuizKeyboard(e) {
    if (!e.key) return; // Guard against undefined key
    const key = e.key.toUpperCase();
    const feedback = document.getElementById('feedback');
    
    // If already answered, only handle Enter/Space for next
    if (!feedback.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const nextBtn = document.getElementById('nextQuestion');
            if (!nextBtn.classList.contains('hidden')) {
                nextQuestion();
            }
        }
        return;
    }
    
    // Answer selection with A, B, C, D, E
    if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        e.preventDefault();
        selectAnswer(key);
    }
    
    // Number keys 1-5 also work
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const letters = ['A', 'B', 'C', 'D', 'E'];
        selectAnswer(letters[parseInt(e.key) - 1]);
    }
}

function handleExamKeyboard(e) {
    const key = e.key.toUpperCase();
    
    // Answer selection
    if (['A', 'B', 'C', 'D', 'E'].includes(key)) {
        e.preventDefault();
        selectExamAnswer(key);
    }
    
    // Navigation
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        examNextQuestion();
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        examPrevQuestion();
    }
}

function handleFlashcardKeyboard(e) {
    // Space to flip card
    if (e.key === ' ') {
        e.preventDefault();
        flipFlashcard();
    }
    
    // Arrow keys for navigation
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextFlashcard(true); // Known
    }
    if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextFlashcard(false); // Unknown
    }
    
    // 1 for unknown, 2 for known
    if (e.key === '1') {
        e.preventDefault();
        nextFlashcard(false);
    }
    if (e.key === '2') {
        e.preventDefault();
        nextFlashcard(true);
    }
}

// ==================== SOUND EFFECTS ====================
const sounds = {
    correct: null,
    wrong: null,
    click: null
};

function initSounds() {
    // Create audio context for generating sounds
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            sounds.context = new AudioContext();
        }
    } catch (e) {
        console.log('Audio not supported');
    }
}

function playSound(type) {
    if (!sounds.context) return;
    
    const ctx = sounds.context;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'correct') {
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
    }
}

// Initialize sounds on first user interaction
document.addEventListener('click', () => {
    if (!sounds.context) {
        initSounds();
    }
}, { once: true });

// ==================== SWIPE SUPPORT ====================
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function initSwipeSupport() {
    const quizArea = document.getElementById('quiz-area');
    const flashcardArea = document.getElementById('flashcard-area');
    const examArea = document.getElementById('exam-area');
    
    // Quiz swipe
    if (quizArea) {
        quizArea.addEventListener('touchstart', handleTouchStart, { passive: true });
        quizArea.addEventListener('touchend', handleQuizSwipe, { passive: true });
    }
    
    // Flashcard swipe
    if (flashcardArea) {
        flashcardArea.addEventListener('touchstart', handleTouchStart, { passive: true });
        flashcardArea.addEventListener('touchend', handleFlashcardSwipe, { passive: true });
    }
    
    // Exam swipe
    if (examArea) {
        examArea.addEventListener('touchstart', handleTouchStart, { passive: true });
        examArea.addEventListener('touchend', handleExamSwipe, { passive: true });
    }
}

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleQuizSwipe(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);
    
    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(diffX) > 50 && diffY < 100) {
        const feedback = document.getElementById('feedback');
        
        // Only allow swipe to next question after answering
        if (!feedback.classList.contains('hidden') && diffX < -50) {
            // Swipe left = next question
            const nextBtn = document.getElementById('nextQuestion');
            if (!nextBtn.classList.contains('hidden')) {
                nextQuestion();
            }
        }
    }
}

function handleFlashcardSwipe(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);
    
    if (Math.abs(diffX) > 50 && diffY < 100) {
        if (diffX < -50) {
            // Swipe left = unknown
            nextFlashcard(false);
        } else if (diffX > 50) {
            // Swipe right = known
            nextFlashcard(true);
        }
    }
}

function handleExamSwipe(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);
    
    if (Math.abs(diffX) > 50 && diffY < 100) {
        if (diffX < -50) {
            // Swipe left = next question
            examNextQuestion();
        } else if (diffX > 50) {
            // Swipe right = previous question
            examPrevQuestion();
        }
    }
}

// Initialize swipe after DOM loaded
document.addEventListener('DOMContentLoaded', initSwipeSupport);

// Utility - using window.Helpers.shuffleArray from src/utils/helpers.js

// ==================== EXAM SIMULATION ====================
let examState = {
    questions: [],
    answers: [], // User's answers for each question
    currentIndex: 0,
    timerInterval: null,
    totalTime: 150 * 60, // 150 minutes in seconds
    timeRemaining: 150 * 60,
    startTime: null,
    examSize: 'full' // mini, medium, full
};

function initExamEventListeners() {
    document.getElementById('startExam').addEventListener('click', startExam);
    document.getElementById('submitExam').addEventListener('click', () => submitExam(false));
    document.getElementById('examPrevQ').addEventListener('click', examPrevQuestion);
    document.getElementById('examNextQ').addEventListener('click', examNextQuestion);
    document.getElementById('newExam').addEventListener('click', resetExam);
    document.getElementById('reviewExam').addEventListener('click', reviewExam);
    
    // Exam size selector listeners
    document.querySelectorAll('input[name="examSize"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateExamDistributionPreview(e.target.value);
        });
    });
    
    // Initialize distribution preview
    updateExamDistributionPreview('full');
}

// Update distribution preview when exam size changes
function updateExamDistributionPreview(size) {
    const container = document.getElementById('examDistributionPreview');
    if (!container) return;
    
    const distribution = window.Constants.YDS_DISTRIBUTION[size];
    if (!distribution) return;
    
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    
    container.innerHTML = Object.entries(distribution).map(([cat, count]) => {
        const shortName = cat.replace('YDS ', '').replace(' Soruları', '');
        return `
            <div class="distribution-item">
                <span class="cat-name" title="${cat}">${shortName}</span>
                <span class="cat-count">${count}</span>
            </div>
        `;
    }).join('') + `
        <div class="distribution-item" style="background: var(--accent-glow);">
            <span class="cat-name"><strong>Toplam</strong></span>
            <span class="cat-count"><strong>${total}</strong></span>
        </div>
    `;
}

// Gerçek YDS dağılımına göre soru seç
function selectQuestionsWithYDSDistribution(allQuestions, examSize = 'full') {
    const distribution = window.Constants.YDS_DISTRIBUTION[examSize];
    const selectedQuestions = [];
    
    // Her YDS kategorisi için soruları grupla
    const questionsByCategory = {};
    
    for (const [ydsCategory, dbCategories] of Object.entries(window.Constants.CATEGORY_MAPPING)) {
        questionsByCategory[ydsCategory] = allQuestions.filter(q => 
            dbCategories.some(dbCat => q.category === dbCat || q.category?.includes(dbCat))
        );
    }
    
    // Dağılıma göre seç
    for (const [category, count] of Object.entries(distribution)) {
        const available = questionsByCategory[category] || [];
        const shuffled = shuffleArray([...available]);
        const selected = shuffled.slice(0, count);
        selectedQuestions.push(...selected);
    }
    
    // Eksik varsa diğer sorulardan tamamla
    const targetCount = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (selectedQuestions.length < targetCount) {
        const selectedIds = new Set(selectedQuestions.map(q => q.id));
        const remaining = allQuestions.filter(q => !selectedIds.has(q.id));
        const shuffledRemaining = shuffleArray([...remaining]);
        const needed = targetCount - selectedQuestions.length;
        selectedQuestions.push(...shuffledRemaining.slice(0, needed));
    }
    
    // Son karıştırma
    return shuffleArray(selectedQuestions);
}

function startExam() {
    // Get selected exam size
    const selectedSize = document.querySelector('input[name="examSize"]:checked')?.value || 'full';
    examState.examSize = selectedSize;
    
    // Select questions with YDS distribution
    examState.questions = selectQuestionsWithYDSDistribution(allQuestions, selectedSize);
    
    // Set time limit based on exam size
    examState.totalTime = window.Constants.EXAM_TIME_LIMITS[selectedSize];
    examState.answers = new Array(examState.questions.length).fill(null);
    examState.currentIndex = 0;
    examState.timeRemaining = examState.totalTime;
    examState.startTime = Date.now();

    document.getElementById('exam-setup').classList.add('hidden');
    document.getElementById('exam-area').classList.remove('hidden');
    document.getElementById('exam-results').classList.add('hidden');

    document.getElementById('examTotalQ').textContent = examState.questions.length;
    
    buildExamNavigation();
    showExamQuestion();
    startExamTimer();
}

function buildExamNavigation() {
    const navGrid = document.getElementById('examQuestionNav');
    navGrid.innerHTML = '';
    
    examState.questions.forEach((_, index) => {
        const btn = document.createElement('button');
        btn.className = 'q-nav-btn';
        btn.textContent = index + 1;
        btn.addEventListener('click', () => goToExamQuestion(index));
        navGrid.appendChild(btn);
    });
    
    updateExamNavigation();
}

function updateExamNavigation() {
    const buttons = document.querySelectorAll('.q-nav-btn');
    buttons.forEach((btn, index) => {
        btn.classList.remove('current', 'answered');
        if (index === examState.currentIndex) {
            btn.classList.add('current');
        }
        if (examState.answers[index] !== null) {
            btn.classList.add('answered');
        }
    });
}

function showExamQuestion() {
    const q = examState.questions[examState.currentIndex];
    
    document.getElementById('examCurrentQ').textContent = examState.currentIndex + 1;
    document.getElementById('examQuestionText').innerHTML = q.question_text;

    const optionsContainer = document.getElementById('examOptionsContainer');
    optionsContainer.innerHTML = '';
    
    // Extract options - handle nested structure
    let options = q.options;
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
    }
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        options = Array.isArray(options.options) ? options.options : [];
    }
    if (!Array.isArray(options)) options = [];
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        if (examState.answers[examState.currentIndex] === opt.letter) {
            optionDiv.classList.add('selected');
        }
        // Restore struck-out state if exists
        if (examState.struckOut && examState.struckOut[examState.currentIndex]?.includes(opt.letter)) {
            optionDiv.classList.add('struck-out');
        }
        optionDiv.dataset.letter = opt.letter;
        
        optionDiv.innerHTML = `
            <button class="option-select-btn" title="Cevabı Seç">${opt.letter}</button>
            <span class="text">${opt.text}</span>
            <button class="option-strikethrough-btn" title="Üstünü Çiz">✕</button>
        `;
        
        // Select button click
        const selectBtn = optionDiv.querySelector('.option-select-btn');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectExamAnswer(opt.letter);
        });
        
        // Strikethrough button click
        const strikeBtn = optionDiv.querySelector('.option-strikethrough-btn');
        strikeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            optionDiv.classList.toggle('struck-out');
            // Save struck-out state
            if (!examState.struckOut) examState.struckOut = {};
            if (!examState.struckOut[examState.currentIndex]) examState.struckOut[examState.currentIndex] = [];
            const idx = examState.struckOut[examState.currentIndex].indexOf(opt.letter);
            if (idx === -1) {
                examState.struckOut[examState.currentIndex].push(opt.letter);
            } else {
                examState.struckOut[examState.currentIndex].splice(idx, 1);
            }
        });
        
        optionsContainer.appendChild(optionDiv);
    });

    // Update nav buttons
    document.getElementById('examPrevQ').disabled = examState.currentIndex === 0;
    document.getElementById('examNextQ').textContent = 
        examState.currentIndex === examState.questions.length - 1 ? 'Bitir' : 'Sonraki →';
    
    updateExamNavigation();
}

function selectExamAnswer(letter) {
    examState.answers[examState.currentIndex] = letter;
    
    document.querySelectorAll('#examOptionsContainer .option').forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.letter === letter) {
            opt.classList.add('selected');
        }
    });
    
    updateExamNavigation();
}

function goToExamQuestion(index) {
    examState.currentIndex = index;
    showExamQuestion();
}

function examPrevQuestion() {
    if (examState.currentIndex > 0) {
        examState.currentIndex--;
        showExamQuestion();
    }
}

function examNextQuestion() {
    if (examState.currentIndex < examState.questions.length - 1) {
        examState.currentIndex++;
        showExamQuestion();
    } else {
        submitExam(false);
    }
}

function startExamTimer() {
    stopExamTimer();
    updateExamTimerDisplay();
    
    examState.timerInterval = setInterval(() => {
        examState.timeRemaining--;
        updateExamTimerDisplay();
        
        if (examState.timeRemaining <= 0) {
            submitExam(true);
        }
    }, 1000);
}

function stopExamTimer() {
    if (examState.timerInterval) {
        clearInterval(examState.timerInterval);
        examState.timerInterval = null;
    }
}

function updateExamTimerDisplay() {
    const minutes = Math.floor(examState.timeRemaining / 60);
    const seconds = examState.timeRemaining % 60;
    const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerEl = document.getElementById('examTimerValue');
    const timerContainer = timerEl.parentElement;
    
    timerEl.textContent = display;
    
    timerContainer.classList.remove('warning', 'danger');
    if (examState.timeRemaining <= 300) { // 5 minutes
        timerContainer.classList.add('danger');
    } else if (examState.timeRemaining <= 900) { // 15 minutes
        timerContainer.classList.add('warning');
    }
}

function submitExam(timeUp) {
    const unanswered = examState.answers.filter(a => a === null).length;
    
    if (!timeUp && unanswered > 0) {
        if (!confirm(`${unanswered} soru cevaplanmadı. Sınavı bitirmek istediğinize emin misiniz?`)) {
            return;
        }
    }
    
    stopExamTimer();
    calculateExamResults();
}

function calculateExamResults() {
    let correct = 0;
    let wrong = 0;
    let empty = 0;
    const categoryResults = {};
    
    examState.questions.forEach((q, index) => {
        const userAnswer = examState.answers[index];
        const category = q.category || 'Diğer';
        
        if (!categoryResults[category]) {
            categoryResults[category] = { correct: 0, total: 0 };
        }
        categoryResults[category].total++;
        
        if (userAnswer === null) {
            empty++;
        } else if (userAnswer === q.correct_answer) {
            correct++;
            categoryResults[category].correct++;
        } else {
            wrong++;
            // Save to wrong answers
            saveWrongAnswer(q, userAnswer);
        }
    });
    
    const timeSpent = examState.totalTime - examState.timeRemaining;
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    
    // Display results
    document.getElementById('exam-area').classList.add('hidden');
    document.getElementById('exam-results').classList.remove('hidden');
    
    document.getElementById('examScore').textContent = correct;
    document.getElementById('examPercentage').textContent = 
        Math.round((correct / examState.questions.length) * 100) + '%';
    document.getElementById('examCorrectCount').textContent = correct;
    document.getElementById('examWrongCount').textContent = wrong;
    document.getElementById('examEmptyCount').textContent = empty;
    document.getElementById('examTimeSpent').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Category results
    const categoryContainer = document.getElementById('examCategoryResults');
    categoryContainer.innerHTML = Object.entries(categoryResults).map(([cat, data]) => `
        <div class="category-result-item">
            <span class="name">${cat}</span>
            <span class="score">${data.correct} / ${data.total}</span>
        </div>
    `).join('');
}

function resetExam() {
    document.getElementById('exam-results').classList.add('hidden');
    document.getElementById('exam-setup').classList.remove('hidden');
}

function reviewExam() {
    // Show exam area in review mode
    document.getElementById('exam-results').classList.add('hidden');
    document.getElementById('exam-area').classList.remove('hidden');
    
    // Stop timer and hide submit button
    stopExamTimer();
    document.getElementById('submitExam').classList.add('hidden');
    document.getElementById('examTimerValue').parentElement.classList.add('hidden');
    
    // Show first question with correct/wrong highlighting
    examState.currentIndex = 0;
    showExamReviewQuestion();
}

function showExamReviewQuestion() {
    const q = examState.questions[examState.currentIndex];
    const userAnswer = examState.answers[examState.currentIndex];
    
    document.getElementById('examCurrentQ').textContent = examState.currentIndex + 1;
    document.getElementById('examQuestionText').innerHTML = q.question_text;

    const optionsContainer = document.getElementById('examOptionsContainer');
    optionsContainer.innerHTML = '';
    
    // Extract options - handle nested structure
    let options = q.options;
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
    }
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        options = Array.isArray(options.options) ? options.options : [];
    }
    if (!Array.isArray(options)) options = [];
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option disabled';
        optionDiv.dataset.letter = opt.letter;
        
        if (opt.letter === q.correct_answer) {
            optionDiv.classList.add('correct');
        }
        if (opt.letter === userAnswer && userAnswer !== q.correct_answer) {
            optionDiv.classList.add('wrong');
        }
        
        optionDiv.innerHTML = `
            <button class="option-select-btn" disabled>${opt.letter}</button>
            <span class="text">${opt.text}</span>
        `;
        
        optionsContainer.appendChild(optionDiv);
    });

    document.getElementById('examPrevQ').disabled = examState.currentIndex === 0;
    document.getElementById('examNextQ').textContent = 
        examState.currentIndex === examState.questions.length - 1 ? 'Bitir' : 'Sonraki →';
    document.getElementById('examNextQ').onclick = () => {
        if (examState.currentIndex < examState.questions.length - 1) {
            examState.currentIndex++;
            showExamReviewQuestion();
        } else {
            resetExam();
            document.getElementById('submitExam').classList.remove('hidden');
            document.getElementById('examTimerValue').parentElement.classList.remove('hidden');
        }
    };
    document.getElementById('examPrevQ').onclick = () => {
        if (examState.currentIndex > 0) {
            examState.currentIndex--;
            showExamReviewQuestion();
        }
    };
    
    updateExamNavigation();
}

// ==================== FLASHCARD SYSTEM ====================
let flashcardState = {
    words: [],
    currentIndex: 0,
    known: 0,
    unknown: 0,
    isFlipped: false
};

function initFlashcards() {
    const words = getUnknownWords();
    
    if (words.length === 0) {
        document.getElementById('flashcard-empty').classList.remove('hidden');
        document.getElementById('flashcard-area').classList.add('hidden');
        document.getElementById('flashcard-complete').classList.add('hidden');
        return;
    }

    flashcardState = {
        words: [...words],
        currentIndex: 0,
        known: 0,
        unknown: 0,
        isFlipped: false
    };

    document.getElementById('flashcard-empty').classList.add('hidden');
    document.getElementById('flashcard-area').classList.remove('hidden');
    document.getElementById('flashcard-complete').classList.add('hidden');
    document.getElementById('flashcardTotal').textContent = words.length;
    
    showFlashcard();
}

function showFlashcard() {
    const word = flashcardState.words[flashcardState.currentIndex];
    
    document.getElementById('flashcardCurrent').textContent = flashcardState.currentIndex + 1;
    document.getElementById('flashcardKnown').textContent = flashcardState.known;
    document.getElementById('flashcardUnknown').textContent = flashcardState.unknown;
    document.getElementById('flashcardWord').textContent = word;
    document.getElementById('flashcardMeaning').textContent = 'Kartı çevir ve anlamı gör';
    
    // Reset flip state
    document.getElementById('flashcard').classList.remove('flipped');
    flashcardState.isFlipped = false;
    
    // Update nav buttons
    document.getElementById('flashcardPrev').disabled = flashcardState.currentIndex === 0;
}

function flipFlashcard() {
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.toggle('flipped');
    flashcardState.isFlipped = !flashcardState.isFlipped;
    
    if (flashcardState.isFlipped) {
        // Fetch meaning when flipped
        const word = flashcardState.words[flashcardState.currentIndex];
        fetchWordMeaning(word);
    }
}

function nextFlashcard(known) {
    if (known) {
        flashcardState.known++;
    } else {
        flashcardState.unknown++;
    }
    
    if (flashcardState.currentIndex < flashcardState.words.length - 1) {
        flashcardState.currentIndex++;
        showFlashcard();
    } else {
        showFlashcardComplete();
    }
}

function prevFlashcard() {
    if (flashcardState.currentIndex > 0) {
        flashcardState.currentIndex--;
        showFlashcard();
    }
}

function showFlashcardComplete() {
    document.getElementById('flashcard-area').classList.add('hidden');
    document.getElementById('flashcard-complete').classList.remove('hidden');
    document.getElementById('flashcardFinalKnown').textContent = flashcardState.known;
    document.getElementById('flashcardFinalUnknown').textContent = flashcardState.unknown;
}

function shuffleFlashcards() {
    flashcardState.words = shuffleArray(flashcardState.words);
    flashcardState.currentIndex = 0;
    flashcardState.known = 0;
    flashcardState.unknown = 0;
    showFlashcard();
}

// ==================== DICTIONARY API ====================
async function fetchWordMeaning(word) {
    const meaningEl = document.getElementById('flashcardMeaning');
    meaningEl.textContent = 'Anlam yükleniyor...';
    
    try {
        // Using Free Dictionary API
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        
        if (!response.ok) {
            meaningEl.textContent = 'Anlam bulunamadı. Sözlükte aramak için butona tıklayın.';
            return;
        }
        
        const data = await response.json();
        const meanings = data[0]?.meanings || [];
        
        if (meanings.length > 0) {
            const firstMeaning = meanings[0];
            const definition = firstMeaning.definitions[0]?.definition || 'Tanım bulunamadı';
            meaningEl.textContent = `(${firstMeaning.partOfSpeech}) ${definition}`;
        } else {
            meaningEl.textContent = 'Anlam bulunamadı';
        }
    } catch (error) {
        meaningEl.textContent = 'Anlam yüklenemedi. Sözlükte arayın.';
    }
}

async function lookupWordInDictionary(word) {
    const modal = document.getElementById('dictionaryModal');
    const content = document.getElementById('dictionaryContent');
    const modalWord = document.getElementById('modalWord');
    
    modalWord.textContent = word;
    content.innerHTML = '<p>Yükleniyor...</p>';
    modal.classList.add('active');
    
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        
        if (!response.ok) {
            content.innerHTML = `
                <p>Bu kelime için sonuç bulunamadı.</p>
                <a href="https://tureng.com/tr/turkce-ingilizce/${word}" target="_blank" class="btn btn-primary btn-small">
                    Tureng'de Ara →
                </a>
            `;
            return;
        }
        
        const data = await response.json();
        const entry = data[0];
        
        let html = '';
        
        // Phonetic
        if (entry.phonetic) {
            html += `<p class="phonetic">${entry.phonetic}</p>`;
        }
        
        // Meanings
        entry.meanings.forEach(meaning => {
            meaning.definitions.slice(0, 3).forEach(def => {
                html += `
                    <div class="dictionary-item">
                        <div class="type">${meaning.partOfSpeech}</div>
                        <div class="meaning">${def.definition}</div>
                        ${def.example ? `<div class="example" style="font-style: italic; color: var(--text-secondary); margin-top: 4px;">"${def.example}"</div>` : ''}
                    </div>
                `;
            });
        });
        
        html += `
            <a href="https://tureng.com/tr/turkce-ingilizce/${word}" target="_blank" class="btn btn-secondary btn-small" style="margin-top: 12px;">
                Tureng'de Ara →
            </a>
        `;
        
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = `
            <p>Sözlük yüklenemedi.</p>
            <a href="https://tureng.com/tr/turkce-ingilizce/${word}" target="_blank" class="btn btn-primary btn-small">
                Tureng'de Ara →
            </a>
        `;
    }
}

function closeModal() {
    document.getElementById('dictionaryModal').classList.remove('active');
}

// Flashcard event listeners
function initFlashcardEventListeners() {
    document.getElementById('flashcard').addEventListener('click', flipFlashcard);
    document.getElementById('flashcardKnownBtn').addEventListener('click', () => nextFlashcard(true));
    document.getElementById('flashcardUnknownBtn').addEventListener('click', () => nextFlashcard(false));
    document.getElementById('flashcardPrev').addEventListener('click', prevFlashcard);
    document.getElementById('flashcardNext').addEventListener('click', () => nextFlashcard(true));
    document.getElementById('shuffleFlashcards').addEventListener('click', shuffleFlashcards);
    document.getElementById('restartFlashcards').addEventListener('click', initFlashcards);
    document.getElementById('lookupWord').addEventListener('click', (e) => {
        e.stopPropagation();
        const word = flashcardState.words[flashcardState.currentIndex];
        lookupWordInDictionary(word);
    });
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('dictionaryModal').addEventListener('click', (e) => {
        if (e.target.id === 'dictionaryModal') closeModal();
    });
}

// ==================== GPT EXPLANATION SYSTEM ====================

// Store the last wrong answer for quick GPT access
let lastWrongAnswer = null;

async function askGPTForCurrentQuestion() {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    if (!q) return;
    
    // Find the user's answer from the saved wrong answers
    const wrongAnswers = getWrongAnswers();
    const wrongAnswer = wrongAnswers.find(w => w.question.question_text === q.question_text);
    const userAnswer = wrongAnswer ? wrongAnswer.userAnswer : '?';
    
    const questionHash = hashQuestion(q.question_text);
    
    // Show loading modal
    showGPTExplanationModal(q, userAnswer, null, false);
    
    try {
        // First try to get from database (shared cache)
        const dbExplanation = await getGPTExplanationFromDB(questionHash);
        if (dbExplanation) {
            saveGPTExplanationLocal(questionHash, dbExplanation);
            updateGPTModalContent(dbExplanation, true);
            return;
        }
        
        // Check local cache
        const localExplanations = getGPTExplanationsLocal();
        if (localExplanations[questionHash]) {
            updateGPTModalContent(localExplanations[questionHash].explanation, true);
            return;
        }
        
        // Fetch from GPT
        const explanation = await fetchGPTExplanation(q, userAnswer);
        
        // Save to database (shared cache)
        await saveGPTExplanationToDB(questionHash, q.question_text, explanation);
        
        // Save to local cache
        saveGPTExplanationLocal(questionHash, explanation);
        
        // Update modal
        updateGPTModalContent(explanation, false);
    } catch (error) {
        console.error('GPT API Error:', error);
        updateGPTModalContent('Açıklama yüklenirken bir hata oluştu. Lütfen tekrar deneyin.', false, true);
    }
}

// Local storage functions
function getGPTExplanationsLocal() {
    return JSON.parse(localStorage.getItem(window.Storage.KEYS.GPT_EXPLANATIONS) || '{}');
}

function saveGPTExplanationLocal(questionHash, explanation) {
    const explanations = getGPTExplanationsLocal();
    explanations[questionHash] = {
        explanation,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(window.Storage.KEYS.GPT_EXPLANATIONS, JSON.stringify(explanations));
}

// Database functions for shared cache
async function getGPTExplanationFromDB(questionHash) {
    try {
        const response = await fetch(`${window.API.URL}/gpt-explanation/${questionHash}`);
        if (response.ok) {
            const data = await response.json();
            return data.explanation;
        }
        return null;
    } catch (error) {
        console.log('DB fetch failed, using local cache:', error);
        return null;
    }
}

async function saveGPTExplanationToDB(questionHash, questionText, explanation) {
    try {
        await fetch(`${window.API.URL}/gpt-explanation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionHash, questionText, explanation })
        });
    } catch (error) {
        console.log('DB save failed:', error);
    }
}

function hashQuestion(questionText) {
    // Simple hash function for question text
    let hash = 0;
    for (let i = 0; i < questionText.length; i++) {
        const char = questionText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

async function askGPTExplanation(wrongAnswerIndex) {
    const wrongAnswers = getWrongAnswers();
    const wrongAnswer = wrongAnswers[wrongAnswerIndex];
    
    if (!wrongAnswer) {
        alert('Soru bulunamadı!');
        return;
    }
    
    const question = wrongAnswer.question;
    const userAnswer = wrongAnswer.userAnswer;
    const questionHash = hashQuestion(question.question_text);
    
    // Show loading modal
    showGPTExplanationModal(question, userAnswer, null, false);
    
    try {
        // First try to get from database (shared cache)
        const dbExplanation = await getGPTExplanationFromDB(questionHash);
        if (dbExplanation) {
            // Also save to local cache
            saveGPTExplanationLocal(questionHash, dbExplanation);
            updateGPTModalContent(dbExplanation, true, false, wrongAnswerIndex);
            return;
        }
        
        // Check local cache
        const localExplanations = getGPTExplanationsLocal();
        if (localExplanations[questionHash]) {
            updateGPTModalContent(localExplanations[questionHash].explanation, true, false, wrongAnswerIndex);
            return;
        }
        
        // No cached explanation found - show message with GPT button
        updateGPTModalContent('Bu soru için kayıtlı açıklama bulunamadı.', false, false, wrongAnswerIndex, true);
    } catch (error) {
        console.error('GPT Panel Error:', error);
        updateGPTModalContent('Açıklama yüklenirken bir hata oluştu.', false, false, wrongAnswerIndex, true);
    }
}

async function fetchGPTExplanationForQuestion(wrongAnswerIndex) {
    const wrongAnswers = getWrongAnswers();
    const wrongAnswer = wrongAnswers[wrongAnswerIndex];
    
    if (!wrongAnswer) return;
    
    const question = wrongAnswer.question;
    const userAnswer = wrongAnswer.userAnswer;
    const questionHash = hashQuestion(question.question_text);
    
    // Show loading state
    const contentEl = document.getElementById('gptExplanationContent');
    contentEl.innerHTML = `
        <div class="gpt-loading">
            <div class="loading-spinner"></div>
            <p>GPT açıklama hazırlıyor...</p>
        </div>
    `;
    
    try {
        const explanation = await fetchGPTExplanation(question, userAnswer);
        
        // Save to database (shared cache)
        await saveGPTExplanationToDB(questionHash, question.question_text, explanation);
        
        // Save to local cache
        saveGPTExplanationLocal(questionHash, explanation);
        
        // Update modal with explanation
        updateGPTModalContent(explanation, false);
    } catch (error) {
        console.error('GPT API Error:', error);
        updateGPTModalContent('GPT şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.', false, true);
    }
}

async function fetchGPTExplanation(question, userAnswer) {
    // Build prompt for GPT
    let optionsText = '';
    let options = question.options;
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
    }
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        options = Array.isArray(options.options) ? options.options : [];
    }
    if (Array.isArray(options)) {
        optionsText = options.map(o => `${o.letter}) ${o.text}`).join('\n');
    }
    
    const prompt = `Aşağıdaki YDS/YÖKDİL sorusunu öğrenciye açıkla.

📝 SORU:
${question.question_text}

📋 SEÇENEKLER:
${optionsText}

❌ Öğrencinin Cevabı: ${userAnswer}
✅ Doğru Cevap: ${question.correct_answer}

Lütfen şu formatta açıkla:

1. **Doğru Cevap Neden ${question.correct_answer}?**
   - Gramer kuralını basitçe açıkla
   - Cümlede nasıl uygulandığını göster

2. **${userAnswer} Neden Yanlış?**
   - Öğrencinin hatasını nazikçe açıkla

3. **Hatırlatma**
   - Bu konuyla ilgili kısa bir ipucu ver

Basit ve anlaşılır Türkçe kullan. Öğrenciyi motive et.`;

    const response = await fetch(`${window.API.URL}/openai-explain`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'API request failed');
    }

    const data = await response.json();
    return data.explanation || 'Açıklama alınamadı.';
}

function showGPTExplanationModal(question, userAnswer, explanation, fromCache) {
    const modal = document.getElementById('gptExplanationModal');
    const questionEl = document.getElementById('gptModalQuestion');
    const answersEl = document.getElementById('gptModalAnswers');
    const contentEl = document.getElementById('gptExplanationContent');
    const cacheIndicator = document.getElementById('gptCacheIndicator');
    
    questionEl.textContent = question.question_text;
    answersEl.innerHTML = `
        <span class="your-answer">Sizin cevabınız: ${userAnswer}</span>
        <span class="correct-answer">Doğru cevap: ${question.correct_answer}</span>
    `;
    
    if (explanation) {
        contentEl.innerHTML = formatGPTExplanation(explanation);
        cacheIndicator.style.display = fromCache ? 'block' : 'none';
    } else {
        contentEl.innerHTML = `
            <div class="gpt-loading">
                <div class="loading-spinner"></div>
                <p>GPT açıklama hazırlıyor...</p>
            </div>
        `;
        cacheIndicator.style.display = 'none';
    }
    
    modal.classList.add('active');
}

function updateGPTModalContent(content, fromCache, isError = false, wrongAnswerIndex = null, showGPTButton = false) {
    const contentEl = document.getElementById('gptExplanationContent');
    const cacheIndicator = document.getElementById('gptCacheIndicator');
    
    let html = '';
    
    if (isError) {
        html = `<div class="gpt-error">${content}</div>`;
    } else {
        html = formatGPTExplanation(content);
    }
    
    // Add "Anlamadım, GPT ile açıkla" button if cached explanation shown or no explanation found
    if ((fromCache || showGPTButton) && wrongAnswerIndex !== null) {
        html += `
            <div class="gpt-button-container" style="margin-top: 20px; text-align: center;">
                <button onclick="fetchGPTExplanationForQuestion(${wrongAnswerIndex})" class="gpt-explain-btn" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: transform 0.2s, box-shadow 0.2s;
                ">
                    <span>🤖</span>
                    <span>${showGPTButton ? 'GPT ile Açıkla' : 'Anlamadım, GPT ile Detaylı Açıkla'}</span>
                </button>
            </div>
        `;
    }
    
    contentEl.innerHTML = html;
    cacheIndicator.style.display = fromCache ? 'block' : 'none';
}

function formatGPTExplanation(text) {
    // Convert markdown-like formatting to HTML with better styling
    let formatted = text
        // Headers with emojis (section titles)
        .replace(/\*\*🎯 DOĞRU CEVAP NEDENİ:\*\*/g, '<div class="gpt-section correct-section"><h4>🎯 Doğru Cevap Nedeni</h4>')
        .replace(/\*\*❌ YANLIŞ CEVAP ANALİZİ:\*\*/g, '</div><div class="gpt-section wrong-section"><h4>❌ Yanlış Cevap Analizi</h4>')
        .replace(/\*\*📚 GRAMER KURALI:\*\*/g, '</div><div class="gpt-section grammar-section"><h4>📚 Gramer Kuralı</h4>')
        .replace(/\*\*💡 İPUCU:\*\*/g, '</div><div class="gpt-section tip-section"><h4>💡 İpucu</h4>')
        // Bold text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic text
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap in paragraph and close last section
    formatted = '<p>' + formatted + '</p></div>';
    
    // Clean up empty paragraphs
    formatted = formatted.replace(/<p><\/p>/g, '').replace(/<p><br>/g, '<p>');
    
    return formatted;
}

function closeGPTModal() {
    document.getElementById('gptExplanationModal').classList.remove('active');
}

// Initialize GPT modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeGPTModal');
    const modal = document.getElementById('gptExplanationModal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGPTModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'gptExplanationModal') {
                closeGPTModal();
            }
        });
    }
});

// ==================== GPT CHAT PANEL SYSTEM ====================
let gptPanelState = {
    isOpen: false,
    messages: [], // Store chat history for current session
    currentQuestionHash: null
};

function initGPTPanel() {
    const toggleBtn = document.getElementById('gptPanelToggle');
    const closeBtn = document.getElementById('closeGptPanel');
    const askCurrentBtn = document.getElementById('askGptCurrentBtn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', openGPTPanel);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeGPTPanel);
    }
    
    if (askCurrentBtn) {
        askCurrentBtn.addEventListener('click', askGPTFromPanel);
    }
    
    // Load saved messages from session
    loadGPTPanelMessages();
}

function openGPTPanel() {
    const wrapper = document.getElementById('mainApp');
    wrapper.classList.add('panel-open');
    gptPanelState.isOpen = true;
    updateGPTPanelButton();
    
    // Scroll to bottom of messages
    const messagesContainer = document.getElementById('gptChatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

function closeGPTPanel() {
    const wrapper = document.getElementById('mainApp');
    wrapper.classList.remove('panel-open');
    gptPanelState.isOpen = false;
}

function toggleGPTPanel() {
    if (gptPanelState.isOpen) {
        closeGPTPanel();
    } else {
        openGPTPanel();
    }
}

function updateGPTPanelButton() {
    const askBtn = document.getElementById('askGptCurrentBtn');
    const quizArea = document.getElementById('quiz-area');
    
    if (askBtn) {
        // Enable button only when quiz is active
        const isQuizActive = quizArea && !quizArea.classList.contains('hidden');
        askBtn.disabled = !isQuizActive;
        
        if (isQuizActive && currentQuiz.questions[currentQuiz.currentIndex]) {
            const q = currentQuiz.questions[currentQuiz.currentIndex];
            askBtn.innerHTML = `
                <span class="btn-icon">💡</span>
                <span>Soru ${currentQuiz.currentIndex + 1}'i Açıkla</span>
            `;
        } else {
            askBtn.innerHTML = `
                <span class="btn-icon">💡</span>
                <span>Bu Soruyu Açıkla</span>
            `;
        }
    }
}

function updateGPTBadge(count) {
    const badge = document.getElementById('gptBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }
}

async function askGPTFromPanel() {
    const quizArea = document.getElementById('quiz-area');
    if (!quizArea || quizArea.classList.contains('hidden')) {
        return;
    }
    
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    if (!q) return;
    
    // Find user's answer
    const wrongAnswers = getWrongAnswers();
    const wrongAnswer = wrongAnswers.find(w => w.question.question_text === q.question_text);
    const userAnswer = wrongAnswer ? wrongAnswer.userAnswer : '?';
    
    await addGPTMessageToPanel(q, userAnswer);
}

async function addGPTMessageToPanel(question, userAnswer) {
    const messagesContainer = document.getElementById('gptChatMessages');
    const questionHash = hashQuestion(question.question_text);
    
    // Remove welcome message if exists
    const welcomeMsg = messagesContainer.querySelector('.gpt-welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    // Check if this question already has a message
    const existingMsg = messagesContainer.querySelector(`[data-question-hash="${questionHash}"]`);
    if (existingMsg) {
        // Scroll to existing message
        existingMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        existingMsg.style.animation = 'none';
        existingMsg.offsetHeight; // Trigger reflow
        existingMsg.style.animation = 'highlight 1s ease';
        return;
    }
    
    // Create loading message
    const messageId = `gpt-msg-${Date.now()}`;
    const loadingHtml = `
        <div class="gpt-message loading" id="${messageId}" data-question-hash="${questionHash}">
            <div class="gpt-message-header">
                <div class="gpt-message-question">${truncateText(question.question_text, 100)}</div>
                <div class="gpt-message-answers">
                    <span class="user-ans">❌ ${userAnswer}</span>
                    <span class="correct-ans">✓ ${question.correct_answer}</span>
                </div>
            </div>
            <div class="loading-spinner"></div>
            <p>GPT açıklama hazırlıyor...</p>
        </div>
    `;
    
    messagesContainer.insertAdjacentHTML('beforeend', loadingHtml);
    
    // Scroll to new message
    const newMsg = document.getElementById(messageId);
    if (newMsg) {
        newMsg.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    
    try {
        // First try to get from database (shared cache)
        let explanation = await getGPTExplanationFromDB(questionHash);
        let fromCache = true;
        
        if (!explanation) {
            // Check local cache
            const localExplanations = getGPTExplanationsLocal();
            if (localExplanations[questionHash]) {
                explanation = localExplanations[questionHash].explanation;
            }
        }
        
        if (!explanation) {
            // Fetch from GPT
            fromCache = false;
            explanation = await fetchGPTExplanation(question, userAnswer);
            
            // Save to database and local cache
            await saveGPTExplanationToDB(questionHash, question.question_text, explanation);
            saveGPTExplanationLocal(questionHash, explanation);
        }
        
        // Update message with explanation
        updateGPTPanelMessage(messageId, question, userAnswer, explanation, fromCache);
        
        // Save to panel state
        gptPanelState.messages.push({
            questionHash,
            question: question.question_text,
            userAnswer,
            correctAnswer: question.correct_answer,
            explanation,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('GPT Panel Error:', error);
        updateGPTPanelMessage(messageId, question, userAnswer, 'Açıklama yüklenirken bir hata oluştu.', false, true);
    }
}

function updateGPTPanelMessage(messageId, question, userAnswer, content, fromCache, isError = false) {
    const msgEl = document.getElementById(messageId);
    if (!msgEl) return;
    
    const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    msgEl.classList.remove('loading');
    msgEl.innerHTML = `
        <div class="gpt-message-header">
            <div class="gpt-message-question">${truncateText(question.question_text, 100)}</div>
            <div class="gpt-message-answers">
                <span class="user-ans">❌ ${userAnswer}</span>
                <span class="correct-ans">✓ ${question.correct_answer}</span>
            </div>
        </div>
        <div class="gpt-message-content ${isError ? 'gpt-error' : ''}">
            ${isError ? content : formatGPTExplanation(content)}
        </div>
        <div class="gpt-message-time">
            ${fromCache ? '💾 Kayıtlı • ' : ''}${time}
        </div>
    `;
    
    // Scroll to updated message
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function loadGPTPanelMessages() {
    // Load from session storage if available
    const saved = sessionStorage.getItem('gpt_panel_messages');
    if (saved) {
        try {
            gptPanelState.messages = JSON.parse(saved);
            renderGPTPanelMessages();
        } catch (e) {
            console.log('Failed to load GPT panel messages');
        }
    }
}

function renderGPTPanelMessages() {
    const messagesContainer = document.getElementById('gptChatMessages');
    if (!messagesContainer || gptPanelState.messages.length === 0) return;
    
    // Remove welcome message
    const welcomeMsg = messagesContainer.querySelector('.gpt-welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    gptPanelState.messages.forEach((msg, index) => {
        const messageId = `gpt-msg-saved-${index}`;
        const time = new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        const html = `
            <div class="gpt-message" id="${messageId}" data-question-hash="${msg.questionHash}">
                <div class="gpt-message-header">
                    <div class="gpt-message-question">${truncateText(msg.question, 100)}</div>
                    <div class="gpt-message-answers">
                        <span class="user-ans">❌ ${msg.userAnswer}</span>
                        <span class="correct-ans">✓ ${msg.correctAnswer}</span>
                    </div>
                </div>
                <div class="gpt-message-content">
                    ${formatGPTExplanation(msg.explanation)}
                </div>
                <div class="gpt-message-time">
                    💾 Kayıtlı • ${time}
                </div>
            </div>
        `;
        
        messagesContainer.insertAdjacentHTML('beforeend', html);
    });
}

// Auto-add GPT explanation when user answers wrong
function autoAddGPTExplanationOnWrong(question, userAnswer) {
    // Add to panel automatically
    addGPTMessageToPanel(question, userAnswer);
    
    // Show badge if panel is closed
    if (!gptPanelState.isOpen) {
        const currentBadge = document.getElementById('gptBadge');
        const currentCount = parseInt(currentBadge?.textContent || '0');
        updateGPTBadge(currentCount + 1);
    }
}

// Initialize GPT Panel on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initGPTPanel();
});

// Update panel button when question changes
function onQuestionChange() {
    updateGPTPanelButton();
    
    // Clear badge when panel is open
    if (gptPanelState.isOpen) {
        updateGPTBadge(0);
    }
}

// Make functions globally accessible for onclick handlers
window.removeWrongAnswer = removeWrongAnswer;
window.removeUnknownWord = removeUnknownWord;
window.lookupWordInDictionary = lookupWordInDictionary;
window.removeFavorite = removeFavorite;
window.askGPTExplanation = askGPTExplanation;
window.askGPTForCurrentQuestion = askGPTForCurrentQuestion;
window.closeGPTModal = closeGPTModal;
window.openGPTPanel = openGPTPanel;
window.closeGPTPanel = closeGPTPanel;
window.toggleGPTPanel = toggleGPTPanel;

// ==================== CHALLENGE MODE ====================
let challengeState = {
    roomCode: null,
    roomData: null,
    isAdmin: false,
    username: null,
    isReady: false,
    pollInterval: null,
    currentQuestionIndex: 0,
    correctCount: 0,
    wrongCount: 0,
    answerStartTime: null,
    lives: 3,
    isEliminated: false,
    userAnswers: {},
    questionCache: {}
};

function initChallenge() {
    // Menu buttons
    document.getElementById('createRoomBtn').addEventListener('click', showCreateRoomForm);
    document.getElementById('joinRoomBtn').addEventListener('click', showJoinRoomForm);
    
    // Create room
    document.getElementById('backFromCreate').addEventListener('click', showChallengeMenu);
    document.getElementById('submitCreateRoom').addEventListener('click', handleCreateRoom);
    
    // Join room
    document.getElementById('backFromJoin').addEventListener('click', showChallengeMenu);
    document.getElementById('submitJoinRoom').addEventListener('click', handleJoinRoom);
    document.getElementById('joinRoomCode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleJoinRoom();
    });
    
    // Lobby
    document.getElementById('readyBtn').addEventListener('click', handleToggleReady);
    document.getElementById('startGameBtn').addEventListener('click', handleStartGame);
    document.getElementById('leaveLobbyBtn').addEventListener('click', handleLeaveRoom);
    document.getElementById('copyRoomCode').addEventListener('click', handleCopyRoomCode);
    
    // Game
    document.getElementById('challengePrevBtn').addEventListener('click', handleChallengePrev);
    document.getElementById('challengeNextBtn').addEventListener('click', handleChallengeNext);
    
    // Results
    document.getElementById('backToChallenge').addEventListener('click', () => {
        stopPolling();
        showChallengeMenu();
    });
    
    // Mode selector - show/hide custom categories
    document.querySelectorAll('input[name="challengeMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const customSection = document.getElementById('customCategorySection');
            if (e.target.value === 'custom') {
                customSection.classList.remove('hidden');
                loadChallengeCategoryGrid();
            } else {
                customSection.classList.add('hidden');
            }
        });
    });
    
    // Load history when tab is opened
    loadChallengeHistory();
}

function getChallengeUsername() {
    if (currentUser && currentUser.username) return currentUser.username;
    return 'Misafir_' + Math.random().toString(36).substring(2, 6);
}

function showChallengeView(viewId) {
    const views = ['challenge-menu', 'create-room-form', 'join-room-form', 'room-lobby', 'challenge-game', 'challenge-results'];
    views.forEach(id => {
        document.getElementById(id).classList.toggle('hidden', id !== viewId);
    });
}

function showChallengeMenu() {
    stopPolling();
    showChallengeView('challenge-menu');
    loadChallengeHistory();
}

function showCreateRoomForm() {
    showChallengeView('create-room-form');
    document.getElementById('createRoomError').textContent = '';
    document.getElementById('roomName').value = '';
}

function showJoinRoomForm() {
    showChallengeView('join-room-form');
    document.getElementById('joinRoomError').textContent = '';
    document.getElementById('joinRoomCode').value = '';
}

async function loadChallengeCategoryGrid() {
    const grid = document.getElementById('challengeCategoryGrid');
    try {
        const data = await window.API.Questions.getCategories();
        const categories = data.categories || [];
        grid.innerHTML = categories.map(cat => `
            <div class="challenge-category-item">
                <label>${cat.category}</label>
                <input type="number" min="0" max="50" value="5" data-category="${cat.category}">
            </div>
        `).join('');
    } catch (error) {
        grid.innerHTML = '<p>Kategoriler yüklenemedi.</p>';
    }
}

async function handleCreateRoom() {
    const errorEl = document.getElementById('createRoomError');
    errorEl.textContent = '';
    
    const username = getChallengeUsername();
    const name = document.getElementById('roomName').value.trim() || `${username}'in Odası`;
    const mode = document.querySelector('input[name="challengeMode"]:checked').value;
    const livesValue = parseInt(document.getElementById('livesSelect').value);
    const enableLives = livesValue > 0;
    const maxLives = livesValue || 3;
    const timeLimit = parseInt(document.getElementById('roomTimeLimit').value) || 0;
    
    let body = {
        name,
        adminId: currentUser?.id || null,
        adminName: username,
        mode,
        enableLives,
        maxLives,
        timeLimit
    };
    
    if (mode === 'custom') {
        const categoryInputs = document.querySelectorAll('#challengeCategoryGrid input[type="number"]');
        const categoryQuestions = {};
        categoryInputs.forEach(input => {
            const count = parseInt(input.value) || 0;
            if (count > 0) {
                categoryQuestions[input.dataset.category] = count;
            }
        });
        if (Object.keys(categoryQuestions).length === 0) {
            errorEl.textContent = 'En az bir kategori seçmelisiniz';
            return;
        }
        body.categoryQuestions = categoryQuestions;
    }
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        
        if (!data.success) {
            errorEl.textContent = data.error || 'Oda oluşturulamadı';
            return;
        }
        
        challengeState.roomCode = data.room.room_code;
        challengeState.roomData = data.room;
        challengeState.isAdmin = true;
        challengeState.username = username;
        challengeState.isReady = true;
        challengeState.correctCount = 0;
        challengeState.wrongCount = 0;
        
        showLobby();
    } catch (error) {
        console.error('Create room error:', error);
        errorEl.textContent = 'Sunucuya bağlanılamadı';
    }
}

async function handleJoinRoom() {
    const errorEl = document.getElementById('joinRoomError');
    errorEl.textContent = '';
    
    const roomCode = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    if (!roomCode || roomCode.length < 4) {
        errorEl.textContent = 'Geçerli bir oda kodu girin';
        return;
    }
    
    const username = getChallengeUsername();
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode,
                userId: currentUser?.id || null,
                username
            })
        });
        const data = await response.json();
        
        if (!data.success) {
            errorEl.textContent = data.error || 'Odaya katılınamadı';
            return;
        }
        
        challengeState.roomCode = data.room.room_code;
        challengeState.roomData = data.room;
        challengeState.isAdmin = data.participant.is_admin;
        challengeState.username = username;
        challengeState.isReady = data.participant.is_ready;
        challengeState.correctCount = 0;
        challengeState.wrongCount = 0;
        
        showLobby();
    } catch (error) {
        console.error('Join room error:', error);
        errorEl.textContent = 'Sunucuya bağlanılamadı';
    }
}

function showLobby() {
    showChallengeView('room-lobby');
    
    document.getElementById('lobbyRoomName').textContent = challengeState.roomData.name;
    document.getElementById('lobbyRoomCode').textContent = challengeState.roomCode;
    document.getElementById('lobbyQuestionCount').textContent = challengeState.roomData.question_count || challengeState.roomData.actualQuestionCount || '?';
    
    if (challengeState.roomData.time_limit > 0) {
        document.getElementById('lobbyTimeLimitInfo').classList.remove('hidden');
        document.getElementById('lobbyTimeLimit').textContent = challengeState.roomData.time_limit;
    }
    
    if (challengeState.roomData.enable_lives) {
        document.getElementById('lobbyLivesInfo').classList.remove('hidden');
        document.getElementById('lobbyMaxLives').textContent = challengeState.roomData.max_lives;
    }
    
    // Show/hide admin controls
    const startBtn = document.getElementById('startGameBtn');
    startBtn.classList.toggle('hidden', !challengeState.isAdmin);
    
    // Update ready button state
    updateReadyButton();
    
    // Start polling for room state
    startPolling();
}

function updateReadyButton() {
    const readyBtn = document.getElementById('readyBtn');
    if (challengeState.isReady) {
        readyBtn.textContent = '❌ Hazır Değilim';
        readyBtn.className = 'btn btn-danger btn-large';
    } else {
        readyBtn.textContent = '✅ Hazırım';
        readyBtn.className = 'btn btn-success btn-large';
    }
}

async function handleToggleReady() {
    challengeState.isReady = !challengeState.isReady;
    updateReadyButton();
    
    try {
        await fetch(`${window.API.URL}/rooms/ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: challengeState.roomCode,
                username: challengeState.username,
                isReady: challengeState.isReady
            })
        });
    } catch (error) {
        console.error('Toggle ready error:', error);
    }
}

async function handleStartGame() {
    try {
        const response = await fetch(`${window.API.URL}/rooms/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: challengeState.roomCode,
                adminName: challengeState.username
            })
        });
        const data = await response.json();
        
        if (!data.success) {
            document.getElementById('lobbyStatus').textContent = data.error || 'Başlatılamadı';
            return;
        }
    } catch (error) {
        console.error('Start game error:', error);
        document.getElementById('lobbyStatus').textContent = 'Sunucu hatası';
    }
}

async function handleLeaveRoom() {
    stopPolling();
    try {
        await fetch(`${window.API.URL}/rooms/leave`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: challengeState.roomCode,
                username: challengeState.username
            })
        });
    } catch (error) {
        console.error('Leave room error:', error);
    }
    showChallengeMenu();
}

function handleCopyRoomCode() {
    navigator.clipboard.writeText(challengeState.roomCode).then(() => {
        const btn = document.getElementById('copyRoomCode');
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 2000);
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = challengeState.roomCode;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
    });
}

// Polling
function startPolling() {
    stopPolling();
    pollRoomState();
    challengeState.pollInterval = setInterval(pollRoomState, 2000);
}

function stopPolling() {
    if (challengeState.pollInterval) {
        clearInterval(challengeState.pollInterval);
        challengeState.pollInterval = null;
    }
}

async function pollRoomState() {
    if (!challengeState.roomCode) return;
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/${challengeState.roomCode}?username=${encodeURIComponent(challengeState.username)}`);
        const data = await response.json();
        
        if (!data.success) return;
        
        const room = data.room;
        const participants = data.participants;
        
        challengeState.roomData = room;
        
        // Update participant count
        const countEl = document.getElementById('lobbyParticipantCount');
        if (countEl) countEl.textContent = participants.length;
        
        // Check room status transitions
        if (room.status === 'active') {
            const gameArea = document.getElementById('challenge-game');
            if (gameArea.classList.contains('hidden')) {
                // Game just started - transition to game view
                startChallengeGame(data);
            } else {
                // Game already running - update scoreboard
                updateLiveScoreboard(participants);
                
                // Update answer status indicator
                updateAnswerStatus(data.answeredCount, data.activeParticipantCount, data.allAnswered);
                
                // Show next button for admin only when all answered
                if (challengeState.isAdmin && data.allAnswered && challengeState.userAnswers[room.current_question_index]) {
                    document.getElementById('challengeNextBtn').classList.remove('hidden');
                }
                
                // Check if question index changed (server advanced)
                if (room.current_question_index !== challengeState.currentQuestionIndex) {
                    challengeState.currentQuestionIndex = room.current_question_index;
                    displayChallengeQuestion(data);
                }
            }
        } else if (room.status === 'finished') {
            stopPolling();
            showChallengeResults();
            return;
        } else if (room.status === 'waiting') {
            // Update lobby participants list
            updateParticipantsList(participants);
        }
    } catch (error) {
        console.error('Poll error:', error);
    }
}

function updateParticipantsList(participants) {
    const list = document.getElementById('participantsList');
    if (!list) return;
    
    list.innerHTML = participants.map(p => `
        <div class="participant-item ${p.is_admin ? 'is-admin' : ''}">
            <div class="participant-name">
                ${p.username}
                ${p.is_admin ? '<span class="participant-badge">Admin</span>' : ''}
            </div>
            <div class="participant-status ${p.is_ready ? 'ready' : 'waiting'}">
                ${p.is_ready ? '✅ Hazır' : '⏳ Bekliyor'}
            </div>
        </div>
    `).join('');
    
    // Update status text
    const readyCount = participants.filter(p => p.is_ready).length;
    const statusEl = document.getElementById('lobbyStatus');
    statusEl.textContent = `${readyCount}/${participants.length} katılımcı hazır`;
    
    // Enable start button if admin and all ready
    if (challengeState.isAdmin) {
        const startBtn = document.getElementById('startGameBtn');
        const allReady = participants.every(p => p.is_ready);
        startBtn.disabled = !allReady || participants.length < 1;
        startBtn.classList.remove('hidden');
    }
}

function startChallengeGame(data) {
    showChallengeView('challenge-game');
    challengeState.currentQuestionIndex = data.room.current_question_index;
    challengeState.correctCount = 0;
    challengeState.wrongCount = 0;
    challengeState.userAnswers = {};
    challengeState.questionCache = {};
    challengeState.lives = data.room.max_lives || 3;
    challengeState.isEliminated = false;
    
    document.getElementById('challengeTotalQ').textContent = data.room.totalQuestions || data.room.question_count;
    document.getElementById('challengeCorrect').textContent = '0';
    document.getElementById('challengeWrong').textContent = '0';
    
    // Lives display
    if (data.room.enable_lives) {
        const livesDisplay = document.getElementById('challengeLivesDisplay');
        livesDisplay.classList.remove('hidden');
        updateLivesDisplay();
    }
    
    displayChallengeQuestion(data);
    updateLiveScoreboard(data.participants);
}

function displayChallengeQuestion(data) {
    const question = data.currentQuestion;
    if (!question) return;
    
    // Cache this question data for revisiting
    challengeState.questionCache[challengeState.currentQuestionIndex] = question;
    
    renderChallengeQuestion(question, data.room);
}

function renderChallengeQuestion(question, room) {
    const totalQ = room.totalQuestions || room.question_count;
    document.getElementById('challengeCurrentQ').textContent = challengeState.currentQuestionIndex + 1;
    document.getElementById('challengeTotalQ').textContent = totalQ;
    
    // Progress bar
    const progress = ((challengeState.currentQuestionIndex) / totalQ) * 100;
    document.getElementById('challengeProgressFill').style.width = `${progress}%`;
    
    // Question text - use same clickable words as main quiz
    const questionTextEl = document.getElementById('challengeQuestionText');
    if (typeof makeWordsClickable === 'function') {
        questionTextEl.innerHTML = makeWordsClickable(question.question_text);
    } else {
        questionTextEl.textContent = question.question_text;
    }
    
    // Parse options - same logic as main quiz to handle nested structure
    let options = question.options;
    if (typeof options === 'string') {
        try { options = JSON.parse(options); } catch (e) { options = []; }
    }
    if (options && typeof options === 'object' && !Array.isArray(options)) {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else {
            options = [];
        }
    }
    if (!Array.isArray(options)) {
        options = [];
    }
    
    // Render options - same structure as main quiz
    const optionsContainer = document.getElementById('challengeOptionsContainer');
    optionsContainer.innerHTML = '';
    
    options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.dataset.letter = opt.letter;
        
        optionDiv.innerHTML = `
            <button class="option-select-btn" title="Cevabı Seç">${opt.letter}</button>
            <span class="text">${typeof makeWordsClickable === 'function' ? makeWordsClickable(opt.text) : opt.text}</span>
        `;
        
        const selectBtn = optionDiv.querySelector('.option-select-btn');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleChallengeAnswer(opt.letter);
        });
        
        optionsContainer.appendChild(optionDiv);
    });
    
    // Show/hide prev button
    const prevBtn = document.getElementById('challengePrevBtn');
    if (challengeState.currentQuestionIndex > 0) {
        prevBtn.classList.remove('hidden');
    } else {
        prevBtn.classList.add('hidden');
    }
    
    // Check if this question was already answered (revisiting)
    const prevAnswer = challengeState.userAnswers[challengeState.currentQuestionIndex];
    if (prevAnswer) {
        // Show previous answer - disable options and highlight
        document.querySelectorAll('#challengeOptionsContainer .option').forEach(opt => {
            opt.style.pointerEvents = 'none';
            opt.classList.add('disabled');
            
            if (opt.dataset.letter === prevAnswer.correctAnswer) {
                opt.classList.add('correct');
            }
            if (opt.dataset.letter === prevAnswer.letter && !prevAnswer.isCorrect) {
                opt.classList.add('wrong');
            }
        });
        
        // Show feedback
        const feedbackEl = document.getElementById('challengeFeedback');
        const feedbackText = document.getElementById('challengeFeedbackText');
        feedbackEl.classList.remove('hidden');
        if (prevAnswer.isCorrect) {
            feedbackText.textContent = `✅ Doğru! +${prevAnswer.pointsEarned || 0} puan`;
            feedbackEl.className = 'feedback correct';
        } else {
            feedbackText.textContent = `❌ Yanlış! Doğru cevap: ${prevAnswer.correctAnswer}`;
            feedbackEl.className = 'feedback wrong';
        }
        
        // Show next button if admin and not viewing the latest question
        if (challengeState.isAdmin && challengeState.currentQuestionIndex === room.current_question_index) {
            document.getElementById('challengeNextBtn').classList.remove('hidden');
        } else {
            document.getElementById('challengeNextBtn').classList.add('hidden');
        }
        // Always show next to go forward to already-seen questions
        if (challengeState.currentQuestionIndex < room.current_question_index) {
            document.getElementById('challengeNextBtn').classList.remove('hidden');
        }
    } else {
        // Hide feedback, next button, and answer status for unanswered question
        document.getElementById('challengeFeedback').classList.add('hidden');
        document.getElementById('challengeNextBtn').classList.add('hidden');
        document.getElementById('challengeAnswerStatus').classList.add('hidden');
        
        // Start answer timer
        challengeState.answerStartTime = Date.now();
    }
    
    // Add click listeners to words
    if (typeof addWordClickListeners === 'function') {
        addWordClickListeners();
    }
}

async function handleChallengeAnswer(answer) {
    const answerTimeMs = Date.now() - challengeState.answerStartTime;
    
    // Disable all options
    document.querySelectorAll('#challengeOptionsContainer .option').forEach(opt => {
        opt.style.pointerEvents = 'none';
        opt.classList.add('disabled');
    });
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: challengeState.roomCode,
                username: challengeState.username,
                questionIndex: challengeState.currentQuestionIndex,
                answer,
                answerTimeMs
            })
        });
        const data = await response.json();
        
        if (!data.success) {
            console.error('Answer error:', data.error);
            return;
        }
        
        // Show feedback
        const feedbackEl = document.getElementById('challengeFeedback');
        const feedbackText = document.getElementById('challengeFeedbackText');
        feedbackEl.classList.remove('hidden');
        
        // Highlight correct/wrong options
        document.querySelectorAll('#challengeOptionsContainer .option').forEach(btn => {
            const btnLetter = btn.dataset.letter;
            if (btnLetter === data.correctAnswer) {
                btn.classList.add('correct');
            }
            if (btnLetter === answer && !data.isCorrect) {
                btn.classList.add('wrong');
            }
        });
        
        if (data.isCorrect) {
            challengeState.correctCount++;
            feedbackText.textContent = `✅ Doğru! +${data.pointsEarned} puan${data.newStreak > 1 ? ` (${data.newStreak} seri!)` : ''}`;
            feedbackEl.className = 'feedback correct';
            playSound('correct');
        } else {
            challengeState.wrongCount++;
            feedbackText.textContent = `❌ Yanlış! Doğru cevap: ${data.correctAnswer}`;
            feedbackEl.className = 'feedback wrong';
            playSound('wrong');
            
            if (data.isEliminated) {
                feedbackText.textContent += ' - Elendiniz!';
                challengeState.isEliminated = true;
            }
        }
        
        document.getElementById('challengeCorrect').textContent = challengeState.correctCount;
        document.getElementById('challengeWrong').textContent = challengeState.wrongCount;
        
        // Update lives
        if (challengeState.roomData.enable_lives) {
            challengeState.lives = data.newLives;
            updateLivesDisplay();
        }
        
        // Store user's answer for revisiting
        challengeState.userAnswers[challengeState.currentQuestionIndex] = {
            letter: answer,
            isCorrect: data.isCorrect,
            correctAnswer: data.correctAnswer,
            pointsEarned: data.pointsEarned || 0
        };
        
        // Show answer status - waiting for others
        const statusEl = document.getElementById('challengeAnswerStatus');
        statusEl.classList.remove('hidden', 'all-answered');
        document.getElementById('answerStatusText').textContent = '⏳ Diğer katılımcılar bekleniyor...';
        
        // Next button will be shown by polling when allAnswered is true
        document.getElementById('challengeNextBtn').classList.add('hidden');
        
    } catch (error) {
        console.error('Submit answer error:', error);
    }
}

function updateAnswerStatus(answeredCount, activeCount, allAnswered) {
    const statusEl = document.getElementById('challengeAnswerStatus');
    const statusText = document.getElementById('answerStatusText');
    
    // Only show when user has answered the current question
    if (!challengeState.userAnswers[challengeState.roomData.current_question_index]) {
        statusEl.classList.add('hidden');
        return;
    }
    
    statusEl.classList.remove('hidden');
    
    if (allAnswered) {
        statusEl.classList.add('all-answered');
        statusText.textContent = `✅ Tüm katılımcılar cevapladı (${answeredCount}/${activeCount})`;
    } else {
        statusEl.classList.remove('all-answered');
        statusText.textContent = `⏳ ${answeredCount}/${activeCount} katılımcı cevapladı`;
    }
}

function updateLivesDisplay() {
    const display = document.getElementById('challengeLivesDisplay');
    let hearts = '';
    for (let i = 0; i < challengeState.lives; i++) hearts += '❤️';
    for (let i = challengeState.lives; i < (challengeState.roomData.max_lives || 3); i++) hearts += '🖤';
    display.innerHTML = hearts;
}

function handleChallengePrev() {
    if (challengeState.currentQuestionIndex > 0) {
        challengeState.currentQuestionIndex--;
        const cachedQuestion = challengeState.questionCache[challengeState.currentQuestionIndex];
        if (cachedQuestion) {
            renderChallengeQuestion(cachedQuestion, challengeState.roomData);
        }
    }
}

async function handleChallengeNext() {
    // If we're viewing a previous question, just go forward through cache
    const serverIndex = challengeState.roomData.current_question_index;
    if (challengeState.currentQuestionIndex < serverIndex) {
        challengeState.currentQuestionIndex++;
        const cachedQuestion = challengeState.questionCache[challengeState.currentQuestionIndex];
        if (cachedQuestion) {
            renderChallengeQuestion(cachedQuestion, challengeState.roomData);
            return;
        }
        // If not cached, polling will pick it up
        return;
    }
    
    // Admin advancing to next question on server
    try {
        const response = await fetch(`${window.API.URL}/rooms/next`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomCode: challengeState.roomCode,
                adminName: challengeState.username
            })
        });
        const data = await response.json();
        
        if (data.finished) {
            stopPolling();
            showChallengeResults();
        }
        // Otherwise, polling will pick up the new question
    } catch (error) {
        console.error('Next question error:', error);
    }
}

function updateLiveScoreboard(participants) {
    const scoreboard = document.getElementById('liveScoreboard');
    if (!scoreboard) return;
    
    const sorted = [...participants].sort((a, b) => {
        const scoreA = (a.score || 0) || (a.total_correct || 0);
        const scoreB = (b.score || 0) || (b.total_correct || 0);
        return scoreB - scoreA;
    });
    
    scoreboard.innerHTML = sorted.map((p, i) => {
        const isMe = p.username === challengeState.username;
        const score = p.score || p.total_correct || 0;
        return `
            <div class="scoreboard-item ${isMe ? 'current-user' : ''}">
                <span class="scoreboard-rank">${i + 1}</span>
                <span class="scoreboard-name">${p.username}${p.is_admin ? ' 👑' : ''}</span>
                <span class="scoreboard-score">${score}</span>
            </div>
        `;
    }).join('');
}

async function showChallengeResults() {
    showChallengeView('challenge-results');
    stopPolling();
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/${challengeState.roomCode}/results`);
        const data = await response.json();
        
        if (!data.success) return;
        
        const participants = data.participants;
        
        // Winner section
        const winnerSection = document.getElementById('challengeWinnerSection');
        if (participants.length > 0) {
            const winner = participants[0];
            winnerSection.innerHTML = `
                <div class="winner-announcement">🏆 Kazanan</div>
                <div class="winner-name">${winner.username}</div>
                <div class="winner-stats">${winner.total_correct} doğru / ${winner.total_wrong} yanlış (${winner.percentage}%)</div>
            `;
        }
        
        // Results list
        const resultsList = document.getElementById('challengeResultsList');
        const rankIcons = ['🥇', '🥈', '🥉'];
        resultsList.innerHTML = participants.map((p, i) => `
            <div class="result-row ${i < 3 ? 'rank-' + (i + 1) : ''}">
                <div class="result-rank">${rankIcons[i] || (i + 1)}</div>
                <div class="result-info">
                    <div class="result-username">${p.username}${p.is_admin ? ' 👑' : ''}</div>
                    <div class="result-detail">${p.total_correct} doğru / ${p.total_wrong} yanlış</div>
                </div>
                <div class="result-score">${p.percentage}%</div>
            </div>
        `).join('');
        
        // Category stats
        if (data.categoryStats && data.categoryStats[challengeState.username]) {
            const myStats = data.categoryStats[challengeState.username];
            const categoryStatsEl = document.getElementById('challengeCategoryStats');
            categoryStatsEl.innerHTML = Object.entries(myStats).map(([cat, stats]) => {
                const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                return `
                    <div class="category-stat-item">
                        <span class="cat-name">${cat}</span>
                        <span class="cat-score">${stats.correct}/${stats.total} (${pct}%)</span>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Results error:', error);
    }
}

async function loadChallengeHistory() {
    const username = getChallengeUsername();
    const historyEl = document.getElementById('challengeHistory');
    
    if (!currentUser) {
        historyEl.innerHTML = '<p class="empty-state">Geçmişi görmek için giriş yapın.</p>';
        return;
    }
    
    try {
        const response = await fetch(`${window.API.URL}/rooms/history/${encodeURIComponent(username)}`);
        const data = await response.json();
        
        if (!data.success || !data.rooms || data.rooms.length === 0) {
            historyEl.innerHTML = '<p class="empty-state">Henüz yarışma geçmişi yok.</p>';
            return;
        }
        
        historyEl.innerHTML = data.rooms.map(room => {
            const date = new Date(room.created_at).toLocaleDateString('tr-TR');
            const total = room.total_correct + room.total_wrong;
            const pct = total > 0 ? Math.round((room.total_correct / total) * 100) : 0;
            return `
                <div class="challenge-history-item">
                    <div>
                        <div class="room-name">${room.name}</div>
                        <div class="room-info">
                            <span>${date}</span>
                            <span>👥 ${room.participant_count}</span>
                        </div>
                    </div>
                    <div class="room-result">${room.total_correct}/${total} (${pct}%)</div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('History error:', error);
        historyEl.innerHTML = '<p class="empty-state">Geçmiş yüklenemedi.</p>';
    }
}

// Make challenge answer handler globally accessible
window.handleChallengeAnswer = handleChallengeAnswer;

// Initialize challenge when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initChallenge();
});
