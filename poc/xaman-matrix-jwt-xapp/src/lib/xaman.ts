import { xApp, type destinationEventData, type xAppEnvironment } from 'xumm-xapp-sdk';

export type XamanContext = {
  isXaman: boolean;
  environment: xAppEnvironment;
};

export function createXamanSdk(): xApp {
  return new xApp();
}

export function getXamanContext(sdk: xApp): XamanContext {
  const environment = sdk.getEnvironment();
  const isXaman = Boolean(environment?.ott && environment?.version);
  return { isXaman, environment };
}

export async function pickXrplAddress(sdk: xApp): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const onDestination = (data: destinationEventData) => {
      sdk.off('destination', onDestination);

      if (data.reason === 'SELECTED' && data.destination?.address) {
        resolve(data.destination.address);
        return;
      }

      reject(new Error('XRPL address selection cancelled.'));
    };

    sdk.on('destination', onDestination);
    Promise.resolve(sdk.selectDestination())
      .then((res: boolean | Error | void) => {
        if (res instanceof Error) {
          sdk.off('destination', onDestination);
          reject(res);
        }
      })
      .catch((e: unknown) => {
        sdk.off('destination', onDestination);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
}

