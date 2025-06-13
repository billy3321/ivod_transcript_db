#!/usr/bin/env python3
"""
Tests for the configuration module.
"""

import os
import pytest
from unittest.mock import patch, mock_open
from pathlib import Path

from ivod.config import (
    DatabaseConfig,
    ElasticsearchConfig,
    CrawlerConfig,
    IVODConfig,
    load_config,
    get_config,
    reload_config,
)
from ivod.exceptions import IVODConfigurationError


class TestDatabaseConfig:
    """Test database configuration validation."""
    
    def test_valid_sqlite_config(self):
        """Test valid SQLite configuration."""
        config = DatabaseConfig(backend="sqlite")
        config.validate()  # Should not raise
    
    def test_valid_postgresql_config(self):
        """Test valid PostgreSQL configuration."""
        config = DatabaseConfig(
            backend="postgresql",
            pg_host="localhost",
            pg_port=5432,
            pg_user="user",
            pg_pass="pass",
            pg_db="db"
        )
        config.validate()  # Should not raise
    
    def test_valid_mysql_config(self):
        """Test valid MySQL configuration."""
        config = DatabaseConfig(
            backend="mysql",
            mysql_host="localhost",
            mysql_port=3306,
            mysql_user="user",
            mysql_pass="pass",
            mysql_db="db"
        )
        config.validate()  # Should not raise
    
    def test_invalid_backend(self):
        """Test invalid database backend."""
        config = DatabaseConfig(backend="invalid")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid database backend" in str(exc_info.value)
        assert exc_info.value.config_key == "DB_BACKEND"
    
    def test_incomplete_postgresql_config(self):
        """Test incomplete PostgreSQL configuration."""
        config = DatabaseConfig(backend="postgresql", pg_host="", pg_user="user")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "PostgreSQL configuration incomplete" in str(exc_info.value)
    
    def test_invalid_postgresql_port(self):
        """Test invalid PostgreSQL port."""
        config = DatabaseConfig(
            backend="postgresql",
            pg_host="localhost",
            pg_port=70000,
            pg_user="user",
            pg_pass="pass",
            pg_db="db"
        )
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid PostgreSQL port" in str(exc_info.value)
    
    def test_incomplete_mysql_config(self):
        """Test incomplete MySQL configuration."""
        config = DatabaseConfig(backend="mysql", mysql_host="", mysql_user="user")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "MySQL configuration incomplete" in str(exc_info.value)
    
    def test_invalid_mysql_port(self):
        """Test invalid MySQL port."""
        config = DatabaseConfig(
            backend="mysql",
            mysql_host="localhost",
            mysql_port=0,
            mysql_user="user",
            mysql_pass="pass",
            mysql_db="db"
        )
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid MySQL port" in str(exc_info.value)


class TestElasticsearchConfig:
    """Test Elasticsearch configuration validation."""
    
    def test_valid_config(self):
        """Test valid Elasticsearch configuration."""
        config = ElasticsearchConfig()
        config.validate()  # Should not raise
    
    def test_invalid_port(self):
        """Test invalid port."""
        config = ElasticsearchConfig(port=70000)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid Elasticsearch port" in str(exc_info.value)
    
    def test_invalid_scheme(self):
        """Test invalid scheme."""
        config = ElasticsearchConfig(scheme="ftp")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid Elasticsearch scheme" in str(exc_info.value)
    
    def test_empty_host(self):
        """Test empty host."""
        config = ElasticsearchConfig(host="")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Elasticsearch host not configured" in str(exc_info.value)


class TestCrawlerConfig:
    """Test crawler configuration validation."""
    
    def test_valid_config(self):
        """Test valid crawler configuration."""
        config = CrawlerConfig()
        config.validate()  # Should not raise
    
    def test_invalid_timeout(self):
        """Test invalid timeout."""
        config = CrawlerConfig(timeout=0)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid timeout" in str(exc_info.value)
    
    def test_invalid_max_retries(self):
        """Test invalid max_retries."""
        config = CrawlerConfig(max_retries=-1)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid max_retries" in str(exc_info.value)
    
    def test_invalid_batch_size(self):
        """Test invalid batch_size."""
        config = CrawlerConfig(batch_size=0)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid batch_size" in str(exc_info.value)
    
    def test_invalid_commit_interval(self):
        """Test invalid commit_interval."""
        config = CrawlerConfig(commit_interval=0)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid commit_interval" in str(exc_info.value)
    
    def test_invalid_sleep_range(self):
        """Test invalid sleep range."""
        config = CrawlerConfig(min_sleep=2.0, max_sleep=1.0)
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid sleep range" in str(exc_info.value)


class TestIVODConfig:
    """Test main configuration class."""
    
    def test_valid_config(self):
        """Test valid complete configuration."""
        config = IVODConfig()
        config.validate()  # Should not raise
    
    def test_invalid_environment(self):
        """Test invalid environment."""
        config = IVODConfig(environment="invalid")
        with pytest.raises(IVODConfigurationError) as exc_info:
            config.validate()
        assert "Invalid environment" in str(exc_info.value)


class TestConfigLoading:
    """Test configuration loading from environment."""
    
    @patch.dict(os.environ, {"DB_BACKEND": "postgresql", "PG_HOST": "testhost"})
    def test_load_config_from_env(self):
        """Test loading configuration from environment variables."""
        config = load_config()
        assert config.database.backend == "postgresql"
        assert config.database.pg_host == "testhost"
    
    @patch.dict(os.environ, {"TESTING": "true"})
    def test_testing_environment_detection(self):
        """Test testing environment detection."""
        config = load_config()
        assert config.environment == "testing"
    
    @patch.dict(os.environ, {"DB_ENV": "production"})
    def test_production_environment_detection(self):
        """Test production environment detection."""
        config = load_config()
        assert config.environment == "production"
    
    def test_development_environment_default(self):
        """Test development environment as default."""
        with patch.dict(os.environ, {}, clear=True):
            config = load_config()
            assert config.environment == "development"
    
    @patch("pathlib.Path.exists")
    @patch("ivod.config.load_dotenv")
    def test_dotenv_loading(self, mock_load_dotenv, mock_exists):
        """Test .env file loading."""
        mock_exists.return_value = True
        load_config()
        mock_load_dotenv.assert_called_once()
    
    def test_get_config_singleton(self):
        """Test that get_config returns the same instance."""
        config1 = get_config()
        config2 = get_config()
        assert config1 is config2
    
    def test_reload_config(self):
        """Test config reloading."""
        config1 = get_config()
        config2 = reload_config()
        # Should be different instances after reload
        assert config1 is not config2


class TestConfigErrorHandling:
    """Test configuration error handling."""
    
    @patch.dict(os.environ, {"DB_BACKEND": "postgresql", "PG_PORT": "invalid"})
    def test_invalid_port_type(self):
        """Test handling of invalid port type."""
        with pytest.raises(ValueError):
            load_config()
    
    @patch.dict(os.environ, {"ES_PORT": "invalid"})
    def test_invalid_es_port_type(self):
        """Test handling of invalid Elasticsearch port type."""
        with pytest.raises(ValueError):
            load_config()