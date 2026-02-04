# Refactoring Guide - YDS Quiz App

## 🎯 Yapılan Değişiklikler

### 1. Python Utilities Modülü ✅

Tüm Python script'leri için merkezi utilities oluşturuldu:

```
scripts/
├── __init__.py
├── config.py          # Çevre değişkenleri yönetimi
├── db_utils.py        # Database bağlantı ve sorgu yönetimi
├── openai_utils.py    # OpenAI client ve GPT işlemleri
└── constants.py       # Tüm uygulama sabitleri
```

#### Kullanım Örnekleri

**Database Bağlantısı:**
```python
from scripts.db_utils import get_db_connection, execute_query

# Context manager ile
with get_db_connection() as conn:
    cur = conn.cursor()
    cur.execute("SELECT * FROM users")

# Veya direkt query
result = execute_query("SELECT * FROM users", fetch_all=True)
```

**OpenAI İşlemleri:**
```python
from scripts.openai_utils import enrich_question, batch_process_questions
import asyncio

# Tek soru zenginleştirme
semaphore = asyncio.Semaphore(10)
enriched = await enrich_question(question, category, semaphore)

# Toplu işleme
results = await batch_process_questions(questions, category, enrich_question)
```

**Constants:**
```python
from scripts.constants import YDS_DISTRIBUTION, CATEGORY_PROMPTS, YDS_FILES

# Tüm sabitler tek yerden
distribution = YDS_DISTRIBUTION['full']
prompt = CATEGORY_PROMPTS['YDS Gramer']
```

### 2. Backend API Modülerleştirme ✅

Monolitik `api/index.js` (2076 satır) profesyonel katmanlı yapıya dönüştürüldü:

```
api/
├── routes/              # Route tanımları
│   ├── auth.js
│   ├── users.js
│   ├── questions.js
│   ├── gpt.js
│   └── index.js
├── controllers/         # Request/Response handling
│   ├── authController.js
│   ├── userController.js
│   ├── questionController.js
│   └── gptController.js
├── services/           # Business logic
│   ├── authService.js
│   ├── userService.js
│   ├── questionService.js
│   └── gptService.js
├── lib/
│   ├── db.js
│   ├── middleware.js
│   ├── constants.js
│   └── validators.js   # YENİ: Validation helpers
├── app.js              # YENİ: Express app configuration
└── server.js           # Server başlatma
```

#### Mimari Katmanlar

**1. Routes (Routing Layer)**
- HTTP endpoint tanımları
- Middleware bağlama
- Controller'lara yönlendirme

**2. Controllers (Presentation Layer)**
- Request/Response handling
- Validation
- Service çağrıları
- Response formatting

**3. Services (Business Logic Layer)**
- İş mantığı
- Database işlemleri
- Dış API çağrıları
- Veri dönüşümleri

**4. Lib (Utility Layer)**
- Database bağlantı yönetimi
- Middleware fonksiyonları
- Validation helpers
- Constants

#### Kullanım Örnekleri

**Yeni Endpoint Ekleme:**
```javascript
// 1. Service'e fonksiyon ekle (services/userService.js)
async getProfile(userId) {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0];
}

// 2. Controller'a method ekle (controllers/userController.js)
async getProfile(req, res) {
    const { userId } = req.params;
    const profile = await userService.getProfile(userId);
    sendSuccess(res, { profile });
}

// 3. Route ekle (routes/users.js)
router.get('/:userId/profile', asyncHandler(async (req, res) => {
    await userController.getProfile(req, res);
}));
```

### 3. Middleware Kullanımı ✅

Tüm route'lar artık `asyncHandler` kullanıyor:
- Otomatik error handling
- CORS headers
- Tutarlı response format

```javascript
// Eski yöntem (manuel try-catch)
app.post('/api/login', async (req, res) => {
    try {
        // kod
    } catch (error) {
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Yeni yöntem (asyncHandler)
router.post('/login', asyncHandler(async (req, res) => {
    await authController.login(req, res);
}));
```

## 📦 Migration Rehberi

### Python Script'leri Güncelleme

**Eski Kod:**
```python
import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
load_dotenv(".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    if DATABASE_URL.startswith("psql '"):
        DATABASE_URL = DATABASE_URL[6:-1]
    # ...

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, connect_timeout=30)
```

**Yeni Kod:**
```python
from scripts.db_utils import get_db_connection, execute_query
from scripts.constants import YDS_FILES, CATEGORY_PROMPTS

# Artık tek satır!
with get_db_connection() as conn:
    # kullan
```

### Mevcut Script'leri Güncelleme Adımları

1. **Import'ları değiştir:**
```python
# Eski
import psycopg2
from dotenv import load_dotenv
from openai import AsyncOpenAI

# Yeni
from scripts.db_utils import get_db_connection, execute_query
from scripts.openai_utils import get_openai_client, enrich_question
from scripts.constants import CATEGORY_PROMPTS, YDS_DISTRIBUTION
```

2. **Database bağlantılarını güncelle:**
```python
# Eski
conn = psycopg2.connect(DATABASE_URL)

# Yeni
with get_db_connection() as conn:
    # kod
```

3. **OpenAI client'ı güncelle:**
```python
# Eski
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Yeni
client = get_openai_client()
```

4. **Constants'ları güncelle:**
```python
# Eski - her dosyada tanımlı
CATEGORY_PROMPTS = {
    "YDS Gramer": "...",
    # ...
}

# Yeni - tek yerden import
from scripts.constants import CATEGORY_PROMPTS
```

## 🚀 Deployment

### Vercel Deployment

Yeni modüler yapı Vercel serverless fonksiyonları ile uyumlu:

**vercel.json:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/routes/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/app.js"
    }
  ]
}
```

### Local Development

```bash
# Backend
cd api
npm install
npm start  # Port 3001

# Python scripts
pip install -r requirements.txt
python migrate_yds_questions_refactored.py
```

## 📊 Karşılaştırma

### Kod Satırları

| Dosya | Eski | Yeni | Azalma |
|-------|------|------|--------|
| api/index.js | 2076 | ~50 (app.js) | -97% |
| Python scripts (ortalama) | ~150 | ~50 | -67% |

### Bakım Kolaylığı

- ✅ Tek sorumluluk prensibi
- ✅ Kod tekrarı yok
- ✅ Test edilebilir
- ✅ Ölçeklenebilir
- ✅ Dokümante edilmiş

## 🔄 Sonraki Adımlar

### Tamamlanmış ✅
1. Python utilities modülü
2. Backend API modülerleştirme
3. Middleware standardizasyonu
4. Service layer oluşturma

### Devam Eden 🔄
1. Tüm Python script'lerini yeni yapıya migrate et
2. Frontend app.js modülerleştirme
3. Constants senkronizasyonu
4. Test coverage

### Planlanan 📋
1. API dokümantasyonu (Swagger)
2. Unit testler
3. Integration testler
4. Performance optimizasyonları

## 📝 Notlar

- Eski `api/index.js` dosyası korundu (backup)
- Yeni yapı `api/app.js` ve `api/routes/` kullanıyor
- Python script'lerin eski versiyonları korundu
- Tüm değişiklikler geriye uyumlu

## 🆘 Sorun Giderme

**Database bağlantı hatası:**
```python
# .env dosyasını kontrol et
DATABASE_URL=postgresql://...
```

**Import hatası:**
```python
# scripts klasörünün Python path'te olduğundan emin ol
import sys
sys.path.append('.')
```

**API route bulunamadı:**
```javascript
// server.js'in app.js'i import ettiğinden emin ol
const app = require('./app.js');
```
