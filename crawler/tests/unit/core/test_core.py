import pytest

from ivod.core import date_range, HEADERS, make_browser, fetch_ivod_list, fetch_ai, fetch_ly


def test_date_range_single_day():
    days = list(date_range("2023-01-01", "2023-01-01"))
    assert days == ["2023-01-01"]


def test_date_range_multiple_days():
    days = list(date_range("2023-01-01", "2023-01-03"))
    assert days == ["2023-01-01", "2023-01-02", "2023-01-03"]


def test_make_browser_default():
    br = make_browser(skip_ssl=False)
    assert hasattr(br, "addheaders")
    assert br.addheaders == HEADERS


def test_make_browser_skip_ssl():
    br = make_browser(skip_ssl=True)
    assert hasattr(br, "addheaders")
    assert br.addheaders == HEADERS


class DummyResponse:
    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data.encode("utf-8")


class DummyBr:
    def __init__(self, data):
        self._data = data

    def open(self, url):
        return DummyResponse(self._data)


def test_fetch_ivod_list():
    data = '{"ivods": [{"IVOD_ID": "1"}, {"IVOD_ID": "2"}]}'
    br = DummyBr(data)
    ids = fetch_ivod_list(br, "2025-04-28")
    assert ids == [1, 2]


def test_fetch_ai_success():
    rec = {}
    js = {"transcript": {"whisperx": [{"text": "hello"}, {"text": " world"}]}}
    fetch_ai(js, rec, obj=None, db=None)
    assert rec["ai_transcript"] == "hello world"
    assert rec["ai_status"] == "success"


def test_fetch_ai_failure():
    rec = {}
    js = {"transcript": None}
    fetch_ai(js, rec, obj=None, db=None)
    assert rec["ai_transcript"] == ""
    assert rec["ai_status"] == "failed"


def test_fetch_ly_gazette():
    rec = {"ivod_id": 149022}
    obj = None
    js = {"gazette": {"blocks": [["a", "b"], ["c"]]}}
    class DummyBr2:
        pass

    fetch_ly(js, rec, obj, DummyBr2())
    assert rec["ly_transcript"] == "a\nb\n\nc"
    assert rec["ly_status"] == "success"


def test_fetch_ly_without_gazette(monkeypatch):
    from ivod.core import fetch_ly
    # Ensure fallback to fetch_ly_speech when no gazette in js
    rec = {"ivod_id": 123}
    obj = None
    js = {}

    monkeypatch.setattr("ivod.crawler.fetch_ly_speech", lambda ivod_id: "speech text")
    fetch_ly(js, rec, obj, None)
    assert rec["ly_transcript"] == "speech text"
    assert rec["ly_status"] == "success"

def test_headers_format():
    from ivod.crawler import HEADERS
    assert isinstance(HEADERS, list)
    assert all(isinstance(k, str) and isinstance(v, str) for k, v in HEADERS)
    assert any(k == "User-Agent" for k, _ in HEADERS)

def test_random_sleep(monkeypatch):
    import ivod.crawler as crawler_mod
    calls = []
    monkeypatch.setattr(crawler_mod.random, "uniform", lambda a, b: 0.42)
    monkeypatch.setattr(crawler_mod.time, "sleep", lambda d: calls.append(d))
    crawler_mod.random_sleep(0.1, 0.2)
    assert calls == [0.42]

def test_fetch_lastest_date_success(monkeypatch):
    from ivod.crawler import fetch_lastest_date
    import json

    class DummyResp:
        def __init__(self, data):
            self._data = data
        def read(self):
            return self._data.encode("utf-8")

    class DummyBr:
        def open(self, url):
            payload = json.dumps({"ivods": [{"日期": "2023-01-02"}]})
            return DummyResp(payload)

    br = DummyBr()
    date = fetch_lastest_date(br)
    assert date.isoformat() == "2023-01-02"

def test_fetch_lastest_date_fallback(monkeypatch):
    from ivod.crawler import fetch_lastest_date
    import json

    class DummyBr:
        def open(self, url):
            raise RuntimeError("fail")

    monkeypatch.setattr("ivod.crawler.requests.get", lambda url, verify: type(
        "R", (), {"text": json.dumps({"ivods": [{"日期": "2023-03-04"}]})}
    )())
    date = fetch_lastest_date(DummyBr())
    assert date.isoformat() == "2023-03-04"

def test_fetch_ivod_info_success(monkeypatch):
    from ivod.crawler import fetch_ivod_info
    import json

    data = {"data": {"key": "value"}}

    class DummyResp:
        def __init__(self, data):
            self._data = data
        def read(self):
            return self._data.encode("utf-8")

    class DummyBr:
        def open(self, url):
            return DummyResp(json.dumps(data))

    result = fetch_ivod_info(DummyBr(), 123)
    assert result == data["data"]

def test_fetch_ivod_info_fallback(monkeypatch):
    from ivod.crawler import fetch_ivod_info
    import json

    class DummyBr:
        def open(self, url):
            raise RuntimeError("fail")

    monkeypatch.setattr("ivod.crawler.requests.get", lambda url, verify: type(
        "R", (), {"text": json.dumps({"data": {"k": "v"}})}
    )())
    result = fetch_ivod_info(DummyBr(), 456)
    assert result == {"k": "v"}

def test_fetch_ivod_list_success(monkeypatch):
    from ivod.crawler import fetch_ivod_list
    import json

    class DummyResp:
        def __init__(self, data):
            self._data = data
        def read(self):
            return self._data.encode("utf-8")

    class DummyBr:
        def open(self, url):
            return DummyResp(json.dumps({"ivods": [{"IVOD_ID": "10"}, {"IVOD_ID": "20"}]}))

    result = fetch_ivod_list(DummyBr(), "2025-04-28")
    assert result == [10, 20]

def test_fetch_ivod_list_fallback(monkeypatch):
    from ivod.crawler import fetch_ivod_list
    import json

    class DummyBr:
        def open(self, url):
            raise RuntimeError("fail")

    monkeypatch.setattr("ivod.crawler.requests.get", lambda url, verify: type(
        "R", (), {"text": json.dumps({"ivods": [{"IVOD_ID": "30"}]})}
    )())
    result = fetch_ivod_list(DummyBr(), "2025-04-28")
    assert result == [30]