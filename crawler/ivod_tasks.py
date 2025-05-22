#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_tasks.py

將 full、incremental、retry 三種主要工作流程集中在此，供 ivod_full.py、ivod_incremental.py、ivod_retry.py 呼叫。
"""
import logging
from datetime import datetime, timedelta

from tqdm import tqdm

from ivod_core import date_range, make_browser, fetch_ivod_list, process_ivod, Session, IVODTranscript

logger = logging.getLogger(__name__)


def run_full(skip_ssl: bool = True):
    """
    全量拉取：從固定起始日跑到今天，逐筆 upsert 到資料庫。
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()

    start, end = "2024-02-01", datetime.now().strftime("%Y-%m-%d")
    for date_str in tqdm(date_range(start, end), desc="日期"):
        try:
            ids = fetch_ivod_list(br, date_str)
        except Exception as e:
            logger.error(f"{date_str} 列表失敗: {e}")
            continue

        for ivod_id in tqdm(ids, desc=f"{date_str} 影片", leave=False):
            rec = process_ivod(br, ivod_id)
            obj = db.get(IVODTranscript, ivod_id)
            if obj:
                for k, v in rec.items():
                    setattr(obj, k, v)
                obj.last_updated = datetime.now()
            else:
                rec["last_updated"] = datetime.now()
                db.add(IVODTranscript(**rec))

        db.commit()
    db.close()
    logger.info("全量拉取完成。")


def run_incremental(skip_ssl: bool = True):
    """
    增量更新：只檢查過去兩週的新 ID，並針對缺漏的 AI 或 LY 逐字稿進行補抓。
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()

    today = datetime.now().date()
    two_weeks_ago = today - timedelta(days=14)
    ids = set()
    for d in date_range(two_weeks_ago.isoformat(), today.isoformat()):
        try:
            ids.update(fetch_ivod_list(br, d))
        except Exception:
            continue

    for ivod_id in tqdm(ids, desc="增量更新影片"):
        obj = db.get(IVODTranscript, ivod_id)
        if not obj:
            rec = process_ivod(br, ivod_id)
            rec["last_updated"] = datetime.now()
            db.add(IVODTranscript(**rec))
            continue
        if not obj.ai_transcript:
            rec = process_ivod(br, ivod_id)
            obj.ai_transcript = rec["ai_transcript"]
            obj.last_updated = datetime.now()
        if not obj.ly_transcript:
            rec = process_ivod(br, ivod_id)
            obj.ly_transcript = rec["ly_transcript"]
            obj.last_updated = datetime.now()

    db.commit()
    db.close()
    logger.info("增量更新完成。")


def run_retry(skip_ssl: bool = True):
    """
    重新嘗試失敗的任務：AI 或 LY 逐字稿之前發生錯誤，且重試次數尚未超過上限。
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()

    MAX_RETRIES = 5
    to_retry = db.query(IVODTranscript).filter(
        IVODTranscript.ai_status == 'failed',
        IVODTranscript.ai_retries < MAX_RETRIES
    ).all()
    to_retry += db.query(IVODTranscript).filter(
        IVODTranscript.ly_status == 'failed',
        IVODTranscript.ly_retries < MAX_RETRIES
    ).all()

    for obj in to_retry:
        process_ivod(br, obj.ivod_id, db)
        db.commit()

    db.close()
    logger.info("Retry 任務完成。")