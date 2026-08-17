import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk';

type StorageBridge = Pick<EvenAppBridge, 'getLocalStorage' | 'setLocalStorage'>;

let bridgePromise: Promise<StorageBridge> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function waitForBridge(): Promise<StorageBridge> {
  if (bridgePromise) return bridgePromise;

  bridgePromise = waitForEvenAppBridge()
    .then((bridge) => bridge as StorageBridge)
    .catch((error) => {
      bridgePromise = null;
      throw error;
    });

  return bridgePromise;
}

async function readRawValue(key: string): Promise<string> {
  await writeChain.catch(() => undefined);
  const bridge = await waitForBridge();
  return await bridge.getLocalStorage(key);
}

async function writeRawValue(key: string, value: string): Promise<void> {
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const bridge = await waitForBridge();
      const result = await bridge.setLocalStorage(key, value);
      if (result === false) {
        throw new Error('Bridge storage rejected write');
      }
    });

  await writeChain;
}

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await readRawValue(key);
    if (raw && raw !== '') return JSON.parse(raw) as T;
  } catch {
    // Ignore bridge storage failures and fall back to the provided default.
  }
  return fallback;
}

export async function storageGetRaw(key: string): Promise<string> {
  try {
    const value = await readRawValue(key);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  try {
    await writeRawValue(key, JSON.stringify(value));
  } catch {
    // Ignore bridge storage failures; callers already handle empty fallbacks.
  }
}

export async function storageSetRaw(key: string, value: string): Promise<void> {
  try {
    await writeRawValue(key, value);
  } catch {
    // Ignore bridge storage failures; callers already handle empty fallbacks.
  }
}

export async function storageRemove(key: string): Promise<void> {
  await storageSetRaw(key, '');
}
