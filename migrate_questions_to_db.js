const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL bağlantısı - DATABASE_URL environment variable'dan alınacak
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Tablo oluşturma
async function createTables() {
    console.log('📦 Tablolar oluşturuluyor...');
    
    // Categories tablosu
    await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            display_name VARCHAR(200),
            question_count INTEGER DEFAULT 0,
            source VARCHAR(50) DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Questions tablosu
    await pool.query(`
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            category_id INTEGER REFERENCES categories(id),
            category_name VARCHAR(100),
            question_number VARCHAR(20),
            question_text TEXT NOT NULL,
            option_a TEXT,
            option_b TEXT,
            option_c TEXT,
            option_d TEXT,
            option_e TEXT,
            correct_answer VARCHAR(5),
            explanation TEXT,
            source_url TEXT,
            source VARCHAR(50) DEFAULT 'sorukurdu',
            difficulty VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(question_text, category_name)
        )
    `);
    
    // Index oluştur
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
        CREATE INDEX IF NOT EXISTS idx_questions_category_name ON questions(category_name);
    `);
    
    console.log('✅ Tablolar oluşturuldu');
}

// Kategori ekle veya getir
async function getOrCreateCategory(categoryName, source = 'sorukurdu') {
    const displayName = categoryName
        .replace(/_/g, ' ')
        .replace(/yds /gi, 'YDS ')
        .replace(/gpt /gi, 'GPT ');
    
    const result = await pool.query(
        `INSERT INTO categories (name, display_name, source) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO UPDATE SET display_name = $2
         RETURNING id`,
        [categoryName, displayName, source]
    );
    
    return result.rows[0].id;
}

// Soruları ekle
async function insertQuestions(categoryId, categoryName, questions, source) {
    let inserted = 0;
    let skipped = 0;
    
    for (const q of questions) {
        if (!q.question_text || !q.correct_answer) {
            skipped++;
            continue;
        }
        
        // Options'ları düzenle
        const options = q.options || [];
        const optionA = options.find(o => o.letter === 'A')?.text || null;
        const optionB = options.find(o => o.letter === 'B')?.text || null;
        const optionC = options.find(o => o.letter === 'C')?.text || null;
        const optionD = options.find(o => o.letter === 'D')?.text || null;
        const optionE = options.find(o => o.letter === 'E')?.text || null;
        
        try {
            await pool.query(
                `INSERT INTO questions 
                 (category_id, category_name, question_number, question_text, 
                  option_a, option_b, option_c, option_d, option_e, 
                  correct_answer, explanation, source_url, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 ON CONFLICT (question_text, category_name) DO NOTHING`,
                [
                    categoryId,
                    categoryName,
                    q.question_number || null,
                    q.question_text,
                    optionA, optionB, optionC, optionD, optionE,
                    q.correct_answer,
                    q.explanation || null,
                    q.url || q.source_url || null,
                    source
                ]
            );
            inserted++;
        } catch (err) {
            console.error(`  ⚠️ Soru eklenirken hata: ${err.message}`);
            skipped++;
        }
    }
    
    // Kategori soru sayısını güncelle
    await pool.query(
        `UPDATE categories SET question_count = (
            SELECT COUNT(*) FROM questions WHERE category_id = $1
        ) WHERE id = $1`,
        [categoryId]
    );
    
    return { inserted, skipped };
}

// JSON dosyasını işle
async function processJsonFile(filePath, source) {
    const fileName = path.basename(filePath);
    
    if (fileName === '_summary.json' || fileName === 'quality_report.json' || fileName === 'yds_all_categories.json') {
        return { inserted: 0, skipped: 0 };
    }
    
    console.log(`\n📄 İşleniyor: ${fileName}`);
    
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!data.questions || !Array.isArray(data.questions)) {
            console.log(`  ⏭️ Sorular bulunamadı, atlanıyor`);
            return { inserted: 0, skipped: 0 };
        }
        
        const categoryName = data.category || fileName.replace('.json', '');
        const categoryId = await getOrCreateCategory(categoryName, source);
        
        const result = await insertQuestions(categoryId, categoryName, data.questions, source);
        console.log(`  ✅ ${result.inserted} soru eklendi, ${result.skipped} atlandı`);
        
        return result;
    } catch (err) {
        console.error(`  ❌ Hata: ${err.message}`);
        return { inserted: 0, skipped: 0 };
    }
}

// Bir klasördeki tüm JSON dosyalarını işle
async function processDirectory(dirPath, source) {
    console.log(`\n📁 Klasör işleniyor: ${dirPath}`);
    
    if (!fs.existsSync(dirPath)) {
        console.log(`  ⚠️ Klasör bulunamadı: ${dirPath}`);
        return { inserted: 0, skipped: 0 };
    }
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    let totalInserted = 0;
    let totalSkipped = 0;
    
    for (const file of files) {
        const result = await processJsonFile(path.join(dirPath, file), source);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
    }
    
    return { inserted: totalInserted, skipped: totalSkipped };
}

// Ana migration fonksiyonu
async function migrate() {
    console.log('🚀 Migration başlıyor...\n');
    
    try {
        // Bağlantı testi
        await pool.query('SELECT NOW()');
        console.log('✅ PostgreSQL bağlantısı başarılı\n');
        
        // Tabloları oluştur
        await createTables();
        
        let totalInserted = 0;
        let totalSkipped = 0;
        
        // yds_questions klasörü
        const ydsResult = await processDirectory('./yds_questions', 'sorukurdu');
        totalInserted += ydsResult.inserted;
        totalSkipped += ydsResult.skipped;
        
        // yds_questions_gpt klasörü
        const gptResult = await processDirectory('./yds_questions_gpt', 'gpt');
        totalInserted += gptResult.inserted;
        totalSkipped += gptResult.skipped;
        
        // quiz-app/yds_questions klasörü (farklı sorular varsa)
        const quizResult = await processDirectory('./quiz-app/yds_questions', 'sorukurdu');
        totalInserted += quizResult.inserted;
        totalSkipped += quizResult.skipped;
        
        // Özet
        console.log('\n' + '='.repeat(50));
        console.log('📊 MIGRATION TAMAMLANDI');
        console.log('='.repeat(50));
        console.log(`✅ Toplam eklenen soru: ${totalInserted}`);
        console.log(`⏭️ Toplam atlanan soru: ${totalSkipped}`);
        
        // Kategori özeti
        const categories = await pool.query(
            'SELECT name, question_count, source FROM categories ORDER BY question_count DESC'
        );
        
        console.log('\n📋 Kategoriler:');
        for (const cat of categories.rows) {
            console.log(`  - ${cat.name}: ${cat.question_count} soru (${cat.source})`);
        }
        
        const totalInDb = await pool.query('SELECT COUNT(*) as count FROM questions');
        console.log(`\n📦 Veritabanındaki toplam soru: ${totalInDb.rows[0].count}`);
        
    } catch (err) {
        console.error('❌ Migration hatası:', err);
    } finally {
        await pool.end();
        console.log('\n👋 Bağlantı kapatıldı');
    }
}

// Migration'ı çalıştır
migrate();
