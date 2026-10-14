"""
建照資料智慧解析與過濾引擎 (Building Permit Parser & Analyzer)
支援解析自由文字存根、CSV、JSON格式建照資料，
自動萃取 C1/C2 工業廠房、起造人、建築師、面積，並即時串接法規義務試算與派案引擎。
"""

import re
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from .roi_calculator import ROICalculator
from .lead_router import LeadRouter

class PermitParser:
    def __init__(self):
        self.roi_calc = ROICalculator()
        self.router = LeadRouter()

    def parse_permit_text(self, text: str) -> Dict[str, Any]:
        """從複製的建管執照存根或文字中萃取關鍵欄位"""
        data = {
            "permit_no": "",
            "applicant": "",
            "architect": "",
            "contractor": "",
            "use_category": "C-2 (一般廠房)",
            "structure": "鋼骨構造 (S)",
            "site_area_m2": 0.0,
            "building_area_m2": 0.0,
            "floor_area_m2": 0.0,
            "location": "",
            "floors": "地上 4 層 / 地下 0 層",
            "date_issued": datetime.now().strftime("%Y-%m-%d")
        }

        # 執照號碼
        m_permit = re.search(r"(?:執照號碼|執照字號|建照字號|號碼)[:：\s]*([（(]?\d+[)）]?[^\n\r,，]+(?:字第\d+號|\d+))", text)
        if m_permit:
            data["permit_no"] = m_permit.group(1).strip()
        else:
            # 尋找類似 (115)高市工建築字第00123號
            m_gen = re.search(r"([（(]?\d{2,3}[)）]?[^\s]+字第\d+號)", text)
            if m_gen:
                data["permit_no"] = m_gen.group(1).strip()

        # 起造人 (業主)
        m_app = re.search(r"(?:起造人|業主|起造人名稱)[:：\s]*([^\n\r,，]+(?:公司|企業|廠|科技|實業|法人|集團))", text)
        if m_app:
            data["applicant"] = m_app.group(1).strip()
        else:
            m_app2 = re.search(r"(?:起造人)[:：\s]*([^\n\r,，]+)", text)
            if m_app2:
                data["applicant"] = m_app2.group(1).strip()

        # 設計人 (建築師)
        m_arch = re.search(r"(?:設計人|建築師|設計事務所)[:：\s]*([^\n\r,，]+(?:建築師事務所|建築師|聯合建築師))", text)
        if m_arch:
            data["architect"] = m_arch.group(1).strip()
        else:
            m_arch2 = re.search(r"(?:設計人|建築師)[:：\s]*([^\n\r,，]+)", text)
            if m_arch2:
                data["architect"] = m_arch2.group(1).strip()

        # 承造人 (營造廠)
        m_con = re.search(r"(?:承造人|營造廠|營造工程)[:：\s]*([^\n\r,，]+(?:營造|工程|建設))", text)
        if m_con:
            data["contractor"] = m_con.group(1).strip()

        # 使用類組 (C-1, C-2, I, etc.)
        m_use = re.search(r"(?:使用分區|使用類組|類組|用途)[:：\s]*([A-Za-z0-9\-\s\(\)]+)", text)
        if m_use:
            raw_use = m_use.group(1).strip().upper()
            if "C-1" in raw_use or "C1" in raw_use:
                data["use_category"] = "C-1 (特殊廠房/作業廠房)"
            elif "C-2" in raw_use or "C2" in raw_use:
                data["use_category"] = "C-2 (一般工廠/倉儲)"
            elif "I" in raw_use:
                data["use_category"] = "I類 (危險物品類廠房)"
            else:
                data["use_category"] = raw_use

        # 構造種類
        if "SRC" in text or "鋼骨鋼筋混凝土" in text:
            data["structure"] = "鋼骨鋼筋混凝土 (SRC)"
        elif "RC" in text or "鋼筋混凝土" in text:
            data["structure"] = "鋼筋混凝土 (RC)"
        elif "鋼骨" in text or "S造" in text or " S " in text:
            data["structure"] = "鋼骨構造 (S)"

        # 面積萃取 (m2)
        m_barea = re.search(r"(?:建築面積)[:：\s]*([\d,]+(?:\.\d+)?)", text)
        if m_barea:
            data["building_area_m2"] = float(m_barea.group(1).replace(",", ""))

        m_sarea = re.search(r"(?:基地面積)[:：\s]*([\d,]+(?:\.\d+)?)", text)
        if m_sarea:
            data["site_area_m2"] = float(m_sarea.group(1).replace(",", ""))

        m_farea = re.search(r"(?:總樓地板面積|總樓地板)[:：\s]*([\d,]+(?:\.\d+)?)", text)
        if m_farea:
            data["floor_area_m2"] = float(m_farea.group(1).replace(",", ""))

        # 若基地面積存在但無建築面積，預估建築面積為基地面積之 60% 建蔽率
        if data["building_area_m2"] == 0.0 and data["site_area_m2"] > 0:
            data["building_area_m2"] = round(data["site_area_m2"] * 0.6, 1)

        # 基地位置
        m_loc = re.search(r"(?:基地位置|地號|地址|基地座落)[:：\s]*([^\n\r]+)", text)
        if m_loc:
            data["location"] = m_loc.group(1).strip()

        # 發照日期
        m_date = re.search(r"(?:發照日期|核准日期)[:：\s]*([^\n\r]+)", text)
        if m_date:
            data["date_issued"] = m_date.group(1).strip()

        return self.create_lead_from_permit(data)

    def create_lead_from_permit(self, permit_data: Dict[str, Any]) -> Dict[str, Any]:
        """將解析後的建照資料結算法規與ROI，並自動派案"""
        building_area = permit_data.get("building_area_m2", 0.0)
        contract_kw = permit_data.get("contract_capacity_kw", 0.0)
        
        # 若未提供契約容量，依廠房總樓地板面積與產業特性初步推估 (每 1,000 m2 樓地板約需 150~250 kW 契約容量)
        floor_area = permit_data.get("floor_area_m2", 0.0)
        if contract_kw == 0.0:
            base_area = floor_area if floor_area > 0 else (building_area * 2.5)
            contract_kw = round((base_area / 1000.0) * 200.0, 0)
            permit_data["contract_capacity_kw"] = contract_kw

        # 執行 ROI 與法規試算
        roi_result = self.roi_calc.calculate(
            building_area_m2=building_area,
            contract_capacity_kw=contract_kw
        )

        lead_id = f"lead_{int(time.time()*1000)}"
        lead = {
            "id": lead_id,
            "permit_no": permit_data.get("permit_no", f"建照-{int(time.time()%10000)}"),
            "project_name": f"{permit_data.get('applicant', '新建廠房')} 新建工程",
            "applicant": permit_data.get("applicant", "未載明起造人"),
            "architect": permit_data.get("architect", "未載明設計建築師"),
            "contractor": permit_data.get("contractor", "未載明承造營造廠"),
            "use_category": permit_data.get("use_category", "C-2 (一般廠房)"),
            "structure": permit_data.get("structure", "鋼骨構造 (S)"),
            "location": permit_data.get("location", "南台灣產業園區"),
            "site_area_m2": permit_data.get("site_area_m2", 0.0),
            "building_area_m2": building_area,
            "floor_area_m2": floor_area,
            "contract_capacity_kw": contract_kw,
            "date_issued": permit_data.get("date_issued", datetime.now().strftime("%Y-%m-%d")),
            "stage_code": "Stage2",
            "stage_badge": "Stage 2: 建照核發 (黃金攔截期)",
            "pipeline_status": "新進線索 (待首訪)",
            "pipeline_color": "blue",
            "notes": permit_data.get("notes", "建照已核發，建議 3 日內拜訪建築師事務所確認屋頂結構預留與光儲配置。"),
            "roi_result": roi_result
        }

        # 執行 STP 智慧派案
        assigned_rep, battle_card = self.router.route_lead(lead)
        lead["assigned_rep"] = assigned_rep
        lead["battle_card"] = battle_card

        return lead
