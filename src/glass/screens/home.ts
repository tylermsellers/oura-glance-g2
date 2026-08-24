import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { buildScrollableContent, DEFAULT_CONTENT_SLOTS } from 'even-toolkit/glass-display-builders'
import { moveHighlight, calcMaxScroll } from 'even-toolkit/glass-nav'
import { createModeEncoder } from 'even-toolkit/glass-mode'
import type { AppSnapshot, AppActions, OuraData } from '../shared'
import { formatHoursMinutes } from '../../lib/units'

function scoreLabel(score: number | null): string {
  if (score === null) return '--'
  return `${score}`
}

function stressLabel(summary: string | null): string {
  if (!summary) return '--'
  return summary.charAt(0).toUpperCase() + summary.slice(1)
}

function capitalize(v: string | null): string {
  if (!v) return '--'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

// The three metric rows are selectable and drill into their own detail screen.
// Order matches the phone app + user preference: Activity, Sleep, Readiness.
const METRIC_SCREENS = ['activity-detail', 'sleep-detail', 'readiness-detail'] as const
const METRIC_COUNT = METRIC_SCREENS.length

// The stats block below the metric rows no longer fits the display (it grew
// from 4 to 6 lines once Stress and Latest HR were added), so it's rendered
// as its own scrollable content region. nav.highlightedIndex is reused for
// both tile selection (0-99) and stats scroll offset (100+) via a mode
// encoder, since a single screen can only carry one nav number.
const NAV_MODE = createModeEncoder({ tiles: 0, scroll: 100 })

function buildStatsLines(oura: OuraData): string[] {
  const totalActiveMinutes =
    (oura.activityDetail?.highActivityMinutes ?? 0) +
    (oura.activityDetail?.mediumActivityMinutes ?? 0) +
    (oura.activityDetail?.lowActivityMinutes ?? 0)

  return [
    `Active time ${formatHoursMinutes(totalActiveMinutes || null)}`,
    `Sleep time  ${formatHoursMinutes(oura.sleepDetail?.totalSleepMinutes ?? null)}`,
    `Resilience  ${capitalize(oura.resilienceLevel)}`,
    `Steps       ${oura.steps ?? '--'}`,
    `Stress      ${stressLabel(oura.stressSummary)}`,
    `HR (latest) ${oura.latestHeartRate !== null ? `${oura.latestHeartRate} bpm` : '--'}`,
  ]
}

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const { oura } = snapshot

    if (!oura.connected && !oura.error) {
      return {
        lines: [
          ...glassHeader('OURA'),
          line(''),
          line('Not connected'),
          line('Open app on phone to'),
          line('connect with Oura'),
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

    const { mode, offset } = NAV_MODE.decode(nav.highlightedIndex)

    if (mode === 'scroll') {
      // In the scrolled-down stats view, the three metric rows are folded
      // into the same scrollable window as the stats, so nothing above the
      // header is highlightable -- only GO_BACK / more scrolling applies.
      return buildScrollableContent({
        title: 'OURA',
        actionBar: 'Tap: Details',
        contentLines: buildStatsLines(oura),
        scrollPos: offset,
        contentStyle: 'normal',
      })
    }

    const highlighted = ((offset % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT

    // The home screen renders into a smaller "menu" text container below the
    // image tile (see even-toolkit/glasses/bridge.ts showHomePage()), not the
    // full-height container used by showTextPage() on detail screens. That
    // container only fits ~5 lines total (title + separator + 3 content
    // lines) -- confirmed empirically via the simulator, since
    // even-toolkit does not expose a home-specific line-capacity constant.
    // The 3 metric rows already consume all 3 available content lines, so
    // there's no room for a separate preview/hint block below them; the
    // "more" hint is folded into the header's action-bar line instead so it
    // never gets clipped.
    return {
      lines: [
        ...glassHeader('OURA', 'Tap \u25b8 \u25bc Scroll'),
        line(`Activity    ${scoreLabel(oura.activityScore)}`, 'normal', highlighted === 0),
        line(`Sleep       ${scoreLabel(oura.sleepScore)}`, 'normal', highlighted === 1),
        line(`Readiness   ${scoreLabel(oura.readinessScore)}`, 'normal', highlighted === 2),
      ],
    }
  },

  action(action, nav, snapshot) {
    const { oura } = snapshot
    if (!oura.connected || oura.error) return nav

    const { mode, offset } = NAV_MODE.decode(nav.highlightedIndex)

    if (action.type === 'HIGHLIGHT_MOVE') {
      if (mode === 'scroll') {
        if (action.direction === 'up' && offset === 0) {
          // Scrolling up from the very top of the stats view transitions
          // back to tile selection, landing on the last tile -- otherwise
          // moveHighlight() just clamps at 0 forever and "up" does nothing.
          return { ...nav, highlightedIndex: NAV_MODE.encode('tiles', METRIC_COUNT - 1) }
        }
        const maxScroll = calcMaxScroll(buildStatsLines(oura).length, DEFAULT_CONTENT_SLOTS)
        const next = moveHighlight(offset, action.direction, maxScroll)
        return { ...nav, highlightedIndex: NAV_MODE.encode('scroll', next) }
      }

      // Scrolling down past the last metric tile transitions into the
      // scrollable stats view; scrolling up from the stats view (at its top)
      // transitions back to tile selection on the last tile.
      if (action.direction === 'down') {
        const next = offset + 1
        if (next >= METRIC_COUNT) {
          return { ...nav, highlightedIndex: NAV_MODE.encode('scroll', 0) }
        }
        return { ...nav, highlightedIndex: NAV_MODE.encode('tiles', next) }
      }
      const next = ((offset - 1) % METRIC_COUNT + METRIC_COUNT) % METRIC_COUNT
      return { ...nav, highlightedIndex: NAV_MODE.encode('tiles', next) }
    }

    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (mode === 'scroll') return nav
      const highlighted = ((offset % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
      return { screen: METRIC_SCREENS[highlighted], highlightedIndex: 0 }
    }

    return nav
  },
}

