// Graphical Readiness detail, styled after the phone app's readiness page:
// a large score with its qualitative band, raw "key metrics" across the top,
// and the contributor rows with progress bars underneath.
import type { OuraData } from './shared'
import { formatTempDeviation, loadUnitSystem } from '../lib/units'
import {
  DISPLAY_W,
  EDGE_X,
  INK,
  drawContributor,
  drawHeader,
  drawMetric,
  drawScore,
  renderTiles,
  type RenderedTile,
} from './glass-image'

const SCORE_BASELINE = 88
const RULE_Y = 104
const ROW_TOP = 114
const ROW_PITCH = 28

function num(value: number | null | undefined, unit = ''): string {
  if (value === null || value === undefined) return '--'
  return `${value}${unit}`
}

function score(value: number | null | undefined): string {
  return value === null || value === undefined ? '--' : String(value)
}

function progress(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value / 100
}

/** True when there is enough data to be worth rendering the graphical page. */
export function hasReadinessDetail(oura: OuraData): boolean {
  return oura.readinessDetail !== null && oura.readinessDetail !== undefined
}

export function renderReadinessDetail(oura: OuraData): RenderedTile[] {
  const d = oura.readinessDetail
  const units = loadUnitSystem()

  return renderTiles((ctx) => {
    drawHeader(ctx, 'READINESS', 'TAP: BACK')

    const blockEnd = drawScore(ctx, oura.readinessScore ?? null, SCORE_BASELINE)

    // Key metrics share whatever width is left beside the score block.
    const metricsLeft = Math.max(blockEnd + 24, 170)
    const metricsWidth = DISPLAY_W - EDGE_X - metricsLeft
    const column = metricsWidth / 3
    const metrics: Array<[string, string]> = [
      ['RESTING HR', num(d?.restingHeartRate, ' bpm')],
      ['AVG HRV', num(d?.averageHrv, ' ms')],
      ['BODY TEMP', formatTempDeviation(d?.bodyTemperatureDeviation ?? null, units)],
    ]
    metrics.forEach(([label, value], index) => {
      drawMetric(ctx, metricsLeft + column * (index + 0.5), label, value, SCORE_BASELINE)
    })

    ctx.strokeStyle = INK.rule
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(EDGE_X, RULE_Y)
    ctx.lineTo(DISPLAY_W - EDGE_X, RULE_Y)
    ctx.stroke()

    const contributors: Array<[string, number | null | undefined]> = [
      ['HRV Balance', d?.hrvBalanceScore],
      ['Recovery Index', d?.recoveryIndexScore],
      ['Sleep Balance', d?.sleepBalanceScore],
      ['Activity Balance', d?.activityBalanceScore],
      ['Previous Day Activity', d?.previousDayActivityScore],
      ['Previous Night', d?.previousNightScore],
    ]
    contributors.forEach(([label, value], index) => {
      drawContributor(ctx, ROW_TOP + ROW_PITCH * index, label, score(value), progress(value))
    })
  })
}
