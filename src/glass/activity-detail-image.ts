import type { OuraData } from './shared'
import { formatDistance, formatHoursMinutes, loadUnitSystem } from '../lib/units'
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

export function hasActivityDetail(oura: OuraData): boolean {
  return oura.activityDetail !== null
}

function renderContributors(oura: OuraData): RenderedTile[] {
  const d = oura.activityDetail

  return renderTiles((ctx) => {
    drawHeader(ctx, 'ACTIVITY', 'SWIPE: DETAILS   DOUBLE TAP: BACK')
    const blockEnd = drawScore(ctx, oura.activityScore, SCORE_BASELINE)
    const metricsLeft = Math.max(blockEnd + 24, 170)
    const column = (DISPLAY_W - EDGE_X - metricsLeft) / 3
    const metrics: Array<[string, string]> = [
      ['ACTIVE CAL', oura.activeCalories == null ? '--' : `${oura.activeCalories} kcal`],
      ['TOTAL BURN', oura.totalCalories == null ? '--' : `${oura.totalCalories} kcal`],
      ['STEPS', value(oura.steps)],
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
      ['Stay Active', d?.stayActiveScore],
      ['Move Every Hour', d?.moveEveryHourScore],
      ['Meet Daily Goals', d?.meetDailyTargetsScore],
      ['Training Frequency', d?.trainingFrequencyScore],
      ['Training Volume', d?.trainingVolumeScore],
      ['Recovery Time', d?.recoveryTimeScore],
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

function drawGoal(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  current: string,
  ratio: number | null,
): void {
  ctx.font = '500 12px Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK.normal
  ctx.textAlign = 'left'
  ctx.fillText(label, EDGE_X, y + 12)
  ctx.fillStyle = INK.label
  ctx.textAlign = 'right'
  ctx.fillText(current, DISPLAY_W - EDGE_X, y + 12)

  const barW = DISPLAY_W - EDGE_X * 2
  ctx.fillStyle = INK.track
  ctx.fillRect(EDGE_X, y + 18, barW, 7)
  if (ratio !== null) {
    ctx.fillStyle = INK.bright
    ctx.fillRect(EDGE_X, y + 18, Math.round(barW * Math.min(1, Math.max(0, ratio))), 7)
  }
}

function drawIntensity(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  duration: number | null | undefined,
  maxDuration: number,
  shade: string,
): void {
  const amount = duration ?? 0
  ctx.font = '500 12px Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK.normal
  ctx.textAlign = 'left'
  ctx.fillText(label, EDGE_X, y + 12)
  ctx.fillStyle = INK.label
  ctx.textAlign = 'right'
  ctx.fillText(minutes(duration), DISPLAY_W - EDGE_X, y + 12)

  const barX = 112
  const barW = DISPLAY_W - EDGE_X - barX
  ctx.fillStyle = INK.track
  ctx.fillRect(barX, y + 3, barW, 10)
  ctx.fillStyle = shade
  ctx.fillRect(barX, y + 3, Math.round(barW * Math.min(1, amount / maxDuration)), 10)
}

function renderDetails(oura: OuraData): RenderedTile[] {
  const d = oura.activityDetail
  const units = loadUnitSystem()
  const calorieRatio =
    oura.activeCalories !== null && d?.targetCalories != null && d.targetCalories > 0
      ? oura.activeCalories / d.targetCalories
      : null
  const distanceDone =
    d?.targetMeters != null && d.metersToTarget != null
      ? Math.max(0, d.targetMeters - d.metersToTarget)
      : null
  const distanceRatio =
    distanceDone !== null && d?.targetMeters != null && d.targetMeters > 0
      ? distanceDone / d.targetMeters
      : null
  const intensityMax = Math.max(
    1,
    d?.highActivityMinutes ?? 0,
    d?.mediumActivityMinutes ?? 0,
    d?.lowActivityMinutes ?? 0,
  )

  return renderTiles((ctx) => {
    drawHeader(ctx, 'ACTIVITY DETAILS', 'SWIPE: SCORE   DOUBLE TAP: BACK')

    drawGoal(
      ctx,
      44,
      'Active Calorie Goal',
      oura.activeCalories == null || d?.targetCalories == null
        ? '--'
        : `${oura.activeCalories} / ${d.targetCalories} kcal`,
      calorieRatio,
    )
    drawGoal(
      ctx,
      82,
      'Distance Goal',
      distanceDone === null || d?.targetMeters == null
        ? '--'
        : `${formatDistance(distanceDone, units)} / ${formatDistance(d.targetMeters, units)}`,
      distanceRatio,
    )

    ctx.strokeStyle = INK.rule
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(EDGE_X, 119)
    ctx.lineTo(DISPLAY_W - EDGE_X, 119)
    ctx.stroke()

    drawIntensity(ctx, 132, 'High', d?.highActivityMinutes, intensityMax, '#ffffff')
    drawIntensity(ctx, 164, 'Medium', d?.mediumActivityMinutes, intensityMax, '#c8c8c8')
    drawIntensity(ctx, 196, 'Low', d?.lowActivityMinutes, intensityMax, '#909090')

    drawMetric(ctx, 118, 'SEDENTARY', minutes(d?.sedentaryMinutes), 272)
    drawMetric(ctx, 288, 'RESTING', minutes(d?.restingMinutes), 272)
    drawMetric(
      ctx,
      458,
      'WALK DISTANCE',
      formatDistance(d?.equivalentWalkingDistanceMeters ?? null, units),
      272,
    )
  })
}

export function renderActivityDetail(oura: OuraData, page: number): RenderedTile[] {
  return page === 0 ? renderContributors(oura) : renderDetails(oura)
}
