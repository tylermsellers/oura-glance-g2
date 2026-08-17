import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'
import { formatHoursMinutes } from '../../lib/units'

function scoreLabel(score: number | null): string {
  if (score === null) return '--'
  return `${score}`
}

// The three metric rows are selectable and drill into their own detail screen.
// Order matches the phone app + user preference: Activity, Sleep, Readiness.
const METRIC_SCREENS = ['activity-detail', 'sleep-detail', 'readiness-detail'] as const
const METRIC_COUNT = METRIC_SCREENS.length

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const { oura } = snapshot

    if (!oura.connected && !oura.error) {
      return {
        lines: [
          ...glassHeader('OURA'),
          line(''),
          line('Not configured'),
          line('Open app on phone to'),
          line('add your Oura token'),
        ],
      }
    }

    if (oura.error) {
      return {
        lines: [
          ...glassHeader('OURA', '! ERROR'),
          line(''),
          line('Connection error:'),
          line(oura.error.slice(0, 40)),
        ],
      }
    }

    const highlighted = ((nav.highlightedIndex % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
    const totalActiveMinutes =
      (oura.activityDetail?.highActivityMinutes ?? 0) +
      (oura.activityDetail?.mediumActivityMinutes ?? 0) +
      (oura.activityDetail?.lowActivityMinutes ?? 0)

    return {
      lines: [
        ...glassHeader('OURA', 'Tap: Details'),
        line(`Activity    ${scoreLabel(oura.activityScore)}`, 'normal', highlighted === 0),
        line(`Sleep       ${scoreLabel(oura.sleepScore)}`, 'normal', highlighted === 1),
        line(`Readiness   ${scoreLabel(oura.readinessScore)}`, 'normal', highlighted === 2),
        line(''),
        line(`Active time ${formatHoursMinutes(totalActiveMinutes || null)}`),
        line(`Sleep time  ${formatHoursMinutes(oura.sleepDetail?.totalSleepMinutes ?? null)}`),
        line(`Resilience  ${oura.resilienceLevel ?? '--'}`),
        line(`Steps       ${oura.steps ?? '--'}`),
      ],
    }
  },

  action(action, nav, snapshot) {
    const { oura } = snapshot
    if (!oura.connected || oura.error) return nav

    if (action.type === 'HIGHLIGHT_MOVE') {
      const delta = action.direction === 'down' ? 1 : -1
      const next = ((nav.highlightedIndex + delta) % METRIC_COUNT + METRIC_COUNT) % METRIC_COUNT
      return { ...nav, highlightedIndex: next }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      const highlighted = ((nav.highlightedIndex % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
      return { screen: METRIC_SCREENS[highlighted], highlightedIndex: 0 }
    }

    return nav
  },
}
