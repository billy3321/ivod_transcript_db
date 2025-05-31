#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_tasks.py

將 full、incremental、retry 三種主要工作流程集中在此，供 ivod_full.py、ivod_incremental.py、ivod_retry.py 呼叫。
"""
import logging
from datetime import datetime, timedelta
import os
from pathlib import Path

from tqdm import tqdm
try:
    from elasticsearch import Elasticsearch
except ImportError:
    Elasticsearch = None

from .core import date_range, make_browser, fetch_ivod_list, process_ivod, Session, IVODTranscript
from .db import DB_BACKEND, engine, Base

logger = logging.getLogger(__name__)

def check_and_create_database_tables():
    """
    檢查資料庫連線狀況並確保表格存在
    """
    from sqlalchemy import inspect, text
    
    try:
        # 檢查資料庫連線
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            logger.info(f"✅ 資料庫連線成功 (Backend: {DB_BACKEND})")
        
        # 檢查表格是否存在
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if 'ivod_transcripts' not in tables:
            logger.info("⚠️  ivod_transcripts 表格不存在，正在創建...")
            Base.metadata.create_all(engine)
            logger.info("✅ 表格創建成功")
        else:
            logger.info("✅ ivod_transcripts 表格已存在")
            
            # 檢查表格結構
            columns = inspector.get_columns('ivod_transcripts')
            logger.info(f"✅ 表格包含 {len(columns)} 個欄位")
            
            # 檢查現有記錄數
            with Session() as session:
                count = session.query(IVODTranscript).count()
                logger.info(f"✅ 現有記錄數: {count}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ 資料庫檢查失敗: {e}")
        return False

def log_failed_ivod(ivod_id, error_type="general"):
    """記錄失敗的IVOD_ID到錯誤日誌檔案"""
    error_log_path = os.getenv("ERROR_LOG_PATH", "logs/failed_ivods.txt")
    error_dir = Path(error_log_path).parent
    error_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(error_log_path, "a", encoding="utf-8") as f:
        f.write(f"{ivod_id},{error_type},{timestamp}\n")

def setup_logging():
    """設置日誌配置 - 成功消息只記錄到文件，錯誤消息同時顯示在控制台和記錄到文件"""
    log_path = os.getenv("LOG_PATH", "logs/")
    log_dir = Path(log_path)
    log_dir.mkdir(exist_ok=True)
    
    log_file = log_dir / f"crawler_{datetime.now().strftime('%Y%m%d')}.log"
    
    # 清除現有的handlers以避免重複設置
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    # 創建文件handler，記錄所有級別的日誌
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    file_handler.setFormatter(file_formatter)
    
    # 創建控制台handler，只顯示ERROR和WARNING級別
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.WARNING)
    console_formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    console_handler.setFormatter(console_formatter)
    
    # 配置root logger
    logging.basicConfig(
        level=logging.INFO,
        handlers=[file_handler, console_handler]
    )


def run_full(skip_ssl: bool = True):
    """
    全量拉取：從固定起始日跑到今天，逐筆 upsert 到資料庫。
    """
    setup_logging()
    
    # 檢查並確保資料庫表格存在
    logger.info("🔍 檢查資料庫狀況...")
    if not check_and_create_database_tables():
        logger.error("❌ 資料庫檢查失敗，停止執行")
        return False
    
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
            try:
                logger.info(f"處理影片 {ivod_id}")
                rec = process_ivod(br, ivod_id)
                
                # Check if record exists
                obj = db.query(IVODTranscript).filter_by(ivod_id=ivod_id).first()
                if obj:
                    # Update existing record
                    for k, v in rec.items():
                        setattr(obj, k, v)
                    obj.last_updated = datetime.now()
                else:
                    # Create new record
                    rec["last_updated"] = datetime.now()
                    db.add(IVODTranscript(**rec))
                
                # Commit this single record
                db.commit()
                logger.info(f"影片 {ivod_id} 處理完成")
                
            except Exception as e:
                logger.error(f"處理影片 {ivod_id} 時發生錯誤: {e}", exc_info=True)
                # Rollback any pending changes for this record
                db.rollback()
                log_failed_ivod(ivod_id, "processing")
                continue
    db.close()
    logger.info("全量拉取完成。")
    
    # 檢查 Elasticsearch 是否可用，如果可用就自動更新索引
    if check_elasticsearch_available():
        logger.info("🔄 開始自動更新 Elasticsearch 索引...")
        try:
            es_success = run_es(full_mode=True)
            if es_success:
                logger.info("✅ Elasticsearch 索引自動更新完成")
            else:
                logger.warning("⚠️  Elasticsearch 索引自動更新失敗")
        except Exception as e:
            logger.warning(f"⚠️  Elasticsearch 索引自動更新時發生錯誤: {e}")
    
    return True


def run_incremental(skip_ssl: bool = True):
    """
    增量更新：只檢查過去兩週的新 ID，並針對缺漏的 AI 或 LY 逐字稿進行補抓。
    """
    setup_logging()
    
    # 檢查並確保資料庫表格存在
    logger.info("🔍 檢查資料庫狀況...")
    if not check_and_create_database_tables():
        logger.error("❌ 資料庫檢查失敗，停止執行")
        return False
    
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
        try:
            logger.info(f"增量更新影片 {ivod_id}")
            obj = db.get(IVODTranscript, ivod_id)
            if not obj:
                rec = process_ivod(br, ivod_id)
                rec["last_updated"] = datetime.now()
                db.add(IVODTranscript(**rec))
                logger.info(f"新增影片 {ivod_id}")
                continue
            if not obj.ai_transcript:
                rec = process_ivod(br, ivod_id)
                obj.ai_transcript = rec["ai_transcript"]
                obj.last_updated = datetime.now()
                logger.info(f"更新影片 {ivod_id} AI逐字稿")
            if not obj.ly_transcript:
                rec = process_ivod(br, ivod_id)
                obj.ly_transcript = rec["ly_transcript"]
                obj.last_updated = datetime.now()
                logger.info(f"更新影片 {ivod_id} LY逐字稿")
        except Exception as e:
            logger.error(f"增量更新影片 {ivod_id} 時發生錯誤: {e}", exc_info=True)
            log_failed_ivod(ivod_id, "incremental")
            continue

    db.commit()
    db.close()
    logger.info("增量更新完成。")
    
    # 檢查 Elasticsearch 是否可用，如果可用就自動更新索引（增量模式）
    if check_elasticsearch_available():
        logger.info("🔄 開始自動更新 Elasticsearch 索引（增量模式）...")
        try:
            es_success = run_es()  # 使用預設增量模式
            if es_success:
                logger.info("✅ Elasticsearch 索引自動更新完成")
            else:
                logger.warning("⚠️  Elasticsearch 索引自動更新失敗")
        except Exception as e:
            logger.warning(f"⚠️  Elasticsearch 索引自動更新時發生錯誤: {e}")
    
    return True


def run_retry(skip_ssl: bool = True):
    """
    重新嘗試失敗的任務：AI 或 LY 逐字稿之前發生錯誤，且重試次數尚未超過上限。
    """
    setup_logging()
    
    # 檢查並確保資料庫表格存在
    logger.info("🔍 檢查資料庫狀況...")
    if not check_and_create_database_tables():
        logger.error("❌ 資料庫檢查失敗，停止執行")
        return False
    
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

    # 記錄成功重試的 IVOD IDs
    successfully_retried_ids = []

    for obj in to_retry:
        try:
            logger.info(f"重試影片 {obj.ivod_id}")
            rec = process_ivod(br, obj.ivod_id)
            # Update the existing object with new data
            for k, v in rec.items():
                setattr(obj, k, v)
            obj.last_updated = datetime.now()
            db.commit()
            successfully_retried_ids.append(obj.ivod_id)
            logger.info(f"重試影片 {obj.ivod_id} 完成")
        except Exception as e:
            logger.error(f"重試影片 {obj.ivod_id} 時發生錯誤: {e}", exc_info=True)
            log_failed_ivod(obj.ivod_id, "retry")
            continue

    db.close()
    logger.info("Retry 任務完成。")
    
    # 檢查 Elasticsearch 是否可用，如果可用且有成功重試的記錄就自動更新索引
    if successfully_retried_ids and check_elasticsearch_available():
        logger.info(f"🔄 開始自動更新 Elasticsearch 索引（重試的 {len(successfully_retried_ids)} 筆記錄）...")
        try:
            es_success = run_es(ivod_ids=successfully_retried_ids)
            if es_success:
                logger.info("✅ Elasticsearch 索引自動更新完成")
            else:
                logger.warning("⚠️  Elasticsearch 索引自動更新失敗")
        except Exception as e:
            logger.warning(f"⚠️  Elasticsearch 索引自動更新時發生錯誤: {e}")
    elif successfully_retried_ids:
        logger.info(f"ℹ️  已重試 {len(successfully_retried_ids)} 筆記錄，但 Elasticsearch 不可用")
    
    return True


def check_elasticsearch_available():
    """
    檢查 Elasticsearch 是否可用
    返回 True 如果 ES 正常運作，False 如果不可用
    """
    # Check if Elasticsearch is explicitly disabled
    es_enabled = os.getenv("ENABLE_ELASTICSEARCH", "true").lower() != "false"
    if not es_enabled:
        logger.info("ℹ️  Elasticsearch 已被 ENABLE_ELASTICSEARCH=false 停用，跳過 ES 索引更新")
        return False
        
    if Elasticsearch is None:
        logger.info("ℹ️  Elasticsearch 套件未安裝，跳過 ES 索引更新")
        return False
        
    es_host = os.getenv("ES_HOST", "localhost")
    es_port = int(os.getenv("ES_PORT", 9200))
    es_scheme = os.getenv("ES_SCHEME", "http")
    es_user = os.getenv("ES_USER")
    es_pass = os.getenv("ES_PASS")

    auth = (es_user, es_pass) if es_user and es_pass else None
    
    try:
        es = Elasticsearch([{"host": es_host, "port": es_port, "scheme": es_scheme}], http_auth=auth)
        
        # 測試連線
        if es.ping():
            logger.info(f"✅ Elasticsearch 可用: {es_host}:{es_port}")
            return True
        else:
            logger.info(f"ℹ️  無法連線到 Elasticsearch: {es_host}:{es_port}，跳過 ES 索引更新")
            return False
            
    except Exception as e:
        logger.info(f"ℹ️  Elasticsearch 連線失敗: {e}，跳過 ES 索引更新")
        return False


def _compare_es_document(es, es_index, db_obj):
    """
    比較 Elasticsearch 中的文件與資料庫記錄是否一致
    返回 True 如果需要更新，False 如果已是最新
    """
    try:
        es_doc = es.get(index=es_index, id=db_obj.ivod_id)
        es_source = es_doc['_source']
        
        # 比較關鍵欄位
        db_ai = db_obj.ai_transcript or ""
        db_ly = db_obj.ly_transcript or ""
        db_title = db_obj.title or ""
        
        es_ai = es_source.get('ai_transcript', "")
        es_ly = es_source.get('ly_transcript', "")
        es_title = es_source.get('title', "")
        
        # 如果任何欄位不同，就需要更新
        return not (db_ai == es_ai and db_ly == es_ly and db_title == es_title)
        
    except Exception:
        # 如果文件不存在或其他錯誤，需要索引
        return True


def run_es(ivod_ids=None, full_mode=False):
    """
    智能更新 Elasticsearch 索引：
    - 比較資料庫與 ES 中的內容，只更新有差異的記錄
    - 支援指定 ivod_ids 進行選擇性更新
    - 支援 full_mode 進行完整資料庫比對
    
    參數:
    - ivod_ids: 可選的 IVOD ID 列表，僅處理指定的記錄
    - full_mode: 是否進行完整資料庫比對 (預設 False)
    """
    setup_logging()
    
    # Check if Elasticsearch is explicitly disabled
    es_enabled = os.getenv("ENABLE_ELASTICSEARCH", "true").lower() != "false"
    if not es_enabled:
        logger.info("ℹ️  Elasticsearch 已被 ENABLE_ELASTICSEARCH=false 停用，跳過索引更新")
        return True  # Return True since this is expected behavior, not an error
    
    if Elasticsearch is None:
        logger.error("❌ Elasticsearch 未安裝，請執行: pip install elasticsearch")
        return False
        
    es_host = os.getenv("ES_HOST", "localhost")
    es_port = int(os.getenv("ES_PORT", 9200))
    es_scheme = os.getenv("ES_SCHEME", "http")
    es_user = os.getenv("ES_USER")
    es_pass = os.getenv("ES_PASS")
    es_index = os.getenv("ES_INDEX", "ivod_transcripts")

    auth = (es_user, es_pass) if es_user and es_pass else None
    
    try:
        es = Elasticsearch([{"host": es_host, "port": es_port, "scheme": es_scheme}], http_auth=auth)
        
        # 測試連線
        if not es.ping():
            logger.error(f"❌ 無法連線到 Elasticsearch: {es_host}:{es_port}")
            return False
            
        logger.info(f"✅ 已連線到 Elasticsearch: {es_host}:{es_port}")
        
    except Exception as e:
        logger.error(f"❌ Elasticsearch 連線失敗: {e}")
        return False

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
                "title": {"type": "text", "analyzer": "chinese_analyzer"},
                "last_updated": {"type": "date"}
            }
        }
    }

    # 確保索引存在
    try:
        if not es.indices.exists(index=es_index):
            es.indices.create(index=es_index, body=index_body)
            logger.info(f"✅ 已創建 Elasticsearch 索引: {es_index}")
        else:
            logger.info(f"✅ Elasticsearch 索引已存在: {es_index}")
    except Exception as e:
        logger.error(f"❌ 創建索引失敗: {e}")
        return False

    db = Session()
    
    try:
        # 決定要處理的記錄
        if ivod_ids:
            # 處理指定的 IVOD IDs
            query = db.query(IVODTranscript).filter(IVODTranscript.ivod_id.in_(ivod_ids))
            desc = f"處理指定的 {len(ivod_ids)} 筆記錄"
            logger.info(f"🔍 選擇性更新模式: 處理 {len(ivod_ids)} 筆指定記錄")
        elif full_mode:
            # 完整資料庫比對模式
            query = db.query(IVODTranscript)
            desc = "完整資料庫比對"
            logger.info("🔍 完整比對模式: 檢查所有資料庫記錄")
        else:
            # 預設：只處理最近更新的記錄 (過去7天)
            seven_days_ago = datetime.now() - timedelta(days=7)
            query = db.query(IVODTranscript).filter(IVODTranscript.last_updated >= seven_days_ago)
            desc = "處理近期更新記錄"
            logger.info("🔍 增量更新模式: 處理過去7天更新的記錄")
        
        records = query.all()
        logger.info(f"📊 找到 {len(records)} 筆候選記錄")
        
        if not records:
            logger.info("ℹ️  沒有記錄需要處理")
            return True
        
        # 批次處理記錄
        updated_count = 0
        skipped_count = 0
        error_count = 0
        batch_size = 100
        batch_docs = []
        
        for obj in tqdm(records, desc=desc):
            try:
                # 檢查是否需要更新
                needs_update = _compare_es_document(es, es_index, obj)
                
                if not needs_update:
                    skipped_count += 1
                    continue
                
                # 準備文件內容
                doc = {
                    "ivod_id": obj.ivod_id,
                    "ai_transcript": obj.ai_transcript or "",
                    "ly_transcript": obj.ly_transcript or "",
                    "title": obj.title or "",
                    "last_updated": obj.last_updated.isoformat() if obj.last_updated else None
                }
                
                batch_docs.append({
                    "index": {
                        "_index": es_index,
                        "_id": obj.ivod_id
                    }
                })
                batch_docs.append(doc)
                
                # 當批次滿了就執行批次索引
                if len(batch_docs) >= batch_size * 2:  # 每個文件有兩個項目
                    try:
                        response = es.bulk(body=batch_docs)
                        if response.get('errors'):
                            logger.warning(f"⚠️  批次索引部分失敗")
                            for item in response['items']:
                                if 'index' in item and item['index'].get('error'):
                                    error_count += 1
                                    logger.error(f"索引失敗 ID {item['index']['_id']}: {item['index']['error']}")
                                else:
                                    updated_count += 1
                        else:
                            updated_count += len(batch_docs) // 2
                        
                        batch_docs = []
                    except Exception as e:
                        logger.error(f"❌ 批次索引失敗: {e}")
                        error_count += len(batch_docs) // 2
                        batch_docs = []
                        
            except Exception as e:
                logger.error(f"❌ 處理記錄 {obj.ivod_id} 時發生錯誤: {e}")
                error_count += 1
                continue
        
        # 處理最後一批
        if batch_docs:
            try:
                response = es.bulk(body=batch_docs)
                if response.get('errors'):
                    logger.warning(f"⚠️  最後批次索引部分失敗")
                    for item in response['items']:
                        if 'index' in item and item['index'].get('error'):
                            error_count += 1
                            logger.error(f"索引失敗 ID {item['index']['_id']}: {item['index']['error']}")
                        else:
                            updated_count += 1
                else:
                    updated_count += len(batch_docs) // 2
            except Exception as e:
                logger.error(f"❌ 最後批次索引失敗: {e}")
                error_count += len(batch_docs) // 2
        
        # 記錄統計結果
        logger.info(f"✅ Elasticsearch 索引更新完成:")
        logger.info(f"   - 已更新: {updated_count} 筆")
        logger.info(f"   - 已跳過: {skipped_count} 筆 (內容相同)")
        logger.info(f"   - 失敗: {error_count} 筆")
        logger.info(f"   - 總計處理: {updated_count + skipped_count + error_count} 筆")
        
        return error_count == 0
        
    finally:
        db.close()