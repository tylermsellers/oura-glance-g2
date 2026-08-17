import { createSplash, TILE_PRESETS } from 'even-toolkit/splash'

export function renderSplash(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const fg = '#e0e0e0'
  const cx = w / 2
  const s = Math.min(w / 200, h / 100)

  // Short bar above the ring — matches the Oura ring-mark logo
  ctx.strokeStyle = fg
  ctx.lineWidth = 3 * s
  ctx.beginPath()
  ctx.moveTo(cx - 10 * s, 30 * s)
  ctx.lineTo(cx + 10 * s, 30 * s)
  ctx.stroke()

  // Ring logo — simple ring outline below the bar
  const ringCy = 60 * s
  const ringR = 16 * s
  ctx.strokeStyle = fg
  ctx.lineWidth = 4 * s
  ctx.beginPath()
  ctx.arc(cx, ringCy, ringR, 0, Math.PI * 2)
  ctx.stroke()
}

export const appSplash = createSplash({
  tiles: 1,
  tileLayout: 'vertical',
  tilePositions: TILE_PRESETS.topCenter1,
  canvasSize: { w: 200, h: 100 },
  minTimeMs: 0,
  maxTimeMs: 0,
  menuText: '',
  render: renderSplash,
})
