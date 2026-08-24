import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { buildScrollableContent, DEFAULT_CONTENT_SLOTS } from 'even-toolkit/glass-display-builders'
import { moveHighlight, calcMaxScroll } from 'even-toolkit/glass-nav'
import type { AppSnapshot, AppActions, OuraData } from '../shared'
import { formatHoursMinutes, formatDistance, loadUnitSystem } from '../../lib/units'

function calorieGoalLine(active: number | null, target: number | null): string {
  if (active === null || target === null || target <= 0) return `Cal Goal     --`
  const pct = Math.min(100, Math.round((active / target) * 100))
  return `Cal Goal     ${active}/${target} kcal (${pct}%)`
}

function distanceGoalLine(metersToTarget: number | null, target: number | null): string {
  if (metersToTarget === null || target === null || target <= 0) return `Dist Goal    --`
  const done = Math.max(0, target - metersToTarget)
  const units = loadUnitSystem()
  const pct = Math.min(100, Math.round((done / target) * 100))
  return `Dist Goal    ${formatDistance(done, units)}/${formatDistance(target, units)} (${pct}%)`
}

// Shared by display() (to render) and action() (to know how far a
// HIGHLIGHT_MOVE scroll gesture is allowed to go) so the two never disagree
// about how many content lines there are.
function buildContentLines(oura: OuraData): string[] {
  const d = oura.activityDetail
  return [
    calorieGoalLine(oura.activeCalories, d?.targetCalories ?? null),
    distanceGoalLine(d?.metersToTarget ?? null, d?.targetMeters ?? null),
    '',
    `High Activity   ${formatHoursMinutes(d?.highActivityMinutes ?? null)}`,
    `Medium Activity ${formatHoursMinutes(d?.mediumActivityMinutes ?? null)}`,
    `Low Activity    ${formatHoursMinutes(d?.lowActivityMinutes ?? null)}`,
    `Sedentary       ${formatHoursMinutes(d?.sedentaryMinutes ?? null)}`,
    `Resting         ${formatHoursMinutes(d?.restingMinutes ?? null)}`,
    '',
    `Total kcal  ${oura.totalCalories ?? '--'}`,
    `Steps       ${oura.steps ?? '--'}`,
  ]
}

export const activityDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const { oura } = snapshot
    return buildScrollableContent({
      title: `ACTIVITY  ${oura.activityScore ?? '--'}`,
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
    // This screen's content (11 lines) doesn't fit the 7 visible content
    // slots below the header, so a touchpad scroll gesture needs to move a
    // scroll window through the content — reusing `highlightedIndex` as the
    // scroll position, the same way home.ts uses it for tile selection.
    if (action.type === 'HIGHLIGHT_MOVE') {
      const maxScroll = calcMaxScroll(buildContentLines(snapshot.oura).length, DEFAULT_CONTENT_SLOTS)
      return { ...nav, highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, maxScroll) }
    }
    return nav
  },
}
