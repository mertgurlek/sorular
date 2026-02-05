"""
Migration script to transfer questions from JSON files to PostgreSQL.
Run this locally before deploying to Vercel.

Usage:
    1. Set DATABASE_URL environment variable
    2. Run: python migrate_to_postgres.py
"""

import os
import json
import psycopg2
from psycopg2.extras import Json
from pathlib import Path

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL environment variable not set!")
    print("Set it like: set DATABASE_URL=postgres://user:pass@host:port/db")
    exit(1)

# Category file mapping - Gramer kategorileri
CATEGORY_FILES = {
    'Adjectives & Adverbs': 'adjectives_adverbs.json',
    'Conjunctions': 'conjunctions.json',
    'Gerunds & Infinitives': 'gerunds_infinitives.json',
    'Grammar Revision': 'grammar_revision.json',
    'If Clauses': 'if_clauses.json',
    'Modals': 'modals.json',
    'Noun Clauses': 'noun_clauses.json',
    'Nouns': 'nouns.json',
    'Passive': 'passive.json',
    'Reductions': 'reductions.json',
    'Relative Clauses': 'relative_clauses.json',
    'Tenses': 'tenses.json',
    # YDS soru tipleri
    'YDS Cümle Tamamlama': 'yds_cümle_tamamlama.json',
    'YDS Diyalog': 'yds_diyalog.json',
    'YDS Durum': 'yds_durum.json',
    'YDS Eş Anlam': 'yds_eş_anlam.json',
    'YDS İlgisiz Cümleyi Bulma': 'yds_ilgisiz_cümleyi_bulma.json',
    'YDS Kelime Soruları': 'yds_kelime_soruları.json',
    'YDS Okuma Soruları': 'yds_okuma_soruları.json',
    'YDS Paragraf Doldurma': 'yds_paragraf_doldurma.json',
    'YDS Phrasal Verbs & Prepositions': 'yds_phrasal_verbs_prepositions.json',
    'YDS Çeviri Soruları': 'yds_çeviri_soruları.json'
}

def create_tables(conn):
    """Create database tables if they don't exist."""
    cursor = conn.cursor()
    
    # ==================== QUESTIONS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id SERIAL PRIMARY KEY,
            question_number VARCHAR(20),
            question_text TEXT NOT NULL,
            options JSONB NOT NULL,
            correct_answer VARCHAR(5) NOT NULL,
            category VARCHAR(100) NOT NULL,
            url TEXT,
            test_url TEXT,
            question_tr TEXT,
            explanation_tr TEXT,
            tested_skill VARCHAR(200),
            difficulty VARCHAR(20) DEFAULT 'medium',
            tip TEXT,
            is_valid BOOLEAN DEFAULT true,
            gpt_status VARCHAR(20),
            gpt_verified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category)")
    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_text_category ON questions(md5(question_text), category)")
    
    # ==================== USERS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    """)
    
    # ==================== USER STATS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            total_answered INTEGER DEFAULT 0,
            total_correct INTEGER DEFAULT 0,
            total_wrong INTEGER DEFAULT 0,
            streak_days INTEGER DEFAULT 0,
            last_activity_date DATE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id)")
    
    # ==================== USER WRONG ANSWERS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_wrong_answers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            question_text TEXT NOT NULL,
            category VARCHAR(100),
            user_answer VARCHAR(10),
            correct_answer VARCHAR(10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_wrong_answers_user_id ON user_wrong_answers(user_id)")
    
    # ==================== GPT EXPLANATIONS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gpt_explanations (
            id SERIAL PRIMARY KEY,
            question_hash VARCHAR(50) UNIQUE NOT NULL,
            question_text TEXT,
            explanation TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # ==================== USER UNKNOWN WORDS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_unknown_words (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            word VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, word)
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_unknown_words_user_id ON user_unknown_words(user_id)")
    
    # ==================== USER ANSWER HISTORY ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_answer_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            question_hash VARCHAR(100) NOT NULL,
            question_text TEXT,
            category VARCHAR(100),
            user_answer VARCHAR(10),
            is_correct BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_answer_history_user_question ON user_answer_history(user_id, question_hash)")
    
    # ==================== USER FAVORITES ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_favorites (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            question_id INTEGER,
            question_text TEXT NOT NULL,
            question_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, question_text)
        )
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id)")
    
    # ==================== USER DAILY STATS ====================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_daily_stats (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            answered INTEGER DEFAULT 0,
            correct INTEGER DEFAULT 0,
            UNIQUE(user_id, date)
        )
    """)
    
    conn.commit()
    print("✅ Database tables created")

def migrate_questions(conn):
    """Migrate questions from JSON files to PostgreSQL."""
    cursor = conn.cursor()
    
    # Clear existing questions
    cursor.execute("DELETE FROM questions")
    conn.commit()
    print("🗑️ Cleared existing questions")
    
    base_path = Path(__file__).parent / 'yds_questions'
    total_inserted = 0
    
    # 1. Migrate grammar category files
    for category_name, filename in CATEGORY_FILES.items():
        filepath = base_path / filename
        
        if not filepath.exists():
            print(f"⚠️ File not found: {filepath}")
            continue
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        questions = data.get('questions', [])
        inserted = 0
        
        for q in questions:
            if not q.get('question_text') or not q.get('correct_answer'):
                continue
            
            cursor.execute("""
                INSERT INTO questions 
                (question_number, question_text, options, correct_answer, category, url, test_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                q.get('question_number', ''),
                q['question_text'],
                Json(q.get('options', [])),
                q['correct_answer'],
                category_name,
                q.get('url', ''),
                q.get('test_url', '')
            ))
            inserted += 1
        
        conn.commit()
        total_inserted += inserted
        print(f"✅ {category_name}: {inserted} questions inserted")
    
    # 2. Migrate YDS all categories file
    yds_all_path = base_path / 'yds_all_categories.json'
    if yds_all_path.exists():
        with open(yds_all_path, 'r', encoding='utf-8') as f:
            yds_data = json.load(f)
        
        yds_questions = yds_data.get('questions', [])
        yds_inserted = 0
        
        for q in yds_questions:
            if not q.get('question_text') or not q.get('correct_answer'):
                continue
            
            # Use category from question or default
            category = q.get('category', 'YDS Genel')
            
            cursor.execute("""
                INSERT INTO questions 
                (question_number, question_text, options, correct_answer, category, url, test_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                q.get('question_number', ''),
                q['question_text'],
                Json(q.get('options', [])),
                q['correct_answer'],
                category,
                q.get('url', ''),
                q.get('test_url', '')
            ))
            yds_inserted += 1
        
        conn.commit()
        total_inserted += yds_inserted
        print(f"✅ YDS All Categories: {yds_inserted} questions inserted")
    
    print(f"\n🎉 Total: {total_inserted} questions migrated to PostgreSQL")

def main():
    print("🔄 Connecting to PostgreSQL...")
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print("✅ Connected to database")
        
        create_tables(conn)
        migrate_questions(conn)
        
        conn.close()
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        exit(1)

if __name__ == '__main__':
    main()
