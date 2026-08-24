// Unit system preference (Imperial vs Metric), persisted durably via
// persistentStorage (see that module for why plain browser localStorage
// isn't reliable in the Even Hub host's WebView). Affects distance (meters
// -> km or mi) and temperature (deviation is already a delta in °C from
// Oura; we convert to a °F delta when Imperial is selected).
//
// Several call sites (the glass-screen renderers) need a synchronous read,
// so we keep an in-memory cache alongside the async persistent store:
// `hydrateUnitSystem()` loads the durable value once at startup and updates
// the cache; `loadUnitSystem()` stays synchronous, reading whatever the
// cache currently holds (defaulting to 'metric' before hydration completes).
import { getPersistent, setPersistent } from './persistentStorage'

const UNITS_STORAGE_KEY = 'oura_glance_units'

export type UnitSystem = 'metric' | 'imperial'

let cachedUnits: UnitSystem = 'metric'

/** Loads the persisted preference once (e.g. at app startup) and updates the
 *  in-memory cache that loadUnitSystem() reads synchronously. */
export async function hydrateUnitSystem(): Promise<UnitSystem> {
  try {
    const raw = await getPersistent(UNITS_STORAGE_KEY)
    cachedUnits = raw === 'imperial' ? 'imperial' : 'metric'
  } catch {
    cachedUnits = 'metric'
  }
  return cachedUnits
}

/** Synchronous read of the last-known preference (see module docs above). */
export function loadUnitSystem(): UnitSystem {
  return cachedUnits
}

export function saveUnitSystem(units: UnitSystem) {
  cachedUnits = units
  setPersistent(UNITS_STORAGE_KEY, units).catch(() => {
    // Non-fatal — the in-memory/UI state still reflects the change.
  })
}

/** Format minutes as "Xh Ym" (or "Ym" if under an hour). */
export function formatHoursMinutes(totalMinutes: number | null): string {
  if (totalMinutes === null) return '--'
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

/** Format a distance in meters according to the given unit system. */
export function formatDistance(meters: number | null, units: UnitSystem): string {
  if (meters === null) return '--'
  if (units === 'imperial') {
    const miles = meters / 1609.344
    return `${miles.toFixed(2)} mi`
  }
  const km = meters / 1000
  return `${km.toFixed(2)} km`
}

/** Format a temperature deviation in °C according to the given unit system. */
export function formatTempDeviation(celsiusDelta: number | null, units: UnitSystem): string {
  if (celsiusDelta === null) return '--'
  if (units === 'imperial') {
    // Convert a *delta* (not absolute temperature) — no +32 offset.
    const fahrenheitDelta = celsiusDelta * (9 / 5)
    const sign = fahrenheitDelta > 0 ? '+' : ''
    return `${sign}${fahrenheitDelta.toFixed(1)}°F`
  }
  const sign = celsiusDelta > 0 ? '+' : ''
  return `${sign}${celsiusDelta.toFixed(1)}°C`
}
