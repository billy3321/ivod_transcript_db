import subprocess
import pytest
from ivod.crawler import fetch_ly_speech


class DummyProcess:
    def __init__(self, stdout, returncode):
        self.stdout = stdout
        self.returncode = returncode


def test_fetch_ly_speech_success(monkeypatch):
    ivod_id = 159939
    expected_url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"

    # Skip actual sleep
    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    # Simulate subprocess.run returning output with <br /> tags and success code
    def fake_run(cmd, stdout, stderr, text):
        assert cmd == ["curl", "--tlsv1.2", "--insecure", "-sSf", expected_url]
        return DummyProcess("<br />line1<br />line2<br />", 0)

    monkeypatch.setattr("ivod.crawler.subprocess.run", fake_run)

    result = fetch_ly_speech(ivod_id)
    assert result == "line1\nline2"


def test_fetch_ly_speech_non_zero_return(monkeypatch):
    ivod_id = 159939

    # Skip actual sleep
    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    # Simulate subprocess.run returning non-zero code (failure)
    monkeypatch.setattr(
        "ivod.crawler.subprocess.run",
        lambda cmd, stdout, stderr, text: DummyProcess("ignored", 1),
    )
    result = fetch_ly_speech(ivod_id)
    assert result == ""


def test_fetch_ly_speech_exception(monkeypatch):
    ivod_id = 159939

    # Skip actual sleep
    monkeypatch.setattr("ivod.crawler.random_sleep", lambda a, b: None)

    # Simulate subprocess.run raising an exception
    def fake_run_raise(cmd, stdout, stderr, text):
        raise RuntimeError("fail")

    monkeypatch.setattr("ivod.crawler.subprocess.run", fake_run_raise)
    result = fetch_ly_speech(ivod_id)
    assert result == ""