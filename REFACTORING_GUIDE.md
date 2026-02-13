# Refactoring Guide - YDS Quiz App

## Proje Yapısı

### Backend API (Node.js / Express)

```
api/
├── index.js                 # Express app — middleware + route mount (~100 satır)
├── server.js                # Local dev server (port 3001)
├── _lib/
│   ├── db.js                # PostgreSQL pool (SSL logic dahil)
│   ├── initDb.js            # Tüm tablo şemaları (tek kaynak)
│   ├── authMiddleware.js    # JWT: generateToken, requireAuth, requireSameUser, optionalAuth
│   ├── middleware.js         # CORS, asyncHandler, sendSuccess, sendError
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── questionController.js
│   │   └── gptController.js
│   ├── services/
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── questionService.js
│   │   ├── gptService.js
│   │   └── challengeService.js
│   └── routes/
│       ├── index.js          # Router hub
│       ├── auth.js
│       ├── users.js
│       ├── questions.js
│       ├── gpt.js
│       ├── challenge.js
│       ├── friends.js
│       ├── badges.js
│       ├── feedback.js
│       └── leaderboard.js
```

### Python Scripts

```
scripts/
├── __init__.py
├── config.py              # get_database_url, get_openai_key (tek kaynak)
├── db_utils.py            # get_db_connection, execute_query, batch_insert
├── openai_utils.py        # OpenAI client, enrich_question, validate_question, parse_gpt_response
├── constants.py           # CATEGORY_PROMPTS, YDS_FILES, YDS_FULL_DISTRIBUTION, CATEGORY_ALIASES
├── scrapers/              # Web scraping scriptleri
│   ├── scraper.py
│   ├── yds_scraper.py
│   ├── yds_scraper_gpt.py
│   └── yds_category_scraper.py
├── enrichment/            # GPT ile soru zenginleştirme
│   ├── yds_enrich_and_upload.py
│   ├── yds_json_enricher.py
│   ├── gpt_answer_generator.py
│   ├── db_question_validator.py
│   ├── add_answers.py
│   ├── answer_questions.py
│   ├── find_unanswered.py
│   └── retry_failed.py
├── migration/             # DB migration scriptleri
│   ├── migrate_yds_questions_refactored.py
│   └── check_db_schema.py
└── analysis/              # Analiz ve raporlama
    ├── analyze_and_create_quiz_presets.py
    ├── quality_check.py
    ├── quality_test.py
    └── word_frequency_analysis.py
```

### Frontend

```
src/utils/
├── constants.js       # CATEGORY_NAMES, YDS_DISTRIBUTION, CATEGORY_MAPPING, EXAM_TIME_LIMITS
├── storage.js         # STORAGE_KEYS, localStorage CRUD helpers
├── api.js             # API wrapper (token ekleme, base URL detection)
└── helpers.js         # Genel yardımcı fonksiyonlar
```

## Tek Kaynak Kuralları

| Sabit | Tek Kaynak | Kullanıcılar |
|-------|-----------|-------------|
| DB Şeması | `api/_lib/initDb.js` | API server |
| DB Bağlantısı (JS) | `api/_lib/db.js` | Tüm API servisleri |
| DB Bağlantısı (Python) | `scripts/db_utils.py` | Tüm Python scriptleri |
| CATEGORY_PROMPTS | `scripts/constants.py` | `scripts/openai_utils.py` |
| YDS_FILES | `scripts/constants.py` | `scripts/enrichment/`, `scripts/migration/` |
| enrich_question | `scripts/openai_utils.py` | `scripts/enrichment/` |
| validate_question | `scripts/openai_utils.py` | `scripts/enrichment/db_question_validator.py` |
| OpenAI client | `scripts/openai_utils.py` | Tüm Python scriptleri |
| OpenAI API key | `scripts/config.py` | `scripts/openai_utils.py` |
| YDS_DISTRIBUTION (frontend) | `src/utils/constants.js` | `app.js` |
| STORAGE_KEYS | `src/utils/storage.js` | `app.js` |
| JWT Auth | `api/_lib/authMiddleware.js` | `api/index.js`, controllers |

## Yeni Endpoint Ekleme

```javascript
// 1. Service'e fonksiyon ekle (_lib/services/userService.js)
async getProfile(userId) {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
}

// 2. Controller'a method ekle (_lib/controllers/userController.js)
async getProfile(req, res) {
    const { userId } = req.params;
    const profile = await userService.getProfile(userId);
    sendSuccess(res, { profile });
}

// 3. Route ekle (_lib/routes/users.js)
router.get('/:userId/profile', asyncHandler(async (req, res) => {
    await userController.getProfile(req, res);
}));
```

## Python Script'lerde DB Kullanımı

```python
from scripts.db_utils import get_db_connection, execute_query

with get_db_connection(use_dict_cursor=True) as conn:
    cur = conn.cursor()
    cur.execute("SELECT * FROM questions LIMIT 10")
    rows = cur.fetchall()
    cur.close()

# Veya kısa yol:
result = execute_query("SELECT * FROM questions LIMIT 10", fetch_all=True)
```

## Local Development

```bash
# Backend (port 3001)
node api/server.js

# Python scripts (proje kökünden çalıştır)
pip install -r requirements.txt
python -m scripts.migration.migrate_yds_questions_refactored
python -m scripts.enrichment.yds_enrich_and_upload
python -m scripts.analysis.analyze_and_create_quiz_presets
python -m scripts.migration.check_db_schema
```

## Deployment (Vercel)

`vercel.json` → `api/index.js` serverless function olarak çalışır.
Tüm route'lar `/api/*` altında mount edilir.
