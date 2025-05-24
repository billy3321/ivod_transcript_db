import json
import datetime

import pytest

from ivod.crawler import fetch_available_dates


class DummyResponse:
    def __init__(self, data):
        self._data = data

    def read(self):
        return self._data.encode('utf-8')


class DummyBr:
    def __init__(self, data):
        self.data = data
        self.opened_urls = []

    def open(self, url):
        self.opened_urls.append(url)
        return DummyResponse(self.data)


def test_fetch_available_dates_success():
    # Mechanize fetch returns valid aggregation buckets
    js = {"aggs": [{"buckets": [{"日期": "2023-01-01"}, {"日期": "2023-01-02"}]}]}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br, session=4)
    assert dates == [
        datetime.date(2023, 1, 1),
        datetime.date(2023, 1, 2),
    ]
    # URL includes the provided session parameter (percent-encoded)
    assert any('%E6%9C%83%E6%9C%9F=4' in url for url in br.opened_urls)


def test_fetch_available_dates_empty_aggs():
    # Empty 'aggs' yields empty list
    js = {"aggs": []}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br)
    assert dates == []


def test_fetch_available_dates_no_aggs_key():
    # Missing 'aggs' key yields empty list
    js = {}
    data = json.dumps(js)
    br = DummyBr(data)
    dates = fetch_available_dates(br)
    assert dates == []


def test_fetch_available_dates_fallback(monkeypatch):
    # On browser failure, fallback to requests.get
    dummy_br = DummyBr(None)
    def fake_open(url):
        raise RuntimeError("browser fail")

    dummy_br.open = fake_open
    captured = {}

    def fake_get(url, verify):
        captured['url'] = url
        captured['verify'] = verify
        return type('R', (), {
            'text': json.dumps({
                "aggs": [{"buckets": [{"日期": "2022-12-31"}]}]
            })
        })()

    monkeypatch.setattr('ivod.crawler.requests.get', fake_get)
    dates = fetch_available_dates(dummy_br, session=7)
    assert dates == [datetime.date(2022, 12, 31)]
    assert captured.get('verify') is False
    assert '%E6%9C%83%E6%9C%9F=7' in captured.get('url', '')