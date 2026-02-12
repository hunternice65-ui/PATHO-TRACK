
import { PathoItem, LoginLog, EntityType } from '../types';

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxHQXH0PNBSXZXYQrqrYE0HbVz56ga_i6_LfsEoZl2IGl1aYIWoiWmJ_JQV2MIxLzTp/exec';

const ITEMS_KEY = 'patho_track_items';
const LOGS_KEY = 'patho_track_login_logs';

async function callGAS(payload: any) {
  try {
    if (GAS_WEBAPP_URL.includes('REPLACE_WITH_YOUR_ACTUAL_ID')) {
      return { status: 'local_only' };
    }

    await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    return { status: 'sent' };
  } catch (error) {
    console.error('GAS Connection Error:', error);
    return { status: 'error', error };
  }
}

export const storageService = {
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

    await callGAS({ action: 'LOG_LOGIN', ...newLog });
  },

  async getAllItems(): Promise<PathoItem[]> {
    return JSON.parse(localStorage.getItem(ITEMS_KEY) || '[]');
  },

  async getItems(type: EntityType): Promise<PathoItem[]> {
    const items = await this.getAllItems();
    return items.filter(i => i.type === type);
  },

  /**
   * Returns true if saved, false if it was a duplicate
   * Logic: Same Case ID + Part + Type = Duplicate (Ignoring date for physical item uniqueness)
   */
  async saveItem(item: PathoItem): Promise<boolean> {
    const items = await this.getAllItems();
    
    // Strict comparison: Trim and lowercase for robustness
    const duplicate = items.find(i => 
      i.type === item.type && 
      (i.caseId || "").trim().toLowerCase() === (item.caseId || "").trim().toLowerCase() && 
      (i.part || "").trim().toLowerCase() === (item.part || "").trim().toLowerCase()
    );

    if (duplicate) {
      console.log('Duplicate detected, skipping save:', item.caseId, item.part);
      return false;
    }

    items.push(item);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));

    // Sync to Google Sheets
    await callGAS({ action: 'SAVE_ITEM', item });
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

    await callGAS({ action: 'UPDATE_STATUS', id, updates, handledBy });
  },

  async findByScannedData(type: EntityType, caseId: string, part: string): Promise<PathoItem | undefined> {
    const items = await this.getAllItems();
    return items
      .filter(i => 
        i.type === type && 
        (i.caseId || "").trim().toLowerCase() === (caseId || "").trim().toLowerCase() && 
        (i.part || "").trim().toLowerCase() === (part || "").trim().toLowerCase()
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }
};
