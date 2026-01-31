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

# Category file mapping
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
    'Tenses': 'tenses.json'
}

def create_tables(conn):
    """Create database tables if they don't exist."""
    cursor = conn.cursor()
    
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_category 
        ON questions(category)
    """)
    
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
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_wrong_answers (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            question_id INTEGER REFERENCES questions(id),
            user_answer VARCHAR(10),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS gpt_explanations (
            id SERIAL PRIMARY KEY,
            question_hash VARCHAR(50) UNIQUE NOT NULL,
            question_text TEXT,
            explanation TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    base_path = Path(__file__).parent / 'quiz-app' / 'yds_questions'
    total_inserted = 0
    
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
