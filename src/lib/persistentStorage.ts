// Durable key-value storage for data that must survive the user closing and
// reopening the app (OAuth tokens, unit preference, etc).
//
// The Even Hub host runs the app inside a Flutter WebView, where browser
// `localStorage`/IndexedDB do NOT reliably survive app restarts — this was
// the cause of the Oura connection "forgetting" itself after the app was
// closed and relaunched. `bridge.setLocalStorage`/`getLocalStorage` is
// backed by the native companion app and is the only reliable persistence
// mechanism in this environment.
//
// We still mirror to `localStorage` as a synchronous fallback so the app
// keeps working in a plain browser tab (e.g. `npm run dev` without the
// simulator/host), where `waitForEvenAppBridge()` never resolves.
import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

const BRIDGE_TIMEOUT_MS = 2000

let bridgePromise: Promise<EvenAppBridge | null> | null = null

function getBridge(): Promise<EvenAppBridge | null> {
  if (!bridgePromise) {
    bridgePromise = Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), BRIDGE_TIMEOUT_MS)),
    ]).catch(() => null)
  }
  return bridgePromise
}

export async function getPersistent(key: string): Promise<string | null> {
  const bridge = await getBridge()
  if (bridge) {
    try {
      const value = await bridge.getLocalStorage(key)
      if (value) return value
    } catch {
      // Fall through to the localStorage mirror.
    }
  }
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export async function setPersistent(key: string, value: string): Promise<void> {
  const bridge = await getBridge()
  if (bridge) {
    try {
      await bridge.setLocalStorage(key, value)
    } catch {
      // Ignore — still write the localStorage mirror below.
    }
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Ignore — e.g. storage disabled/full.
  }
}

export async function removePersistent(key: string): Promise<void> {
  // bridge.setLocalStorage has no delete operation; storing '' emulates one
  // since getLocalStorage already returns '' for a key that was never set.
  await setPersistent(key, '')
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore.
  }
}
