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

// YDS Exam Distribution
const YDS_DISTRIBUTION = {
    'mini': {
        'YDS Kelime Soruları': 3,
        'YDS Gramer': 3,
        'YDS Cümle Tamamlama': 2,
        'YDS Çeviri Soruları': 3,
        'YDS Diyalog': 1,
        'YDS Paragraf Doldurma': 1,
        'YDS İlgisiz Cümleyi Bulma': 1,
        'YDS Reading Passages': 4,
        'YDS Eş Anlam': 2
    },
    'medium': {
        'YDS Kelime Soruları': 5,
        'YDS Gramer': 5,
        'YDS Cümle Tamamlama': 5,
        'YDS Çeviri Soruları': 6,
        'YDS Diyalog': 3,
        'YDS Paragraf Doldurma': 3,
        'YDS İlgisiz Cümleyi Bulma': 3,
        'YDS Reading Passages': 8,
        'YDS Eş Anlam': 2
    },
    'full': {
        'YDS Kelime Soruları': 10,
        'YDS Gramer': 10,
        'YDS Cümle Tamamlama': 10,
        'YDS Çeviri Soruları': 12,
        'YDS Diyalog': 5,
        'YDS Paragraf Doldurma': 5,
        'YDS İlgisiz Cümleyi Bulma': 5,
        'YDS Reading Passages': 18,
        'YDS Eş Anlam': 5
    }
};

// Category mappings
const CATEGORY_MAPPING = {
    'YDS Kelime Soruları': ['YDS Kelime Soruları'],
    'YDS Gramer': ['YDS Gramer', 'Grammar Revision'],
    'YDS Cümle Tamamlama': ['YDS Cümle Tamamlama'],
    'YDS Çeviri Soruları': ['YDS Çeviri Soruları'],
    'YDS Diyalog': ['YDS Diyalog'],
    'YDS Paragraf Doldurma': ['YDS Paragraf Doldurma'],
    'YDS İlgisiz Cümleyi Bulma': ['YDS İlgisiz Cümleyi Bulma'],
    'YDS Reading Passages': ['YDS Reading Passages', 'YDS Okuma Soruları'],
    'YDS Eş Anlam': ['YDS Eş Anlam', 'YDS Durum']
};

// Exam time limits (in seconds)
const EXAM_TIME_LIMITS = {
    'mini': 35 * 60,
    'medium': 75 * 60,
    'full': 150 * 60
};

// OpenAI Configuration
const OPENAI_CONFIG = {
    model: 'gpt-4o-mini'
};

// Export all constants
window.Constants = {
    CATEGORY_NAMES,
    YDS_DISTRIBUTION,
    CATEGORY_MAPPING,
    EXAM_TIME_LIMITS,
    OPENAI_CONFIG
};
