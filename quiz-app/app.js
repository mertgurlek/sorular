// Quiz App - Main JavaScript

// API Configuration
const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api' 
    : '/api';

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
        const response = await fetch(`${API_URL}/login`, {
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
        const response = await fetch(`${API_URL}/register`, {
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

function showMainApp() {
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
    timerInterval: null
};

// Storage Keys
const STORAGE_KEYS = {
    WRONG_ANSWERS: 'yds_wrong_answers',
    UNKNOWN_WORDS: 'yds_unknown_words',
    STATS: 'yds_stats',
    THEME: 'yds_theme',
    DAILY_STATS: 'yds_daily_stats',
    DAILY_GOAL: 'yds_daily_goal',
    STREAK: 'yds_streak',
    FAVORITES: 'yds_favorites',
    GPT_EXPLANATIONS: 'yds_gpt_explanations'
};

// OpenAI API Configuration
const OPENAI_CONFIG = {
    apiKey: '', // API key should be set via environment variable or server-side
    model: 'gpt-4o-mini'
};

// Category names for display
const CATEGORY_NAMES = [
    'Adjectives & Adverbs',
    'Conjunctions',
    'Gerunds & Infinitives',
    'Grammar Revision',
    'If Clauses',
    'Modals',
    'Noun Clauses',
    'Nouns',
    'Passive',
    'Reductions',
    'Relative Clauses',
    'Tenses'
];

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
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
}

// Load Categories from PostgreSQL API
async function loadCategories() {
    const grid = document.getElementById('category-grid');
    grid.innerHTML = '<p class="loading">Sorular yükleniyor...</p>';

    try {
        // Fetch categories summary
        const categoriesResponse = await fetch(`${API_URL}/categories`);
        const categoriesData = await categoriesResponse.json();
        
        if (!categoriesData.success) {
            throw new Error('Failed to load categories');
        }
        
        // Fetch all questions
        const questionsResponse = await fetch(`${API_URL}/questions`);
        const questionsData = await questionsResponse.json();
        
        if (!questionsData.success) {
            throw new Error('Failed to load questions');
        }
        
        // Store all questions
        allQuestions = questionsData.questions.map(q => ({
            ...q,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        }));
        
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
}

// Quiz Functions
function startQuiz() {
    const category = currentQuiz.selectedCategory;
    const countSelect = document.getElementById('questionCount').value;
    const shuffle = document.getElementById('shuffleQuestions').checked;
    const onlyWrong = document.getElementById('onlyWrong').checked;
    const timerLimit = parseInt(document.getElementById('timerMode').value);

    let questions;
    
    if (onlyWrong) {
        const wrongAnswers = getWrongAnswers();
        questions = wrongAnswers.map(w => w.question);
        if (category !== 'all') {
            questions = questions.filter(q => q.category === category);
        }
    } else {
        questions = category === 'all' 
            ? [...allQuestions]
            : allQuestions.filter(q => q.category === category);
    }

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

    // Render question text with clickable words
    const questionText = document.getElementById('questionText');
    questionText.innerHTML = makeWordsClickable(q.question_text);

    // Render options
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    q.options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        optionDiv.dataset.letter = opt.letter;
        
        // Seçim butonu ve metin yapısı
        optionDiv.innerHTML = `
            <button class="option-select-btn" title="Cevabı Seç">${opt.letter}</button>
            <span class="text">${makeWordsClickable(opt.text)}</span>
        `;
        
        // Sadece butona tıklayınca cevap seçilsin
        const selectBtn = optionDiv.querySelector('.option-select-btn');
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectAnswer(opt.letter);
        });

        optionsContainer.appendChild(optionDiv);
    });

    // Reset feedback and next button
    document.getElementById('feedback').classList.add('hidden');
    document.getElementById('nextQuestion').classList.add('hidden');

    // Add click listeners to words
    addWordClickListeners();
    
    // Update favorite button
    updateFavoriteButton();
    
    // Update GPT panel button
    if (typeof updateGPTPanelButton === 'function') {
        updateGPTPanelButton();
    }
    
    // Start timer if enabled
    startTimer();
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
    
    // Show feedback
    const feedback = document.getElementById('feedback');
    feedback.classList.remove('hidden', 'correct', 'wrong');
    feedback.classList.add('wrong');
    feedback.innerHTML = `
        <p id="feedbackText">⏱️ Süre doldu! Doğru cevap: ${q.correct_answer}</p>
        <button class="btn btn-small gpt-ask-btn" onclick="openGPTPanel()">
            🤖 Açıklamayı Gör
        </button>
    `;
    
    // Save wrong answer
    saveWrongAnswer(q, 'TIMEOUT');
    
    // Auto-add GPT explanation to panel
    if (typeof autoAddGPTExplanationOnWrong === 'function') {
        autoAddGPTExplanationOnWrong(q, 'TIMEOUT');
    }
    
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
    return text.replace(/([a-zA-Z'-]+)/g, (match) => {
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
    
    if (isCorrect) {
        currentQuiz.correct++;
        feedback.classList.add('correct');
        feedback.innerHTML = `<p id="feedbackText">✓ Doğru!</p>`;
        playSound('correct');
    } else {
        currentQuiz.wrong++;
        feedback.classList.add('wrong');
        feedback.innerHTML = `
            <p id="feedbackText">✗ Yanlış! Doğru cevap: ${q.correct_answer}</p>
            <button class="btn btn-small gpt-ask-btn" onclick="openGPTPanel()">
                🤖 Açıklamayı Gör
            </button>
        `;
        playSound('wrong');
        
        // Save wrong answer
        saveWrongAnswer(q, letter);
        
        // Auto-add GPT explanation to panel
        if (typeof autoAddGPTExplanationOnWrong === 'function') {
            autoAddGPTExplanationOnWrong(q, letter);
        }
    }

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

// Wrong Answers
function getWrongAnswers() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.WRONG_ANSWERS) || '[]');
}

function saveWrongAnswer(question, userAnswer) {
    const wrongAnswers = getWrongAnswers();
    
    // Check if already exists
    const exists = wrongAnswers.some(w => 
        w.question.question_text === question.question_text
    );
    
    if (!exists) {
        wrongAnswers.push({
            question,
            userAnswer,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEYS.WRONG_ANSWERS, JSON.stringify(wrongAnswers));
    }
}

function removeWrongAnswer(index) {
    const wrongAnswers = getWrongAnswers();
    wrongAnswers.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.WRONG_ANSWERS, JSON.stringify(wrongAnswers));
    renderWrongAnswers();
}

function clearWrongAnswers() {
    if (confirm('Tüm yanlış cevapları silmek istediğinize emin misiniz?')) {
        localStorage.setItem(STORAGE_KEYS.WRONG_ANSWERS, '[]');
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

// Unknown Words
function getUnknownWords() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.UNKNOWN_WORDS) || '[]');
}

function toggleUnknownWord(word) {
    const words = getUnknownWords();
    const index = words.indexOf(word.toLowerCase());
    
    if (index === -1) {
        words.push(word.toLowerCase());
    } else {
        words.splice(index, 1);
    }
    
    localStorage.setItem(STORAGE_KEYS.UNKNOWN_WORDS, JSON.stringify(words));
}

function removeUnknownWord(word) {
    const words = getUnknownWords();
    const index = words.indexOf(word);
    if (index !== -1) {
        words.splice(index, 1);
        localStorage.setItem(STORAGE_KEYS.UNKNOWN_WORDS, JSON.stringify(words));
    }
    renderUnknownWords();
}

function clearUnknownWords() {
    if (confirm('Tüm bilmediğiniz kelimeleri silmek istediğinize emin misiniz?')) {
        localStorage.setItem(STORAGE_KEYS.UNKNOWN_WORDS, '[]');
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

// Stats
function getStats() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STATS) || '{}');
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
    
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

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
    const categories = CATEGORY_NAMES;
    
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
        localStorage.setItem(STORAGE_KEYS.STATS, '{}');
        localStorage.setItem(STORAGE_KEYS.DAILY_STATS, '{}');
        localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify({ days: 0, lastDate: null }));
        updateStats();
    }
}

// ==================== DAILY STATS & STREAK ====================
function getTodayKey() {
    return new Date().toISOString().split('T')[0];
}

function getDailyStats() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_STATS) || '{}');
}

function getDailyGoal() {
    return parseInt(localStorage.getItem(STORAGE_KEYS.DAILY_GOAL) || '20');
}

function setDailyGoal(goal) {
    localStorage.setItem(STORAGE_KEYS.DAILY_GOAL, goal.toString());
    updateGoalDisplay();
}

function getStreak() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STREAK) || '{"days": 0, "lastDate": null}');
}

function updateDailyStats() {
    const today = getTodayKey();
    const dailyStats = getDailyStats();
    
    if (!dailyStats[today]) {
        dailyStats[today] = { answered: 0, correct: 0 };
    }
    dailyStats[today].answered++;
    
    localStorage.setItem(STORAGE_KEYS.DAILY_STATS, JSON.stringify(dailyStats));
    
    // Update streak
    updateStreak();
    updateGoalDisplay();
}

function updateDailyCorrect() {
    const today = getTodayKey();
    const dailyStats = getDailyStats();
    
    if (!dailyStats[today]) {
        dailyStats[today] = { answered: 0, correct: 0 };
    }
    dailyStats[today].correct++;
    
    localStorage.setItem(STORAGE_KEYS.DAILY_STATS, JSON.stringify(dailyStats));
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
        localStorage.setItem(STORAGE_KEYS.STREAK, JSON.stringify(streak));
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
function getFavorites() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]');
}

function isFavorite(questionText) {
    const favorites = getFavorites();
    return favorites.some(f => f.question_text === questionText);
}

function toggleFavorite() {
    const q = currentQuiz.questions[currentQuiz.currentIndex];
    const favorites = getFavorites();
    const index = favorites.findIndex(f => f.question_text === q.question_text);
    
    if (index === -1) {
        favorites.push(q);
    } else {
        favorites.splice(index, 1);
    }
    
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    updateFavoriteButton();
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
    favorites.splice(index, 1);
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    renderFavorites();
}

function clearFavorites() {
    if (confirm('Tüm favorileri silmek istediğinize emin misiniz?')) {
        localStorage.setItem(STORAGE_KEYS.FAVORITES, '[]');
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
    for (const name of Object.keys(CATEGORY_FILES)) {
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

// Utility
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ==================== EXAM SIMULATION ====================
let examState = {
    questions: [],
    answers: [], // User's answers for each question
    currentIndex: 0,
    timerInterval: null,
    totalTime: 150 * 60, // 150 minutes in seconds
    timeRemaining: 150 * 60,
    startTime: null
};

function initExamEventListeners() {
    document.getElementById('startExam').addEventListener('click', startExam);
    document.getElementById('submitExam').addEventListener('click', () => submitExam(false));
    document.getElementById('examPrevQ').addEventListener('click', examPrevQuestion);
    document.getElementById('examNextQ').addEventListener('click', examNextQuestion);
    document.getElementById('newExam').addEventListener('click', resetExam);
    document.getElementById('reviewExam').addEventListener('click', reviewExam);
}

function startExam() {
    // Get 80 random questions from all categories
    const shuffled = shuffleArray([...allQuestions]);
    examState.questions = shuffled.slice(0, Math.min(80, shuffled.length));
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
    
    q.options.forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option';
        if (examState.answers[examState.currentIndex] === opt.letter) {
            optionDiv.classList.add('selected');
        }
        optionDiv.dataset.letter = opt.letter;
        
        optionDiv.innerHTML = `
            <button class="option-select-btn" title="Cevabı Seç">${opt.letter}</button>
            <span class="text">${opt.text}</span>
        `;
        
        optionDiv.addEventListener('click', () => selectExamAnswer(opt.letter));
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
    
    q.options.forEach(opt => {
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
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.GPT_EXPLANATIONS) || '{}');
}

function saveGPTExplanationLocal(questionHash, explanation) {
    const explanations = getGPTExplanationsLocal();
    explanations[questionHash] = {
        explanation,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.GPT_EXPLANATIONS, JSON.stringify(explanations));
}

// Database functions for shared cache
async function getGPTExplanationFromDB(questionHash) {
    try {
        const response = await fetch(`${API_URL}/gpt-explanation/${questionHash}`);
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
        await fetch(`${API_URL}/gpt-explanation`, {
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
        const explanation = await fetchGPTExplanation(question, userAnswer);
        
        // Save to database (shared cache)
        await saveGPTExplanationToDB(questionHash, question.question_text, explanation);
        
        // Save to local cache
        saveGPTExplanationLocal(questionHash, explanation);
        
        // Update modal with explanation
        updateGPTModalContent(explanation, false);
    } catch (error) {
        console.error('GPT API Error:', error);
        updateGPTModalContent('Açıklama yüklenirken bir hata oluştu. Lütfen tekrar deneyin.', false, true);
    }
}

async function fetchGPTExplanation(question, userAnswer) {
    const optionsText = question.options.map(o => `${o.letter}) ${o.text}`).join('\n');
    const correctOption = question.options.find(o => o.letter === question.correct_answer);
    const userOption = question.options.find(o => o.letter === userAnswer);
    
    const prompt = `Aşağıdaki YDS İngilizce gramer sorusunu analiz et ve Türkçe açıkla.

📝 SORU:
"${question.question_text}"

📋 ŞIKLAR:
${optionsText}

❌ Öğrencinin Cevabı: ${userAnswer}) ${userOption ? userOption.text : userAnswer}
✅ Doğru Cevap: ${question.correct_answer}) ${correctOption ? correctOption.text : question.correct_answer}

Aşağıdaki formatta yanıt ver:

**🎯 DOĞRU CEVAP NEDENİ:**
[Neden ${question.correct_answer} şıkkı doğru? Cümledeki hangi ipuçları bu cevabı işaret ediyor?]

**❌ YANLIŞ CEVAP ANALİZİ:**
[${userAnswer} şıkkı neden yanlış? Bu şık hangi durumda kullanılır?]

**📚 GRAMER KURALI:**
[Bu soruyla ilgili temel gramer kuralını kısaca açıkla]

**💡 İPUCU:**
[Benzer sorularda dikkat edilmesi gereken 1-2 pratik ipucu]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: OPENAI_CONFIG.model,
            messages: [
                {
                    role: 'system',
                    content: `Sen deneyimli bir YDS/YÖKDİL İngilizce öğretmenisin. Öğrencilere gramer konularını açık, anlaşılır ve motive edici şekilde açıklıyorsun. 
                    
Kurallar:
- Türkçe açıkla
- Kısa ve öz ol (maksimum 250 kelime)
- Emoji kullan ama abartma
- Teknik terimleri basit örneklerle açıkla
- Öğrenciyi motive et, yanlış cevap için olumsuz konuşma`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 600,
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Açıklama alınamadı.';
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

function updateGPTModalContent(content, fromCache, isError = false) {
    const contentEl = document.getElementById('gptExplanationContent');
    const cacheIndicator = document.getElementById('gptCacheIndicator');
    
    if (isError) {
        contentEl.innerHTML = `<div class="gpt-error">${content}</div>`;
    } else {
        contentEl.innerHTML = formatGPTExplanation(content);
    }
    
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
