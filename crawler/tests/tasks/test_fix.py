#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_fix.py

測試錯誤記錄和補抓功能
"""

import os
import tempfile
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
import sys

# 加入父目錄到路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from ivod.tasks import log_failed_ivod
from ivod_fix import (
    remove_from_error_log,
    read_failed_ivods,
    fix_single_ivod,
    fix_from_file
)

class TestErrorLogging:
    """測試錯誤記錄功能"""
    
    def test_log_failed_ivod(self):
        """測試記錄失敗的IVOD_ID"""
        with tempfile.TemporaryDirectory() as temp_dir:
            error_log_path = os.path.join(temp_dir, "test_failed.txt")
            
            # 設定環境變數
            with patch.dict(os.environ, {'ERROR_LOG_PATH': error_log_path}):
                # 記錄錯誤
                log_failed_ivod(123456, "test_error")
                log_failed_ivod(789012, "another_error")
                
                # 檢查檔案內容
                assert os.path.exists(error_log_path)
                with open(error_log_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                assert len(lines) == 2
                assert "123456,test_error," in lines[0]
                assert "789012,another_error," in lines[1]
    
    def test_log_failed_ivod_creates_directory(self):
        """測試錯誤記錄功能會建立目錄"""
        with tempfile.TemporaryDirectory() as temp_dir:
            error_log_path = os.path.join(temp_dir, "logs", "failed.txt")
            
            with patch.dict(os.environ, {'ERROR_LOG_PATH': error_log_path}):
                log_failed_ivod(999999, "test")
                
                assert os.path.exists(error_log_path)

class TestErrorLogManagement:
    """測試錯誤記錄檔案管理"""
    
    def test_read_failed_ivods(self):
        """測試讀取失敗IVOD列表"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8') as f:
            f.write("123456,processing,2024-01-01 10:00:00\n")
            f.write("789012,incremental,2024-01-01 11:00:00\n")
            f.write("123456,retry,2024-01-01 12:00:00\n")  # 重複的ID
            f.write("invalid_line\n")  # 無效行
            f.write("not_number,error,2024-01-01 13:00:00\n")  # 無效ID
            temp_path = f.name
        
        try:
            failed_ivods = read_failed_ivods(temp_path)
            # 應該去重複，並過濾無效的ID
            assert set(failed_ivods) == {123456, 789012}
        finally:
            os.unlink(temp_path)
    
    def test_read_failed_ivods_nonexistent_file(self):
        """測試讀取不存在的錯誤記錄檔案"""
        failed_ivods = read_failed_ivods("/nonexistent/path.txt")
        assert failed_ivods == []
    
    def test_remove_from_error_log(self):
        """測試從錯誤記錄中移除IVOD_ID"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8') as f:
            f.write("123456,processing,2024-01-01 10:00:00\n")
            f.write("789012,incremental,2024-01-01 11:00:00\n")
            f.write("555555,retry,2024-01-01 12:00:00\n")
            temp_path = f.name
        
        try:
            # 移除中間的記錄
            remove_from_error_log(789012, temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            assert len(lines) == 2
            assert "123456,processing,2024-01-01 10:00:00\n" in lines
            assert "555555,retry,2024-01-01 12:00:00\n" in lines
            assert "789012" not in "".join(lines)
        finally:
            os.unlink(temp_path)
    
    def test_remove_from_error_log_nonexistent_file(self):
        """測試從不存在的錯誤記錄檔案中移除"""
        # 不應該拋出例外
        remove_from_error_log(123456, "/nonexistent/path.txt")

class TestFixFunctionality:
    """測試補抓功能"""
    
    @patch('ivod_fix.make_browser')
    @patch('ivod_fix.Session')
    @patch('ivod_fix.process_ivod')
    def test_fix_single_ivod_new_record(self, mock_process, mock_session_class, mock_browser):
        """測試補抓單一IVOD（新記錄）"""
        # 設定模擬物件
        mock_db = MagicMock()
        mock_session_class.return_value = mock_db
        mock_db.get.return_value = None  # 不存在的記錄
        
        mock_process.return_value = {
            'ivod_id': 123456,
            'title': 'Test IVOD',
            'ai_transcript': 'Test transcript'
        }
        
        # 執行測試
        result = fix_single_ivod(123456)
        
        # 驗證
        assert result is True
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.close.assert_called_once()
    
    @patch('ivod_fix.make_browser')
    @patch('ivod_fix.Session')
    @patch('ivod_fix.process_ivod')
    def test_fix_single_ivod_existing_record(self, mock_process, mock_session_class, mock_browser):
        """測試補抓單一IVOD（更新現有記錄）"""
        # 設定模擬物件
        mock_db = MagicMock()
        mock_session_class.return_value = mock_db
        
        mock_obj = MagicMock()
        mock_db.get.return_value = mock_obj  # 存在的記錄
        
        mock_process.return_value = {
            'ivod_id': 123456,
            'title': 'Updated Test IVOD',
            'ai_transcript': 'Updated transcript'
        }
        
        # 執行測試
        result = fix_single_ivod(123456)
        
        # 驗證
        assert result is True
        mock_db.add.assert_not_called()  # 不應該新增記錄
        mock_db.commit.assert_called_once()
        mock_db.close.assert_called_once()
        
        # 檢查屬性更新
        assert hasattr(mock_obj, 'last_updated')
    
    @patch('ivod_fix.make_browser')
    @patch('ivod_fix.Session')
    @patch('ivod_fix.process_ivod')
    def test_fix_single_ivod_failure(self, mock_process, mock_session_class, mock_browser):
        """測試補抓單一IVOD失敗"""
        # 設定模擬物件拋出例外
        mock_db = MagicMock()
        mock_session_class.return_value = mock_db
        mock_process.side_effect = Exception("Network error")
        
        # 執行測試
        result = fix_single_ivod(123456)
        
        # 驗證
        assert result is False
        mock_db.rollback.assert_called_once()
        mock_db.close.assert_called_once()
    
    @patch('ivod_fix.fix_single_ivod')
    @patch('ivod_fix.read_failed_ivods')
    @patch('ivod_fix.remove_from_error_log')
    @patch('ivod_fix.log_failed_ivod')
    def test_fix_from_file_success(self, mock_log_failed, mock_remove, mock_read, mock_fix_single):
        """測試從檔案批量修復（成功案例）"""
        # 設定模擬資料
        mock_read.return_value = [123456, 789012]
        mock_fix_single.side_effect = [True, True]  # 兩個都成功
        
        error_log_path = "test_errors.txt"
        
        # 執行測試
        fix_from_file(error_log_path)
        
        # 驗證
        assert mock_fix_single.call_count == 2
        assert mock_remove.call_count == 2
        mock_log_failed.assert_not_called()  # 沒有失敗記錄
    
    @patch('ivod_fix.fix_single_ivod')
    @patch('ivod_fix.read_failed_ivods')
    @patch('ivod_fix.remove_from_error_log')
    @patch('ivod_fix.log_failed_ivod')
    def test_fix_from_file_partial_failure(self, mock_log_failed, mock_remove, mock_read, mock_fix_single):
        """測試從檔案批量修復（部分失敗）"""
        # 設定模擬資料
        mock_read.return_value = [123456, 789012, 555555]
        mock_fix_single.side_effect = [True, False, True]  # 第二個失敗
        
        error_log_path = "test_errors.txt"
        
        # 執行測試
        fix_from_file(error_log_path)
        
        # 驗證
        assert mock_fix_single.call_count == 3
        assert mock_remove.call_count == 2  # 只有成功的會被移除
        mock_log_failed.assert_called_once_with(789012, "fix_retry")
    
    @patch('ivod_fix.read_failed_ivods')
    def test_fix_from_file_empty(self, mock_read):
        """測試從空的錯誤記錄檔案修復"""
        mock_read.return_value = []
        
        # 執行測試（不應該拋出例外）
        fix_from_file("empty_errors.txt")
        
        # 驗證讀取被呼叫
        mock_read.assert_called_once()

if __name__ == '__main__':
    pytest.main([__file__])