/**
 * 智馳光儲 · Supabase 雲端資料庫整合客戶端 (Supabase Client Module)
 * 符合 github-supabase-web 規範：僅暴露 anon public key，支援本機離線與雲端雙軌同步
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
    if (!this.client || !this.tableReady) return null;
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
    if (!this.client || !this.tableReady) return false;
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
    if (!this.client || !this.tableReady) return null;
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
    if (!this.client || !this.tableReady) return false;
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
}

// 註冊全域單例
window.supabaseManager = new SupabaseManager();
