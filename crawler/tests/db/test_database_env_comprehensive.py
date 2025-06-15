#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for ivod.database_env module to improve coverage
"""
import pytest
import os
from unittest.mock import patch, Mock

from ivod.database_env import (
    get_database_environment, get_database_config, get_elasticsearch_config,
    DatabaseEnvironment
)


class TestEnvironmentDetection:
    """Test environment detection functionality"""
    
    def test_get_environment_testing_pytest(self, monkeypatch):
        """Test testing environment detection via PYTEST_RUNNING"""
        monkeypatch.setenv("PYTEST_RUNNING", "true")
        monkeypatch.delenv("TESTING", False)
        monkeypatch.delenv("DB_ENV", False)
        
        result = get_database_environment()
        
        assert result == "testing"
    
    def test_get_environment_testing_env_var(self, monkeypatch):
        """Test testing environment detection via TESTING env var"""
        monkeypatch.setenv("TESTING", "true")
        monkeypatch.delenv("PYTEST_RUNNING", False)
        monkeypatch.delenv("DB_ENV", False)
        
        result = get_database_environment()
        
        assert result == "testing"
    
    def test_get_environment_production(self, monkeypatch):
        """Test production environment detection"""
        monkeypatch.setenv("DB_ENV", "production")
        monkeypatch.delenv("TESTING", False)
        monkeypatch.delenv("PYTEST_RUNNING", False)
        
        result = get_database_environment()
        
        assert result == "production"
    
    def test_get_environment_development_default(self, monkeypatch):
        """Test development environment as default"""
        monkeypatch.delenv("DB_ENV", False)
        monkeypatch.delenv("TESTING", False)
        monkeypatch.delenv("PYTEST_RUNNING", False)
        
        result = get_database_environment()
        
        assert result == "development"
    
    def test_get_environment_pytest_in_underscore(self, monkeypatch):
        """Test testing environment detection via _ env var"""
        monkeypatch.setenv("_", "/usr/bin/pytest")
        monkeypatch.delenv("TESTING", False)
        monkeypatch.delenv("PYTEST_RUNNING", False)
        monkeypatch.delenv("DB_ENV", False)
        
        result = get_database_environment()
        
        assert result == "testing"


class TestDatabaseConfiguration:
    """Test database configuration for different environments"""
    
    def test_get_database_config_sqlite_production(self, monkeypatch):
        """Test SQLite configuration for production environment"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("SQLITE_PATH", "/prod/db.sqlite")
        
        config = get_database_config(DatabaseEnvironment.PRODUCTION)
        
        assert config["backend"] == "sqlite"
        assert config["path"] == "/prod/db.sqlite"
    
    def test_get_database_config_sqlite_development(self, monkeypatch):
        """Test SQLite configuration for development environment"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("DEV_SQLITE_PATH", "/dev/db.sqlite")
        
        config = get_database_config(DatabaseEnvironment.DEVELOPMENT)
        
        assert config["backend"] == "sqlite"
        assert config["path"] == "/dev/db.sqlite"
    
    def test_get_database_config_sqlite_testing(self, monkeypatch):
        """Test SQLite configuration for testing environment"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("TEST_SQLITE_PATH", "/test/db.sqlite")
        
        config = get_database_config(DatabaseEnvironment.TESTING)
        
        assert config["backend"] == "sqlite"
        assert config["path"] == "/test/db.sqlite"
    
    def test_get_database_config_postgresql_production(self, monkeypatch):
        """Test PostgreSQL configuration for production environment"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.setenv("PG_HOST", "prod-host")
        monkeypatch.setenv("PG_PORT", "5432")
        monkeypatch.setenv("PG_USER", "prod_user")
        monkeypatch.setenv("PG_PASS", "prod_pass")
        monkeypatch.setenv("PG_DB", "prod_db")
        
        config = get_database_config(DatabaseEnvironment.PRODUCTION)
        
        assert config["backend"] == "postgresql"
        assert config["host"] == "prod-host"
        assert config["port"] == 5432
        assert config["user"] == "prod_user"
        assert config["password"] == "prod_pass"
        assert config["database"] == "prod_db"
    
    def test_get_database_config_postgresql_development(self, monkeypatch):
        """Test PostgreSQL configuration for development environment"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.setenv("PG_HOST", "dev-host")
        monkeypatch.setenv("PG_PORT", "5432")
        monkeypatch.setenv("PG_USER", "dev_user")
        monkeypatch.setenv("PG_PASS", "dev_pass")
        monkeypatch.setenv("PG_DEV_DB", "dev_db")
        
        config = get_database_config(DatabaseEnvironment.DEVELOPMENT)
        
        assert config["database"] == "dev_db"
    
    def test_get_database_config_postgresql_testing(self, monkeypatch):
        """Test PostgreSQL configuration for testing environment"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.setenv("PG_HOST", "test-host")
        monkeypatch.setenv("PG_PORT", "5432")
        monkeypatch.setenv("PG_USER", "test_user")
        monkeypatch.setenv("PG_PASS", "test_pass")
        monkeypatch.setenv("PG_TEST_DB", "test_db")
        
        config = get_database_config(DatabaseEnvironment.TESTING)
        
        assert config["database"] == "test_db"
    
    def test_get_database_config_mysql_production(self, monkeypatch):
        """Test MySQL configuration for production environment"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.setenv("MYSQL_HOST", "mysql-prod")
        monkeypatch.setenv("MYSQL_PORT", "3306")
        monkeypatch.setenv("MYSQL_USER", "mysql_user")
        monkeypatch.setenv("MYSQL_PASS", "mysql_pass")
        monkeypatch.setenv("MYSQL_DB", "mysql_db")
        
        config = get_database_config(DatabaseEnvironment.PRODUCTION)
        
        assert config["backend"] == "mysql"
        assert config["host"] == "mysql-prod"
        assert config["port"] == 3306
        assert config["user"] == "mysql_user"
        assert config["password"] == "mysql_pass"
        assert config["database"] == "mysql_db"
    
    def test_get_database_config_mysql_development(self, monkeypatch):
        """Test MySQL configuration for development environment"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.setenv("MYSQL_HOST", "mysql-dev")
        monkeypatch.setenv("MYSQL_PORT", "3306")
        monkeypatch.setenv("MYSQL_USER", "mysql_user")
        monkeypatch.setenv("MYSQL_PASS", "mysql_pass")
        monkeypatch.setenv("MYSQL_DEV_DB", "mysql_dev_db")
        
        config = get_database_config(DatabaseEnvironment.DEVELOPMENT)
        
        assert config["database"] == "mysql_dev_db"
    
    def test_get_database_config_mysql_testing(self, monkeypatch):
        """Test MySQL configuration for testing environment"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.setenv("MYSQL_HOST", "mysql-test")
        monkeypatch.setenv("MYSQL_PORT", "3306")
        monkeypatch.setenv("MYSQL_USER", "mysql_user")
        monkeypatch.setenv("MYSQL_PASS", "mysql_pass")
        monkeypatch.setenv("MYSQL_TEST_DB", "mysql_test_db")
        
        config = get_database_config(DatabaseEnvironment.TESTING)
        
        assert config["database"] == "mysql_test_db"
    
    def test_get_database_config_invalid_backend(self, monkeypatch):
        """Test invalid database backend handling"""
        monkeypatch.setenv("DB_BACKEND", "invalid_backend")
        
        with pytest.raises(ValueError, match="Unsupported database backend"):
            get_database_config()
    
    def test_get_database_config_missing_sqlite_env_vars(self, monkeypatch):
        """Test missing SQLite environment variables"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.delenv("SQLITE_PATH", False)
        monkeypatch.delenv("DEV_SQLITE_PATH", False)
        monkeypatch.delenv("TEST_SQLITE_PATH", False)
        
        with pytest.raises(ValueError, match="Missing required environment variables"):
            get_database_config(DatabaseEnvironment.PRODUCTION)
    
    def test_get_database_config_missing_postgresql_env_vars(self, monkeypatch):
        """Test missing PostgreSQL environment variables"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.delenv("PG_HOST", False)
        
        with pytest.raises(ValueError, match="Missing required environment variables"):
            get_database_config()
    
    def test_get_database_config_missing_mysql_env_vars(self, monkeypatch):
        """Test missing MySQL environment variables"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.delenv("MYSQL_HOST", False)
        
        with pytest.raises(ValueError, match="Missing required environment variables"):
            get_database_config()


class TestElasticsearchConfiguration:
    """Test Elasticsearch configuration for different environments"""
    
    def test_get_elasticsearch_config_production(self, monkeypatch):
        """Test Elasticsearch configuration for production environment"""
        monkeypatch.setenv("ES_HOST", "es-prod")
        monkeypatch.setenv("ES_PORT", "9200")
        monkeypatch.setenv("ES_SCHEME", "https")
        monkeypatch.setenv("ES_INDEX", "prod_index")
        monkeypatch.setenv("ES_USER", "es_user")
        monkeypatch.setenv("ES_PASS", "es_pass")
        
        config = get_elasticsearch_config(DatabaseEnvironment.PRODUCTION)
        
        assert config["host"] == "es-prod"
        assert config["port"] == 9200
        assert config["scheme"] == "https"
        assert config["index"] == "prod_index"
        assert config["user"] == "es_user"
        assert config["password"] == "es_pass"
    
    def test_get_elasticsearch_config_development(self, monkeypatch):
        """Test Elasticsearch configuration for development environment"""
        monkeypatch.setenv("ES_HOST", "es-dev")
        monkeypatch.setenv("ES_PORT", "9200")
        monkeypatch.setenv("ES_SCHEME", "http")
        monkeypatch.setenv("ES_DEV_INDEX", "dev_index")
        
        config = get_elasticsearch_config(DatabaseEnvironment.DEVELOPMENT)
        
        assert config["host"] == "es-dev"
        assert config["index"] == "dev_index"
    
    def test_get_elasticsearch_config_testing(self, monkeypatch):
        """Test Elasticsearch configuration for testing environment"""
        monkeypatch.setenv("ES_HOST", "es-test")
        monkeypatch.setenv("ES_PORT", "9200")
        monkeypatch.setenv("ES_SCHEME", "http")
        monkeypatch.setenv("ES_TEST_INDEX", "test_index")
        
        config = get_elasticsearch_config(DatabaseEnvironment.TESTING)
        
        assert config["host"] == "es-test"
        assert config["index"] == "test_index"
    
    def test_get_elasticsearch_config_default_values(self, monkeypatch):
        """Test Elasticsearch configuration with default values"""
        # Clear environment variables to test defaults
        for key in ["ES_HOST", "ES_PORT", "ES_SCHEME", "ES_USER", "ES_PASS"]:
            monkeypatch.delenv(key, False)
        
        config = get_elasticsearch_config()
        
        assert config["host"] == "localhost"
        assert config["port"] == 9200
        assert config["scheme"] == "http"
        assert config["user"] is None
        assert config["password"] is None
    
    def test_get_elasticsearch_config_invalid_port(self, monkeypatch):
        """Test Elasticsearch configuration with invalid port"""
        monkeypatch.setenv("ES_PORT", "invalid_port")
        
        with pytest.raises(ValueError, match="Invalid ES_PORT"):
            get_elasticsearch_config()
    
    def test_get_elasticsearch_config_with_auth(self, monkeypatch):
        """Test Elasticsearch configuration with authentication"""
        monkeypatch.setenv("ES_HOST", "secure-es")
        monkeypatch.setenv("ES_USER", "admin")
        monkeypatch.setenv("ES_PASS", "secret123")
        
        config = get_elasticsearch_config()
        
        assert config["user"] == "admin"
        assert config["password"] == "secret123"
    
    def test_get_elasticsearch_config_without_auth(self, monkeypatch):
        """Test Elasticsearch configuration without authentication"""
        monkeypatch.setenv("ES_HOST", "open-es")
        monkeypatch.delenv("ES_USER", False)
        monkeypatch.delenv("ES_PASS", False)
        
        config = get_elasticsearch_config()
        
        assert config["user"] is None
        assert config["password"] is None


class TestConfigurationEdgeCases:
    """Test edge cases in configuration"""
    
    def test_environment_variable_case_sensitivity(self, monkeypatch):
        """Test environment variable case sensitivity"""
        monkeypatch.setenv("db_backend", "sqlite")  # lowercase
        monkeypatch.setenv("DB_BACKEND", "postgresql")  # uppercase
        
        # Should use uppercase version
        config = get_database_config()
        assert config["backend"] == "postgresql"
    
    def test_empty_environment_variables(self, monkeypatch):
        """Test handling of empty environment variables"""
        monkeypatch.setenv("DB_BACKEND", "")
        monkeypatch.setenv("ES_HOST", "")
        
        # Should use defaults where possible
        es_config = get_elasticsearch_config()
        assert es_config["host"] == "localhost"  # Should use default
        
        # Should raise error for required missing values
        with pytest.raises(ValueError):
            get_database_config()
    
    def test_whitespace_in_environment_variables(self, monkeypatch):
        """Test handling of whitespace in environment variables"""
        monkeypatch.setenv("DB_BACKEND", " sqlite ")
        monkeypatch.setenv("SQLITE_PATH", " /path/to/db.sqlite ")
        
        with patch('ivod.database_env.get_environment', return_value="production"):
            config = get_database_config()
            
            # Should strip whitespace
            assert config["backend"] == "sqlite"
            assert config["path"] == "/path/to/db.sqlite"
    
    def test_database_fallback_to_production_config(self, monkeypatch):
        """Test fallback to production config when env-specific config missing"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("SQLITE_PATH", "/prod/db.sqlite")
        # Don't set DEV_SQLITE_PATH
        
        config = get_database_config(DatabaseEnvironment.DEVELOPMENT)
        
        # Should fallback to production config
        assert config["path"] == "/prod/db.sqlite"
    
    def test_elasticsearch_fallback_to_production_config(self, monkeypatch):
        """Test Elasticsearch fallback to production config"""
        monkeypatch.setenv("ES_INDEX", "prod_index")
        # Don't set ES_DEV_INDEX
        
        config = get_elasticsearch_config(DatabaseEnvironment.DEVELOPMENT)
        
        # Should fallback to production config
        assert config["index"] == "prod_index"


if __name__ == "__main__":
    pytest.main([__file__])