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
}

export function useOuraData(): OuraData {
  const [data, setData] = useState<OuraData>(EMPTY)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
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
  }, [])

  return data
}
