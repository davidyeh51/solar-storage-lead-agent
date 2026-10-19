-- ==============================================================================
-- 進能服南區業務部 · 早鳥預警拓客 AI 戰情室 (Solar & Storage Early-Bird Lead Platform)
-- Supabase PostgreSQL 資料庫結構定義、RLS 行級安全政策與種子資料
-- ==============================================================================

-- 1. 案場商機資料表 (solar_leads)
CREATE TABLE IF NOT EXISTS public.solar_leads (
    id TEXT PRIMARY KEY,
    permit_no TEXT,
    project_name TEXT NOT NULL,
    applicant TEXT NOT NULL,
    architect TEXT,
    contractor TEXT,
    use_category TEXT DEFAULT 'C-2 (一般廠房)',
    structure TEXT DEFAULT '鋼骨構造 (S)',
    location TEXT,
    site_area_m2 NUMERIC DEFAULT 0,
    building_area_m2 NUMERIC DEFAULT 0,
    floor_area_m2 NUMERIC DEFAULT 0,
    contract_capacity_kw NUMERIC DEFAULT 0,
    date_issued TEXT,
    stage_code TEXT DEFAULT 'Stage2',
    stage_badge TEXT,
    pipeline_status TEXT DEFAULT '新進線索',
    pipeline_color TEXT DEFAULT 'blue',
    assigned_rep TEXT DEFAULT 'Vanessa',
    notes TEXT,
    roi_result JSONB,
    battle_card JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建築師與營造廠網絡資料表 (architects)
CREATE TABLE IF NOT EXISTS public.architects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    principal TEXT,
    location TEXT,
    specialty TEXT,
    c_class_frequency TEXT,
    representative_projects JSONB DEFAULT '[]'::jsonb,
    partner_epc JSONB DEFAULT '[]'::jsonb,
    cooperation_status TEXT DEFAULT '未接觸',
    cooperation_color TEXT DEFAULT 'blue',
    collaboration_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 實時情報雷達快取表 (early_radar)
CREATE TABLE IF NOT EXISTS public.early_radar (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    full_title TEXT,
    source TEXT,
    link TEXT,
    published TEXT,
    category_id TEXT,
    category_name TEXT,
    detected_parks JSONB DEFAULT '[]'::jsonb,
    detected_companies JSONB DEFAULT '[]'::jsonb,
    stage TEXT,
    stage_code TEXT,
    stage_badge TEXT,
    value_rating TEXT DEFAULT 'MEDIUM',
    fetched_at TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 🔒 強制啟用 RLS (Row Level Security) 行級安全規範
-- ==============================================================================

ALTER TABLE public.solar_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_radar ENABLE ROW LEVEL SECURITY;

-- 允許所有人 (含 anon client) 讀取資料
DROP POLICY IF EXISTS "Allow anon read solar_leads" ON public.solar_leads;
CREATE POLICY "Allow anon read solar_leads" ON public.solar_leads
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read architects" ON public.architects;
CREATE POLICY "Allow anon read architects" ON public.architects
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read early_radar" ON public.early_radar;
CREATE POLICY "Allow anon read early_radar" ON public.early_radar
    FOR SELECT TO anon, authenticated USING (true);

-- 允許建立與修改案場及狀態 (支援前端雙向同步)
DROP POLICY IF EXISTS "Allow anon insert solar_leads" ON public.solar_leads;
CREATE POLICY "Allow anon insert solar_leads" ON public.solar_leads
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update solar_leads" ON public.solar_leads;
CREATE POLICY "Allow anon update solar_leads" ON public.solar_leads
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update architects" ON public.architects;
CREATE POLICY "Allow anon update architects" ON public.architects
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert early_radar" ON public.early_radar;
CREATE POLICY "Allow anon insert early_radar" ON public.early_radar
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update early_radar" ON public.early_radar;
CREATE POLICY "Allow anon update early_radar" ON public.early_radar
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 📊 寫入南台灣重點案場與建築師網絡種子資料
-- ==============================================================================

INSERT INTO public.architects (id, name, principal, location, specialty, c_class_frequency, representative_projects, partner_epc, cooperation_status, cooperation_color, collaboration_notes)
VALUES 
('arch_001', '九典聯合建築師事務所', '張清華 / 郭英釗 建築師', '台北 / 高雄辦公室', '頂級綠建築、低碳工業廠房、太陽能BIPV一體化整合', '極高 (Top 1)', '["台積電南科綠建築廠房", "高雄氣候示範園區", "科學園區研發大樓"]'::jsonb, '["達欣工程", "互助營造", "聖暉工程"]'::jsonb, '圖說規格綁定中', 'emerald', '事務所對《再生能源發展條例》第12-1條屋頂光電要求極為重視，樂於由專業光儲業者協助繪製3D光電配置圖與台電審查預估。'),
('arch_002', '潘冀聯合建築師事務所 (JJP)', '潘冀 / 蘇重威 建築師', '台北 / 新竹 / 台南辦公室', '半導體晶圓廠、高科技研發總部、精密製造廠房', '極高 (Top 2)', '["台積電全球研發中心", "聯發科竹科總部", "南亞科先進廠房", "南科半導體廠"]'::jsonb, '["漢唐集成", "帆宣系統", "亞翔工程", "大陸工程"]'::jsonb, '法規諮詢協作中', 'blue', '專精半導體製程，高度關注振動隔離 (Vibration Control) 與表後儲能防護區劃 (NFPA 855)。建議由 Vanessa 攜同技術團隊拜訪。'),
('arch_003', '喻台生建築師事務所', '喻台生 建築師', '台北 / 高雄', '工業區大型標準廠房、倉儲物流中心、精密機械廠房', '高 (Top 3)', '["經濟部工業區標準廠房", "楠梓產業園區廠房", "白埔產業園區規劃案"]'::jsonb, '["根基營造", "中鹿營造"]'::jsonb, '已完成法規試算', 'cyan', '主辦白埔園區與南台灣多個工業區廠房規劃。提供免費「結構載重預留檢討書」即可快速鎖定設計圖規格。'),
('arch_004', '許銘陽建築師事務所', '許銘陽 建築師', '高雄 / 屏東', '南台灣在地特用化學、金屬扣件、傳產升級智慧綠能廠房', '高 (屏東/高雄在地霸主)', '["屏東科學園區進駐廠房", "和發產業園區廠房", "岡山扣件大廠新建案"]'::jsonb, '["甲級在地營造廠", "山林水", "義力營造"]'::jsonb, '密切拜訪洽談中', 'amber', '掌握屏東科學園區及高雄在地多起 C1/C2 廠房案源。非常歡迎光電儲能 EPC 提供一條龍台電饋線代辦與法規背書。'),
('arch_005', '趙建銘建築師事務所', '趙建銘 建築師', '高雄市', '現代工業美學廠房、科技總部、智慧微電網整合展示中心', '中高', '["高雄多功能經貿園區", "南科高雄園區生技廠房"]'::jsonb, '["潤弘精密", "建國工程"]'::jsonb, '未接觸', 'gray', '重視建築立面美感與太陽光電系統整合度，切入時應展示高質感黑框單晶模組與無外露管線設計方案。'),
('arch_006', '宗邁建築師事務所', '費宗澄 / 陳邁 建築師', '台北 / 台南', '大專院校大樓、公有示範設施、大型公共工程與微電網場域', '中高 (S5微電網重點)', '["成功大學綠能科技研發大樓", "南科育成中心", "公有標準廠房示範案"]'::jsonb, '["榮工工程", "皇昌營造"]'::jsonb, '微電網技術交流中', 'purple', '適合指派給 Julia 對接，主打 S5 示範型微電網、EMS 整合管理與校園防災儲能專案。')
ON CONFLICT (id) DO UPDATE SET 
    cooperation_status = EXCLUDED.cooperation_status,
    collaboration_notes = EXCLUDED.collaboration_notes,
    updated_at = NOW();

-- 案場種子資料
INSERT INTO public.solar_leads (id, permit_no, project_name, applicant, architect, contractor, use_category, structure, location, site_area_m2, building_area_m2, floor_area_m2, contract_capacity_kw, date_issued, stage_code, stage_badge, pipeline_status, pipeline_color, assigned_rep, notes)
VALUES
('lead_001', '(115)屏科建字第001號', '宇晨材料科技屏東科學園區一期廠房新建工程', '宇晨材料科技股份有限公司', '許銘陽建築師事務所', '達欣工程股份有限公司', 'C-1 (特殊廠房/散熱材料)', '鋼骨構造 (S)', '屏東縣屏東市屏東科學園區產一用地', 18500, 9250, 27750, 4500, '2026-08-15', 'Stage2', 'Stage 2: 建照核發 (黃金攔截期)', '首訪進行中 (已邀約建築師)', 'blue', 'Vanessa', '屏科首家動土建廠企業！主攻AI伺服器與半導體高導熱液態金屬材料，建照圖說剛定案，需立即由 Vanessa 協調結構光電排佈。'),
('lead_002', '(115)屏科建字第002號', '聚和國際屏東科學園區生技特化新廠新建工程', '聚和國際股份有限公司', '潘冀聯合建築師事務所', '互助營造股份有限公司', 'C-1 (特殊廠房/生技特化)', '鋼骨鋼筋混凝土 (SRC)', '屏東縣屏東市屏東科學園區產二用地', 32000, 16000, 48000, 8000, '2026-09-02', 'Stage2', 'Stage 2: 建照核發 (黃金攔截期)', '圖說協作中 (提供結構計算書)', 'emerald', 'Vanessa', '全球生物緩衝劑龍頭，契約容量 8MW 屬用電大戶條款強烈約束對象！屋頂可設約 1,600 kWp 光電，並規劃 1.5MWh 表後儲能。'),
('lead_003', '(115)高市工建築字第03810號', '高雄白埔產業園區台積電先進封裝設備支援中心新建案', '帆宣系統科技股份有限公司', '九典聯合建築師事務所', '漢唐集成股份有限公司', 'C-1 (高科技廠務工程廠房)', '鋼骨構造 (S)', '高雄市岡山區白埔產業園區專區C', 26000, 13000, 39000, 6500, '2026-09-20', 'Stage2', 'Stage 2: 建照核發 (黃金攔截期)', '規格已送審 (綁定進金生方案)', 'purple', 'Vanessa', '白埔園區旗艦供應鏈大廠，環評承諾屋頂光電覆蓋率達 50% 以上，Vanessa 與九典張建築師已完成 CAD 圖說繪製。'),
('lead_004', '(115)屏科審議字第035號', '南亞科技屏東科學園區3D晶圓封測新廠投資案', '南亞科技股份有限公司', '潘冀聯合建築師事務所', '工程籌備處', 'C-1 (半導體3D晶圓封測廠)', '鋼骨鋼筋混凝土 (SRC)', '屏東縣屏東市屏東科學園區', 55000, 27500, 110000, 25000, '2026-10-05', 'Stage1', 'Stage 1: 早期預警 (國科會審議通過)', '早期接洽中 (拜訪籌備處)', 'amber', 'Vanessa', '國科會第35次審議會核准之超級重量級投資案！距離掛建照還有 6~9 個月，為 2026~2027 最具戰略價值之光儲整合標的！'),
('lead_005', '(115)南工建字第01988號', '高雄金屬精工老客戶二期智慧綠能廠房擴建案', '舜煜實業股份有限公司 (Key Account)', '喻台生建築師事務所', '根基營造股份有限公司', 'C-2 (一般金屬精密加工廠)', '鋼骨構造 (S)', '台南市新市產業園區二期', 14000, 7000, 14000, 2200, '2026-09-18', 'Stage2', 'Stage 2: 建照核發 (擴建二期)', '議價簽約中 (一期續約客戶)', 'emerald', 'Jane', 'Jane 負責之 S1 既有 Key Account 二期擴廠案，業主對一期發電收益極滿意，已指名二期光儲合約由進金生統包。'),
('lead_006', '(115)南科微電第008號', '國科會南科高雄園區智慧微電網示範標準廠房暨防救災儲能標案', '南部科學園區管理局 / 國科會', '宗邁建築師事務所', '公開招標中', 'C-2 / 公共設施 (示範標準廠房)', '鋼骨鋼筋混凝土 (SRC)', '高雄市路竹區南科高雄園區', 20000, 8000, 24000, 3000, '2026-10-01', 'Stage3', 'Stage 3: 公共標案招標 (發包期)', '備標聯營中 (結合EMS夥伴)', 'cyan', 'Julia', 'Julia 負責之 S5 微電網旗艦標案，需建置 800kW 屋頂光電 + 1.2MWh 儲能 + EMS 區域微電網黑啟動功能。')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 4. 台電饋線可併網容量資料庫 (feeders)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.feeders (
    fdrcode TEXT PRIMARY KEY,
    fdrname TEXT,
    substation TEXT,
    vlevel TEXT DEFAULT '11KV',
    dghostcaps NUMERIC DEFAULT 0,
    tpid INT,
    tpname TEXT,
    tpaddr TEXT,
    tptel TEXT,
    x NUMERIC,
    y NUMERIC,
    lng NUMERIC,
    lat NUMERIC,
    geom JSONB,
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. 共同升壓站資料表 (stepup_substations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.stepup_substations (
    uuid TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    substation_id TEXT,
    district TEXT,
    due_date TEXT,
    bscapacity NUMERIC DEFAULT 0,
    usercapacity NUMERIC DEFAULT 0,
    userapcapacity NUMERIC DEFAULT 0,
    userleftcapacity NUMERIC DEFAULT 0,
    othercapacity NUMERIC DEFAULT 0,
    otherapcapacity NUMERIC DEFAULT 0,
    otherleftcapacity NUMERIC DEFAULT 0,
    longitude NUMERIC,
    latitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. 客戶電費單 ✕ 饋線同步查詢記錄表 (bill_feeder_queries)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bill_feeder_queries (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    cust_number TEXT,
    pole_code TEXT,
    address TEXT,
    contract_kw NUMERIC DEFAULT 0,
    voltage_level TEXT DEFAULT '高壓 11.4kV',
    target_solar_kwp NUMERIC DEFAULT 0,
    target_ess_kwh NUMERIC DEFAULT 0,
    feeder_code TEXT,
    substation TEXT,
    feeder_capacity_kw NUMERIC DEFAULT 0,
    feasibility_status TEXT DEFAULT '充裕可併',
    feasibility_color TEXT DEFAULT 'emerald',
    analysis_summary TEXT,
    assigned_rep TEXT DEFAULT 'Vanessa',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. 系統一鍵更新與台電同步紀錄表 (system_sync_logs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_sync_logs (
    id SERIAL PRIMARY KEY,
    sync_type TEXT DEFAULT 'full_sync',
    source_date TEXT,
    feeders_count INT DEFAULT 0,
    substations_count INT DEFAULT 0,
    status TEXT DEFAULT 'SUCCESS',
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 🔒 擴充資料表之 RLS (Row Level Security)
-- ==============================================================================
ALTER TABLE public.feeders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stepup_substations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_feeder_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_sync_logs ENABLE ROW LEVEL SECURITY;

-- 允許 anon / authenticated 讀取
DROP POLICY IF EXISTS "Allow anon read feeders" ON public.feeders;
CREATE POLICY "Allow anon read feeders" ON public.feeders FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read stepup_substations" ON public.stepup_substations;
CREATE POLICY "Allow anon read stepup_substations" ON public.stepup_substations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read bill_feeder_queries" ON public.bill_feeder_queries;
CREATE POLICY "Allow anon read bill_feeder_queries" ON public.bill_feeder_queries FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow anon read system_sync_logs" ON public.system_sync_logs;
CREATE POLICY "Allow anon read system_sync_logs" ON public.system_sync_logs FOR SELECT TO anon, authenticated USING (true);

-- 允許前端建立與更新饋線資料、電費單記錄與更新日誌
DROP POLICY IF EXISTS "Allow anon write feeders" ON public.feeders;
CREATE POLICY "Allow anon write feeders" ON public.feeders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon write stepup_substations" ON public.stepup_substations;
CREATE POLICY "Allow anon write stepup_substations" ON public.stepup_substations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon write bill_feeder_queries" ON public.bill_feeder_queries;
CREATE POLICY "Allow anon write bill_feeder_queries" ON public.bill_feeder_queries FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon write system_sync_logs" ON public.system_sync_logs;
CREATE POLICY "Allow anon write system_sync_logs" ON public.system_sync_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- ⚡ 饋線與升壓站種子資料
-- ==============================================================================
INSERT INTO public.feeders (fdrcode, fdrname, substation, vlevel, dghostcaps, tpid, tpname, tpaddr, tptel, lng, lat, source_updated_at)
VALUES 
('KN16', '七股28號饋線', '七股變電所', '11KV', 4189.3, 108, '台電台南區處', '台南市忠義路一段109號', '06-2160121#2511', 120.15, 23.15, '2026-09-25T02:10:55'),
('IS30', '秀水754號饋線', '秀水變電所', '11KV', -2.0, 106, '台電彰化區處', '彰化市中山路二段418號', '04-7256461#6306', 120.35, 23.95, '2026-09-25T02:10:55'),
('PT08', '屏東工業饋線08', '屏東變電所', '22.8KV', 5240.0, 110, '台電屏東區處', '屏東市逢甲路', '08-7322111', 120.48, 22.67, '2026-09-25T02:10:55'),
('BP12', '白埔高壓饋線12', '岡山變電所', '22.8KV', 7850.0, 109, '台電高雄區處', '高雄市忠孝一路', '07-2011211', 120.31, 22.78, '2026-09-25T02:10:55')
ON CONFLICT (fdrcode) DO UPDATE SET 
    dghostcaps = EXCLUDED.dghostcaps,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = NOW();

INSERT INTO public.stepup_substations (uuid, company_name, substation_id, longitude, latitude, bscapacity, userleftcapacity, otherleftcapacity, due_date)
VALUES
('14cd5e6f-3e47-4de3-8d3e-c77a477a3390', '天英能源股份有限公司', 'TY-01', 120.1279, 23.12406, 100, 25.5, 12.8, '2026-12-31'),
('77bba5fa-a678-4e5b-ba50-77b61cdbba63', '星能股份有限公司', 'SN-02', 120.1026, 23.1248, 150, 40.0, 18.5, '2027-06-30'),
('718fa58f-e082-425e-963c-d3a56df5ec76', '彰品風力發電股份有限公司', 'CP-01', 120.31188, 23.9821, 80, 15.0, 5.0, '2026-11-30')
ON CONFLICT (uuid) DO NOTHING;

INSERT INTO public.system_sync_logs (sync_type, source_date, feeders_count, substations_count, status, message)
VALUES ('full_sync', '2026-09-25', 4, 3, 'SUCCESS', '初始化台電配電級再生能源可併容量與升壓站同步完成');

