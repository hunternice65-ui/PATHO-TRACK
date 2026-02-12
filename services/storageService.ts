
import { PathoItem, LoginLog, EntityType } from '../types';

// IMPORTANT: Ensure this URL is updated to your latest GAS deployment
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxHQXH0PNBSXZXYQrqrYE0HbVz56ga_i6_LfsEoZl2IGl1aYIWoiWmJ_JQV2MIxLzTp/exec';

const ITEMS_KEY = 'patho_track_items';
const LOGS_KEY = 'patho_track_login_logs';

const normalize = (str: string) => (str || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const storageService = {
  async syncFromCloud(): Promise<boolean> {
    try {
      if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('REPLACE')) return false;
      
      console.log("Syncing with Cloud...");
      // Using standard GET request. Browser handles the 302 redirect.
      const response = await fetch(`${GAS_WEBAPP_URL}?t=${Date.now()}`); 
      
      if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
      
      const cloudData = await response.json();
      if (Array.isArray(cloudData)) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(cloudData));
        console.log(`Cloud sync successful: ${cloudData.length} items fetched.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Cloud Sync Error:', error);
      return false;
    }
  },

  async logLogin(username: string): Promise<void> {
    let ip = 'Unknown';
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ip = data.ip;
    } catch (e) {}
    
    const logs: LoginLog[] = JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    const newLog: LoginLog = { username, timestamp: new Date().toISOString(), ip };
    logs.push(newLog);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));

    // Async POST to GAS (no-cors for speed and to avoid preflight issues)
    fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'LOG_LOGIN', ...newLog })
    }).catch(err => console.error("GAS Login Log Failed:", err));
  },

  async getAllItems(): Promise<PathoItem[]> {
    const local = localStorage.getItem(ITEMS_KEY);
    return local ? JSON.parse(local) : [];
  },

  async saveItem(item: PathoItem): Promise<boolean> {
    const items = await this.getAllItems();
    const targetCaseId = normalize(item.caseId);
    const targetPart = normalize(item.part);

    const duplicate = items.find(i => 
      i.type === item.type && 
      normalize(i.caseId) === targetCaseId && 
      normalize(i.part) === targetPart
    );

    if (duplicate) return false;

    items.push(item);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));

    // Send to Google Sheets
    fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'SAVE_ITEM', item })
    }).catch(err => console.error("GAS Save Failed:", err));

    return true;
  },

  async updateItemStatus(id: string, updates: Partial<PathoItem>, handledBy: string): Promise<void> {
    let items = await this.getAllItems();
    items = items.map(item => item.id === id ? { 
      ...item, 
      ...updates, 
      recordedBy: handledBy, 
      updatedAt: new Date().toISOString() 
    } : item);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));

    fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ action: 'UPDATE_STATUS', id, updates, handledBy })
    }).catch(err => console.error("GAS Update Failed:", err));
  },

  async findByScannedData(type: EntityType, caseId: string, part: string): Promise<PathoItem | undefined> {
    const items = await this.getAllItems();
    const targetCaseId = normalize(caseId);
    const targetPart = normalize(part);

    return items
      .filter(i => 
        i.type === type && 
        normalize(i.caseId) === targetCaseId && 
        normalize(i.part) === targetPart
      )
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
  }
};
