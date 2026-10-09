// Shared canvas helpers for the image-rendered glasses screens.
//
// The physical G2 caps image containers at 288x144, so a full-screen (576x288)
// design is drawn on one offscreen canvas and split into four quadrants. Every
// image screen uses the same containers, so switching screens only sends
// changed pixel data without rebuilding the page.
import { encodeTilesBatch } from 'even-toolkit/png-utils'

export const DISPLAY_W = 576
export const DISPLAY_H = 288
export const TILE_W = 288
export const TILE_H = 144

export const IMAGE_TILES = [
  { id: 10, name: 'oura-tl', x: 0, y: 0, crop: { sx: 0, sy: 0, sw: TILE_W, sh: TILE_H } },
  { id: 11, name: 'oura-tr', x: TILE_W, y: 0, crop: { sx: TILE_W, sy: 0, sw: TILE_W, sh: TILE_H } },
  { id: 12, name: 'oura-bl', x: 0, y: TILE_H, crop: { sx: 0, sy: TILE_H, sw: TILE_W, sh: TILE_H } },
  {
    id: 13,
    name: 'oura-br',
    x: TILE_W,
    y: TILE_H,
    crop: { sx: TILE_W, sy: TILE_H, sw: TILE_W, sh: TILE_H },
  },
] as const

export interface RenderedTile {
  id: number
  name: string
  bytes: Uint8Array
  hash: number
}

// Greyscale ramp — everything is quantized to 16 levels before it reaches the
// glasses, so only well-separated values stay distinguishable on hardware.
export const INK = {
  bright: '#ffffff',
  normal: '#e8e8e8',
  label: '#a0a0a0',
  dim: '#777777',
  track: '#3a3a3a',
  rule: '#303030',
}

export const EDGE_X = 18

const FOUR_LEVEL_PALETTE = [0, 64, 160, 255] as const

function quantizeFourLevels(ctx: CanvasRenderingContext2D): void {
  const image = ctx.getImageData(0, 0, DISPLAY_W, DISPLAY_H)
  const pixels = image.data

  for (let index = 0; index < pixels.length; index += 4) {
    const intensity = Math.round(
      (pixels[index]! * 299 + pixels[index + 1]! * 587 + pixels[index + 2]! * 114) / 1000,
    )
    let nearest: number = FOUR_LEVEL_PALETTE[0]
    let distance = Math.abs(intensity - nearest)
    for (const candidate of FOUR_LEVEL_PALETTE.slice(1)) {
      const nextDistance = Math.abs(intensity - candidate)
      if (nextDistance < distance) {
        nearest = candidate
        distance = nextDistance
      }
    }
    pixels[index] = nearest
    pixels[index + 1] = nearest
    pixels[index + 2] = nearest
    pixels[index + 3] = 255
  }

  ctx.putImageData(image, 0, 0)
}

/** Draws a full-screen design and slices it into the four G2 image tiles. */
export function renderTiles(draw: (ctx: CanvasRenderingContext2D) => void): RenderedTile[] {
  const canvas = document.createElement('canvas')
  canvas.width = DISPLAY_W
  canvas.height = DISPLAY_H

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create glasses canvas')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H)
  draw(ctx)
  quantizeFourLevels(ctx)

  const encoded = encodeTilesBatch(
    canvas,
    IMAGE_TILES.map((tile) => ({ crop: tile.crop, name: tile.name })),
    TILE_W,
    TILE_H,
  )

  return IMAGE_TILES.map((tile, index) => ({
    id: tile.id,
    name: tile.name,
    bytes: encoded[index]!.bytes,
    hash: encoded[index]!.hash,
  }))
}

/** Title on the left, gesture hint on the right, with a rule underneath. */
export function drawHeader(ctx: CanvasRenderingContext2D, title: string, hint: string): void {
  ctx.fillStyle = INK.normal
  ctx.font = '600 16px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(title, EDGE_X, 17)

  ctx.fillStyle = INK.dim
  ctx.font = '500 11px Arial, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(hint, DISPLAY_W - EDGE_X, 17)

  ctx.strokeStyle = INK.rule
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(EDGE_X, 33)
  ctx.lineTo(DISPLAY_W - EDGE_X, 33)
  ctx.stroke()
}

/** Oura's score bands, used for the qualitative caption next to a score. */
export function scoreQuality(score: number | null): string {
  if (score === null) return ''
  if (score >= 85) return 'OPTIMAL'
  if (score >= 70) return 'GOOD'
  if (score >= 60) return 'FAIR'
  return 'PAY ATTENTION'
}

/**
 * Large score with its qualitative band beside it, mirroring the phone app's
 * "88 OPTIMAL" treatment. Returns the x where the block ends so callers can
 * lay content out to its right.
 */
export function drawScore(ctx: CanvasRenderingContext2D, score: number | null, baseline: number): number {
  const text = score === null ? '--' : String(score)

  ctx.fillStyle = INK.bright
  ctx.font = '600 46px Arial, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(text, EDGE_X, baseline)
  const scoreWidth = ctx.measureText(text).width

  const quality = scoreQuality(score)
  let end = EDGE_X + scoreWidth
  if (quality) {
    ctx.fillStyle = INK.label
    ctx.font = '600 12px Arial, sans-serif'
    ctx.fillText(quality, end + 8, baseline)
    end += 8 + ctx.measureText(quality).width
  }
  return end
}

/** A "key metric" column: dim caption above a raw value. */
export function drawMetric(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  label: string,
  value: string,
  baseline: number,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = INK.dim
  ctx.font = '500 10px Arial, sans-serif'
  ctx.fillText(label, centerX, baseline - 22)

  ctx.fillStyle = INK.normal
  ctx.font = '600 17px Arial, sans-serif'
  ctx.fillText(value, centerX, baseline)
}

/**
 * A contributor row: label on the left, value on the right, and a full-width
 * progress bar underneath — the core repeating element of Oura's detail pages.
 */
export function drawContributor(
  ctx: CanvasRenderingContext2D,
  y: number,
  label: string,
  value: string,
  progress: number | null,
): void {
  ctx.textBaseline = 'alphabetic'
  ctx.font = '500 12px Arial, sans-serif'

  ctx.fillStyle = INK.normal
  ctx.textAlign = 'left'
  ctx.fillText(label, EDGE_X, y + 12)

  ctx.fillStyle = INK.label
  ctx.textAlign = 'right'
  ctx.fillText(value, DISPLAY_W - EDGE_X, y + 12)

  const barY = y + 18
  const barW = DISPLAY_W - EDGE_X * 2

  ctx.fillStyle = INK.track
  ctx.fillRect(EDGE_X, barY, barW, 4)

  if (progress !== null && progress > 0) {
    ctx.fillStyle = INK.bright
    ctx.fillRect(EDGE_X, barY, Math.round(barW * Math.min(1, progress)), 4)
  }
}
