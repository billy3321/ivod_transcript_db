import time
import json
import datetime
from datetime import datetime, date

import mechanize
import pytest
import requests
import subprocess

import ivod.crawler as crawler
from ivod.crawler import (
    random_sleep,
    date_range,
    make_browser,
    fetch_lastest_date,
    fetch_ivod_list,
    fetch_ivod_info,
    fetch_ai,
    fetch_ly,
    fetch_available_dates,
    fetch_ly_speech,
)


def test_date_range_single_and_multiple():
    assert list(date_range("2023-01-01", "2023-01-01")) == ["2023-01-01"]
    assert list(date_range("2023-01-01", "2023-01-03")) == [
        "2023-01-01",
        "2023-01-02",
        "2023-01-03",
    ]


def test_random_sleep(monkeypatch):
    calls = []
    monkeypatch.setattr(time, "sleep", lambda x: calls.append(x))
    random_sleep(0.1, 0.2)
    assert len(calls) == 1
    assert 0.1 <= calls[0] <= 0.2


def test_make_browser_returns_browser():
    br = make_browser(skip_ssl=False)
    assert isinstance(br, mechanize.Browser)
    br2 = make_browser(skip_ssl=True)
    assert isinstance(br2, mechanize.Browser)


class DummyResponse:
    def __init__(self, raw):
        self._raw = raw

    def read(self):
        return self._raw.encode('utf-8')


class DummyBrowser:
    def __init__(self, raw):
        self.raw = raw

    def open(self, url):
        return DummyResponse(self.raw)


def test_fetch_lastest_date_primary():
    js = {"ivods": [{"日期": "2023-01-02"}]}
    raw = json.dumps(js)
    br = DummyBrowser(raw)
    result = fetch_lastest_date(br)
    assert result == date.fromisoformat("2023-01-02")


def test_fetch_lastest_date_fallback(monkeypatch):
    js = {"ivods": [{"日期": "2023-01-03"}]}
    raw = json.dumps(js)
    br = DummyBrowser("")
    monkeypatch.setattr(br, "open", lambda url: (_ for _ in ()).throw(Exception("fail")))
    dummy = type("R", (), {"text": raw})()
    monkeypatch.setattr(requests, "get", lambda url, verify: dummy)
    result = fetch_lastest_date(br)
    assert result == date.fromisoformat("2023-01-03")


def test_fetch_ivod_list_primary():
    js = {"ivods": [{"IVOD_ID": "1"}, {"IVOD_ID": "2"}]}
    raw = json.dumps(js)
    br = DummyBrowser(raw)
    result = fetch_ivod_list(br, "2023-01-01")
    assert result == [1, 2]


def test_fetch_ivod_list_fallback(monkeypatch):
    js = {"ivods": [{"IVOD_ID": "3"}]}
    raw = json.dumps(js)
    br = DummyBrowser("")
    monkeypatch.setattr(br, "open", lambda url: (_ for _ in ()).throw(Exception("fail")))
    dummy = type("R", (), {"text": raw})()
    monkeypatch.setattr(requests, "get", lambda url, verify: dummy)
    result = fetch_ivod_list(br, "2023-01-01")
    assert result == [3]


def test_fetch_ivod_info_primary():
    data = {"foo": "bar"}
    raw = json.dumps({"data": data})
    br = DummyBrowser(raw)
    result = fetch_ivod_info(br, 123)
    assert result == data


def test_fetch_ivod_info_fallback(monkeypatch):
    data = {"baz": "qux"}
    raw = json.dumps({"data": data})
    br = DummyBrowser("")
    monkeypatch.setattr(br, "open", lambda url: (_ for _ in ()).throw(Exception("fail")))
    dummy = type("R", (), {"text": raw})()
    monkeypatch.setattr(requests, "get", lambda url, verify: dummy)
    result = fetch_ivod_info(br, 456)
    assert result == data


def test_fetch_ai_success():
    rec = {}
    js = {"transcript": {"whisperx": [{"text": "a"}, {"text": "b"}]}}
    fetch_ai(js, rec, None, None)
    assert rec["ai_transcript"] == "ab"
    assert rec["ai_status"] == "success"


def test_fetch_ai_failure_with_rec():
    rec = {}
    fetch_ai(None, rec, None, None)
    assert rec["ai_transcript"] == ""
    assert rec["ai_status"] == "failed"
    assert rec["ai_retries"] == 1


def test_fetch_ai_failure_with_obj():
    class O:
        pass

    obj = O()
    obj.ai_retries = 0
    rec = {}
    fetch_ai(None, rec, obj, None)
    assert rec["ai_transcript"] == ""
    assert rec["ai_status"] == "failed"
    assert obj.ai_retries == 1
    assert "ai_retries" not in rec


def test_fetch_ly_gazette():
    rec = {"ivod_id": 123}
    js = {"gazette": {"blocks": [["line1"], ["line2", "line3"]]}}
    fetch_ly(js, rec, None, None)
    assert rec["ly_transcript"] == "line1\n\nline2\nline3"
    assert rec["ly_status"] == "success"


def test_fetch_ly_speech(monkeypatch):
    rec = {"ivod_id": 456}
    monkeypatch.setattr(crawler, "fetch_ly_speech", lambda ivod_id: "txt")
    fetch_ly({}, rec, None, None)
    assert rec["ly_transcript"] == "txt"
    assert rec["ly_status"] == "success"


def test_fetch_ly_failure(monkeypatch):
    rec = {"ivod_id": 789}
    monkeypatch.setattr(crawler, "fetch_ly_speech", lambda ivod_id: (_ for _ in ()).throw(Exception("fail")))
    fetch_ly({}, rec, None, None)
    assert rec["ly_transcript"] == ""
    assert rec["ly_status"] == "failed"
    assert rec["ly_retries"] == 1


class DummyBr:
    def __init__(self, data):
        self.data = data
        self.opened_urls = []

    def open(self, url):
        self.opened_urls.append(url)
        return DummyResponse(self.data)


def test_fetch_available_dates_success():
    js = {"aggs": [{"buckets": [{"日期": "2023-01-01"}, {"日期": "2023-01-02"}]}]}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br, session=4)
    assert dates == [
        datetime.date(2023, 1, 1),
        datetime.date(2023, 1, 2),
    ]
    assert any('%E6%9C%83%E6%9C%9F=4' in url for url in br.opened_urls)


def test_fetch_available_dates_empty_aggs():
    js = {"aggs": []}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br)
    assert dates == []


def test_fetch_available_dates_no_aggs_key():
    js = {}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br)
    assert dates == []


def test_fetch_available_dates_fallback(monkeypatch):
    dummy_br = DummyBr(None)

    def fake_open(url):
        raise RuntimeError("browser fail")

    dummy_br.open = fake_open
    captured = {}

    def fake_get(url, verify):
        captured["url"] = url
        captured["verify"] = verify
        return type("R", (), {
            "text": json.dumps({
                "aggs": [{"buckets": [{"日期": "2022-12-31"}]}]
            })
        })()

    monkeypatch.setattr('ivod.crawler.requests.get', fake_get)
    dates = fetch_available_dates(dummy_br, session=7)
    assert dates == [datetime.date(2022, 12, 31)]
    assert captured.get("verify") is False
    assert '%E6%9C%83%E6%9C%9F=7' in captured.get("url", "")


@pytest.mark.integration
def test_fetch_available_dates_returns_date_list():
    br = make_browser(skip_ssl=False)
    dates = fetch_available_dates(br, session=3)
    assert isinstance(dates, list)
    assert dates, "fetch_available_dates returned empty list"
    assert all(isinstance(d, date) for d in dates)


# Tests from test_fetch_ly_speech.py

class DummyProcess:
    def __init__(self, stdout, returncode):
        self.stdout = stdout
        self.returncode = returncode


def test_fetch_ly_speech_success(monkeypatch):
    ivod_id = 159939
    expected_url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"

    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    def fake_run(cmd, stdout, stderr, text):
        assert cmd == ["curl", "--tlsv1.2", "--insecure", "-sSf", expected_url]
        return DummyProcess("<br />line1<br />line2<br />", 0)

    monkeypatch.setattr("ivod.crawler.subprocess.run", fake_run)

    result = fetch_ly_speech(ivod_id)
    assert result == "line1\nline2"


def test_fetch_ly_speech_non_zero_return(monkeypatch):
    ivod_id = 159939

    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    monkeypatch.setattr(
        "ivod.crawler.subprocess.run",
        lambda cmd, stdout, stderr, text: DummyProcess("ignored", 1),
    )
    result = fetch_ly_speech(ivod_id)
    assert result == ""


def test_fetch_ly_speech_exception(monkeypatch):
    ivod_id = 159939

    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    def fake_run_raise(cmd, stdout, stderr, text):
        raise RuntimeError("fail")

    monkeypatch.setattr("ivod.crawler.subprocess.run", fake_run_raise)
    result = fetch_ly_speech(ivod_id)
    assert result == ""


@pytest.mark.integration
@pytest.mark.parametrize("ivod_id", [159030, 159939])
def test_fetch_ly_speech_url_accessible(ivod_id):
    url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"
    transcript = fetch_ly_speech(ivod_id)
    assert "委員" in transcript, f"Failed to fetch transcript from {url}"