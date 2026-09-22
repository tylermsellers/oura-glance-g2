// Graphical home dashboard: the three Oura score rings plus the active-calorie
// gauge, styled after the phone app's home screen.
import type { AppSnapshot } from './shared'
import { DISPLAY_W, INK, drawHeader, renderTiles, type RenderedTile } from './glass-image'

function scoreProgress(score: number | null): number {
  if (score === null) return 0
  return Math.max(0, Math.min(1, score / 100))
}

function drawScoreRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  label: string,
  score: number | null,
  selected: boolean,
) {
  const y = 80
  const radius = 29

  ctx.lineCap = 'round'
  ctx.strokeStyle = '#383838'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = selected ? INK.bright : '#b0b0b0'
  ctx.lineWidth = selected ? 5 : 4
  ctx.beginPath()
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * scoreProgress(score))
  ctx.stroke()

  ctx.fillStyle = '#f2f2f2'
  ctx.font = '600 23px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(score === null ? '--' : String(score), x, y + 1)

  ctx.fillStyle = selected ? INK.bright : INK.label
  ctx.font = '600 13px Arial, sans-serif'
  ctx.fillText(label.toUpperCase(), x, 124)

  if (selected) {
    ctx.fillStyle = INK.bright
    ctx.beginPath()
    ctx.moveTo(x, 134)
    ctx.lineTo(x - 5, 141)
    ctx.lineTo(x + 5, 141)
    ctx.closePath()
    ctx.fill()
  }
}

function drawCaloriesGauge(ctx: CanvasRenderingContext2D, snapshot: AppSnapshot) {
  const active = snapshot.oura.activeCalories
  const target = snapshot.oura.activityDetail?.targetCalories ?? null
  const progress =
    active !== null && target !== null && target > 0
      ? Math.max(0, Math.min(1, active / target))
      : 0

  const centerX = DISPLAY_W / 2
  const centerY = 310
  const radius = 165
  const startAngle = Math.PI * 1.15
  const arcLength = Math.PI * 0.7
  const progressAngle = startAngle + arcLength * progress

  ctx.lineCap = 'round'
  ctx.strokeStyle = '#242424'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, startAngle, startAngle + arcLength)
  ctx.stroke()

  ctx.strokeStyle = INK.normal
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, startAngle, progressAngle)
  ctx.stroke()

  if (progress > 0) {
    const markerX = centerX + Math.cos(progressAngle) * radius
    const markerY = centerY + Math.sin(progressAngle) * radius
    ctx.fillStyle = INK.bright
    ctx.beginPath()
    ctx.arc(markerX, markerY, 6, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = INK.dim
  ctx.font = '500 12px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ACTIVE CALORIES', centerX, 190)

  ctx.fillStyle = INK.bright
  ctx.font = '600 38px Arial, sans-serif'
  ctx.fillText(active === null ? '--' : String(active), centerX, 222)

  ctx.fillStyle = '#a8a8a8'
  ctx.font = '500 13px Arial, sans-serif'
  const percent = target !== null ? Math.round(progress * 100) : null
  ctx.fillText(
    target === null || percent === null ? 'KCAL' : `${percent}% OF ${target} KCAL`,
    centerX,
    250,
  )
}

export function renderOuraDashboard(snapshot: AppSnapshot, selectedIndex: number): RenderedTile[] {
  return renderTiles((ctx) => {
    drawHeader(ctx, 'OURA', 'SWIPE TO SELECT   TAP TO OPEN')

    drawScoreRing(ctx, 108, 'Readiness', snapshot.oura.readinessScore, selectedIndex === 0)
    drawScoreRing(ctx, 288, 'Sleep', snapshot.oura.sleepScore, selectedIndex === 1)
    drawScoreRing(ctx, 468, 'Activity', snapshot.oura.activityScore, selectedIndex === 2)
    drawCaloriesGauge(ctx, snapshot)
  })
}
