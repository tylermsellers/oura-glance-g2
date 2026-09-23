import type { OuraData } from './shared'
import { formatHoursMinutes } from '../lib/units'
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

function value(v: number | null | undefined): string {
  return v === null || v === undefined ? '--' : String(v)
}

function progress(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : v / 100
}

function minutes(v: number | null | undefined): string {
  return formatHoursMinutes(v ?? null)
}

export function hasSleepDetail(oura: OuraData): boolean {
  return oura.sleepDetail !== null
}

function renderContributors(oura: OuraData): RenderedTile[] {
  const d = oura.sleepDetail

  return renderTiles((ctx) => {
    drawHeader(ctx, 'SLEEP', 'SWIPE: DETAILS   DOUBLE TAP: BACK')
    const blockEnd = drawScore(ctx, oura.sleepScore, SCORE_BASELINE)
    const metricsLeft = Math.max(blockEnd + 24, 170)
    const column = (DISPLAY_W - EDGE_X - metricsLeft) / 3
    const metrics: Array<[string, string]> = [
      ['TOTAL SLEEP', minutes(d?.totalSleepMinutes)],
      ['LATENCY', d?.latencyMinutes == null ? '--' : `${d.latencyMinutes} min`],
      ['AWAKE', minutes(d?.awakeMinutes)],
    ]
    metrics.forEach(([label, metricValue], index) => {
      drawMetric(ctx, metricsLeft + column * (index + 0.5), label, metricValue, SCORE_BASELINE)
    })

    ctx.strokeStyle = INK.rule
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(EDGE_X, RULE_Y)
    ctx.lineTo(DISPLAY_W - EDGE_X, RULE_Y)
    ctx.stroke()

    const contributors: Array<[string, number | null | undefined]> = [
      ['Total Sleep', d?.totalSleepScore],
      ['Efficiency', d?.efficiencyScore],
      ['REM Sleep', d?.remSleepScore],
      ['Deep Sleep', d?.deepSleepScore],
      ['Timing', d?.timingScore],
      ['Restfulness', d?.restfulnessScore],
    ]
    contributors.forEach(([label, contributorValue], index) => {
      drawContributor(
        ctx,
        ROW_TOP + ROW_PITCH * index,
        label,
        value(contributorValue),
        progress(contributorValue),
      )
    })
  })
}

function drawStage(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  stageMinutes: number | null | undefined,
  totalMinutes: number | null | undefined,
  shade: string,
): void {
  const stage = stageMinutes ?? null
  const total = totalMinutes ?? null
  const ratio = stage !== null && total !== null && total > 0 ? Math.min(1, stage / total) : 0

  ctx.font = '500 12px Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK.normal
  ctx.textAlign = 'left'
  ctx.fillText(label, EDGE_X, y + 12)
  ctx.fillStyle = INK.label
  ctx.textAlign = 'right'
  ctx.fillText(minutes(stage), DISPLAY_W - EDGE_X, y + 12)

  const barX = 112
  const barW = DISPLAY_W - EDGE_X - barX
  ctx.fillStyle = INK.track
  ctx.fillRect(barX, y + 3, barW, 10)
  ctx.fillStyle = shade
  ctx.fillRect(barX, y + 3, Math.round(barW * ratio), 10)
}

function renderDetails(oura: OuraData): RenderedTile[] {
  const d = oura.sleepDetail
  const total = d?.totalSleepMinutes

  return renderTiles((ctx) => {
    drawHeader(ctx, 'SLEEP DETAILS', 'SWIPE: SCORE   DOUBLE TAP: BACK')

    ctx.fillStyle = INK.dim
    ctx.font = '500 11px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('TIME ASLEEP', EDGE_X, 54)

    ctx.fillStyle = INK.bright
    ctx.font = '600 34px Arial, sans-serif'
    ctx.fillText(minutes(total), EDGE_X, 88)

    const metrics: Array<[string, string]> = [
      ['EFFICIENCY', d?.efficiencyPercent == null ? '--' : `${d.efficiencyPercent}%`],
      ['LATENCY', d?.latencyMinutes == null ? '--' : `${d.latencyMinutes} min`],
      ['RESTLESS', value(d?.restlessPeriods)],
    ]
    metrics.forEach(([label, metricValue], index) => {
      drawMetric(ctx, 270 + index * 140, label, metricValue, 88)
    })

    ctx.strokeStyle = INK.rule
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(EDGE_X, RULE_Y)
    ctx.lineTo(DISPLAY_W - EDGE_X, RULE_Y)
    ctx.stroke()

    drawStage(ctx, 120, 'Awake', d?.awakeMinutes, total, '#777777')
    drawStage(ctx, 154, 'REM', d?.remSleepMinutes, total, '#d8d8d8')
    drawStage(ctx, 188, 'Light', d?.lightSleepMinutes, total, '#aaaaaa')
    drawStage(ctx, 222, 'Deep', d?.deepSleepMinutes, total, '#ffffff')

    ctx.fillStyle = INK.dim
    ctx.font = '500 10px Arial, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('SHARE OF TOTAL SLEEP', DISPLAY_W - EDGE_X, 274)
  })
}

export function renderSleepDetail(oura: OuraData, page: number): RenderedTile[] {
  return page === 0 ? renderContributors(oura) : renderDetails(oura)
}
