// Minimal Oura Ring API v2 client.
// Docs: https://cloud.ouraring.com/v2/docs
// Auth: Personal Access Token (Bearer) generated at https://cloud.ouraring.com/personal-access-tokens

const STORAGE_KEY = 'oura_glance_config'
const API_BASE = 'https://api.ouraring.com/v2/usercollection'

export interface OuraConfig {
  token: string
}

export function loadOuraConfig(): OuraConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OuraConfig
  } catch {
    return null
  }
}

export function saveOuraConfig(config: OuraConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearOuraConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function fetchCollection(token: string, path: string, startDate: string, endDate: string) {
  const url = `${API_BASE}/${path}?start_date=${startDate}&end_date=${endDate}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Oura API ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<{ data: any[] }>
}

export interface OuraFetchResult {
  readinessScore: number | null
  activityScore: number | null
  resilienceLevel: string | null
  activeCalories: number | null
  totalCalories: number | null
  steps: number | null
}

export async function fetchOuraData(token: string): Promise<OuraFetchResult> {
  // Use a small window so we reliably get "today" even if it hasn't
  // finished processing yet (falls back to most recent available day).
  const end = todayIso()
  const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [readiness, activity, resilience] = await Promise.all([
    fetchCollection(token, 'daily_readiness', start, end),
    fetchCollection(token, 'daily_activity', start, end),
    fetchCollection(token, 'daily_resilience', start, end),
  ])

  const latestReadiness = readiness.data.at(-1)
  const latestActivity = activity.data.at(-1)
  const latestResilience = resilience.data.at(-1)

  return {
    readinessScore: latestReadiness?.score ?? null,
    activityScore: latestActivity?.score ?? null,
    resilienceLevel: latestResilience?.level ?? null,
    activeCalories: latestActivity?.active_calories ?? null,
    totalCalories: latestActivity?.total_calories ?? null,
    steps: latestActivity?.steps ?? null,
  }
}

export async function testOuraConnection(token: string): Promise<{ ok: boolean; message: string }> {
  try {
    await fetchOuraData(token)
    return { ok: true, message: 'Connected to Oura API successfully.' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error connecting to Oura API.' }
  }
}
