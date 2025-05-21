#!/usr/bin/env python3
# ivod_core.py

import os
from datetime import datetime
from dateutil import rrule
from dotenv import load_dotenv
import ssl
import requests
import mechanize
import json
import http.cookiejar as cookiejar
from bs4 import BeautifulSoup
from sqlalchemy import (
    create_engine, Column, Integer, Text, Date, ARRAY, TIMESTAMP
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. 載入設定
load_dotenv()
DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()

# 2. 建立 SQLAlchemy engine & Session
if DB_BACKEND == "sqlite":
    SQLITE_PATH = os.getenv("SQLITE_PATH", "ivod_local.db")
    DB_URL = f"sqlite:///{SQLITE_PATH}"
elif DB_BACKEND == 'postgresql':
    PG = {
      "host": os.getenv("PG_HOST"),
      "port": os.getenv("PG_PORT", "5432"),
      "db":   os.getenv("PG_DB"),
      "user": os.getenv("PG_USER"),
      "pass": os.getenv("PG_PASS"),
    }

    DB_URL = (
        f"postgresql://{PG['user']}:{PG['pass']}@"
        f"{PG['host']}:{PG['port']}/{PG['db']}"
    )
elif DB_BACKEND == "mysql":
    MYSQL = {
        "host": os.getenv("MYSQL_HOST"),
        "port": os.getenv("MYSQL_PORT", "3306"),
        "db":   os.getenv("MYSQL_DB"),
        "user": os.getenv("MYSQL_USER"),
        "pass": os.getenv("MYSQL_PASS"),
    }
    # 這裡我們用 PyMySQL driver
    DB_URL = (
        f"mysql+pymysql://{MYSQL['user']}:{MYSQL['pass']}@"
        f"{MYSQL['host']}:{MYSQL['port']}/{MYSQL['db']}?charset=utf8mb4"
    )
else:
    raise ValueError(f"不支援的 DB_BACKEND: {DB_BACKEND}")

HEADERS = [
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/113.0.0.0 Safari/537.36"),
    ("Accept", "text/html,application/xhtml+xml,application/xml;"
               "q=0.9,image/avif,image/webp,*/*;q=0.8"),
    ("Accept-Language", "en-US,en;q=0.5"),
    ("Accept-Encoding", "gzip, deflate"),
    ("Connection", "keep-alive"),
]

engine = create_engine(DB_URL, echo=False)
Session = sessionmaker(bind=engine)
Base = declarative_base()

# 3. ORM Model
class IVODTranscript(Base):
    __tablename__ = "ivod_transcripts"
    ivod_id          = Column(Integer, primary_key=True)
    ivod_url         = Column(Text, nullable=False)
    date             = Column(Date,  nullable=False)
    meeting_code     = Column(Text)
    meeting_code_str = Column(Text)
    category         = Column(Text)
    video_type       = Column(Text)
    video_start      = Column(Text)
    video_end        = Column(Text)
    video_length     = Column(Text)
    video_url        = Column(Text)
    title            = Column(Text)
    speaker_name     = Column(Text)
    meeting_time     = Column(TIMESTAMP(timezone=True)) if DB_BACKEND!="sqlite" else Column(Text)
    meeting_name     = Column(Text)
    ai_transcript    = Column(Text)
    ly_transcript    = Column(Text)
    ai_status  = Column(Text,   nullable=False, default="pending")
    ai_retries = Column(Integer, nullable=False, default=0)
    ly_status  = Column(Text,   nullable=False, default="pending")
    ly_retries = Column(Integer, nullable=False, default=0)
    last_updated     = Column(TIMESTAMP(timezone=True), nullable=False) if DB_BACKEND!="sqlite" else Column(Text, nullable=False)
    if DB_BACKEND == "postgresql":
        committee_names = Column(ARRAY(Text))
    elif DB_BACKEND == "mysql":
        committee_names = Column(JSON)
    else:  # sqlite
        # SQLite 不支援 ARRAY
        committee_names = Column(Text)

# 確保資料表存在
Base.metadata.create_all(engine)

# 4. 工具函式
def date_range(start_date: str, end_date: str):
    dt0 = datetime.fromisoformat(start_date)
    dt1 = datetime.fromisoformat(end_date)
    for dt in rrule.rrule(rrule.DAILY, dtstart=dt0, until=dt1):
        yield dt.strftime("%Y-%m-%d")

def make_browser():
    br = mechanize.Browser()
    cj = cookiejar.LWPCookieJar()
    br.set_cookiejar(cj)
    br.set_handle_robots(False)
    br.set_handle_equiv(True)
    br.set_handle_redirect(True)
    br.set_handle_referer(True)
    br.set_ca_data(context=ssl._create_unverified_context(cert_reqs=ssl.CERT_NONE))
    br.addheaders = HEADERS
    return br

def fetch_ivod_list(br: mechanize.Browser, date_str: str):
    url = f"https://ly.govapi.tw/v2/ivods?日期={date_str}&limit=600"
    resp = br.open(url)
    raw = resp.read().decode('utf-8')
    js = json.loads(raw)
    return [int(i['IVOD_ID']) for i in js.get("ivods", [])]

def fetch_ai(js, rec, obj, db):
    try:
        ai_items = js.get("transcript", {}).get("whisperx", [])
        rec["ai_transcript"] = "".join(i.get("text","") for i in ai_items)
        rec["ai_status"] = "success"
    except Exception:
        rec["ai_transcript"] = ""
        rec["ai_status"] = "failed"
        # 如果已經有這筆，就累加 retries
        if obj:
            obj.ai_retries += 1
        else:
            rec["ai_retries"] = 1

def fetch_ly(js, rec, obj, br):
    try:
        if "gazette" in js:
            blocks = js["gazette"]["blocks"]
            rec["ly_transcript"] = "\n\n".join("\n".join(b) for b in blocks)
        else:
            sp = br.open(f"https://ivod.ly.gov.tw/Demand/Speech/{rec['ivod_id']}")
            soup = BeautifulSoup(sp.read(), "html.parser")
            e = soup.select_one(".speech-content")
            rec["ly_transcript"] = e.get_text("\n",strip=True) if e else ""
        rec["ly_status"] = "success"
    except Exception:
        rec["ly_transcript"] = ""
        rec["ly_status"] = "failed"
        if obj:
            obj.ly_retries += 1
        else:
            rec["ly_retries"] = 1

def process_ivod(br: mechanize.Browser, ivod_id: int):
    """抓取單支 IVOD 並回傳 dict"""
    resp = br.open(f"https://ly.govapi.tw/v2/ivods/{ivod_id}")
    raw = resp.read().decode('utf-8')
    js = json.loads(raw).get("data", {})
    md = js.get("會議資料", {})
    # 摘要欄位
    rec = {
        "ivod_id": ivod_id,
        "ivod_url": js.get("IVOD_URL"),
        "date": datetime.fromisoformat(js.get("日期")).date(),
        "meeting_code": md.get("會議代碼"),
        "meeting_code_str": md.get("會議代碼:str"),
        "category": md.get("種類"),
        "committee_names": js.get("會議資料",{}).get("委員會代碼:str", []),
        'video_type': js.get("影片種類"),
        'video_start': js.get("開始時間"),
        'video_end': js.get("結束時間"),
        'video_length': js.get('影片長度'),
        'video_url': js.get('video_url'),
        "title": md.get("標題"),
        "speaker_name": js.get("委員名稱"),
        "meeting_time": datetime.fromisoformat(js.get("會議時間")),
        "meeting_name": js.get("會議名稱"),
        # AI transcript
        "ai_transcript": "".join(item.get("text","") for item in js.get("transcript",{}).get("whisperx", [])),
    }
    if DB_BACKEND == "sqlite":
        rec["committee_names"] = json.dumps(rec["committee_names"])
    # 2. AI 逐字稿
    fetch_ai(js, rec, obj, db)

    # 3. 立院逐字稿
    fetch_ly(js, rec, obj, br)

    # 4. 最後把它塞進 DB（upsert）
    now = datetime.now()
    rec["last_updated"] = now if DB_BACKEND!="sqlite" else now.isoformat()
    return rec
