import { useCallback, useRef } from 'react'
import type { AppSnapshot } from './selectors'
import { useOuraData } from '../lib/useOuraData'
import { useOuraGlasses } from './useOuraGlasses'

export function AppGlasses() {
  const oura = useOuraData()
  const snapshotRef = useRef<AppSnapshot>({ oura, flashPhase: false })
  snapshotRef.current = { oura, flashPhase: false }
  const getSnapshot = useCallback(() => snapshotRef.current, [])

  useOuraGlasses(getSnapshot)

  return null
}
