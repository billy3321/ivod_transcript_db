#!/usr/bin/env python3
"""
Tests for the exceptions module.
"""

import pytest
from ivod.exceptions import (
    IVODCrawlerError,
    IVODDataError,
    IVODNetworkError,
    IVODSSLError,
    IVODTimeoutError,
    IVODParsingError,
    IVODTranscriptError,
    IVODDatabaseError,
    IVODConfigurationError,
    IVODRetryLimitError,
    IVODBatchProcessingError,
    IVODElasticsearchError,
)


def test_base_exception():
    """Test base exception class."""
    error = IVODCrawlerError("Test error")
    assert str(error) == "Test error"
    assert isinstance(error, Exception)


def test_data_error():
    """Test data error with additional attributes."""
    error = IVODDataError("Missing field", ivod_id=12345, field="date")
    assert error.ivod_id == 12345
    assert error.field == "date"
    assert str(error) == "Missing field"


def test_network_error():
    """Test network error with URL and status code."""
    error = IVODNetworkError("Connection failed", url="https://example.com", status_code=500)
    assert error.url == "https://example.com"
    assert error.status_code == 500


def test_ssl_error():
    """Test SSL error inheritance."""
    error = IVODSSLError("SSL handshake failed", url="https://example.com")
    assert error.url == "https://example.com"
    assert isinstance(error, IVODNetworkError)


def test_timeout_error():
    """Test timeout error with duration."""
    error = IVODTimeoutError("Request timed out", url="https://example.com", timeout_duration=30)
    assert error.timeout_duration == 30
    assert isinstance(error, IVODNetworkError)


def test_parsing_error():
    """Test parsing error with content type."""
    error = IVODParsingError("Invalid JSON", content_type="json", raw_content='{"invalid": json}')
    assert error.content_type == "json"
    assert error.raw_content == '{"invalid": json}'


def test_transcript_error():
    """Test transcript error with type and ID."""
    error = IVODTranscriptError("AI transcript missing", transcript_type="ai", ivod_id=12345)
    assert error.transcript_type == "ai"
    assert error.ivod_id == 12345


def test_database_error():
    """Test database error with operation and table."""
    error = IVODDatabaseError("Insert failed", operation="insert", table="ivod_transcript")
    assert error.operation == "insert"
    assert error.table == "ivod_transcript"


def test_configuration_error():
    """Test configuration error with config key."""
    error = IVODConfigurationError("Invalid setting", config_key="DB_BACKEND")
    assert error.config_key == "DB_BACKEND"


def test_retry_limit_error():
    """Test retry limit error with counts."""
    error = IVODRetryLimitError("Max retries exceeded", ivod_id=12345, retry_count=5, max_retries=5)
    assert error.ivod_id == 12345
    assert error.retry_count == 5
    assert error.max_retries == 5


def test_batch_processing_error():
    """Test batch processing error with counts."""
    error = IVODBatchProcessingError("Batch failed", batch_size=100, processed_count=50)
    assert error.batch_size == 100
    assert error.processed_count == 50


def test_elasticsearch_error():
    """Test Elasticsearch error with index and operation."""
    error = IVODElasticsearchError("Index failed", index="ivod_transcripts", operation="index")
    assert error.index == "ivod_transcripts"
    assert error.operation == "index"


def test_exception_hierarchy():
    """Test that all exceptions inherit from base class."""
    exceptions = [
        IVODDataError("test"),
        IVODNetworkError("test"),
        IVODSSLError("test"),
        IVODTimeoutError("test"),
        IVODParsingError("test"),
        IVODTranscriptError("test"),
        IVODDatabaseError("test"),
        IVODConfigurationError("test"),
        IVODRetryLimitError("test"),
        IVODBatchProcessingError("test"),
        IVODElasticsearchError("test"),
    ]
    
    for exc in exceptions:
        assert isinstance(exc, IVODCrawlerError)
        assert isinstance(exc, Exception)