from datetime import datetime
from dateutil import rrule
from dotenv import load_dotenv
import ssl
import requests
import subprocess
import mechanize
import json
import http.client as _http_client
if not hasattr(_http_client.HTTPResponse, '_set_fp'):
    _http_client.HTTPResponse._set_fp = lambda self, f: setattr(self, 'fp', f)
import http.cookiejar as cookiejar
from bs4 import BeautifulSoup
import time, random
import urllib3
from urllib3.exceptions import InsecureRequestWarning

# 關閉 InsecureRequestWarning
urllib3.disable_warnings(InsecureRequestWarning)

HEADERS = [
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/113.0.0.0 Safari/537.36"),
    ("Accept", "text/html,application/xhtml+xml,application/xml;"
               "q=0.9,image/avif,image/webp,*/*;q=0.8"),
    ("Accept-Language", "en-US,en;q=0.5"),
    ("Accept-Encoding", "gzip, deflate"),
    ("Connection", "keep-alive"),
]

def random_sleep(min_sec: float = 0.5, max_sec: float = 2.0) -> None:
    """
    隨機睡眠一段時間，介於 min_sec 和 max_sec 之間（單位：秒）。
    預設為 0.5~2.0 秒。
    """
    duration = random.uniform(min_sec, max_sec)
    time.sleep(duration)


def date_range(start_date: str, end_date: str):
    """
    Generate dates from start_date to end_date inclusive in ISO format.
    """
    dt0 = datetime.fromisoformat(start_date)
    dt1 = datetime.fromisoformat(end_date)
    for dt in rrule.rrule(rrule.DAILY, dtstart=dt0, until=dt1):
        yield dt.strftime("%Y-%m-%d")


def make_browser(skip_ssl: bool = False) -> mechanize.Browser:
    """
    建立 mechanize.Browser()，可選擇是否跳過 SSL 驗證，並設定 headers + cookie。
    """
    cj = cookiejar.LWPCookieJar()
    br = mechanize.Browser()
    br.set_cookiejar(cj)

    # 不遵守 robots.txt，也不自動處理 <meta http-equiv="refresh">
    br.set_handle_robots(False)
    br.set_handle_refresh(False)
    # 處理 gzip 壓縮
    br.set_handle_gzip(True)

    br.addheaders = HEADERS

    if skip_ssl:
        import urllib.request
        ctx = ssl._create_unverified_context(cert_reqs=ssl.CERT_NONE)
        br.add_handler(urllib.request.HTTPSHandler(context=ctx))

    return br


def fetch_lastest_date(br: mechanize.Browser):
    url = 'https://ly.govapi.tw/v2/ivods?limit=1'
    try:
        resp = br.open(url)
        raw = resp.read().decode('utf-8')
    except Exception:
        # Fallback to requests for JSON endpoints to avoid mechanize gzip issues
        raw = requests.get(url, verify=False).text
    js = json.loads(raw)
    date = datetime.fromisoformat(js.get('ivods')[0]['日期']).date()
    return date

def fetch_available_dates(br: mechanize.Browser, session=3):
    url = f"https://ly.govapi.tw/v2/ivods?%E5%B1%86=11&%E6%9C%83%E6%9C%9F={session}&agg=%E6%97%A5%E6%9C%9F&limit=0"
    try:
        resp = br.open(url)
        raw = resp.read().decode('utf-8')
    except Exception:
        # Fallback to requests for JSON endpoints to avoid mechanize gzip issues
        raw = requests.get(url, verify=False).text
    js = json.loads(raw)
    aggs = js.get('aggs', [])
    dates = []
    if len(aggs):
        dates = [datetime.fromisoformat(d["日期"]).date() for d in aggs[0].get('buckets', [])]
    return dates

def fetch_ivod_info(br: mechanize.Browser, ivod_id: int):
    """
    Fetch IVOD info JSON data for a given ivod_id. Use mechanize for HTTP and
    fallback to requests on failure.
    """
    url = f"https://ly.govapi.tw/v2/ivods/{ivod_id}"
    try:
        resp = br.open(url)
        raw = resp.read().decode('utf-8')
    except Exception:
        raw = requests.get(url, verify=False).text
    
    try:
        js = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON response for IVOD_ID {ivod_id} from URL {url}: {e}")
    
    # Check if API returned an error
    if js.get("error", False):
        error_msg = js.get("message", "Unknown error")
        raise ValueError(f"API error for IVOD_ID {ivod_id}: {error_msg}")
    
    data = js.get("data", {})
    if not data:
        raise ValueError(f"No data found for IVOD_ID {ivod_id}")
    
    return data

def fetch_ivod_list(br: mechanize.Browser, date_str: str):
    url = f"https://ly.govapi.tw/v2/ivods?日期={date_str}&limit=600"
    try:
        resp = br.open(url)
        raw = resp.read().decode('utf-8')
    except Exception:
        raw = requests.get(url, verify=False).text
    js = json.loads(raw)
    return [int(i['IVOD_ID']) for i in js.get("ivods", [])]

def fetch_ai(js, rec, obj, db):
    try:
        ai_items = js.get("transcript", {}).get("whisperx", [])
        rec["ai_transcript"] = "".join(i.get("text","") for i in ai_items)
        rec["ai_status"] = "success"
    except Exception:
        rec["ai_transcript"] = ""
        rec["ai_status"] = "failed"
        # 如果已經有這筆，就累加 retries
        if obj:
            obj.ai_retries += 1
        else:
            rec["ai_retries"] = 1

def fetch_ly_speech(ivod_id):
    url = f"https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}"
    transcript = ""
    # 這邊應該是接 https://ivod.ly.gov.tw/Demand/Speech/159939 這種網址。這個網址的網頁並不規範，直接擷取輸出即可。
    # Please don't modified this function.
    try:
        random_sleep(0.2, 2.0)
        res = subprocess.run(
            ["curl", "--tlsv1.2", "--insecure", "-sSf", url],
            stdout=subprocess.PIPE,        # 把 stdout 導到管道
            stderr=subprocess.DEVNULL,
            text=True                      # 直接以字串（而不是 bytes）形式回傳
        )
        if res.returncode == 0:
            # Replace HTML breaks with newlines before trimming
            transcript = res.stdout.replace('<br />', "\n").strip()
    except Exception:
        transcript = ""
    return transcript

def fetch_ly(js, rec, obj, br):
    """
    Fetch LY transcript for a given ivod.
    Use gazette JSON blocks if available, otherwise fetch HTML page and extract text.
    Fallback to requests with headers to avoid mechanize gzip issues or access denial.
    """
    try:
        if "gazette" in js:
            blocks = js["gazette"]["blocks"]
            rec["ly_transcript"] = "\n\n".join("\n".join(b) for b in blocks)
            rec["ly_status"] = "success"
        else:
            rec["ly_transcript"] = fetch_ly_speech(rec['ivod_id'])
            if rec["ly_transcript"]:
                rec["ly_status"] = "success"
            else:
                rec["ly_status"] = "failed"
                if obj:
                    obj.ly_retries += 1
                else:
                    rec["ly_retries"] = 1

    except Exception:
        rec["ly_transcript"] = ""
        rec["ly_status"] = "failed"
        if obj:
            obj.ly_retries += 1
        else:
            rec["ly_retries"] = 1
