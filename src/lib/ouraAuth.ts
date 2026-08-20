// OAuth2 client helpers for the Oura Ring API.
//
// Oura discontinued Personal Access Tokens, so the app now authenticates
// via a standard Authorization Code flow. The Cloudflare Worker
// (oura-proxy-worker) is the confidential client — it holds Oura's
// client_secret and does the code<->token and refresh-token exchanges
// server-to-server. This module only ever talks to the Worker, never
// directly to Oura's OAuth endpoints, and never sees the client_secret.
//
// Flow:
//  1. GET /oauth/start   -> { state, authorizeUrl }
//  2. Open authorizeUrl in a browser (the app has no in-webview way to
//     reach cloud.ouraring.com directly — it's outside the network
//     permission whitelist by design). We try window.open first and fall
//     back to letting the user copy the link, since we can't guarantee how
//     the host WebView handles external-domain navigation.
//  3. Poll GET /oauth/poll?state=... until status is no longer 'pending'.
//  4. POST /oauth/refresh with a refresh_token to mint a new access token
//     once the current one is close to expiring.

const WORKER_BASE = 'https://oura-glance-proxy.tylermsellers.workers.dev'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 3 * 60 * 1000 // give the user 3 minutes to complete consent

export interface OuraTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

type PollResult =
  | { status: 'pending' }
  | { status: 'complete'; accessToken: string; refreshToken: string; expiresIn: number }
  | { status: 'denied'; error?: string }
  | { status: 'error'; message?: string }
  | { status: 'expired' }

export interface OAuthHandle {
  authorizeUrl: string
  /** Resolves once the user completes (or abandons) the consent flow. */
  result: Promise<OuraTokens>
}

/** Starts the OAuth flow: gets an authorize URL from the Worker, opens it,
 *  and begins polling. Returns a handle so the UI can show the link (in case
 *  the popup was blocked) while awaiting the result. */
export async function beginOuraOAuth(): Promise<OAuthHandle> {
  const startRes = await fetch(`${WORKER_BASE}/oauth/start`)
  if (!startRes.ok) {
    throw new Error(`Failed to start Oura authorization: ${startRes.status} ${startRes.statusText}`)
  }
  const { state, authorizeUrl } = (await startRes.json()) as { state: string; authorizeUrl: string }

  // Best-effort: try to open a browser tab for the user. If the host WebView
  // blocks this or doesn't route external domains out to a real browser,
  // the caller should still surface `authorizeUrl` as a tappable/copyable link.
  try {
    window.open(authorizeUrl, '_blank', 'noopener,noreferrer')
  } catch {
    // Ignore — UI falls back to showing the link.
  }

  return { authorizeUrl, result: pollForTokens(state) }
}

/** Convenience wrapper for callers that don't need the authorizeUrl before
 *  awaiting completion (e.g. non-interactive contexts). */
export async function startOuraOAuth(): Promise<OuraTokens> {
  const handle = await beginOuraOAuth()
  return handle.result
}

async function pollForTokens(state: string): Promise<OuraTokens> {
  const deadline = Date.now() + POLL_TIMEOUT_MS

  while (Date.now() < deadline) {
    const res = await fetch(`${WORKER_BASE}/oauth/poll?state=${encodeURIComponent(state)}`)
    if (res.ok) {
      const result = (await res.json()) as PollResult
      if (result.status === 'complete') {
        return {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        }
      }
      if (result.status === 'denied') {
        throw new Error('Oura authorization was cancelled.')
      }
      if (result.status === 'error') {
        throw new Error(result.message ?? 'Oura authorization failed.')
      }
      if (result.status === 'expired') {
        throw new Error('Oura authorization link expired. Please try connecting again.')
      }
      // 'pending' — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error('Timed out waiting for Oura authorization. Please try connecting again.')
}

export async function refreshOuraTokens(refreshToken: string): Promise<OuraTokens> {
  const res = await fetch(`${WORKER_BASE}/oauth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    throw new Error(`Failed to refresh Oura token: ${res.status} ${res.statusText}`)
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string; expiresIn: number }
  return data
}
