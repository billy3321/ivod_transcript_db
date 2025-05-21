#!/usr/bin/env python3
# ivod_full.py

import logging
import requests
from datetime import datetime
from tqdm import tqdm

from ivod_core import (
    date_range, make_browser, fetch_ivod_list, process_ivod,
    Session, IVODTranscript
)

# Logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ivod_full")

def run_full():
    br = make_browser()
    db = Session()

    start, end = "2024-02-01", datetime.now().strftime("%Y-%m-%d")
    for date_str in tqdm(date_range(start, end), desc="日期"):
        try:
            ids = fetch_ivod_list(br, date_str)
        except Exception as e:
            logger.error(f"{date_str} 列表失敗: {e}"); continue

        for ivod_id in tqdm(ids, desc=f"{date_str} 影片", leave=False):
            # try:
            rec = process_ivod(br, ivod_id)
            # except Exception as e:
            #     logger.error(f"IVOD {ivod_id} 失敗: {e}"); continue
            print(rec)
            # Upsert
            obj = db.get(IVODTranscript, ivod_id)
            if obj:
                for k, v in rec.items(): setattr(obj, k, v)
                obj.last_updated = datetime.now()
            else:
                rec["last_updated"] = datetime.now()
                db.add(IVODTranscript(**rec))

        db.commit()
        logger.info(f"{date_str} 處理完成，共 {len(ids)} 筆")

    db.close()
    logger.info("全量拉取完成。")

if __name__ == "__main__":
    run_full()
