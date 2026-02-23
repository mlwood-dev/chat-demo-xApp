export interface MatrixMessage {
  eventId: string;
  sender: string;
  body: string;
  timestamp: number;
  type: string;
}

export interface MatrixRoom {
  roomId: string;
  name: string;
  topic?: string;
  memberCount: number;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  avatarUrl?: string;
}

export interface LoginCredentials {
  jwt: string;
  homeserverUrl: string;
}

export interface XamanUserInfo {
  address?: string;
  networkType?: string;
  isXaman: boolean;
}

export type AppView = 'login' | 'rooms' | 'room';

export interface AppState {
  view: AppView;
  isLoggedIn: boolean;
  userId: string | null;
  selectedRoomId: string | null;
  rooms: MatrixRoom[];
  xamanInfo: XamanUserInfo;
  error: string | null;
  loading: boolean;
}
