"""
資料庫環境設定工具
根據不同環境（development、production、testing）提供不同的資料庫設定
"""

import os
from typing import Literal, Dict, Any

DatabaseEnvironment = Literal['development', 'production', 'testing']

def get_database_environment() -> DatabaseEnvironment:
    """
    獲取當前資料庫環境
    
    優先順序：
    1. 如果是 integration_test.py 或測試環境 -> testing
    2. 如果設定 DB_ENV=production -> production  
    3. 預設為 development
    """
    # 檢查是否為測試環境
    if (os.getenv('PYTEST_RUNNING') == 'true' or 
        os.getenv('TESTING') == 'true' or
        'pytest' in os.getenv('_', '')):
        return 'testing'
    
    # 檢查是否指定使用 production 環境
    if os.getenv('DB_ENV') == 'production':
        return 'production'
    
    # 預設為開發環境
    return 'development'

def get_database_config(env: DatabaseEnvironment = None) -> Dict[str, Any]:
    """根據環境獲取資料庫設定"""
    if env is None:
        env = get_database_environment()
    
    db_backend = (os.getenv("DB_BACKEND", "sqlite") or "sqlite").strip().lower()
    
    if db_backend == "sqlite":
        return get_sqlite_config(env)
    elif db_backend == "postgresql":
        return get_postgresql_config(env)
    elif db_backend == "mysql":
        return get_mysql_config(env)
    else:
        raise ValueError(f"Unsupported database backend: {db_backend}")

def get_sqlite_config(env: DatabaseEnvironment) -> Dict[str, Any]:
    """SQLite 環境設定"""
    base_path = "../db"
    
    if env == 'testing':
        path = os.getenv("TEST_SQLITE_PATH", f"{base_path}/ivod_test.db").strip()
    elif env == 'development':
        path = os.getenv("DEV_SQLITE_PATH", f"{base_path}/ivod_dev.db").strip()
    else:  # production
        path = os.getenv("SQLITE_PATH", f"{base_path}/ivod_local.db").strip()
    
    return {
        "backend": "sqlite",
        "path": path,
        "url": f"sqlite:///{path}"
    }

def get_postgresql_config(env: DatabaseEnvironment) -> Dict[str, Any]:
    """PostgreSQL 環境設定"""
    base_config = {
        "host": os.getenv("PG_HOST", "localhost"),
        "port": int(os.getenv("PG_PORT", "5432")),
        "user": os.getenv("PG_USER", "ivod_user"),
        "pass": os.getenv("PG_PASS", "ivod_password")
    }
    
    if env == 'testing':
        database = os.getenv("PG_TEST_DB", "ivod_test_db")
    elif env == 'development':
        database = os.getenv("PG_DEV_DB", "ivod_dev_db")
    else:  # production
        database = os.getenv("PG_DB", "ivod_db")
    
    return {
        "backend": "postgresql",
        "database": database,
        "url": f"postgresql://{base_config['user']}:{base_config['pass']}@{base_config['host']}:{base_config['port']}/{database}",
        **base_config
    }

def get_mysql_config(env: DatabaseEnvironment) -> Dict[str, Any]:
    """MySQL 環境設定"""
    base_config = {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": int(os.getenv("MYSQL_PORT", "3306")),
        "user": os.getenv("MYSQL_USER", "ivod_user"),
        "pass": os.getenv("MYSQL_PASS", "ivod_password")
    }
    
    if env == 'testing':
        database = os.getenv("MYSQL_TEST_DB", "ivod_test_db")
    elif env == 'development':
        database = os.getenv("MYSQL_DEV_DB", "ivod_dev_db")
    else:  # production
        database = os.getenv("MYSQL_DB", "ivod_db")
    
    return {
        "backend": "mysql",
        "database": database,
        "url": f"mysql+pymysql://{base_config['user']}:{base_config['pass']}@{base_config['host']}:{base_config['port']}/{database}?charset=utf8mb4",
        **base_config
    }

def get_elasticsearch_config(env: DatabaseEnvironment = None) -> Dict[str, Any]:
    """獲取 Elasticsearch 設定（根據環境）"""
    if env is None:
        env = get_database_environment()
    
    try:
        port = int(os.getenv("ES_PORT", "9200") or "9200")
    except ValueError:
        raise ValueError("Invalid ES_PORT: must be a valid integer")
    
    base_config = {
        "host": os.getenv("ES_HOST", "localhost") or "localhost",
        "port": port,
        "scheme": os.getenv("ES_SCHEME", "http") or "http",
        "user": os.getenv("ES_USER"),
        "password": os.getenv("ES_PASS")
    }
    
    if env == 'testing':
        index = os.getenv("ES_TEST_INDEX", "ivod_test_transcripts")
    elif env == 'development':
        index = os.getenv("ES_DEV_INDEX", "ivod_dev_transcripts")
    else:  # production
        index = os.getenv("ES_INDEX", "ivod_transcripts")
    
    return {
        **base_config,
        "index": index
    }

def mask_database_url(url: str) -> str:
    """遮蔽連線 URL 中的密碼，避免印出或寫入 log"""
    import re
    return re.sub(r'://([^:/@]+):([^@]+)@', r'://\1:***@', url)

def print_database_info():
    """顯示當前資料庫環境資訊（用於除錯）"""
    env = get_database_environment()
    db_config = get_database_config(env)
    es_config = get_elasticsearch_config(env)

    print(f"🗄️  Database Environment: {env}")
    print(f"🔗 Database URL: {mask_database_url(db_config.get('url', 'N/A'))}")
    print(f"🔍 Elasticsearch Index: {es_config['index']}")