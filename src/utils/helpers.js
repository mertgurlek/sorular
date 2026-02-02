// Utility helper functions

// Array shuffle (Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Format time (seconds to MM:SS)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculate percentage
function calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Parse question options (handles various formats)
function parseOptions(options) {
    if (Array.isArray(options)) return options;
    if (typeof options === 'string') {
        try { 
            const parsed = JSON.parse(options);
            if (Array.isArray(parsed)) return parsed;
            if (parsed.options && Array.isArray(parsed.options)) return parsed.options;
            return [];
        } catch { 
            return []; 
        }
    }
    if (options && typeof options === 'object') {
        if (Array.isArray(options.options)) return options.options;
    }
    return [];
}

// Extract extra fields from nested options structure
function extractQuestionExtras(question) {
    let optionsData = question.options;
    if (typeof optionsData === 'string') {
        try { optionsData = JSON.parse(optionsData); } catch { optionsData = {}; }
    }
    
    const extras = {
        explanation_tr: null,
        question_tr: null,
        tip: null,
        difficulty: null
    };
    
    if (optionsData && typeof optionsData === 'object' && !Array.isArray(optionsData)) {
        extras.explanation_tr = optionsData.explanation_tr || null;
        extras.question_tr = optionsData.question_tr || null;
        extras.tip = optionsData.tip || null;
        extras.difficulty = optionsData.difficulty || null;
    }
    
    return extras;
}

// Make words clickable in text
function makeWordsClickable(text, unknownWords = []) {
    return text.replace(/([a-zA-Z'-]+)/g, (match) => {
        const isUnknown = unknownWords.includes(match.toLowerCase());
        return `<span class="word ${isUnknown ? 'unknown' : ''}" data-word="${match.toLowerCase()}">${match}</span>`;
    });
}

// Generate question hash for caching
function generateQuestionHash(questionText) {
    return btoa(unescape(encodeURIComponent(questionText.substring(0, 50)))).replace(/[^a-zA-Z0-9]/g, '');
}

// Play sound effect
function playSound(type) {
    // Sound effects are optional - implement if needed
    // This is a placeholder for sound functionality
}

// Show/hide element helpers
function showElement(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) el.classList.remove('hidden');
}

function hideElement(elementOrId) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) el.classList.add('hidden');
}

function toggleElement(elementOrId, show) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (el) el.classList.toggle('hidden', !show);
}

// Safe getElementById with error logging
function $(id) {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element not found: ${id}`);
    return el;
}

// Query selector shorthand
function $$(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

// Create element helper
function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.id) el.id = options.id;
    if (options.innerHTML) el.innerHTML = options.innerHTML;
    if (options.textContent) el.textContent = options.textContent;
    if (options.attrs) {
        Object.entries(options.attrs).forEach(([key, value]) => {
            el.setAttribute(key, value);
        });
    }
    if (options.data) {
        Object.entries(options.data).forEach(([key, value]) => {
            el.dataset[key] = value;
        });
    }
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            el.addEventListener(event, handler);
        });
    }
    return el;
}

// Export all helpers
window.Helpers = {
    shuffleArray,
    formatTime,
    calculatePercentage,
    debounce,
    throttle,
    parseOptions,
    extractQuestionExtras,
    makeWordsClickable,
    generateQuestionHash,
    playSound,
    showElement,
    hideElement,
    toggleElement,
    $,
    $$,
    createElement
};
