from scripts.db_utils import get_db_connection

print("Connecting...")

with get_db_connection() as conn:
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
