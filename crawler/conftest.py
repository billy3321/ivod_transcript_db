import pytest
from unittest.mock import Mock

@pytest.fixture
def es():
    """Mock Elasticsearch client"""
    mock_es = Mock()
    mock_es.ping.return_value = True
    mock_es.indices.exists.return_value = True
    mock_es.indices.create.return_value = {"acknowledged": True}
    mock_es.indices.delete.return_value = {"acknowledged": True}
    mock_es.get.return_value = {
        "_source": {
            "ai_transcript": "test ai transcript",
            "ly_transcript": "test ly transcript",
            "title": "test title",
        }
    }
    mock_es.bulk.return_value = {"errors": False}
    return mock_es

@pytest.fixture
def index_name():
    """Mock Elasticsearch index name"""
    return "test_index"
