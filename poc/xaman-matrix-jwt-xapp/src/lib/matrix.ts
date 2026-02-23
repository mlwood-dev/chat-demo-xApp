import { createClient, type MatrixClient, type LoginResponse } from 'matrix-js-sdk';

export const LEGACY_JWT_LOGIN_TYPE = 'org.matrix.login.jwt';

export type MatrixSession = {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
};

export function normalizeHomeserverUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function loginWithJwt(
  homeserverUrl: string,
  jwt: string,
): Promise<MatrixSession> {
  const baseUrl = normalizeHomeserverUrl(homeserverUrl);

  const tempClient = createClient({
    baseUrl,
    timelineSupport: true,
  });

  const res = (await tempClient.login(LEGACY_JWT_LOGIN_TYPE, {
    token: jwt.trim(),
  })) as LoginResponse;

  return {
    homeserverUrl: baseUrl,
    accessToken: res.access_token,
    userId: res.user_id,
    deviceId: res.device_id,
  };
}

export function createAuthedClient(session: MatrixSession): MatrixClient {
  return createClient({
    baseUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    timelineSupport: true,
  });
}

