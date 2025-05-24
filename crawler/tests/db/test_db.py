import importlib
import os

import pytest

import ivod.db as db_module


def reload_db_module():
    return importlib.reload(db_module)


def test_default_backend_and_url(monkeypatch):
    monkeypatch.delenv("DB_BACKEND", raising=False)
    monkeypatch.delenv("SQLITE_PATH", raising=False)
    db = reload_db_module()
    assert db.DB_BACKEND == "sqlite"
    assert db.DB_URL == "sqlite:///:memory:"
    assert "ivod_transcripts" in db.Base.metadata.tables


@pytest.mark.parametrize(
    "backend, env_vars, expected_url",
    [
        (
            "sqlite",
            {"SQLITE_PATH": "/tmp/test.db"},
            "sqlite:////tmp/test.db",
        ),
        (
            "postgresql",
            {
                "PG_HOST": "host",
                "PG_PORT": "5432",
                "PG_DB": "db",
                "PG_USER": "user",
                "PG_PASS": "pass",
            },
            "postgresql://user:pass@host:5432/db",
        ),
        (
            "mysql",
            {
                "MYSQL_HOST": "host",
                "MYSQL_PORT": "3306",
                "MYSQL_DB": "db",
                "MYSQL_USER": "user",
                "MYSQL_PASS": "pass",
            },
            "mysql+pymysql://user:pass@host:3306/db?charset=utf8mb4",
        ),
    ],
)
def test_env_backend_urls(monkeypatch, backend, env_vars, expected_url):
    monkeypatch.setenv("DB_BACKEND", backend)
    for key, val in env_vars.items():
        monkeypatch.setenv(key, val)
    db = reload_db_module()
    assert db.DB_BACKEND == backend
    assert db.DB_URL == expected_url


def test_invalid_backend(monkeypatch):
    monkeypatch.setenv("DB_BACKEND", "unsupported")
    with pytest.raises(ValueError):
        reload_db_module()