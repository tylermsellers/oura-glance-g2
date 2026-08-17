import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router'
import type { AppSnapshot, AppActions } from './shared'
import { homeScreen } from './screens/home'
import { readinessDetailScreen } from './screens/readiness-detail'
import { sleepDetailScreen } from './screens/sleep-detail'
import { activityDetailScreen } from './screens/activity-detail'

export type { AppSnapshot, AppActions }

export const { toDisplayData, onGlassAction } = createGlassScreenRouter<AppSnapshot, AppActions>({
  'home': homeScreen,
  'readiness-detail': readinessDetailScreen,
  'sleep-detail': sleepDetailScreen,
  'activity-detail': activityDetailScreen,
}, 'home')
