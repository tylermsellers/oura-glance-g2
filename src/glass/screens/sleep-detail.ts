import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'
import { formatHoursMinutes } from '../../lib/units'

function val(v: number | null, unit = ''): string {
  if (v === null) return '--'
  return `${v}${unit}`
}

export const sleepDetailScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot) {
    const { oura } = snapshot
    const d = oura.sleepDetail

    return {
      lines: [
        ...glassHeader(`SLEEP  ${oura.sleepScore ?? '--'}`, 'Tap: Back'),
        line(`Total Sleep     ${formatHoursMinutes(d?.totalSleepMinutes ?? null)}`),
        line(`Efficiency      ${val(d?.efficiencyPercent ?? null, '%')}`),
        line(`REM Sleep       ${formatHoursMinutes(d?.remSleepMinutes ?? null)}`),
        line(`Deep Sleep      ${formatHoursMinutes(d?.deepSleepMinutes ?? null)}`),
        line(`Light Sleep     ${formatHoursMinutes(d?.lightSleepMinutes ?? null)}`),
        line(`Awake           ${formatHoursMinutes(d?.awakeMinutes ?? null)}`),
        line(`Latency         ${val(d?.latencyMinutes ?? null, ' min')}`),
        line(`Restless Pds.   ${val(d?.restlessPeriods ?? null)}`),
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
