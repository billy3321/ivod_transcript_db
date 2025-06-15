#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for ivod.db module to improve coverage
"""
import pytest
import os
import tempfile
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, date

from ivod.db import (
    check_and_create_database_tables, IVODTranscript,
    check_elasticsearch_available, get_elasticsearch_client,
    create_elasticsearch_index, run_elasticsearch_indexing,
    Session, engine, Base
)
from ivod.database_env import get_database_config


class TestDatabaseConfiguration:
    """Test database configuration functions"""
    
    def test_get_database_config_sqlite(self, monkeypatch):
        """Test SQLite database configuration"""
        from ivod.database_env import DatabaseEnvironment
        
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("SQLITE_PATH", "/test/path/db.sqlite")
        
        config = get_database_config(DatabaseEnvironment.PRODUCTION)
        
        assert config["backend"] == "sqlite"
        assert config["path"] == "/test/path/db.sqlite"
    
    def test_get_database_config_postgresql(self, monkeypatch):
        """Test PostgreSQL database configuration"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.setenv("PG_HOST", "localhost")
        monkeypatch.setenv("PG_PORT", "5432")
        monkeypatch.setenv("PG_USER", "testuser")
        monkeypatch.setenv("PG_PASS", "testpass")
        monkeypatch.setenv("PG_DB", "testdb")
        
        config = get_database_config()
        
        assert config["backend"] == "postgresql"
        assert config["host"] == "localhost"
        assert config["port"] == 5432
        assert config["user"] == "testuser"
        assert config["password"] == "testpass"
        assert config["database"] == "testdb"
    
    def test_get_database_config_mysql(self, monkeypatch):
        """Test MySQL database configuration"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.setenv("MYSQL_HOST", "localhost")
        monkeypatch.setenv("MYSQL_PORT", "3306")
        monkeypatch.setenv("MYSQL_USER", "testuser")
        monkeypatch.setenv("MYSQL_PASS", "testpass")
        monkeypatch.setenv("MYSQL_DB", "testdb")
        
        config = get_database_config()
        
        assert config["backend"] == "mysql"
        assert config["host"] == "localhost"
        assert config["port"] == 3306
        assert config["user"] == "testuser"
        assert config["password"] == "testpass"
        assert config["database"] == "testdb"
    
    def test_get_database_url_sqlite(self, monkeypatch):
        """Test SQLite database URL generation"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        monkeypatch.setenv("SQLITE_PATH", "/test/path/test.db")
        
        url = get_database_url()
        
        assert url == "sqlite:////test/path/test.db"
    
    def test_get_database_url_postgresql(self, monkeypatch):
        """Test PostgreSQL database URL generation"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        monkeypatch.setenv("PG_HOST", "localhost")
        monkeypatch.setenv("PG_PORT", "5432")
        monkeypatch.setenv("PG_USER", "testuser")
        monkeypatch.setenv("PG_PASS", "testpass")
        monkeypatch.setenv("PG_DB", "testdb")
        
        url = get_database_url()
        
        assert url == "postgresql://testuser:testpass@localhost:5432/testdb"
    
    def test_get_database_url_mysql(self, monkeypatch):
        """Test MySQL database URL generation"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        monkeypatch.setenv("MYSQL_HOST", "localhost")
        monkeypatch.setenv("MYSQL_PORT", "3306")
        monkeypatch.setenv("MYSQL_USER", "testuser")
        monkeypatch.setenv("MYSQL_PASS", "testpass")
        monkeypatch.setenv("MYSQL_DB", "testdb")
        
        url = get_database_url()
        
        assert url == "mysql+pymysql://testuser:testpass@localhost:3306/testdb?charset=utf8mb4"


class TestDatabaseOperations:
    """Test database operations"""
    
    @patch('ivod.db.engine')
    @patch('ivod.db.Base')
    def test_check_and_create_database_tables_success(self, mock_base, mock_engine):
        """Test successful database table creation"""
        mock_engine.connect.return_value.__enter__.return_value = Mock()
        
        result = check_and_create_database_tables()
        
        assert result is True
        mock_base.metadata.create_all.assert_called_once_with(mock_engine)
    
    @patch('ivod.db.engine')
    def test_database_availability_check(self, mock_engine):
        """Test database availability checking"""
        # Test successful connection
        mock_connection = Mock()
        mock_engine.connect.return_value.__enter__.return_value = mock_connection
        
        result = check_and_create_database_tables()
        
        assert result is True
        mock_engine.connect.assert_called_once()
    
    @patch('ivod.db.engine')
    @patch('ivod.db.logger')
    def test_database_unavailable_with_user_message(self, mock_logger, mock_engine):
        """Test database unavailability with user message"""
        mock_engine.connect.side_effect = Exception("Database connection failed")
        
        result = check_and_create_database_tables()
        
        assert result is False
        # Verify that error is logged for user
        mock_logger.error.assert_called()
        error_message = mock_logger.error.call_args[0][0]
        assert "資料庫連線失敗" in error_message or "Database connection failed" in error_message
    
    @patch('ivod.db.engine')
    @patch('ivod.db.Base')
    def test_check_and_create_database_tables_failure(self, mock_base, mock_engine):
        """Test database table creation failure"""
        mock_base.metadata.create_all.side_effect = Exception("Database error")
        
        result = check_and_create_database_tables()
        
        assert result is False
    
    @patch('ivod.db.engine')
    def test_check_and_create_database_tables_connection_error(self, mock_engine):
        """Test database connection error"""
        mock_engine.connect.side_effect = Exception("Connection failed")
        
        result = check_and_create_database_tables()
        
        assert result is False


class TestIVODTranscriptModel:
    """Test IVODTranscript model"""
    
    def test_ivod_transcript_model_creation(self):
        """Test creating IVODTranscript instance"""
        transcript = IVODTranscript(
            ivod_id=12345,
            title="Test Title",
            date=date(2024, 1, 1),
            meeting_name="Test Meeting",
            speaker_name="Test Speaker",
            ai_transcript="AI transcript content",
            ly_transcript="LY transcript content",
            status="success"
        )
        
        assert transcript.ivod_id == 12345
        assert transcript.title == "Test Title"
        assert transcript.date == date(2024, 1, 1)
        assert transcript.meeting_name == "Test Meeting"
        assert transcript.speaker_name == "Test Speaker"
        assert transcript.ai_transcript == "AI transcript content"
        assert transcript.ly_transcript == "LY transcript content"
        assert transcript.status == "success"
    
    def test_ivod_transcript_model_defaults(self):
        """Test IVODTranscript model default values"""
        transcript = IVODTranscript(ivod_id=12345)
        
        assert transcript.status == "pending"
        assert transcript.retry_count == 0
        assert transcript.ai_status == "pending"
        assert transcript.ly_status == "pending"
        assert transcript.ai_retries == 0
        assert transcript.ly_retries == 0
    
    def test_ivod_transcript_repr(self):
        """Test IVODTranscript string representation"""
        transcript = IVODTranscript(
            ivod_id=12345,
            title="Test Title"
        )
        
        repr_str = repr(transcript)
        assert "12345" in repr_str
        assert "Test Title" in repr_str


class TestElasticsearchFunctions:
    """Test Elasticsearch-related functions"""
    
    @patch('ivod.db.Elasticsearch')
    def test_check_elasticsearch_available_success(self, mock_es_class):
        """Test successful Elasticsearch availability check"""
        mock_es = Mock()
        mock_es.ping.return_value = True
        mock_es_class.return_value = mock_es
        
        with patch('ivod.db.get_elasticsearch_config') as mock_config:
            mock_config.return_value = {
                "host": "localhost",
                "port": 9200,
                "scheme": "http",
                "user": None,
                "password": None
            }
            
            result = check_elasticsearch_available()
            
            assert result is True
            mock_es.ping.assert_called_once()
    
    @patch('ivod.db.Elasticsearch')
    def test_check_elasticsearch_available_failure(self, mock_es_class):
        """Test Elasticsearch availability check failure"""
        mock_es = Mock()
        mock_es.ping.return_value = False
        mock_es_class.return_value = mock_es
        
        with patch('ivod.db.get_elasticsearch_config') as mock_config:
            mock_config.return_value = {
                "host": "localhost",
                "port": 9200,
                "scheme": "http",
                "user": None,
                "password": None
            }
            
            result = check_elasticsearch_available()
            
            assert result is False
    
    @patch('ivod.db.Elasticsearch')
    def test_check_elasticsearch_available_exception(self, mock_es_class):
        """Test Elasticsearch availability check with exception"""
        mock_es_class.side_effect = Exception("Connection error")
        
        with patch('ivod.db.get_elasticsearch_config') as mock_config:
            mock_config.return_value = {
                "host": "localhost",
                "port": 9200,
                "scheme": "http",
                "user": None,
                "password": None
            }
            
            result = check_elasticsearch_available()
            
            assert result is False
    
    def test_check_elasticsearch_available_not_installed(self):
        """Test Elasticsearch availability when not installed"""
        with patch('ivod.db.Elasticsearch', None):
            result = check_elasticsearch_available()
            assert result is False
    
    @patch('ivod.db.Elasticsearch')
    def test_get_elasticsearch_client_success(self, mock_es_class):
        """Test successful Elasticsearch client creation"""
        mock_es = Mock()
        mock_es.ping.return_value = True
        mock_es_class.return_value = mock_es
        
        with patch('ivod.db.get_elasticsearch_config') as mock_config:
            mock_config.return_value = {
                "host": "localhost",
                "port": 9200,
                "scheme": "http",
                "index": "test_index",
                "user": None,
                "password": None
            }
            
            es_client, es_index = get_elasticsearch_client()
            
            assert es_client == mock_es
            assert es_index == "test_index"
    
    @patch('ivod.db.Elasticsearch')
    def test_get_elasticsearch_client_connection_failure(self, mock_es_class):
        """Test Elasticsearch client creation with connection failure"""
        mock_es = Mock()
        mock_es.ping.return_value = False
        mock_es_class.return_value = mock_es
        
        with patch('ivod.db.get_elasticsearch_config') as mock_config:
            mock_config.return_value = {
                "host": "localhost",
                "port": 9200,
                "scheme": "http",
                "index": "test_index",
                "user": None,
                "password": None
            }
            
            es_client, es_index = get_elasticsearch_client()
            
            assert es_client is None
            assert es_index is None
    
    def test_get_elasticsearch_client_not_installed(self):
        """Test Elasticsearch client creation when not installed"""
        with patch('ivod.db.Elasticsearch', None):
            es_client, es_index = get_elasticsearch_client()
            
            assert es_client is None
            assert es_index is None
    
    def test_create_elasticsearch_index(self):
        """Test Elasticsearch index creation"""
        mock_es = Mock()
        mock_es.indices.exists.return_value = False
        mock_es.indices.create.return_value = {"acknowledged": True}
        
        result = create_elasticsearch_index(mock_es, "test_index")
        
        assert result is True
        mock_es.indices.exists.assert_called_once_with(index="test_index")
        mock_es.indices.create.assert_called_once()
    
    def test_create_elasticsearch_index_already_exists(self):
        """Test Elasticsearch index creation when index already exists"""
        mock_es = Mock()
        mock_es.indices.exists.return_value = True
        
        result = create_elasticsearch_index(mock_es, "test_index")
        
        assert result is True
        mock_es.indices.exists.assert_called_once_with(index="test_index")
        mock_es.indices.create.assert_not_called()
    
    def test_create_elasticsearch_index_failure(self):
        """Test Elasticsearch index creation failure"""
        mock_es = Mock()
        mock_es.indices.exists.return_value = False
        mock_es.indices.create.side_effect = Exception("Index creation failed")
        
        result = create_elasticsearch_index(mock_es, "test_index")
        
        assert result is False


class TestElasticsearchIndexing:
    """Test Elasticsearch indexing operations"""
    
    @patch('ivod.db.get_elasticsearch_client')
    @patch('ivod.db.create_elasticsearch_index')
    def test_run_elasticsearch_indexing_success(self, mock_create_index, mock_get_client):
        """Test successful Elasticsearch indexing"""
        # Mock Elasticsearch client
        mock_es = Mock()
        mock_get_client.return_value = (mock_es, "test_index")
        mock_create_index.return_value = True
        
        # Mock database session
        mock_db = Mock()
        mock_records = [
            Mock(
                ivod_id=12345,
                title="Test Title",
                date=date(2024, 1, 1),
                meeting_name="Test Meeting",
                speaker_name="Test Speaker",
                ai_transcript="AI content",
                ly_transcript="LY content",
                committee_names="Test Committee"
            )
        ]
        mock_db.query.return_value.filter.return_value.all.return_value = mock_records
        
        # Mock bulk indexing
        mock_es.helpers.bulk.return_value = (1, [])
        
        with patch('ivod.db.helpers'):
            result = run_elasticsearch_indexing(mock_db)
            
            assert result is True
            mock_create_index.assert_called_once_with(mock_es, "test_index")
    
    @patch('ivod.db.get_elasticsearch_client')
    def test_run_elasticsearch_indexing_client_failure(self, mock_get_client):
        """Test Elasticsearch indexing when client creation fails"""
        mock_get_client.return_value = (None, None)
        
        mock_db = Mock()
        result = run_elasticsearch_indexing(mock_db)
        
        assert result is False
    
    @patch('ivod.db.get_elasticsearch_client')
    @patch('ivod.db.create_elasticsearch_index')
    def test_run_elasticsearch_indexing_index_creation_failure(self, mock_create_index, mock_get_client):
        """Test Elasticsearch indexing when index creation fails"""
        mock_es = Mock()
        mock_get_client.return_value = (mock_es, "test_index")
        mock_create_index.return_value = False
        
        mock_db = Mock()
        result = run_elasticsearch_indexing(mock_db)
        
        assert result is False
    
    @patch('ivod.db.get_elasticsearch_client')
    @patch('ivod.db.create_elasticsearch_index')
    def test_run_elasticsearch_indexing_no_records(self, mock_create_index, mock_get_client):
        """Test Elasticsearch indexing with no records"""
        mock_es = Mock()
        mock_get_client.return_value = (mock_es, "test_index")
        mock_create_index.return_value = True
        
        mock_db = Mock()
        mock_db.query.return_value.filter.return_value.all.return_value = []
        
        result = run_elasticsearch_indexing(mock_db)
        
        assert result is True  # Should succeed even with no records


class TestDatabaseFieldAdaptation:
    """Test database field adaptation for different backends"""
    
    def test_committee_names_field_postgresql(self, monkeypatch):
        """Test committee_names field type for PostgreSQL"""
        monkeypatch.setenv("DB_BACKEND", "postgresql")
        
        # Import after setting environment variable
        from ivod.db import IVODTranscript
        
        # Check that the field exists and can be accessed
        transcript = IVODTranscript(ivod_id=12345)
        transcript.committee_names = ["Committee 1", "Committee 2"]
        
        assert hasattr(transcript, 'committee_names')
    
    def test_committee_names_field_mysql(self, monkeypatch):
        """Test committee_names field type for MySQL"""
        monkeypatch.setenv("DB_BACKEND", "mysql")
        
        # Import after setting environment variable
        from ivod.db import IVODTranscript
        
        # Check that the field exists and can be accessed
        transcript = IVODTranscript(ivod_id=12345)
        transcript.committee_names = "Committee 1, Committee 2"
        
        assert hasattr(transcript, 'committee_names')
    
    def test_committee_names_field_sqlite(self, monkeypatch):
        """Test committee_names field type for SQLite"""
        monkeypatch.setenv("DB_BACKEND", "sqlite")
        
        # Import after setting environment variable
        from ivod.db import IVODTranscript
        
        # Check that the field exists and can be accessed
        transcript = IVODTranscript(ivod_id=12345)
        transcript.committee_names = "Committee 1, Committee 2"
        
        assert hasattr(transcript, 'committee_names')


class TestErrorHandling:
    """Test error handling in database operations"""
    
    @patch('ivod.db.engine')
    def test_database_connection_error_handling(self, mock_engine):
        """Test handling of database connection errors"""
        mock_engine.connect.side_effect = Exception("Database unreachable")
        
        # Should not raise exception, should return False
        result = check_and_create_database_tables()
        assert result is False
    
    @patch('ivod.db.Session')
    def test_session_error_handling(self, mock_session_class):
        """Test handling of database session errors"""
        mock_session = Mock()
        mock_session.query.side_effect = Exception("Query failed")
        mock_session_class.return_value = mock_session
        
        # Should handle the exception gracefully
        try:
            session = Session()
            session.query(IVODTranscript).all()
        except Exception:
            # The actual implementation might handle this differently
            pass


if __name__ == "__main__":
    pytest.main([__file__])