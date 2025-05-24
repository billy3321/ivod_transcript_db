import pytest

from ivod.tasks import run_full, run_incremental, run_retry


def test_tasks_callable():
    assert callable(run_full)
    assert callable(run_incremental)
    assert callable(run_retry)


def test_run_full_noop(monkeypatch):
    import ivod.tasks as tasks

    monkeypatch.setattr(tasks, "date_range", lambda start, end: [])
    monkeypatch.setattr(tasks, "fetch_ivod_list", lambda br, date: [])
    monkeypatch.setattr(tasks, "make_browser", lambda skip_ssl: None)

    calls = []
    class DummyDB:
        def commit(self):
            calls.append("commit")

        def close(self):
            calls.append("close")

    monkeypatch.setattr(tasks, "Session", lambda: DummyDB())
    # execute without error
    run_full(skip_ssl=False)
    assert calls == ["close"]

def test_run_incremental_noop(monkeypatch):
    import ivod.tasks as tasks

    monkeypatch.setattr(tasks, "date_range", lambda start, end: [])
    monkeypatch.setattr(tasks, "fetch_ivod_list", lambda br, date: [])
    monkeypatch.setattr(tasks, "make_browser", lambda skip_ssl: None)

    calls = []
    class DummyDB:
        def commit(self):
            calls.append("commit")

        def close(self):
            calls.append("close")

        def get(self, ivod_id):
            return None

    monkeypatch.setattr(tasks, "Session", lambda: DummyDB())
    tasks.run_incremental(skip_ssl=False)
    assert calls == ["commit", "close"]

def test_run_retry_noop(monkeypatch):
    import ivod.tasks as tasks

    monkeypatch.setattr(tasks, "make_browser", lambda skip_ssl: None)

    calls = []
    class DummyDB:
        def query(self, model):
            return self

        def filter(self, *args):
            return self

        def all(self):
            return []

        def close(self):
            calls.append("close")

        def commit(self):
            calls.append("commit")

    monkeypatch.setattr(tasks, "Session", lambda: DummyDB())
    tasks.run_retry(skip_ssl=False)
    assert calls == ["close"]

def test_run_retry_with_objects(monkeypatch):
    import ivod.tasks as tasks

    monkeypatch.setattr(tasks, "make_browser", lambda skip_ssl: None)
    objs = [type("O", (), {"ivod_id": 1111}), type("O", (), {"ivod_id": 2222})]

    class DummyQuery:
        def __init__(self, objs):
            self.objs = objs

        def filter(self, *args):
            return self

        def all(self):
            return self.objs

    class DummyDB:
        def __init__(self):
            self.commits = 0
            self.closed = False

        def query(self, model):
            return DummyQuery(objs)

        def commit(self):
            self.commits += 1

        def close(self):
            self.closed = True

    db_instance = DummyDB()
    processed = []
    monkeypatch.setattr(tasks, "Session", lambda: db_instance)
    monkeypatch.setattr(tasks, "process_ivod", lambda br, ivod_id, db: processed.append((ivod_id, db)))
    tasks.run_retry(skip_ssl=True)
    # Should retry each object for both AI and LY failure branches
    expected = [(1111, db_instance), (2222, db_instance), (1111, db_instance), (2222, db_instance)]
    assert processed == expected
    assert db_instance.commits == len(expected)
    assert db_instance.closed