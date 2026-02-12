
import { PathoItem, LoginLog, EntityType } from '../types';

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxHQXH0PNBSXZXYQrqrYE0HbVz56ga_i6_LfsEoZl2IGl1aYIWoiWmJ_JQV2MIxLzTp/exec';

const ITEMS_KEY = 'patho_track_items';
const LOGS_KEY = 'patho_track_login_logs';

/**
 * Normalize string for strict comparison (Remove all non-alphanumeric and lowercase)
 * e.g., "S-24/1234-A" -> "s241234a"
 */
const normalize = (str: string) => (str || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

async function callGAS(payload: any) {
  try {
    // Check if the URL is still the placeholder or if we are in a dev environment without setup
    if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('REPLACE_WITH_YOUR_ACTUAL_ID')) {
      return { status: 'local_only' };
    }

    // Vercel/Browsers cannot read GAS responses due to CORS redirects. 
    // We use no-cors to at least ensure the request is sent to the Google endpoint.
    await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    return { status: 'sent' };
  } catch (error) {
    console.error('GAS Sync Error:', error);
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
   * Core Deduplication Logic
   * Returns true if saved, false if it was a duplicate
   */
  async saveItem(item: PathoItem): Promise<boolean> {
    const items = await this.getAllItems();
    
    const targetCaseId = normalize(item.caseId);
    const targetPart = normalize(item.part);

    // Check against local database first (Standard for Vercel/Serverless apps to ensure speed)
    const duplicate = items.find(i => 
      i.type === item.type && 
      normalize(i.caseId) === targetCaseId && 
      normalize(i.part) === targetPart
    );

    if (duplicate) {
      console.warn(`Duplicate Blocked (Frontend): ${item.type} ${item.caseId} Part ${item.part}`);
      return false;
    }

    items.push(item);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));

    // Sync to Google Sheets (Fire and forget style to avoid CORS/Redirect issues on Vercel)
    callGAS({ action: 'SAVE_ITEM', item });
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
    const targetCaseId = normalize(caseId);
    const targetPart = normalize(part);

    return items
      .filter(i => 
        i.type === type && 
        normalize(i.caseId) === targetCaseId && 
        normalize(i.part) === targetPart
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }
};
