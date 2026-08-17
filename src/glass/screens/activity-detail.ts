import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'
import { formatHoursMinutes, formatDistance, loadUnitSystem } from '../../lib/units'

function val(v: number | null, unit = ''): string {
  if (v === null) return '--'
  return `${v}${unit}`
}

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

export const activityDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot) {
    const { oura } = snapshot
    const d = oura.activityDetail

    return {
      lines: [
        ...glassHeader(`ACTIVITY  ${oura.activityScore ?? '--'}`, 'Tap: Back'),
        line(calorieGoalLine(oura.activeCalories, d?.targetCalories ?? null)),
        line(distanceGoalLine(d?.metersToTarget ?? null, d?.targetMeters ?? null)),
        line(''),
        line(`High Activity   ${formatHoursMinutes(d?.highActivityMinutes ?? null)}`),
        line(`Medium Activity ${formatHoursMinutes(d?.mediumActivityMinutes ?? null)}`),
        line(`Low Activity    ${formatHoursMinutes(d?.lowActivityMinutes ?? null)}`),
        line(`Sedentary       ${formatHoursMinutes(d?.sedentaryMinutes ?? null)}`),
        line(`Resting         ${formatHoursMinutes(d?.restingMinutes ?? null)}`),
        line(''),
        line(`Total kcal  ${oura.totalCalories ?? '--'}`),
        line(`Steps       ${oura.steps ?? '--'}`),
      ],
    }
  },

  action(action, nav) {
    if (action.type === 'GO_BACK' || action.type === 'SELECT_HIGHLIGHTED') {
      return { ...nav, screen: 'home' }
    }
    return nav
  },
}
