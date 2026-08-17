import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppSnapshot, AppActions } from '../shared'

function scoreLabel(score: number | null): string {
  if (score === null) return '--'
  return `${score}`
}

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot) {
    const { oura } = snapshot

    if (!oura.connected && !oura.error) {
      return {
        lines: [
          ...glassHeader('OURA GLANCE'),
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
          ...glassHeader('OURA GLANCE', '! ERROR'),
          line(''),
          line('Connection error:'),
          line(oura.error.slice(0, 40)),
        ],
      }
    }

    return {
      lines: [
        ...glassHeader('OURA GLANCE'),
        line(`Readiness   ${scoreLabel(oura.readinessScore)}`),
        line(`Activity    ${scoreLabel(oura.activityScore)}`),
        line(`Resilience  ${oura.resilienceLevel ?? '--'}`),
        line(''),
        line(`Active kcal ${oura.activeCalories ?? '--'}`),
        line(`Total kcal  ${oura.totalCalories ?? '--'}`),
        line(`Steps       ${oura.steps ?? '--'}`),
      ],
    }
  },

  action(_action, nav) {
    return nav
  },
}
