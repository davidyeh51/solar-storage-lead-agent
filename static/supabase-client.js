/**
 * 進能服南區業務部 · Supabase 雲端資料庫整合客戶端 (Supabase Client Module)
 * 符合 github-supabase-web 規範：僅暴露 anon public key，支援本機離線與雲端雙軌同步
 * 支援 solar_leads、architects、early_radar 三大資料表之即時讀寫與批次同步
 */

const DEFAULT_SUPABASE_URL = "https://cowljafosekwvxithwjd.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvd2xqYWZvc2Vrd3Z4aXRod2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NTYzODcsImV4cCI6MjA5NDIzMjM4N30.c8YXP7EXDeTOw-mJEmnYZ_DJeZv6Qt6HVDzEf8J2K_I";

class SupabaseManager {
  constructor() {
    this.url = localStorage.getItem('SB_URL') || DEFAULT_SUPABASE_URL;
    this.key = localStorage.getItem('SB_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;
    this.client = null;
    this.isConnected = false;
    this.tableReady = false;
    this.init();
  }

  init() {
    if (window.supabase && this.url && this.key) {
      try {
        this.client = window.supabase.createClient(this.url, this.key);
      } catch (e) {
        console.warn('[Supabase] Init error:', e);
      }
    }
  }

  saveConfig(newUrl, newKey) {
    this.url = newUrl.trim();
    this.key = newKey.trim();
    localStorage.setItem('SB_URL', this.url);
    localStorage.setItem('SB_ANON_KEY', this.key);
    this.init();
  }

  async testConnection() {
    if (!this.client) this.init();
    if (!this.client) return { connected: false, message: 'Supabase JS SDK 尚未載入' };

    try {
      // 測試讀取 solar_leads 資料表
      const { data, error } = await this.client
        .from('solar_leads')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
          this.isConnected = true;
          this.tableReady = false;
          return {
            connected: true,
            tableReady: false,
            message: 'Supabase 專案已連通，但尚未建立 solar_leads 資料表，請在 SQL Editor 執行 supabase-schema.sql！'
          };
        }
        return { connected: false, message: error.message };
      }

      this.isConnected = true;
      this.tableReady = true;
      return { connected: true, tableReady: true, message: '🟢 Supabase 雲端 PostgreSQL 資料庫已連線！' };
    } catch (e) {
      return { connected: false, message: e.message || '連線逾時' };
    }
  }

  // 取得雲端案場
  async getLeads() {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('solar_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getLeads error, using local fallback:', e);
      return null;
    }
  }

  // 同步新案場至雲端
  async upsertLead(lead) {
    if (!this.client) this.init();
    if (!this.client) return false;
    try {
      const record = {
        id: lead.id,
        permit_no: lead.permit_no,
        project_name: lead.project_name,
        applicant: lead.applicant,
        architect: lead.architect,
        contractor: lead.contractor,
        use_category: lead.use_category,
        structure: lead.structure,
        location: lead.location,
        site_area_m2: lead.site_area_m2,
        building_area_m2: lead.building_area_m2,
        floor_area_m2: lead.floor_area_m2,
        contract_capacity_kw: lead.contract_capacity_kw,
        date_issued: lead.date_issued,
        stage_code: lead.stage_code,
        stage_badge: lead.stage_badge,
        pipeline_status: lead.pipeline_status,
        pipeline_color: lead.pipeline_color,
        assigned_rep: lead.assigned_rep,
        notes: lead.notes,
        roi_result: lead.roi_result,
        battle_card: lead.battle_card,
        updated_at: new Date().toISOString()
      };
      const { error } = await this.client
        .from('solar_leads')
        .upsert(record, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] upsertLead error:', e);
      return false;
    }
  }

  // 取得建築師名單
  async getArchitects() {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('architects')
        .select('*');
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getArchitects error:', e);
      return null;
    }
  }

  // 更新建築師狀態
  async updateArchitect(archId, updates) {
    if (!this.client) this.init();
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('architects')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', archId);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] updateArchitect error:', e);
      return false;
    }
  }

  // 取得實時早鳥雷達快訊 (早鳥情報庫)
  async getRadar(limit = 100) {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('early_radar')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getRadar error:', e);
      return null;
    }
  }

  // 單筆新增或更新實時雷達情報 (用於手動貼入新聞或單筆新訊)
  async upsertRadar(item) {
    if (!this.client) this.init();
    if (!this.client) return false;
    try {
      const record = {
        id: item.id || `radar_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: item.title,
        full_title: item.full_title || item.title,
        source: item.source || '業務手動貼入情報',
        link: item.link || '',
        published: item.published || new Date().toISOString().replace('T', ' ').substring(0, 16),
        category_id: item.category_id || 'Stage1_Park',
        category_name: item.category_name || '南台灣新興園區動態',
        detected_parks: item.detected_parks || [],
        detected_companies: item.detected_companies || [],
        stage: item.stage || 'Stage 1: 早期預警',
        stage_code: item.stage_code || 'Stage1',
        stage_badge: item.stage_badge || 'Stage 1: 早期預警',
        value_rating: item.value_rating || 'HIGH',
        fetched_at: item.fetched_at || new Date().toISOString()
      };
      const { error } = await this.client
        .from('early_radar')
        .upsert(record, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] upsertRadar error:', e);
      return false;
    }
  }

  // 批次寫入實時雷達快訊 (主管點擊「即時雷達掃描」時同步多筆情報)
  async batchUpsertRadar(items) {
    if (!this.client) this.init();
    if (!this.client || !items || items.length === 0) return false;
    try {
      const records = items.map(item => ({
        id: item.id || `radar_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        title: item.title,
        full_title: item.full_title || item.title,
        source: item.source || '即時雷達掃描',
        link: item.link || '',
        published: item.published || new Date().toISOString().replace('T', ' ').substring(0, 16),
        category_id: item.category_id || 'Stage1_Park',
        category_name: item.category_name || '早期商機快訊',
        detected_parks: item.detected_parks || [],
        detected_companies: item.detected_companies || [],
        stage: item.stage || 'Stage 1: 早期預警',
        stage_code: item.stage_code || 'Stage1',
        stage_badge: item.stage_badge || 'Stage 1: 早期預警',
        value_rating: item.value_rating || 'HIGH',
        fetched_at: item.fetched_at || new Date().toISOString()
      }));
      const { error } = await this.client
        .from('early_radar')
        .upsert(records, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] batchUpsertRadar error:', e);
      return false;
    }
  }

  // ==========================================
  // ⚡ 台電饋線可併網容量與電費單查詢整合方法
  // ==========================================

  // 1. 取得饋線快取或單筆饋線
  async getFeederByCode(fdrcode) {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('feeders')
        .select('*')
        .eq('fdrcode', fdrcode.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getFeederByCode error:', e);
      return null;
    }
  }

  // 2. 儲存/更新饋線資料
  async upsertFeeder(feeder) {
    if (!this.client) this.init();
    if (!this.client || !feeder) return false;
    try {
      const { error } = await this.client
        .from('feeders')
        .upsert(feeder, { onConflict: 'fdrcode' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] upsertFeeder error:', e);
      return false;
    }
  }

  // 3. 取得所有共同升壓站列表
  async fetchStepupSubstations() {
    if (!this.client) this.init();
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('stepup_substations')
        .select('*')
        .order('company_name', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[Supabase] fetchStepupSubstations error:', e);
      return [];
    }
  }

  // 4. 批次儲存共同升壓站
  async batchUpsertSubstations(substations) {
    if (!this.client) this.init();
    if (!this.client || !substations || substations.length === 0) return false;
    try {
      const { error } = await this.client
        .from('stepup_substations')
        .upsert(substations, { onConflict: 'uuid' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] batchUpsertSubstations error:', e);
      return false;
    }
  }

  // 5. 儲存客戶電費單 ✕ 饋線同步查詢記錄
  async saveBillFeederQuery(query) {
    if (!this.client) this.init();
    if (!this.client) return false;
    try {
      const record = {
        id: query.id || `bill_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        customer_name: query.customer_name || '未具名客戶',
        cust_number: query.cust_number || '',
        pole_code: query.pole_code || '',
        address: query.address || '',
        contract_kw: Number(query.contract_kw) || 0,
        voltage_level: query.voltage_level || '高壓 11.4kV',
        target_solar_kwp: Number(query.target_solar_kwp) || 0,
        target_ess_kwh: Number(query.target_ess_kwh) || 0,
        feeder_code: query.feeder_code || '',
        substation: query.substation || '',
        feeder_capacity_kw: Number(query.feeder_capacity_kw) || 0,
        feasibility_status: query.feasibility_status || '待審查',
        feasibility_color: query.feasibility_color || 'emerald',
        analysis_summary: query.analysis_summary || '',
        assigned_rep: query.assigned_rep || 'Vanessa',
        created_at: new Date().toISOString()
      };
      const { error } = await this.client
        .from('bill_feeder_queries')
        .upsert(record, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] saveBillFeederQuery error:', e);
      return false;
    }
  }

  // 6. 讀取電費單饋線歷史查詢清單
  async fetchBillFeederQueries(limit = 20) {
    if (!this.client) this.init();
    if (!this.client) return [];
    try {
      const { data, error } = await this.client
        .from('bill_feeder_queries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[Supabase] fetchBillFeederQueries error:', e);
      return [];
    }
  }

  // 7. 記錄一鍵更新同步紀錄
  async logSync(syncInfo) {
    if (!this.client) this.init();
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('system_sync_logs')
        .insert([{
          sync_type: syncInfo.sync_type || 'full_sync',
          source_date: syncInfo.source_date || new Date().toISOString().substring(0, 10),
          feeders_count: syncInfo.feeders_count || 0,
          substations_count: syncInfo.substations_count || 0,
          status: syncInfo.status || 'SUCCESS',
          message: syncInfo.message || '台電資料同步完成',
          created_at: new Date().toISOString()
        }]);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] logSync error:', e);
      return false;
    }
  }

  // 8. 讀取最新同步紀錄
  async getLatestSyncLog() {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('system_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getLatestSyncLog error:', e);
      return null;
    }
  }

  // ==========================================
  // 📑 地籍圖、地號與台電函文管理 (cadastre_letters)
  // ==========================================

  // 9. 讀取所有地籍函文紀錄
  async getCadastreLetters() {
    if (!this.client) this.init();
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('cadastre_letters')
        .select('*')
        .order('doc_date', { ascending: false });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[Supabase] getCadastreLetters error:', e);
      return null;
    }
  }

  // 10. 新增或更新地籍函文紀錄
  async upsertCadastreLetter(doc) {
    if (!this.client) this.init();
    if (!this.client || !doc) return false;
    try {
      const record = {
        id: doc.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        doc_number: doc.doc_number || '未編號函文',
        doc_date: doc.doc_date || new Date().toISOString().substring(0, 10),
        issuer: doc.issuer || '台灣電力公司',
        recipient: doc.recipient || '進金生能源服務股份有限公司',
        subject: doc.subject || '',
        county_code: doc.county_code || 'Q',
        county_name: doc.county_name || '嘉義縣',
        town_code: doc.town_code || '',
        town_name: doc.town_name || '',
        section_code: doc.section_code || '',
        section_name: doc.section_name || '',
        land_no: doc.land_no || '',
        full_land_title: doc.full_land_title || '',
        office_name: doc.office_name || '',
        substation: doc.substation || '',
        feeder_code: doc.feeder_code || '',
        approved_capacity_kw: Number(doc.approved_capacity_kw) || 0,
        capacity_status: doc.capacity_status || '充裕可併',
        policy_type: doc.policy_type || '不保留',
        contact_person: doc.contact_person || '',
        contact_email: doc.contact_email || '',
        cadastral_map_url: doc.cadastral_map_url || '',
        letter_file_name: doc.letter_file_name || '',
        letter_file_size: doc.letter_file_size || '',
        letter_file_url: doc.letter_file_url || '',
        letter_content_summary: doc.letter_content_summary || '',
        longitude: doc.longitude ? Number(doc.longitude) : null,
        latitude: doc.latitude ? Number(doc.latitude) : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await this.client
        .from('cadastre_letters')
        .upsert(record, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] upsertCadastreLetter error:', e);
      return false;
    }
  }

  // 11. 刪除地籍函文紀錄
  async deleteCadastreLetter(id) {
    if (!this.client) this.init();
    if (!this.client || !id) return false;
    try {
      const { error } = await this.client
        .from('cadastre_letters')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.warn('[Supabase] deleteCadastreLetter error:', e);
      return false;
    }
  }
}

// 註冊全域單例
window.supabaseManager = new SupabaseManager();

