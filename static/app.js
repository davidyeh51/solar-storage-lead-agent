/**
 * 智馳光儲 · 早鳥預警拓客 AI 戰情室 前端應用核心 (Vue 3)
 */

const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

createApp({
  setup() {
    // 狀態定義
    const activeTab = ref('dashboard');
    const isCrawling = ref(false);
    const summary = ref({});
    const leads = ref([]);
    const radarItems = ref([]);
    const architects = ref([]);

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

    // --- API 請求方法 ---

    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/summary');
        if (res.ok) summary.value = await res.json();
      } catch (e) {
        console.error('Fetch summary error:', e);
      }
    };

    const fetchLeads = async () => {
      try {
        const res = await fetch('/api/leads');
        if (res.ok) leads.value = await res.json();
      } catch (e) {
        console.error('Fetch leads error:', e);
      }
    };

    const fetchRadar = async () => {
      try {
        const res = await fetch('/api/radar');
        if (res.ok) {
          const data = await res.json();
          radarItems.value = data.items || [];
        }
      } catch (e) {
        console.error('Fetch radar error:', e);
      }
    };

    const fetchArchitects = async () => {
      try {
        const res = await fetch('/api/architects');
        if (res.ok) architects.value = await res.json();
      } catch (e) {
        console.error('Fetch architects error:', e);
      }
    };

    const triggerCrawler = async () => {
      isCrawling.value = true;
      try {
        const res = await fetch('/api/radar/refresh', { method: 'POST' });
        if (res.ok) {
          await fetchRadar();
          await fetchSummary();
        }
      } catch (e) {
        console.error('Crawler error:', e);
      } finally {
        isCrawling.value = false;
        refreshIcons();
      }
    };

    const convertRadarToLead = async (item) => {
      try {
        const res = await fetch('/api/radar/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          const newLead = await res.json();
          alert(`🎉 成功將【${newLead.applicant}】轉換為追蹤商機！已自動分派給 ${newLead.assigned_rep}。`);
          await fetchLeads();
          await fetchSummary();
          activeTab.value = 'leads';
        }
      } catch (e) {
        alert('轉換失敗：' + e);
      }
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
        }
      } catch (e) {
        console.error('Strategy modal error:', e);
      }
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
        }
      } catch (e) {
        alert('取得雙週報失敗：' + e);
      }
      refreshIcons();
    };

    const copyReportText = () => {
      navigator.clipboard.writeText(biweeklyReportText.value);
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 3000);
    };

    // 試算器計算
    const recalc = async () => {
      try {
        const res = await fetch('/api/roi_calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calcInputs.value)
        });
        if (res.ok) {
          calcResult.value = await res.json();
        }
      } catch (e) {
        console.error('Recalc error:', e);
      }
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
      if (!rawPermitText.value.trim()) {
        alert('請先輸入或貼上建照文字！');
        return;
      }
      try {
        const res = await fetch('/api/parse_permit_text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: rawPermitText.value })
        });
        if (res.ok) {
          parsedResult.value = await res.json();
        }
      } catch (e) {
        alert('解析失敗：' + e);
      }
    };

    const saveParsedLead = async () => {
      if (!parsedResult.value) return;
      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedResult.value)
        });
        if (res.ok) {
          alert('🎉 成功儲存新案場並完成 STP 派案！');
          await fetchLeads();
          await fetchSummary();
          activeTab.value = 'leads';
          parsedResult.value = null;
          rawPermitText.value = '';
        }
      } catch (e) {
        alert('儲存失敗：' + e);
      }
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

      // 捲動到底部
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
        }
      } catch (e) {
        chatMessages.value.push({
          role: 'agent',
          content: '抱歉，諮詢系統連線異常，請稍後再試。',
          time: '異常'
        });
      } finally {
        isAiThinking.value = false;
        refreshIcons();
        nextTick(() => {
          const container = document.getElementById('chatContainer');
          if (container) container.scrollTop = container.scrollHeight;
        });
      }
    };

    const updateArchStatus = async (arch) => {
      const statuses = ["密切拜訪洽談中", "法規諮詢協作中", "已完成法規試算", "圖說規格綁定中", "微電網技術交流中"];
      const currentIdx = statuses.indexOf(arch.cooperation_status);
      const nextStatus = statuses[(currentIdx + 1) % statuses.length];
      
      try {
        const res = await fetch(`/api/architects/${arch.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cooperation_status: nextStatus })
        });
        if (res.ok) {
          arch.cooperation_status = nextStatus;
          await fetchArchitects();
        }
      } catch (e) {
        alert('更新失敗：' + e);
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
      // fetch local schema file text or copy directly
      fetch('/supabase-schema.sql')
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
      // 若 Supabase 有雲端案場則優先載入
      if (supabaseTableReady.value && window.supabaseManager) {
        const cloudLeads = await window.supabaseManager.getLeads();
        if (cloudLeads && cloudLeads.length > 0) {
          leads.value = cloudLeads;
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
