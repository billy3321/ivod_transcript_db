#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_tasks.py

將 full、incremental、retry 三種主要工作流程集中在此，供 ivod_full.py、ivod_incremental.py、ivod_retry.py 呼叫。
"""
import json
import logging
from datetime import datetime, timedelta
import os
from pathlib import Path

from tqdm import tqdm
try:
    from elasticsearch import Elasticsearch
except ImportError:
    Elasticsearch = None

from .core import date_range, make_browser, fetch_ivod_list, process_ivod
from .db import (
    DB_BACKEND, engine, Base, Session, IVODTranscript,
    check_and_create_database_tables,
    check_elasticsearch_available, run_elasticsearch_indexing
)

logger = logging.getLogger(__name__)

# check_and_create_database_tables 函數已移至 db.py 中

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
            es_success = run_elasticsearch_indexing(full_mode=True)
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
            es_success = run_elasticsearch_indexing()  # 使用預設增量模式
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
            es_success = run_elasticsearch_indexing(ivod_ids=successfully_retried_ids)
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
            es_success = run_elasticsearch_indexing(ivod_ids=successfully_fixed_ids)
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
                "video_start": record.video_start,
                "video_end": record.video_end,
                "video_type": record.video_type,
                "category": record.category,
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


# Elasticsearch functions have been moved to db.py
# This maintains backward compatibility for existing code
def run_es(ivod_ids=None, full_mode=False):
    """
    舊版 run_es 函數的相容性包裝器
    實際功能已移至 db.py 的 run_elasticsearch_indexing 函數
    """
    setup_logging()
    return run_elasticsearch_indexing(ivod_ids=ivod_ids, full_mode=full_mode)