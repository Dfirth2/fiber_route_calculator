import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config: SettingsConfigDict = SettingsConfigDict(env_file=".env")
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./fiber_db.sqlite" if os.getenv("ENVIRONMENT", "development") == "development" 
        else "postgresql://fiber_user:fiber_password@localhost:5432/fiber_db"
    )
    
    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # File upload
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/fiber_uploads")
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    
    # CORS - can be a JSON array string or comma-separated string
    CORS_ORIGINS: Union[List[str], str] = "http://localhost:3000,http://localhost:8000,http://localhost:5173,http://piwebhost.local,http://piwebhost.local:3000,http://piwebhost.local:80,http://127.0.0.1:3000,http://127.0.0.1:80,http://piwebhost.narwhal-oratrice.ts.net,http://piwebhost.narwhal-oratrice.ts.net:80"
    
    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
settings = Settings()
