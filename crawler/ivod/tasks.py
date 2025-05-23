#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_tasks.py

將 full、incremental、retry 三種主要工作流程集中在此，供 ivod_full.py、ivod_incremental.py、ivod_retry.py 呼叫。
"""
import logging
from datetime import datetime, timedelta
import os

from tqdm import tqdm
try:
    from elasticsearch import Elasticsearch
except ImportError:
    Elasticsearch = None

from .core import date_range, make_browser, fetch_ivod_list, process_ivod, Session, IVODTranscript

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


def run_es():
    """
    更新 Elasticsearch 索引：將資料庫中的 ai_transcript 與 ly_transcript 欄位
    建立至 Elasticsearch 索引。使用 ES_HOST、ES_PORT、ES_SCHEME、ES_USER、ES_PASS、
    ES_INDEX 等環境變數進行連線，並採用 IK Analyzer 以改善繁體中文分詞。
    """
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    es_host = os.getenv("ES_HOST", "localhost")
    es_port = int(os.getenv("ES_PORT", 9200))
    es_scheme = os.getenv("ES_SCHEME", "http")
    es_user = os.getenv("ES_USER")
    es_pass = os.getenv("ES_PASS")
    es_index = os.getenv("ES_INDEX", "ivod_transcripts")

    auth = (es_user, es_pass) if es_user and es_pass else None
    es = Elasticsearch([{"host": es_host, "port": es_port, "scheme": es_scheme}], http_auth=auth)

    index_body = {
        "settings": {
            "analysis": {
                "analyzer": {
                    "chinese_analyzer": {
                        "tokenizer": "ik_max_word",
                        "filter": ["lowercase"]
                    }
                }
            }
        },
        "mappings": {
            "properties": {
                "ivod_id": {"type": "integer"},
                "ai_transcript": {"type": "text", "analyzer": "chinese_analyzer"},
                "ly_transcript": {"type": "text", "analyzer": "chinese_analyzer"},
                "title": {"type": "text", "analyzer": "chinese_analyzer"}
            }
        }
    }

    if not es.indices.exists(index=es_index):
        es.indices.create(index=es_index, body=index_body)

    db = Session()
    for obj in tqdm(db.query(IVODTranscript).all(), desc="Indexing to Elasticsearch"):
        doc = {
            "ivod_id": obj.ivod_id,
            "ai_transcript": obj.ai_transcript or "",
            "ly_transcript": obj.ly_transcript or "",
            "title": obj.title or ""
        }
        es.index(index=es_index, id=obj.ivod_id, body=doc)
    db.close()
    logger.info("Elasticsearch indexing 完成。")