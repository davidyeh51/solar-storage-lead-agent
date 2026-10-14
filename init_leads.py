"""
初始化南台灣重點指標案場資料庫 (Seed Leads Database)
涵蓋屏東科學園區台積電神鏈、白埔產業園區、既有KA擴建與微電網公共標案
"""

import json
from pathlib import Path
from agent.permit_parser import PermitParser
from agent.roi_calculator import ROICalculator
from agent.lead_router import LeadRouter
from agent.config import LEADS_FILE

SAMPLE_PROJECTS = [
    {
        "permit_no": "(115)屏科建字第001號",
        "project_name": "宇晨材料科技屏東科學園區一期廠房新建工程",
        "applicant": "宇晨材料科技股份有限公司",
        "architect": "許銘陽建築師事務所",
        "contractor": "達欣工程股份有限公司",
        "use_category": "C-1 (特殊廠房/散熱材料)",
        "structure": "鋼骨構造 (S)",
        "location": "屏東縣屏東市屏東科學園區產一用地",
        "site_area_m2": 18500.0,
        "building_area_m2": 9250.0,
        "floor_area_m2": 27750.0,
        "contract_capacity_kw": 4500.0,
        "date_issued": "2026-08-15",
        "stage_code": "Stage2",
        "stage_badge": "Stage 2: 建照核發 (黃金攔截期)",
        "pipeline_status": "首訪進行中 (已邀約建築師)",
        "pipeline_color": "blue",
        "notes": "屏科首家動土建廠企業！主攻AI伺服器與半導體高導熱液態金屬材料，建照圖說剛定案，需立即由 Vanessa 協調結構光電排佈。"
    },
    {
        "permit_no": "(115)屏科建字第002號",
        "project_name": "聚和國際屏東科學園區生技特化新廠新建工程",
        "applicant": "聚和國際股份有限公司",
        "architect": "潘冀聯合建築師事務所",
        "contractor": "互助營造股份有限公司",
        "use_category": "C-1 (特殊廠房/生技特化)",
        "structure": "鋼骨鋼筋混凝土 (SRC)",
        "location": "屏東縣屏東市屏東科學園區產二用地",
        "site_area_m2": 32000.0,
        "building_area_m2": 16000.0,
        "floor_area_m2": 48000.0,
        "contract_capacity_kw": 8000.0, # 用電大戶 >= 5MW
        "date_issued": "2026-09-02",
        "stage_code": "Stage2",
        "stage_badge": "Stage 2: 建照核發 (黃金攔截期)",
        "pipeline_status": "圖說協作中 (提供結構計算書)",
        "pipeline_color": "emerald",
        "notes": "全球生物緩衝劑龍頭，契約容量 8MW 屬用電大戶條款強烈約束對象！屋頂可設約 1,600 kWp 光電，並規劃 1.5MWh 表後儲能。"
    },
    {
        "permit_no": "(115)高市工建築字第03810號",
        "project_name": "高雄白埔產業園區台積電先進封裝設備支援中心新建案",
        "applicant": "帆宣系統科技股份有限公司",
        "architect": "九典聯合建築師事務所",
        "contractor": "漢唐集成股份有限公司",
        "use_category": "C-1 (高科技廠務工程廠房)",
        "structure": "鋼骨構造 (S)",
        "location": "高雄市岡山區白埔產業園區專區C",
        "site_area_m2": 26000.0,
        "building_area_m2": 13000.0,
        "floor_area_m2": 39000.0,
        "contract_capacity_kw": 6500.0,
        "date_issued": "2026-09-20",
        "stage_code": "Stage2",
        "stage_badge": "Stage 2: 建照核發 (黃金攔截期)",
        "pipeline_status": "規格已送審 (綁定進金生方案)",
        "pipeline_color": "purple",
        "notes": "白埔園區旗艦供應鏈大廠，環評承諾屋頂光電覆蓋率達 50% 以上，Vanessa 與九典張建築師已完成 CAD 圖說繪製。"
    },
    {
        "permit_no": "(115)屏科審議字第035號",
        "project_name": "南亞科技屏東科學園區3D晶圓封測新廠投資案",
        "applicant": "南亞科技股份有限公司",
        "architect": "潘冀聯合建築師事務所",
        "contractor": "待發包 (工程籌備處)",
        "use_category": "C-1 (半導體3D晶圓封測廠)",
        "structure": "鋼骨鋼筋混凝土 (SRC)",
        "location": "屏東縣屏東市屏東科學園區",
        "site_area_m2": 55000.0,
        "building_area_m2": 27500.0,
        "floor_area_m2": 110000.0,
        "contract_capacity_kw": 25000.0, # 超級用電大戶 25MW
        "date_issued": "2026-10-05 (審議通過)",
        "stage_code": "Stage1",
        "stage_badge": "Stage 1: 早期預警 (國科會審議通過)",
        "pipeline_status": "早期接洽中 (拜訪籌備處)",
        "pipeline_color": "amber",
        "notes": "國科會第35次審議會核准之超級重量級投資案！距離掛建照還有 6~9 個月，為 2026~2027 最具戰略價值之光儲整合標的！"
    },
    {
        "permit_no": "(115)南工建字第01988號",
        "project_name": "高雄金屬精工老客戶二期智慧綠能廠房擴建案",
        "applicant": "舜煜實業股份有限公司 (Key Account)",
        "architect": "喻台生建築師事務所",
        "contractor": "根基營造股份有限公司",
        "use_category": "C-2 (一般金屬精密加工廠)",
        "structure": "鋼骨構造 (S)",
        "location": "台南市新市產業園區二期",
        "site_area_m2": 14000.0,
        "building_area_m2": 7000.0,
        "floor_area_m2": 14000.0,
        "contract_capacity_kw": 2200.0,
        "date_issued": "2026-09-18",
        "stage_code": "Stage2",
        "stage_badge": "Stage 2: 建照核發 (擴建二期)",
        "pipeline_status": "議價簽約中 (一期續約客戶)",
        "pipeline_color": "emerald",
        "notes": "Jane 負責之 S1 既有 Key Account 二期擴廠案，業主對一期發電收益極滿意，已指名二期光儲合約由進金生統包。"
    },
    {
        "permit_no": "(115)南科微電第008號",
        "project_name": "國科會南科高雄園區智慧微電網示範標準廠房暨防救災儲能標案",
        "applicant": "南部科學園區管理局 / 國科會",
        "architect": "宗邁建築師事務所",
        "contractor": "公開招標中 (公共工程標案)",
        "use_category": "C-2 / 公共設施 (示範標準廠房)",
        "structure": "鋼骨鋼筋混凝土 (SRC)",
        "location": "高雄市路竹區南科高雄園區",
        "site_area_m2": 20000.0,
        "building_area_m2": 8000.0,
        "floor_area_m2": 24000.0,
        "contract_capacity_kw": 3000.0,
        "date_issued": "2026-10-01",
        "stage_code": "Stage3",
        "stage_badge": "Stage 3: 公共標案招標 (發包期)",
        "pipeline_status": "備標聯營中 (結合EMS夥伴)",
        "pipeline_color": "cyan",
        "notes": "Julia 負責之 S5 微電網旗艦標案，需建置 800kW 屋頂光電 + 1.2MWh 儲能 + EMS 區域微電網黑啟動功能。"
    }
]

def init_seed_data():
    calc = ROICalculator()
    router = LeadRouter()
    
    leads = []
    for item in SAMPLE_PROJECTS:
        roi = calc.calculate(
            building_area_m2=item["building_area_m2"],
            contract_capacity_kw=item["contract_capacity_kw"]
        )
        item["id"] = f"lead_{len(leads)+1:03d}"
        item["roi_result"] = roi
        assigned_rep, battle_card = router.route_lead(item)
        item["assigned_rep"] = assigned_rep
        item["battle_card"] = battle_card
        leads.append(item)

    with open(LEADS_FILE, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)
    print(f"Initialized {len(leads)} seed leads to {LEADS_FILE}")

if __name__ == "__main__":
    init_seed_data()
