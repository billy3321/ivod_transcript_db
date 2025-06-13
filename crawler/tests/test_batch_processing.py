#!/usr/bin/env python3
"""
Tests for batch processing functionality.
"""

import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime

from ivod.tasks import BatchProcessor
from ivod.db import IVODTranscript


class TestBatchProcessor:
    """Test the BatchProcessor class."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.mock_db = Mock()
        self.batch_processor = BatchProcessor(self.mock_db, batch_size=3, commit_interval=2)
    
    def test_init(self):
        """Test BatchProcessor initialization."""
        assert self.batch_processor.db is self.mock_db
        assert self.batch_processor.batch_size == 3
        assert self.batch_processor.commit_interval == 2
        assert self.batch_processor.batch_buffer == []
        assert self.batch_processor.batch_count == 0
        assert self.batch_processor.total_processed == 0
        assert self.batch_processor.total_errors == 0
    
    def test_add_record_new(self):
        """Test adding new records to batch."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        # Add records below batch size
        self.batch_processor.add_record(record_data)
        assert len(self.batch_processor.batch_buffer) == 1
        assert self.batch_processor.total_processed == 0  # Not processed yet
        
        self.batch_processor.add_record(record_data)
        assert len(self.batch_processor.batch_buffer) == 2
        
        # Mock the IVODTranscript constructor and db.add
        with patch('ivod.tasks.IVODTranscript') as mock_transcript:
            mock_instance = Mock()
            mock_transcript.return_value = mock_instance
            
            # Adding third record should trigger batch processing
            self.batch_processor.add_record(record_data)
            
            # Batch should be processed and cleared
            assert len(self.batch_processor.batch_buffer) == 0
            assert self.batch_processor.batch_count == 1
            assert self.batch_processor.total_processed == 3
            
            # Check that db.add was called for each record
            assert self.mock_db.add.call_count == 3
    
    def test_add_record_update(self):
        """Test adding records for update."""
        record_data = {"title": "Updated"}
        ivod_id = 123
        
        # Mock existing record
        mock_obj = Mock()
        self.mock_db.get.return_value = mock_obj
        
        self.batch_processor.add_record(record_data, ivod_id)
        
        # Should not process until batch size reached
        assert len(self.batch_processor.batch_buffer) == 1
        
        # Add more records to trigger processing
        self.batch_processor.add_record(record_data, ivod_id)
        self.batch_processor.add_record(record_data, ivod_id)
        
        # Should process the batch
        assert len(self.batch_processor.batch_buffer) == 0
        assert self.batch_processor.total_processed == 3
        
        # Check that setattr was called to update existing objects
        assert mock_obj.title == "Updated"
    
    def test_commit_interval(self):
        """Test that commits happen at specified intervals."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        with patch('ivod.tasks.IVODTranscript'):
            # Process 6 records (2 batches)
            for _ in range(6):
                self.batch_processor.add_record(record_data)
            
            # Should have committed once (after 2 batches)
            assert self.mock_db.commit.call_count == 1
            assert self.batch_processor.batch_count == 2
    
    def test_flush(self):
        """Test flushing remaining records."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        with patch('ivod.tasks.IVODTranscript'):
            # Add 2 records (below batch size)
            self.batch_processor.add_record(record_data)
            self.batch_processor.add_record(record_data)
            
            assert len(self.batch_processor.batch_buffer) == 2
            assert self.batch_processor.total_processed == 0
            
            # Flush should process remaining records
            self.batch_processor.flush()
            
            assert len(self.batch_processor.batch_buffer) == 0
            assert self.batch_processor.total_processed == 2
            assert self.mock_db.commit.called
    
    def test_error_handling(self):
        """Test error handling during batch processing."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        # Mock IVODTranscript to raise an exception
        with patch('ivod.tasks.IVODTranscript', side_effect=Exception("Test error")):
            # Add records to trigger processing
            for _ in range(3):
                self.batch_processor.add_record(record_data)
            
            # Should have recorded errors but continued
            assert self.batch_processor.total_errors == 3
            assert self.batch_processor.total_processed == 0
    
    def test_database_error_rollback(self):
        """Test rollback on database error."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        # Mock db.add to raise an exception during processing
        self.mock_db.add.side_effect = Exception("Database error")
        
        with pytest.mock.patch('ivod.tasks.IVODTranscript'):
            with pytest.raises(Exception):
                # Add records to trigger processing
                for _ in range(3):
                    self.batch_processor.add_record(record_data)
            
            # Should have called rollback
            self.mock_db.rollback.assert_called()
    
    def test_flush_commit_error(self):
        """Test handling of commit error during flush."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        # Mock commit to raise an exception
        self.mock_db.commit.side_effect = Exception("Commit error")
        
        with pytest.mock.patch('ivod.tasks.IVODTranscript'):
            self.batch_processor.add_record(record_data)
            
            with pytest.raises(Exception):
                self.batch_processor.flush()
            
            # Should have called rollback
            self.mock_db.rollback.assert_called()
    
    def test_update_nonexistent_record(self):
        """Test updating a record that doesn't exist."""
        record_data = {"title": "Updated"}
        ivod_id = 123
        
        # Mock get to return None (record doesn't exist)
        self.mock_db.get.return_value = None
        
        with patch('ivod.tasks.IVODTranscript') as mock_transcript:
            self.batch_processor.add_record(record_data, ivod_id)
            self.batch_processor.add_record(record_data, ivod_id)
            self.batch_processor.add_record(record_data, ivod_id)
            
            # Should create new records instead of updating
            assert mock_transcript.call_count == 3
            assert self.mock_db.add.call_count == 3
    
    def test_timestamp_handling(self):
        """Test that last_updated timestamp is added correctly."""
        record_data = {"ivod_id": 123, "title": "Test"}
        
        with patch('ivod.tasks.IVODTranscript') as mock_transcript:
            with patch('ivod.tasks.datetime') as mock_datetime:
                mock_now = datetime(2023, 1, 1, 12, 0, 0)
                mock_datetime.now.return_value = mock_now
                
                self.batch_processor.add_record(record_data)
                self.batch_processor.add_record(record_data)
                self.batch_processor.add_record(record_data)
                
                # Check that last_updated was added to all records
                for call in mock_transcript.call_args_list:
                    args, kwargs = call
                    record = args[0] if args else kwargs
                    assert record["last_updated"] == mock_now