"""
Configuration Management
Çevre değişkenleri ve yapılandırma yönetimi
"""

import os
from dotenv import load_dotenv
from typing import Optional


class Config:
    """Singleton configuration manager"""
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self._load_environment()
            self._initialized = True
    
    def _load_environment(self):
        """Load environment variables from .env files"""
        load_dotenv()
        load_dotenv(".env.local")
    
    def get_database_url(self) -> str:
        """
        Get and parse DATABASE_URL from environment
        Handles psql command format cleanup
        """
        url = os.getenv("DATABASE_URL")
        if not url:
            raise ValueError("DATABASE_URL not found in environment variables")
        
        # Clean up psql command format
        if url.startswith("psql '"):
            url = url[6:-1]
        elif url.startswith("psql "):
            url = url[5:]
        
        return url.strip("'\"")
    
    def get_openai_key(self) -> str:
        """Get OpenAI API key from environment"""
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        return key
    
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get any environment variable"""
        return os.getenv(key, default)


# Global config instance
config = Config()


def get_database_url() -> str:
    """Convenience function to get database URL"""
    return config.get_database_url()


def get_openai_key() -> str:
    """Convenience function to get OpenAI API key"""
    return config.get_openai_key()
