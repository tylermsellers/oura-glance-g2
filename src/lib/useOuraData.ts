import { useEffect, useRef, useState } from 'react'
import { fetchOuraData, loadOuraConfig } from './oura'
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
      const config = loadOuraConfig()
      if (!config?.token) {
        if (!cancelled) setData({ ...EMPTY, connected: false, error: null })
        return
      }
      try {
        const result = await fetchOuraData(config.token)
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

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return data
}
