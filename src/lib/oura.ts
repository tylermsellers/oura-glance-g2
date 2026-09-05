// Minimal Oura Ring API v2 client.
// Docs: https://cloud.ouraring.com/v2/docs
// Auth: OAuth2 (Oura discontinued Personal Access Tokens). The access/refresh
// tokens are obtained and refreshed via the Cloudflare Worker proxy, which
// holds the confidential client_secret server-side — see oura-proxy-worker.
import { refreshOuraTokens } from './ouraAuth'
import { getPersistent, setPersistent, removePersistent } from './persistentStorage'

const STORAGE_KEY = 'oura_glance_config'
const WORKER_BASE = 'https://oura-glance-proxy.tylermsellers.workers.dev'
const API_BASE = `${WORKER_BASE}/v2/usercollection`

// Refresh a bit before actual expiry to avoid racing a request against an
// access token that expires mid-flight.
const REFRESH_SKEW_MS = 5 * 60 * 1000

export interface OuraConfig {
  accessToken: string
  refreshToken: string
  /** Unix ms timestamp when accessToken expires. */
  expiresAt: number
}

// Persisted via persistentStorage (bridge.setLocalStorage/getLocalStorage),
// not plain browser localStorage — the Even Hub host's Flutter WebView does
// not reliably keep browser localStorage across app restarts, which was
// causing the Oura connection to silently disappear whenever the app was
// closed and relaunched.
export async function loadOuraConfig(): Promise<OuraConfig | null> {
  try {
    const raw = await getPersistent(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as OuraConfig
  } catch {
    return null
  }
}

// useOuraData() only reads config once on mount and then polls on a 5-minute
// timer. That's fine for token refreshes, but it raced with the OAuth
// redirect-return flow: App.tsx's effect resolves the OAuth result and calls
// saveOuraConfig() asynchronously (after a network round trip), while
// useOuraData()'s initial poll runs synchronously on mount — before the
// config exists — so it recorded "not connected" and didn't check again for
// 5 minutes, even though the connection actually succeeded moments later.
// Dispatching this event on every save/clear lets useOuraData re-poll
// immediately whenever the config actually changes.
const CONFIG_CHANGED_EVENT = 'oura-glance:config-changed'

export function onOuraConfigChanged(cb: () => void): () => void {
  window.addEventListener(CONFIG_CHANGED_EVENT, cb)
  return () => window.removeEventListener(CONFIG_CHANGED_EVENT, cb)
}

export async function saveOuraConfig(config: OuraConfig): Promise<void> {
  await setPersistent(STORAGE_KEY, JSON.stringify(config))
  window.dispatchEvent(new Event(CONFIG_CHANGED_EVENT))
}

export async function clearOuraConfig(): Promise<void> {
  await removePersistent(STORAGE_KEY)
  window.dispatchEvent(new Event(CONFIG_CHANGED_EVENT))
}

/** Returns a valid, non-expired access token, refreshing (and persisting the
 *  refreshed config) via the Worker first if the current one is near expiry. */
export async function ensureValidAccessToken(config: OuraConfig): Promise<string> {
  if (config.expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return config.accessToken
  }

  const refreshed = await refreshOuraTokens(config.refreshToken)
  const nextConfig: OuraConfig = {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
  }
  saveOuraConfig(nextConfig).catch(() => {
    // Non-fatal: the refreshed token is still returned/used for this
    // request even if persisting it failed.
  })
  return nextConfig.accessToken
}

// Format a Date as YYYY-MM-DD using LOCAL time (not UTC) — Oura's "day" is the
// user's local calendar day, so using toISOString() (UTC) can shift by a day
// depending on the user's timezone, which was causing "yesterday's" data to
// appear as "today's".
function toLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayIso(): string {
  return toLocalIso(new Date())
}

/** Pick the record matching today's local date; fall back to the most recent
 *  record in the window if today hasn't synced yet. */
function pickForToday<T extends { day?: string }>(records: T[]): T | undefined {
  const today = todayIso()
  return records.find((r) => r.day === today) ?? records.at(-1)
}

// Oura's consent screen lets the user deselect individual data categories,
// so a login can "succeed" while the resulting token is missing scopes that
// Oura Glance needs. Those calls then fail with 403. A 403 can also mean the
// user has no active Oura Membership (Gen3+ users without one can't reach the
// API at all), which looks identical at the status-code level -- the only way
// to tell them apart is the response body, so we read and classify it.
export type OuraErrorKind = 'missing_scope' | 'membership' | 'unauthorized' | 'other'

export class OuraApiError extends Error {
  status: number
  endpoint: string
  kind: OuraErrorKind
  detail: string

  constructor(endpoint: string, status: number, kind: OuraErrorKind, detail: string) {
    super(`Oura API ${endpoint} failed: ${status}${detail ? ` - ${detail}` : ''}`)
    this.name = 'OuraApiError'
    this.endpoint = endpoint
    this.status = status
    this.kind = kind
    this.detail = detail
  }
}

// Which Oura OAuth scope each endpoint we call depends on, and the label Oura
// uses for it on the consent screen -- so we can name the exact checkbox the
// user needs to re-enable rather than saying "something went wrong".
const ENDPOINT_SCOPE_LABEL: Record<string, string> = {
  daily_readiness: 'Daily Summaries',
  daily_sleep: 'Daily Summaries',
  daily_activity: 'Daily Summaries',
  daily_resilience: 'Daily Summaries',
  daily_stress: 'Daily Summaries',
  sleep: 'Daily Summaries',
  heartrate: 'Heart Rate',
}

export function scopeLabelForEndpoint(endpoint: string): string {
  return ENDPOINT_SCOPE_LABEL[endpoint] ?? endpoint
}

async function classifyFailure(res: Response, endpoint: string): Promise<OuraApiError> {
  let detail = ''
  try {
    const body = await res.text()
    try {
      const parsed = JSON.parse(body) as { title?: string; detail?: string }
      detail = [parsed.title, parsed.detail].filter(Boolean).join(': ')
    } catch {
      detail = body.slice(0, 200)
    }
  } catch {
    detail = res.statusText
  }

  if (res.status === 401) {
    return new OuraApiError(endpoint, res.status, 'unauthorized', detail)
  }
  if (res.status === 403) {
    // Oura returns {"title":"Missing Scopes", ...} when the token lacks a
    // scope. Anything else at 403 is most likely the membership restriction.
    const kind: OuraErrorKind = /scope/i.test(detail) ? 'missing_scope' : 'membership'
    return new OuraApiError(endpoint, res.status, kind, detail)
  }
  return new OuraApiError(endpoint, res.status, 'other', detail)
}

async function fetchCollection(accessToken: string, path: string, startDate: string, endDate: string) {
  const url = `${API_BASE}/${path}?start_date=${startDate}&end_date=${endDate}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw await classifyFailure(res, path)
  }
  return res.json() as Promise<{ data: any[] }>
}

// heartrate is a timeseries endpoint (not a daily collection) -- it takes
// start_datetime/end_datetime (not start_date/end_date) and supports
// latest=true so we can just get the most recent reading directly instead of
// pulling and sorting the whole window ourselves.
async function fetchLatestHeartRate(accessToken: string): Promise<number | null> {
  const end = new Date()
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  const url =
    `${API_BASE}/heartrate?start_datetime=${start.toISOString()}` +
    `&end_datetime=${end.toISOString()}&latest=true`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    // Classified so a missing 'heartrate' scope can be reported to the user
    // instead of silently rendering "--" forever. The caller decides what is
    // fatal; heart rate on its own never is.
    throw await classifyFailure(res, 'heartrate')
  }
  const body = (await res.json()) as { data: Array<{ bpm?: number }> }
  return body.data.at(-1)?.bpm ?? null
}

export interface ReadinessDetail {
  hrvBalanceScore: number | null
  restingHeartRate: number | null // bpm, raw
  bodyTemperatureDeviation: number | null // °C deviation from baseline, raw
  averageHrv: number | null // ms, raw
  recoveryIndexScore: number | null
  sleepBalanceScore: number | null
  activityBalanceScore: number | null
  previousDayActivityScore: number | null
  previousNightScore: number | null
}

export interface SleepDetail {
  totalSleepMinutes: number | null // raw
  efficiencyPercent: number | null // raw
  latencyMinutes: number | null // raw
  remSleepMinutes: number | null // raw
  deepSleepMinutes: number | null // raw
  lightSleepMinutes: number | null // raw
  awakeMinutes: number | null // raw
  timingScore: number | null
  restlessPeriods: number | null // raw
}

export interface ActivityDetail {
  highActivityMinutes: number | null // raw
  mediumActivityMinutes: number | null // raw
  lowActivityMinutes: number | null // raw
  sedentaryMinutes: number | null // raw
  restingMinutes: number | null // raw
  equivalentWalkingDistanceMeters: number | null // raw
  metersToTarget: number | null // raw
  targetCalories: number | null // raw, daily activity calorie goal
  targetMeters: number | null // raw, daily activity distance goal
  meetDailyTargetsScore: number | null
  moveEveryHourScore: number | null
  recoveryTimeScore: number | null
  stayActiveScore: number | null
  trainingFrequencyScore: number | null
  trainingVolumeScore: number | null
}

export interface OuraFetchResult {
  readinessScore: number | null
  sleepScore: number | null
  activityScore: number | null
  resilienceLevel: string | null
  activeCalories: number | null
  totalCalories: number | null
  steps: number | null
  stressSummary: string | null // 'restored' | 'normal' | 'stressful' from Oura, or null
  latestHeartRate: number | null // bpm, most recent reading
  readinessDetail: ReadinessDetail | null
  sleepDetail: SleepDetail | null
  activityDetail: ActivityDetail | null
  /** Consent-screen labels for permissions the user did not grant. Empty when
   *  everything Oura Glance needs was approved. */
  missingPermissions: string[]
}

function secondsToMinutes(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  return Math.round(v / 60)
}

export async function fetchOuraData(config: OuraConfig): Promise<OuraFetchResult> {
  const accessToken = await ensureValidAccessToken(config)
  // Use a small window so we reliably get "today" even if it hasn't
  // finished processing yet (falls back to most recent available day).
  // Oura's end_date appears to be treated as exclusive/cutoff for "today", so
  // request one day past today to make sure today's (partial) record is
  // actually included in the response.
  const end = toLocalIso(new Date(Date.now() + 24 * 60 * 60 * 1000))
  const start = toLocalIso(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))

  const settled = await Promise.allSettled([
    fetchCollection(accessToken, 'daily_readiness', start, end),
    fetchCollection(accessToken, 'daily_sleep', start, end),
    fetchCollection(accessToken, 'daily_activity', start, end),
    fetchCollection(accessToken, 'daily_resilience', start, end),
    fetchCollection(accessToken, 'sleep', start, end),
    fetchCollection(accessToken, 'daily_stress', start, end),
    fetchLatestHeartRate(accessToken),
  ])

  // A denied permission previously rejected the whole Promise.all, which
  // blanked every metric even when most of them were granted. Collect the
  // failures instead so partial data still renders, and so we can name every
  // missing permission at once rather than only the first one that failed.
  const missingPermissions: string[] = []
  let fatal: OuraApiError | Error | null = null

  for (const outcome of settled) {
    if (outcome.status !== 'rejected') continue
    const err = outcome.reason
    if (err instanceof OuraApiError && err.kind === 'missing_scope') {
      const label = scopeLabelForEndpoint(err.endpoint)
      if (!missingPermissions.includes(label)) missingPermissions.push(label)
      continue
    }
    // Anything that isn't a permission problem (expired token, membership
    // restriction, network/proxy failure) is a real error worth surfacing.
    // Heart rate is the exception: it was always best-effort, so a failure
    // there alone should not take down the rest of the dashboard.
    if (err instanceof OuraApiError && err.endpoint === 'heartrate') continue
    if (!fatal) fatal = err instanceof Error ? err : new Error(String(err))
  }

  if (fatal) throw fatal

  const emptyCollection = { data: [] as any[] }
  const valueAt = (i: number) =>
    settled[i].status === 'fulfilled' ? (settled[i] as PromiseFulfilledResult<{ data: any[] }>).value : emptyCollection

  const readiness = valueAt(0)
  const sleep = valueAt(1)
  const activity = valueAt(2)
  const resilience = valueAt(3)
  const sleepPeriods = valueAt(4)
  const stress = valueAt(5)
  const latestHeartRate =
    settled[6].status === 'fulfilled' ? (settled[6] as PromiseFulfilledResult<number | null>).value : null

  const latestReadiness = pickForToday(readiness.data)
  const latestSleep = pickForToday(sleep.data)
  const latestActivity = pickForToday(activity.data)
  const latestResilience = pickForToday(resilience.data)
  const latestStress = pickForToday(stress.data)
  // Prefer the longest/main sleep period matching the same day as latestSleep
  // (the actual night's sleep, not a nap logged on a different day).
  const sleepCandidates = sleepPeriods.data.filter((p) => p.type === 'long_sleep' || p.type === 'sleep')
  const latestSleepPeriod = latestSleep
    ? sleepCandidates.filter((p) => p.day === latestSleep.day).at(-1) ?? sleepCandidates.at(-1)
    : sleepCandidates.at(-1)

  const rc = latestReadiness?.contributors
  const sc = latestSleep?.contributors
  const ac = latestActivity?.contributors

  return {
    missingPermissions,
    readinessScore: latestReadiness?.score ?? null,
    sleepScore: latestSleep?.score ?? null,
    activityScore: latestActivity?.score ?? null,
    resilienceLevel: latestResilience?.level ?? null,
    activeCalories: latestActivity?.active_calories ?? null,
    totalCalories: latestActivity?.total_calories ?? null,
    steps: latestActivity?.steps ?? null,
    stressSummary: latestStress?.day_summary ?? null,
    latestHeartRate,
    readinessDetail: rc
      ? {
          hrvBalanceScore: rc.hrv_balance ?? null,
          restingHeartRate: latestSleepPeriod?.lowest_heart_rate ?? null,
          bodyTemperatureDeviation: latestReadiness?.temperature_deviation ?? null,
          averageHrv: latestSleepPeriod?.average_hrv ?? null,
          recoveryIndexScore: rc.recovery_index ?? null,
          sleepBalanceScore: rc.sleep_balance ?? null,
          activityBalanceScore: rc.activity_balance ?? null,
          previousDayActivityScore: rc.previous_day_activity ?? null,
          previousNightScore: rc.previous_night ?? null,
        }
      : null,
    sleepDetail: sc
      ? {
          totalSleepMinutes: secondsToMinutes(latestSleepPeriod?.total_sleep_duration),
          efficiencyPercent: latestSleepPeriod?.efficiency ?? null,
          latencyMinutes: secondsToMinutes(latestSleepPeriod?.latency),
          remSleepMinutes: secondsToMinutes(latestSleepPeriod?.rem_sleep_duration),
          deepSleepMinutes: secondsToMinutes(latestSleepPeriod?.deep_sleep_duration),
          lightSleepMinutes: secondsToMinutes(latestSleepPeriod?.light_sleep_duration),
          awakeMinutes: secondsToMinutes(latestSleepPeriod?.awake_time),
          timingScore: sc.timing ?? null,
          restlessPeriods: latestSleepPeriod?.restless_periods ?? null,
        }
      : null,
    activityDetail: ac
      ? {
          highActivityMinutes: secondsToMinutes(latestActivity?.high_activity_time),
          mediumActivityMinutes: secondsToMinutes(latestActivity?.medium_activity_time),
          lowActivityMinutes: secondsToMinutes(latestActivity?.low_activity_time),
          sedentaryMinutes: secondsToMinutes(latestActivity?.sedentary_time),
          restingMinutes: secondsToMinutes(latestActivity?.resting_time),
          equivalentWalkingDistanceMeters: latestActivity?.equivalent_walking_distance ?? null,
          metersToTarget: latestActivity?.meters_to_target ?? null,
          targetCalories: latestActivity?.target_calories ?? null,
          targetMeters: latestActivity?.target_meters ?? null,
          meetDailyTargetsScore: ac.meet_daily_targets ?? null,
          moveEveryHourScore: ac.move_every_hour ?? null,
          recoveryTimeScore: ac.recovery_time ?? null,
          stayActiveScore: ac.stay_active ?? null,
          trainingFrequencyScore: ac.training_frequency ?? null,
          trainingVolumeScore: ac.training_volume ?? null,
        }
      : null,
  }
}

/** Builds the message shown when the user deselected data categories on
 *  Oura's consent screen. Oura Glance needs all of them, so this names the
 *  exact permissions to re-enable when reconnecting. */
export function missingPermissionsMessage(missing: string[]): string {
  if (missing.length === 0) return ''
  return (
    `Oura Glance needs all permissions, but ${missing.join(' and ')} ` +
    `${missing.length === 1 ? 'was' : 'were'} not granted. ` +
    `Tap Reconnect and leave every box checked on Oura's approval screen.`
  )
}

export async function testOuraConnection(config: OuraConfig): Promise<{ ok: boolean; message: string }> {
  try {
    const result = await fetchOuraData(config)
    if (result.missingPermissions.length > 0) {
      return { ok: false, message: missingPermissionsMessage(result.missingPermissions) }
    }
    return { ok: true, message: 'Connected to Oura API successfully.' }
  } catch (err) {
    if (err instanceof OuraApiError && err.kind === 'membership') {
      return {
        ok: false,
        message: 'Oura returned "access denied". This usually means the account has no active Oura Membership.',
      }
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error connecting to Oura API.' }
  }
}
