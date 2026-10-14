"""
將本地 data/*.json 資料庫打包為前端靜態 seed-data.js
確保 GitHub Pages 純前端部署時立即可見所有案場、情報雷達與建築師網絡！
"""

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

with open(BASE_DIR / "data" / "leads.json", "r", encoding="utf-8") as f:
    leads = json.load(f)

with open(BASE_DIR / "data" / "architects.json", "r", encoding="utf-8") as f:
    architects = json.load(f)

radar_items = []
radar_cache_file = BASE_DIR / "data" / "radar_cache.json"
if radar_cache_file.exists():
    with open(radar_cache_file, "r", encoding="utf-8") as f:
        radar_data = json.load(f)
        radar_items = radar_data.get("items", [])

# 計算 KPI summary
total_solar_kw = sum(l.get("roi_result", {}).get("technical_specs", {}).get("suggested_solar_kwp", 0.0) for l in leads)
total_ess_kwh = sum(l.get("roi_result", {}).get("technical_specs", {}).get("suggested_ess_kwh", 0.0) for l in leads)
total_rev = sum(l.get("roi_result", {}).get("financial_roi", {}).get("total_annual_benefit_ntd", 0.0) for l in leads)

summary = {
    "kpis": {
        "total_leads_count": len(leads),
        "early_radar_count": len(radar_items),
        "total_solar_mw": round(total_solar_kw / 1000.0, 2),
        "total_ess_mwh": round(total_ess_kwh / 1000.0, 2),
        "total_annual_revenue_million_ntd": round(total_rev / 1_000_000.0, 2),
        "architect_network_count": len(architects)
    },
    "stage_distribution": {
        "Stage1": sum(1 for l in leads if l.get("stage_code") == "Stage1"),
        "Stage2": sum(1 for l in leads if l.get("stage_code") == "Stage2"),
        "Stage3": sum(1 for l in leads if l.get("stage_code") == "Stage3")
    },
    "rep_distribution": {
        "Vanessa": sum(1 for l in leads if l.get("assigned_rep") == "Vanessa"),
        "Jane": sum(1 for l in leads if l.get("assigned_rep") == "Jane"),
        "Julia": sum(1 for l in leads if l.get("assigned_rep") == "Julia"),
        "Lucy": sum(1 for l in leads if l.get("assigned_rep") == "Lucy")
    },
    "radar_updated_at": "即時同步 (2026-10-14)"
}

js_content = f"""// 智馳光儲 · 預載展示種子資料 (GitHub Pages 純靜態模式專用)
window.SEED_SUMMARY = {json.dumps(summary, ensure_ascii=False, indent=2)};
window.SEED_LEADS = {json.dumps(leads, ensure_ascii=False, indent=2)};
window.SEED_RADAR = {json.dumps(radar_items, ensure_ascii=False, indent=2)};
window.SEED_ARCHITECTS = {json.dumps(architects, ensure_ascii=False, indent=2)};
"""

for target in [BASE_DIR / "static" / "seed-data.js", BASE_DIR / "web" / "static" / "seed-data.js"]:
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        f.write(js_content)

print(f"Successfully generated seed-data.js with {len(leads)} leads, {len(radar_items)} radar items, {len(architects)} architects!")
