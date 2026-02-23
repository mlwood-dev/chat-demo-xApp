import type { XamanUserInfo } from '../types';

let xummInstance: any = null;

export async function initXaman(): Promise<XamanUserInfo> {
  try {
    const { Xumm } = await import('xumm');
    xummInstance = new Xumm('xapp-matrix-client');

    await xummInstance.environment?.ready;

    const account = xummInstance.user?.account;
    const networkType = xummInstance.user?.networkType;

    return {
      address: account || undefined,
      networkType: networkType || undefined,
      isXaman: true,
    };
  } catch (err) {
    console.warn('Not running inside Xaman environment:', err);
    return {
      isXaman: false,
    };
  }
}

export function getXummInstance(): any {
  return xummInstance;
}

export function isXamanEnvironment(): boolean {
  try {
    return typeof window !== 'undefined' && (
      window.location.href.includes('xapp') ||
      !!(window as any).ReactNativeWebView ||
      !!(window as any).xAppNavigate
    );
  } catch {
    return false;
  }
}
