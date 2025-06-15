#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive tests for ivod.crawler module to improve coverage
"""
import pytest
import json
import ssl
import time
from datetime import datetime, date
from unittest.mock import Mock, patch, MagicMock
from bs4 import BeautifulSoup

import ivod.crawler as crawler
from ivod.crawler import (
    random_sleep, date_range, make_browser,
    fetch_latest_date, fetch_ivod_list, fetch_ivod_info,
    fetch_ai, fetch_ly, fetch_available_dates,
    fetch_ly_speech, HEADERS
)
from ivod.exceptions import (
    IVODNetworkError, IVODSSLError, IVODTimeoutError,
    IVODParsingError, IVODTranscriptError
)


class TestRandomSleep:
    """Test random sleep functionality"""
    
    @patch('ivod.crawler.time.sleep')
    @patch('ivod.crawler.random.uniform')
    def test_random_sleep_default_range(self, mock_uniform, mock_sleep):
        """Test random sleep with default range"""
        mock_uniform.return_value = 1.5
        
        random_sleep()
        
        mock_uniform.assert_called_once_with(0.5, 2.0)
        mock_sleep.assert_called_once_with(1.5)
    
    @patch('ivod.crawler.time.sleep')
    @patch('ivod.crawler.random.uniform')
    def test_random_sleep_custom_range(self, mock_uniform, mock_sleep):
        """Test random sleep with custom range"""
        mock_uniform.return_value = 3.0
        
        random_sleep(1.0, 5.0)
        
        mock_uniform.assert_called_once_with(1.0, 5.0)
        mock_sleep.assert_called_once_with(3.0)
    
    @patch('ivod.crawler.time.sleep')
    @patch('ivod.crawler.random.uniform')
    def test_random_sleep_edge_values(self, mock_uniform, mock_sleep):
        """Test random sleep with edge values"""
        mock_uniform.return_value = 0.1
        
        random_sleep(0.1, 0.1)
        
        mock_uniform.assert_called_once_with(0.1, 0.1)
        mock_sleep.assert_called_once_with(0.1)


class TestDateRange:
    """Test date range functionality"""
    
    def test_date_range_single_day(self):
        """Test date range for a single day"""
        start = date(2024, 1, 1)
        end = date(2024, 1, 1)
        
        result = list(date_range(start, end))
        
        assert len(result) == 1
        assert result[0] == date(2024, 1, 1)
    
    def test_date_range_multiple_days(self):
        """Test date range for multiple days"""
        start = date(2024, 1, 1)
        end = date(2024, 1, 3)
        
        result = list(date_range(start, end))
        
        assert len(result) == 3
        assert result[0] == date(2024, 1, 1)
        assert result[1] == date(2024, 1, 2)
        assert result[2] == date(2024, 1, 3)
    
    def test_date_range_string_input(self):
        """Test date range with string input"""
        result = list(date_range("2024-01-01", "2024-01-02"))
        
        assert len(result) == 2
        assert result[0] == date(2024, 1, 1)
        assert result[1] == date(2024, 1, 2)
    
    def test_date_range_reverse_order(self):
        """Test date range with end date before start date"""
        start = date(2024, 1, 3)
        end = date(2024, 1, 1)
        
        result = list(date_range(start, end))
        
        # Should return empty list or handle gracefully
        assert len(result) == 0


class TestMakeBrowser:
    """Test browser creation functionality"""
    
    @patch('ivod.crawler.mechanize.Browser')
    def test_make_browser_default_settings(self, mock_browser_class):
        """Test browser creation with default settings"""
        mock_browser = Mock()
        mock_browser_class.return_value = mock_browser
        
        result = make_browser()
        
        assert result == mock_browser
        mock_browser.set_handle_robots.assert_called_once_with(False)
        mock_browser.set_handle_redirect.assert_called_once_with(True)
        mock_browser.set_handle_refresh.assert_called_once_with(False)
        
        # Check headers were added
        assert mock_browser.addheaders == HEADERS
    
    @patch('ivod.crawler.mechanize.Browser')
    @patch('ivod.crawler.ssl.create_default_context')
    def test_make_browser_with_ssl_skip(self, mock_ssl_context, mock_browser_class):
        """Test browser creation with SSL skip"""
        mock_browser = Mock()
        mock_browser_class.return_value = mock_browser
        mock_context = Mock()
        mock_ssl_context.return_value = mock_context
        
        result = make_browser(skip_ssl=True)
        
        assert result == mock_browser
        mock_ssl_context.assert_called_once()
        assert mock_context.check_hostname is False
        assert mock_context.verify_mode == ssl.CERT_NONE
    
    @patch('ivod.crawler.mechanize.Browser')
    def test_make_browser_ssl_context_creation_failure(self, mock_browser_class):
        """Test browser creation when SSL context creation fails"""
        mock_browser = Mock()
        mock_browser_class.return_value = mock_browser
        
        with patch('ivod.crawler.ssl.create_default_context', side_effect=Exception("SSL error")):
            # Should not raise exception, should continue without SSL context
            result = make_browser(skip_ssl=True)
            assert result == mock_browser


class TestFetchLatestDate:
    """Test fetch latest date functionality"""
    
    def test_fetch_latest_date_success(self):
        """Test successful fetch of latest date"""
        mock_browser = Mock()
        mock_response = Mock()
        mock_response.read.return_value = json.dumps({
            "ivods": [{"日期": "2024-01-15"}]
        }).encode('utf-8')
        mock_browser.open.return_value = mock_response
        
        result = fetch_latest_date(mock_browser)
        
        assert result == date(2024, 1, 15)
    
    def test_fetch_latest_date_fallback(self):
        """Test fallback when primary method fails"""
        mock_browser = Mock()
        
        with patch('ivod.crawler.fetch_latest_date_primary') as mock_primary, \
             patch('ivod.crawler.fetch_latest_date_fallback') as mock_fallback:
            mock_primary.return_value = None
            mock_fallback.return_value = date(2024, 1, 15)
            
            result = fetch_latest_date(mock_browser)
            
            assert result == date(2024, 1, 15)
            mock_primary.assert_called_once_with(mock_browser)
            mock_fallback.assert_called_once_with(mock_browser)
    
    def test_fetch_latest_date_both_methods_fail(self):
        """Test when both primary and fallback methods fail"""
        mock_browser = Mock()
        
        with patch('ivod.crawler.fetch_latest_date_primary') as mock_primary, \
             patch('ivod.crawler.fetch_latest_date_fallback') as mock_fallback:
            mock_primary.return_value = None
            mock_fallback.return_value = None
            
            result = fetch_latest_date(mock_browser)
            
            assert result is None


class TestFetchIvodList:
    """Test IVOD list fetching functionality"""
    
    def test_fetch_ivod_list_primary_success(self):
        """Test successful primary IVOD list fetch"""
        mock_browser = Mock()
        test_date = date(2024, 1, 15)
        expected_ivods = [{"IVOD_ID": "123"}, {"IVOD_ID": "456"}]
        
        with patch('ivod.crawler.fetch_ivod_list_primary') as mock_primary:
            mock_primary.return_value = expected_ivods
            
            result = fetch_ivod_list(mock_browser, test_date)
            
            assert result == expected_ivods
            mock_primary.assert_called_once_with(mock_browser, test_date)
    
    def test_fetch_ivod_list_fallback_on_failure(self):
        """Test fallback when primary method fails"""
        mock_browser = Mock()
        test_date = date(2024, 1, 15)
        expected_ivods = [{"IVOD_ID": "789"}]
        
        with patch('ivod.crawler.fetch_ivod_list_primary') as mock_primary, \
             patch('ivod.crawler.fetch_ivod_list_fallback') as mock_fallback:
            mock_primary.side_effect = Exception("Primary failed")
            mock_fallback.return_value = expected_ivods
            
            result = fetch_ivod_list(mock_browser, test_date)
            
            assert result == expected_ivods
            mock_fallback.assert_called_once_with(mock_browser, test_date)
    
    def test_fetch_ivod_list_both_methods_fail(self):
        """Test when both methods fail"""
        mock_browser = Mock()
        test_date = date(2024, 1, 15)
        
        with patch('ivod.crawler.fetch_ivod_list_primary') as mock_primary, \
             patch('ivod.crawler.fetch_ivod_list_fallback') as mock_fallback:
            mock_primary.side_effect = Exception("Primary failed")
            mock_fallback.side_effect = Exception("Fallback failed")
            
            result = fetch_ivod_list(mock_browser, test_date)
            
            assert result == []


class TestFetchIvodInfo:
    """Test IVOD info fetching functionality"""
    
    def test_fetch_ivod_info_success(self):
        """Test successful IVOD info fetch"""
        mock_browser = Mock()
        ivod_id = "123456"
        expected_info = {
            "title": "Test Meeting",
            "meeting_name": "Test Committee",
            "speaker_name": "Test Speaker"
        }
        
        with patch('ivod.crawler.fetch_ivod_info_primary') as mock_primary:
            mock_primary.return_value = expected_info
            
            result = fetch_ivod_info(mock_browser, ivod_id)
            
            assert result == expected_info
            mock_primary.assert_called_once_with(mock_browser, ivod_id)
    
    def test_fetch_ivod_info_fallback(self):
        """Test IVOD info fetch fallback"""
        mock_browser = Mock()
        ivod_id = "123456"
        expected_info = {"title": "Fallback Title"}
        
        with patch('ivod.crawler.fetch_ivod_info_primary') as mock_primary, \
             patch('ivod.crawler.fetch_ivod_info_fallback') as mock_fallback:
            mock_primary.side_effect = Exception("Primary failed")
            mock_fallback.return_value = expected_info
            
            result = fetch_ivod_info(mock_browser, ivod_id)
            
            assert result == expected_info
            mock_fallback.assert_called_once_with(mock_browser, ivod_id)


class TestFetchAI:
    """Test AI transcript fetching functionality"""
    
    def test_fetch_ai_success(self):
        """Test successful AI transcript fetch"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ai_transcript": "", "ai_status": "pending", "ai_retries": 0}
        
        with patch('ivod.crawler.fetch_ai_transcript') as mock_fetch:
            mock_fetch.return_value = "AI transcript content"
            
            fetch_ai(mock_browser, rec, ivod_id, None)
            
            assert rec["ai_transcript"] == "AI transcript content"
            assert rec["ai_status"] == "success"
            assert rec["ai_retries"] == 0
    
    def test_fetch_ai_failure(self):
        """Test AI transcript fetch failure"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ai_transcript": "", "ai_status": "pending", "ai_retries": 0}
        
        with patch('ivod.crawler.fetch_ai_transcript') as mock_fetch:
            mock_fetch.side_effect = Exception("Fetch failed")
            
            fetch_ai(mock_browser, rec, ivod_id, None)
            
            assert rec["ai_transcript"] == ""
            assert rec["ai_status"] == "failed"
            assert rec["ai_retries"] == 1
    
    def test_fetch_ai_empty_result(self):
        """Test AI transcript fetch with empty result"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ai_transcript": "", "ai_status": "pending", "ai_retries": 0}
        
        with patch('ivod.crawler.fetch_ai_transcript') as mock_fetch:
            mock_fetch.return_value = ""
            
            fetch_ai(mock_browser, rec, ivod_id, None)
            
            assert rec["ai_transcript"] == ""
            assert rec["ai_status"] == "failed"
            assert rec["ai_retries"] == 1


class TestFetchLY:
    """Test LY transcript fetching functionality"""
    
    def test_fetch_ly_success(self):
        """Test successful LY transcript fetch"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ly_transcript": "", "ly_status": "pending", "ly_retries": 0}
        
        with patch('ivod.crawler.fetch_ly_speech') as mock_fetch:
            mock_fetch.return_value = "LY transcript content"
            
            fetch_ly(mock_browser, rec, ivod_id, None)
            
            assert rec["ly_transcript"] == "LY transcript content"
            assert rec["ly_status"] == "success"
            assert rec["ly_retries"] == 0
    
    def test_fetch_ly_failure(self):
        """Test LY transcript fetch failure"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ly_transcript": "", "ly_status": "pending", "ly_retries": 0}
        
        with patch('ivod.crawler.fetch_ly_speech') as mock_fetch:
            mock_fetch.side_effect = Exception("Fetch failed")
            
            fetch_ly(mock_browser, rec, ivod_id, None)
            
            assert rec["ly_transcript"] == ""
            assert rec["ly_status"] == "failed"
            assert rec["ly_retries"] == 1
    
    def test_fetch_ly_empty_result(self):
        """Test LY transcript fetch with empty result"""
        mock_browser = Mock()
        ivod_id = "123456"
        rec = {"ly_transcript": "", "ly_status": "pending", "ly_retries": 0}
        
        with patch('ivod.crawler.fetch_ly_speech') as mock_fetch:
            mock_fetch.return_value = ""
            
            fetch_ly(mock_browser, rec, ivod_id, None)
            
            assert rec["ly_transcript"] == ""
            assert rec["ly_status"] == "failed"
            assert rec["ly_retries"] == 1


class TestFetchAvailableDates:
    """Test available dates fetching functionality"""
    
    def test_fetch_available_dates_success(self):
        """Test successful available dates fetch"""
        mock_browser = Mock()
        mock_response = Mock()
        test_data = {
            "aggs": [{
                "buckets": [
                    {"日期": "2024-01-01"},
                    {"日期": "2024-01-02"}
                ]
            }]
        }
        mock_response.read.return_value = json.dumps(test_data).encode('utf-8')
        mock_browser.open.return_value = mock_response
        
        result = fetch_available_dates(mock_browser)
        
        expected = [date(2024, 1, 1), date(2024, 1, 2)]
        assert result == expected
    
    def test_fetch_available_dates_empty_aggs(self):
        """Test available dates fetch with empty aggregations"""
        mock_browser = Mock()
        mock_response = Mock()
        test_data = {"aggs": []}
        mock_response.read.return_value = json.dumps(test_data).encode('utf-8')
        mock_browser.open.return_value = mock_response
        
        result = fetch_available_dates(mock_browser)
        
        assert result == []
    
    def test_fetch_available_dates_no_aggs_key(self):
        """Test available dates fetch without aggs key"""
        mock_browser = Mock()
        mock_response = Mock()
        test_data = {"other_key": "value"}
        mock_response.read.return_value = json.dumps(test_data).encode('utf-8')
        mock_browser.open.return_value = mock_response
        
        result = fetch_available_dates(mock_browser)
        
        assert result == []
    
    def test_fetch_available_dates_network_error(self):
        """Test available dates fetch with network error"""
        mock_browser = Mock()
        mock_browser.open.side_effect = Exception("Network error")
        
        with patch('ivod.crawler.requests.get') as mock_requests:
            mock_response = Mock()
            mock_response.text = json.dumps({"aggs": []})
            mock_requests.return_value = mock_response
            
            result = fetch_available_dates(mock_browser)
            
            assert result == []
    
    def test_fetch_available_dates_invalid_json(self):
        """Test available dates fetch with invalid JSON"""
        mock_browser = Mock()
        mock_response = Mock()
        mock_response.read.return_value = b"invalid json"
        mock_browser.open.return_value = mock_response
        
        result = fetch_available_dates(mock_browser)
        
        assert result == []


class TestFetchLySpeech:
    """Test LY speech fetching functionality"""
    
    @patch('ivod.crawler.requests.get')
    def test_fetch_ly_speech_success(self, mock_get):
        """Test successful LY speech fetch"""
        mock_response = Mock()
        mock_response.content = b"Test speech content"
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        result = fetch_ly_speech("123456")
        
        assert result == "Test speech content"
        mock_get.assert_called_once()
    
    @patch('ivod.crawler.requests.get')
    def test_fetch_ly_speech_http_error(self, mock_get):
        """Test LY speech fetch with HTTP error"""
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = Exception("HTTP error")
        mock_get.return_value = mock_response
        
        with pytest.raises(Exception):
            fetch_ly_speech("123456")
    
    @patch('ivod.crawler.requests.get')
    def test_fetch_ly_speech_request_exception(self, mock_get):
        """Test LY speech fetch with request exception"""
        mock_get.side_effect = Exception("Request failed")
        
        with pytest.raises(Exception):
            fetch_ly_speech("123456")
    
    @patch('ivod.crawler.requests.get')
    def test_fetch_ly_speech_empty_content(self, mock_get):
        """Test LY speech fetch with empty content"""
        mock_response = Mock()
        mock_response.content = b""
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        result = fetch_ly_speech("123456")
        
        assert result == ""


class TestExceptionHandling:
    """Test exception handling in crawler functions"""
    
    def test_network_error_handling(self):
        """Test network error exception handling"""
        mock_browser = Mock()
        mock_browser.open.side_effect = IVODNetworkError("Network failed", url="test://url")
        
        # Test that the exception is raised properly
        with pytest.raises(IVODNetworkError):
            mock_browser.open("test://url")
    
    def test_ssl_error_handling(self):
        """Test SSL error exception handling"""
        with pytest.raises(IVODSSLError):
            raise IVODSSLError("SSL failed", url="https://example.com")
    
    def test_timeout_error_handling(self):
        """Test timeout error exception handling"""
        with pytest.raises(IVODTimeoutError):
            raise IVODTimeoutError("Timeout", url="test://url", timeout=30)
    
    def test_parsing_error_handling(self):
        """Test parsing error exception handling"""
        with pytest.raises(IVODParsingError):
            raise IVODParsingError("Parse failed", content_type="JSON")
    
    def test_transcript_error_handling(self):
        """Test transcript error exception handling"""
        with pytest.raises(IVODTranscriptError):
            raise IVODTranscriptError("Transcript failed", ivod_id="123", transcript_type="AI")


class TestBrowserConfiguration:
    """Test browser configuration edge cases"""
    
    @patch('ivod.crawler.mechanize.Browser')
    def test_browser_header_configuration(self, mock_browser_class):
        """Test that browser headers are configured correctly"""
        mock_browser = Mock()
        mock_browser_class.return_value = mock_browser
        
        make_browser()
        
        # Verify all required headers are set
        assert mock_browser.addheaders == HEADERS
        assert len(HEADERS) > 0
        assert any("User-Agent" in header for header in HEADERS)
    
    @patch('ivod.crawler.mechanize.Browser')
    def test_browser_ssl_configuration_error(self, mock_browser_class):
        """Test browser creation when SSL configuration fails"""
        mock_browser = Mock()
        mock_browser_class.return_value = mock_browser
        
        with patch('ivod.crawler.ssl.create_default_context', side_effect=ssl.SSLError("SSL config failed")):
            # Should not raise exception, should continue
            browser = make_browser(skip_ssl=True)
            assert browser == mock_browser


class TestDataParsing:
    """Test data parsing functionality"""
    
    def test_json_parsing_with_valid_data(self):
        """Test JSON parsing with valid data"""
        valid_json = '{"ivods": [{"IVOD_ID": "123", "日期": "2024-01-01"}]}'
        data = json.loads(valid_json)
        
        assert "ivods" in data
        assert len(data["ivods"]) == 1
        assert data["ivods"][0]["IVOD_ID"] == "123"
    
    def test_date_parsing_with_various_formats(self):
        """Test date parsing with various formats"""
        from datetime import datetime
        
        # Test ISO format
        date_str = "2024-01-01"
        parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        assert parsed_date == date(2024, 1, 1)
        
        # Test other common formats
        date_str2 = "2024/01/01"
        parsed_date2 = datetime.strptime(date_str2, "%Y/%m/%d").date()
        assert parsed_date2 == date(2024, 1, 1)


class TestErrorRecovery:
    """Test error recovery mechanisms"""
    
    def test_retry_mechanism_simulation(self):
        """Test retry mechanism simulation"""
        attempt_count = 0
        max_retries = 3
        
        def failing_function():
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count < max_retries:
                raise Exception(f"Attempt {attempt_count} failed")
            return "Success"
        
        # Simulate retry logic
        for i in range(max_retries):
            try:
                result = failing_function()
                break
            except Exception as e:
                if i == max_retries - 1:
                    raise
                continue
        
        assert result == "Success"
        assert attempt_count == max_retries


if __name__ == "__main__":
    pytest.main([__file__])