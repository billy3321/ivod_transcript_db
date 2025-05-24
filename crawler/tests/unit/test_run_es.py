import os
import json
import pytest

import ivod.tasks as tasks


class DummyIndices:
    def __init__(self):
        self.exists_calls = []
        self.create_calls = []

    def exists(self, index):
        self.exists_calls.append(index)
        return False

    def create(self, index, body):
        self.create_calls.append((index, body))


class DummyEs:
    def __init__(self, *args, **kwargs):
        self.indices = DummyIndices()
        self.index_calls = []

    def index(self, index, id, body):
        self.index_calls.append((index, id, body))


class DummyQuery:
    def __init__(self, objs):
        self.objs = objs

    def all(self):
        return self.objs


class DummyDB:
    def __init__(self, objs):
        self.objs = objs
        self.closed = False

    def query(self, model):
        return DummyQuery(self.objs)

    def close(self):
        self.closed = True


class DummyObj:
    def __init__(self, ivod_id, ai_transcript, ly_transcript, title):
        self.ivod_id = ivod_id
        self.ai_transcript = ai_transcript
        self.ly_transcript = ly_transcript
        self.title = title


@pytest.fixture(autouse=True)
def es_env(monkeypatch):
    monkeypatch.setenv("ES_HOST", "testhost")
    monkeypatch.setenv("ES_PORT", "1234")
    monkeypatch.setenv("ES_SCHEME", "http")
    monkeypatch.setenv("ES_USER", "user")
    monkeypatch.setenv("ES_PASS", "pass")
    monkeypatch.setenv("ES_INDEX", "testindex")
    return None


def test_run_es(monkeypatch):
    es_instance = DummyEs()
    monkeypatch.setattr(tasks, "Elasticsearch", lambda *args, **kwargs: es_instance)
    # Prepare dummy DB with two objects
    obj1 = DummyObj(1, "a", "b", "t1")
    obj2 = DummyObj(2, "", None, None)
    db_instance = DummyDB([obj1, obj2])
    monkeypatch.setattr(tasks, "Session", lambda: db_instance)

    tasks.run_es()

    # Ensure index creation was attempted once
    assert es_instance.indices.exists_calls == ["testindex"]
    assert len(es_instance.indices.create_calls) == 1

    # Ensure two documents were indexed
    assert len(es_instance.index_calls) == 2
    idx, id1, body1 = es_instance.index_calls[0]
    assert idx == "testindex"
    assert id1 == 1
    assert body1["ivod_id"] == 1
    assert body1["ai_transcript"] == "a"
    assert body1["ly_transcript"] == "b"
    assert body1["title"] == "t1"

    # Ensure the DB was closed
    assert db_instance.closed