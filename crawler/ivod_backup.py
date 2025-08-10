#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ivod_backup.py

IVOD 資料庫備份與還原工具
- 支援資料庫備份到 JSON 檔案
- 支援從 JSON 檔案還原資料庫
- 智能檢查和使用者互動確認
"""

import argparse
import sys
import os
from datetime import datetime

from ivod.tasks import run_backup, run_restore, setup_logging

def setup_environment(env="development"):
    """設定環境變數"""
    if env == "development":
        # 開發環境：不設定特殊環境變數，使用預設的 development 環境
        os.environ.pop("TESTING", None)
        os.environ.pop("DB_ENV", None)
        print(f"🔧 設定為 {env} 環境")
    elif env == "testing":
        # 測試環境
        os.environ["TESTING"] = "true"
        print(f"🔧 設定為 {env} 環境")
    elif env == "production":
        # 生產環境：設定 DB_ENV
        os.environ["DB_ENV"] = "production"
        os.environ.pop("TESTING", None)
        print(f"🔧 設定為 {env} 環境")
    else:
        raise ValueError(f"不支援的環境: {env}")

def main():
    parser = argparse.ArgumentParser(
        description="IVOD 資料庫備份與還原工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用範例:
  # 備份資料庫
  %(prog)s backup                                           # 備份 development 環境（預設）
  %(prog)s backup --env production                          # 備份 production 環境
  %(prog)s backup --file backup/my_backup.json             # 指定備份檔名
  
  # 還原資料庫
  %(prog)s restore backup/ivod_backup_20241201_143022.json  # 從備份檔還原
  %(prog)s restore backup/my_backup.json --force-create    # 強制建立資料表
  %(prog)s restore backup/my_backup.json --force-clear     # 強制清除現有資料
  %(prog)s restore backup/my_backup.json --force-all       # 強制執行所有操作
  
  # 列出備份檔案
  %(prog)s list                                             # 列出所有備份檔案
        """
    )
    
    # 添加全域環境選項
    parser.add_argument(
        '--env',
        choices=['development', 'production', 'testing'],
        default='development',
        help='選擇要操作的資料庫環境 (預設: development)'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 備份命令
    backup_parser = subparsers.add_parser('backup', help='備份資料庫到 JSON 檔案')
    backup_parser.add_argument(
        '--file', '-f',
        help='備份檔案路徑（不指定則自動生成）'
    )
    
    # 還原命令
    restore_parser = subparsers.add_parser('restore', help='從 JSON 檔案還原資料庫')
    restore_parser.add_argument(
        'backup_file',
        help='備份檔案路徑'
    )
    restore_parser.add_argument(
        '--force-create',
        action='store_true',
        help='強制建立資料表（不詢問）'
    )
    restore_parser.add_argument(
        '--force-clear',
        action='store_true',
        help='強制清除現有資料（不詢問）'
    )
    restore_parser.add_argument(
        '--force-all',
        action='store_true',
        help='強制執行所有操作（不詢問）'
    )
    
    # 列表命令
    list_parser = subparsers.add_parser('list', help='列出備份檔案')
    list_parser.add_argument(
        '--backup-dir',
        default='backup',
        help='備份目錄路徑（預設: backup）'
    )
    
    args = parser.parse_args()
    
    # 設定環境變數
    setup_environment(args.env)
    
    # 設置日誌
    setup_logging()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        if args.command == 'backup':
            # 執行備份
            print("🔄 開始備份資料庫...")
            backup_file = run_backup(args.file)
            
            if backup_file:
                print(f"✅ 備份成功完成: {backup_file}")
                sys.exit(0)
            else:
                print("❌ 備份失敗")
                sys.exit(1)
        
        elif args.command == 'restore':
            # 執行還原
            print(f"🔄 開始從備份檔案還原: {args.backup_file}")
            
            # 處理強制選項
            force_create = args.force_create or args.force_all
            force_clear = args.force_clear or args.force_all
            
            success = run_restore(
                backup_file=args.backup_file,
                force_create_table=force_create,
                force_clear_data=force_clear
            )
            
            if success:
                print("✅ 還原成功完成")
                sys.exit(0)
            else:
                print("❌ 還原失敗")
                sys.exit(1)
        
        elif args.command == 'list':
            # 列出備份檔案
            list_backup_files(args.backup_dir)
            
    except KeyboardInterrupt:
        print("\n⚠️  使用者中斷操作")
        sys.exit(130)
    except Exception as e:
        print(f"❌ 未預期的錯誤: {e}", file=sys.stderr)
        sys.exit(1)


def list_backup_files(backup_dir):
    """列出備份目錄中的所有備份檔案"""
    if not os.path.exists(backup_dir):
        print(f"備份目錄不存在: {backup_dir}")
        return
    
    # 尋找 JSON 備份檔案
    backup_files = []
    for filename in os.listdir(backup_dir):
        if filename.endswith('.json') and 'backup' in filename.lower():
            filepath = os.path.join(backup_dir, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                backup_files.append({
                    'filename': filename,
                    'filepath': filepath,
                    'size': stat.st_size,
                    'mtime': datetime.fromtimestamp(stat.st_mtime)
                })
    
    if not backup_files:
        print(f"在 {backup_dir} 目錄中沒有找到備份檔案")
        return
    
    # 按修改時間排序（最新的在前）
    backup_files.sort(key=lambda x: x['mtime'], reverse=True)
    
    print(f"📁 在 {backup_dir} 目錄中找到 {len(backup_files)} 個備份檔案:")
    print()
    
    for i, backup_file in enumerate(backup_files, 1):
        size_mb = backup_file['size'] / (1024 * 1024)
        mtime_str = backup_file['mtime'].strftime("%Y-%m-%d %H:%M:%S")
        
        print(f"{i:2d}. {backup_file['filename']}")
        print(f"     路徑: {backup_file['filepath']}")
        print(f"     大小: {size_mb:.2f} MB")
        print(f"     時間: {mtime_str}")
        print()
    
    print("💡 使用方式:")
    print(f"   ./ivod_backup.py restore {backup_files[0]['filepath']}")


if __name__ == "__main__":
    main()