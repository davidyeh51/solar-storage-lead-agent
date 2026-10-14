"""
高頻率工業廠房建築師與營造廠白名單網絡庫 (Architect & EPC Network)
落實「改變攻擊節點 —— 從找業主提前到綁定建築師與廠務統包」戰略
"""

import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from .config import ARCHITECTS_FILE

DEFAULT_ARCHITECTS = [
    {
        "id": "arch_001",
        "name": "九典聯合建築師事務所",
        "principal": "張清華 / 郭英釗 建築師",
        "location": "台北 / 高雄辦公室",
        "specialty": "頂級綠建築、低碳工業廠房、太陽能BIPV一體化整合",
        "c_class_frequency": "極高 (Top 1)",
        "representative_projects": ["台積電南科綠建築廠房", "高雄氣候示範園區", "科學園區研發大樓"],
        "partner_epc": ["達欣工程", "互助營造", "聖暉工程"],
        "cooperation_status": "圖說規格綁定中",
        "cooperation_color": "emerald",
        "collaboration_notes": "事務所對《再生能源發展條例》第12-1條屋頂光電要求極為重視，樂於由專業光儲業者協助繪製3D光電配置圖與台電審查預估。"
    },
    {
        "id": "arch_002",
        "name": "潘冀聯合建築師事務所 (JJP)",
        "principal": "潘冀 / 蘇重威 建築師",
        "location": "台北 / 新竹 / 台南辦公室",
        "specialty": "半導體晶圓廠、高科技研發總部、精密製造廠房",
        "c_class_frequency": "極高 (Top 2)",
        "representative_projects": ["台積電全球研發中心", "聯發科竹科總部", "南亞科先進廠房", "南科半導體廠"],
        "partner_epc": ["漢唐集成", "帆宣系統", "亞翔工程", "大陸工程"],
        "cooperation_status": "法規諮詢協作中",
        "cooperation_color": "blue",
        "collaboration_notes": "專精半導體製程，高度關注振動隔離 (Vibration Control) 與表後儲能防護區劃 (NFPA 855)。建議由 Vanessa 攜同技術團隊拜訪。"
    },
    {
        "id": "arch_003",
        "name": "喻台生建築師事務所",
        "principal": "喻台生 建築師",
        "location": "台北 / 高雄",
        "specialty": "工業區大型標準廠房、倉儲物流中心、精密機械廠房",
        "c_class_frequency": "高 (Top 3)",
        "representative_projects": ["經濟部工業區標準廠房", "楠梓產業園區廠房", "白埔產業園區規劃案"],
        "partner_epc": ["根基營造", "中鹿營造"],
        "cooperation_status": "已完成法規試算",
        "cooperation_color": "cyan",
        "collaboration_notes": "主辦白埔園區與南台灣多個工業區廠房規劃。提供免費「結構載重預留檢討書」即可快速鎖定設計圖規格。"
    },
    {
        "id": "arch_004",
        "name": "許銘陽建築師事務所",
        "principal": "許銘陽 建築師",
        "location": "高雄 / 屏東",
        "specialty": "南台灣在地在地特用化學、金屬扣件、傳產升級智慧綠能廠房",
        "c_class_frequency": "高 (屏東/高雄在地霸主)",
        "representative_projects": ["屏東科學園區進駐廠房", "和發產業園區廠房", "岡山扣件大廠新建案"],
        "partner_epc": ["甲級在地營造廠", "山林水", "義力營造"],
        "cooperation_status": "密切拜訪洽談中",
        "cooperation_color": "amber",
        "collaboration_notes": "掌握屏東科學園區及高雄在地多起 C1/C2 廠房案源。非常歡迎光電儲能 EPC 提供一條龍台電饋線代辦與法規背書。"
    },
    {
        "id": "arch_005",
        "name": "趙建銘建築師事務所",
        "principal": "趙建銘 建築師",
        "location": "高雄市",
        "specialty": "現代工業美學廠房、科技總部、智慧微電網整合展示中心",
        "c_class_frequency": "中高",
        "representative_projects": ["高雄多功能經貿園區", "南科高雄園區生技廠房"],
        "partner_epc": ["潤弘精密", "建國工程"],
        "cooperation_status": "未接觸 (待指派拜訪)",
        "cooperation_color": "gray",
        "collaboration_notes": "重視建築立面美感與太陽光電系統整合度，切入時應展示高質感黑框單晶模組與無外露管線設計方案。"
    },
    {
        "id": "arch_006",
        "name": "宗邁建築師事務所",
        "principal": "費宗澄 / 陳邁 建築師",
        "location": "台北 / 台南",
        "specialty": "大專院校大樓、公有示範設施、大型公共工程與微電網場域",
        "c_class_frequency": "中高 (S5微電網重點)",
        "representative_projects": ["成功大學綠能科技研發大樓", "南科育成中心", "公有標準廠房示範案"],
        "partner_epc": ["榮工工程", "皇昌營造"],
        "cooperation_status": "微電網技術交流中",
        "cooperation_color": "purple",
        "collaboration_notes": "適合指派給 Julia 對接，主打 S5 示範型微電網、EMS 整合管理與校園防災儲能專案。"
    }
]

class ArchitectDatabase:
    def __init__(self, file_path: Path = ARCHITECTS_FILE):
        self.file_path = file_path
        self._ensure_init()

    def _ensure_init(self):
        if not self.file_path.exists():
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_ARCHITECTS, f, ensure_ascii=False, indent=2)

    def get_all(self) -> List[Dict[str, Any]]:
        with open(self.file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_by_id(self, arch_id: str) -> Optional[Dict[str, Any]]:
        architects = self.get_all()
        for a in architects:
            if a["id"] == arch_id:
                return a
        return None

    def update_status(self, arch_id: str, new_status: str, notes: Optional[str] = None) -> bool:
        architects = self.get_all()
        updated = False
        color_map = {
            "未接觸": "gray",
            "密切拜訪洽談中": "amber",
            "法規諮詢協作中": "blue",
            "已完成法規試算": "cyan",
            "圖說規格綁定中": "emerald",
            "微電網技術交流中": "purple"
        }
        for a in architects:
            if a["id"] == arch_id:
                a["cooperation_status"] = new_status
                a["cooperation_color"] = color_map.get(new_status, "blue")
                if notes:
                    a["collaboration_notes"] = notes
                updated = True
                break
        if updated:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(architects, f, ensure_ascii=False, indent=2)
        return updated

    def add_architect(self, data: Dict[str, Any]) -> Dict[str, Any]:
        architects = self.get_all()
        new_id = f"arch_{len(architects)+1:03d}"
        data["id"] = new_id
        if "cooperation_color" not in data:
            data["cooperation_color"] = "blue"
        architects.append(data)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(architects, f, ensure_ascii=False, indent=2)
        return data
