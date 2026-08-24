import type { DisplayData, DisplayLine } from 'even-toolkit/types'
import { line, glassHeader } from 'even-toolkit/types'
import { DEFAULT_CONTENT_SLOTS } from 'even-toolkit/glass-display-builders'

// A real scrollbar column (track + thumb), appended to the right edge of
// each visible content line, rather than sacrificing a whole line's text to
// show a single ▲/▼ arrow (as even-toolkit's buildScrollableContent does).
// Track char: '\u2502' (│), thumb char: '\u2588' (█).
const TRACK_CHAR = '\u2502'
const THUMB_CHAR = '\u2588'

/**
 * Compute which of the `visibleCount` rows should render as the scrollbar
 * "thumb" for a window starting at `start` out of `total` content lines.
 * Thumb size is proportional to the visible fraction of the content (min 1 row).
 */
export function buildScrollbarRows(total: number, visibleCount: number, start: number): boolean[] {
  if (total <= visibleCount) return new Array(visibleCount).fill(true)

  const thumbSize = Math.max(1, Math.round((visibleCount * visibleCount) / total))
  const maxStart = total - visibleCount
  const thumbStart = maxStart === 0 ? 0 : Math.round((start / maxStart) * (visibleCount - thumbSize))

  return Array.from({ length: visibleCount }, (_, i) => i >= thumbStart && i < thumbStart + thumbSize)
}

export interface ScrollableContentWithBarOptions {
  title: string
  actionBar: string
  contentLines: string[]
  scrollPos: number
  contentSlots?: number
  contentStyle?: 'normal' | 'meta'
}

/**
 * Same layout as even-toolkit's buildScrollableContent, but renders a
 * persistent vertical scrollbar (track + thumb) in the right margin of the
 * content lines instead of replacing the top/bottom line's text with a
 * single ▲/▼ arrow. Keeps all content text visible while still showing
 * scroll position and how much more content there is.
 */
export function buildScrollableContentWithBar(opts: ScrollableContentWithBarOptions): DisplayData {
  const {
    title,
    actionBar,
    contentLines,
    scrollPos,
    contentSlots = DEFAULT_CONTENT_SLOTS,
    contentStyle = 'meta',
  } = opts

  const lines = [...glassHeader(title, actionBar)]

  const start = Math.max(0, Math.min(scrollPos, Math.max(0, contentLines.length - contentSlots)))
  const visible = contentLines.slice(start, start + contentSlots)
  const thumbRows = buildScrollbarRows(contentLines.length, visible.length, start)

  const contentDisplayLines: DisplayLine[] = visible.map((text, i) => {
    const showBar = contentLines.length > contentSlots
    const bar = showBar ? ` ${thumbRows[i] ? THUMB_CHAR : TRACK_CHAR}` : ''
    return line(`${text}${bar}`, contentStyle, false)
  })

  lines.push(...contentDisplayLines)

  return { lines }
}
