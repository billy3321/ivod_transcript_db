#!/usr/bin/env python3
"""
Configuration management for the IVOD crawler system.
Provides centralized configuration loading, validation, and defaults.
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from dotenv import load_dotenv

from .exceptions import IVODConfigurationError


@dataclass
class DatabaseConfig:
    """Database configuration settings."""
    backend: str = "sqlite"
    
    # SQLite settings
    sqlite_path: str = "../db/ivod_local.db"
    dev_sqlite_path: str = "../db/ivod_dev.db"
    test_sqlite_path: str = "../db/ivod_test.db"
    
    # PostgreSQL settings
    pg_host: str = "localhost"
    pg_port: int = 5432
    pg_user: str = "ivod_user"
    pg_pass: str = "ivod_password"
    pg_db: str = "ivod_db"
    pg_dev_db: str = "ivod_dev_db"
    pg_test_db: str = "ivod_test_db"
    
    # MySQL settings
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "ivod_user"
    mysql_pass: str = "ivod_password"
    mysql_db: str = "ivod_db"
    mysql_dev_db: str = "ivod_dev_db"
    mysql_test_db: str = "ivod_test_db"
    
    def validate(self):
        """Validate database configuration."""
        if self.backend not in ["sqlite", "postgresql", "mysql"]:
            raise IVODConfigurationError(
                f"Invalid database backend: {self.backend}. Must be one of: sqlite, postgresql, mysql",
                config_key="DB_BACKEND"
            )
        
        if self.backend == "postgresql":
            if not all([self.pg_host, self.pg_user, self.pg_pass, self.pg_db]):
                raise IVODConfigurationError(
                    "PostgreSQL configuration incomplete. Required: PG_HOST, PG_USER, PG_PASS, PG_DB",
                    config_key="postgresql"
                )
            if not (1 <= self.pg_port <= 65535):
                raise IVODConfigurationError(
                    f"Invalid PostgreSQL port: {self.pg_port}. Must be between 1 and 65535",
                    config_key="PG_PORT"
                )
                
        elif self.backend == "mysql":
            if not all([self.mysql_host, self.mysql_user, self.mysql_pass, self.mysql_db]):
                raise IVODConfigurationError(
                    "MySQL configuration incomplete. Required: MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DB",
                    config_key="mysql"
                )
            if not (1 <= self.mysql_port <= 65535):
                raise IVODConfigurationError(
                    f"Invalid MySQL port: {self.mysql_port}. Must be between 1 and 65535",
                    config_key="MYSQL_PORT"
                )
        
        elif self.backend == "sqlite":
            # Validate SQLite paths
            for path_name, path_value in [
                ("SQLITE_PATH", self.sqlite_path),
                ("DEV_SQLITE_PATH", self.dev_sqlite_path),
                ("TEST_SQLITE_PATH", self.test_sqlite_path)
            ]:
                if not path_value:
                    raise IVODConfigurationError(
                        f"SQLite path not configured: {path_name}",
                        config_key=path_name
                    )
                
                # Create directory if it doesn't exist
                db_dir = Path(path_value).parent
                if not db_dir.exists():
                    try:
                        db_dir.mkdir(parents=True, exist_ok=True)
                    except OSError as e:
                        raise IVODConfigurationError(
                            f"Cannot create SQLite directory {db_dir}: {e}",
                            config_key=path_name
                        )


@dataclass
class ElasticsearchConfig:
    """Elasticsearch configuration settings."""
    host: str = "localhost"
    port: int = 9200
    scheme: str = "http"
    user: Optional[str] = None
    password: Optional[str] = None
    
    # Index names
    index: str = "ivod_transcripts"
    dev_index: str = "ivod_dev_transcripts"
    test_index: str = "ivod_test_transcripts"
    
    def validate(self):
        """Validate Elasticsearch configuration."""
        if not (1 <= self.port <= 65535):
            raise IVODConfigurationError(
                f"Invalid Elasticsearch port: {self.port}. Must be between 1 and 65535",
                config_key="ES_PORT"
            )
        
        if self.scheme not in ["http", "https"]:
            raise IVODConfigurationError(
                f"Invalid Elasticsearch scheme: {self.scheme}. Must be 'http' or 'https'",
                config_key="ES_SCHEME"
            )
        
        if not self.host:
            raise IVODConfigurationError(
                "Elasticsearch host not configured",
                config_key="ES_HOST"
            )


@dataclass
class CrawlerConfig:
    """Crawler-specific configuration settings."""
    skip_ssl: bool = False
    timeout: int = 30
    max_retries: int = 5
    batch_size: int = 100
    commit_interval: int = 10
    
    # Rate limiting
    min_sleep: float = 0.5
    max_sleep: float = 2.0
    
    # Logging
    log_path: str = "logs/"
    error_log_path: str = "logs/failed_ivods.txt"
    
    def validate(self):
        """Validate crawler configuration."""
        if self.timeout <= 0:
            raise IVODConfigurationError(
                f"Invalid timeout: {self.timeout}. Must be positive",
                config_key="timeout"
            )
        
        if self.max_retries < 0:
            raise IVODConfigurationError(
                f"Invalid max_retries: {self.max_retries}. Must be non-negative",
                config_key="max_retries"
            )
        
        if self.batch_size <= 0:
            raise IVODConfigurationError(
                f"Invalid batch_size: {self.batch_size}. Must be positive",
                config_key="batch_size"
            )
        
        if self.commit_interval <= 0:
            raise IVODConfigurationError(
                f"Invalid commit_interval: {self.commit_interval}. Must be positive",
                config_key="commit_interval"
            )
        
        if self.min_sleep < 0 or self.max_sleep < 0 or self.min_sleep > self.max_sleep:
            raise IVODConfigurationError(
                f"Invalid sleep range: {self.min_sleep}-{self.max_sleep}. Must be non-negative and min <= max",
                config_key="sleep_range"
            )
        
        # Ensure log directories exist
        for path_name, path_value in [("log_path", self.log_path), ("error_log_path", self.error_log_path)]:
            if path_value:
                log_dir = Path(path_value).parent if Path(path_value).suffix else Path(path_value)
                try:
                    log_dir.mkdir(parents=True, exist_ok=True)
                except OSError as e:
                    raise IVODConfigurationError(
                        f"Cannot create log directory {log_dir}: {e}",
                        config_key=path_name
                    )


@dataclass
class IVODConfig:
    """Main configuration class that combines all settings."""
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    elasticsearch: ElasticsearchConfig = field(default_factory=ElasticsearchConfig)
    crawler: CrawlerConfig = field(default_factory=CrawlerConfig)
    
    # Environment tracking
    environment: str = "development"
    
    def validate(self):
        """Validate all configuration sections."""
        self.database.validate()
        self.elasticsearch.validate()
        self.crawler.validate()
        
        if self.environment not in ["development", "testing", "production"]:
            raise IVODConfigurationError(
                f"Invalid environment: {self.environment}. Must be one of: development, testing, production",
                config_key="environment"
            )


def load_config() -> IVODConfig:
    """Load configuration from environment variables with validation."""
    
    # Load .env file if it exists
    env_file = Path(".env")
    if env_file.exists():
        load_dotenv(env_file)
    
    # Determine environment
    environment = "development"
    if os.getenv("TESTING", "false").lower() == "true" or os.getenv("PYTEST_RUNNING", "false").lower() == "true":
        environment = "testing"
    elif os.getenv("DB_ENV") == "production":
        environment = "production"
    
    # Database configuration
    db_config = DatabaseConfig(
        backend=os.getenv("DB_BACKEND", "sqlite"),
        
        # SQLite
        sqlite_path=os.getenv("SQLITE_PATH", "../db/ivod_local.db"),
        dev_sqlite_path=os.getenv("DEV_SQLITE_PATH", "../db/ivod_dev.db"),
        test_sqlite_path=os.getenv("TEST_SQLITE_PATH", "../db/ivod_test.db"),
        
        # PostgreSQL
        pg_host=os.getenv("PG_HOST", "localhost"),
        pg_port=int(os.getenv("PG_PORT", "5432")),
        pg_user=os.getenv("PG_USER", "ivod_user"),
        pg_pass=os.getenv("PG_PASS", "ivod_password"),
        pg_db=os.getenv("PG_DB", "ivod_db"),
        pg_dev_db=os.getenv("PG_DEV_DB", "ivod_dev_db"),
        pg_test_db=os.getenv("PG_TEST_DB", "ivod_test_db"),
        
        # MySQL
        mysql_host=os.getenv("MYSQL_HOST", "localhost"),
        mysql_port=int(os.getenv("MYSQL_PORT", "3306")),
        mysql_user=os.getenv("MYSQL_USER", "ivod_user"),
        mysql_pass=os.getenv("MYSQL_PASS", "ivod_password"),
        mysql_db=os.getenv("MYSQL_DB", "ivod_db"),
        mysql_dev_db=os.getenv("MYSQL_DEV_DB", "ivod_dev_db"),
        mysql_test_db=os.getenv("MYSQL_TEST_DB", "ivod_test_db"),
    )
    
    # Elasticsearch configuration
    es_config = ElasticsearchConfig(
        host=os.getenv("ES_HOST", "localhost"),
        port=int(os.getenv("ES_PORT", "9200")),
        scheme=os.getenv("ES_SCHEME", "http"),
        user=os.getenv("ES_USER"),
        password=os.getenv("ES_PASS"),
        index=os.getenv("ES_INDEX", "ivod_transcripts"),
        dev_index=os.getenv("ES_DEV_INDEX", "ivod_dev_transcripts"),
        test_index=os.getenv("ES_TEST_INDEX", "ivod_test_transcripts"),
    )
    
    # Crawler configuration
    crawler_config = CrawlerConfig(
        skip_ssl=os.getenv("SKIP_SSL", "false").lower() == "true",
        timeout=int(os.getenv("CRAWLER_TIMEOUT", "30")),
        max_retries=int(os.getenv("MAX_RETRIES", "5")),
        batch_size=int(os.getenv("BATCH_SIZE", "100")),
        commit_interval=int(os.getenv("COMMIT_INTERVAL", "10")),
        min_sleep=float(os.getenv("MIN_SLEEP", "0.5")),
        max_sleep=float(os.getenv("MAX_SLEEP", "2.0")),
        log_path=os.getenv("LOG_PATH", "logs/"),
        error_log_path=os.getenv("ERROR_LOG_PATH", "logs/failed_ivods.txt"),
    )
    
    config = IVODConfig(
        database=db_config,
        elasticsearch=es_config,
        crawler=crawler_config,
        environment=environment
    )
    
    # Validate all configuration
    config.validate()
    
    return config


# Global config instance
_config: Optional[IVODConfig] = None


def get_config() -> IVODConfig:
    """Get the global configuration instance, loading it if necessary."""
    global _config
    if _config is None:
        _config = load_config()
    return _config


def reload_config() -> IVODConfig:
    """Force reload the configuration from environment variables."""
    global _config
    _config = load_config()
    return _config