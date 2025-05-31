#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_full.py

全量抓取腳本：從指定起始日期到結束日期進行完整的資料抓取
- 預設從 2024-02-01 到今天
- 支援自訂日期範圍（有安全限制）
"""

import argparse
import sys
from datetime import datetime

from ivod.tasks import run_full

def main():
    parser = argparse.ArgumentParser(
        description="IVOD全量抓取腳本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用範例:
  %(prog)s                                    # 預設範圍（2024-02-01 至今天）
  %(prog)s --start-date 2024-03-01            # 指定起始日期
  %(prog)s --end-date 2024-12-31              # 指定結束日期
  %(prog)s --start-date 2024-03-01 --end-date 2024-03-31  # 指定日期範圍
  
注意事項:
  - 起始日期不可早於 2024-02-01
  - 結束日期不可晚於今天
  - 日期格式：YYYY-MM-DD
        """
    )
    
    parser.add_argument(
        '--start-date', 
        help='起始日期 (YYYY-MM-DD)，不可早於 2024-02-01'
    )
    
    parser.add_argument(
        '--end-date', 
        help='結束日期 (YYYY-MM-DD)，不可晚於今天'
    )
    
    parser.add_argument(
        '--skip-ssl', 
        action='store_true', 
        default=True, 
        help='跳過SSL驗證'
    )
    
    args = parser.parse_args()
    
    # 驗證日期格式
    if args.start_date:
        try:
            datetime.strptime(args.start_date, "%Y-%m-%d")
        except ValueError:
            print(f"❌ 起始日期格式錯誤: {args.start_date}，應為 YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)
    
    if args.end_date:
        try:
            datetime.strptime(args.end_date, "%Y-%m-%d")
        except ValueError:
            print(f"❌ 結束日期格式錯誤: {args.end_date}，應為 YYYY-MM-DD", file=sys.stderr)
            sys.exit(1)
    
    # 顯示執行模式
    if args.start_date or args.end_date:
        start_display = args.start_date or "2024-02-01"
        end_display = args.end_date or "今天"
        print(f"🔍 自訂日期範圍模式：{start_display} 至 {end_display}")
    else:
        print("🔍 預設全量模式：2024-02-01 至今天")
    
    # 執行全量抓取
    try:
        success = run_full(
            skip_ssl=args.skip_ssl,
            start_date=args.start_date,
            end_date=args.end_date
        )
        if success:
            print("✅ 全量抓取成功")
            sys.exit(0)
        else:
            print("❌ 全量抓取失敗")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  用戶中斷操作")
        sys.exit(130)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
