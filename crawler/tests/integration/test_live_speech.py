import pytest
from ivod.crawler import fetch_ly_speech

@pytest.mark.integration
@pytest.mark.parametrize("ivod_id", [159030, 159939])
def test_live_speech_url_accessible(ivod_id):
    url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"
    transcript = fetch_ly_speech(ivod_id)
    assert '委員' in transcript, f"curl failed to fetch {url}"
