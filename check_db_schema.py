import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()
load_dotenv(".env.local")

url = os.getenv("DATABASE_URL")
if url:
    url = url.replace("psql '", "").replace("psql ", "").strip("'\"")

print(f"Connecting to: {url[:50]}...")

conn = psycopg2.connect(url)
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'questions'
    ORDER BY ordinal_position
""")

print("\nQuestions table columns:")
for row in cur.fetchall():
    print(f"  - {row[0]}: {row[1]}")

cur.close()
conn.close()
