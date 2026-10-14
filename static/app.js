/**
 * 智馳光儲 · 早鳥預警拓客 AI 戰情室 前端應用核心 (Vue 3)
 * 支援純靜態 GitHub Pages (含預載資料與前端離線計算) 與本地 FastAPI 雙軌運作
 */

const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

createApp({
  setup() {
    // 預載種子資料 (避免純靜態環境空白)
    const initialSummary = window.SEED_SUMMARY || {
      kpis: {
        total_leads_count: 6,
        early_radar_count: 40,
        total_solar_mw: 8.47,
        total_ess_mwh: 9.17,
        total_annual_revenue_million_ntd: 83.59,
        architect_network_count: 6
      },
      stage_distribution: { Stage1: 1, Stage2: 4, Stage3: 1 },
      rep_distribution: { Vanessa: 4, Jane: 1, Julia: 1, Lucy: 0 },
      radar_updated_at: '即時同步 (2026-10-14)'
    };
    const initialLeads = window.SEED_LEADS ? JSON.parse(JSON.stringify(window.SEED_LEADS)) : [];
    const initialRadar = window.SEED_RADAR ? JSON.parse(JSON.stringify(window.SEED_RADAR)) : [];
    const initialArchitects = window.SEED_ARCHITECTS ? JSON.parse(JSON.stringify(window.SEED_ARCHITECTS)) : [];

    // 狀態定義
    const activeTab = ref('dashboard');
    const isCrawling = ref(false);
    const summary = ref(initialSummary);
    const leads = ref(initialLeads);
    const radarItems = ref(initialRadar);
    const architects = ref(initialArchitects);

    // 頁籤定義
    const tabs = [
      { id: 'dashboard', name: '戰情總覽儀表板', icon: 'layout-dashboard' },
      { id: 'radar', name: '早鳥預警情報雷達', icon: 'radio', badge: '實時' },
      { id: 'leads', name: '建照精準鎖定庫', icon: 'building-2' },
      { id: 'architects', name: '建築師白名單網絡', icon: 'compass' },
      { id: 'calculator', name: '法規光儲 ROI 試算', icon: 'calculator' },
      { id: 'parser', name: '建照存根快速解析', icon: 'file-input' },
      { id: 'ai_consult', name: 'AI 業務智囊助理', icon: 'bot' }
    ];

    // 篩選狀態
    const leadsSearchQuery = ref('');
    const leadsFilterRep = ref('ALL');
    const radarFilterCategory = ref('ALL');

    // 試算器狀態
    const calcInputs = ref({
      building_area_m2: 8000,
      contract_capacity_kw: 3500,
      usable_roof_ratio: 0.65,
      electricity_rate: 5.8
    });
    const calcResult = ref({});

    // 建照解析器狀態
    const rawPermitText = ref('');
    const parsedResult = ref(null);

    // Supabase 雲端整合狀態
    const showSupabaseModal = ref(false);
    const supabaseIsConnected = ref(false);
    const supabaseTableReady = ref(false);
    const supabaseStatusText = ref('Supabase 偵測中...');
    const supabaseStatusClass = ref('bg-slate-800 text-slate-300 border-slate-700');
    const supabaseDotClass = ref('bg-slate-500');
    const supabaseStatusMessage = ref('正在偵測 Supabase 狀態...');
    const supabaseUrlInput = ref(window.supabaseManager?.url || 'https://cowljafosekwvxithwjd.supabase.co');
    const supabaseKeyInput = ref(window.supabaseManager?.key || '');
    const supabaseTesting = ref(false);
    const sqlCopied = ref(false);

    // 雙週報 Modal
    const showBiweeklyModal = ref(false);
    const biweeklyReportText = ref('');
    const copySuccess = ref(false);

    // AI 作戰卡 Modal
    const showStrategyModal = ref(false);
    const currentStrategyLead = ref(null);
    const currentStrategyReport = ref(null);

    // AI 對話
    const chatMessages = ref([
      {
        role: 'agent',
        content: '您好！我是「智馳光儲·業務 AI 戰情顧問」。我已載入南台灣各工業園區（屏東科學園區、高雄白埔、橋科、南科三期）、高頻工業建築師名單與《再生能源發展條例》第12-1條最新規範。\n您可以點擊左側推薦題庫，或直接輸入任何案場、建築師拜訪話術或法規疑問！',
        time: '剛剛'
      }
    ]);
    const aiInputText = ref('');
    const isAiThinking = ref(false);

    const promptPresets = [
      '屏東科學園區（宇晨、聚和、帆宣）進駐廠商如何早期攻防？',
      '建築師擔心屋頂光電破壞防水與結構安全，業務如何破冰？',
      '用電大戶條款（契約容量 ≥ 5MW）如何搭配表後儲能削峰填谷？',
      '白埔產業園區環評通過，有哪些關鍵供應鏈值得立刻拜訪？',
      '如何說服業主在建築設計階段就把光電儲能畫進建照圖說？'
    ];

    // 重新渲染 Lucide 圖示
    const refreshIcons = () => {
      nextTick(() => {
        if (window.lucide) {
          window.lucide.createIcons();
        }
      });
    };

    // 監聽頁籤切換
    watch(activeTab, () => {
      refreshIcons();
    });

    // --- API 請求與離線容錯 ---

    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/summary');
        if (res.ok) {
          summary.value = await res.json();
          return;
        }
      } catch (e) {
        // 離線或 GitHub Pages 靜態環境
      }
      // 純靜態時重新動態結算當前案場的 KPI
      calculateLocalSummary();
    };

    const calculateLocalSummary = () => {
      const list = leads.value;
      const totalSolarKw = list.reduce((acc, l) => acc + (l.roi_result?.technical_specs?.suggested_solar_kwp || 0), 0);
      const totalEssKwh = list.reduce((acc, l) => acc + (l.roi_result?.technical_specs?.suggested_ess_kwh || 0), 0);
      const totalRev = list.reduce((acc, l) => acc + (l.roi_result?.financial_roi?.total_annual_benefit_ntd || 0), 0);

      summary.value = {
        kpis: {
          total_leads_count: list.length,
          early_radar_count: radarItems.value.length,
          total_solar_mw: Math.round(totalSolarKw / 1000 * 100) / 100,
          total_ess_mwh: Math.round(totalEssKwh / 1000 * 100) / 100,
          total_annual_revenue_million_ntd: Math.round(totalRev / 1000000 * 100) / 100,
          architect_network_count: architects.value.length
        },
        stage_distribution: {
          Stage1: list.filter(l => l.stage_code === 'Stage1').length,
          Stage2: list.filter(l => l.stage_code === 'Stage2').length,
          Stage3: list.filter(l => l.stage_code === 'Stage3').length
        },
        rep_distribution: {
          Vanessa: list.filter(l => l.assigned_rep === 'Vanessa').length,
          Jane: list.filter(l => l.assigned_rep === 'Jane').length,
          Julia: list.filter(l => l.assigned_rep === 'Julia').length,
          Lucy: list.filter(l => l.assigned_rep === 'Lucy').length
        },
        radar_updated_at: '即時同步 (2026-10-14)'
      };
    };

    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (res.ok) {
          leads.value = await res.json();
          return;
        }
      } catch (e) {
        // fallback
      }
      if (!leads.value || leads.value.length === 0) {
        leads.value = window.SEED_LEADS ? JSON.parse(JSON.stringify(window.SEED_LEADS)) : [];
      }
    };

    const fetchRadar = async () => {
      try {
        const res = await fetch('/api/radar');
        if (res.ok) {
          const data = await res.json();
          radarItems.value = data.items || [];
          return;
        }
      } catch (e) {
        // fallback
      }
      if (!radarItems.value || radarItems.value.length === 0) {
        radarItems.value = window.SEED_RADAR ? JSON.parse(JSON.stringify(window.SEED_RADAR)) : [];
      }
    };

    const fetchArchitects = async () => {
      try {
        const res = await fetch('/api/architects');
        if (res.ok) {
          architects.value = await res.json();
          return;
        }
      } catch (e) {
        // fallback
      }
      if (!architects.value || architects.value.length === 0) {
        architects.value = window.SEED_ARCHITECTS ? JSON.parse(JSON.stringify(window.SEED_ARCHITECTS)) : [];
      }
    };

    const triggerCrawler = async () => {
      isCrawling.value = true;
      try {
        const res = await fetch('/api/radar/refresh', { method: 'POST' });
        if (res.ok) {
          await fetchRadar();
          await fetchSummary();
        } else {
          // GitHub Pages 模擬重新整理
          await new Promise(r => setTimeout(r, 800));
          alert('💡 提示：目前處於 GitHub Pages 純靜態展示環境，已刷新本機 40 筆實時情報雷達快取！');
        }
      } catch (e) {
        alert('💡 提示：目前處於 GitHub Pages 純靜態展示環境，已刷新本機 40 筆實時情報雷達快取！');
      } finally {
        isCrawling.value = false;
        refreshIcons();
      }
    };

    const convertRadarToLead = async (item) => {
      const applicant = (item.detected_companies && item.detected_companies.length > 0) ? item.detected_companies[0] : "情報標註企業";
      const location = (item.detected_parks && item.detected_parks.length > 0) ? item.detected_parks[0] : "南台灣新興產業園區";
      const isHigh = item.title.includes('台積電') || item.title.includes('半導體');
      const buildingArea = isHigh ? 12000 : 6000;
      const contractKw = isHigh ? 5000 : 2000;
      
      const newLead = {
        id: `lead_${Date.now()}`,
        permit_no: `早鳥預警-${Math.floor(Math.random()*9000)+1000}`,
        project_name: `${applicant} ${location} 新建案 (早鳥)`,
        applicant: applicant,
        architect: "尚未確定 (爭取早鳥協作)",
        contractor: "工程籌備中",
        use_category: "C-1 / C-2 廠房新建",
        structure: "鋼骨構造 (S)",
        location: location,
        site_area_m2: buildingArea * 1.8,
        building_area_m2: buildingArea,
        floor_area_m2: buildingArea * 3,
        contract_capacity_kw: contractKw,
        date_issued: new Date().toISOString().split('T')[0],
        stage_code: item.stage_code || "Stage1",
        stage_badge: item.stage_badge || "Stage 1: 早期預警",
        pipeline_status: "早鳥攔截中 (刺探籌備處)",
        pipeline_color: "amber",
        assigned_rep: "Vanessa",
        notes: `來源：${item.source} - ${item.title}`,
        roi_result: computeClientRoi(buildingArea, contractKw),
        battle_card: {
          assigned_rep: "Vanessa",
          rep_name: "Vanessa",
          rep_role: "前線主力 (S1新客 / S2新園區)",
          routing_reason: "早期情報雷達萃取之南台灣重點園區廠商，列為先鋒拓客目標。",
          core_strategy: "搶在都審與建照送件前接觸籌備處，主攻法規強制光電義務與表後儲能削峰填谷。"
        }
      };

      try {
        const res = await fetch('/api/radar/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          const cloudLead = await res.json();
          leads.value.unshift(cloudLead);
        } else {
          leads.value.unshift(newLead);
        }
      } catch (e) {
        leads.value.unshift(newLead);
      }

      // 若已連線 Supabase，同步儲存
      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.upsertLead(newLead);
      }

      calculateLocalSummary();
      alert(`🎉 成功將【${newLead.applicant}】轉換為追蹤商機！已自動分派給 ${newLead.assigned_rep}。`);
      activeTab.value = 'leads';
      refreshIcons();
    };

    const filterByRep = (rep) => {
      leadsFilterRep.value = rep;
      activeTab.value = 'leads';
    };

    const selectLead = (lead) => {
      openStrategyModal(lead);
    };

    const openStrategyModal = async (lead) => {
      currentStrategyLead.value = lead;
      showStrategyModal.value = true;
      try {
        const res = await fetch('/api/ai_consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: lead.id })
        });
        if (res.ok) {
          const data = await res.json();
          currentStrategyReport.value = data.report;
          refreshIcons();
          return;
        }
      } catch (e) {
        // fallback to client generation
      }
      
      // 前端本機產生作戰卡
      const tech = lead.roi_result?.technical_specs || {};
      const fin = lead.roi_result?.financial_roi || {};
      const solarKwp = tech.suggested_solar_kwp || 0;
      const essKwh = tech.suggested_ess_kwh || 0;
      const totalBenefit = fin.total_annual_benefit_ntd || 0;
      const payback = fin.payback_years || 0;

      currentStrategyReport.value = {
        c_level_summary: `本案【${lead.project_name}】坐落於【${lead.location}】，預計設置屋頂光電 ${solarKwp.toLocaleString()} kWp 及表後儲能 ${essKwh.toLocaleString()} kWh。每年可產生約 ${(tech.annual_generation_kwh||0).toLocaleString()} 度潔淨綠電，年化節省電費與售電效益高達 NT$ ${totalBenefit.toLocaleString()} 元，預計 ${payback} 年即可全額回收投資成本，直接滿足《再生能源發展條例》第12-1條強制義務並提升 ESG 綠電評等。`,
        architect_strategy: {
          target: lead.architect || "專案建築師事務所",
          core_message: `『建築師您好，我們在建照圖說階段提供免費屋頂光電 3D 排佈、結構載重預留檢討（15~18 kg/m²）與台電饋線併網預審，不增加事務所任何簽證負擔，直接協助業主使照驗收 100% 合規！』`,
          deliverables_offered: [
            "免費繪製 CAD / BIM 太陽能模組排佈圖與逆變器走線圖",
            "提供技師簽證級結構額外靜載重計算書（避開採光罩與消防排煙陰影）",
            "台電責任分界點併網箱與表後儲能機房防火區劃（NFPA 855合規）配置建議"
          ]
        },
        owner_pitch: {
          key_pain_points: [
            "痛點 1：等拿到建照才找廠商，屋頂結構鋼骨強度不足，事後補強每坪成本多花 25% 以上。",
            "痛點 2：夏季尖峰電價暴漲，台電契約容量超約罰款驚人。",
            "痛點 3：供應鏈客戶要求碳足跡數據與綠電憑證 (T-REC)。"
          ],
          counter_measures: [
            `早鳥優勢：現在讓建築師把光電支架與預留孔畫進設計圖，結構一次到位零額外追加款。`,
            `儲能削峰：配置 ${essKwh.toLocaleString()} kWh 表後儲能，離峰充便宜電、尖峰放電自用，防護超約罰款。`,
            `一站式統包：從規畫、圖說、台電併網、施工到 20 年維運保證，全流程由進金生團隊搞定。`
          ]
        },
        checklist: [
          { step: "D+1", action: `確認【${lead.architect}】負責本案之專案建築師窗口，由 ${lead.assigned_rep} 發送免費圖說協作邀請函。` },
          { step: "D+3", action: `向【${lead.applicant}】總務或廠務部遞送《${lead.project_name} 綠能與表後儲能法規效益建議書》。` },
          { step: "D+7", action: "完成建築師事務所面對面技術交流，確認屋頂女兒牆高度與逆變器吊掛點。" },
          { step: "D+14", action: "取得初步建照圖說 CAD 檔，出具進金生規格綁定排佈圖。" }
        ]
      };
      refreshIcons();
    };

    const openBiweeklyReport = async () => {
      try {
        const res = await fetch('/api/export_biweekly');
        if (res.ok) {
          const data = await res.json();
          biweeklyReportText.value = data.report_markdown;
          showBiweeklyModal.value = true;
          copySuccess.value = false;
          refreshIcons();
          return;
        }
      } catch (e) {
        // fallback
      }
      
      // 前端即時生成雙週報 Markdown
      const nowStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
      let md = `# ☀️ 智馳光儲 · 新園區與新建照潛在客戶雙週報\n`;
      md += `**發布日期**：${nowStr}  \n**統籌主管**：Lucy（行銷主管 / 情報樞紐）  \n**目標市場**：台南、高雄、屏東高用電工業大戶 (S1) 與新興園區擴建 (S2)\n\n---\n\n`;
      md += `## 📊 一、 本期拓客戰情總覽\n`;
      md += `- **追蹤重點案場總數**：${leads.value.length} 件\n`;
      md += `- **實時早鳥預警情報**：${radarItems.value.length} 則（涵蓋環評、科學園區審議、土地標售）\n`;
      md += `- **潛在總屋頂光電規模**：${summary.value.kpis?.total_solar_mw || 0} MWp\n`;
      md += `- **潛在表後儲能規模**：${summary.value.kpis?.total_ess_mwh || 0} MWh\n`;
      md += `- **預估年化發電與套利收益**：NT$ ${summary.value.kpis?.total_annual_revenue_million_ntd || 0} 百萬元 / 年\n\n---\n\n`;
      md += `## 🎯 二、 前線業務派案戰情分流清單\n\n`;
      
      const reps = ['Vanessa', 'Jane', 'Julia'];
      reps.forEach(rep => {
        const repLeads = leads.value.filter(l => l.assigned_rep === rep);
        md += `### 【${rep} 負責專區】(共 ${repLeads.length} 案)\n`;
        repLeads.forEach(l => {
          md += `- **【${l.applicant}】${l.project_name}**\n`;
          md += `  - 執照號：\`${l.permit_no}\` | 階段：\`${l.stage_badge}\`\n`;
          md += `  - 建築師：${l.architect} | 營造廠：${l.contractor}\n`;
          md += `  - 預估配置：光電 \`${l.roi_result?.technical_specs?.suggested_solar_kwp || 0} kWp\` ｜ 儲能 \`${l.roi_result?.technical_specs?.suggested_ess_kwh || 0} kWh\`\n`;
          md += `  - 作戰策略：${l.battle_card?.core_strategy || ''}\n\n`;
        });
      });

      biweeklyReportText.value = md;
      showBiweeklyModal.value = true;
      copySuccess.value = false;
      refreshIcons();
    };

    const copyReportText = () => {
      navigator.clipboard.writeText(biweeklyReportText.value);
      copySuccess.value = true;
      setTimeout(() => { copySuccess.value = false; }, 3000);
    };

    // 前端純 JavaScript ROI 運算核心
    const computeClientRoi = (area, contract, ratio = 0.65, rate = 5.8) => {
      const isMandatory = area >= 1000;
      const isLarge = contract >= 5000;
      const usableRoofM2 = area * ratio;
      const solarKwp = Math.round((usableRoofM2 / 6.2) * 10) / 10;
      const largeObligation = isLarge ? Math.round(contract * 0.1 * 10) / 10 : 0;
      const essKw = isLarge ? Math.max(largeObligation, solarKwp * 0.3) : Math.round(solarKwp * 0.25 * 10) / 10;
      const essKwh = Math.round(essKw * 2.0 * 10) / 10;
      const genKwh = Math.round(solarKwp * 1300);
      const co2Tons = Math.round((genKwh * 0.495) / 1000 * 10) / 10;
      const solarRev = Math.round(genKwh * rate);
      const essArb = Math.round(essKwh * 4.5 * 300 * 0.88);
      const essDemand = contract > 0 ? Math.round(essKw * 230 * 12 * 0.7) : 0;
      const totalBenefit = solarRev + essArb + essDemand;
      const totalCapex = Math.round(solarKwp * 45000 + essKwh * 25000);
      const payback = totalBenefit > 0 ? Math.round((totalCapex / totalBenefit) * 10) / 10 : 0;

      return {
        inputs: {
          building_area_m2: area,
          building_area_ping: Math.round(area * 0.3025),
          contract_capacity_kw: contract,
          usable_roof_ratio: ratio,
          annual_sun_hours: 1300,
          electricity_rate: rate
        },
        regulations: {
          is_solar_mandatory: isMandatory,
          mandatory_note: isMandatory ? '符合《再生能源發展條例》第12-1條（新建物屋頂光電強制設置義務）' : '未達1,000m²強制門檻，建議自願綠能規劃',
          is_large_user: isLarge,
          large_user_note: isLarge ? `符合「用電大戶條款」（契約容量 ≥ 5,000kW），法定義務量約 ${largeObligation.toLocaleString()} kW` : '未達5,000kW用電大戶門檻'
        },
        technical_specs: {
          usable_roof_m2: Math.round(usableRoofM2),
          suggested_solar_kwp: solarKwp,
          suggested_ess_kw: Math.round(essKw),
          suggested_ess_kwh: essKwh,
          annual_generation_kwh: genKwh,
          annual_co2_reduction_tons: co2Tons,
          architect_notes: [
            `屋頂載重預留：鋼構/SRC廠房建議預留 15~18 kg/m² 額外靜載重（含太陽能支架、雙面玻璃模組與走道維護通道）。`,
            `台電饋線預留：太陽能容量 ${solarKwp.toLocaleString()} kWp 需預留低壓 (380V) 或高壓 (11.4kV/22.8kV) 變壓器與逆變器機房空間。`,
            `儲能防護區劃：表後儲能 ${essKwh.toLocaleString()} kWh 需獨立防火區劃，建議設置於地面層戶外或半戶外機房，符合 NFPA 855 及消防法規要求。`,
            `女兒牆與採光排煙罩：建照圖說需避開採光罩與排煙窗投影陰影區，確保光電無陰影遮蔽效益極大化。`
          ]
        },
        financial_roi: {
          solar_capex_ntd: Math.round(solarKwp * 45000),
          ess_capex_ntd: Math.round(essKwh * 25000),
          total_capex_ntd: totalCapex,
          annual_solar_revenue_ntd: solarRev,
          annual_ess_arbitrage_ntd: essArb,
          annual_ess_demand_saving_ntd: essDemand,
          total_annual_benefit_ntd: totalBenefit,
          payback_years: payback
        }
      };
    };

    const recalc = async () => {
      const area = Number(calcInputs.value.building_area_m2) || 0;
      const contract = Number(calcInputs.value.contract_capacity_kw) || 0;
      const ratio = Number(calcInputs.value.usable_roof_ratio) || 0.65;
      const rate = Number(calcInputs.value.electricity_rate) || 5.8;

      try {
        const res = await fetch('/api/roi_calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calcInputs.value)
        });
        if (res.ok) {
          calcResult.value = await res.json();
          return;
        }
      } catch (e) {
        // fallback
      }
      calcResult.value = computeClientRoi(area, contract, ratio, rate);
    };

    // 建照解析器
    const fillSamplePermit = () => {
      rawPermitText.value = `執照字號：(115)屏科建字第009號
起造人：和淞科技股份有限公司
設計人：許銘陽建築師事務所
承造人：達欣工程股份有限公司
使用類組：C-1 (半導體廠務氣化系統廠)
構造種類：鋼骨構造 (S)
基地面積：22,000 平方公尺
建築面積：11,000 平方公尺
總樓地板面積：33,000 平方公尺
基地座落：屏東縣屏東市屏東科學園區
核准日期：2026-10-12
備註：台積電氣化供應鏈夥伴，建照剛核發，需盡速對接屋頂光電圖說預留。`;
    };

    const parsePermitText = async () => {
      const text = rawPermitText.value.trim();
      if (!text) {
        alert('請先輸入或貼上建照文字！');
        return;
      }

      try {
        const res = await fetch('/api/parse_permit_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          parsedResult.value = await res.json();
          return;
        }
      } catch (e) {
        // fallback
      }

      // 前端正規表達式解析
      let permitNo = "(115)建照字號待定";
      let applicant = "新建企業";
      let architect = "專案建築師事務所";
      let contractor = "甲級營造廠";
      let useCat = "C-2 (一般廠房)";
      let structure = "鋼骨構造 (S)";
      let buildingArea = 8000;
      let contractKw = 3000;

      const mPermit = text.match(/(?:執照號碼|執照字號|建照字號|號碼)[:：\s]*([^\n\r]+)/);
      if (mPermit) permitNo = mPermit[1].trim();

      const mApp = text.match(/(?:起造人|業主)[:：\s]*([^\n\r]+)/);
      if (mApp) applicant = mApp[1].trim();

      const mArch = text.match(/(?:設計人|建築師)[:：\s]*([^\n\r]+)/);
      if (mArch) architect = mArch[1].trim();

      const mCon = text.match(/(?:承造人|營造廠)[:：\s]*([^\n\r]+)/);
      if (mCon) contractor = mCon[1].trim();

      const mUse = text.match(/(?:使用類組|類組|用途)[:：\s]*([^\n\r]+)/);
      if (mUse) useCat = mUse[1].trim();

      const mArea = text.match(/(?:建築面積)[:：\s]*([\d,]+)/);
      if (mArea) buildingArea = parseFloat(mArea[1].replace(/,/g, ''));

      parsedResult.value = {
        id: `lead_${Date.now()}`,
        permit_no: permitNo,
        project_name: `${applicant} 新建工程`,
        applicant,
        architect,
        contractor,
        use_category: useCat,
        structure,
        location: "南台灣工業園區",
        site_area_m2: buildingArea * 1.8,
        building_area_m2: buildingArea,
        floor_area_m2: buildingArea * 3,
        contract_capacity_kw: contractKw,
        date_issued: new Date().toISOString().split('T')[0],
        stage_code: "Stage2",
        stage_badge: "Stage 2: 建照核發 (黃金攔截期)",
        pipeline_status: "新進線索 (待首訪)",
        pipeline_color: "blue",
        assigned_rep: "Vanessa",
        notes: "建照已核發，建議 3 日內拜訪建築師事務所確認屋頂結構預留與光儲配置。",
        roi_result: computeClientRoi(buildingArea, contractKw),
        battle_card: {
          assigned_rep: "Vanessa",
          rep_name: "Vanessa",
          rep_role: "前線主力 (S1新客 / S2新園區)",
          routing_reason: "新核准建照之工業廠房，達強制光電義務門檻，主攻建築師圖說綁定。",
          core_strategy: "提供免費結構載重預留檢討書與 3D 光電排佈圖，鎖定進金生方案。"
        }
      };
    };

    const saveParsedLead = async () => {
      if (!parsedResult.value) return;
      const targetLead = parsedResult.value;

      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(targetLead)
        });
      } catch (e) {
        // fallback
      }

      leads.value.unshift(targetLead);
      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.upsertLead(targetLead);
      }

      calculateLocalSummary();
      alert('🎉 成功儲存新案場並完成 STP 智慧派案！');
      activeTab.value = 'leads';
      parsedResult.value = null;
      rawPermitText.value = '';
      refreshIcons();
    };

    // AI 對話
    const askAi = (query) => {
      aiInputText.value = query;
      sendAiQuery();
    };

    const sendAiQuery = async () => {
      const q = aiInputText.value.trim();
      if (!q || isAiThinking.value) return;

      chatMessages.value.push({
        role: 'user',
        content: q,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      aiInputText.value = '';
      isAiThinking.value = true;
      refreshIcons();

      nextTick(() => {
        const container = document.getElementById('chatContainer');
        if (container) container.scrollTop = container.scrollHeight;
      });

      try {
        const res = await fetch('/api/ai_consult', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        if (res.ok) {
          const data = await res.json();
          chatMessages.value.push({
            role: 'agent',
            content: data.answer || '已為您查詢相關情報。',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          return;
        }
      } catch (e) {
        // fallback
      }

      // 本地離線智慧回答
      let fallbackAns = "針對建廠生命週期前置攔截：建議在 Stage 1 (環評/購地) 與 Stage 2 (都審/建照) 搶先拜訪設計建築師，出具免費 3D 光電排佈與結構載重預留檢討書，將進金生規格綁入建照圖說！";
      if (q.includes('屏科') || q.includes('屏東科學園區')) {
        fallbackAns = "【屏東科學園區 業務攻防策略】\n1. 現況掌握：屏科已掌握南亞科（3D封測廠）、宇晨材料（高導熱散熱材料，首家動土）、聚和國際（生物緩衝劑/特化大廠），以及台積電護國神鏈夥伴（帆宣、華懋、和淞、兆聯、安葆、矽科宏晟等）。\n2. 最佳切入時機：目前各廠正處於由園區審議核准轉向建照申請/都審之交會期（建照核發前6~12個月）。\n3. 行動指派：應由 Vanessa 立即主動拜訪其廠務機電主管與負責建築師（如許銘陽建築師、潘冀建築師），主攻『半導體級結構預留 + 表後儲能抗壓降 + 法規義務全合規』！";
      } else if (q.includes('白埔')) {
        fallbackAns = "【高雄白埔產業園區 業務攻防策略】\n1. 現況掌握：白埔產業園區盛大動土，為高雄半導體S廊帶台積電先進製程關鍵零組件與封裝設備重鎮，逾20家半導體指標企業出席。\n2. 法規紅利：園區環評書件明確承諾高標準再生能源設置比例（屋頂光電覆蓋率達 50% 以上），業主有極高之法規合規剛性需求。\n3. 切入點：主推綠建築與屋頂光電一體化，並針對高精密製程規劃表後微電網與不斷電儲能系統 (UPS/ESS)，由 Vanessa 與 Julia 協同出擊。";
      } else if (q.includes('建築師') || q.includes('防水') || q.includes('結構')) {
        fallbackAns = "【建築師合作與攻防指引】\n建築師的核心痛點是：擔心光電板破壞防水、增加結構簽證責任、台電審查繁瑣。\n業務話術重點：\n1. 『我們由專業結構技師出具無穿透式夾具 (Kliplok/防水工法) 與 15~18 kg/m² 額外靜載重簽證，絕不造成漏水或結構安全問題。』\n2. 『全套台電送審圖說與《再生能源發展條例》第12-1條義務檢討，進金生能源全程代辦，建築師只要簽核即可。』\n3. 推薦重點合作所：九典（綠建築首選）、潘冀（半導體晶圓廠首選）、喻台生（工業區大型廠房）、許銘陽（屏東/高雄在地霸主）。";
      } else if (q.includes('用電大戶') || q.includes('5mw')) {
        fallbackAns = "【用電大戶條款與法規精華】\n1. 門檻與義務：契約容量 ≥ 5,000 kW (5MW) 之工業大戶，需於 5 年內設置契約容量 10% 之再生能源 (如 500kW)，或配置同等儲能系統 (2小時放電即 1,000kWh)。\n2. 《再生能源發展條例》第 12-1 條：新建、改建建築面積達 1,000 m² (約300坪) 以上廠房，起造人強制設置屋頂太陽能。\n3. 效益整合：自建太陽光電自發自用省電（每度省約 5.8 元）+ 表後儲能削峰填谷（尖離峰套利），約 5.5~6.5 年即可全額回收，是業主絕佳的資產投資！";
      }

      chatMessages.value.push({
        role: 'agent',
        content: fallbackAns,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      isAiThinking.value = false;
      refreshIcons();
      nextTick(() => {
        const container = document.getElementById('chatContainer');
        if (container) container.scrollTop = container.scrollHeight;
      });
    };

    const updateArchStatus = async (arch) => {
      const statuses = ["密切拜訪洽談中", "法規諮詢協作中", "已完成法規試算", "圖說規格綁定中", "微電網技術交流中"];
      const currentIdx = statuses.indexOf(arch.cooperation_status);
      const nextStatus = statuses[(currentIdx + 1) % statuses.length];
      arch.cooperation_status = nextStatus;

      try {
        await fetch(`/api/architects/${arch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cooperation_status: nextStatus })
        });
      } catch (e) {
        // fallback
      }

      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.updateArchitect(arch.id, { cooperation_status: nextStatus });
      }
    };

    const getStatusBadgeClass = (color) => {
      const map = {
        emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
        gray: 'bg-slate-800 text-slate-400 border-slate-700'
      };
      return map[color] || map.blue;
    };

    // 計算屬性：篩選商機
    const filteredLeads = computed(() => {
      return leads.value.filter(l => {
        if (leadsFilterRep.value !== 'ALL' && l.assigned_rep !== leadsFilterRep.value) return false;
        if (leadsSearchQuery.value) {
          const q = leadsSearchQuery.value.toLowerCase();
          const text = `${l.applicant} ${l.project_name} ${l.architect} ${l.location}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      });
    });

    // 計算屬性：篩選雷達情報
    const filteredRadarItems = computed(() => {
      if (radarFilterCategory.value === 'ALL') return radarItems.value;
      return radarItems.value.filter(it => it.category_id === radarFilterCategory.value);
    });

    // Supabase 雲端互動方法
    const checkSupabaseStatus = async () => {
      if (!window.supabaseManager) return;
      const res = await window.supabaseManager.testConnection();
      supabaseIsConnected.value = res.connected;
      supabaseTableReady.value = res.tableReady;
      supabaseStatusMessage.value = res.message;

      if (res.connected && res.tableReady) {
        supabaseStatusText.value = '🟢 Supabase 雲端已連線';
        supabaseStatusClass.value = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        supabaseDotClass.value = 'bg-emerald-400 shadow-sm shadow-emerald-400';
      } else if (res.connected && !res.tableReady) {
        supabaseStatusText.value = '🟡 雲端專案已通 (待建資料表)';
        supabaseStatusClass.value = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        supabaseDotClass.value = 'bg-amber-400';
      } else {
        supabaseStatusText.value = '⚪ 本機展示模式 (點擊設定)';
        supabaseStatusClass.value = 'bg-slate-800 text-slate-300 border-slate-700';
        supabaseDotClass.value = 'bg-slate-500';
      }
    };

    const testAndSaveSupabase = async () => {
      supabaseTesting.value = true;
      try {
        if (window.supabaseManager) {
          window.supabaseManager.saveConfig(supabaseUrlInput.value, supabaseKeyInput.value);
          await checkSupabaseStatus();
          if (supabaseTableReady.value) {
            const cloudLeads = await window.supabaseManager.getLeads();
            if (cloudLeads && cloudLeads.length > 0) {
              leads.value = cloudLeads;
              calculateLocalSummary();
            }
          }
        }
      } finally {
        supabaseTesting.value = false;
        refreshIcons();
      }
    };

    const syncLocalToCloud = async () => {
      if (!window.supabaseManager || !supabaseTableReady.value) {
        alert('請先在 Supabase SQL Editor 執行 supabase-schema.sql 建立資料表！');
        return;
      }
      let successCount = 0;
      for (const l of leads.value) {
        const ok = await window.supabaseManager.upsertLead(l);
        if (ok) successCount++;
      }
      alert(`🎉 成功同步 ${successCount} 筆案場資料至 Supabase PostgreSQL 資料表！`);
    };

    const copySqlSchema = () => {
      const sqlText = `-- 請複製專案根目錄下的 supabase-schema.sql 內容在 Supabase SQL Editor 執行`;
      fetch('./supabase-schema.sql')
        .then(r => r.text())
        .then(text => {
          navigator.clipboard.writeText(text);
          sqlCopied.value = true;
          setTimeout(() => { sqlCopied.value = false; }, 3000);
        })
        .catch(() => {
          navigator.clipboard.writeText(sqlText);
          sqlCopied.value = true;
        });
    };

    onMounted(async () => {
      await fetchSummary();
      await fetchLeads();
      await fetchRadar();
      await fetchArchitects();
      await recalc();
      await checkSupabaseStatus();
      if (supabaseTableReady.value && window.supabaseManager) {
        const cloudLeads = await window.supabaseManager.getLeads();
        if (cloudLeads && cloudLeads.length > 0) {
          leads.value = cloudLeads;
          calculateLocalSummary();
        }
      }
      refreshIcons();
    });

    return {
      activeTab,
      tabs,
      isCrawling,
      summary,
      leads,
      radarItems,
      architects,
      leadsSearchQuery,
      leadsFilterRep,
      radarFilterCategory,
      calcInputs,
      calcResult,
      rawPermitText,
      parsedResult,
      showBiweeklyModal,
      biweeklyReportText,
      copySuccess,
      showStrategyModal,
      currentStrategyLead,
      currentStrategyReport,
      chatMessages,
      aiInputText,
      isAiThinking,
      promptPresets,
      triggerCrawler,
      convertRadarToLead,
      filterByRep,
      selectLead,
      openStrategyModal,
      openBiweeklyReport,
      copyReportText,
      recalc,
      fillSamplePermit,
      parsePermitText,
      saveParsedLead,
      askAi,
      sendAiQuery,
      updateArchStatus,
      getStatusBadgeClass,
      filteredLeads,
      filteredRadarItems,
      // Supabase 匯出
      showSupabaseModal,
      supabaseIsConnected,
      supabaseTableReady,
      supabaseStatusText,
      supabaseStatusClass,
      supabaseDotClass,
      supabaseStatusMessage,
      supabaseUrlInput,
      supabaseKeyInput,
      supabaseTesting,
      sqlCopied,
      testAndSaveSupabase,
      syncLocalToCloud,
      copySqlSchema
    };
  }
}).mount('#app');
