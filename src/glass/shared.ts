import type { ReadinessDetail, SleepDetail, ActivityDetail } from '../lib/oura'

export type { ReadinessDetail, SleepDetail, ActivityDetail }

export interface OuraData {
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
  connected: boolean
  error: string | null
}

export interface AppSnapshot {
  oura: OuraData
  flashPhase: boolean
}

export interface AppActions {
  navigate: (path: string) => void
}
