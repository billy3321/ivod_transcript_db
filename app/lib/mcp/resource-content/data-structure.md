# 資料結構說明

## IVOD 資料庫結構

### 主要資料表：IVODTranscript

| 欄位名稱 | 資料類型 | 說明 |
|---------|---------|------|
| ivod_id | Integer | IVOD 會議唯一識別碼（主鍵）|
| title | Text | 會議完整標題 |
| speaker_name | Text | 發言人姓名（通常是立委） |
| meeting_name | Text | 會議簡稱 |
| committee_names | JSON/Text | 委員會名稱列表 |
| date | Date | 會議日期 |
| category | Text | 會議類別（院會、委員會會議等）|
| ly_transcript | Text | 立法院官方逐字稿 |
| ai_transcript | Text | AI 生成逐字稿 |
| ivod_url | Text | IVOD 影片連結 |
| status | Text | 處理狀態（success/failed/pending）|

## 逐字稿格式

### 優先順序
1. **ly_transcript** - 立法院官方逐字稿（優先使用）
2. **ai_transcript** - AI 生成逐字稿（備用）

### 內容特色
- **完整性**：包含發言人完整發言內容
- **結構化**：保持原始段落和語句結構
- **繁體中文**：符合台灣用語習慣
- **即時性**：定期更新最新會議內容

## 會議類別

### 院會
- 立法院全院會議
- 處理法案三讀、質詢、特別報告等

### 委員會會議
- **交通委員會**：交通運輸、通訊傳播議題
- **經濟委員會**：經濟發展、產業政策
- **內政委員會**：內政事務、地方發展
- **教育文化委員會**：教育政策、文化事務
- **外交國防委員會**：外交關係、國防政策
- **財政委員會**：財政預算、稅務政策
- **社會福利及衛生環境委員會**：社會福利、醫療衛生、環境保護
- **司法及法制委員會**：司法改革、法制議題

### 特殊會議
- **黨團協商**：跨黨派協商會議
- **公聽會**：公開聽證會
- **考察**：實地考察活動

## 委員會名稱格式

### 資料庫儲存格式
- **PostgreSQL**: JSON 陣列格式 `["交通委員會", "經濟委員會"]`
- **MySQL**: JSON 字串格式 
- **SQLite**: 逗號分隔字串格式 `"交通委員會,經濟委員會"`

### 標準委員會名稱
- 交通委員會
- 經濟委員會  
- 內政委員會
- 教育文化委員會
- 外交國防委員會
- 財政委員會
- 社會福利及衛生環境委員會
- 司法及法制委員會

## 搜尋索引結構

### Elasticsearch 索引
- **索引名稱**：ivod_transcripts（生產）、ivod_dev_transcripts（開發）
- **中文分析器**：ik_max_word 或 analysis-smartcn
- **主要搜尋欄位**：ly_transcript, ai_transcript, title, speaker_name

### 資料庫搜尋
- **全文搜尋**：使用 LIKE 查詢進行部分匹配
- **欄位搜尋**：支援 title, speaker_name, meeting_name, committee_names
- **日期範圍**：date 欄位範圍查詢

## 資料更新機制

### 爬蟲更新
- **完整更新**：ivod_full.py（首次運行或重置）
- **增量更新**：ivod_incremental.py（每日執行）
- **重試機制**：ivod_retry.py（處理失敗記錄）

### Elasticsearch 同步
- **索引建立**：ivod_es.py
- **即時同步**：資料庫更新後自動同步到 ES
- **備份機制**：ES 不可用時自動切換到資料庫搜尋

## 資料品質控制

### 狀態追蹤
- **success**：成功處理的記錄
- **failed**：處理失敗，等待重試
- **pending**：等待處理的新記錄

### 重試邏輯
- 最大重試次數：5 次
- 重試間隔：指數退避演算法
- 失敗原因記錄：網路錯誤、內容為空等