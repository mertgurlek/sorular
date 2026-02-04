"""
Database Utilities
PostgreSQL bağlantı ve sorgu yönetimi
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from typing import Optional, Any, Callable, List, Dict
from contextlib import contextmanager
import time

from .config import get_database_url


class DatabaseManager:
    """Singleton database connection manager with pooling support"""
    _instance = None
    _pool: Optional[pool.ThreadedConnectionPool] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self._database_url = get_database_url()
    
    def get_connection_pool(self, min_conn: int = 1, max_conn: int = 10) -> pool.ThreadedConnectionPool:
        """
        Get or create connection pool
        
        Args:
            min_conn: Minimum number of connections
            max_conn: Maximum number of connections
        """
        if self._pool is None:
            self._pool = pool.ThreadedConnectionPool(
                min_conn,
                max_conn,
                self._database_url,
                connect_timeout=30
            )
        return self._pool
    
    def get_connection(self, use_dict_cursor: bool = False, retries: int = 3):
        """
        Get a database connection with retry mechanism
        
        Args:
            use_dict_cursor: Use RealDictCursor for dict-like results
            retries: Number of retry attempts
        """
        cursor_factory = RealDictCursor if use_dict_cursor else None
        
        for attempt in range(retries):
            try:
                if self._pool:
                    conn = self._pool.getconn()
                    if use_dict_cursor and not hasattr(conn, 'cursor_factory'):
                        conn.cursor_factory = RealDictCursor
                    return conn
                else:
                    return psycopg2.connect(
                        self._database_url,
                        cursor_factory=cursor_factory,
                        connect_timeout=30
                    )
            except Exception as e:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt)
                else:
                    raise e
    
    def release_connection(self, conn):
        """Release connection back to pool"""
        if self._pool and conn:
            try:
                self._pool.putconn(conn)
            except:
                pass
    
    def close_pool(self):
        """Close all connections in pool"""
        if self._pool:
            self._pool.closeall()
            self._pool = None


# Global database manager instance
db_manager = DatabaseManager()


@contextmanager
def get_db_connection(use_dict_cursor: bool = False):
    """
    Context manager for database connections
    
    Usage:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM users")
    """
    conn = db_manager.get_connection(use_dict_cursor=use_dict_cursor)
    try:
        yield conn
    finally:
        db_manager.release_connection(conn)


def execute_query(query: str, params: tuple = None, fetch_one: bool = False, 
                 fetch_all: bool = True, use_dict_cursor: bool = True) -> Optional[Any]:
    """
    Execute a SQL query with automatic connection management
    
    Args:
        query: SQL query string
        params: Query parameters
        fetch_one: Return single result
        fetch_all: Return all results
        use_dict_cursor: Use dictionary cursor
    
    Returns:
        Query results or None
    """
    with get_db_connection(use_dict_cursor=use_dict_cursor) as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        
        if fetch_one:
            result = cur.fetchone()
        elif fetch_all:
            result = cur.fetchall()
        else:
            result = None
        
        conn.commit()
        cur.close()
        return result


def execute_transaction(callback: Callable, use_dict_cursor: bool = True) -> Any:
    """
    Execute multiple queries in a transaction
    
    Args:
        callback: Function that receives cursor and performs queries
        use_dict_cursor: Use dictionary cursor
    
    Returns:
        Result from callback function
    
    Usage:
        def insert_user(cur):
            cur.execute("INSERT INTO users ...")
            return cur.fetchone()
        
        result = execute_transaction(insert_user)
    """
    with get_db_connection(use_dict_cursor=use_dict_cursor) as conn:
        cur = conn.cursor()
        try:
            conn.autocommit = False
            result = callback(cur)
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cur.close()


def batch_insert(table: str, columns: List[str], values: List[tuple], 
                batch_size: int = 100) -> int:
    """
    Batch insert records into database
    
    Args:
        table: Table name
        columns: Column names
        values: List of value tuples
        batch_size: Number of records per batch
    
    Returns:
        Number of inserted records
    """
    inserted = 0
    placeholders = ','.join(['%s'] * len(columns))
    query = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})"
    
    with get_db_connection() as conn:
        cur = conn.cursor()
        
        for i in range(0, len(values), batch_size):
            batch = values[i:i + batch_size]
            try:
                cur.executemany(query, batch)
                conn.commit()
                inserted += len(batch)
            except Exception as e:
                conn.rollback()
                print(f"Batch insert error: {e}")
        
        cur.close()
    
    return inserted


def get_categories() -> List[Dict]:
    """Get all question categories from database"""
    query = """
        SELECT DISTINCT category, COUNT(*) as count 
        FROM questions 
        WHERE category IS NOT NULL
        GROUP BY category 
        ORDER BY count DESC
    """
    return execute_query(query, fetch_all=True, use_dict_cursor=True)


def check_question_exists(question_text: str, category: str) -> bool:
    """Check if a question already exists in database"""
    query = """
        SELECT id FROM questions 
        WHERE question_text = %s AND category = %s
    """
    result = execute_query(query, (question_text, category), fetch_one=True)
    return result is not None
