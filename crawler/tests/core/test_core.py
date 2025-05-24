import json
from datetime import datetime

import pytest

import ivod.core as core


class DummyBrowser:
    pass


def make_dummy_js():
    return {
        "IVOD_URL": "url",
        "日期": "2023-01-01",
        "會議資料": {
            "會議代碼": "code",
            "會議代碼:str": "code_str",
            "種類": "category",
            "委員會代碼:str": ["a", "b"],
            "標題": "title",
        },
        "影片種類": "vt",
        "開始時間": "10:00",
        "結束時間": "10:30",
        "影片長度": "30m",
        "video_url": "vu",
        "委員名稱": "speaker",
        "會議時間": "2023-01-01T10:00:00",
        "transcript": {"whisperx": [{"text": "hello"}, {"text": "world"}]},
    }


def test_process_ivod_success(monkeypatch):
    dummy_js = make_dummy_js()
    monkeypatch.setattr(core, "fetch_ivod_info", lambda br, ivod_id: dummy_js)
    monkeypatch.setattr(core, "fetch_ai", lambda js, rec, obj, db: rec.setdefault("ai_status", "success"))
    monkeypatch.setattr(core, "fetch_ly", lambda js, rec, obj, br: rec.setdefault("ly_status", "success"))

    rec = core.process_ivod(DummyBrowser(), 123)
    assert rec["ivod_id"] == 123
    assert rec["ivod_url"] == "url"
    assert rec["date"] == datetime.fromisoformat("2023-01-01").date()
    assert json.loads(rec["committee_names"]) == ["a", "b"]
    assert rec["title"] == "title"
    assert rec["ai_transcript"] == "helloworld"
    assert rec["ai_status"] == "success"
    assert rec["ly_status"] == "success"
    # last_updated should be ISO formatted string for sqlite backend
    datetime.fromisoformat(rec["last_updated"])