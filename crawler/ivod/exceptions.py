#!/usr/bin/env python3
"""
Custom exception classes for the IVOD crawler system.
Provides specific exception types for better error handling and debugging.
"""


class IVODCrawlerError(Exception):
    """Base exception class for all IVOD crawler errors."""
    pass


class IVODDataError(IVODCrawlerError):
    """Raised when IVOD data is invalid or missing required fields."""
    
    def __init__(self, message, ivod_id=None, field=None):
        self.ivod_id = ivod_id
        self.field = field
        super().__init__(message)


class IVODNetworkError(IVODCrawlerError):
    """Raised when network operations fail."""
    
    def __init__(self, message, url=None, status_code=None):
        self.url = url
        self.status_code = status_code
        super().__init__(message)


class IVODSSLError(IVODNetworkError):
    """Raised when SSL/TLS related errors occur."""
    
    def __init__(self, message, url=None):
        super().__init__(message, url)


class IVODTimeoutError(IVODNetworkError):
    """Raised when network requests timeout."""
    
    def __init__(self, message, url=None, timeout_duration=None):
        self.timeout_duration = timeout_duration
        super().__init__(message, url)


class IVODParsingError(IVODCrawlerError):
    """Raised when parsing JSON or HTML content fails."""
    
    def __init__(self, message, content_type=None, raw_content=None):
        self.content_type = content_type
        self.raw_content = raw_content
        super().__init__(message)


class IVODTranscriptError(IVODCrawlerError):
    """Raised when transcript extraction fails."""
    
    def __init__(self, message, transcript_type=None, ivod_id=None):
        self.transcript_type = transcript_type  # 'ai' or 'ly'
        self.ivod_id = ivod_id
        super().__init__(message)


class IVODDatabaseError(IVODCrawlerError):
    """Raised when database operations fail."""
    
    def __init__(self, message, operation=None, table=None):
        self.operation = operation  # 'insert', 'update', 'delete', 'select'
        self.table = table
        super().__init__(message)


class IVODConfigurationError(IVODCrawlerError):
    """Raised when configuration is invalid or missing."""
    
    def __init__(self, message, config_key=None):
        self.config_key = config_key
        super().__init__(message)


class IVODRetryLimitError(IVODCrawlerError):
    """Raised when retry limit is exceeded."""
    
    def __init__(self, message, ivod_id=None, retry_count=None, max_retries=None):
        self.ivod_id = ivod_id
        self.retry_count = retry_count
        self.max_retries = max_retries
        super().__init__(message)


class IVODBatchProcessingError(IVODCrawlerError):
    """Raised when batch processing operations fail."""
    
    def __init__(self, message, batch_size=None, processed_count=None):
        self.batch_size = batch_size
        self.processed_count = processed_count
        super().__init__(message)


class IVODElasticsearchError(IVODCrawlerError):
    """Raised when Elasticsearch operations fail."""
    
    def __init__(self, message, index=None, operation=None):
        self.index = index
        self.operation = operation  # 'index', 'search', 'delete', 'create'
        super().__init__(message)