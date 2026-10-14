"""
智馳光儲·早鳥預警開發 AI Agent 配置設定
包含監控來源關鍵字、團隊成員SOP分工、法規標準與ROI試算係數
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

LEADS_FILE = DATA_DIR / "leads.json"
ARCHITECTS_FILE = DATA_DIR / "architects.json"
RADAR_CACHE_FILE = DATA_DIR / "radar_cache.json"

# 團隊成員與 STP 排兵佈陣
TEAM_MEMBERS = {
    "Lucy": {
        "name": "Lucy",
        "role": "行銷主管 / 情報樞紐",
        "email": "lucy@kingsun-energy.com.tw",
        "focus": "全情報名單初篩、雙週報統籌、重大專案派案稽核",
        "segment": "All",
        "description": "統籌《新園區與新建照潛在客戶雙週報》，負責第一道漏斗把關與跨部門分流。"
    },
    "Vanessa": {
        "name": "Vanessa",
        "role": "前線先鋒業務 (S1新開發 / S2新園區)",
        "email": "vanessa@kingsun-energy.com.tw",
        "focus": "台南/高雄/屏東新興園區、科學園區進駐大戶 (如屏科TSMC護國神鏈)、預計用電 ≥ 5MW 新客",
        "segment": "S1_New / S2_Park",
        "strategy": "主攻「法規義務光電 + RE100/CBAM 綠電自發自用 + 削峰填谷儲能」一體化方案。",
        "description": "鎖定早期建廠生命週期，在建築設計與都審階段切入，協同建築師落實綠能規劃。"
    },
    "Jane": {
        "name": "Jane",
        "role": "資深大客戶業務 (S1 Key Account 維護)",
        "email": "jane@kingsun-energy.com.tw",
        "focus": "既有 Key Account 之擴建案、二期廠房、集團關係企業廠房",
        "segment": "S1_KA",
        "strategy": "深耕既有企業信任，主打「合約無縫擴充、母子公司綠電統籌、電廠智慧維運 (O&M) 代管」。",
        "description": "專注重複接單與既有大戶擴廠商機，轉化率最高。"
    },
    "Julia": {
        "name": "Julia",
        "role": "專案與微電網業務 (S5 微電網與公共標案)",
        "email": "julia@kingsun-energy.com.tw",
        "focus": "公辦園區標準廠房、校園新建大樓、國營事業、政府防救災/韌性電網標案",
        "segment": "S5_Microgrid",
        "strategy": "主打「智慧微電網 (Microgrid) + EMS 能源管理系統 + 儲能夥伴生態系合作」。",
        "description": "鎖定政府採購網公有標案與標準示範園區，結合策略夥伴投標。"
    }
}

# 監控情報雷達關鍵字
RADAR_QUERIES = [
    {
        "category": "Stage1_Park",
        "name": "南台灣新興園區動態",
        "query": '("屏東科學園區" OR "白埔產業園區" OR "橋頭科學園區" OR "南科三期" OR "新市產業園區") AND ("動土" OR "建廠" OR "購地" OR "擴廠" OR "招商")'
    },
    {
        "category": "Stage1_EIA",
        "name": "環評與工業區新闢",
        "query": '("環評" OR "環境影響評估") AND ("工業區" OR "產業園區" OR "科技園區" OR "新建廠房")'
    },
    {
        "category": "Stage1_MOPS",
        "name": "上市櫃重大訊息-買地建廠",
        "query": '("取得不動產" OR "自地委建" OR "廠房發包" OR "新建廠房") AND ("董事會" OR "重大訊息" OR "公告")'
    },
    {
        "category": "Stage2_Permit",
        "name": "建照與工廠執照核發",
        "query": '("建造執照" OR "建照核發") AND ("C類" OR "廠房" OR "工廠" OR "特殊作業廠房")'
    },
    {
        "category": "Stage3_Tender",
        "name": "微電網與儲能標案情報",
        "query": '("微電網" OR "表後儲能" OR "綠能廠房" OR "再生能源標案") AND ("決標" OR "招標" OR "公告")'
    }
]

# 法規義務與經濟效益試算參數
REGULATION_PARAMS = {
    # 再生能源發展條例第 12-1 條門檻 (建築面積 m2)
    "mandatory_roof_threshold_m2": 1000.0,
    # 預估屋頂可鋪設比例 (工廠廠房約 60%~75%)
    "roof_usable_ratio": 0.65,
    # 每 kWp 光電板所需面積 (約 6.0~6.5 m2 / kWp，高效率單晶模組約 450W~550W)
    "m2_per_kwp": 6.2,
    # 南台灣年平均等效日照發電時數 (台南/高雄/屏東 約 1250~1350 kWh / kWp / 年)
    "annual_sun_hours": 1300.0,
    # 自發自用或綠電轉供替代電費價值 (NT$ / kWh)
    "electricity_tariff_saving_rate": 5.8,
    # 台電電網電力排碳係數 (kg CO2e / kWh)
    "co2_factor_kg_per_kwh": 0.495,
    # 太陽能光電 EPC 建置單位成本 (NT$ / kWp)
    "solar_epc_cost_per_kwp": 45000.0,
    # 表後儲能 EPC 建置單位成本 (NT$ / kWh)
    "ess_epc_cost_per_kwh": 25000.0,
    # 用電大戶門檻 (契約容量 kW)
    "large_user_threshold_kw": 5000.0,
    # 用電大戶法規義務設置比例 (10%)
    "large_user_obligation_ratio": 0.10
}
