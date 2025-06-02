
# 1. Configure DB URL from environment
import os
from dotenv import load_dotenv
from .database_env import get_database_config, get_database_environment, print_database_info

# Load environment variables from .env file
load_dotenv()

# 獲取資料庫環境設定
db_config = get_database_config()
db_env = get_database_environment()

# 設定資料庫連線
DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()
DB_URL = db_config["url"]

# 在非生產環境顯示資料庫環境資訊
if os.getenv("ENVIRONMENT") != "production":
    print_database_info()

# 2. SQLAlchemy setup
from sqlalchemy import (
    create_engine, Column, Integer, Text, Date, ARRAY, TIMESTAMP, JSON
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.dialects.postgresql import TEXT as PG_TEXT
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(DB_URL, echo=False)
Session = sessionmaker(bind=engine)
Base = declarative_base()

# 3. ORM Model
class IVODTranscript(Base):
    __tablename__ = "ivod_transcripts"
    ivod_id          = Column(Integer, primary_key=True)
    ivod_url         = Column(Text, nullable=False)
    date             = Column(Date,  nullable=False)
    meeting_code     = Column(Text)
    meeting_code_str = Column(Text)
    category         = Column(Text)
    video_type       = Column(Text)
    video_start      = Column(Text)
    video_end        = Column(Text)
    video_length     = Column(Text)
    video_url        = Column(Text)
    title            = Column(Text)
    speaker_name     = Column(Text)
    meeting_time     = Column(TIMESTAMP(timezone=True)) if DB_BACKEND!="sqlite" else Column(Text)
    meeting_name     = Column(Text)
    # Use appropriate text type for large content based on backend
    if DB_BACKEND == "mysql":
        ai_transcript = Column(LONGTEXT)
        ly_transcript = Column(LONGTEXT) 
    elif DB_BACKEND == "postgresql":
        ai_transcript = Column(PG_TEXT)  # PostgreSQL TEXT has no length limit
        ly_transcript = Column(PG_TEXT)
    else:  # sqlite
        ai_transcript = Column(Text)  # SQLite TEXT has no length limit
        ly_transcript = Column(Text)
    ai_status  = Column(Text,   nullable=False, default="pending")
    ai_retries = Column(Integer, nullable=False, default=0)
    ly_status  = Column(Text,   nullable=False, default="pending")
    ly_retries = Column(Integer, nullable=False, default=0)
    last_updated     = Column(TIMESTAMP(timezone=True), nullable=False) if DB_BACKEND!="sqlite" else Column(Text, nullable=False)
    if DB_BACKEND == "postgresql":
        committee_names = Column(ARRAY(Text))
    elif DB_BACKEND == "mysql":
        committee_names = Column(JSON)
    else:  # sqlite
        # SQLite does not support ARRAY
        committee_names = Column(Text)

import logging
from datetime import datetime, timedelta
from pathlib import Path
from tqdm import tqdm

try:
    from elasticsearch import Elasticsearch
except ImportError:
    Elasticsearch = None

logger = logging.getLogger(__name__)

# Database management functions
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

# Elasticsearch management functions
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
        
    from .database_env import get_elasticsearch_config
    
    es_config = get_elasticsearch_config()
    auth = (es_config["user"], es_config["password"]) if es_config["user"] and es_config["password"] else None
    
    try:
        es = Elasticsearch([{"host": es_config["host"], "port": es_config["port"], "scheme": es_config["scheme"]}], http_auth=auth)
        
        # 測試連線
        if es.ping():
            logger.info(f"✅ Elasticsearch 可用: {es_config['host']}:{es_config['port']}")
            return True
        else:
            logger.info(f"ℹ️  無法連線到 Elasticsearch: {es_config['host']}:{es_config['port']}，跳過 ES 索引更新")
            return False
            
    except Exception as e:
        logger.info(f"ℹ️  Elasticsearch 連線失敗: {e}，跳過 ES 索引更新")
        return False

def get_elasticsearch_client():
    """
    建立並返回 Elasticsearch 客戶端
    返回 (es_client, es_index) 或 (None, None) 如果連線失敗
    """
    if Elasticsearch is None:
        logger.error("❌ Elasticsearch 未安裝，請執行: pip install elasticsearch")
        return None, None
        
    from .database_env import get_elasticsearch_config
    
    es_config = get_elasticsearch_config()
    auth = (es_config["user"], es_config["password"]) if es_config["user"] and es_config["password"] else None
    
    try:
        es = Elasticsearch([{"host": es_config["host"], "port": es_config["port"], "scheme": es_config["scheme"]}], http_auth=auth)
        
        # 測試連線
        if not es.ping():
            logger.error(f"❌ 無法連線到 Elasticsearch: {es_config['host']}:{es_config['port']}")
            return None, None
            
        logger.info(f"✅ 已連線到 Elasticsearch: {es_config['host']}:{es_config['port']}")
        return es, es_config["index"]
        
    except Exception as e:
        logger.error(f"❌ Elasticsearch 連線失敗: {e}")
        return None, None

def create_elasticsearch_index(es, es_index):
    """
    建立 Elasticsearch 索引（如果不存在）
    """
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

    try:
        if not es.indices.exists(index=es_index):
            es.indices.create(index=es_index, body=index_body)
            logger.info(f"✅ 已創建 Elasticsearch 索引: {es_index}")
        else:
            logger.info(f"✅ Elasticsearch 索引已存在: {es_index}")
        return True
    except Exception as e:
        logger.error(f"❌ 創建索引失敗: {e}")
        return False

def compare_es_document(es, es_index, db_obj):
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

def bulk_index_to_elasticsearch(es, es_index, records, batch_size=100):
    """
    批量索引記錄到 Elasticsearch
    
    返回 (updated_count, skipped_count, error_count)
    """
    updated_count = 0
    skipped_count = 0
    error_count = 0
    batch_docs = []
    
    for obj in tqdm(records, desc="處理記錄"):
        try:
            # 檢查是否需要更新
            needs_update = compare_es_document(es, es_index, obj)
            
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
    
    return updated_count, skipped_count, error_count

def run_elasticsearch_indexing(ivod_ids=None, full_mode=False):
    """
    智能更新 Elasticsearch 索引：
    - 比較資料庫與 ES 中的內容，只更新有差異的記錄
    - 支援指定 ivod_ids 進行選擇性更新
    - 支援 full_mode 進行完整資料庫比對
    
    參數:
    - ivod_ids: 可選的 IVOD ID 列表，僅處理指定的記錄
    - full_mode: 是否進行完整資料庫比對 (預設 False)
    
    返回:
    - bool: 是否成功執行（無錯誤）
    """
    # Check if Elasticsearch is explicitly disabled
    es_enabled = os.getenv("ENABLE_ELASTICSEARCH", "true").lower() != "false"
    if not es_enabled:
        logger.info("ℹ️  Elasticsearch 已被 ENABLE_ELASTICSEARCH=false 停用，跳過索引更新")
        return True  # Return True since this is expected behavior, not an error
    
    # 建立 Elasticsearch 連線
    es, es_index = get_elasticsearch_client()
    if not es:
        return False
    
    # 確保索引存在
    if not create_elasticsearch_index(es, es_index):
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
        
        # 批量處理記錄
        updated_count, skipped_count, error_count = bulk_index_to_elasticsearch(es, es_index, records)
        
        # 記錄統計結果
        logger.info(f"✅ Elasticsearch 索引更新完成:")
        logger.info(f"   - 已更新: {updated_count} 筆")
        logger.info(f"   - 已跳過: {skipped_count} 筆 (內容相同)")
        logger.info(f"   - 失敗: {error_count} 筆")
        logger.info(f"   - 總計處理: {updated_count + skipped_count + error_count} 筆")
        
        return error_count == 0
        
    finally:
        db.close()

# Note: Tables will be created by check_and_create_database_tables() function
# when needed, rather than automatically on module import