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
import sys

from ivod.tasks import run_fix

def main():
    parser = argparse.ArgumentParser(description="IVOD補抓腳本")
    parser.add_argument("--file", "-f", help="從錯誤記錄檔案批量修復")
    parser.add_argument("--ivod-id", "-i", type=int, help="指定IVOD_ID進行單一修復")
    parser.add_argument("--skip-ssl", action="store_true", default=True, help="跳過SSL驗證")
    parser.add_argument("--error-log", default=None, help="指定錯誤記錄檔案路徑")
    
    args = parser.parse_args()
    
    # 確定參數
    ivod_ids = None
    error_log_path = None
    
    if args.ivod_id:
        # 單一IVOD_ID模式
        ivod_ids = [args.ivod_id]
    elif args.file:
        # 指定檔案模式
        error_log_path = args.file
    elif args.error_log:
        # 指定錯誤記錄檔案路徑
        error_log_path = args.error_log
    # 如果都沒指定，run_fix 會使用預設的錯誤記錄檔案
    
    # 執行修復任務
    try:
        success = run_fix(
            ivod_ids=ivod_ids,
            error_log_path=error_log_path,
            skip_ssl=args.skip_ssl
        )
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  用戶中斷操作")
        sys.exit(130)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()