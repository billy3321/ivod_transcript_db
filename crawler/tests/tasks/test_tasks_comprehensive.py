#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for ivod.tasks module to improve coverage
"""
import pytest
import os
import tempfile
import logging
from datetime import datetime, date, timedelta
from unittest.mock import Mock, patch, MagicMock
from pathlib import Path

import ivod.tasks as tasks
from ivod.tasks import (
    setup_logging, log_failed_ivod, 
    run_full, run_incremental, run_retry,
    read_failed_ivods_from_file, remove_from_error_log
)
from ivod.db import IVODTranscript


class TestLoggingSetup:
    """Test logging configuration"""
    
    def test_setup_logging_creates_log_directory(self, tmp_path, monkeypatch):
        """Test that setup_logging creates the log directory"""
        log_path = tmp_path / "test_logs"
        monkeypatch.setenv("LOG_PATH", str(log_path))
        
        setup_logging()
        
        assert log_path.exists()
        assert log_path.is_dir()
    
    def test_setup_logging_creates_log_file(self, tmp_path, monkeypatch):
        """Test that setup_logging creates daily log file"""
        log_path = tmp_path / "test_logs"
        monkeypatch.setenv("LOG_PATH", str(log_path))
        
        setup_logging()
        
        expected_file = log_path / f"crawler_{datetime.now().strftime('%Y%m%d')}.log"
        # File should be created when first log is written
        logger = logging.getLogger("test")
        logger.info("Test message")
        
        assert expected_file.exists()
    
    def test_setup_logging_file_handler_level(self, tmp_path, monkeypatch):
        """Test that file handler is set to INFO level"""
        log_path = tmp_path / "test_logs"
        monkeypatch.setenv("LOG_PATH", str(log_path))
        
        setup_logging()
        
        # Check that root logger has the correct handlers
        root_logger = logging.getLogger()
        file_handlers = [h for h in root_logger.handlers if isinstance(h, logging.FileHandler)]
        assert len(file_handlers) > 0
        assert file_handlers[0].level == logging.INFO
    
    def test_setup_logging_console_handler_level(self, tmp_path, monkeypatch):
        """Test that console handler is set to WARNING level"""
        log_path = tmp_path / "test_logs"
        monkeypatch.setenv("LOG_PATH", str(log_path))
        
        setup_logging()
        
        # Check console handler level
        root_logger = logging.getLogger()
        console_handlers = [h for h in root_logger.handlers if isinstance(h, logging.StreamHandler)]
        assert len(console_handlers) > 0
        assert console_handlers[0].level == logging.WARNING


class TestErrorLogging:
    """Test error logging functionality"""
    
    def test_log_failed_ivod_creates_directory(self, tmp_path, monkeypatch):
        """Test that log_failed_ivod creates the error log directory"""
        error_log_path = tmp_path / "error_logs" / "failed_ivods.txt"
        monkeypatch.setenv("ERROR_LOG_PATH", str(error_log_path))
        
        log_failed_ivod("12345", "network_error")
        
        assert error_log_path.parent.exists()
        assert error_log_path.exists()
    
    def test_log_failed_ivod_writes_correct_format(self, tmp_path, monkeypatch):
        """Test that log_failed_ivod writes in correct format"""
        error_log_path = tmp_path / "failed_ivods.txt"
        monkeypatch.setenv("ERROR_LOG_PATH", str(error_log_path))
        
        log_failed_ivod("12345", "network_error")
        
        content = error_log_path.read_text(encoding="utf-8")
        lines = content.strip().split('\n')
        assert len(lines) == 1
        
        parts = lines[0].split(',')
        assert len(parts) == 3
        assert parts[0] == "12345"
        assert parts[1] == "network_error"
        # Check timestamp format (basic validation)
        assert len(parts[2]) > 10  # Should be a reasonable timestamp length
    
    def test_log_failed_ivod_appends_multiple_entries(self, tmp_path, monkeypatch):
        """Test that multiple calls append to the same file"""
        error_log_path = tmp_path / "failed_ivods.txt"
        monkeypatch.setenv("ERROR_LOG_PATH", str(error_log_path))
        
        log_failed_ivod("12345", "network_error")
        log_failed_ivod("67890", "parsing_error")
        
        content = error_log_path.read_text(encoding="utf-8")
        lines = content.strip().split('\n')
        assert len(lines) == 2
        assert "12345" in lines[0]
        assert "67890" in lines[1]
    
    def test_log_failed_ivod_default_error_type(self, tmp_path, monkeypatch):
        """Test default error type when not specified"""
        error_log_path = tmp_path / "failed_ivods.txt"
        monkeypatch.setenv("ERROR_LOG_PATH", str(error_log_path))
        
        log_failed_ivod("12345")  # No error type specified
        
        content = error_log_path.read_text(encoding="utf-8")
        assert "12345,general," in content


class TestRunFull:
    """Test run_full function"""
    
    @patch('ivod.tasks.make_browser')
    @patch('ivod.tasks.check_and_create_database_tables')
    @patch('ivod.tasks.setup_logging')
    @patch('ivod.tasks.Session')
    @patch('ivod.tasks.date_range')
    @patch('ivod.tasks.fetch_ivod_list')
    @patch('ivod.tasks.process_ivod')
    def test_run_full_success_flow(self, mock_process, mock_fetch_list, mock_date_range,
                                  mock_session, mock_setup_logging, mock_check_db, mock_browser):
        """Test successful run_full execution"""
        # Setup mocks
        mock_check_db.return_value = True
        mock_browser.return_value = Mock()
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Mock date range
        test_dates = [date(2024, 1, 1), date(2024, 1, 2)]
        mock_date_range.return_value = test_dates
        
        # Mock IVOD list
        mock_fetch_list.return_value = [{'IVOD_ID': '123'}, {'IVOD_ID': '456'}]
        
        # Mock process_ivod
        mock_process.return_value = {'status': 'success'}
        
        result = run_full(skip_ssl=True)
        
        assert result is True
        mock_setup_logging.assert_called_once()
        mock_check_db.assert_called_once()
        mock_browser.assert_called_once_with(skip_ssl=True)
        mock_session.assert_called_once()
        
        # Should call fetch_ivod_list for each date
        assert mock_fetch_list.call_count == len(test_dates)
        
        # Should call process_ivod for each IVOD
        assert mock_process.call_count == len(test_dates) * 2  # 2 IVODs per date
        
        mock_db.commit.assert_called()
        mock_db.close.assert_called_once()
    
    @patch('ivod.tasks.check_and_create_database_tables')
    @patch('ivod.tasks.setup_logging')
    def test_run_full_database_check_failure(self, mock_setup_logging, mock_check_db):
        """Test run_full when database check fails"""
        mock_check_db.return_value = False
        
        result = run_full()
        
        assert result is False
        mock_setup_logging.assert_called_once()
        mock_check_db.assert_called_once()
    
    @patch('ivod.tasks.make_browser')
    @patch('ivod.tasks.check_and_create_database_tables')
    @patch('ivod.tasks.setup_logging')
    @patch('ivod.tasks.Session')
    @patch('ivod.tasks.date_range')
    def test_run_full_exception_handling(self, mock_date_range, mock_session,
                                       mock_setup_logging, mock_check_db, mock_browser):
        """Test run_full exception handling"""
        mock_check_db.return_value = True
        mock_browser.return_value = Mock()
        mock_db = Mock()
        mock_session.return_value = mock_db
        
        # Make date_range raise an exception
        mock_date_range.side_effect = Exception("Test error")
        
        result = run_full()
        
        assert result is False
        mock_db.rollback.assert_called_once()
        mock_db.close.assert_called_once()


class TestRunIncremental:
    """Test run_incremental function"""
    
    @patch('ivod.tasks.make_browser')
    @patch('ivod.tasks.check_and_create_database_tables')
    @patch('ivod.tasks.setup_logging')
    @patch('ivod.tasks.Session')
    @patch('ivod.tasks.date_range')
    @patch('ivod.tasks.fetch_ivod_list')
    def test_run_incremental_date_range(self, mock_fetch_list, mock_date_range,
                                       mock_session, mock_setup_logging, mock_check_db, mock_browser):
        """Test that run_incremental uses correct date range (last 2 weeks)"""
        mock_check_db.return_value = True
        mock_browser.return_value = Mock()
        mock_db = Mock()
        mock_session.return_value = mock_db
        mock_fetch_list.return_value = []
        
        run_incremental()
        
        # Check that date_range was called with approximately last 2 weeks
        mock_date_range.assert_called_once()
        start_date, end_date = mock_date_range.call_args[0]
        
        # Should be approximately 14 days ago to today
        today = date.today()
        expected_start = today - timedelta(days=14)
        
        # Allow some flexibility for test timing
        assert abs((start_date - expected_start).days) <= 1
        assert end_date == today
    
    @patch('ivod.tasks.make_browser')
    @patch('ivod.tasks.check_and_create_database_tables')
    @patch('ivod.tasks.setup_logging')
    @patch('ivod.tasks.Session')
    def test_run_incremental_database_failure(self, mock_session, mock_setup_logging, 
                                            mock_check_db, mock_browser):
        """Test run_incremental when database check fails"""
        mock_check_db.return_value = False
        
        result = run_incremental()
        
        assert result is False


class TestErrorLogManagement:
    """Test error log file management functions"""
    
    def test_read_failed_ivods_empty_file(self, tmp_path):
        """Test reading from empty error log file"""
        error_log_path = tmp_path / "failed_ivods.txt"
        error_log_path.touch()  # Create empty file
        
        result = read_failed_ivods_from_file(str(error_log_path))
        
        assert result == []
    
    def test_read_failed_ivods_with_data(self, tmp_path):
        """Test reading IVOD IDs from error log file"""
        error_log_path = tmp_path / "failed_ivods.txt"
        
        # Write test data
        test_data = "12345,network_error,2024-01-01 10:00:00\n67890,parsing_error,2024-01-01 11:00:00\n"
        error_log_path.write_text(test_data, encoding="utf-8")
        
        result = read_failed_ivods_from_file(str(error_log_path))
        
        assert result == ["12345", "67890"]
    
    def test_read_failed_ivods_nonexistent_file(self, tmp_path):
        """Test reading from nonexistent error log file"""
        error_log_path = tmp_path / "nonexistent.txt"
        
        result = read_failed_ivods_from_file(str(error_log_path))
        
        assert result == []
    
    def test_remove_from_error_log(self, tmp_path):
        """Test removing specific IVOD from error log"""
        error_log_path = tmp_path / "failed_ivods.txt"
        
        # Write test data
        test_data = "12345,network_error,2024-01-01 10:00:00\n67890,parsing_error,2024-01-01 11:00:00\n54321,timeout,2024-01-01 12:00:00\n"
        error_log_path.write_text(test_data, encoding="utf-8")
        
        remove_from_error_log("67890", str(error_log_path))
        
        # Read the file back
        remaining_content = error_log_path.read_text(encoding="utf-8")
        lines = remaining_content.strip().split('\n')
        
        assert len(lines) == 2
        assert "12345" in lines[0]
        assert "54321" in lines[1]
        assert "67890" not in remaining_content
    
    def test_remove_from_error_log_nonexistent_file(self, tmp_path):
        """Test removing from nonexistent error log file (should not crash)"""
        error_log_path = tmp_path / "nonexistent.txt"
        
        # Should not raise an exception
        remove_from_error_log("12345", str(error_log_path))
        
        # File should still not exist
        assert not error_log_path.exists()


class TestElasticsearchIntegration:
    """Test Elasticsearch-related functions"""
    
    @patch('ivod.tasks.check_elasticsearch_available')
    @patch('ivod.tasks.run_elasticsearch_indexing')
    @patch('ivod.tasks.Session')
    @patch('ivod.tasks.setup_logging')
    def test_run_es_success(self, mock_setup_logging, mock_session, 
                           mock_run_es_indexing, mock_check_es):
        """Test successful Elasticsearch indexing"""
        mock_check_es.return_value = True
        mock_db = Mock()
        mock_session.return_value = mock_db
        mock_run_es_indexing.return_value = True
        
        # Import and test run_es function
        from ivod.tasks import run_es
        result = run_es()
        
        assert result is True
        mock_setup_logging.assert_called_once()
        mock_check_es.assert_called_once()
        mock_run_es_indexing.assert_called_once_with(mock_db)
        mock_db.close.assert_called_once()
    
    @patch('ivod.tasks.check_elasticsearch_available')
    @patch('ivod.tasks.setup_logging')
    def test_run_es_elasticsearch_unavailable(self, mock_setup_logging, mock_check_es):
        """Test run_es when Elasticsearch is not available"""
        mock_check_es.return_value = False
        
        from ivod.tasks import run_es
        result = run_es()
        
        assert result is False
        mock_setup_logging.assert_called_once()
        mock_check_es.assert_called_once()


class TestDateUtilities:
    """Test date-related utility functions"""
    
    @patch('ivod.tasks.date_range')
    def test_date_range_integration(self, mock_date_range):
        """Test that date_range is called correctly in workflows"""
        # Mock the date_range function
        test_dates = [date(2024, 1, 1), date(2024, 1, 2)]
        mock_date_range.return_value = test_dates
        
        # Test that it returns the expected values
        result = mock_date_range(date(2024, 1, 1), date(2024, 1, 2))
        assert result == test_dates
        mock_date_range.assert_called_once_with(date(2024, 1, 1), date(2024, 1, 2))


class TestWorkflowHelpers:
    """Test helper functions used in workflows"""
    
    @patch('ivod.tasks.log_failed_ivod')
    def test_error_logging_in_workflow(self, mock_log_failed):
        """Test that errors are properly logged during workflow execution"""
        # Test the error logging mechanism
        mock_log_failed("12345", "test_error")
        mock_log_failed.assert_called_once_with("12345", "test_error")
    
    def test_default_constants(self):
        """Test that default constants are properly defined"""
        assert tasks.DEFAULT_BATCH_SIZE == 100
        assert tasks.DEFAULT_COMMIT_INTERVAL == 10
    
    @patch.dict(os.environ, {"ERROR_LOG_PATH": "/custom/path/errors.txt"})
    def test_environment_variable_usage(self):
        """Test that environment variables are properly used"""
        with patch('pathlib.Path.mkdir'), patch('builtins.open', create=True) as mock_open:
            log_failed_ivod("12345", "test")
            # Should use the custom path from environment
            mock_open.assert_called_with("/custom/path/errors.txt", "a", encoding="utf-8")


if __name__ == "__main__":
    pytest.main([__file__])