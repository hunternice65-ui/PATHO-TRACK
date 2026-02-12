
export type EntityType = 'BLOCK' | 'SLIDE';

export type Status = 'IN_STOCK' | 'BORROWED' | 'RETURNED';

export interface PathoItem {
  id: string;
  type: EntityType;
  caseId: string;
  date: string;
  part: string;
  additionalInfo: string;
  status: Status;
  borrower?: string;
  borrowQuantity?: number;
  borrowReason?: string;
  recordedBy: string; // The user who imported/last updated
  createdAt: string;
  updatedAt: string;
}

export interface LoginLog {
  username: string;
  timestamp: string;
  ip: string;
}

export interface ScannedItem {
  caseId: string;
  date: string;
  part: string;
  additionalInfo: string;
}

export type AppView = 'LOGIN' | 'DASHBOARD' | 'BLOCK_MODULE' | 'SLIDE_MODULE' | 'REPORTS';
