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
    ids = fetch_ivod_list(br, "2023-01-01")
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
    rec = {"ivod_id": 123}
    obj = None
    js = {"gazette": {"blocks": [["a", "b"], ["c"]]}}
    class DummyBr2:
        pass

    fetch_ly(js, rec, obj, DummyBr2())
    assert rec["ly_transcript"] == "a\nb\n\nc"
    assert rec["ly_status"] == "success"


@pytest.mark.parametrize("has_gazette", [False])
def test_fetch_ly_html(has_gazette):
    rec = {"ivod_id": 123}
    obj = None
    html = '<div class="speech-content"><p>line1</p><p>line2</p></div>'

    class DummyResponse2:
        def __init__(self, data):
            self._data = data

        def read(self):
            return self._data.encode("utf-8")

    class DummyBr3:
        def __init__(self, html):
            self.html = html

        def open(self, url):
            return DummyResponse2(self.html)

    js = {}
    fetch_ly(js, rec, obj, DummyBr3(html))
    assert "line1" in rec["ly_transcript"]
    assert "line2" in rec["ly_transcript"]
    assert rec["ly_status"] == "success"