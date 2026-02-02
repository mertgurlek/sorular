# YDS Quiz App - Proje Mimarisi

## Yapı Genel Bakış

Bu dokümantasyon, projenin merkezi ve modüler yapısını açıklar.

## Klasör Yapısı

```
Sorukurdu/
├── api/                    # Backend API (Vercel Serverless)
│   ├── lib/               # Merkezi modüller
│   │   ├── db.js          # PostgreSQL bağlantı yönetimi
│   │   ├── middleware.js  # CORS, error handling, response helpers
│   │   └── constants.js   # Sabit değerler (backend)
│   ├── auth/
│   │   ├── login.js       # Giriş endpoint
│   │   └── register.js    # Kayıt endpoint
│   ├── categories.js      # Kategori listesi endpoint
│   ├── questions.js       # Soru listesi endpoint
│   └── index.js           # Ana API (Express) - local dev
│
├── src/                   # Frontend modülleri
│   └── utils/
│       ├── api.js         # API istekleri için merkezi modül
│       ├── storage.js     # localStorage yönetimi
│       ├── helpers.js     # Yardımcı fonksiyonlar
│       └── constants.js   # Sabit değerler (frontend)
│
├── app.js                 # Ana frontend uygulaması
├── index.html             # Ana HTML dosyası
├── styles.css             # CSS stilleri
├── sw.js                  # Service Worker (PWA)
│
│
└── yds_questions*/        # Soru verileri (JSON)
```

## Merkezi Modüller

### Backend (api/lib/)

#### db.js
- **getPool()**: PostgreSQL bağlantı havuzu (singleton)
- **query(sql, params)**: Güvenli sorgu çalıştırma
- **transaction(callback)**: Transaction yönetimi

```javascript
const { query } = require('./lib/db');
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
```

#### middleware.js
- **asyncHandler(fn)**: Async route wrapper + error handling
- **sendSuccess(res, data)**: Başarılı response
- **sendError(res, msg, status)**: Hata response
- **validateMethod(req, res, methods)**: HTTP method kontrolü
- **validateRequired(data, fields)**: Zorunlu alan kontrolü

```javascript
const { asyncHandler, sendSuccess } = require('./lib/middleware');

module.exports = asyncHandler(async (req, res) => {
    const data = await query('...');
    sendSuccess(res, { data });
});
```

### Frontend (src/utils/)

#### api.js
Merkezi API istek yönetimi.

```javascript
// Kullanım
const result = await API.Auth.login(username, password);
const categories = await API.Questions.getCategories();
```

#### storage.js
localStorage işlemleri için merkezi modül.

```javascript
// Kullanım
const wrongAnswers = Storage.getWrongAnswers();
Storage.saveWrongAnswer(question, userAnswer);
Storage.toggleUnknownWord('word');
```

#### helpers.js
Yardımcı fonksiyonlar.

```javascript
const shuffled = Helpers.shuffleArray(questions);
const html = Helpers.makeWordsClickable(text, unknownWords);
const formatted = Helpers.formatTime(seconds);
```

#### constants.js
Uygulama sabitleri.

```javascript
const categories = Constants.CATEGORY_NAMES;
const distribution = Constants.YDS_DISTRIBUTION;
```

## API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/api/auth/login` | POST | Kullanıcı girişi |
| `/api/auth/register` | POST | Yeni kullanıcı kaydı |
| `/api/categories` | GET | Kategori listesi |
| `/api/questions` | GET | Soru listesi |
| `/api/user/:id/all-data` | GET | Kullanıcı tüm verileri |
| `/api/gpt-explanation` | POST | GPT açıklama kaydet |
| `/api/openai-explain` | POST | OpenAI'dan açıklama al |

## Kod Standartları

### API Routes
1. Her route `asyncHandler` wrapper kullanmalı
2. Merkezi `db.js` modülünü kullanmalı
3. `sendSuccess/sendError` ile response dönmeli

### Frontend
1. Global state'ler (`window.Storage`, `window.API`, etc.) kullanılmalı
2. localStorage işlemleri `Storage` modülü üzerinden yapılmalı
3. API istekleri `API` modülü üzerinden yapılmalı

## Geliştirme

### Local Development
```bash
cd api
npm install
npm start  # Port 3001
```

### Deployment (Vercel)
```bash
vercel deploy
```

## Notlar

- PWA desteği aktif (sw.js, manifest.json)
- Dark mode varsayılan tema
- PostgreSQL veritabanı (Neon/Supabase)
- OpenAI GPT-4o-mini entegrasyonu
