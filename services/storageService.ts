
import { PathoItem, LoginLog, EntityType } from '../types';

// IMPORTANT: Replace this URL with your actual deployed Google Apps Script URL
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxHQXH0PNBSXZXYQrqrYE0HbVz56ga_i6_LfsEoZl2IGl1aYIWoiWmJ_JQV2MIxLzTp/exec';

const ITEMS_KEY = 'patho_track_items';
const LOGS_KEY = 'patho_track_login_logs';

const normalize = (str: string) => (str || "").toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

export const storageService = {
  async syncFromCloud(): Promise<void> {
    try {
      if (!GAS_WEBAPP_URL || GAS_WEBAPP_URL.includes('REPLACE')) {
        console.warn("GAS_WEBAPP_URL is not configured.");
        return;
      }
      
      // Standard fetch for GET usually works if GAS is deployed to 'Anyone'
      // Browser handles the 302 redirect automatically
      const response = await fetch(GAS_WEBAPP_URL, {
        method: 'GET',
        cache: 'no-store'
      });
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const cloudData = await response.json();
      if (Array.isArray(cloudData)) {
        localStorage.setItem(ITEMS_KEY, JSON.stringify(cloudData));
        console.log('Sync complete:', cloudData.length, 'items loaded.');
      }
    } catch (error) {
      console.error('Failed to sync with Google Sheets:', error);
      // If cloud sync fails, we still have the local data from the last session
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

    // Send to cloud (no-cors is used for fire-and-forget POST to avoid CORS Preflight blocks)
    try {
      fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOG_LOGIN', ...newLog })
      });
    } catch (err) {
      console.error('Cloud log failed', err);
    }
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

    // Sync to GAS in background
    fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SAVE_ITEM', item })
    });

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_STATUS', id, updates, handledBy })
    });
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
