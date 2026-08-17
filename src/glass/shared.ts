export interface OuraData {
  readinessScore: number | null
  activityScore: number | null
  resilienceLevel: string | null
  activeCalories: number | null
  totalCalories: number | null
  steps: number | null
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
