#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_fix.py

補抓腳本：用於重新抓取失敗的IVOD記錄
支援兩種模式：
1. 從錯誤記錄檔案批量重抓
2. 直接指定IVOD_ID進行單一重抓
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from tqdm import tqdm

# 加入當前目錄到 Python 路徑
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ivod.core import make_browser, process_ivod, Session, IVODTranscript
from ivod.tasks import setup_logging, log_failed_ivod, run_es, check_elasticsearch_available

logger = logging.getLogger(__name__)

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

def read_failed_ivods(error_log_path):
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

def fix_single_ivod_without_es(ivod_id, skip_ssl=True):
    """修復單一IVOD記錄（不更新ES，用於批量處理）"""
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()
    
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
        return True
        
    except Exception as e:
        logger.error(f"處理IVOD {ivod_id} 失敗: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()

def fix_single_ivod(ivod_id, skip_ssl=True):
    """修復單一IVOD記錄"""
    br = make_browser(skip_ssl=skip_ssl)
    db = Session()
    
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
        
        # 檢查 Elasticsearch 是否可用，如果可用就自動更新索引
        if check_elasticsearch_available():
            logger.info(f"🔄 開始自動更新 Elasticsearch 索引（IVOD {ivod_id}）...")
            try:
                es_success = run_es(ivod_ids=[ivod_id])
                if es_success:
                    logger.info("✅ Elasticsearch 索引自動更新完成")
                else:
                    logger.warning("⚠️  Elasticsearch 索引自動更新失敗")
            except Exception as e:
                logger.warning(f"⚠️  Elasticsearch 索引自動更新時發生錯誤: {e}")
        else:
            logger.info(f"ℹ️  已修復 IVOD {ivod_id}，但 Elasticsearch 不可用")
        
        return True
        
    except Exception as e:
        logger.error(f"處理IVOD {ivod_id} 失敗: {e}", exc_info=True)
        db.rollback()
        return False
    finally:
        db.close()

def fix_from_file(error_log_path, skip_ssl=True):
    """從錯誤記錄檔案批量修復IVOD記錄"""
    failed_ivods = read_failed_ivods(error_log_path)
    
    if not failed_ivods:
        logger.info("沒有找到需要修復的IVOD記錄")
        return
    
    logger.info(f"找到 {len(failed_ivods)} 個需要修復的IVOD記錄")
    
    success_count = 0
    failed_count = 0
    successfully_fixed_ids = []
    
    for ivod_id in tqdm(failed_ivods, desc="修復IVOD記錄"):
        # 使用沒有ES更新的單一記錄修復版本，批次處理後統一更新ES
        if fix_single_ivod_without_es(ivod_id, skip_ssl):
            success_count += 1
            successfully_fixed_ids.append(ivod_id)
            # 從錯誤記錄檔案中移除成功處理的記錄
            remove_from_error_log(ivod_id, error_log_path)
        else:
            failed_count += 1
            # 重新記錄失敗
            log_failed_ivod(ivod_id, "fix_retry")
    
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

def main():
    parser = argparse.ArgumentParser(description="IVOD補抓腳本")
    parser.add_argument("--file", "-f", help="從錯誤記錄檔案批量修復")
    parser.add_argument("--ivod-id", "-i", type=int, help="指定IVOD_ID進行單一修復")
    parser.add_argument("--skip-ssl", action="store_true", default=True, help="跳過SSL驗證")
    parser.add_argument("--error-log", default=None, help="指定錯誤記錄檔案路徑")
    
    args = parser.parse_args()
    
    # 設置日誌
    setup_logging()
    
    # 確定錯誤記錄檔案路徑
    if args.error_log:
        error_log_path = args.error_log
    else:
        error_log_path = os.getenv("ERROR_LOG_PATH", "logs/failed_ivods.txt")
    
    if args.file or (not args.ivod_id):
        # 從檔案模式
        if args.file:
            error_log_path = args.file
        fix_from_file(error_log_path, args.skip_ssl)
    
    elif args.ivod_id:
        # 單一IVOD_ID模式
        success = fix_single_ivod(args.ivod_id, args.skip_ssl)
        if success:
            logger.info(f"IVOD {args.ivod_id} 修復成功")
        else:
            logger.error(f"IVOD {args.ivod_id} 修復失敗")
            log_failed_ivod(args.ivod_id, "manual_fix")
            sys.exit(1)
    
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()