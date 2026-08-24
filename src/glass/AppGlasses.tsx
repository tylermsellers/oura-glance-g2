import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { waitForEvenAppBridge, OsEventTypeList } from '@evenrealities/even_hub_sdk'
import { appSplash } from './splash'
import { toDisplayData, onGlassAction, type AppSnapshot } from './selectors'
import type { AppActions } from './shared'
import { useOuraData } from '../lib/useOuraData'

const deriveScreen = createScreenMapper([
  { pattern: '/', screen: 'home' },
], 'home')

const homeTiles = getHomeTiles(appSplash)

export function AppGlasses() {
  const navigate = useNavigate()
  const location = useLocation()
  const flashPhase = useFlashPhase(deriveScreen(location.pathname) === 'home')
  const oura = useOuraData()

  const snapshotRef = useMemo(() => ({
    current: null as AppSnapshot | null,
  }), [])

  const snapshot: AppSnapshot = {
    oura,
    flashPhase,
  }
  snapshotRef.current = snapshot

  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  const ctxRef = useRef<AppActions>({ navigate })
  ctxRef.current = { navigate }

  const handleGlassAction = useCallback(
    (action: Parameters<typeof onGlassAction>[0], nav: Parameters<typeof onGlassAction>[1], snap: AppSnapshot) =>
      onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  useGlasses({
    getSnapshot,
    toDisplayData,
    onGlassAction: handleGlassAction,
    deriveScreen,
    appName: 'OURA',
    splash: appSplash,
    getPageMode: (screen) => screen === 'home' ? 'home' : 'text',
    homeImageTiles: homeTiles,
  })

  // Safety net for root-page double-tap exit (Even Hub QA requirement).
  //
  // even-toolkit's built-in gesture mapper only recognizes numeric
  // `sysEvent.eventType` values (e.g. `3` for DOUBLE_CLICK_EVENT). Newer Even
  // App builds can report `eventType` as a string ("DOUBLE_CLICK_EVENT" or
  // "DOUBLE_CLICK") instead — see OsEventTypeList.fromJson in
  // @evenrealities/even_hub_sdk 0.0.14+. When that happens, the toolkit's raw
  // numeric switch silently drops the gesture and double-tap does nothing at
  // the root page. This listener normalizes the raw eventType with
  // `fromJson` and explicitly shows the system exit dialog whenever it
  // resolves to DOUBLE_CLICK_EVENT, so the app still complies even if the
  // host starts sending the string form.
  const isRootRef = useRef(deriveScreen(location.pathname) === 'home')
  isRootRef.current = deriveScreen(location.pathname) === 'home'

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let disposed = false

    waitForEvenAppBridge().then((bridge) => {
      if (disposed) return
      unsubscribe = bridge.onEvenHubEvent((event) => {
        const rawEventType = event.sysEvent?.eventType
        // Numeric eventType is already handled by even-toolkit's gesture
        // mapper — only step in for the string form it doesn't understand.
        if (typeof rawEventType !== 'string') return
        if (!isRootRef.current) return
        if (OsEventTypeList.fromJson(rawEventType) === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          void bridge.shutDownPageContainer(1)
        }
      })
    }).catch(() => {
      // SDK unavailable (e.g. running outside Even App WebView) — no-op.
    })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [])

  return null
}
