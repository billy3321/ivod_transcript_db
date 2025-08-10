#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_es.py

智能 Elasticsearch 索引更新工具
- 預設模式：增量更新（過去7天的記錄）
- 完整模式：比對所有資料庫記錄與ES內容
- 選擇性模式：指定特定IVOD ID進行更新
"""

import argparse
import sys
from ivod.db import run_elasticsearch_indexing

def main():
    parser = argparse.ArgumentParser(
        description="智能更新 Elasticsearch 索引，只更新有差異的記錄",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用範例:
  %(prog)s                        # 增量更新模式（預設，過去7天）
  %(prog)s --full                 # 完整比對模式
  %(prog)s --ivod-ids 123 456 789 # 指定 IVOD ID 更新
  %(prog)s --ivod-ids-file ids.txt # 從檔案讀取 IVOD ID 列表
        """
    )
    
    parser.add_argument(
        '--full', 
        action='store_true',
        help='完整資料庫比對模式：檢查所有記錄與ES的差異'
    )
    
    parser.add_argument(
        '--ivod-ids',
        nargs='+',
        type=int,
        help='指定要更新的 IVOD ID 列表'
    )
    
    parser.add_argument(
        '--ivod-ids-file',
        help='從檔案讀取 IVOD ID 列表（每行一個ID）'
    )
    
    args = parser.parse_args()
    
    # 解析參數
    ivod_ids = None
    full_mode = args.full
    
    if args.ivod_ids and args.ivod_ids_file:
        print("❌ 錯誤：不能同時指定 --ivod-ids 和 --ivod-ids-file", file=sys.stderr)
        sys.exit(1)
    
    if args.ivod_ids:
        ivod_ids = args.ivod_ids
        print(f"🔍 選擇性更新模式：處理 {len(ivod_ids)} 筆指定記錄")
        
    elif args.ivod_ids_file:
        try:
            with open(args.ivod_ids_file, 'r') as f:
                ivod_ids = [int(line.strip()) for line in f if line.strip().isdigit()]
            print(f"📁 從檔案讀取 {len(ivod_ids)} 筆 IVOD ID")
        except Exception as e:
            print(f"❌ 讀取檔案失敗: {e}", file=sys.stderr)
            sys.exit(1)
    
    if full_mode and ivod_ids:
        print("❌ 錯誤：不能同時使用 --full 和指定 IVOD ID", file=sys.stderr)
        sys.exit(1)
    
    # 顯示運行模式
    if full_mode:
        print("🔍 完整比對模式：檢查所有資料庫記錄")
    elif ivod_ids:
        print(f"🔍 選擇性更新模式：處理 {len(ivod_ids)} 筆指定記錄")
    else:
        print("🔍 增量更新模式：處理過去7天更新的記錄")
    
    # 執行索引更新
    try:
        success = run_elasticsearch_indexing(ivod_ids=ivod_ids, full_mode=full_mode)
        if success:
            print("✅ Elasticsearch 索引更新成功")
            sys.exit(0)
        else:
            print("❌ Elasticsearch 索引更新失敗")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⚠️  使用者中斷操作")
        sys.exit(130)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()