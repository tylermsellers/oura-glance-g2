import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'
import { formatTempDeviation, loadUnitSystem } from '../../lib/units'

function val(v: number | null, unit = ''): string {
  if (v === null) return '--'
  return `${v}${unit}`
}

export const readinessDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot) {
    const { oura } = snapshot
    const d = oura.readinessDetail
    const units = loadUnitSystem()

    return {
      lines: [
        ...glassHeader(`READINESS  ${oura.readinessScore ?? '--'}`, 'Tap: Back'),
        line(`Resting HR      ${val(d?.restingHeartRate ?? null, ' bpm')}`),
        line(`Avg HRV         ${val(d?.averageHrv ?? null, ' ms')}`),
        line(`Body Temp Dev.  ${formatTempDeviation(d?.bodyTemperatureDeviation ?? null, units)}`),
        line(''),
        line(`HRV Balance     ${val(d?.hrvBalanceScore ?? null)}`),
        line(`Recovery Index  ${val(d?.recoveryIndexScore ?? null)}`),
        line(`Sleep Balance   ${val(d?.sleepBalanceScore ?? null)}`),
        line(`Activity Bal.   ${val(d?.activityBalanceScore ?? null)}`),
        line(`Prev Day Act.   ${val(d?.previousDayActivityScore ?? null)}`),
        line(`Prev Night      ${val(d?.previousNightScore ?? null)}`),
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
