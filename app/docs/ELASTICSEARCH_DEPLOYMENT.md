# Elasticsearch 部署指南

## 概述

本指南說明如何為 IVOD 逐字稿系統部署和配置 Elasticsearch，包括本地開發環境和生產環境的設定。

## 系統需求

### 最低硬體需求
- **記憶體**: 4GB RAM（建議 8GB 以上）
- **儲存空間**: 50GB 可用空間（根據資料量調整）
- **CPU**: 雙核心以上

### 軟體需求
- **Java**: OpenJDK 17 或 21（Elasticsearch 8.x 需求）
- **作業系統**: Ubuntu 20.04+, CentOS 8+, macOS, Windows

## 安裝 Elasticsearch

### Ubuntu/Debian 安裝

```bash
# 1. 安裝 Java
sudo apt update
sudo apt install openjdk-17-jdk

# 2. 匯入 Elasticsearch GPG 金鑰
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg

# 3. 新增 Elasticsearch 套件庫
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

# 4. 安裝 Elasticsearch
sudo apt update
sudo apt install elasticsearch

# 5. 啟動服務
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

### CentOS/RHEL 安裝

```bash
# 1. 安裝 Java
sudo yum install java-17-openjdk

# 2. 匯入 GPG 金鑰
sudo rpm --import https://artifacts.elastic.co/GPG-KEY-elasticsearch

# 3. 建立套件庫檔案
cat << EOF | sudo tee /etc/yum.repos.d/elasticsearch.repo
[elasticsearch]
name=Elasticsearch repository for 8.x packages
baseurl=https://artifacts.elastic.co/packages/8.x/yum
gpgcheck=1
gpgkey=https://artifacts.elastic.co/GPG-KEY-elasticsearch
enabled=0
autorefresh=1
type=rpm-md
EOF

# 4. 安裝 Elasticsearch
sudo yum install --enablerepo=elasticsearch elasticsearch

# 5. 啟動服務
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

### macOS 安裝（Homebrew）

```bash
# 1. 安裝 Elasticsearch
brew tap elastic/tap
brew install elastic/tap/elasticsearch-full

# 2. 啟動服務
brew services start elastic/tap/elasticsearch-full
```

### Docker 安裝

```bash
# 1. 建立 Docker 網路
docker network create elastic

# 2. 啟動 Elasticsearch 容器
docker run --name elasticsearch --net elastic \
  -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  -e "xpack.security.enrollment.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0
```

## 配置 Elasticsearch

### 基本配置檔案

編輯 `/etc/elasticsearch/elasticsearch.yml`：

```yaml
# 集群名稱
cluster.name: ivod-transcript-cluster

# 節點名稱
node.name: ivod-node-1

# 資料和日誌路徑
path.data: /var/lib/elasticsearch
path.logs: /var/log/elasticsearch

# 網路設定
network.host: localhost
http.port: 9200

# 探索設定（單節點）
discovery.type: single-node

# 記憶體設定
bootstrap.memory_lock: true

# 安全設定（開發環境）
xpack.security.enabled: false
xpack.security.enrollment.enabled: false
```

### JVM 記憶體設定

編輯 `/etc/elasticsearch/jvm.options.d/heap.options`：

```bash
# 設定 JVM heap 大小（建議為系統記憶體的一半）
# 範例：8GB 記憶體系統設定 4GB
-Xms4g
-Xmx4g
```

### 系統設定調整

```bash
# 1. 增加檔案描述符限制
echo "elasticsearch soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "elasticsearch hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 2. 增加記憶體映射限制
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. 停用 swap（可選，提升效能）
sudo swapoff -a
# 永久停用需編輯 /etc/fstab
```

## 中文分析器安裝

IVOD 系統需要中文分析器來處理繁體中文內容：

### 安裝 IK 中文分析器

```bash
# 1. 安裝 IK 分析器
sudo /usr/share/elasticsearch/bin/elasticsearch-plugin install https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v8.12.0/elasticsearch-analysis-ik-8.12.0.zip

# 2. 重啟 Elasticsearch
sudo systemctl restart elasticsearch

# 3. 驗證安裝
curl -X GET "localhost:9200/_cat/plugins?v"
```

### 安裝 SmartCN 分析器（替代方案）

```bash
# SmartCN 是 Elasticsearch 內建的中文分析器
sudo /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-smartcn

sudo systemctl restart elasticsearch
```

## IVOD 索引設定

### 建立 IVOD 索引

```bash
# 建立具有中文分析器的索引
curl -X PUT "localhost:9200/ivod_transcripts" -H "Content-Type: application/json" -d '
{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "chinese_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": ["lowercase"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "ivod_id": { "type": "integer" },
      "title": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "speaker_name": { 
        "type": "text",
        "analyzer": "chinese_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "meeting_name": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "committee_names": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "ly_transcript": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "ai_transcript": { 
        "type": "text",
        "analyzer": "chinese_analyzer"
      },
      "date": { "type": "date" },
      "category": { "type": "keyword" },
      "ivod_url": { "type": "keyword" }
    }
  }
}
'
```

### 驗證索引建立

```bash
# 檢查索引狀態
curl -X GET "localhost:9200/ivod_transcripts/_settings?pretty"

# 檢查映射
curl -X GET "localhost:9200/ivod_transcripts/_mapping?pretty"

# 測試中文分析
curl -X POST "localhost:9200/ivod_transcripts/_analyze?pretty" -H "Content-Type: application/json" -d '
{
  "analyzer": "chinese_analyzer",
  "text": "立法院第十一屆第二會期"
}
'
```

## 應用程式配置

### 環境變數設定

在 `app/.env` 中設定：

```bash
# Elasticsearch 設定
ENABLE_ELASTICSEARCH=true
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http

# 生產環境索引
ES_INDEX=ivod_transcripts

# 開發環境索引
ES_DEV_INDEX=ivod_dev_transcripts

# 測試環境索引
ES_TEST_INDEX=ivod_test_transcripts
```

### 驗證連線

```bash
# 測試應用程式連線
curl -X GET "http://localhost:3000/api/health"

# 檢查 Elasticsearch 健康狀態
curl -X GET "localhost:9200/_cluster/health?pretty"
```

## 資料索引

### 使用爬蟲建立索引

```bash
# 在 crawler 目錄中執行
cd ../crawler
source venv/bin/activate

# 建立 Elasticsearch 索引
./ivod_es.py

# 查看索引統計
curl -X GET "localhost:9200/ivod_transcripts/_stats?pretty"
```

### 重新建立索引

```bash
# 刪除現有索引
curl -X DELETE "localhost:9200/ivod_transcripts"

# 重新建立索引（使用上面的建立索引命令）
# 然後重新執行索引程序
./ivod_es.py
```

## 生產環境最佳實踐

### 安全設定

```yaml
# elasticsearch.yml 生產環境設定
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.http.ssl.enabled: true

# 設定密碼
xpack.security.authc.password_hashing.algorithm: bcrypt
```

```bash
# 設定內建使用者密碼
sudo /usr/share/elasticsearch/bin/elasticsearch-setup-passwords auto
```

### 效能調校

```yaml
# elasticsearch.yml 效能設定
indices.memory.index_buffer_size: 20%
indices.memory.min_index_buffer_size: 96mb
thread_pool.write.queue_size: 1000
```

### 監控設定

```bash
# 安裝 Elasticsearch 監控工具
sudo /usr/share/elasticsearch/bin/elasticsearch-plugin install x-pack

# 啟用監控
curl -X PUT "localhost:9200/_cluster/settings" -H "Content-Type: application/json" -d '
{
  "persistent": {
    "xpack.monitoring.collection.enabled": true
  }
}
'
```

### 備份設定

```bash
# 建立快照儲存庫
curl -X PUT "localhost:9200/_snapshot/backup_repository" -H "Content-Type: application/json" -d '
{
  "type": "fs",
  "settings": {
    "location": "/var/lib/elasticsearch/backup"
  }
}
'

# 建立快照
curl -X PUT "localhost:9200/_snapshot/backup_repository/snapshot_1"
```

## 故障排除

### 常見問題

#### Elasticsearch 無法啟動

```bash
# 檢查日誌
sudo journalctl -u elasticsearch -f

# 檢查配置
sudo /usr/share/elasticsearch/bin/elasticsearch -t

# 檢查 Java 版本
java -version
```

#### 記憶體不足

```bash
# 檢查 JVM 設定
cat /etc/elasticsearch/jvm.options.d/heap.options

# 監控記憶體使用
curl -X GET "localhost:9200/_nodes/stats/jvm?pretty"
```

#### 中文搜尋不準確

```bash
# 測試分析器
curl -X POST "localhost:9200/_analyze?pretty" -H "Content-Type: application/json" -d '
{
  "analyzer": "chinese_analyzer", 
  "text": "您的測試文字"
}
'

# 檢查索引映射
curl -X GET "localhost:9200/ivod_transcripts/_mapping?pretty"
```

### 效能監控

```bash
# 檢查集群健康
curl -X GET "localhost:9200/_cluster/health?pretty"

# 檢查節點狀態
curl -X GET "localhost:9200/_nodes/stats?pretty"

# 檢查索引狀態
curl -X GET "localhost:9200/_cat/indices?v"

# 監控搜尋效能
curl -X GET "localhost:9200/_cat/thread_pool/search?v"
```

## 維護作業

### 定期維護

```bash
# 最佳化索引
curl -X POST "localhost:9200/ivod_transcripts/_optimize?max_num_segments=1"

# 清理舊日誌
sudo find /var/log/elasticsearch -name "*.log" -mtime +7 -delete

# 檢查磁碟使用量
curl -X GET "localhost:9200/_cat/allocation?v"
```

### 更新和升級

```bash
# 升級 Elasticsearch
sudo apt update
sudo apt upgrade elasticsearch

# 重啟服務
sudo systemctl restart elasticsearch

# 驗證升級
curl -X GET "localhost:9200"
```

這個部署指南涵蓋了從安裝到生產環境維護的完整流程，確保 IVOD 系統的 Elasticsearch 搜尋功能能穩定運行。