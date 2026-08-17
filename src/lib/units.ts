// Unit system preference (Imperial vs Metric), persisted to localStorage.
// Affects distance (meters -> km or mi) and temperature (deviation is already
// a delta in °C from Oura; we convert to a °F delta when Imperial is selected).

const UNITS_STORAGE_KEY = 'oura_glance_units'

export type UnitSystem = 'metric' | 'imperial'

export function loadUnitSystem(): UnitSystem {
  try {
    const raw = localStorage.getItem(UNITS_STORAGE_KEY)
    return raw === 'imperial' ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

export function saveUnitSystem(units: UnitSystem) {
  localStorage.setItem(UNITS_STORAGE_KEY, units)
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
