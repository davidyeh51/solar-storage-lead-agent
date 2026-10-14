"""
STP 業務智慧派案引擎 (Lead Routing & Battle Card Generator)
依據起造人特徵、建廠生命週期、用電規模與案場型態自動分派給 Lucy, Vanessa, Jane, Julia
並產生客製化業務作戰卡 (Sales Battle Card)。
"""

from typing import Dict, Any, Tuple
from .config import TEAM_MEMBERS

class LeadRouter:
    def __init__(self):
        self.members = TEAM_MEMBERS

    def route_lead(self, lead: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """
        核心分派演算法：
        1. 檢查是否為 S5 微電網 / 公共工程 / 校園標案 -> Julia
        2. 檢查是否為 既有 Key Account 擴廠案 -> Jane
        3. 檢查是否為 新興園區 (屏科TSMC鏈、白埔、橋科、南科三期) 或 大用電 (>=5MW) -> Vanessa
        4. 其餘案件由 Lucy 進行行銷培育或分流
        """
        applicant = lead.get("applicant", "")
        project_name = lead.get("project_name", "")
        lead_type = lead.get("lead_type", "")
        category = lead.get("use_category", "")
        contract_kw = float(lead.get("contract_capacity_kw", 0.0) or 0.0)
        location = lead.get("location", "")
        notes = lead.get("notes", "")
        source_stage = lead.get("stage_code", "")

        assigned_rep = "Vanessa" # 預設主力先鋒
        routing_reason = ""
        strategy = ""
        action_plan = []

        combined_text = f"{applicant} {project_name} {lead_type} {location} {notes}".lower()

        # 1. 條件檢驗: S5 微電網 / 公有標案 / 校園大樓 / 政府案
        if any(w in combined_text for w in ["標準廠房", "校園", "大學", "標案", "微電網", "防救災", "台電示範", "公有", "國營"]):
            assigned_rep = "Julia"
            routing_reason = "符合 S5 微電網/公共標案分群：包含標準廠房、示範微電網或防救災韌性用電場域。"
            strategy = "以「高韌性微電網 (Microgrid) + EMS 智慧能源管理 + 夥伴儲能系統」切入，主打台電電網韌性與不斷電防災效益。"
            action_plan = [
                "透過政府電子採購網追蹤招標規範與截標期限",
                "邀約工研院/大專院校或 EMS 合作夥伴組成聯合計畫投標隊伍",
                "向業主或招標單位進行『全台首座韌性微電網示範場域』簡報"
            ]

        # 2. 條件檢驗: 既有 Key Account 擴廠案 (二期/擴建/關係企業)
        elif any(w in combined_text for w in ["擴廠", "二期", "擴建", "舊廠", "既有客戶", "續約", "增建"]):
            assigned_rep = "Jane"
            routing_reason = "符合 S1 Key Account 擴廠分群：業主為既有客戶之擴建或二期廠房，重疊回購轉化率最高。"
            strategy = "主打「既有服務升級、新舊廠發電綜合代管、既有光儲系統一鍵擴充、優先保留饋線配額」。"
            action_plan = [
                "調閱該業主一期案場歷史發電數據與滿意度報告",
                "於 3 日內主動致電原廠務窗口，提供二期新廠免費屋頂光電法規義務預檢",
                "約訪總經理或總務處長，爭取不用比價直接議價統包"
            ]

        # 3. 條件檢驗: S1 新客 & S2 新興園區 (屏科TSMC神鏈、白埔、橋科、南科三期、>=5MW大戶)
        elif any(w in combined_text for w in ["屏科", "屏東科學園區", "白埔", "橋科", "橋頭", "南科三期", "南科", "台積電", "供應鏈", "半導體"]) or contract_kw >= 5000:
            assigned_rep = "Vanessa"
            routing_reason = "符合 S1/S2 重點拓客指標：坐落於南台灣高科技新興聚落（或契約容量 ≥ 5MW 用電大戶），屬高價值關鍵戰略客戶。"
            strategy = "主打「法規強制義務 100% 合規 + RE100 / CBAM 綠電憑證供應 + 尖離峰削峰填谷表後儲能」。"
            action_plan = [
                "調閱設計人（建築師）與承造人清單，搶在建照掛件與都審前進行『免費圖說協作與結構載重簽證』拜訪",
                "提供客製化《新廠綠電與儲能效益試算書》，換算年省電費與 20 年收益",
                "拜訪廠務總監與 ESG 永續長，提供 RE100 自發自用合規路徑規劃"
            ]

        # 4. 其他早期線索 -> 先交由 Lucy 進行行銷培育或分流
        else:
            if source_stage == "Stage1":
                assigned_rep = "Vanessa"
                routing_reason = "早期環評/招商情報：需前線先鋒先行刺探園區進駐時程。"
                strategy = "透過園區招商說明會或環評書件承諾比例，搶先接觸業主籌備處。"
                action_plan = [
                    "追蹤廠商環評書件再生能源承諾比例",
                    "拜訪建築師事務所，提供結構預留諮詢"
                ]
            else:
                assigned_rep = "Lucy"
                routing_reason = "一般工業廠房：納入《雙週情報快訊》進行名單培育，待建築師或起造人確認後分派。"
                strategy = "發送《2026 最新工業廠房屋頂光電強制法規白皮書》給業主與建築師。"
                action_plan = [
                    "列入雙週潛在客戶名單追蹤",
                    "電訪確認建廠預計動工時間點"
                ]

        rep_info = self.members.get(assigned_rep, self.members["Vanessa"])

        # 生成作戰卡片 (Battle Card)
        battle_card = {
            "assigned_rep": assigned_rep,
            "rep_name": rep_info["name"],
            "rep_role": rep_info["role"],
            "rep_email": rep_info["email"],
            "routing_reason": routing_reason,
            "core_strategy": strategy,
            "action_plan": action_plan,
            "target_contacts": [
                "建築師事務所（設計主持人 / 專案建築師）—— 爭取畫進建照圖說",
                "業主廠務工程處處長 / 總務部經理 —— 決定機電與能源配置",
                "業主永續長 (CSO) / 財務長 (CFO) —— 關心 RE100、減碳與投資回收期"
            ],
            "sales_pitch_highlights": [
                "『我們在建築師畫圖階段提供免費 3D 光電排佈、結構載重安全係數試算與台電饋線併網預審，不增加建築師任何負擔！』",
                "『新廠只要依法規規劃太陽光電與儲能，不僅能完全符合《再生能源發展條例》第12-1條，年化更可省下數百萬元高價尖峰電費！』",
                "『進金生能源擁有逾 20 年光電儲能 EPC 實績，提供 20 年發電保證與原廠一級維運代管，讓新廠驗收使照一氣呵成！』"
            ]
        }

        return assigned_rep, battle_card
