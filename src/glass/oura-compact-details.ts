import type { OuraData } from './shared'
import { formatDistance, formatHoursMinutes, formatTempDeviation, loadUnitSystem } from '../lib/units'
import { INK, scoreQuality, type RenderedTile } from './glass-image'
import { renderCompactTile } from './oura-summary'

const W = 288

function value(v: number | null | undefined, unit = ''): string {
  return v === null || v === undefined ? '--' : `${v}${unit}`
}

function minutes(v: number | null | undefined): string {
  return formatHoursMinutes(v ?? null)
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  title: string,
  score: number | null,
  metrics: Array<[string, string]>,
): void {
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK.normal
  ctx.font = '600 10px Arial, sans-serif'
  ctx.fillText(title, 7, 12)

  ctx.fillStyle = INK.bright
  ctx.font = '600 27px Arial, sans-serif'
  ctx.fillText(score === null ? '--' : String(score), 7, 42)

  ctx.fillStyle = INK.label
  ctx.font = '600 8px Arial, sans-serif'
  ctx.fillText(scoreQuality(score), 47, 42)

  const left = 102
  const column = (W - left - 5) / metrics.length
  metrics.forEach(([label, metricValue], index) => {
    const x = left + column * (index + 0.5)
    ctx.textAlign = 'center'
    ctx.fillStyle = INK.dim
    ctx.font = '500 7px Arial, sans-serif'
    ctx.fillText(label, x, 23)
    ctx.fillStyle = INK.normal
    ctx.font = '600 10px Arial, sans-serif'
    ctx.fillText(metricValue, x, 39)
  })

  ctx.strokeStyle = INK.rule
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(7, 47)
  ctx.lineTo(W - 7, 47)
  ctx.stroke()
}

function drawContributor(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  score: number | null | undefined,
): void {
  ctx.textBaseline = 'alphabetic'
  ctx.font = '500 8px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK.normal
  ctx.fillText(label, 7, y + 7)
  ctx.textAlign = 'right'
  ctx.fillStyle = INK.label
  ctx.fillText(value(score), W - 7, y + 7)

  const progress = score === null || score === undefined ? 0 : Math.min(1, score / 100)
  ctx.fillStyle = INK.track
  ctx.fillRect(7, y + 9, W - 14, 3)
  ctx.fillStyle = INK.bright
  ctx.fillRect(7, y + 9, Math.round((W - 14) * progress), 3)
}

function drawContributors(
  ctx: CanvasRenderingContext2D,
  rows: Array<[string, number | null | undefined]>,
): void {
  rows.forEach(([label, score], index) => {
    drawContributor(ctx, 50 + index * 15, label, score)
  })
}

export function renderCompactReadiness(oura: OuraData): RenderedTile {
  const d = oura.readinessDetail
  const units = loadUnitSystem()
  return renderCompactTile((ctx) => {
    drawHeader(ctx, 'READINESS', oura.readinessScore, [
      ['RESTING HR', value(d?.restingHeartRate, ' bpm')],
      ['AVG HRV', value(d?.averageHrv, ' ms')],
      ['BODY TEMP', formatTempDeviation(d?.bodyTemperatureDeviation ?? null, units)],
    ])
    drawContributors(ctx, [
      ['HRV Balance', d?.hrvBalanceScore],
      ['Recovery Index', d?.recoveryIndexScore],
      ['Sleep Balance', d?.sleepBalanceScore],
      ['Activity Balance', d?.activityBalanceScore],
      ['Previous Day Activity', d?.previousDayActivityScore],
      ['Previous Night', d?.previousNightScore],
    ])
  })
}

export function renderCompactSleepScore(oura: OuraData): RenderedTile {
  const d = oura.sleepDetail
  return renderCompactTile((ctx) => {
    drawHeader(ctx, 'SLEEP', oura.sleepScore, [
      ['TOTAL SLEEP', minutes(d?.totalSleepMinutes)],
      ['LATENCY', value(d?.latencyMinutes, ' min')],
      ['AWAKE', minutes(d?.awakeMinutes)],
    ])
    drawContributors(ctx, [
      ['Total Sleep', d?.totalSleepScore],
      ['Efficiency', d?.efficiencyScore],
      ['REM Sleep', d?.remSleepScore],
      ['Deep Sleep', d?.deepSleepScore],
      ['Timing', d?.timingScore],
      ['Restfulness', d?.restfulnessScore],
    ])
  })
}

function drawStage(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  stage: number | null | undefined,
  total: number | null | undefined,
  shade: string,
): void {
  const ratio = stage != null && total != null && total > 0 ? Math.min(1, stage / total) : 0
  ctx.font = '500 8px Arial, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK.normal
  ctx.fillText(label, 7, y + 8)
  ctx.textAlign = 'right'
  ctx.fillStyle = INK.label
  ctx.fillText(minutes(stage), W - 7, y + 8)
  ctx.fillStyle = INK.track
  ctx.fillRect(57, y + 1, 181, 8)
  ctx.fillStyle = shade
  ctx.fillRect(57, y + 1, Math.round(181 * ratio), 8)
}

export function renderCompactSleepDetails(oura: OuraData): RenderedTile {
  const d = oura.sleepDetail
  const total = d?.totalSleepMinutes
  return renderCompactTile((ctx) => {
    ctx.fillStyle = INK.normal
    ctx.font = '600 10px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('SLEEP DETAILS', 7, 12)
    ctx.fillStyle = INK.bright
    ctx.font = '600 25px Arial, sans-serif'
    ctx.fillText(minutes(total), 7, 40)

    const metrics: Array<[string, string]> = [
      ['EFFICIENCY', value(d?.efficiencyPercent, '%')],
      ['LATENCY', value(d?.latencyMinutes, ' min')],
      ['RESTLESS', value(d?.restlessPeriods)],
    ]
    metrics.forEach(([label, metricValue], index) => {
      const x = 142 + index * 69
      ctx.textAlign = 'center'
      ctx.fillStyle = INK.dim
      ctx.font = '500 7px Arial, sans-serif'
      ctx.fillText(label, x, 23)
      ctx.fillStyle = INK.normal
      ctx.font = '600 10px Arial, sans-serif'
      ctx.fillText(metricValue, x, 39)
    })

    ctx.strokeStyle = INK.rule
    ctx.beginPath()
    ctx.moveTo(7, 47)
    ctx.lineTo(W - 7, 47)
    ctx.stroke()

    drawStage(ctx, 55, 'Awake', d?.awakeMinutes, total, '#777777')
    drawStage(ctx, 77, 'REM', d?.remSleepMinutes, total, '#d8d8d8')
    drawStage(ctx, 99, 'Light', d?.lightSleepMinutes, total, '#aaaaaa')
    drawStage(ctx, 121, 'Deep', d?.deepSleepMinutes, total, '#ffffff')
  })
}

export function renderCompactActivityScore(oura: OuraData): RenderedTile {
  const d = oura.activityDetail
  return renderCompactTile((ctx) => {
    drawHeader(ctx, 'ACTIVITY', oura.activityScore, [
      ['ACTIVE CAL', value(oura.activeCalories, ' kcal')],
      ['TOTAL BURN', value(oura.totalCalories, ' kcal')],
      ['STEPS', value(oura.steps)],
    ])
    drawContributors(ctx, [
      ['Stay Active', d?.stayActiveScore],
      ['Move Every Hour', d?.moveEveryHourScore],
      ['Meet Daily Goals', d?.meetDailyTargetsScore],
      ['Training Frequency', d?.trainingFrequencyScore],
      ['Training Volume', d?.trainingVolumeScore],
      ['Recovery Time', d?.recoveryTimeScore],
    ])
  })
}

function drawGoal(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  text: string,
  progress: number | null,
): void {
  ctx.font = '500 8px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK.normal
  ctx.fillText(label, 7, y + 7)
  ctx.textAlign = 'right'
  ctx.fillStyle = INK.label
  ctx.fillText(text, W - 7, y + 7)
  ctx.fillStyle = INK.track
  ctx.fillRect(7, y + 10, W - 14, 4)
  if (progress !== null) {
    ctx.fillStyle = INK.bright
    ctx.fillRect(7, y + 10, Math.round((W - 14) * Math.min(1, Math.max(0, progress))), 4)
  }
}

function drawIntensity(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  duration: number | null | undefined,
  max: number,
): void {
  const amount = duration ?? 0
  ctx.font = '500 8px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK.normal
  ctx.fillText(label, 7, y + 7)
  ctx.textAlign = 'right'
  ctx.fillStyle = INK.label
  ctx.fillText(minutes(duration), W - 7, y + 7)
  ctx.fillStyle = INK.track
  ctx.fillRect(57, y + 1, 181, 7)
  ctx.fillStyle = INK.normal
  ctx.fillRect(57, y + 1, Math.round(181 * Math.min(1, amount / max)), 7)
}

export function renderCompactActivityDetails(oura: OuraData): RenderedTile {
  const d = oura.activityDetail
  const units = loadUnitSystem()
  const calorieProgress =
    oura.activeCalories !== null && d?.targetCalories != null && d.targetCalories > 0
      ? oura.activeCalories / d.targetCalories
      : null
  const distanceDone =
    d?.targetMeters != null && d.metersToTarget != null
      ? Math.max(0, d.targetMeters - d.metersToTarget)
      : null
  const distanceProgress =
    distanceDone !== null && d?.targetMeters != null && d.targetMeters > 0
      ? distanceDone / d.targetMeters
      : null
  const maxIntensity = Math.max(
    1,
    d?.highActivityMinutes ?? 0,
    d?.mediumActivityMinutes ?? 0,
    d?.lowActivityMinutes ?? 0,
  )

  return renderCompactTile((ctx) => {
    ctx.fillStyle = INK.normal
    ctx.font = '600 10px Arial, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('ACTIVITY DETAILS', 7, 12)

    drawGoal(
      ctx,
      17,
      'Calorie Goal',
      oura.activeCalories == null || d?.targetCalories == null
        ? '--'
        : `${oura.activeCalories}/${d.targetCalories} kcal`,
      calorieProgress,
    )
    drawGoal(
      ctx,
      36,
      'Distance Goal',
      distanceDone === null || d?.targetMeters == null
        ? '--'
        : `${formatDistance(distanceDone, units)}/${formatDistance(d.targetMeters, units)}`,
      distanceProgress,
    )

    ctx.strokeStyle = INK.rule
    ctx.beginPath()
    ctx.moveTo(7, 56)
    ctx.lineTo(W - 7, 56)
    ctx.stroke()

    drawIntensity(ctx, 62, 'High', d?.highActivityMinutes, maxIntensity)
    drawIntensity(ctx, 80, 'Medium', d?.mediumActivityMinutes, maxIntensity)
    drawIntensity(ctx, 98, 'Low', d?.lowActivityMinutes, maxIntensity)

    const metrics: Array<[string, string]> = [
      ['SEDENTARY', minutes(d?.sedentaryMinutes)],
      ['RESTING', minutes(d?.restingMinutes)],
      ['DISTANCE', formatDistance(d?.equivalentWalkingDistanceMeters ?? null, units)],
    ]
    metrics.forEach(([label, metricValue], index) => {
      const x = 48 + index * 96
      ctx.textAlign = 'center'
      ctx.fillStyle = INK.dim
      ctx.font = '500 7px Arial, sans-serif'
      ctx.fillText(label, x, 126)
      ctx.fillStyle = INK.normal
      ctx.font = '600 9px Arial, sans-serif'
      ctx.fillText(metricValue, x, 139)
    })
  })
}
