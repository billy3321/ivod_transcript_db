#!/usr/bin/env python3
# ivod_core.py

import json
from datetime import datetime


from .crawler import (
    HEADERS,
    make_browser,
    fetch_lastest_date,
    fetch_ivod_list,
    fetch_ivod_info,
    fetch_ai,
    fetch_ly,
    date_range,
)
from .db import DB_BACKEND, Session, IVODTranscript


def process_ivod(br, ivod_id):
    """Fetch and assemble a single IVOD record into a dict."""
    js = fetch_ivod_info(br, ivod_id)
    md = js.get("會議資料", {}) or {}
    
    # Validate required fields
    date_str = js.get("日期")
    if not date_str:
        raise ValueError(f"Missing date field for IVOD_ID {ivod_id}")
    
    meeting_time_str = js.get("會議時間")
    if not meeting_time_str:
        raise ValueError(f"Missing meeting_time field for IVOD_ID {ivod_id}")
    
    try:
        parsed_date = datetime.fromisoformat(date_str).date()
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid date format for IVOD_ID {ivod_id}: {date_str} - {e}")
    
    try:
        parsed_meeting_time = datetime.fromisoformat(meeting_time_str)
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid meeting_time format for IVOD_ID {ivod_id}: {meeting_time_str} - {e}")
    
    rec = {
        "ivod_id": ivod_id,
        "ivod_url": js.get("IVOD_URL"),
        "date": parsed_date,
        "meeting_code": md.get("會議代碼"),
        "meeting_code_str": md.get("會議代碼:str"),
        "category": md.get("種類"),
        "committee_names": md.get("委員會代碼:str", []),
        "video_type": js.get("影片種類"),
        "video_start": js.get("開始時間"),
        "video_end": js.get("結束時間"),
        "video_length": js.get("影片長度"),
        "video_url": js.get("video_url"),
        "title": md.get("標題"),
        "speaker_name": js.get("委員名稱"),
        "meeting_time": parsed_meeting_time,
        "meeting_name": js.get("會議名稱"),
        "ai_transcript": "".join(
            item.get("text", "")
            for item in js.get("transcript", {}).get("whisperx", [])
        ),
    }
    if DB_BACKEND == "sqlite":
        rec["committee_names"] = json.dumps(rec["committee_names"])
    # Attach transcript statuses (updates retries if provided)
    fetch_ai(js, rec, None, None)
    fetch_ly(js, rec, None, br)
    now = datetime.now()
    rec["last_updated"] = now if DB_BACKEND != "sqlite" else now.isoformat()
    return rec