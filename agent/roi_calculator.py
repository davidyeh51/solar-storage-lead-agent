"""
再生能源發展條例法規義務與光儲 ROI 試算核心
依據《再生能源發展條例》第12-1條、用電大戶條款及南台灣日照條件進行高精度財務與技術估算
"""

from typing import Dict, Any, Optional
from .config import REGULATION_PARAMS

class ROICalculator:
    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.p = REGULATION_PARAMS.copy()
        if params:
            self.p.update(params)

    def calculate(
        self,
        building_area_m2: float,
        contract_capacity_kw: float = 0.0,
        usable_roof_ratio: Optional[float] = None,
        sun_hours: Optional[float] = None,
        electricity_rate: Optional[float] = None,
        custom_solar_kwp: Optional[float] = None,
        custom_ess_kwh: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        輸入建築面積、契約容量等，輸出完整光儲規劃與投資回報
        """
        building_area_m2 = max(0.0, float(building_area_m2))
        contract_capacity_kw = max(0.0, float(contract_capacity_kw))
        
        ratio = usable_roof_ratio if usable_roof_ratio is not None else self.p["roof_usable_ratio"]
        annual_hours = sun_hours if sun_hours is not None else self.p["annual_sun_hours"]
        rate = electricity_rate if electricity_rate is not None else self.p["electricity_tariff_saving_rate"]

        # 1. 法規義務判定: 《再生能源發展條例》第12-1條 (建築面積 >= 1000 m2)
        is_solar_mandatory = building_area_m2 >= self.p["mandatory_roof_threshold_m2"]
        
        # 屋頂可用光電面積 (m2)
        usable_roof_m2 = building_area_m2 * ratio
        
        # 建議屋頂光電設置容量 (kWp)
        if custom_solar_kwp is not None and custom_solar_kwp > 0:
            suggested_solar_kwp = round(custom_solar_kwp, 1)
        else:
            suggested_solar_kwp = round(usable_roof_m2 / self.p["m2_per_kwp"], 1)

        # 2. 用電大戶法規義務判定: 契約容量 >= 5000 kW (5MW)
        is_large_user = contract_capacity_kw >= self.p["large_user_threshold_kw"]
        large_user_obligation_kw = 0.0
        if is_large_user:
            large_user_obligation_kw = round(contract_capacity_kw * self.p["large_user_obligation_ratio"], 1)

        # 3. 表後儲能 (BTM ESS) 規劃建議
        # 儲能配置建議邏輯：
        # - 若為用電大戶 (>=5MW)：建議配置 2 小時放電儲能以滿足義務或削峰填谷 (約契約容量 10%~20%)
        # - 若有光電系統：建議配置約光電容量之 20%~40% 功率、2 小時電量 (kWh)
        if custom_ess_kwh is not None and custom_ess_kwh > 0:
            suggested_ess_kwh = round(custom_ess_kwh, 1)
            suggested_ess_kw = round(suggested_ess_kwh / 2.0, 1)
        else:
            if is_large_user:
                suggested_ess_kw = round(max(large_user_obligation_kw, suggested_solar_kwp * 0.3), 1)
                suggested_ess_kwh = round(suggested_ess_kw * 2.0, 1)
            elif suggested_solar_kwp >= 200.0:
                suggested_ess_kw = round(suggested_solar_kwp * 0.25, 1)
                suggested_ess_kwh = round(suggested_ess_kw * 2.0, 1)
            else:
                suggested_ess_kw = round(suggested_solar_kwp * 0.15, 1)
                suggested_ess_kwh = round(suggested_ess_kw * 2.0, 1)

        # 4. 年發電量與減碳效益
        annual_generation_kwh = round(suggested_solar_kwp * annual_hours, 0)
        annual_co2_reduction_tons = round((annual_generation_kwh * self.p["co2_factor_kg_per_kwh"]) / 1000.0, 1)

        # 5. 年化經濟收益 (NT$)
        # 太陽能發電自發自用省電費 / 綠電轉供收入
        annual_solar_revenue = round(annual_generation_kwh * rate, 0)
        
        # 儲能削峰填谷年套利效益 (以尖離峰價差約 4.5 NT$/kWh、年充放 300 次估算)
        annual_ess_arbitrage = round(suggested_ess_kwh * 4.5 * 300 * 0.88, 0) # 88% round-trip efficiency
        
        # 儲能超約罰款預防與需量反應附加效益估算
        annual_ess_demand_saving = round(suggested_ess_kw * 230.0 * 12.0 * 0.7, 0) if contract_capacity_kw > 0 else 0.0

        total_annual_benefit = annual_solar_revenue + annual_ess_arbitrage + annual_ess_demand_saving

        # 6. 建置資本支出 (CAPEX 估算 NT$)
        solar_capex = round(suggested_solar_kwp * self.p["solar_epc_cost_per_kwp"], 0)
        ess_capex = round(suggested_ess_kwh * self.p["ess_epc_cost_per_kwh"], 0)
        total_capex = solar_capex + ess_capex

        # 7. 投資回收期 (年)
        payback_years = round(total_capex / total_annual_benefit, 1) if total_annual_benefit > 0 else 0.0

        # 8. 給建築師與結構工程師的技術指引
        architect_notes = [
            f"屋頂載重預留：鋼構/SRC廠房建議預留 15~18 kg/m² 額外靜載重（含太陽能支架、雙面玻璃模組與走道維護通道）。",
            f"台電饋線預留：太陽能容量 {suggested_solar_kwp:,.0f} kWp 需預留低壓 (380V) 或高壓 (11.4kV/22.8kV) 變壓器與逆變器 (Inverter) 機房空間。",
            f"儲能防護區劃：表後儲能 {suggested_ess_kwh:,.0f} kWh 需獨立防火區劃，建議設置於地面層戶外或半戶外機房，符合 NFPA 855 及消防法規要求。",
            f"女兒牆與採光排煙罩：建照圖說需避開採光罩與排煙窗投影陰影區，確保光電無陰影遮蔽效益極大化。"
        ]

        return {
            "inputs": {
                "building_area_m2": building_area_m2,
                "building_area_ping": round(building_area_m2 * 0.3025, 1),
                "contract_capacity_kw": contract_capacity_kw,
                "usable_roof_ratio": ratio,
                "annual_sun_hours": annual_hours,
                "electricity_rate": rate
            },
            "regulations": {
                "is_solar_mandatory": is_solar_mandatory,
                "mandatory_note": "符合《再生能源發展條例》第12-1條（新建物屋頂光電強制設置義務）" if is_solar_mandatory else "未達1,000m²強制門檻，建議自願綠能規劃",
                "is_large_user": is_large_user,
                "large_user_note": f"符合「用電大戶條款」（契約容量 ≥ 5,000kW），法定綠能義務量約 {large_user_obligation_kw:,.0f} kW" if is_large_user else "未達5,000kW用電大戶門檻"
            },
            "technical_specs": {
                "usable_roof_m2": round(usable_roof_m2, 1),
                "suggested_solar_kwp": suggested_solar_kwp,
                "suggested_ess_kw": suggested_ess_kw,
                "suggested_ess_kwh": suggested_ess_kwh,
                "annual_generation_kwh": annual_generation_kwh,
                "annual_co2_reduction_tons": annual_co2_reduction_tons,
                "architect_notes": architect_notes
            },
            "financial_roi": {
                "solar_capex_ntd": solar_capex,
                "ess_capex_ntd": ess_capex,
                "total_capex_ntd": total_capex,
                "annual_solar_revenue_ntd": annual_solar_revenue,
                "annual_ess_arbitrage_ntd": annual_ess_arbitrage,
                "annual_ess_demand_saving_ntd": annual_ess_demand_saving,
                "total_annual_benefit_ntd": total_annual_benefit,
                "payback_years": payback_years,
                "roi_20yr_irr_approx": round(((total_annual_benefit * 20 - total_capex) / total_capex) * 100 / 20, 1)
            }
        }
