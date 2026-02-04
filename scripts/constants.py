"""
Application Constants
Tüm uygulama sabitleri - Single Source of Truth
"""

# YDS Kategori İsimleri
CATEGORY_NAMES = [
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
]

# YDS Sınav Dağılımı (Gerçek YDS formatı)
YDS_DISTRIBUTION = {
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
}

# Kategori Eşleştirmeleri (DB kategorileri -> YDS kategorileri)
CATEGORY_MAPPING = {
    'YDS Kelime Soruları': ['YDS Kelime Soruları'],
    'YDS Gramer': ['YDS Gramer', 'Grammar Revision'],
    'YDS Cümle Tamamlama': ['YDS Cümle Tamamlama'],
    'YDS Çeviri Soruları': ['YDS Çeviri Soruları'],
    'YDS Diyalog': ['YDS Diyalog'],
    'YDS Paragraf Doldurma': ['YDS Paragraf Doldurma'],
    'YDS İlgisiz Cümleyi Bulma': ['YDS İlgisiz Cümleyi Bulma'],
    'YDS Reading Passages': ['YDS Reading Passages', 'YDS Okuma Soruları'],
    'YDS Eş Anlam': ['YDS Eş Anlam', 'YDS Durum']
}

# Kategori Alias'ları (Alternatif isimler)
CATEGORY_ALIASES = {
    "YDS Kelime Soruları": ["YDS Kelime Soruları", "YDS Kelime", "Vocabulary", "Kelime"],
    "YDS Gramer": ["YDS Gramer", "Grammar Revision", "YDS Grammar", "Gramer"],
    "YDS Cümle Tamamlama": ["YDS Cümle Tamamlama", "Cümle Tamamlama"],
    "YDS Çeviri Soruları": ["YDS Çeviri Soruları", "YDS Çeviri", "Çeviri"],
    "YDS Diyalog": ["YDS Diyalog", "Diyalog", "Dialog"],
    "YDS Paragraf Doldurma": ["YDS Paragraf Doldurma", "Paragraf Doldurma", "Paragraph Completion"],
    "YDS İlgisiz Cümleyi Bulma": ["YDS İlgisiz Cümleyi Bulma", "İlgisiz Cümle"],
    "YDS Reading Passages": ["YDS Reading Passages", "YDS Okuma Soruları", "Reading", "Okuma"],
    "YDS Eş Anlam": ["YDS Eş Anlam", "Eş Anlam", "YDS Durum"],
    "YDS Phrasal Verbs / Prepositions": ["YDS Phrasal Verbs / Prepositions", "Phrasal Verbs"],
}

# Sınav Süre Limitleri (saniye)
EXAM_TIME_LIMITS = {
    'mini': 35 * 60,
    'medium': 75 * 60,
    'full': 150 * 60
}

# GPT Kategori Prompt'ları
CATEGORY_PROMPTS = {
    "Adjectives & Adverbs": "sıfat ve zarf kullanımını (comparatives, superlatives, so/such, too/enough yapıları)",
    "Conjunctions": "bağlaç kullanımını (and, but, or, so, because, although, however, therefore vb.)",
    "Gerunds & Infinitives": "gerund (-ing) ve infinitive (to + verb) kullanımını",
    "Grammar Revision": "genel İngilizce gramer bilgisini (karma gramer konuları)",
    "If Clauses": "koşul cümlelerini (Type 0, 1, 2, 3 ve mixed conditionals)",
    "Modals": "modal fiilleri (can, could, may, might, must, should, would, will vb.)",
    "Nouns": "isim kullanımını (countable/uncountable, articles, quantifiers)",
    "Noun Clauses": "isim cümleciklerini (that-clause, wh-clause, if/whether clause)",
    "Passive": "edilgen yapıyı (passive voice - tüm zamanlar)",
    "Reductions": "cümle kısaltmalarını (reduced relative clauses, reduced adverbial clauses)",
    "Relative Clauses": "sıfat cümleciklerini (who, which, that, whose, where, when)",
    "Tenses": "İngilizce zaman kiplerini (present, past, future - simple, continuous, perfect)",
    "YDS Cümle Tamamlama": "cümle tamamlama becerisini (yarım cümleyi anlamlı şekilde tamamlama)",
    "YDS Okuma Soruları": "okuduğunu anlama becerisini (reading comprehension)",
    "YDS Reading Passages": "okuduğunu anlama becerisini (reading comprehension)",
    "YDS Çeviri Soruları": "İngilizce-Türkçe çeviri becerisini",
    "YDS Diyalog": "diyalog tamamlama becerisini (konuşma bağlamını anlama)",
    "YDS Durum": "durum ifade etme becerisini (verilen duruma uygun cümle seçme)",
    "YDS Eş Anlam": "eş anlamlı cümle bulma becerisini (paraphrasing)",
    "YDS İlgisiz Cümleyi Bulma": "paragraf tutarlılığını anlama becerisini",
    "YDS Paragraf Doldurma": "paragraf tamamlama becerisini",
    "YDS Phrasal Verbs / Prepositions": "phrasal verb ve edat kullanımını",
    "YDS Kelime Soruları": "kelime bilgisini (vocabulary)",
    "YDS Gramer": "genel İngilizce dilbilgisi becerisini (tenses, modals, clauses vb.)"
}

# YDS Dosya Yolları
YDS_FILES = [
    ("yds_questions/grammar_revision.json", "YDS Gramer"),
    ("yds_questions/yds_ilgisiz_cümleyi_bulma.json", "YDS İlgisiz Cümleyi Bulma"),
    ("yds_questions/yds_çeviri_soruları.json", "YDS Çeviri Soruları"),
    ("yds_questions/yds_cümle_tamamlama.json", "YDS Cümle Tamamlama"),
    ("yds_questions/yds_diyalog.json", "YDS Diyalog"),
    ("yds_questions/yds_durum.json", "YDS Durum"),
    ("yds_questions/yds_eş_anlam.json", "YDS Eş Anlam"),
    ("yds_questions/yds_paragraf_doldurma.json", "YDS Paragraf Doldurma"),
    ("yds_questions/yds_phrasal_verbs_prepositions.json", "YDS Phrasal Verbs / Prepositions"),
    ("yds_questions/yds_kelime_soruları.json", "YDS Kelime Soruları"),
    ("yds_questions/yds_okuma_soruları.json", "YDS Reading Passages"),
]

# Storage Keys
STORAGE_KEYS = {
    'WRONG_ANSWERS': 'yds_wrong_answers',
    'UNKNOWN_WORDS': 'yds_unknown_words',
    'STATS': 'yds_stats',
    'THEME': 'yds_theme',
    'DAILY_STATS': 'yds_daily_stats',
    'DAILY_GOAL': 'yds_daily_goal',
    'STREAK': 'yds_streak',
    'FAVORITES': 'yds_favorites',
    'GPT_EXPLANATIONS': 'yds_gpt_explanations',
    'ANSWER_HISTORY': 'yds_answer_history',
    'CURRENT_USER': 'yds_current_user'
}

# OpenAI Configuration
OPENAI_CONFIG = {
    'model': 'gpt-4o-mini',
    'temperature': 0.2,
    'max_tokens': 2000
}
