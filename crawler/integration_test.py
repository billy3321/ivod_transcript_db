#!/usr/bin/env python3
"""Integration test for crawler: reset DB and fetch specific IVOD transcripts."""

if __name__ != "__main__":
    import pytest
    pytest.skip("Integration test script - skip under pytest", allow_module_level=True)

import os
import sys
import json
import argparse
from datetime import datetime, date, timedelta

def setup_environment(env="development"):
    """設定環境變數"""
    if env == "development":
        # 開發環境：不設定特殊環境變數，使用預設的 development 環境
        os.environ.pop("TESTING", None)
        os.environ.pop("DB_ENV", None)
        print("🔧 設定為 development 環境")
    elif env == "testing":
        # 測試環境：保持原有邏輯
        os.environ["TESTING"] = "true"
        print("🔧 設定為 testing 環境")
    elif env == "production":
        # 生產環境：設定 DB_ENV
        os.environ["DB_ENV"] = "production"
        os.environ.pop("TESTING", None)
        print("🔧 設定為 production 環境")
    else:
        raise ValueError(f"不支援的環境: {env}")

def main():
    parser = argparse.ArgumentParser(description='IVOD Crawler Integration Test')
    parser.add_argument('--env', choices=['development', 'testing', 'production'], 
                       default='development',
                       help='選擇要測試的資料庫環境 (預設: development)')
    parser.add_argument('--no-reset', action='store_true',
                       help='不重置資料庫，保留現有資料')
    args = parser.parse_args()
    
    # 設定環境
    setup_environment(args.env)

    from dotenv import load_dotenv
    load_dotenv()
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    from tqdm import tqdm
    from ivod.core import (
        DB_BACKEND,
        make_browser,
        fetch_latest_date,
        fetch_ivod_list,
        process_ivod,
        Session,
        IVODTranscript,
    )
    from ivod.db import check_and_create_database_tables

    # 初始化資料庫連線並確認表格存在
    if not check_and_create_database_tables():
        print("❌ 資料庫初始化失敗")
        sys.exit(1)
    
    db = Session()
    bind = db.get_bind()
    print(f"⚙️ 使用的 DB URL: {bind.engine.url}")
    print(f"⚙️ 資料庫後端: {DB_BACKEND}")
    
    # 檢查是否要重置資料庫
    if not args.no_reset:
        existing_count = db.query(IVODTranscript).count()
        if existing_count > 0:
            print(f"⚠️ 發現資料庫中有 {existing_count} 筆現有記錄")
            print(f"⚠️ 即將重置資料庫（刪除所有現有記錄）")
            print(f"⚠️ 資料庫: {bind.engine.url}")
            
            # 要求使用者確認
            while True:
                confirm = input("確定要重置資料庫嗎？(y/N): ").strip().lower()
                if confirm in ['y', 'yes']:
                    print("🗑️ 重置資料庫中...")
                    db.query(IVODTranscript).delete()
                    db.commit()
                    print("✅ 資料庫已重置")
                    break
                elif confirm in ['n', 'no', '']:
                    print("❌ 取消重置資料庫")
                    print("💡 如果想保留現有資料，請使用 --no-reset 參數")
                    db.close()
                    sys.exit(0)
                else:
                    print("請輸入 y 或 n")
        else:
            print("🗑️ 重置資料庫（目前沒有記錄）...")
            print("✅ 資料庫已重置")
    else:
        existing_count = db.query(IVODTranscript).count()
        print(f"📊 保留現有資料，目前有 {existing_count} 筆記錄")

    # Prepare browser for HTTP requests
    br = make_browser(skip_ssl=True)

    # 1. Get the latest available IVOD date
    latest_date = fetch_latest_date(br)
    print(f"Latest available date: {latest_date}")

    scenario1_date = None
    for weeks_ago in range(2, 6):
        week_start = latest_date - timedelta(days=latest_date.weekday(), weeks=weeks_ago)
        candidate = week_start + timedelta(days=2)  # Wednesday
        ivod_ids_1 = fetch_ivod_list(br, candidate.isoformat())
        if len(ivod_ids_1) >= 4:
            scenario1_date = candidate
            print(f"Selected first scenario: {weeks_ago} weeks ago Wednesday {scenario1_date} ({len(ivod_ids_1)} IVODs)")
            break
    if not scenario1_date:
        print("Skipping first test scenario: no Wednesday with >=4 IVODs found in weeks 2-5 ago")

    scenario2_date = None
    weeks_ago = 10
    while True:
        week_start = latest_date - timedelta(days=latest_date.weekday(), weeks=weeks_ago)
        candidate = week_start + timedelta(days=2)
        ivod_ids_2 = fetch_ivod_list(br, candidate.isoformat())
        if len(ivod_ids_2) >= 4:
            scenario2_date = candidate
            print(f"Selected second scenario: {weeks_ago} weeks ago Wednesday {scenario2_date} ({len(ivod_ids_2)} IVODs)")
            break
        weeks_ago += 1

    test_cases = []
    if scenario1_date:
        test_cases.append({"date": scenario1_date, "expect_ly": False, "specific_id": None})
    if scenario2_date:
        test_cases.append({"date": scenario2_date, "expect_ly": True,  "specific_id": None})
    test_cases.extend([
        {"date": date(2025, 4, 9),   "expect_ly": True, "specific_id": 159939},
        {"date": date(2023, 12, 14), "expect_ly": True, "specific_id": 149022},
    ])

    for case in test_cases:
        dt = case["date"]
        date_str = dt.isoformat()
        print(f"\n--- Test date={date_str}, expect_ly={case['expect_ly']}, id={case['specific_id']} ---")

        try:
            ivod_ids = fetch_ivod_list(br, date_str)
            print(f"Fetched {len(ivod_ids)} IVOD IDs for date {date_str}")
        except Exception as e:
            print(f"Error fetching IVOD list for date {date_str}: {e}")
            print(f"URL: https://ly.govapi.tw/v2/ivods?日期={date_str}&limit=600")
            raise

        if case["specific_id"]:
            assert case["specific_id"] in ivod_ids, \
                f"IVOD {case['specific_id']} not found for date {date_str}"
            test_ids = [case["specific_id"]]
        else:
            assert len(ivod_ids) >= 5, \
                f"Expected at least 5 IVOD IDs for date {date_str}, got {len(ivod_ids)}"
            test_ids = [ivod_ids[3]]

        print(f"Inserting {len(ivod_ids)} IVODs for date {date_str} into database...")
        for ivod_id in tqdm(ivod_ids, desc=f"Processing IVODs for {date_str}", unit="ivod"):
            try:
                rec = process_ivod(br, ivod_id)
            except Exception as e:
                print(f"[ERROR] Fetching IVOD {ivod_id}: {e}")
                raise
            db.add(IVODTranscript(**rec))
        db.commit()

        errors = []
        for ivod_id in test_ids:
            obj = db.get(IVODTranscript, ivod_id)
            raw_url = f"https://dataly.openfun.app/collection/item/ivod/{ivod_id}/rawdata"
            speech_url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"
            if obj is None:
                print(f"[ERROR] IVOD {ivod_id}: Record not found in database")
                print(f"  Raw data URL: {raw_url}")
                errors.append(ivod_id)
                continue
            if not obj.ai_transcript:
                print(f"[ERROR] IVOD {ivod_id}: AI transcript missing")
                print(f"  Raw data URL: {raw_url}")
                errors.append(ivod_id)
            if case["expect_ly"]:
                if not obj.ly_transcript:
                    print(f"[ERROR] IVOD {ivod_id}: LY transcript missing")
                    print(f"  Raw data URL: {raw_url}")
                    print(f"  Speech URL: {speech_url}")
                    errors.append(ivod_id)
            else:
                if obj.ly_transcript:
                    print(f"[ERROR] IVOD {ivod_id}: Unexpected LY transcript present")
                    print(f"  Raw data URL: {raw_url}")
                    print(f"  Speech URL: {speech_url}")
                    errors.append(ivod_id)
        if errors:
            print(f"Validation errors for date {date_str}: {errors}")
        else:
            print(f"Test case for date {date_str} passed.")

    print("\nIntegration tests completed and database populated.")
    
    return args, db

if __name__ == "__main__":
    main()
else:
    # 為了向後相容，當作模組導入時使用原有邏輯
    setup_environment("development")
    
    from dotenv import load_dotenv
    load_dotenv()
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    from tqdm import tqdm
    from ivod.core import (
        DB_BACKEND,
        make_browser,
        fetch_latest_date,
        fetch_ivod_list,
        process_ivod,
        Session,
        IVODTranscript,
    )
    from ivod.db import check_and_create_database_tables
    
    # 原有的測試環境邏輯 - 確保表格存在
    if not check_and_create_database_tables():
        print("❌ 資料庫初始化失敗")
        sys.exit(1)
    
    db = Session()
    bind = db.get_bind()
    print("⚙️ 使用的 DB URL:", bind.engine.url)
    db.query(IVODTranscript).delete()
    db.commit()