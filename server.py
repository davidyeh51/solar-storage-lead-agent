"""
進能服南區業務部·早鳥預警開發 AI Agent 後端 API 服務器 (FastAPI Server)
整合即時爬蟲、建照智慧解析、法規ROI試算、建築師白名單、STP派案與AI戰情顧問。
"""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from agent.config import LEADS_FILE, TEAM_MEMBERS, BASE_DIR
from agent.collector import IntelligenceCollector
from agent.permit_parser import PermitParser
from agent.roi_calculator import ROICalculator
from agent.architect_db import ArchitectDatabase
from agent.lead_router import LeadRouter
from agent.ai_agent import SalesStrategyAgent

app = FastAPI(
    title="進能服南區業務部·早鳥預警拓客 AI 戰情室",
    description="太陽能光電與表後儲能早期開發情報雷達與業務 AI Agent",
    version="2.0.0"
)

# 跨域支援
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 實例化模組
collector = IntelligenceCollector()
parser = PermitParser()
calculator = ROICalculator()
arch_db = ArchitectDatabase()
lead_router = LeadRouter()
ai_agent = SalesStrategyAgent()

def load_leads() -> List[Dict[str, Any]]:
    if not LEADS_FILE.exists():
        return []
    try:
        with open(LEADS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_leads(leads: List[Dict[str, Any]]):
    with open(LEADS_FILE, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)

# --- API 端點 ---

@app.get("/api/summary")
def get_summary():
    """戰情儀表板總覽指標 (KPI Summary)"""
    leads = load_leads()
    radar_info = collector.get_latest_cached_radar()
    architects = arch_db.get_all()

    total_solar_kw = 0.0
    total_ess_kwh = 0.0
    total_annual_rev = 0.0
    
    stage_counts = {"Stage1": 0, "Stage2": 0, "Stage3": 0}
    rep_counts = {"Vanessa": 0, "Jane": 0, "Julia": 0, "Lucy": 0}

    for l in leads:
        roi = l.get("roi_result", {})
        tech = roi.get("technical_specs", {})
        fin = roi.get("financial_roi", {})
        
        total_solar_kw += tech.get("suggested_solar_kwp", 0.0)
        total_ess_kwh += tech.get("suggested_ess_kwh", 0.0)
        total_annual_rev += fin.get("total_annual_benefit_ntd", 0.0)

        st = l.get("stage_code", "Stage2")
        stage_counts[st] = stage_counts.get(st, 0) + 1

        rep = l.get("assigned_rep", "Vanessa")
        rep_counts[rep] = rep_counts.get(rep, 0) + 1

    return {
        "kpis": {
            "total_leads_count": len(leads),
            "early_radar_count": radar_info.get("total_count", 0),
            "total_solar_mw": round(total_solar_kw / 1000.0, 2),
            "total_ess_mwh": round(total_ess_kwh / 1000.0, 2),
            "total_annual_revenue_million_ntd": round(total_annual_rev / 1_000_000.0, 2),
            "architect_network_count": len(architects)
        },
        "stage_distribution": stage_counts,
        "rep_distribution": rep_counts,
        "team_profiles": TEAM_MEMBERS,
        "radar_updated_at": radar_info.get("updated_at", "")
    }

@app.get("/api/leads")
def get_leads(
    rep: Optional[str] = None,
    stage: Optional[str] = None,
    keyword: Optional[str] = None
):
    """查詢所有追蹤中案場線索 (可依負責業務、階段、關鍵字篩選)"""
    leads = load_leads()
    results = []
    for l in leads:
        if rep and rep != "ALL" and l.get("assigned_rep") != rep:
            continue
        if stage and stage != "ALL" and l.get("stage_code") != stage:
            continue
        if keyword:
            kw = keyword.lower()
            text = f"{l.get('applicant','')} {l.get('project_name','')} {l.get('architect','')} {l.get('location','')}".lower()
            if kw not in text:
                continue
        results.append(l)
    return results

@app.post("/api/leads")
def add_lead(lead_data: Dict[str, Any]):
    """手動新增案場線索"""
    leads = load_leads()
    new_lead = parser.create_lead_from_permit(lead_data)
    leads.insert(0, new_lead)
    save_leads(leads)
    return new_lead

@app.put("/api/leads/{lead_id}")
def update_lead(lead_id: str, updates: Dict[str, Any]):
    """更新案場狀態或筆記"""
    leads = load_leads()
    found = False
    for l in leads:
        if l["id"] == lead_id:
            for k, v in updates.items():
                if k != "id":
                    l[k] = v
            # 若有變更負責人，重新生成基本資訊
            if "assigned_rep" in updates:
                rep_name = updates["assigned_rep"]
                l["assigned_rep"] = rep_name
                if "battle_card" in l and rep_name in TEAM_MEMBERS:
                    l["battle_card"]["assigned_rep"] = rep_name
                    l["battle_card"]["rep_name"] = TEAM_MEMBERS[rep_name]["name"]
                    l["battle_card"]["rep_role"] = TEAM_MEMBERS[rep_name]["role"]
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Lead not found")
    save_leads(leads)
    return {"status": "success", "id": lead_id}

@app.delete("/api/leads/{lead_id}")
def delete_lead(lead_id: str):
    """刪除案場線索"""
    leads = load_leads()
    new_leads = [l for l in leads if l["id"] != lead_id]
    save_leads(new_leads)
    return {"status": "success", "deleted_id": lead_id}

@app.get("/api/radar")
def get_radar(category: Optional[str] = None):
    """取得早鳥預警情報雷達實時流"""
    radar_info = collector.get_latest_cached_radar()
    items = radar_info.get("items", [])
    if category and category != "ALL":
        items = [it for it in items if it.get("category_id") == category]
    return {
        "updated_at": radar_info.get("updated_at", ""),
        "total": len(items),
        "items": items
    }

@app.post("/api/radar/refresh")
def refresh_radar():
    """強制重新爬取所有即時情報雷達來源"""
    items = collector.run_all_crawlers(force_refresh=True)
    return {
        "status": "success",
        "fetched_count": len(items),
        "items": items,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

@app.post("/api/radar/add")
def add_custom_radar_item(item: Dict[str, Any]):
    """手動速貼新聞情報入庫"""
    radar_info = collector.get_latest_cached_radar()
    items = radar_info.get("items", [])
    item["id"] = item.get("id") or f"radar_custom_{int(time.time()*1000)}"
    items.insert(0, item)
    collector.save_cache(items)
    return {"status": "success", "item": item, "total_count": len(items)}

@app.get("/api/fetch_url")
def fetch_url(url: str = Query(...)):
    """後端代理網頁內容抓取 (支援各大新聞網站與政府公告)"""
    import urllib.request
    import re

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            title = ""
            title_m = re.search(r"<title>(.*?)</title>", html, re.I)
            if title_m:
                title = title_m.group(1).split(" - ")[0].split(" | ")[0].strip()
            # 移除 script, style
            text = re.sub(r"<(script|style).*?>.*?</\1>", "", html, flags=re.S | re.I)
            # 移除所有 html tags
            text = re.sub(r"<.*?>", " ", text)
            # 清理多餘空白
            text = re.sub(r"\s+", " ", text).strip()
            return {"status": "success", "url": url, "title": title, "content": text[:10000]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/radar/convert")
def convert_radar_item(item_data: Dict[str, Any]):
    """將早鳥情報直接轉換為正式追蹤商機"""
    title = item_data.get("title", "")
    companies = item_data.get("detected_companies", [])
    parks = item_data.get("detected_parks", [])

    applicant = companies[0] if companies else "情報標註潛在企業"
    location = parks[0] if parks else "南台灣產業新興園區"
    stage_code = item_data.get("stage_code", "Stage1")

    # 預估標準規模
    building_area = 12000.0 if "台積電" in title or "半導體" in title else 6000.0
    contract_kw = 5000.0 if "台積電" in title or "半導體" in title else 2000.0

    raw_permit = {
        "permit_no": f"早鳥預警-{int(time.time()%10000)}",
        "project_name": f"{applicant} {location} 新建案 (早鳥)",
        "applicant": applicant,
        "architect": "尚未確定 (爭取早鳥協作)",
        "contractor": "工程規劃中",
        "use_category": "C-1 / C-2 廠房新建",
        "structure": "鋼骨構造 (S)",
        "location": location,
        "site_area_m2": building_area * 1.8,
        "building_area_m2": building_area,
        "floor_area_m2": building_area * 3.0,
        "contract_capacity_kw": contract_kw,
        "date_issued": datetime.now().strftime("%Y-%m-%d"),
        "notes": f"來源：{item_data.get('source','網路快訊')} - {title}\n原始連結：{item_data.get('link','')}"
    }

    new_lead = parser.create_lead_from_permit(raw_permit)
    new_lead["stage_code"] = stage_code
    new_lead["stage_badge"] = item_data.get("stage_badge", "Stage 1: 早期預警")
    new_lead["pipeline_status"] = "早鳥攔截中 (刺探籌備處)"
    new_lead["pipeline_color"] = "amber"

    leads = load_leads()
    leads.insert(0, new_lead)
    save_leads(leads)

    return new_lead

@app.get("/api/architects")
def get_architects():
    """取得南台灣高頻率工業建築師網絡庫"""
    return arch_db.get_all()

@app.put("/api/architects/{arch_id}")
def update_architect(arch_id: str, payload: Dict[str, Any]):
    """更新建築師合作狀態與筆記"""
    status = payload.get("cooperation_status", "密切拜訪洽談中")
    notes = payload.get("collaboration_notes")
    ok = arch_db.update_status(arch_id, status, notes)
    if not ok:
        raise HTTPException(status_code=404, detail="Architect not found")
    return {"status": "success", "id": arch_id}

@app.post("/api/roi_calculate")
def calculate_roi(params: Dict[str, Any]):
    """即時法規義務與光儲投資回報試算器"""
    area = float(params.get("building_area_m2", 5000.0))
    contract = float(params.get("contract_capacity_kw", 1500.0))
    ratio = float(params.get("usable_roof_ratio", 0.65))
    sun = float(params.get("annual_sun_hours", 1300.0))
    rate = float(params.get("electricity_rate", 5.8))
    custom_solar = float(params.get("custom_solar_kwp", 0.0)) or None
    custom_ess = float(params.get("custom_ess_kwh", 0.0)) or None

    return calculator.calculate(
        building_area_m2=area,
        contract_capacity_kw=contract,
        usable_roof_ratio=ratio,
        sun_hours=sun,
        electricity_rate=rate,
        custom_solar_kwp=custom_solar,
        custom_ess_kwh=custom_ess
    )

@app.post("/api/parse_permit_text")
def parse_raw_permit_text(payload: Dict[str, str]):
    """貼上各縣市建管系統執照存根或文字，一鍵智慧解析"""
    raw_text = payload.get("text", "")
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    lead = parser.parse_permit_text(raw_text)
    return lead

@app.post("/api/ai_consult")
def ai_consult(payload: Dict[str, Any]):
    """AI 業務顧問與高階戰情生成"""
    lead_id = payload.get("lead_id")
    custom_query = payload.get("query", "")

    if lead_id:
        leads = load_leads()
        target_lead = next((l for l in leads if l["id"] == lead_id), None)
        if target_lead:
            report = ai_agent.generate_strategy_report(target_lead)
            return {"type": "strategy_report", "lead": target_lead, "report": report}

    answer = ai_agent.answer_consulting_query(custom_query)
    return {"type": "consulting_qa", "query": custom_query, "answer": answer}

@app.get("/api/export_biweekly")
def export_biweekly():
    """產出 Lucy 統籌之《新園區與新建照潛在客戶雙週報》"""
    leads = load_leads()
    radar = collector.get_latest_cached_radar()
    now_str = datetime.now().strftime("%Y年%m月%d日")

    report_md = f"""# ☀️ 進能服南區業務部 · 新園區與新建照潛在客戶雙週報
**發布日期**：{now_str}  
**統籌主管**：Lucy（行銷主管 / 情報樞紐）  
**目標市場**：台南、高雄、屏東高用電工業大戶 (S1) 與新興園區擴建 (S2)

---

## 📊 一、 本期拓客戰情總覽
- **追蹤重點案場總數**：{len(leads)} 件
- **實時早鳥預警情報**：{radar.get('total_count', 0)} 則（涵蓋環評、科學園區審議、土地標售）
- **潛在總屋頂光電規模**：{sum(l.get('roi_result',{}).get('technical_specs',{}).get('suggested_solar_kwp',0) for l in leads)/1000:.2f} MWp
- **潛在表後儲能規模**：{sum(l.get('roi_result',{}).get('technical_specs',{}).get('suggested_ess_kwh',0) for l in leads)/1000:.2f} MWh
- **預估年化發電與套利收益**：NT$ {sum(l.get('roi_result',{}).get('financial_roi',{}).get('total_annual_benefit_ntd',0) for l in leads)/1000000:.1f} 百萬元 / 年

---

## 🎯 二、 前線業務派案戰情分流清單

### 1. 【Vanessa 先鋒專區】新興園區 (屏科TSMC神鏈、白埔、橋科、用電 ≥ 5MW)
"""
    vanessa_leads = [l for l in leads if l.get("assigned_rep") == "Vanessa"]
    for l in vanessa_leads:
        tech = l.get("roi_result", {}).get("technical_specs", {})
        report_md += f"""
- **【{l.get('applicant')}】{l.get('project_name')}**
  - **建照/執照號**：`{l.get('permit_no')}` | 階段：`{l.get('stage_badge')}`
  - **設計建築師**：{l.get('architect')} | 承造營造：{l.get('contractor')}
  - **預估配置**：光電 `{tech.get('suggested_solar_kwp',0):,.0f} kWp` ｜ 儲能 `{tech.get('suggested_ess_kwh',0):,.0f} kWh`
  - **作戰策略**：{l.get('battle_card',{}).get('core_strategy','')}
  - **業務備註**：{l.get('notes')}
"""

    report_md += """
### 2. 【Jane 資深專區】既有 Key Account 擴廠 / 二期廠房重複接單
"""
    jane_leads = [l for l in leads if l.get("assigned_rep") == "Jane"]
    for l in jane_leads:
        tech = l.get("roi_result", {}).get("technical_specs", {})
        report_md += f"""
- **【{l.get('applicant')}】{l.get('project_name')}**
  - **建照/執照號**：`{l.get('permit_no')}` | 階段：`{l.get('stage_badge')}`
  - **預估配置**：光電 `{tech.get('suggested_solar_kwp',0):,.0f} kWp` ｜ 儲能 `{tech.get('suggested_ess_kwh',0):,.0f} kWh`
  - **作戰策略**：{l.get('battle_card',{}).get('core_strategy','')}
"""

    report_md += """
### 3. 【Julia 專案專區】S5 微電網、公辦示範園區與防救災儲能標案
"""
    julia_leads = [l for l in leads if l.get("assigned_rep") == "Julia"]
    for l in julia_leads:
        tech = l.get("roi_result", {}).get("technical_specs", {})
        report_md += f"""
- **【{l.get('applicant')}】{l.get('project_name')}**
  - **建照/執照號**：`{l.get('permit_no')}` | 階段：`{l.get('stage_badge')}`
  - **預估配置**：光電 `{tech.get('suggested_solar_kwp',0):,.0f} kWp` ｜ 儲能 `{tech.get('suggested_ess_kwh',0):,.0f} kWh`
  - **作戰策略**：{l.get('battle_card',{}).get('core_strategy','')}
"""

    report_md += """
---
## 📐 三、 建築師圖說協作關鍵提醒
- **黃金切入期**：建照掛件與都審階段前 1~3 個月。
- **協同原則**：主動拜訪九典、潘冀、許銘陽、喻台生等事務所，出具「免費光電結構載重預留檢討書與 3D CAD 配置圖」，直接把進金生規格畫入建照圖說！
"""
    return {"report_markdown": report_md, "generated_at": now_str}

# 靜態文件與前端網頁託管
WEB_DIR = BASE_DIR / "web"
app.mount("/static", StaticFiles(directory=str(WEB_DIR / "static")), name="static")

@app.get("/supabase-schema.sql")
def serve_supabase_schema():
    sql_path = BASE_DIR / "supabase-schema.sql"
    return FileResponse(str(sql_path), media_type="text/plain")

@app.get("/")
def serve_frontend():
    return FileResponse(str(WEB_DIR / "index.html"))
