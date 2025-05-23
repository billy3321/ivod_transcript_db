import pytest

pytest.importorskip("elasticsearch")

from ivod.tasks import run_es

@pytest.mark.skip("Integration test not implemented")
def test_run_es():
    assert callable(run_es)