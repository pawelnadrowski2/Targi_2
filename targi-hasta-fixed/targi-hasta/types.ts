
export interface TradeOrder {
  id: string;
  clientName: string;
  orderValue: number;
  ticketNumber: string;
  createdAt: number; // timestamp
  isWinner: boolean;
  createdBy?: string; // Store which exhibitor created it (Name)
  exhibitorId?: string; // Store exhibitor ID for filtering
}

export enum AppView {
  LANDING = 'LANDING',
  LOGIN_ADMIN = 'LOGIN_ADMIN',
  LOGIN_EXHIBITOR = 'LOGIN_EXHIBITOR',
  EXHIBITOR = 'EXHIBITOR',
  ADMIN = 'ADMIN',
  LOTTERY = 'LOTTERY'
}

export interface WinnerContext {
  winner: TradeOrder;
  congratulationMessage?: string;
}

export interface ExhibitorAccount {
  id: string;
  name: string;
  accessCode: string;
}

export interface UserSession {
  role: 'ADMIN' | 'EXHIBITOR' | 'SUPERUSER';
  name: string;
  id?: string;
}

export interface CloudConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}