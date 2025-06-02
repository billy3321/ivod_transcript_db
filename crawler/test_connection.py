#!/usr/bin/env python3
"""
資料庫和Elasticsearch連線測試腳本

此腳本會測試：
1. 資料庫連線能力（支援SQLite、PostgreSQL、MySQL）
2. 檢查各環境（production、development、testing）的資料表是否存在
3. 驗證表格結構是否正確
4. 測試Elasticsearch連線和設定
5. 提供互動式表格建立功能

使用方法：
    python test_connection.py
    python test_connection.py --env production
    python test_connection.py --create-tables
    python test_connection.py --test-elasticsearch
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional

# 設定日誌格式
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

def setup_environment():
    """設定環境變數和模組路徑"""
    # 加入當前目錄到 Python 路徑
    current_dir = Path(__file__).parent.absolute()
    if str(current_dir) not in sys.path:
        sys.path.insert(0, str(current_dir))
    
    # 載入環境變數
    from dotenv import load_dotenv
    load_dotenv()

def test_database_connection(env: str = None) -> Dict[str, bool]:
    """
    測試資料庫連線
    
    Args:
        env: 指定測試環境 ('production', 'development', 'testing')
        
    Returns:
        測試結果字典
    """
    try:
        from ivod.database_env import get_database_config, get_database_environment
        from sqlalchemy import create_engine, text
        
        # 如果沒有指定環境，測試所有環境
        environments = [env] if env else ['production', 'development', 'testing']
        results = {}
        
        print("\n" + "="*60)
        print("🔗 資料庫連線測試")
        print("="*60)
        
        db_backend = os.getenv("DB_BACKEND", "sqlite").lower()
        print(f"📂 資料庫後端: {db_backend.upper()}")
        
        for test_env in environments:
            print(f"\n📊 測試環境: {test_env}")
            print("-" * 30)
            
            try:
                # 獲取環境特定的資料庫設定
                db_config = get_database_config(test_env)
                db_url = db_config["url"]
                
                print(f"🔗 連線字串: {db_url}")
                
                # 測試連線
                engine = create_engine(db_url, echo=False)
                with engine.connect() as conn:
                    result = conn.execute(text("SELECT 1"))
                    row = result.fetchone()
                    if row and row[0] == 1:
                        print(f"✅ {test_env} 環境連線成功")
                        results[test_env] = True
                    else:
                        print(f"❌ {test_env} 環境連線測試失敗")
                        results[test_env] = False
                
            except Exception as e:
                print(f"❌ {test_env} 環境連線失敗: {e}")
                results[test_env] = False
        
        return results
        
    except Exception as e:
        logger.error(f"資料庫連線測試失敗: {e}")
        return {}

def check_table_existence(env: str = None) -> Dict[str, Dict[str, any]]:
    """
    檢查各環境的資料表是否存在及狀態
    
    Args:
        env: 指定檢查環境
        
    Returns:
        環境表格狀態字典
    """
    try:
        from ivod.database_env import get_database_config
        from sqlalchemy import create_engine, inspect, text
        from sqlalchemy.orm import sessionmaker
        
        environments = [env] if env else ['production', 'development', 'testing']
        results = {}
        
        print("\n" + "="*60)
        print("📋 資料表狀態檢查")
        print("="*60)
        
        for test_env in environments:
            print(f"\n📊 檢查環境: {test_env}")
            print("-" * 30)
            
            try:
                # 獲取環境設定
                db_config = get_database_config(test_env)
                engine = create_engine(db_config["url"], echo=False)
                
                # 檢查表格是否存在
                inspector = inspect(engine)
                tables = inspector.get_table_names()
                
                table_info = {
                    'exists': 'ivod_transcripts' in tables,
                    'columns': [],
                    'record_count': 0,
                    'error': None
                }
                
                if table_info['exists']:
                    print(f"✅ ivod_transcripts 表格存在")
                    
                    # 獲取欄位資訊
                    columns = inspector.get_columns('ivod_transcripts')
                    table_info['columns'] = [col['name'] for col in columns]
                    print(f"📝 表格欄位數: {len(columns)}")
                    
                    # 檢查記錄數
                    try:
                        Session = sessionmaker(bind=engine)
                        with Session() as session:
                            # 直接執行 SQL 查詢避免 ORM 模組導入問題
                            result = session.execute(text("SELECT COUNT(*) FROM ivod_transcripts"))
                            count = result.scalar()
                            table_info['record_count'] = count
                            print(f"📊 記錄數: {count:,}")
                    except Exception as e:
                        print(f"⚠️  無法查詢記錄數: {e}")
                        table_info['error'] = str(e)
                else:
                    print(f"❌ ivod_transcripts 表格不存在")
                
                results[test_env] = table_info
                
            except Exception as e:
                print(f"❌ {test_env} 環境檢查失敗: {e}")
                results[test_env] = {'exists': False, 'error': str(e)}
        
        return results
        
    except Exception as e:
        logger.error(f"資料表檢查失敗: {e}")
        return {}

def test_elasticsearch_connection(env: str = None) -> Dict[str, bool]:
    """
    測試Elasticsearch連線和設定
    
    Args:
        env: 指定測試環境
        
    Returns:
        測試結果字典
    """
    try:
        from ivod.database_env import get_elasticsearch_config
        
        environments = [env] if env else ['production', 'development', 'testing']
        results = {}
        
        print("\n" + "="*60)
        print("🔍 Elasticsearch 連線測試")
        print("="*60)
        
        # 檢查是否已停用 Elasticsearch
        es_enabled = os.getenv("ENABLE_ELASTICSEARCH", "true").lower() != "false"
        if not es_enabled:
            print("ℹ️  Elasticsearch 已被 ENABLE_ELASTICSEARCH=false 停用")
            return {}
        
        # 檢查 Elasticsearch 模組是否可用
        try:
            from elasticsearch import Elasticsearch
        except ImportError:
            print("❌ Elasticsearch 模組未安裝")
            print("   請執行: pip install elasticsearch")
            return {}
        
        for test_env in environments:
            print(f"\n📊 測試環境: {test_env}")
            print("-" * 30)
            
            try:
                # 獲取 ES 設定
                es_config = get_elasticsearch_config(test_env)
                
                print(f"🔗 ES 主機: {es_config['host']}:{es_config['port']}")
                print(f"📁 ES 索引: {es_config['index']}")
                
                # 建立連線
                auth = (es_config["user"], es_config["password"]) if es_config["user"] and es_config["password"] else None
                if auth:
                    print(f"🔐 使用認證: {es_config['user']}:***")
                
                es = Elasticsearch([{
                    "host": es_config["host"], 
                    "port": es_config["port"], 
                    "scheme": es_config["scheme"]
                }], http_auth=auth)
                
                # 測試連線
                if es.ping():
                    print(f"✅ {test_env} 環境 ES 連線成功")
                    
                    # 檢查索引是否存在
                    index_name = es_config["index"]
                    if es.indices.exists(index=index_name):
                        print(f"✅ 索引 '{index_name}' 存在")
                        
                        # 獲取索引統計
                        try:
                            stats = es.indices.stats(index=index_name)
                            doc_count = stats['indices'][index_name]['total']['docs']['count']
                            print(f"📊 索引文件數: {doc_count:,}")
                        except Exception as e:
                            print(f"⚠️  無法獲取索引統計: {e}")
                    else:
                        print(f"⚠️  索引 '{index_name}' 不存在")
                    
                    results[test_env] = True
                else:
                    print(f"❌ {test_env} 環境 ES ping 失敗")
                    results[test_env] = False
                    
            except Exception as e:
                print(f"❌ {test_env} 環境 ES 連線失敗: {e}")
                results[test_env] = False
        
        return results
        
    except Exception as e:
        logger.error(f"Elasticsearch 測試失敗: {e}")
        return {}

def create_missing_tables(env: str = None) -> bool:
    """
    為指定環境建立缺失的資料表
    
    Args:
        env: 指定環境，如果為 None 則詢問使用者
        
    Returns:
        是否成功建立表格
    """
    try:
        from ivod.database_env import get_database_config
        from sqlalchemy import create_engine
        
        if env is None:
            print("\n可用環境:")
            print("1. production")
            print("2. development")
            print("3. testing")
            
            choice = input("\n請選擇要建立表格的環境 (1-3): ").strip()
            env_map = {'1': 'production', '2': 'development', '3': 'testing'}
            env = env_map.get(choice)
            
            if not env:
                print("❌ 無效選擇")
                return False
        
        print(f"\n🔨 為 {env} 環境建立資料表...")
        
        # 獲取環境設定
        db_config = get_database_config(env)
        engine = create_engine(db_config["url"], echo=False)
        
        # 動態載入模組以設定正確的環境
        original_env = os.environ.get('DB_ENV')
        try:
            # 設定環境變數
            if env == 'production':
                os.environ['DB_ENV'] = 'production'
            elif env == 'testing':
                os.environ['TESTING'] = 'true'
            # development 是預設值，不需要特別設定
            
            # 重新載入模組
            import importlib
            from ivod import db
            importlib.reload(db)
            
            # 建立表格
            db.Base.metadata.create_all(engine)
            print(f"✅ {env} 環境表格建立成功")
            
            # 驗證表格是否建立成功
            from sqlalchemy import inspect
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            if 'ivod_transcripts' in tables:
                columns = inspector.get_columns('ivod_transcripts')
                print(f"✅ 表格驗證成功，包含 {len(columns)} 個欄位")
                return True
            else:
                print("❌ 表格建立失敗：無法找到 ivod_transcripts")
                return False
                
        finally:
            # 恢復原始環境變數
            if original_env:
                os.environ['DB_ENV'] = original_env
            elif 'DB_ENV' in os.environ:
                del os.environ['DB_ENV']
            if 'TESTING' in os.environ:
                del os.environ['TESTING']
    
    except Exception as e:
        logger.error(f"建立表格失敗: {e}")
        return False

def interactive_create_tables():
    """互動式表格建立功能"""
    print("\n" + "="*60)
    print("🔨 互動式表格建立")
    print("="*60)
    
    # 先檢查表格狀態
    table_status = check_table_existence()
    
    missing_envs = []
    for env, info in table_status.items():
        if not info.get('exists', False):
            missing_envs.append(env)
    
    if not missing_envs:
        print("\n✅ 所有環境的表格都已存在，無需建立")
        return
    
    print(f"\n⚠️  以下環境缺少表格: {', '.join(missing_envs)}")
    
    while missing_envs:
        print(f"\n缺少表格的環境: {', '.join(missing_envs)}")
        choice = input("請選擇要建立表格的環境 (或輸入 'all' 建立所有, 'skip' 跳過): ").strip().lower()
        
        if choice == 'skip':
            break
        elif choice == 'all':
            for env in missing_envs:
                create_missing_tables(env)
            break
        elif choice in missing_envs:
            if create_missing_tables(choice):
                missing_envs.remove(choice)
        else:
            print("❌ 無效選擇，請重新輸入")

def print_summary(db_results: Dict, table_results: Dict, es_results: Dict):
    """列印測試結果摘要"""
    print("\n" + "="*60)
    print("📊 測試結果摘要")
    print("="*60)
    
    environments = set(list(db_results.keys()) + list(table_results.keys()) + list(es_results.keys()))
    
    for env in sorted(environments):
        print(f"\n📂 {env.upper()} 環境:")
        print("-" * 20)
        
        # 資料庫連線狀態
        db_status = "✅" if db_results.get(env) else "❌"
        print(f"  🔗 資料庫連線: {db_status}")
        
        # 表格狀態
        table_info = table_results.get(env, {})
        table_status = "✅" if table_info.get('exists') else "❌"
        record_count = table_info.get('record_count', 0)
        print(f"  📋 資料表存在: {table_status}")
        if table_info.get('exists'):
            print(f"      記錄數: {record_count:,}")
        
        # ES 狀態
        es_status = "✅" if es_results.get(env) else "❌" if env in es_results else "⚠️"
        status_text = {
            "✅": "正常",
            "❌": "失敗", 
            "⚠️": "未測試"
        }[es_status]
        print(f"  🔍 Elasticsearch: {es_status} ({status_text})")

def main():
    """主函數"""
    parser = argparse.ArgumentParser(description='資料庫和Elasticsearch連線測試腳本')
    parser.add_argument('--env', choices=['production', 'development', 'testing'],
                       help='指定測試環境')
    parser.add_argument('--create-tables', action='store_true',
                       help='互動式建立缺失的表格')
    parser.add_argument('--test-db', action='store_true',
                       help='只測試資料庫連線')
    parser.add_argument('--test-elasticsearch', action='store_true',
                       help='只測試Elasticsearch')
    parser.add_argument('--test-tables', action='store_true',
                       help='只檢查表格狀態')
    
    args = parser.parse_args()
    
    print("🔧 IVOD Transcript 資料庫連線測試工具")
    print("=" * 60)
    
    # 設定環境
    setup_environment()
    
    # 根據參數執行相應測試
    db_results = {}
    table_results = {}
    es_results = {}
    
    if args.create_tables:
        interactive_create_tables()
        return
    
    if args.test_db or not any([args.test_elasticsearch, args.test_tables]):
        db_results = test_database_connection(args.env)
    
    if args.test_tables or not any([args.test_db, args.test_elasticsearch]):
        table_results = check_table_existence(args.env)
    
    if args.test_elasticsearch or not any([args.test_db, args.test_tables]):
        es_results = test_elasticsearch_connection(args.env)
    
    # 列印摘要
    if db_results or table_results or es_results:
        print_summary(db_results, table_results, es_results)
    
    # 檢查是否有需要建立的表格
    missing_tables = any(
        not info.get('exists', False) 
        for info in table_results.values()
    )
    
    if missing_tables and not args.create_tables:
        print(f"\n💡 提示: 發現缺失的表格，可使用 --create-tables 參數互動式建立")

if __name__ == "__main__":
    main()