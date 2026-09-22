import { useEffect, useRef, useState } from 'react'
import { fetchOuraData, loadOuraConfig, onOuraConfigChanged } from './oura'
import type { OuraData } from '../glass/shared'

const POLL_INTERVAL_MS = 5 * 60 * 1000 // Oura data updates a few times/day; 5 min is plenty

const EMPTY: OuraData = {
  readinessScore: null,
  sleepScore: null,
  activityScore: null,
  resilienceLevel: null,
  activeCalories: null,
  totalCalories: null,
  steps: null,
  stressSummary: null,
  latestHeartRate: null,
  readinessDetail: null,
  sleepDetail: null,
  activityDetail: null,
  connected: false,
  error: null,
  missingPermissions: [],
}

const DEMO: OuraData = {
  readinessScore: 88,
  sleepScore: 84,
  activityScore: 91,
  resilienceLevel: 'solid',
  activeCalories: 436,
  totalCalories: 2140,
  steps: 8742,
  stressSummary: 'restored',
  latestHeartRate: 62,
  readinessDetail: {
    hrvBalanceScore: 86,
    restingHeartRate: 51,
    bodyTemperatureDeviation: -0.1,
    averageHrv: 48,
    recoveryIndexScore: 90,
    sleepBalanceScore: 84,
    activityBalanceScore: 88,
    previousDayActivityScore: 91,
    previousNightScore: 87,
  },
  sleepDetail: {
    totalSleepMinutes: 448,
    efficiencyPercent: 91,
    latencyMinutes: 12,
    remSleepMinutes: 104,
    deepSleepMinutes: 92,
    lightSleepMinutes: 252,
    awakeMinutes: 36,
    totalSleepScore: 88,
    efficiencyScore: 91,
    restfulnessScore: 78,
    remSleepScore: 84,
    deepSleepScore: 89,
    latencyScore: 86,
    timingScore: 83,
    restlessPeriods: 21,
  },
  activityDetail: {
    highActivityMinutes: 18,
    mediumActivityMinutes: 42,
    lowActivityMinutes: 96,
    sedentaryMinutes: 438,
    restingMinutes: 602,
    equivalentWalkingDistanceMeters: 7240,
    metersToTarget: 1760,
    targetCalories: 600,
    targetMeters: 9000,
    meetDailyTargetsScore: 89,
    moveEveryHourScore: 92,
    recoveryTimeScore: 88,
    stayActiveScore: 90,
    trainingFrequencyScore: 85,
    trainingVolumeScore: 87,
  },
  connected: true,
  error: null,
  missingPermissions: [],
}

export function useOuraData(): OuraData {
  const demoMode =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1'
  const [data, setData] = useState<OuraData>(demoMode ? DEMO : EMPTY)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (demoMode) return

    let cancelled = false

    async function poll() {
      const config = await loadOuraConfig()
      if (!config?.accessToken) {
        if (!cancelled) setData({ ...EMPTY, connected: false, error: null })
        return
      }
      try {
        const result = await fetchOuraData(config)
        if (!cancelled) {
          setData({ ...result, connected: true, error: null })
        }
      } catch (err) {
        if (!cancelled) {
          setData((prev) => ({
            ...prev,
            connected: false,
            error: err instanceof Error ? err.message : 'Failed to fetch Oura data',
          }))
        }
      }
    }

    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS)
    // Re-poll immediately whenever the saved config changes (connect,
    // disconnect, or the OAuth redirect-return flow finishing asynchronously
    // after this hook already mounted) instead of waiting up to 5 minutes.
    const unsubscribe = onOuraConfigChanged(poll)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
      unsubscribe()
    }
  }, [demoMode])

  return data
}
