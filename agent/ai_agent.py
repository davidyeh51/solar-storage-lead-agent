"""
業務 AI Agent 核心大腦 (Business Sales Strategy & Consulting Agent)
整合法規專業、建築師生態圈、台電併網知識，提供一鍵戰情分析與即時業務對策諮詢。
"""

from typing import Dict, Any, List, Optional
import json

class SalesStrategyAgent:
    def __init__(self):
        pass

    def generate_strategy_report(self, lead: Dict[str, Any]) -> Dict[str, Any]:
        """針對指定案件產生全方位高階業務作戰報告"""
        applicant = lead.get("applicant", "該企業")
        project_name = lead.get("project_name", "新建工程")
        architect = lead.get("architect", "設計建築師")
        assigned_rep = lead.get("assigned_rep", "Vanessa")
        location = lead.get("location", "南台灣園區")
        roi = lead.get("roi_result", {})
        tech = roi.get("technical_specs", {})
        fin = roi.get("financial_roi", {})
        reg = roi.get("regulations", {})

        solar_kwp = tech.get("suggested_solar_kwp", 0.0)
        ess_kwh = tech.get("suggested_ess_kwh", 0.0)
        total_benefit = fin.get("total_annual_benefit_ntd", 0.0)
        payback = fin.get("payback_years", 0.0)
        is_large = reg.get("is_large_user", False)

        # 1. 執行長/董事長層級亮點摘要 (C-Level Executive Pitch)
        c_level_summary = (
            f"本案【{project_name}】坐落於【{location}】，預計設置屋頂光電 {solar_kwp:,.0f} kWp "
            f"及表後儲能 {ess_kwh:,.0f} kWh。全系統每年可產生約 {tech.get('annual_generation_kwh', 0):,.0f} 度潔淨綠電，"
            f"年化節省電費與售電效益高達 NT$ {total_benefit:,.0f} 元，預計 {payback:.1f} 年即可全額回收投資成本。"
            f"同時每年可為企業減碳 {tech.get('annual_co2_reduction_tons', 0):,.1f} 公噸 CO2e，"
            f"直接滿足《再生能源發展條例》第12-1條強制義務" + ("並符合用電大戶10%法定扣減目標。" if is_large else "並大幅強化 RE100 / CBAM 綠電競爭力。")
        )

        # 2. 建築師事務所技術協同策略 (Architect Strategy)
        architect_strategy = {
            "target": architect,
            "core_message": f"『建築師您好，我們在建照圖說階段提供免費屋頂光電 3D 排佈、結構載重預留檢討（15~18 kg/m²）與台電饋線併網預審，不增加事務所任何簽證負擔，直接協助業主使照驗收 100% 合規！』",
            "deliverables_offered": [
                "免費繪製 CAD / BIM 太陽能模組排佈圖與逆變器走線圖",
                "提供技師簽證級結構額外靜載重計算書（避開採光罩與消防排煙陰影）",
                "台電責任分界點併網箱與表後儲能機房防火區劃（NFPA 855合規）配置建議"
            ],
            "win_win_value": "替建築師免除向建管處與台電解釋光電義務的行政溝通成本，將規格鎖定在進金生能源方案中。"
        }

        # 3. 業主廠務與 ESG 對話話術 (Owner Pitch Script)
        owner_pitch = {
            "decision_maker": "廠務工程處處長 / 永續長 (CSO) / 財務長 (CFO)",
            "key_pain_points": [
                "痛點 1：等拿到建照才找廠商，屋頂結構鋼骨強度不足，事後補強每坪成本多花 25% 以上。",
                "痛點 2：夏季尖峰電價暴漲，台電契約容量超約罰款驚人。",
                "痛點 3：供應鏈客戶要求碳足跡數據與綠電憑證 (T-REC)。"
            ],
            "counter_measures": [
                f"早鳥優勢：現在讓建築師把光電支架與預留孔畫進設計圖，結構一次到位零額外追加款。",
                f"儲能削峰：配置 {ess_kwh:,.0f} kWh 表後儲能，離峰充便宜電、尖峰放電自用，防護超約罰款。",
                f"一站式統包：從規畫、圖說、台電併網、施工到 20 年維運保證，全流程由進金生團隊搞定。"
            ]
        }

        # 4. 業務前線作戰檢核清單 (Sales Checklist)
        checklist = [
            {"step": "D+1", "action": f"確認【{architect}】負責本案之專案建築師名片與電話，由 {assigned_rep} 發送免費圖說協作邀請函。"},
            {"step": "D+3", "action": f"向【{applicant}】總務或廠務部遞送《{project_name} 綠能與表後儲能法規效益建議書》。"},
            {"step": "D+7", "action": "完成建築師事務所面對面技術交流，確認屋頂女兒牆高度與逆變器吊掛點。"},
            {"step": "D+14", "action": "取得初步建照圖說 CAD 檔，出具進金生規格綁定排佈圖。"}
        ]

        return {
            "c_level_summary": c_level_summary,
            "architect_strategy": architect_strategy,
            "owner_pitch": owner_pitch,
            "checklist": checklist,
            "generated_at": "即時智能生成"
        }

    def answer_consulting_query(self, query: str, context: Optional[Dict[str, Any]] = None) -> str:
        """業務 AI 智能對話與諮詢回答"""
        q = query.lower()
        
        if "屏科" in q or "屏東科學園區" in q:
            return (
                "【屏東科學園區 業務攻防策略】\n"
                "1. 現況掌握：屏科已掌握南亞科（3D封測廠）、宇晨材料（高導熱散熱材料，首家動土）、聚和國際（生物緩衝劑/特化大廠），"
                "以及台積電護國神鏈夥伴（帆宣、華懋、和淞、兆聯、安葆、矽科宏晟等）。\n"
                "2. 最佳切入時機：目前各廠正處於由園區審議核准轉向建照申請/都審之交會期（建照核發前6~12個月）。\n"
                "3. 行動指派：應由 Vanessa 立即主動拜訪其廠務機電主管與負責建築師（如許銘陽建築師、潘冀建築師），"
                "主攻『半導體級結構預留 + 表後儲能抗壓降 + 法規義務全合規』，搶先在圖說定案前卡位！"
            )
        elif "白埔" in q or "白埔產業園區" in q:
            return (
                "【高雄白埔產業園區 業務攻防策略】\n"
                "1. 現況掌握：白埔產業園區盛大動土，為高雄半導體S廊帶台積電先進製程關鍵零組件與封裝設備重鎮，逾20家半導體指標企業出席。\n"
                "2. 法規紅利：園區環評書件明確承諾高標準再生能源設置比例（屋頂光電覆蓋率達 50% 以上），業主有極高之法規合規剛性需求。\n"
                "3. 切入點：主推綠建築與屋頂光電一體化，並針對高精密製程規劃表後微電網與不斷電儲能系統 (UPS/ESS)，由 Vanessa 與 Julia 協同出擊。"
            )
        elif "建築師" in q or "圖說" in q or "結構" in q:
            return (
                "【建築師合作與攻防指引】\n"
                "建築師的核心痛點是：擔心光電板破壞防水、增加結構簽證責任、台電審查繁瑣。\n"
                "業務話術重點：\n"
                "1. 『我們由專業結構技師出具無穿透式夾具 (Kliplok/防水工法) 與 15~18 kg/m² 額外靜載重簽證，絕不造成漏水或結構安全問題。』\n"
                "2. 『全套台電送審圖說與《再生能源發展條例》第12-1條義務檢討，進金生能源全程代辦，建築師只要簽核即可。』\n"
                "3. 推薦重點合作所：九典（綠建築首選）、潘冀（半導體晶圓廠首選）、喻台生（工業區大型廠房）、許銘陽（屏東/高雄在地霸主）。"
            )
        elif "用電大戶" in q or "5mw" in q or "法規" in q:
            return (
                "【用電大戶條款與法規精華】\n"
                "1. 門檻與義務：契約容量 ≥ 5,000 kW (5MW) 之工業大戶，需於 5 年內設置契約容量 10% 之再生能源 (如 500kW)，或配置同等儲能系統 (2小時放電即 1,000kWh)。\n"
                "2. 《再生能源發展條例》第 12-1 條：新建、改建建築面積達 1,000 m² (約300坪) 以上廠房，起造人強制設置屋頂太陽能。\n"
                "3. 效益整合：自建太陽光電自發自用省電（每度省約 5.8 元）+ 表後儲能削峰填谷（尖離峰套利），約 5.5~6.5 年即可全額回收，是業主絕佳的資產投資！"
            )
        else:
            return (
                "【智馳光儲 業務 AI 顧問建議】\n"
                "針對您詢問的商機，關鍵在於『建廠生命週期前置攔截』：\n"
                "1. Stage 1 (環評/招商)：透過情報雷達鎖定購地與審議名單，在建築師剛開始畫圖時接觸。\n"
                "2. Stage 2 (建照/都審)：調閱 C1/C2 執照存根，主動提供免費 3D 光電排佈與結構載重預留，將規格綁入圖說。\n"
                "3. 團隊分工：新園區大戶交由 Vanessa，舊客擴廠交由 Jane，微電網公有標案交由 Julia，Lucy 統一監控雙週報。"
            )
