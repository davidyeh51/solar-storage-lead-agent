"""
自動串接與情報雷達引擎 (Collector & Crawler Engine)
透過 Google Alerts / Google News RSS 多管道併發抓取早鳥預警情報，
並結合園區審議名單與上市櫃重大訊息進行關鍵字萃取與結構化。
"""

import feedparser
import urllib.parse
import re
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from .config import RADAR_QUERIES, RADAR_CACHE_FILE

# 常見工業區與科學園區字典
PARK_PATTERNS = [
    r"屏東科學園區", r"屏科", r"白埔產業園區", r"白埔", r"橋頭科學園區", r"橋科",
    r"南科三期", r"台南科學園區", r"南科", r"新市產業園區", r"仁德工業區",
    r"七股工業區", r"柳營科技工業區", r"永安工業區", r"仁武產業園區", r"路竹科學園區",
    r"高雄軟體園區", r"民雄航太產業園區", r"中科二期", r"嘉義科學園區"
]

# 關鍵企業與供應鏈識別模式
COMPANY_PATTERNS = [
    r"台積電", r"南亞科", r"聚和國際", r"聚和", r"宇晨材料", r"宇晨",
    r"帆宣", r"華懋科技", r"華懋", r"和淞科技", r"和淞", r"兆聯實業", r"兆聯",
    r"安葆國際", r"安葆", r"矽科宏晟", r"捨得", r"鴻海", r"群創", r"友達",
    r"長興材料", r"國巨", r"緯創", r"日月光", r"聯發科", r"旺宏", r"穩懋",
    r"三井化學", r"德商默克", r"美商應材", r"荷商艾司摩爾"
]

class IntelligenceCollector:
    def __init__(self, cache_file: Path = RADAR_CACHE_FILE):
        self.cache_file = cache_file

    def fetch_rss_query(self, query_item: Dict[str, str], max_items: int = 15) -> List[Dict[str, Any]]:
        """抓取單一查詢的 Google News RSS 並解析結構化資料"""
        query_str = query_item["query"]
        category = query_item["category"]
        cat_name = query_item["name"]
        
        encoded_query = urllib.parse.quote(query_str)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        
        items = []
        try:
            feed = feedparser.parse(rss_url)
            for entry in feed.entries[:max_items]:
                title = entry.get("title", "")
                link = entry.get("link", "")
                published = entry.get("published", "")
                summary = entry.get("summary", "")
                
                # 萃取媒體來源 (通常在 title 最後一個 " - 來源名稱")
                source_name = "網路即時情報"
                clean_title = title
                if " - " in title:
                    parts = title.rsplit(" - ", 1)
                    clean_title = parts[0].strip()
                    source_name = parts[1].strip()

                # 自動識別園區
                detected_parks = []
                for p in PARK_PATTERNS:
                    if re.search(p, clean_title) or re.search(p, summary):
                        clean_p = p.replace("r\"", "").replace("\"", "")
                        if clean_p not in detected_parks:
                            detected_parks.append(clean_p)

                # 自動識別提及企業
                detected_companies = []
                for c in COMPANY_PATTERNS:
                    if re.search(c, clean_title) or re.search(c, summary):
                        clean_c = c.replace("r\"", "").replace("\"", "")
                        if clean_c not in detected_companies:
                            detected_companies.append(clean_c)

                # 自動判定建廠生命週期階段 (Stage 1 / 2 / 3)
                stage = "Stage 1: 早期預警 (環評/招商/購地)"
                stage_code = "Stage1"
                stage_badge = "預警期 (提前 6~18 個月)"
                
                if any(w in clean_title for w in ["建造執照", "建照", "都審", "都市設計審議"]):
                    stage = "Stage 2: 中期精準 (建照/都審掛件)"
                    stage_code = "Stage2"
                    stage_badge = "黃金攔截期 (動工前 1~3 個月)"
                elif any(w in clean_title for w in ["動土", "動工", "上梁", "發包", "微電網標案", "開工"]):
                    stage = "Stage 3: 施工與發包 (廠務工程已啟動)"
                    stage_code = "Stage3"
                    stage_badge = "發包期 (工程進行中)"

                # 估算潛在開發價值
                value_rating = "HIGH" if (detected_companies or "台積電" in clean_title or "科學園區" in clean_title) else "MEDIUM"

                items.append({
                    "id": f"radar_{int(time.time()*1000)}_{len(items)}",
                    "title": clean_title,
                    "full_title": title,
                    "source": source_name,
                    "link": link,
                    "published": published,
                    "category_id": category,
                    "category_name": cat_name,
                    "detected_parks": detected_parks,
                    "detected_companies": detected_companies,
                    "stage": stage,
                    "stage_code": stage_code,
                    "stage_badge": stage_badge,
                    "value_rating": value_rating,
                    "fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
        except Exception as e:
            print(f"[Collector] Error fetching RSS for '{cat_name}': {e}")
            
        return items

    def run_all_crawlers(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """執行全情報雷達掃描並快取"""
        if not force_refresh and self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    # 如果快取時間在 3 小時內直接回傳
                    cache_time = cached.get("timestamp", 0)
                    if time.time() - cache_time < 3 * 3600:
                        return cached.get("items", [])
            except Exception as e:
                print(f"[Collector] Cache read error: {e}")

        all_items = []
        for q in RADAR_QUERIES:
            stream_items = self.fetch_rss_query(q, max_items=8)
            all_items.extend(stream_items)
            time.sleep(0.5)  # 避免請求過頻繁

        # 依照發佈時間由新至舊排序
        # 儲存至快取檔案
        payload = {
            "timestamp": time.time(),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_count": len(all_items),
            "items": all_items
        }
        try:
            with open(self.cache_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Collector] Cache write error: {e}")

        return all_items

    def get_latest_cached_radar(self) -> Dict[str, Any]:
        """讀取最新的雷達情報與更新時間"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        # 若無快取則即時爬取
        items = self.run_all_crawlers(force_refresh=True)
        return {
            "timestamp": time.time(),
            "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_count": len(items),
            "items": items
        }
