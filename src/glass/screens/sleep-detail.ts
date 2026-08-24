import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { DEFAULT_CONTENT_SLOTS } from 'even-toolkit/glass-display-builders'
import { moveHighlight, calcMaxScroll } from 'even-toolkit/glass-nav'
import { buildScrollableContentWithBar } from '../scroll-utils'
import type { AppSnapshot, AppActions, OuraData } from '../shared'
import { formatHoursMinutes } from '../../lib/units'

function val(v: number | null, unit = ''): string {
  if (v === null) return '--'
  return `${v}${unit}`
}

// Shared by display() (to render) and action() (to know how far a
// HIGHLIGHT_MOVE scroll gesture is allowed to go) so the two never disagree
// about how many content lines there are.
function buildContentLines(oura: OuraData): string[] {
  const d = oura.sleepDetail
  return [
    `Total Sleep     ${formatHoursMinutes(d?.totalSleepMinutes ?? null)}`,
    `Efficiency      ${val(d?.efficiencyPercent ?? null, '%')}`,
    `REM Sleep       ${formatHoursMinutes(d?.remSleepMinutes ?? null)}`,
    `Deep Sleep      ${formatHoursMinutes(d?.deepSleepMinutes ?? null)}`,
    `Light Sleep     ${formatHoursMinutes(d?.lightSleepMinutes ?? null)}`,
    `Awake           ${formatHoursMinutes(d?.awakeMinutes ?? null)}`,
    `Latency         ${val(d?.latencyMinutes ?? null, ' min')}`,
    `Restless Pds.   ${val(d?.restlessPeriods ?? null)}`,
  ]
}

export const sleepDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const { oura } = snapshot
    return buildScrollableContentWithBar({
      title: `SLEEP  ${oura.sleepScore ?? '--'}`,
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
