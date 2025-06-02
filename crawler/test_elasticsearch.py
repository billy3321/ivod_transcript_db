#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_elasticsearch.py

簡單的 Elasticsearch 連線與功能測試腳本
測試基本的連線、寫入、讀取和刪除操作
"""

import os
import sys
import json
from datetime import datetime
from dotenv import load_dotenv

try:
    from elasticsearch import Elasticsearch
except ImportError:
    print("❌ Elasticsearch 套件未安裝")
    print("請執行: pip install elasticsearch")
    sys.exit(1)

def load_es_config():
    """從環境變數載入 Elasticsearch 設定"""
    load_dotenv()
    
    config = {
        'host': os.getenv("ES_HOST", "localhost"),
        'port': int(os.getenv("ES_PORT", 9200)),
        'scheme': os.getenv("ES_SCHEME", "http"),
        'user': os.getenv("ES_USER"),
        'password': os.getenv("ES_PASS"),
        'index': os.getenv("ES_INDEX", "ivod_transcripts_test")
    }
    
    return config

def create_es_client(config):
    """建立 Elasticsearch 客戶端"""
    # 根據您的要求：不使用 http、沒有使用者帳戶密碼
    auth = None
    if config['user'] and config['password']:
        auth = (config['user'], config['password'])
    
    try:
        es = Elasticsearch(
            [{"host": config['host'], "port": config['port'], "scheme": config['scheme']}],
            http_auth=auth
        )
        return es
    except Exception as e:
        print(f"❌ 建立 Elasticsearch 客戶端失敗: {e}")
        return None

def test_connection(es):
    """測試 Elasticsearch 連線"""
    print("🔗 測試 Elasticsearch 連線...")
    
    try:
        if es.ping():
            print("✅ Elasticsearch 連線成功")
            
            # 獲取叢集資訊
            info = es.info()
            print(f"📊 Elasticsearch 版本: {info['version']['number']}")
            print(f"📊 叢集名稱: {info['cluster_name']}")
            return True
        else:
            print("❌ Elasticsearch 連線失敗 - ping() 返回 False")
            return False
            
    except Exception as e:
        print(f"❌ Elasticsearch 連線測試失敗: {e}")
        return False

def test_index_operations(es, index_name):
    """測試索引操作"""
    print(f"\n📁 測試索引操作 (索引: {index_name})...")
    
    try:
        # 檢查索引是否存在
        if es.indices.exists(index=index_name):
            print(f"⚠️  索引 {index_name} 已存在，將先刪除")
            es.indices.delete(index=index_name)
            print(f"🗑️  已刪除索引 {index_name}")
        
        # 建立索引
        index_body = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "chinese_analyzer": {
                            "type": "standard"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "ivod_id": {"type": "integer"},
                    "title": {"type": "text", "analyzer": "chinese_analyzer"},
                    "content": {"type": "text", "analyzer": "chinese_analyzer"},
                    "date": {"type": "date"},
                    "created_at": {"type": "date"}
                }
            }
        }
        
        es.indices.create(index=index_name, body=index_body)
        print(f"✅ 成功建立索引 {index_name}")
        return True
        
    except Exception as e:
        print(f"❌ 索引操作失敗: {e}")
        return False

def test_document_operations(es, index_name):
    """測試文件操作（寫入、讀取、更新、刪除）"""
    print(f"\n📄 測試文件操作...")
    
    # 測試文件
    test_doc = {
        "ivod_id": 999999,
        "title": "測試會議記錄",
        "content": "這是一個 Elasticsearch 功能測試文件，包含中文內容測試。",
        "date": "2024-01-01",
        "created_at": datetime.now().isoformat()
    }
    
    try:
        # 1. 寫入文件
        print("📝 測試寫入文件...")
        result = es.index(index=index_name, id=test_doc["ivod_id"], body=test_doc)
        print(f"✅ 文件寫入成功: {result['result']}")
        
        # 強制重新整理索引以確保文件可被搜尋
        es.indices.refresh(index=index_name)
        
        # 2. 讀取文件
        print("📖 測試讀取文件...")
        retrieved_doc = es.get(index=index_name, id=test_doc["ivod_id"])
        print(f"✅ 文件讀取成功: ID={retrieved_doc['_id']}")
        print(f"📋 文件標題: {retrieved_doc['_source']['title']}")
        
        # 3. 搜尋文件
        print("🔍 測試搜尋功能...")
        search_body = {
            "query": {
                "match": {
                    "content": "測試"
                }
            }
        }
        
        search_result = es.search(index=index_name, body=search_body)
        hits = search_result['hits']['total']['value']
        print(f"✅ 搜尋成功: 找到 {hits} 筆結果")
        
        # 4. 更新文件
        print("✏️  測試更新文件...")
        update_body = {
            "doc": {
                "content": "更新後的內容：Elasticsearch 測試成功！"
            }
        }
        
        es.update(index=index_name, id=test_doc["ivod_id"], body=update_body)
        print("✅ 文件更新成功")
        
        # 5. 驗證更新
        updated_doc = es.get(index=index_name, id=test_doc["ivod_id"])
        print(f"📋 更新後內容: {updated_doc['_source']['content']}")
        
        # 6. 刪除文件
        print("🗑️  測試刪除文件...")
        es.delete(index=index_name, id=test_doc["ivod_id"])
        print("✅ 文件刪除成功")
        
        return True
        
    except Exception as e:
        print(f"❌ 文件操作失敗: {e}")
        return False

def test_bulk_operations(es, index_name):
    """測試批量操作"""
    print(f"\n📦 測試批量操作...")
    
    # 準備測試資料
    test_docs = []
    for i in range(5):
        doc = {
            "ivod_id": 100000 + i,
            "title": f"批量測試文件 {i+1}",
            "content": f"這是第 {i+1} 個批量測試文件，用於測試 Elasticsearch 的批量處理功能。",
            "date": "2024-01-01",
            "created_at": datetime.now().isoformat()
        }
        test_docs.append(doc)
    
    try:
        # 準備批量操作的請求
        bulk_body = []
        for doc in test_docs:
            bulk_body.append({"index": {"_index": index_name, "_id": doc["ivod_id"]}})
            bulk_body.append(doc)
        
        # 執行批量寫入
        result = es.bulk(body=bulk_body)
        
        if result['errors']:
            print("⚠️  批量操作有部分錯誤")
            for item in result['items']:
                if 'error' in item.get('index', {}):
                    print(f"   錯誤: {item['index']['error']}")
        else:
            print(f"✅ 批量寫入成功: {len(test_docs)} 筆文件")
        
        # 重新整理索引
        es.indices.refresh(index=index_name)
        
        # 驗證文件數量
        count_result = es.count(index=index_name)
        print(f"📊 索引中文件總數: {count_result['count']}")
        
        return True
        
    except Exception as e:
        print(f"❌ 批量操作失敗: {e}")
        return False

def cleanup(es, index_name):
    """清理測試資料"""
    print(f"\n🧹 清理測試資料...")
    
    try:
        if es.indices.exists(index=index_name):
            es.indices.delete(index=index_name)
            print(f"✅ 已刪除測試索引: {index_name}")
        else:
            print(f"ℹ️  索引 {index_name} 不存在，無需清理")
            
    except Exception as e:
        print(f"⚠️  清理過程發生錯誤: {e}")

def main():
    """主要測試流程"""
    print("🚀 開始 Elasticsearch 功能測試")
    print("=" * 50)
    
    # 載入設定
    config = load_es_config()
    print(f"📝 使用設定:")
    print(f"   - 主機: {config['host']}")
    print(f"   - 埠號: {config['port']}")
    print(f"   - 協定: {config['scheme']}")
    print(f"   - 測試索引: {config['index']}")
    if config['user']:
        print(f"   - 使用者: {config['user']}")
    else:
        print("   - 無認證設定")
    
    # 建立客戶端
    es = create_es_client(config)
    if not es:
        sys.exit(1)
    
    # 測試流程
    tests_passed = 0
    total_tests = 4
    
    try:
        # 1. 連線測試
        if test_connection(es):
            tests_passed += 1
        
        # 2. 索引操作測試
        if test_index_operations(es, config['index']):
            tests_passed += 1
        
        # 3. 文件操作測試
        if test_document_operations(es, config['index']):
            tests_passed += 1
        
        # 4. 批量操作測試
        if test_bulk_operations(es, config['index']):
            tests_passed += 1
        
    finally:
        # 清理測試資料
        cleanup(es, config['index'])
    
    # 測試結果
    print("\n" + "=" * 50)
    print(f"🏁 測試完成: {tests_passed}/{total_tests} 項測試通過")
    
    if tests_passed == total_tests:
        print("🎉 所有測試都通過！Elasticsearch 功能正常")
        sys.exit(0)
    else:
        print("❌ 部分測試失敗，請檢查 Elasticsearch 設定")
        sys.exit(1)

if __name__ == "__main__":
    main()