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