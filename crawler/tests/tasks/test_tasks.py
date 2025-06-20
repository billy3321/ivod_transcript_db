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
    run_incremental(skip_ssl=False)
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

        def order_by(self, *args):
            return self

        def all(self):
            return []

        def close(self):
            calls.append("close")

        def commit(self):
            calls.append("commit")

    monkeypatch.setattr(tasks, "Session", lambda: DummyDB())
    run_retry(skip_ssl=False)
    assert calls == ["commit", "close"]


def test_run_retry_with_objects(monkeypatch):
    import ivod.tasks as tasks

    monkeypatch.setattr(tasks, "make_browser", lambda skip_ssl: None)
    from datetime import date
    objs = [type("O", (), {"ivod_id": 1111, "date": date(2023, 1, 1)}), type("O", (), {"ivod_id": 2222, "date": date(2023, 1, 2)})]

    class DummyQuery:
        def __init__(self, objs):
            self.objs = objs

        def filter(self, *args):
            return self

        def order_by(self, *args):
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
    def mock_process_ivod(br, ivod_id):
        processed.append((ivod_id, db_instance))
        return {'ai_status': 'success', 'ly_status': 'success'}
    monkeypatch.setattr(tasks, "process_ivod", mock_process_ivod)
    run_retry(skip_ssl=True)
    expected = [(1111, db_instance), (2222, db_instance), (1111, db_instance), (2222, db_instance)]
    assert processed == expected
    assert db_instance.commits == len(expected)
    assert db_instance.closed