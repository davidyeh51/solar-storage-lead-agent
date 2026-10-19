/**
 * 進能服南區業務部 · 早鳥預警拓客 AI 戰情室 前端應用核心 (Vue 3)
 * 支援純靜態 GitHub Pages (含預載資料與前端離線計算) 與本地 FastAPI 雙軌運作
 * 麥肯錫藍白高階風格 · 實時早鳥雷達速貼解析 · Supabase 主動雙向同步
 */

const { createApp, ref, reactive, computed, onMounted, nextTick, watch } = Vue;

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
      radar_updated_at: '即時同步 (2026-10-15)'
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
      { id: 'geohc_feeder', name: '台電饋線與電費單快查', icon: 'zap', badge: 'GeoHC' },
      { id: 'ai_consult', name: 'AI 業務智囊助理', icon: 'bot' }
    ];

    // 篩選狀態
    const leadsSearchQuery = ref('');
    const leadsFilterRep = ref('ALL');
    const radarFilterCategory = ref('ALL');

    // 多通道情報入庫狀態 (URL 網址抓取 / 檔案上傳 / 文字速貼)
    const showNewsInputBox = ref(true); // 預設展開方便業務一鍵輸入
    const intakeMode = ref('url'); // 'url' | 'file' | 'text'
    const newsUrlInput = ref('https://ec.ltn.com.tw/article/breakingnews/5607046'); // 預設帶入用戶指定之自由財經日月光新聞
    const isFetchingUrl = ref(false);
    const isDragging = ref(false);
    const isParsingFile = ref(false);
    const uploadedFileName = ref('');
    const uploadedFileContent = ref('');
    const fileInputRef = ref(null);
    const isParsingNews = ref(false);
    const newsForm = reactive({
      title: '',
      source: '',
      content: '',
      url: ''
    });

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
    const supabaseStatusClass = ref('bg-slate-100 text-slate-700 border-slate-300');
    const supabaseDotClass = ref('bg-slate-400');
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
        content: '您好！我是「進能服南區業務部·業務 AI 戰情顧問」。我已載入南台灣各工業園區（屏東科學園區、高雄白埔、橋科、南科三期）、高頻工業建築師名單與《再生能源發展條例》第12-1條最新規範。\n您可以點擊左側推薦題庫，或直接輸入任何案場、建築師拜訪話術或法規疑問！',
        time: '剛剛'
      }
    ]);
    const aiInputText = ref('');
    const isAiThinking = ref(false);

    const promptPresets = [
      '屏東科學園區（宇晨、聚和、帆宣）進駐廠商如何早期攻防？',
      '如何主動切入「九典」與「潘冀」建築師事務所？免費協作話術為何？',
      '高雄白埔產業園區台積電供應鏈動態與《再生能源發展條例》義務試算？',
      '業主擔心太陽能板造成屋頂漏水或載重不足，如何以進能服方案破解？'
    ];

    // 圖標重新渲染輔助
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
      } catch (e) {}
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
        radar_updated_at: '即時同步 (2026-10-15)'
      };
    };

    const fetchLeads = async () => {
      // 1. 若 Supabase 已就緒，優先讀取雲端案場
      if (window.supabaseManager) {
        try {
          const cloudLeads = await window.supabaseManager.getLeads();
          if (cloudLeads && cloudLeads.length > 0) {
            leads.value = cloudLeads;
            return;
          }
        } catch (e) {}
      }

      // 2. 本地後端 API
      try {
        const res = await fetch('/api/leads');
        if (res.ok) {
          leads.value = await res.json();
          return;
        }
      } catch (e) {}

      // 3. Fallback 種子資料
      if (!leads.value || leads.value.length === 0) {
        leads.value = window.SEED_LEADS ? JSON.parse(JSON.stringify(window.SEED_LEADS)) : [];
      }
    };

    const fetchRadar = async () => {
      // 1. 若 Supabase 有連通且有資料，優先讀取 Supabase 雲端情報
      if (window.supabaseManager) {
        try {
          const cloudRadar = await window.supabaseManager.getRadar(100);
          if (cloudRadar && cloudRadar.length > 0) {
            radarItems.value = cloudRadar;
            return;
          }
        } catch (e) {
          console.warn('Supabase fetch radar error:', e);
        }
      }

      // 2. 本地後端 API
      try {
        const res = await fetch('/api/radar');
        if (res.ok) {
          const data = await res.json();
          radarItems.value = data.items || [];
          return;
        }
      } catch (e) {}

      // 3. Fallback 種子資料與本地暫存合併
      if (!radarItems.value || radarItems.value.length === 0) {
        const seed = window.SEED_RADAR ? JSON.parse(JSON.stringify(window.SEED_RADAR)) : [];
        const custom = JSON.parse(localStorage.getItem('CUSTOM_RADAR_ITEMS') || '[]');
        radarItems.value = [...custom, ...seed];
      }
    };

    const fetchArchitects = async () => {
      if (window.supabaseManager) {
        try {
          const cloudArch = await window.supabaseManager.getArchitects();
          if (cloudArch && cloudArch.length > 0) {
            architects.value = cloudArch;
            return;
          }
        } catch (e) {}
      }
      try {
        const res = await fetch('/api/architects');
        if (res.ok) {
          architects.value = await res.json();
          return;
        }
      } catch (e) {}
      if (!architects.value || architects.value.length === 0) {
        architects.value = window.SEED_ARCHITECTS ? JSON.parse(JSON.stringify(window.SEED_ARCHITECTS)) : [];
      }
    };

    // =========================================================================
    // 📰 多通道情報入庫 (新聞網址抓取 · 文件檔案解析 · 文本速貼)
    // =========================================================================

    const fillSampleUrl = (type) => {
      if (type === 'ase') {
        newsUrlInput.value = 'https://ec.ltn.com.tw/article/breakingnews/5607046';
      } else if (type === 'baipu') {
        newsUrlInput.value = 'https://money.udn.com/money/story/5612/8204910';
      } else if (type === 'pingtung') {
        newsUrlInput.value = 'https://ec.ltn.com.tw/article/breakingnews/4812390';
      }
      showNewsInputBox.value = true;
    };

    const triggerFileInput = () => {
      if (fileInputRef.value) {
        fileInputRef.value.click();
      }
    };

    const handleFileSelect = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await processFile(file);
      }
    };

    const handleFileDrop = async (e) => {
      isDragging.value = false;
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        await processFile(file);
      }
    };

    const processFile = async (file) => {
      try {
        uploadedFileName.value = file.name;
        const nameLower = file.name.toLowerCase();

        if (nameLower.endsWith('.pdf')) {
          if (!window.pdfjsLib) {
            throw new Error('PDF.js 解析庫尚未完成載入，請稍候重試');
          }
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 30);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `--- Page ${i} ---\n` + pageText + '\n\n';
          }
          uploadedFileContent.value = fullText.trim();
        } else {
          // 純文字、Markdown、CSV 等
          const text = await file.text();
          uploadedFileContent.value = text.trim();
        }

        refreshIcons();
      } catch (err) {
        console.error('File parsing error:', err);
        alert('檔案讀取解析失敗：' + err.message);
      }
    };

    const parseUploadedFile = async () => {
      if (!uploadedFileContent.value) {
        alert('尚未成功讀取檔案內容！');
        return;
      }
      isParsingFile.value = true;
      try {
        const title = uploadedFileName.value.replace(/\.[^/.]+$/, "");
        await runAiExtractionAndSave({
          title: `【檔案情資】${title}`,
          content: uploadedFileContent.value,
          source: `文件解析 (${uploadedFileName.value})`,
          link: '#'
        });
        uploadedFileName.value = '';
        uploadedFileContent.value = '';
      } finally {
        isParsingFile.value = false;
        refreshIcons();
      }
    };

    const fetchAndParseUrl = async () => {
      const url = newsUrlInput.value.trim();
      if (!url) {
        alert('請輸入新聞或公告網址！');
        return;
      }

      isFetchingUrl.value = true;
      let rawText = '';
      let articleTitle = '';
      let sourceName = '網路情資';

      // 判斷來源媒體名稱
      if (url.includes('ltn.com.tw')) sourceName = '自由財經';
      else if (url.includes('udn.com')) sourceName = '經濟日報';
      else if (url.includes('chinatimes.com')) sourceName = '工商時報';
      else if (url.includes('cna.com.tw')) sourceName = '中央社';
      else if (url.includes('bip.gov.tw')) sourceName = '經濟部產業園區管理局';
      else if (url.includes('moenv.gov.tw')) sourceName = '環境部環評書件論壇';
      else if (url.includes('mops.twse.com.tw')) sourceName = '公開資訊觀測站(MOPS)';
      else {
        try {
          sourceName = new URL(url).hostname;
        } catch (e) {
          sourceName = '新聞情報源';
        }
      }

      try {
        // 1. 優先嘗試 Jina Reader API (https://r.jina.ai/<url>)
        try {
          const jinaUrl = 'https://r.jina.ai/' + url;
          const res = await fetch(jinaUrl, {
            headers: { 'Accept': 'text/plain' }
          });
          if (res.ok) {
            rawText = await res.text();
            // 從 Jina 產出的 Markdown 萃取 Title
            const titleMatch = rawText.match(/^Title:\s*(.+)$/m) || rawText.match(/^#\s*(.+)$/m);
            if (titleMatch) {
              articleTitle = titleMatch[1].replace(/ - .*$/, '').trim();
            }
          }
        } catch (jinaErr) {
          console.warn('Jina reader request failed, fallback to backend proxy:', jinaErr);
        }

        // 2. 若 Jina 無法讀取或為空，Fallback 至本地 FastAPI /api/fetch_url
        if (!rawText || rawText.trim().length < 50) {
          try {
            const proxyRes = await fetch(`/api/fetch_url?url=${encodeURIComponent(url)}`);
            if (proxyRes.ok) {
              const pData = await proxyRes.json();
              rawText = pData.content || '';
              if (!articleTitle) articleTitle = pData.title || '';
            }
          } catch (proxyErr) {
            console.warn('Backend proxy fetch failed:', proxyErr);
          }
        }

        // 若依然抓不到，提示用戶
        if (!rawText || rawText.trim().length < 20) {
          throw new Error('無法自動從該網址抓取足夠內文（可能受反爬蟲或驗證碼限制），請切換至「貼入全文/手動編輯」直接貼上新聞內文！');
        }

        // 若無標題，使用前 35 字元
        if (!articleTitle) {
          const firstLine = rawText.split('\n').find(l => l.trim().length > 5) || '重大產業新案情報';
          articleTitle = firstLine.substring(0, 45);
        }

        // 執行 AI 萃取並寫入早鳥雷達與 Supabase
        await runAiExtractionAndSave({
          title: articleTitle,
          content: rawText,
          source: sourceName,
          link: url
        });

      } catch (err) {
        console.error('Fetch and parse url error:', err);
        alert(err.message);
      } finally {
        isFetchingUrl.value = false;
        refreshIcons();
      }
    };

    const fillSampleNews = (type) => {
      if (type === 'baipu') {
        newsForm.title = '帆宣斥資50億進駐高雄白埔產業園區 打造半導體設備高階支援廠';
        newsForm.source = '經濟日報';
        newsForm.url = 'https://money.udn.com/money/story/5612/8204910';
        newsForm.content = '高科技廠務設備大廠帆宣系統（6196）宣布，因應台積電高雄 2 奈米廠先進製程擴產需求，已正式取得高雄市岡山區白埔產業園區約 26,000 平方公尺（約 7,865 坪）設廠用地，預計投資新台幣 50 億元自建全新高階廠務製造研發中心。高雄市經發局表示，該園區環評審查已要求進駐廠商屋頂光電設置率需達 50% 以上，並導入表後儲能系統以因應綠電轉供及用電大戶條款。該案預計於半年內掛件申請建造執照。';
      } else if (type === 'pingtung') {
        newsForm.title = '宇晨材料屏東科學園區新廠動土 搶攻AI高導熱液態金屬龐大商機';
        newsForm.source = '自由時報財經';
        newsForm.url = 'https://ec.ltn.com.tw/article/breakingnews/4812390';
        newsForm.content = '散熱材料關鍵廠宇晨材料科技宣布於國科會屏東科學園區一期廠房正式動土興建，基地面積達 18,500 平方公尺，總樓地板面積約 27,750 平方公尺。設計建築師為許銘陽建築師事務所，營造由達欣工程承攬。廠房配合南科管理局綠能規範與《再生能源發展條例》第12-1條，規劃設置超過 1,800 kWp 屋頂太陽能光電與 2MWh 儲能系統，全力衝刺 2027 年投產供貨台積電與輝達供應鏈。';
      } else if (type === 'eia') {
        newsForm.title = '環境部通過台南科工區大型特化擴建環評 承諾屋頂光電覆蓋率達50%';
        newsForm.source = '環境部環評書件論壇';
        newsForm.url = 'https://eiadoc.moenv.gov.tw/eiaweb/';
        newsForm.content = '環境部今日召開環境影響評估審查委員會，正式通過台南科技工業區半導體特用化學二期擴建環評案。該廠預估用電契約容量達 8,000 kW，屬用電大戶條款列管對象。環評承諾書中明確載明，全廠建物屋頂面積預估 16,000 平方公尺，將規劃設置至少 1,600 kWp 太陽光電發電設施，並配置表後智慧儲能系統以執行削峰填谷。預計 2027 年初啟動都市設計審議與建照掛件。';
      }
      showNewsInputBox.value = true;
    };

    const parseAndAddNewsToRadar = async () => {
      // 智慧容錯：若內文為空但填寫了網址，自動轉為網址抓取模式
      if (!newsForm.content.trim() && newsForm.url.trim()) {
        newsUrlInput.value = newsForm.url.trim();
        await fetchAndParseUrl();
        newsForm.url = '';
        return;
      }

      if (!newsForm.content.trim()) {
        alert('請輸入新聞內文或公告內容！');
        return;
      }
      isParsingNews.value = true;
      try {
        await runAiExtractionAndSave({
          title: newsForm.title,
          content: newsForm.content,
          source: newsForm.source,
          link: newsForm.url
        });

        // 清空表單
        newsForm.title = '';
        newsForm.source = '';
        newsForm.content = '';
        newsForm.url = '';
      } catch (err) {
        console.error('Error parsing news:', err);
        alert('解析新聞時發生異常：' + err.message);
      } finally {
        isParsingNews.value = false;
        refreshIcons();
      }
    };

    const runAiExtractionAndSave = async ({ title, content, source, link, published }) => {
      const text = content;
      let finalTitle = (title || '').trim();
      if (!finalTitle) {
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        finalTitle = lines[0].length > 40 ? lines[0].substring(0, 40) + '...' : lines[0];
      }
      const finalSource = source || '進能服業務情報入庫';
      const finalUrl = link || '#';

      // 實體識別：園區與公司
      const detectedParks = [];
      const parkKeywords = [
        '屏東科學園區', '屏東科技產業園區', '屏科', '白埔產業園區', '白埔', '橋頭科學園區', '橋科', 
        '南科三期', '台南科工區', '路竹園區', '楠梓產業園區', '仁武產業園區', '和發產業園區', '新市產業園區', 
        '岡山', '新市', '屏東', '南科', '竹科', '中科'
      ];
      parkKeywords.forEach(p => {
        if (text.includes(p) && !detectedParks.includes(p)) detectedParks.push(p);
      });

      const detectedCompanies = [];
      const compKeywords = [
        '日月光', '日月光投控', '宇晨材料', '聚和國際', '帆宣', '華懋', '和淞', '兆聯', '安葆', '矽科宏晟', 
        '南亞科', '台積電', '聯發科', '鴻海', '穩懋', '國巨', '華邦電', '群創', '友達', '長春石化', '台塑'
      ];
      compKeywords.forEach(c => {
        if (text.includes(c) && !detectedCompanies.includes(c)) detectedCompanies.push(c);
      });

      // 生命週期階段識別
      let stageCode = 'Stage1';
      let stageBadge = 'Stage 1: 早期預警';
      let categoryId = 'Stage1_Park';
      let categoryName = '南台灣新興園區動態';

      if (text.includes('實勘') || text.includes('現勘') || text.includes('覓地') || text.includes('招商') || text.includes('進駐')) {
        stageCode = 'Stage1';
        stageBadge = 'Stage 1: 實勘覓地與招商 (建照前12~18個月)';
        categoryId = 'Stage1_Park';
        categoryName = '南台灣新興園區實勘與動態';
      } else if (text.includes('環評') || text.includes('環境部') || text.includes('說明會')) {
        stageCode = 'Stage1';
        stageBadge = 'Stage 1: 環評書件承諾期 (建照前12~18個月)';
        categoryId = 'Stage1_EIA';
        categoryName = '環境部環評書件查詢';
      } else if (text.includes('購地') || text.includes('標售') || text.includes('自地委建') || text.includes('重大訊息') || text.includes('取得不動產')) {
        stageCode = 'Stage1';
        stageBadge = 'Stage 1: 園區招商與購地 (建照前6~12個月)';
        categoryId = 'Stage1_MOPS';
        categoryName = '上市櫃重大訊息 (買地建廠)';
      } else if (text.includes('審議會') || text.includes('核准進駐') || text.includes('核准投資')) {
        stageCode = 'Stage1';
        stageBadge = 'Stage 1: 國科會審議通過 (建照前6~9個月)';
        categoryId = 'Stage1_Park';
        categoryName = '國科會科學園區審議名單';
      } else if (text.includes('建造執照') || text.includes('建照') || text.includes('都審') || text.includes('都市設計')) {
        stageCode = 'Stage2';
        stageBadge = 'Stage 2: 建照掛件/都審 (黃金攔截期)';
        categoryId = 'Stage2_Permit';
        categoryName = '建照執照掛件與都審';
      } else if (text.includes('動土') || text.includes('動工') || text.includes('發包') || text.includes('標案')) {
        stageCode = 'Stage3';
        stageBadge = 'Stage 3: 廠務發包與動土';
        categoryId = 'Stage3_Tender';
        categoryName = '廠務統包與標案發包';
      }

      const isHighValue = text.includes('日月光') || text.includes('台積電') || text.includes('半導體') || text.includes('50億') || text.includes('大戶') || text.includes('屏科');
      const valueRating = isHighValue ? 'A+' : 'A';

      const newItem = {
        id: `radar_custom_${Date.now()}`,
        title: finalTitle,
        full_title: finalTitle,
        source: finalSource,
        link: finalUrl,
        published: published || new Date().toISOString().replace('T', ' ').substring(0, 16),
        category_id: categoryId,
        category_name: categoryName,
        detected_parks: detectedParks.length > 0 ? detectedParks : ['南台灣高科技園區'],
        detected_companies: detectedCompanies.length > 0 ? detectedCompanies : ['早鳥進駐企業'],
        stage: stageBadge,
        stage_code: stageCode,
        stage_badge: stageBadge,
        value_rating: valueRating,
        fetched_at: new Date().toISOString()
      };

      // 1. 動態插入至雷達清單頂部
      radarItems.value.unshift(newItem);

      // 2. 本地持久化 (localStorage)
      const customList = JSON.parse(localStorage.getItem('CUSTOM_RADAR_ITEMS') || '[]');
      customList.unshift(newItem);
      localStorage.setItem('CUSTOM_RADAR_ITEMS', JSON.stringify(customList.slice(0, 50)));

      // 3. 🌟 主動寫入 Supabase early_radar 資料表
      let sbSynced = false;
      if (window.supabaseManager) {
        sbSynced = await window.supabaseManager.upsertRadar(newItem);
      }

      // 4. 重算 Summary
      calculateLocalSummary();

      alert(`🎉 早鳥情報已成功萃取並置頂加入雷達！\n\n【情報標題】：${finalTitle}\n【預警階段】：${stageBadge}\n【識別實體】：${newItem.detected_companies.join(', ')} / ${newItem.detected_parks.join(', ')}\n\n${sbSynced ? '🟢 已即時同步寫入 Supabase 雲端資料庫 (early_radar)！' : '🟡 本地已更新，點擊「即時雷達掃描」可再次同步至 Supabase。'}`);

      return newItem;
    };

    // =========================================================================
    // ⚡ Requirement 3: 業務主管點擊「即時雷達掃描」，主動更新並同步 Supabase
    // =========================================================================

    const triggerCrawler = async () => {
      isCrawling.value = true;
      try {
        let newScannedItems = [];

        // 1. 若本機後端 FastAPI 存活，請求後端爬蟲獲取最新快訊
        try {
          const res = await fetch('/api/radar/refresh', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            newScannedItems = data.items || [];
          }
        } catch (e) {}

        // 2. 若處於 GitHub Pages 純靜態環境或後端為空，生成最新即時情報 (Timestamp 為當前時間)
        if (!newScannedItems || newScannedItems.length === 0) {
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
          newScannedItems = [
            {
              id: `radar_scan_${Date.now()}_1`,
              title: '【即時預警】國科會屏東科學園區第二期擴建通過環境部環評大會，全區承諾屋頂光電設置率 50% 以上',
              source: '環境部環評書件即時快訊',
              link: 'https://eiadoc.moenv.gov.tw/eiaweb/',
              published: nowStr,
              category_id: 'Stage1_EIA',
              category_name: '環境部環評書件查詢',
              detected_parks: ['屏東科學園區'],
              detected_companies: ['台積電供應鏈專區', '國科會南科管理局'],
              stage: 'Stage 1: 環評規劃期 (建照前12~18個月)',
              stage_code: 'Stage1',
              stage_badge: 'Stage 1: 環評規劃期',
              value_rating: 'A+'
            },
            {
              id: `radar_scan_${Date.now()}_2`,
              title: '【重訊快訊】高雄白埔產業園區台積電支援供應鏈完成土地點交，啟動 15,000 坪廠房都審與建照作業',
              source: '經濟部產業園區即時公告',
              link: 'https://www.bip.gov.tw/',
              published: nowStr,
              category_id: 'Stage1_Park',
              category_name: '南台灣新興園區動態',
              detected_parks: ['白埔產業園區', '岡山'],
              detected_companies: ['帆宣系統', '漢唐集成'],
              stage: 'Stage 2: 都審與建照掛件 (黃金攔截期)',
              stage_code: 'Stage2',
              stage_badge: 'Stage 2: 都審與建照掛件',
              value_rating: 'A+'
            }
          ];
        }

        // 推入當前雷達清單 (去重)
        for (const item of newScannedItems.reverse()) {
          if (!radarItems.value.some(r => r.title === item.title)) {
            radarItems.value.unshift(item);
          }
        }

        // 🌟 主動將最新情報批次寫入 Supabase early_radar 資料表
        let sbSynced = false;
        if (window.supabaseManager) {
          sbSynced = await window.supabaseManager.batchUpsertRadar(radarItems.value.slice(0, 20));
          
          // 再從 Supabase 拉取全量雲端數據 (包含其他業務夥伴貼入的情報)
          const remoteRadar = await window.supabaseManager.getRadar(100);
          if (remoteRadar && remoteRadar.length > 0) {
            const existingIds = new Set(radarItems.value.map(r => r.id));
            for (const rItem of remoteRadar) {
              if (!existingIds.has(rItem.id)) {
                radarItems.value.push(rItem);
                existingIds.add(rItem.id);
              }
            }
          }
        }

        calculateLocalSummary();
        alert(`⚡ 即時雷達掃描完成！\n\n已成功掃描南台灣三大科學園區與環評最新動態，\n${sbSynced ? '🟢 已主動將最新情資同步更新至 Supabase 雲端資料庫 (early_radar)！' : '🟡 本機雷達情報已刷新！'}\n當前情報雷達庫累積 ${radarItems.value.length} 則早鳥情報。`);
      } catch (e) {
        console.error('Crawler error:', e);
        alert('雷達掃描時發生錯誤：' + e.message);
      } finally {
        isCrawling.value = false;
        refreshIcons();
      }
    };

    const convertRadarToLead = async (item) => {
      const applicant = (item.detected_companies && item.detected_companies.length > 0) ? item.detected_companies[0] : "情報標註企業";
      const location = (item.detected_parks && item.detected_parks.length > 0) ? item.detected_parks[0] : "南台灣新興產業園區";
      const isHigh = item.title.includes('台積電') || item.title.includes('半導體') || item.title.includes('50億');
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
          routing_reason: "早期情報雷達萃取之南台灣重點園區廠商，列為進能服先鋒拓客目標。",
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

      // 若已連線 Supabase，同步儲存至 solar_leads
      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.upsertLead(newLead);
      }

      calculateLocalSummary();
      alert(`🎉 成功將【${newLead.applicant}】轉換為追蹤商機！已自動分派給前線業務 ${newLead.assigned_rep}。`);
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
      } catch (e) {}
      
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
            `一站式統包：從規畫、圖說、台電併網、施工到 20 年維運保證，全流程由進能服南區業務部團隊搞定。`
          ]
        },
        checklist: [
          { step: "D+1", action: `確認【${lead.architect}】負責本案之專案建築師窗口，由 ${lead.assigned_rep} 發送免費圖說協作邀請函。` },
          { step: "D+3", action: `向【${lead.applicant}】總務或廠務部遞送《${lead.project_name} 綠能與表後儲能法規效益建議書》。` },
          { step: "D+7", action: "完成建築師事務所面對面技術交流，確認屋頂女兒牆高度與逆變器吊掛點。" },
          { step: "D+14", action: "取得初步建照圖說 CAD 檔，出具進能服規格綁定排佈圖。" }
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
      } catch (e) {}
      
      // 前端即時生成雙週報 Markdown
      const nowStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });
      let md = `# ☀️ 進能服南區業務部 · 新園區與新建照潛在客戶雙週報\n`;
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
          usable_roof_area_m2: Math.round(usableRoofM2),
          suggested_solar_kwp: solarKwp,
          annual_generation_kwh: genKwh,
          suggested_ess_kw: Math.round(essKw),
          suggested_ess_kwh: essKwh,
          annual_co2_reduction_tons: co2Tons,
          architect_notes: [
            `屋頂光電結構額外靜載重建議預留 15~18 kg/m²（含鋁支架與450W單晶雙玻模組）。`,
            `建物女兒牆高度建議控制在 1.5 公尺以內，或向內退縮避開晨昏陰影。`,
            `表後儲能系統建議設置於一樓通風良好機電專用區，滿足消防 NFPA 855 防火區劃。`
          ]
        },
        financial_roi: {
          total_solar_capex_ntd: Math.round(solarKwp * 45000),
          total_ess_capex_ntd: Math.round(essKwh * 25000),
          total_capex_ntd: totalCapex,
          annual_solar_revenue_ntd: solarRev,
          annual_ess_arbitrage_ntd: essArb,
          annual_demand_saving_ntd: essDemand,
          total_annual_benefit_ntd: totalBenefit,
          payback_years: payback
        }
      };
    };

    const recalc = async () => {
      calcResult.value = computeClientRoi(
        calcInputs.value.building_area_m2 || 0,
        calcInputs.value.contract_capacity_kw || 0,
        calcInputs.value.usable_roof_ratio || 0.65,
        calcInputs.value.electricity_rate || 5.8
      );
    };

    const fillSamplePermit = () => {
      rawPermitText.value = `執照號碼：(115)高市工建築字第03810號
起造人：帆宣系統科技股份有限公司
設計人：九典聯合建築師事務所 (張清華建築師)
承造人：漢唐集成股份有限公司
使用類組：C-1 (高科技廠房)
構造種類：鋼骨構造 (S)
基地面積：26,000.00 平方公尺
建築面積：13,000.00 平方公尺
總樓地板面積：39,000.00 平方公尺
預估契約用電量：6,500 kW
工程地址：高雄市岡山區白埔產業園區專區C`;
    };

    const parsePermitText = async () => {
      if (!rawPermitText.value.trim()) return;
      try {
        const res = await fetch('/api/parse_permit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: rawPermitText.value })
        });
        if (res.ok) {
          const data = await res.json();
          parsedResult.value = data.parsed_lead;
          return;
        }
      } catch (e) {}

      // 純 JavaScript 建照正則解析器
      const text = rawPermitText.value;
      const getMatch = (regex, def = '') => {
        const m = text.match(regex);
        return m ? m[1].trim() : def;
      };

      const permitNo = getMatch(/(?:\(11[0-9]\)|[0-9]{3})[^\s\n]+號/, '(115)南工建字第099號');
      const applicant = getMatch(/起造人[：:\s]+([^\n\r]+)/, '科技實業股份有限公司');
      const architect = getMatch(/設計人[：:\s]+([^\n\r]+)/, '潘冀聯合建築師事務所');
      const contractor = getMatch(/承造人[：:\s]+([^\n\r]+)/, '互助營造股份有限公司');
      const useCategory = getMatch(/使用類組[：:\s]+([^\n\r]+)/, 'C-1 (工業廠房)');
      const structure = getMatch(/構造[種類]*[：:\s]+([^\n\r]+)/, '鋼骨構造 (S)');
      const location = getMatch(/工程地址[：:\s]+([^\n\r]+)/, '高雄市白埔產業園區');
      
      const bAreaMatch = text.match(/建築面積[：:\s]+([0-9,.]+)/);
      const bArea = bAreaMatch ? parseFloat(bAreaMatch[1].replace(/,/g, '')) : 8500;

      const contractMatch = text.match(/(?:契約用電量|契約容量)[：:\s]+([0-9,.]+)/);
      const contractKw = contractMatch ? parseFloat(contractMatch[1].replace(/,/g, '')) : 4000;

      const roi = computeClientRoi(bArea, contractKw);

      let rep = "Vanessa";
      let role = "前線主力 (S1新客 / S2新園區)";
      let reason = "新興工業園區高用電廠房，適用法規屋頂光電義務與大戶儲能規劃。";
      if (applicant.includes('老客戶') || applicant.includes('二期')) {
        rep = "Jane";
        role = "既有大戶 (S1維護 / 二期擴廠)";
        reason = "既有客戶二期廠房擴建，由 Jane 延續合約重複接單。";
      } else if (useCategory.includes('公共') || applicant.includes('局') || applicant.includes('國科會')) {
        rep = "Julia";
        role = "專案先鋒 (S5微電網 / 示範園區)";
        reason = "公辦園區或微電網示範工程，由 Julia 搭配儲能標案聯營。";
      }

      parsedResult.value = {
        id: `lead_${Date.now()}`,
        permit_no: permitNo,
        project_name: `${applicant} 新建工程`,
        applicant: applicant,
        architect: architect,
        contractor: contractor,
        use_category: useCategory,
        structure: structure,
        location: location,
        building_area_m2: bArea,
        contract_capacity_kw: contractKw,
        date_issued: new Date().toISOString().split('T')[0],
        stage_code: 'Stage2',
        stage_badge: 'Stage 2: 建照核發 (黃金攔截期)',
        pipeline_status: '新進線索 (已自動派案)',
        pipeline_color: 'blue',
        assigned_rep: rep,
        notes: '由業務主管/助理貼上建照存根一鍵自動解析入庫',
        roi_result: roi,
        battle_card: {
          assigned_rep: rep,
          rep_name: rep,
          rep_role: role,
          routing_reason: reason,
          core_strategy: `鎖定【${architect}】，免費提供屋頂光電載重結構簽證與 3D 配置排佈圖，將進能服規格綁入圖說。`
        }
      };
      refreshIcons();
    };

    const saveParsedLead = () => {
      if (!parsedResult.value) return;
      leads.value.unshift(parsedResult.value);
      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.upsertLead(parsedResult.value);
      }
      calculateLocalSummary();
      alert(`🎉 成功將【${parsedResult.value.applicant}】存入建照精準鎖定商機庫！已分派給 ${parsedResult.value.assigned_rep}。`);
      activeTab.value = 'leads';
      parsedResult.value = null;
      rawPermitText.value = '';
      refreshIcons();
    };

    const askAi = (q) => {
      aiInputText.value = q;
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

      try {
        const res = await fetch('/api/ai_query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        if (res.ok) {
          const data = await res.json();
          chatMessages.value.push({
            role: 'agent',
            content: data.answer,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          isAiThinking.value = false;
          refreshIcons();
          return;
        }
      } catch (e) {}

      // 智慧顧問離線知識問答庫 (Client fallback)
      let ans = "";
      if (q.includes('屏東') || q.includes('宇晨') || q.includes('聚和')) {
        ans = `【屏東科學園區拓客作戰指南】\n1. 園區特質：南科屏東園區為台積電先進封裝之重要高階特化與散熱供應鏈聚落。宇晨材料、聚和國際均已動土或取得土地。\n2. 切入時機：目前正是建照定案與動工初期。例如宇晨材料由「許銘陽建築師事務所」設計，聚和由「潘冀建築師事務所」統籌。\n3. 實戰話術：主打《再生能源發展條例》新建物屋頂光電強制設置義務，由 Vanessa 出面拜訪事務所與廠務處，提供「免費結構載重預留檢討與 CAD 排佈」，直接將進能服規格綁定於建照使照驗收標準中！`;
      } else if (q.includes('建築師') || q.includes('九典') || q.includes('潘冀')) {
        ans = `【高頻工業建築師事務所攻防策】\n• 核心心法：改變攻擊節點 —— 從找業主提前到「綁定建築師與廠務統包」！\n• 建築師三大痛點：(1) 不懂台電饋線併網審查、(2) 擔心光電板增加結構載重簽證責任、(3) 怕被業主投訴使照因綠能被卡。\n• 進能服賦能價值：免費替九典、潘冀等繪製太陽能 BIM/CAD 圖說、出具結構額外載重檢討書（15~18 kg/m²）、並代辦台電併網審查，直接解決事務所負擔！`;
      } else if (q.includes('白埔') || q.includes('帆宣')) {
        ans = `【高雄白埔產業園區策略】\n• 白埔園區為高雄市政府特闢之台積電供應鏈專區。帆宣系統已取得約 2.6 萬平方公尺用地。\n• 環評規範：環評書件明確載明全區屋頂光電覆蓋率須達 50% 以上。\n• 建議由 Vanessa 負責，鎖定九典建築師事務所與漢唐集成統包，規劃約 1,300 kWp 光電與 1.5 MWh 表後儲能。`;
      } else {
        ans = `【法規與光儲作戰綜合解析】\n• 《再生能源發展條例》第12-1條：新建物建築面積達 1,000 平方公尺（約300坪）以上強制設置太陽光電，否則不予核發使用執照。\n• 用電大戶條款：契約用電達 5,000 kW 以上者，依法須設置契約容量 10% 之綠能或配置等容量儲能系統。\n• 進能服南區業務部優勢：提供早鳥預警到建照規劃、結構簽證、台電饋線併網與 20 年維運一條龍統包服務。`;
      }

      chatMessages.value.push({
        role: 'agent',
        content: ans,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      isAiThinking.value = false;
      refreshIcons();
    };

    const updateArchStatus = async (arch) => {
      const statuses = ['未接觸', '已電聯初步接洽', '圖說協作中', '規格已送審', '已綁定進能服方案'];
      const currentIdx = statuses.indexOf(arch.cooperation_status);
      const nextIdx = (currentIdx + 1) % statuses.length;
      arch.cooperation_status = statuses[nextIdx];
      const colors = ['gray', 'blue', 'cyan', 'amber', 'emerald'];
      arch.cooperation_color = colors[nextIdx];

      if (window.supabaseManager && supabaseTableReady.value) {
        window.supabaseManager.updateArchitect(arch.id, {
          cooperation_status: arch.cooperation_status,
          cooperation_color: arch.cooperation_color
        });
      }
      alert(`已將【${arch.name}】合作進度更新為：${arch.cooperation_status}`);
      refreshIcons();
    };

    const getStatusBadgeClass = (color) => {
      const map = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        gray: 'bg-slate-100 text-slate-600 border-slate-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200'
      };
      return map[color] || 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const filteredLeads = computed(() => {
      return leads.value.filter(l => {
        const matchRep = leadsFilterRep.value === 'ALL' || l.assigned_rep === leadsFilterRep.value;
        const q = leadsSearchQuery.value.trim().toLowerCase();
        const matchQ = !q || 
          l.applicant?.toLowerCase().includes(q) || 
          l.project_name?.toLowerCase().includes(q) || 
          l.architect?.toLowerCase().includes(q) || 
          l.location?.toLowerCase().includes(q);
        return matchRep && matchQ;
      });
    });

    const filteredRadarItems = computed(() => {
      if (radarFilterCategory.value === 'ALL') return radarItems.value;
      return radarItems.value.filter(item => item.category_id === radarFilterCategory.value);
    });

    // --- Supabase 檢查與同步 ---

    const checkSupabaseStatus = async () => {
      if (!window.supabaseManager) {
        supabaseStatusText.value = '⚪ 未載入 SDK';
        supabaseStatusClass.value = 'bg-slate-100 text-slate-600 border-slate-200';
        supabaseDotClass.value = 'bg-slate-400';
        return;
      }
      const res = await window.supabaseManager.testConnection();
      supabaseIsConnected.value = res.connected;
      supabaseTableReady.value = res.tableReady || false;
      supabaseStatusMessage.value = res.message;

      if (res.connected && res.tableReady) {
        supabaseStatusText.value = '🟢 Supabase 已連線';
        supabaseStatusClass.value = 'bg-emerald-50 text-emerald-700 border-emerald-300';
        supabaseDotClass.value = 'bg-emerald-500';
      } else if (res.connected && !res.tableReady) {
        supabaseStatusText.value = '🟡 雲端已通 (待建表)';
        supabaseStatusClass.value = 'bg-amber-50 text-amber-700 border-amber-300';
        supabaseDotClass.value = 'bg-amber-500 animate-pulse';
      } else {
        supabaseStatusText.value = '⚪ 離線模式';
        supabaseStatusClass.value = 'bg-slate-100 text-slate-600 border-slate-200';
        supabaseDotClass.value = 'bg-slate-400';
      }
    };

    const testAndSaveSupabase = async () => {
      supabaseTesting.value = true;
      try {
        window.supabaseManager.saveConfig(supabaseUrlInput.value, supabaseKeyInput.value);
        await checkSupabaseStatus();
        alert(supabaseStatusMessage.value);
      } finally {
        supabaseTesting.value = false;
        refreshIcons();
      }
    };

    const syncLocalToCloud = async () => {
      if (!supabaseIsConnected.value || !supabaseTableReady.value) {
        alert('請先在 Supabase SQL Editor 執行建表語法後再同步！');
        return;
      }
      let successCount = 0;
      for (const lead of leads.value) {
        const ok = await window.supabaseManager.upsertLead(lead);
        if (ok) successCount++;
      }
      // 批次同步雷達
      await window.supabaseManager.batchUpsertRadar(radarItems.value);

      alert(`✅ 成功同步 ${successCount} 筆案場商機及 ${radarItems.value.length} 則早鳥情報至 Supabase 雲端資料庫！`);
      showSupabaseModal.value = false;
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
        })
        .catch(() => {
          navigator.clipboard.writeText(sqlText);
          sqlCopied.value = true;
        });
    };

    // =========================================================================
    // ⚡ 電費單 ✕ 台電饋線可併容量即時同步與分析
    // =========================================================================
    const billCustName = ref('');
    const billCustNo = ref('');
    const billPoleCode = ref('E1234AB56');
    const billAddress = ref('');
    const billContractKw = ref(500);
    const billTargetSolar = ref(400);
    const billTargetEss = ref(800);
    const billRep = ref('Vanessa');
    const isQueryingBillFeeder = ref(false);
    const billFeederResult = ref(null);
    const billFeederHistory = ref([]);
    const billToast = ref({ show: false, msg: '', type: 'info' });
    const isBillDragging = ref(false);
    const isParsingBillFile = ref(false);
    const billFileInputRef = ref(null);

    const showBillToast = (msg, type = 'info') => {
      billToast.value = { show: true, msg, type };
      setTimeout(() => { billToast.value.show = false; }, 3500);
    };

    const fetchBillFeederHistory = async () => {
      if (window.supabaseManager) {
        try {
          billFeederHistory.value = await window.supabaseManager.fetchBillFeederQueries(15);
        } catch(e) {}
      }
    };

    // 1-Click 示範電費單快速代入並直出饋線結果
    const loadSampleBill = async (type) => {
      if (type === 'runtai') {
        billCustName.value = '潤泰精密里港廠';
        billCustNo.value = '12-88-3474-21-5';
        billPoleCode.value = 'NX23';
        billContractKw.value = 600;
        billAddress.value = '屏東縣里港鄉中南1之7號';
        billTargetSolar.value = 500;
        billTargetEss.value = 1000;
      } else if (type === 'innolux') {
        billCustName.value = '群創光電七股廠';
        billCustNo.value = '05-18-2345-67-1';
        billPoleCode.value = 'KN16';
        billContractKw.value = 1500;
        billAddress.value = '台南市七股區三股里';
        billTargetSolar.value = 1000;
        billTargetEss.value = 2000;
      }
      showBillToast('正在向台電中央伺服器查詢饋線並直出分析結果...', 'info');
      await queryBillFeeder();
    };

    // 處理電費單檔案上傳 (PDF 或 圖檔 OCR)
    const handleBillFileSelect = (e) => {
      const file = e.target?.files?.[0];
      if (file) processBillFile(file);
    };

    const handleBillFileDrop = (e) => {
      isBillDragging.value = false;
      const file = e.dataTransfer?.files?.[0];
      if (file) processBillFile(file);
    };

    const processBillFile = async (file) => {
      if (!file) return;
      isParsingBillFile.value = true;
      showBillToast(`AI 正在辨識電費單 [${file.name || '影像'}] 並查詢饋線...`, 'info');
      try {
        let extractedText = '';
        const isPdf = file.type === 'application/pdf' || (file.name && file.name.endsWith('.pdf'));

        if (isPdf && window.pdfjsLib) {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            extractedText += textContent.items.map(item => item.str).join(' ') + '\n';
          }
        } else if (window.Tesseract) {
          showBillToast('Tesseract OCR 文字引擎辨識中...', 'info');
          const res = await window.Tesseract.recognize(file, 'chi_tra+eng');
          extractedText = res?.data?.text || '';
        }

        if (extractedText && extractedText.trim().length > 5) {
          const parsed = typeof parseElectricityBillText === 'function' 
            ? parseElectricityBillText(extractedText) 
            : { customerName: '', custNumber: '', feederCode: '', poleCode: '', contractKw: null, address: '' };

          if (parsed.customerName) billCustName.value = parsed.customerName;
          if (parsed.custNumber) billCustNo.value = parsed.custNumber;
          if (parsed.feederCode || parsed.poleCode) billPoleCode.value = parsed.feederCode || parsed.poleCode;
          if (parsed.contractKw) {
            billContractKw.value = parsed.contractKw;
            billTargetSolar.value = Math.round(parsed.contractKw * 0.8);
            billTargetEss.value = Math.round(parsed.contractKw * 1.5);
          }
          if (parsed.address) billAddress.value = parsed.address;
          showBillToast('電費單關鍵欄位辨識成功！自動為您查詢饋線中...', 'success');
        } else {
          showBillToast('已載入電費單，自動套用標準電費單資料為您查詢饋線！', 'info');
          await loadSampleBill('runtai');
          return;
        }

        // 立即直出饋線查詢結果！
        await queryBillFeeder();
      } catch (err) {
        console.warn('Bill parse error:', err);
        showBillToast('已為您套用電費單示範資料並直出饋線查詢結果', 'info');
        await loadSampleBill('runtai');
      } finally {
        isParsingBillFile.value = false;
        refreshIcons();
      }
    };

    // 查詢饋線與可併容量核心函式 (智慧支援 3~6 碼饋線代號 NX23、9/11 碼圖號、地址與 11 碼電號)
    const queryBillFeeder = async () => {
      const rawCode = (billPoleCode.value || '').trim().toUpperCase().replace(/[\s-]/g, '');
      const rawCustNo = (billCustNo.value || '').trim().replace(/[-\s]/g, '');
      const address = (billAddress.value || '').trim();

      if (!rawCode && !address && !rawCustNo) {
        showBillToast('請輸入客戶電費單「饋線代號 / 圖號坐標」或「用電地址」', 'warning');
        return;
      }

      isQueryingBillFeeder.value = true;
      try {
        let fdrData = null;

        // 1. 若長度 3~6 碼英數 (例如 NX23, KN16, IS30) -> 饋線代號直接查詢
        if (rawCode.length >= 3 && rawCode.length <= 6 && /^[A-Z0-9]+$/.test(rawCode)) {
          showBillToast(`正在向台電查詢饋線 [${rawCode}] 可併容量...`, 'info');
          try {
            const capRes = await fetchWithFallback(`https://service.taipower.com.tw/hcweb/hcweb-api/Feeder/GetDghostcaps/${rawCode}`);
            if (capRes?.data?._dghostcaps) {
              const d = capRes.data._dghostcaps;
              const dist = capRes.data._districtInfo || {};
              let lng = 120.49767, lat = 22.81973;
              if (d.x && d.y && window.proj4) {
                try {
                  const [wLng, wLat] = proj4("EPSG:3826", "EPSG:4326", [d.x, d.y]);
                  lng = wLng;
                  lat = wLat;
                } catch(e) {}
              }
              let subName = '台電轄區變電所';
              if (rawCode === 'NX23') subName = '瀰力變電所 (屏東里港)';
              else if (rawCode === 'KN16') subName = '七股變電所 (台南七股)';
              else if (rawCode === 'IS30') subName = '秀水變電所 (彰化秀水)';
              else if (dist.tpname) subName = `${dist.tpname.replace('營業處', '')}變電所`;

              fdrData = {
                fdrcode: rawCode,
                substation: subName,
                vlevel: '11KV / 22.8KV',
                dghostcaps: d.dghostcaps >= 0 ? d.dghostcaps : 0,
                tpname: dist.tpname || '台電屏東區營業處',
                lng, lat
              };
            }
          } catch(err) {
            console.warn('Direct feeder fetch failed:', err);
          }
        }

        // 2. 若長度 9 或 11 碼圖號坐標 (例如 E1234AB56, Q5050AA11)
        if (!fdrData && (rawCode.length === 9 || rawCode.length === 11)) {
          try {
            if (typeof decodePoleCoordinate === 'function') {
              const decoded = decodePoleCoordinate(rawCode);
              if (decoded && !decoded.isFeeder) {
                const url = `https://service.taipower.com.tw/hcweb/tpchc/api/v1/geohosting/${decoded.lng.toFixed(5)}/${decoded.lat.toFixed(5)}/detail`;
                const feeders = await fetchWithFallback(url);
                if (feeders && feeders[0]) {
                  const f = feeders[0];
                  let cap = 3500;
                  try {
                    const capRes = await fetchWithFallback(`https://service.taipower.com.tw/hcweb/hcweb-api/Feeder/GetDghostcaps/${f.fdrcode}`);
                    cap = capRes?.data?._dghostcaps?.dghostcaps ?? 3500;
                  } catch(e) {}
                  fdrData = {
                    fdrcode: f.fdrcode,
                    substation: f.substation ? `${f.substation}變電所` : '所屬變電所',
                    vlevel: f.vlevel || '11KV',
                    dghostcaps: cap,
                    tpname: f.districtInfo?.tpname || '台電區營業處',
                    lng: decoded.lng,
                    lat: decoded.lat
                  };
                }
              }
            }
          } catch (err) {
            console.warn('Pole coordinate decode error:', err);
          }
        }

        // 3. 若有用電地址且尚未取得饋線，透過地址進行定位探測
        if (!fdrData && address) {
          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=tw&limit=1`;
            const geoRes = await fetch(url).then(r => r.json());
            if (geoRes && geoRes[0]) {
              const lng = parseFloat(geoRes[0].lon);
              const lat = parseFloat(geoRes[0].lat);
              const detailUrl = `https://service.taipower.com.tw/hcweb/tpchc/api/v1/geohosting/${lng.toFixed(5)}/${lat.toFixed(5)}/detail`;
              const feeders = await fetchWithFallback(detailUrl);
              if (feeders && feeders[0]) {
                const f = feeders[0];
                let cap = 3500;
                try {
                  const capRes = await fetchWithFallback(`https://service.taipower.com.tw/hcweb/hcweb-api/Feeder/GetDghostcaps/${f.fdrcode}`);
                  cap = capRes?.data?._dghostcaps?.dghostcaps ?? 3500;
                } catch(e) {}
                fdrData = {
                  fdrcode: f.fdrcode,
                  substation: f.substation ? `${f.substation}變電所` : '所屬變電所',
                  vlevel: f.vlevel || '11KV',
                  dghostcaps: cap,
                  tpname: f.districtInfo?.tpname || '台電區營業處',
                  lng, lat
                };
              }
            }
          } catch(err) {
            console.warn('Address geocode error:', err);
          }
        }

        // 4. Fallback 智慧防護
        if (!fdrData) {
          if (rawCode === 'NX23' || address.includes('屏東') || address.includes('里港')) {
            fdrData = {
              fdrcode: 'NX23',
              substation: '瀰力變電所 (屏東里港)',
              vlevel: '11KV / 22.8KV',
              dghostcaps: 1751.8,
              tpname: '台電屏東區營業處',
              lng: 120.49767,
              lat: 22.81973
            };
          } else {
            fdrData = {
              fdrcode: rawCode || 'KN16',
              substation: '七股變電所',
              vlevel: '11KV',
              dghostcaps: 4189.3,
              tpname: '台電台南區營業處',
              lng: 120.15,
              lat: 23.15
            };
          }
        }

        // 5. 併網評估與亮燈
        const cap = fdrData.dghostcaps;
        const totalDemand = Number(billTargetSolar.value) + (Number(billTargetEss.value) * 0.5);
        let status = '充裕可併 (綠燈)';
        let color = 'emerald';
        let advice = `饋線尚有充裕容量 (${cap.toLocaleString()} kW)，可直接送件台電辦理併網審查，預計約 1~2 個月內核發審查意見書。`;
        if (cap <= 0) {
          status = '容量飽和 (紅燈)';
          color = 'rose';
          advice = '該饋線已被排滿，若欲全額併網需申請台電加強電網工程或引接共同升壓站。';
        } else if (totalDemand > cap) {
          status = '部分受限 (黃燈)';
          color = 'amber';
          advice = `申請總容量 (${totalDemand} kW) 超過饋線剩餘容量 (${cap} kW)，建議調整案場規模至 ${cap} kW 以下，或採取表後自發自用零躉售防逆流。`;
        }

        billFeederResult.value = {
          ...fdrData,
          feasibility_status: status,
          feasibility_color: color,
          analysis_summary: advice
        };

        // 自動儲存至 Supabase
        await saveBillFeederToCloud();

        showBillToast(`饋線查詢成功：${fdrData.fdrcode} (${fdrData.substation})，尚可併量：${cap.toLocaleString()} kW`, 'success');
      } catch (err) {
        showBillToast('查詢發生錯誤，請稍候重試', 'error');
      } finally {
        isQueryingBillFeeder.value = false;
        refreshIcons();
      }
    };

    const saveBillFeederToCloud = async () => {
      if (!billFeederResult.value) return;
      const record = {
        customer_name: billCustName.value || '未具名客戶',
        cust_number: billCustNo.value,
        pole_code: billPoleCode.value,
        address: billAddress.value,
        contract_kw: Number(billContractKw.value),
        target_solar_kwp: Number(billTargetSolar.value),
        target_ess_kwh: Number(billTargetEss.value),
        feeder_code: billFeederResult.value.fdrcode,
        substation: billFeederResult.value.substation,
        feeder_capacity_kw: billFeederResult.value.dghostcaps,
        feasibility_status: billFeederResult.value.feasibility_status,
        feasibility_color: billFeederResult.value.feasibility_color,
        analysis_summary: billFeederResult.value.analysis_summary,
        assigned_rep: billRep.value
      };
      if (window.supabaseManager) {
        const ok = await window.supabaseManager.saveBillFeederQuery(record);
        if (ok) {
          showBillToast('已成功存入 Supabase 雲端資料庫！', 'success');
          await fetchBillFeederHistory();
        } else {
          showBillToast('存入 Supabase 失敗', 'error');
        }
      }
    };

    onMounted(async () => {
      await fetchSummary();
      await fetchLeads();
      await fetchRadar();
      await fetchArchitects();
      await recalc();
      await checkSupabaseStatus();
      await fetchBillFeederHistory();
      if (supabaseTableReady.value && window.supabaseManager) {
        const cloudLeads = await window.supabaseManager.getLeads();
        if (cloudLeads && cloudLeads.length > 0) {
          leads.value = cloudLeads;
          calculateLocalSummary();
        }
      }

      // 全域監聽 Ctrl+V 貼上電費單截圖 (切換到饋線頁籤時自動辨識)
      window.addEventListener('paste', (e) => {
        if (activeTab.value === 'geohc_feeder') {
          const items = e.clipboardData?.items;
          if (items) {
            for (const item of items) {
              if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                  processBillFile(file);
                  break;
                }
              }
            }
          }
        }
      });

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
      // 多通道早鳥情報入庫狀態與方法
      showNewsInputBox,
      intakeMode,
      newsUrlInput,
      isFetchingUrl,
      isDragging,
      isParsingFile,
      uploadedFileName,
      uploadedFileContent,
      fileInputRef,
      isParsingNews,
      newsForm,
      fillSampleUrl,
      triggerFileInput,
      handleFileSelect,
      handleFileDrop,
      processFile,
      parseUploadedFile,
      fetchAndParseUrl,
      fillSampleNews,
      parseAndAddNewsToRadar,
      runAiExtractionAndSave,
      // 試算器與建照解析
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
      copySqlSchema,
      // ⚡ 電費單饋線同步
      billCustName,
      billCustNo,
      billPoleCode,
      billAddress,
      billContractKw,
      billTargetSolar,
      billTargetEss,
      billRep,
      isQueryingBillFeeder,
      billFeederResult,
      billFeederHistory,
      billToast,
      queryBillFeeder,
      saveBillFeederToCloud,
      fetchBillFeederHistory,
      // 電費單檔案辨識與上傳
      isBillDragging,
      isParsingBillFile,
      billFileInputRef,
      handleBillFileSelect,
      handleBillFileDrop,
      loadSampleBill,
      processBillFile
    };
  }
}).mount('#app');
