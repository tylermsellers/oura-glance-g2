/**
 * Returns the advance width of a codepoint in 1/16px units (raw, no kerning).
 * Follows the EvenHub fallback chain: evenroster -> evenroster_crylgrek -> cn -> evenemoji
 */
export declare function getAdvW(cp: number): number;
/**
 * Returns the single-line pixel width of a string (no wrapping, with kerning).
 */
export declare function getTextWidth(text: string): number;
/**
 * Truncates a string to fit within a pixel budget, appending '...' if needed.
 * Uses binary search for efficient fitting.
 *
 * @param text  The string to truncate
 * @param maxPx Maximum width in pixels
 * @returns The original string if it fits, otherwise a truncated string with '...'
 */
export declare function pxTruncate(text: string, maxPx: number): string;
/**
 * Measures text dimensions as rendered by EvenHub SDK.
 * Mirrors LVGL lv_text_get_next_line: per-glyph advance widths are rounded to
 * pixels individually (with kerning) before accumulation — not truncated from a
 * 1/16px sum.
 *
 * @param text The string to measure
 * @param maxWidth Available width for text in pixels (subtract padding/border before calling)
 */
export declare function measureTextWrap(text: string, maxWidth: number): {
    lineCount: number;
    height: number;
    lineWidths: number[];
};
