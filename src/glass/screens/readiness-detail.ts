import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { buildScrollableContent, DEFAULT_CONTENT_SLOTS } from 'even-toolkit/glass-display-builders'
import { moveHighlight, calcMaxScroll } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions, OuraData } from '../shared'
import { formatTempDeviation, loadUnitSystem } from '../../lib/units'

function val(v: number | null, unit = ''): string {
  if (v === null) return '--'
  return `${v}${unit}`
}

// Shared by display() (to render) and action() (to know how far a
// HIGHLIGHT_MOVE scroll gesture is allowed to go) so the two never disagree
// about how many content lines there are.
function buildContentLines(oura: OuraData): string[] {
  const d = oura.readinessDetail
  const units = loadUnitSystem()
  return [
    `Resting HR      ${val(d?.restingHeartRate ?? null, ' bpm')}`,
    `Avg HRV         ${val(d?.averageHrv ?? null, ' ms')}`,
    `Body Temp Dev.  ${formatTempDeviation(d?.bodyTemperatureDeviation ?? null, units)}`,
    '',
    `HRV Balance     ${val(d?.hrvBalanceScore ?? null)}`,
    `Recovery Index  ${val(d?.recoveryIndexScore ?? null)}`,
    `Sleep Balance   ${val(d?.sleepBalanceScore ?? null)}`,
    `Activity Bal.   ${val(d?.activityBalanceScore ?? null)}`,
    `Prev Day Act.   ${val(d?.previousDayActivityScore ?? null)}`,
    `Prev Night      ${val(d?.previousNightScore ?? null)}`,
  ]
}

export const readinessDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const { oura } = snapshot
    return buildScrollableContent({
      title: `READINESS  ${oura.readinessScore ?? '--'}`,
      actionBar: 'Tap: Back',
      contentLines: buildContentLines(oura),
      scrollPos: nav.highlightedIndex,
      // Preserve the plain (non-dimmed) line style this screen used before
      // scrolling was added — buildScrollableContent defaults to 'meta'.
      contentStyle: 'normal',
    })
  },

  action(action, nav, snapshot) {
    if (action.type === 'GO_BACK' || action.type === 'SELECT_HIGHLIGHTED') {
      return { ...nav, screen: 'home', highlightedIndex: 0 }
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      const maxScroll = calcMaxScroll(buildContentLines(snapshot.oura).length, DEFAULT_CONTENT_SLOTS)
      return { ...nav, highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, maxScroll) }
    }
    return nav
  },
}
