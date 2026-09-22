import { encodeTilesBatch } from 'even-toolkit/png-utils'
import type { AppSnapshot } from './shared'
import { INK, type RenderedTile } from './glass-image'

export const SUMMARY_TILE = {
  id: 10,
  name: 'oura-summary',
  x: 144,
  y: 0,
  w: 288,
  h: 144,
} as const

function scoreProgress(score: number | null): number {
  if (score === null) return 0
  return Math.max(0, Math.min(1, score / 100))
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  label: string,
  score: number | null,
): void {
  const y = 31
  const radius = 20

  ctx.lineCap = 'round'
  ctx.strokeStyle = '#383838'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = INK.normal
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * scoreProgress(score))
  ctx.stroke()

  ctx.fillStyle = INK.bright
  ctx.font = '600 16px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(score === null ? '--' : String(score), x, y)

  ctx.fillStyle = INK.label
  ctx.font = '600 9px Arial, sans-serif'
  ctx.fillText(label, x, 61)
}

function drawCalories(ctx: CanvasRenderingContext2D, snapshot: AppSnapshot): void {
  const active = snapshot.oura.activeCalories
  const target = snapshot.oura.activityDetail?.targetCalories ?? null
  const progress =
    active !== null && target !== null && target > 0
      ? Math.max(0, Math.min(1, active / target))
      : 0

  const centerX = 144
  const centerY = 170
  const radius = 70
  const startAngle = Math.PI * 1.18
  const arcLength = Math.PI * 0.64
  const progressAngle = startAngle + arcLength * progress

  ctx.lineCap = 'round'
  ctx.strokeStyle = '#303030'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, startAngle, startAngle + arcLength)
  ctx.stroke()

  ctx.strokeStyle = INK.normal
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, startAngle, progressAngle)
  ctx.stroke()

  // Open a clean label area inside the gauge instead of drawing text through
  // the arc. The surrounding black pixels compress efficiently over BLE.
  ctx.fillStyle = '#000000'
  ctx.fillRect(105, 67, 78, 67)

  ctx.fillStyle = INK.dim
  ctx.font = '500 9px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ACTIVE CALORIES', centerX, 73)

  ctx.fillStyle = INK.bright
  ctx.font = '600 25px Arial, sans-serif'
  ctx.fillText(active === null ? '--' : String(active), centerX, 94)

  ctx.fillStyle = INK.label
  ctx.font = '500 10px Arial, sans-serif'
  const percent = target === null ? null : Math.round(progress * 100)
  ctx.fillText(
    target === null || percent === null ? 'KCAL' : `${percent}% OF ${target} KCAL`,
    centerX,
    119,
  )
}

export function renderCompactTile(
  draw: (ctx: CanvasRenderingContext2D) => void,
): RenderedTile {
  const canvas = document.createElement('canvas')
  canvas.width = SUMMARY_TILE.w
  canvas.height = SUMMARY_TILE.h

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create Oura summary canvas')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  draw(ctx)

  const [encoded] = encodeTilesBatch(
    canvas,
    [{ crop: { sx: 0, sy: 0, sw: SUMMARY_TILE.w, sh: SUMMARY_TILE.h }, name: SUMMARY_TILE.name }],
    SUMMARY_TILE.w,
    SUMMARY_TILE.h,
  )

  if (!encoded) throw new Error('Unable to encode Oura summary')

  return {
    id: SUMMARY_TILE.id,
    name: SUMMARY_TILE.name,
    bytes: encoded.bytes,
    hash: encoded.hash,
  }
}

export function renderOuraSummary(snapshot: AppSnapshot): RenderedTile {
  return renderCompactTile((ctx) => {
    drawRing(ctx, 48, 'READINESS', snapshot.oura.readinessScore)
    drawRing(ctx, 144, 'SLEEP', snapshot.oura.sleepScore)
    drawRing(ctx, 240, 'ACTIVITY', snapshot.oura.activityScore)
    drawCalories(ctx, snapshot)
  })
}
