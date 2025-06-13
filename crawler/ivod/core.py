#!/usr/bin/env python3
# ivod_core.py

import json
from datetime import datetime, timezone, timedelta

from .crawler import (
    HEADERS,
    make_browser,
    fetch_latest_date,
    fetch_ivod_list,
    fetch_ivod_info,
    fetch_ai,
    fetch_ly,
    date_range,
)
from .db import DB_BACKEND, Session, IVODTranscript
from .exceptions import (
    IVODDataError,
    IVODParsingError,
    IVODTranscriptError,
)


def validate_ivod_data(js, ivod_id):
    """Validate required fields in IVOD JSON data."""
    if not js:
        raise IVODDataError(f"Empty JSON data for IVOD_ID {ivod_id}", ivod_id=ivod_id)
    
    date_str = js.get("日期")
    if not date_str:
        raise IVODDataError(f"Missing date field for IVOD_ID {ivod_id}", ivod_id=ivod_id, field="日期")
    
    meeting_time_str = js.get("會議時間")
    if not meeting_time_str:
        raise IVODDataError(f"Missing meeting_time field for IVOD_ID {ivod_id}", ivod_id=ivod_id, field="會議時間")
    
    return date_str, meeting_time_str


def parse_datetime_fields(date_str, meeting_time_str, ivod_id):
    """Parse date and meeting_time strings into datetime objects."""
    try:
        parsed_date = datetime.fromisoformat(date_str).date()
    except (ValueError, TypeError) as e:
        raise IVODParsingError(
            f"Invalid date format for IVOD_ID {ivod_id}: {date_str} - {e}",
            content_type="date",
            raw_content=date_str
        )
    
    try:
        parsed_meeting_time = datetime.fromisoformat(meeting_time_str)
    except (ValueError, TypeError) as e:
        raise IVODParsingError(
            f"Invalid meeting_time format for IVOD_ID {ivod_id}: {meeting_time_str} - {e}",
            content_type="meeting_time",
            raw_content=meeting_time_str
        )
    
    return parsed_date, parsed_meeting_time


def extract_basic_metadata(js, ivod_id, parsed_date, parsed_meeting_time):
    """Extract basic metadata from IVOD JSON data."""
    md = js.get("會議資料", {}) or {}
    
    return {
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
    }


def extract_ai_transcript(js):
    """Extract AI transcript from IVOD JSON data."""
    return "".join(
        item.get("text", "")
        for item in js.get("transcript", {}).get("whisperx", [])
    )


def normalize_committee_names(rec):
    """Normalize committee_names field based on database backend."""
    if DB_BACKEND == "sqlite":
        rec["committee_names"] = json.dumps(rec["committee_names"])
    return rec


def add_transcript_statuses(js, rec, br):
    """Add AI and LY transcript statuses to the record."""
    # Attach transcript statuses (updates retries if provided)
    fetch_ai(js, rec, None, None)
    fetch_ly(js, rec, None, br)
    return rec


def add_timestamp(rec):
    """Add last_updated timestamp to the record."""
    # 使用台灣時區 (UTC+8)
    taiwan_tz = timezone(timedelta(hours=8))
    now = datetime.now(taiwan_tz)
    
    rec["last_updated"] = now if DB_BACKEND != "sqlite" else now.isoformat()
    return rec


def process_ivod(br, ivod_id):
    """Fetch and assemble a single IVOD record into a dict."""
    # 1. Fetch raw data
    js = fetch_ivod_info(br, ivod_id)
    
    # 2. Validate required fields
    date_str, meeting_time_str = validate_ivod_data(js, ivod_id)
    
    # 3. Parse datetime fields
    parsed_date, parsed_meeting_time = parse_datetime_fields(date_str, meeting_time_str, ivod_id)
    
    # 4. Extract basic metadata
    rec = extract_basic_metadata(js, ivod_id, parsed_date, parsed_meeting_time)
    
    # 5. Extract AI transcript
    rec["ai_transcript"] = extract_ai_transcript(js)
    
    # 6. Normalize for database backend
    rec = normalize_committee_names(rec)
    
    # 7. Add transcript statuses
    rec = add_transcript_statuses(js, rec, br)
    
    # 8. Add timestamp
    rec = add_timestamp(rec)
    
    return rec