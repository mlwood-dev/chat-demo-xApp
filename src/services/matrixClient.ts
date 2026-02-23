import * as sdk from 'matrix-js-sdk';
import type { MatrixMessage, MatrixRoom } from '../types';

type MatrixClientType = ReturnType<typeof sdk.createClient>;

const DEFAULT_HOMESERVER = 'https://your-synapse-server.com';

let matrixClient: MatrixClientType | null = null;

export function getHomeserverUrl(): string {
  return localStorage.getItem('matrix_homeserver_url') || DEFAULT_HOMESERVER;
}

export function setHomeserverUrl(url: string): void {
  localStorage.setItem('matrix_homeserver_url', url);
}

export function getClient(): MatrixClientType | null {
  return matrixClient;
}

export async function loginWithJwt(
  jwt: string,
  homeserverUrl?: string
): Promise<{ userId: string; accessToken: string }> {
  const baseUrl = homeserverUrl || getHomeserverUrl();

  const tempClient = sdk.createClient({ baseUrl });

  const response = await (tempClient as any).login('org.matrix.login.jwt', {
    token: jwt,
  });

  if (!response.access_token || !response.user_id) {
    throw new Error('Login failed: no access token or user ID returned');
  }

  matrixClient = sdk.createClient({
    baseUrl,
    accessToken: response.access_token,
    userId: response.user_id,
  });

  localStorage.setItem('matrix_access_token', response.access_token);
  localStorage.setItem('matrix_user_id', response.user_id);
  localStorage.setItem('matrix_homeserver_url', baseUrl);

  await startClient();

  return {
    userId: response.user_id,
    accessToken: response.access_token,
  };
}

export async function restoreSession(): Promise<string | null> {
  const accessToken = localStorage.getItem('matrix_access_token');
  const userId = localStorage.getItem('matrix_user_id');
  const baseUrl = localStorage.getItem('matrix_homeserver_url');

  if (!accessToken || !userId || !baseUrl) {
    return null;
  }

  try {
    matrixClient = sdk.createClient({
      baseUrl,
      accessToken,
      userId,
    });

    const whoami = await matrixClient.whoami();
    if (!whoami.user_id) {
      throw new Error('Session invalid');
    }

    await startClient();
    return userId;
  } catch {
    clearSession();
    return null;
  }
}

async function startClient(): Promise<void> {
  if (!matrixClient) return;

  await matrixClient.startClient({
    initialSyncLimit: 20,
    lazyLoadMembers: true,
  });

  await new Promise<void>((resolve) => {
    const onSync = (state: string) => {
      if (state === 'PREPARED') {
        matrixClient?.removeListener(sdk.ClientEvent.Sync, onSync);
        resolve();
      }
    };
    matrixClient!.on(sdk.ClientEvent.Sync, onSync);
  });
}

export function getRooms(): MatrixRoom[] {
  if (!matrixClient) return [];

  const rooms = matrixClient.getRooms();
  return rooms.map((room: any) => {
    const timeline = room.getLiveTimeline().getEvents();
    const lastEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;
    const lastContent = lastEvent?.getContent();

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      topic: room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic,
      memberCount: room.getJoinedMemberCount(),
      lastMessage: lastContent?.body,
      lastMessageTimestamp: lastEvent?.getTs(),
    };
  }).sort((a: MatrixRoom, b: MatrixRoom) =>
    (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0)
  );
}

export function getTimelineMessages(roomId: string): MatrixMessage[] {
  if (!matrixClient) return [];

  const room = matrixClient.getRoom(roomId);
  if (!room) return [];

  const events = room.getLiveTimeline().getEvents();
  return events
    .filter((ev: any) => ev.getType() === 'm.room.message')
    .map((ev: any) => ({
      eventId: ev.getId() || '',
      sender: ev.getSender() || '',
      body: ev.getContent().body || '',
      timestamp: ev.getTs(),
      type: ev.getContent().msgtype || 'm.text',
    }));
}

export async function sendMessage(roomId: string, body: string): Promise<void> {
  if (!matrixClient) throw new Error('Not logged in');

  await matrixClient.sendTextMessage(roomId, body);
}

export async function joinRoom(roomIdOrAlias: string): Promise<string> {
  if (!matrixClient) throw new Error('Not logged in');

  const result = await matrixClient.joinRoom(roomIdOrAlias);
  return result.roomId;
}

export async function createRoom(name: string, topic?: string): Promise<string> {
  if (!matrixClient) throw new Error('Not logged in');

  const result = await matrixClient.createRoom({
    name,
    topic,
    visibility: sdk.Visibility.Private,
    preset: sdk.Preset.PrivateChat,
  });

  return result.room_id;
}

export async function loadMoreMessages(roomId: string): Promise<MatrixMessage[]> {
  if (!matrixClient) return [];

  const room = matrixClient.getRoom(roomId);
  if (!room) return [];

  const timeline = room.getLiveTimeline();
  await matrixClient.paginateEventTimeline(timeline, { backwards: true, limit: 30 });

  return getTimelineMessages(roomId);
}

export function onRoomTimeline(callback: () => void): () => void {
  if (!matrixClient) return () => {};

  const handler = () => callback();
  matrixClient.on(sdk.RoomEvent.Timeline, handler);
  return () => {
    matrixClient?.removeListener(sdk.RoomEvent.Timeline, handler);
  };
}

export function onSyncStateChange(callback: (state: string) => void): () => void {
  if (!matrixClient) return () => {};

  matrixClient.on(sdk.ClientEvent.Sync, callback);
  return () => {
    matrixClient?.removeListener(sdk.ClientEvent.Sync, callback);
  };
}

export function logout(): void {
  if (matrixClient) {
    matrixClient.stopClient();
    matrixClient = null;
  }
  clearSession();
}

function clearSession(): void {
  localStorage.removeItem('matrix_access_token');
  localStorage.removeItem('matrix_user_id');
}
