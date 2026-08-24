// OAuth2 client helpers for the Oura Ring API.
//
// Oura discontinued Personal Access Tokens, so the app now authenticates
// via a standard Authorization Code flow. The Cloudflare Worker
// (oura-proxy-worker) is the confidential client — it holds Oura's
// client_secret and does the code<->token and refresh-token exchanges
// server-to-server. This module only ever talks to the Worker, never
// directly to Oura's OAuth endpoints, and never sees the client_secret.
//
// Flow (redirect-based — see note below on why):
//  1. GET /oauth/start?returnUrl=<app URL> -> { state, authorizeUrl }
//  2. Navigate the current window to authorizeUrl (cloud.ouraring.com is in
//     the app's network whitelist, so this loads in the same WebView).
//  3. Oura redirects to the Worker's /oauth/callback, which does the
//     code<->token exchange and then 302-redirects back to `returnUrl` with
//     `?oura_state=...` appended.
//  4. On load, the app calls completePendingOuraOAuth(), which reads
//     oura_state and does a single GET /oauth/poll?state=... — by this point
//     the record is already terminal (complete/denied/error), so this
//     resolves immediately rather than actually polling.
//  5. POST /oauth/refresh with a refresh_token to mint a new access token
//     once the current one is close to expiring.
//
// Why redirect instead of "open a tab and poll in the background": the Even
// Hub host's WebView (Flutter webview_flutter) has no separate popup/tab
// concept — window.open() just navigates the same WebView in place. That
// means a background poll running in the app's own JS context never gets a
// chance to run (the context is torn down the moment we navigate away), and
// there's no separate "browser" for the user to close/return from — it's
// the app itself. Redirecting back to the app's own URL is what actually
// works in this environment.

const WORKER_BASE = 'https://oura-glance-proxy.tylermsellers.workers.dev'
const PENDING_STATE_KEY = 'oura_oauth_pending_state'

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
}

/** Starts the OAuth flow: gets an authorize URL from the Worker (telling it
 *  where to redirect back to once consent finishes) and navigates the
 *  current window there. This call does not return under normal
 *  circumstances — the page unloads as part of navigation. */
export async function beginOuraOAuth(): Promise<OAuthHandle> {
  const returnUrl = window.location.href.split('#')[0]
  const startRes = await fetch(`${WORKER_BASE}/oauth/start?returnUrl=${encodeURIComponent(returnUrl)}`)
  if (!startRes.ok) {
    throw new Error(`Failed to start Oura authorization: ${startRes.status} ${startRes.statusText}`)
  }
  const { state, authorizeUrl } = (await startRes.json()) as { state: string; authorizeUrl: string }

  // Stashed as a fallback in case the WebView doesn't preserve query params
  // through the round trip; `oura_state` on the return URL takes priority.
  window.localStorage.setItem(PENDING_STATE_KEY, state)
  window.location.assign(authorizeUrl)

  return { authorizeUrl }
}

/** Checks whether the app was just loaded as the return leg of an OAuth
 *  redirect (see module docs above). If so, resolves the (already-terminal)
 *  result via a single poll and clears the pending marker/URL param either
 *  way. Returns null if there's no pending OAuth to resume. */
export async function completePendingOuraOAuth(): Promise<OuraTokens | null> {
  const state = getPendingOAuthState()
  if (!state) return null
  try {
    return await pollForTokens(state)
  } finally {
    clearPendingOAuthState()
  }
}

function getPendingOAuthState(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('oura_state') ?? window.localStorage.getItem(PENDING_STATE_KEY)
}

function clearPendingOAuthState() {
  window.localStorage.removeItem(PENDING_STATE_KEY)
  const url = new URL(window.location.href)
  if (url.searchParams.has('oura_state')) {
    url.searchParams.delete('oura_state')
    window.history.replaceState({}, '', url.toString())
  }
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
