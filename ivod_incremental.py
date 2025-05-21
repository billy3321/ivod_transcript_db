#!/usr/bin/env python3
# ivod_incremental.py

import logging
import requests
from datetime import datetime, timedelta
from tqdm import tqdm

from ivod_core import (
    date_range, fetch_ivod_list, process_ivod,
    Session, IVODTranscript
)

# Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ivod_inc")

def recent_ids(http):
    today = datetime.now().date()
    two_weeks_ago = today - timedelta(days=14)
    ids = set()
    for d in date_range(two_weeks_ago.isoformat(), today.isoformat()):
        try:
            ids.update(fetch_ivod_list(http, d))
        except:
            continue
    return ids

def run_incremental():
    http = requests.Session()
    db   = Session()
    ids  = recent_ids(http)

    for ivod_id in tqdm(ids, desc="增量更新影片"):
        obj = db.get(IVODTranscript, ivod_id)

        # 1. 完全不存在 → 整筆拉取
        if not obj:
            rec = process_ivod(http, ivod_id)
            rec["last_updated"] = datetime.now()
            db.add(IVODTranscript(**rec))
            continue

        # 2. ai_transcript 缺失
        if not obj.ai_transcript:
            rec = process_ivod(http, ivod_id)
            obj.ai_transcript  = rec["ai_transcript"]
            obj.last_updated    = datetime.now()

        # 3. ly_transcript 缺失
        if not obj.ly_transcript:
            rec = process_ivod(http, ivod_id)
            obj.ly_transcript  = rec["ly_transcript"]
            obj.last_updated   = datetime.now()

    db.commit()
    db.close()
    logger.info("增量更新完成。")

if __name__ == "__main__":
    run_incremental()
