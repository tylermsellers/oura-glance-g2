// Minimal Oura Ring API v2 client.
// Docs: https://cloud.ouraring.com/v2/docs
// Auth: OAuth2 (Oura discontinued Personal Access Tokens). The access/refresh
// tokens are obtained and refreshed via the Cloudflare Worker proxy, which
// holds the confidential client_secret server-side — see oura-proxy-worker.
import { startOuraOAuth, refreshOuraTokens } from './ouraAuth'

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

/** Kick off the OAuth2 authorization flow. Resolves with a saved config once
 *  the user has completed consent in their browser, or rejects/times out. */
export async function connectOura(): Promise<OuraConfig> {
  const tokens = await startOuraOAuth()
  const config: OuraConfig = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  }
  saveOuraConfig(config)
  return config
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
  saveOuraConfig(nextConfig)
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

async function fetchCollection(accessToken: string, path: string, startDate: string, endDate: string) {
  const url = `${API_BASE}/${path}?start_date=${startDate}&end_date=${endDate}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`Oura API ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<{ data: any[] }>
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
  readinessDetail: ReadinessDetail | null
  sleepDetail: SleepDetail | null
  activityDetail: ActivityDetail | null
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

  const [readiness, sleep, activity, resilience, sleepPeriods] = await Promise.all([
    fetchCollection(accessToken, 'daily_readiness', start, end),
    fetchCollection(accessToken, 'daily_sleep', start, end),
    fetchCollection(accessToken, 'daily_activity', start, end),
    fetchCollection(accessToken, 'daily_resilience', start, end),
    fetchCollection(accessToken, 'sleep', start, end),
  ])

  const latestReadiness = pickForToday(readiness.data)
  const latestSleep = pickForToday(sleep.data)
  const latestActivity = pickForToday(activity.data)
  const latestResilience = pickForToday(resilience.data)
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
    readinessScore: latestReadiness?.score ?? null,
    sleepScore: latestSleep?.score ?? null,
    activityScore: latestActivity?.score ?? null,
    resilienceLevel: latestResilience?.level ?? null,
    activeCalories: latestActivity?.active_calories ?? null,
    totalCalories: latestActivity?.total_calories ?? null,
    steps: latestActivity?.steps ?? null,
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

export async function testOuraConnection(config: OuraConfig): Promise<{ ok: boolean; message: string }> {
  try {
    await fetchOuraData(config)
    return { ok: true, message: 'Connected to Oura API successfully.' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error connecting to Oura API.' }
  }
}
