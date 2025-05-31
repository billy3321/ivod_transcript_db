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


def run_full(skip_ssl: bool = True, start_date: str = None, end_date: str = None):
    """
    全量拉取：從指定起始日跑到指定結束日（或今天），逐筆 upsert 到資料庫。
    
    Args:
        skip_ssl: 是否跳過SSL驗證
        start_date: 自訂起始日期 (YYYY-MM-DD)，如果早於預設起始日期則使用預設值
        end_date: 自訂結束日期 (YYYY-MM-DD)，如果晚於今天則使用今天
    """
    setup_logging()
    
    # 檢查並確保資料庫表格存在
    logger.info("🔍 檢查資料庫狀況...")
    if not check_and_create_database_tables():
        logger.error("❌ 資料庫檢查失敗，停止執行")
        return False
    
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()

    # 預設起始和結束日期
    default_start = "2024-02-01"
    today = datetime.now().strftime("%Y-%m-%d")
    
    # 驗證和設定實際使用的日期範圍
    actual_start = _validate_date_range(start_date, end_date, default_start, today)
    actual_end = _validate_date_range(start_date, end_date, default_start, today, is_end_date=True)
    
    start, end = actual_start, actual_end
    
    logger.info(f"📅 日期範圍：{start} 至 {end}")
    if start_date and start_date != actual_start:
        logger.warning(f"⚠️  起始日期 {start_date} 早於預設起始日期，使用 {actual_start}")
    if end_date and end_date != actual_end:
        logger.warning(f"⚠️  結束日期 {end_date} 晚於今天，使用 {actual_end}")
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


def read_failed_ivods_from_file(error_log_path):
    """從錯誤記錄檔案讀取失敗的IVOD_ID列表"""
    failed_ivods = []
    if not os.path.exists(error_log_path):
        logger.warning(f"錯誤記錄檔案不存在: {error_log_path}")
        return failed_ivods
    
    with open(error_log_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                parts = line.split(',')
                if len(parts) >= 1:
                    try:
                        ivod_id = int(parts[0])
                        failed_ivods.append(ivod_id)
                    except ValueError:
                        logger.warning(f"無效的IVOD_ID格式: {parts[0]}")
    
    # 去重複
    return list(set(failed_ivods))


def remove_from_error_log(ivod_id, error_log_path):
    """從錯誤記錄檔案中移除成功處理的IVOD_ID"""
    if not os.path.exists(error_log_path):
        return
    
    # 讀取現有記錄
    lines = []
    with open(error_log_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # 過濾掉指定的IVOD_ID
    filtered_lines = []
    for line in lines:
        if line.strip():
            parts = line.strip().split(',')
            if len(parts) >= 1 and parts[0] != str(ivod_id):
                filtered_lines.append(line)
    
    # 寫回檔案
    with open(error_log_path, "w", encoding="utf-8") as f:
        f.writelines(filtered_lines)


def run_fix(ivod_ids=None, error_log_path=None, skip_ssl: bool = True):
    """
    修復失敗的IVOD記錄
    
    Args:
        ivod_ids: 指定要修復的IVOD_ID列表，如果為None且error_log_path為None則使用預設錯誤記錄檔案
        error_log_path: 錯誤記錄檔案路徑，如果指定則從檔案讀取失敗的IVOD_ID列表
        skip_ssl: 是否跳過SSL驗證
    
    Returns:
        bool: 執行是否成功
    """
    logger.info("開始 Fix 任務...")
    
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()
    
    # 確定要修復的IVOD列表
    if ivod_ids:
        # 直接使用指定的IVOD_ID列表
        target_ivods = ivod_ids
        logger.info(f"指定修復 {len(target_ivods)} 個IVOD記錄")
        
    else:
        # 從錯誤記錄檔案讀取
        if not error_log_path:
            error_log_path = os.getenv("ERROR_LOG_PATH", "logs/failed_ivods.txt")
        
        target_ivods = read_failed_ivods_from_file(error_log_path)
        if not target_ivods:
            logger.info("沒有找到需要修復的IVOD記錄")
            db.close()
            return True
        
        logger.info(f"從 {error_log_path} 找到 {len(target_ivods)} 個需要修復的IVOD記錄")
    
    success_count = 0
    failed_count = 0
    successfully_fixed_ids = []
    
    try:
        for ivod_id in tqdm(target_ivods, desc="修復IVOD記錄"):
            try:
                logger.info(f"開始處理IVOD_ID: {ivod_id}")
                rec = process_ivod(br, ivod_id)
                
                # 檢查是否已存在記錄
                obj = db.get(IVODTranscript, ivod_id)
                if obj:
                    # 更新現有記錄
                    for k, v in rec.items():
                        setattr(obj, k, v)
                    obj.last_updated = datetime.now()
                    logger.info(f"更新IVOD {ivod_id} 成功")
                else:
                    # 新增記錄
                    rec["last_updated"] = datetime.now()
                    db.add(IVODTranscript(**rec))
                    logger.info(f"新增IVOD {ivod_id} 成功")
                
                db.commit()
                success_count += 1
                successfully_fixed_ids.append(ivod_id)
                
                # 如果從錯誤記錄檔案讀取的，移除成功處理的記錄
                if not ivod_ids and error_log_path:
                    remove_from_error_log(ivod_id, error_log_path)
                
            except Exception as e:
                logger.error(f"處理IVOD {ivod_id} 失敗: {e}", exc_info=True)
                db.rollback()
                failed_count += 1
                # 重新記錄失敗
                log_failed_ivod(ivod_id, "fix_retry")
                continue
        
    finally:
        db.close()
    
    logger.info(f"修復完成 - 成功: {success_count}, 失敗: {failed_count}")
    
    # 檢查 Elasticsearch 是否可用，如果可用且有成功修復的記錄就批量更新索引
    if successfully_fixed_ids and check_elasticsearch_available():
        logger.info(f"🔄 開始自動更新 Elasticsearch 索引（修復的 {len(successfully_fixed_ids)} 筆記錄）...")
        try:
            es_success = run_es(ivod_ids=successfully_fixed_ids)
            if es_success:
                logger.info("✅ Elasticsearch 索引自動更新完成")
            else:
                logger.warning("⚠️  Elasticsearch 索引自動更新失敗")
        except Exception as e:
            logger.warning(f"⚠️  Elasticsearch 索引自動更新時發生錯誤: {e}")
    elif successfully_fixed_ids:
        logger.info(f"ℹ️  已修復 {len(successfully_fixed_ids)} 筆記錄，但 Elasticsearch 不可用")
    
    logger.info("Fix 任務完成。")
    return True


def run_backup(backup_file=None):
    """
    備份資料庫內容到 JSON 檔案
    
    Args:
        backup_file: 備份檔案路徑，如果為 None 則自動生成
    
    Returns:
        str: 備份檔案路徑，失敗時返回 None
    """
    logger.info("開始資料庫備份...")
    
    db = Session()
    
    try:
        # 自動生成備份檔案名
        if not backup_file:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_file = f"backup/ivod_backup_{timestamp}.json"
        
        # 確保備份目錄存在
        backup_dir = os.path.dirname(backup_file)
        if backup_dir and not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
            logger.info(f"建立備份目錄: {backup_dir}")
        
        # 查詢所有記錄
        records = db.query(IVODTranscript).all()
        record_count = len(records)
        
        if record_count == 0:
            logger.warning("資料庫中沒有記錄可備份")
            return None
        
        logger.info(f"找到 {record_count} 筆記錄，開始備份...")
        
        # 轉換為可序列化的格式
        backup_data = {
            "metadata": {
                "backup_time": datetime.now().isoformat(),
                "db_backend": DB_BACKEND,
                "record_count": record_count,
                "version": "1.0"
            },
            "data": []
        }
        
        for record in tqdm(records, desc="備份記錄"):
            record_dict = {
                "ivod_id": record.ivod_id,
                "ivod_url": record.ivod_url,
                "date": record.date.isoformat() if record.date else None,
                "meeting_code": record.meeting_code,
                "meeting_code_str": record.meeting_code_str,
                "meeting_name": record.meeting_name,
                "meeting_time": record.meeting_time.isoformat() if record.meeting_time else None,
                "title": record.title,
                "speaker_name": record.speaker_name,
                "video_length": record.video_length,
                "commencement_time": record.commencement_time,
                "video_url": record.video_url,
                "committee_names": record.committee_names,
                "ai_transcript": record.ai_transcript,
                "ai_status": record.ai_status,
                "ai_retries": record.ai_retries,
                "ly_transcript": record.ly_transcript,
                "ly_status": record.ly_status,
                "ly_retries": record.ly_retries,
                "last_updated": record.last_updated.isoformat() if record.last_updated else None
            }
            backup_data["data"].append(record_dict)
        
        # 寫入 JSON 檔案
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        
        file_size = os.path.getsize(backup_file) / (1024 * 1024)  # MB
        logger.info(f"✅ 備份完成: {backup_file}")
        logger.info(f"📊 備份統計: {record_count} 筆記錄，檔案大小: {file_size:.2f} MB")
        
        return backup_file
        
    except Exception as e:
        logger.error(f"備份失敗: {e}", exc_info=True)
        return None
    finally:
        db.close()


def run_restore(backup_file, force_create_table=False, force_clear_data=False):
    """
    從備份檔案還原資料庫
    
    Args:
        backup_file: 備份檔案路徑
        force_create_table: 強制建立資料表（不詢問）
        force_clear_data: 強制清除現有資料（不詢問）
    
    Returns:
        bool: 還原是否成功
    """
    logger.info(f"開始從備份檔案還原: {backup_file}")
    
    # 檢查備份檔案是否存在
    if not os.path.exists(backup_file):
        logger.error(f"備份檔案不存在: {backup_file}")
        return False
    
    try:
        # 讀取備份檔案
        with open(backup_file, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        # 驗證備份檔案格式
        if "metadata" not in backup_data or "data" not in backup_data:
            logger.error("備份檔案格式錯誤")
            return False
        
        metadata = backup_data["metadata"]
        records_data = backup_data["data"]
        
        logger.info(f"📊 備份檔案資訊:")
        logger.info(f"   - 備份時間: {metadata.get('backup_time')}")
        logger.info(f"   - 原始資料庫: {metadata.get('db_backend')}")
        logger.info(f"   - 記錄數量: {metadata.get('record_count')}")
        logger.info(f"   - 版本: {metadata.get('version')}")
        
        db = Session()
        
        try:
            # 檢查資料表是否存在
            table_exists = _check_table_exists(db)
            
            if not table_exists:
                if not force_create_table:
                    response = input("資料表不存在，是否要建立？(y/N): ").strip().lower()
                    if response not in ['y', 'yes']:
                        logger.info("使用者取消建立資料表")
                        return False
                
                logger.info("建立資料表...")
                from .db import Base, engine
                Base.metadata.create_all(engine)
                logger.info("✅ 資料表建立完成")
            
            # 檢查現有資料
            existing_count = db.query(IVODTranscript).count()
            
            if existing_count > 0:
                logger.warning(f"資料庫中已有 {existing_count} 筆記錄")
                
                if not force_clear_data:
                    response = input("是否要清除現有資料？(y/N): ").strip().lower()
                    if response not in ['y', 'yes']:
                        logger.info("使用者選擇保留現有資料，還原取消")
                        return False
                
                logger.info("清除現有資料...")
                db.query(IVODTranscript).delete()
                db.commit()
                logger.info("✅ 現有資料已清除")
            
            # 還原資料
            logger.info(f"開始還原 {len(records_data)} 筆記錄...")
            
            success_count = 0
            error_count = 0
            
            for record_data in tqdm(records_data, desc="還原記錄"):
                try:
                    # 轉換日期字段
                    if record_data.get("date"):
                        record_data["date"] = datetime.fromisoformat(record_data["date"]).date()
                    
                    if record_data.get("meeting_time"):
                        record_data["meeting_time"] = datetime.fromisoformat(record_data["meeting_time"])
                    
                    if record_data.get("last_updated"):
                        record_data["last_updated"] = datetime.fromisoformat(record_data["last_updated"])
                    
                    # 建立記錄
                    record = IVODTranscript(**record_data)
                    db.add(record)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"還原記錄失敗 (IVOD_ID: {record_data.get('ivod_id')}): {e}")
                    error_count += 1
                    continue
            
            # 提交所有變更
            db.commit()
            
            logger.info(f"✅ 還原完成")
            logger.info(f"📊 還原統計: 成功 {success_count} 筆，失敗 {error_count} 筆")
            
            return True
            
        except Exception as e:
            logger.error(f"還原過程發生錯誤: {e}", exc_info=True)
            db.rollback()
            return False
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"讀取備份檔案失敗: {e}", exc_info=True)
        return False


def _check_table_exists(db):
    """檢查 IVODTranscript 資料表是否存在"""
    try:
        # 嘗試查詢資料表，如果不存在會拋出異常
        db.query(IVODTranscript).limit(1).first()
        return True
    except Exception:
        return False


def _validate_date_range(start_date, end_date, default_start, today, is_end_date=False):
    """
    驗證日期範圍的輔助函數
    
    Args:
        start_date: 使用者指定的起始日期
        end_date: 使用者指定的結束日期
        default_start: 預設起始日期
        today: 今天的日期
        is_end_date: 是否為結束日期驗證
    
    Returns:
        str: 驗證後的日期
    """
    if is_end_date:
        # 驗證結束日期
        if not end_date:
            return today
        
        # 檢查日期格式
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            today_dt = datetime.strptime(today, "%Y-%m-%d")
        except ValueError:
            logger.error(f"❌ 結束日期格式錯誤: {end_date}，應為 YYYY-MM-DD")
            return today
        
        # 不可晚於今天
        if end_dt > today_dt:
            return today
        
        return end_date
    
    else:
        # 驗證起始日期
        if not start_date:
            return default_start
        
        # 檢查日期格式
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            default_dt = datetime.strptime(default_start, "%Y-%m-%d")
        except ValueError:
            logger.error(f"❌ 起始日期格式錯誤: {start_date}，應為 YYYY-MM-DD")
            return default_start
        
        # 不可早於預設起始日期
        if start_dt < default_dt:
            return default_start
        
        return start_date


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