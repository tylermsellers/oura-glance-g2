import { useEffect, useRef } from 'react'
import {
  ImageRawDataUpdate,
  OsEventTypeList,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { EvenHubBridge } from 'even-toolkit/bridge'
import { bindKeyboard } from 'even-toolkit/keyboard'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { renderTextPageLines, type GlassAction, type GlassNavState } from 'even-toolkit/types'
import { onGlassAction, toDisplayData } from './selectors'
import type { AppActions, AppSnapshot } from './shared'
import { renderOuraSummary, SUMMARY_TILE } from './oura-summary'

const HOME_SCREEN = 'home'
const METRIC_COUNT = 3

function hasDashboardData(snapshot: AppSnapshot): boolean {
  const { oura } = snapshot
  return (
    oura.connected &&
    !oura.error &&
    (oura.readinessScore !== null || oura.sleepScore !== null || oura.activityScore !== null)
  )
}

function snapshotKey(snapshot: AppSnapshot): string {
  return JSON.stringify(snapshot.oura)
}

function eventToAction(event: EvenHubEvent): GlassAction | null {
  const textEventType = event.textEvent?.eventType
  if (textEventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    return { type: 'HIGHLIGHT_MOVE', direction: 'up' }
  }
  if (textEventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    return { type: 'HIGHLIGHT_MOVE', direction: 'down' }
  }

  if (event.listEvent) {
    return { type: 'SELECT_HIGHLIGHTED' }
  }

  if (event.sysEvent) {
    const rawEventType = event.sysEvent.eventType
    const eventType =
      typeof rawEventType === 'string'
        ? OsEventTypeList.fromJson(rawEventType)
        : (rawEventType ?? OsEventTypeList.CLICK_EVENT)

    if (eventType === OsEventTypeList.CLICK_EVENT) return { type: 'SELECT_HIGHLIGHTED' }
    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) return { type: 'GO_BACK' }
  }

  return null
}

function homeText(snapshot: AppSnapshot, selection: number): string {
  const { oura } = snapshot
  const rows = [
    ['Readiness', oura.readinessScore],
    ['Sleep', oura.sleepScore],
    ['Activity', oura.activityScore],
  ] as const

  return [
    'OURA   Swipe: Select   Tap: Open',
    ...rows.map(
      ([label, score], index) =>
        `${index === selection ? '>' : ' '} ${label.padEnd(10)} ${score ?? '--'}`,
    ),
  ].join('\n')
}

export function useOuraGlasses(getSnapshot: () => AppSnapshot) {
  const getSnapshotRef = useRef(getSnapshot)
  getSnapshotRef.current = getSnapshot

  useEffect(() => {
    let disposed = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let renderBusy = false
    let renderPending = false
    let layout: 'home' | 'text' | null = null
    let lastSnapshotKey = ''
    let lastRenderedDataKey = ''
    let lastHomeText = ''
    let summaryHash: number | null = null
    let lastActionKey = ''
    let lastActionTime = 0

    const hub = new EvenHubBridge()
    const navRef: { current: GlassNavState } = {
      current: { screen: HOME_SCREEN, highlightedIndex: 0 },
    }
    const actions: AppActions = { navigate: () => undefined }

    async function render() {
      if (disposed) return
      if (renderBusy) {
        renderPending = true
        return
      }

      renderBusy = true
      renderPending = false

      try {
        const snapshot = getSnapshotRef.current()
        const nav = navRef.current

        if (nav.screen === HOME_SCREEN && hasDashboardData(snapshot)) {
          const selection =
            ((nav.highlightedIndex % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
          const nextHomeText = homeText(snapshot, selection)
          const dataKey = snapshotKey(snapshot)
          const needsRebuild = layout !== 'home'

          if (needsRebuild) {
            await hub.showHomePage(nextHomeText, [SUMMARY_TILE])
            layout = 'home'
            lastHomeText = nextHomeText
            summaryHash = null
          } else if (nextHomeText !== lastHomeText) {
            await hub.updateHomeText(nextHomeText)
            lastHomeText = nextHomeText
          }

          if ((needsRebuild || dataKey !== lastRenderedDataKey) && hub.rawBridge) {
            const summary = renderOuraSummary(snapshot)
            if (summary.hash !== summaryHash) {
              await hub.rawBridge.updateImageRawData(
                new ImageRawDataUpdate({
                  containerID: summary.id,
                  containerName: summary.name,
                  imageData: summary.bytes,
                }),
              )
              summaryHash = summary.hash
            }
          }
          lastRenderedDataKey = dataKey
        } else {
          const content = renderTextPageLines(toDisplayData(snapshot, nav).lines)
          if (layout === 'text') {
            await hub.updateText(content)
          } else {
            await hub.showTextPage(content)
            layout = 'text'
          }
          lastRenderedDataKey = ''
          lastHomeText = ''
          summaryHash = null
        }
      } catch (error) {
        console.error('Failed to render Oura glasses UI', error)
      } finally {
        renderBusy = false
        if (renderPending) void render()
      }
    }

    function handleAction(action: GlassAction) {
      if (disposed) return
      void (async () => {
        if (disposed) return
        if (action.type === 'GO_BACK' && navRef.current.screen === HOME_SCREEN) {
          await hub.showShutdownContainer(1)
          return
        }

        if (navRef.current.screen === HOME_SCREEN && action.type === 'HIGHLIGHT_MOVE') {
          const current =
            ((navRef.current.highlightedIndex % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
          const delta = action.direction === 'down' ? 1 : -1
          navRef.current = {
            ...navRef.current,
            highlightedIndex: (current + delta + METRIC_COUNT) % METRIC_COUNT,
          }
        } else {
          navRef.current = onGlassAction(
            action,
            navRef.current,
            getSnapshotRef.current(),
            actions,
          )
        }
        await render()
      })()
    }

    async function initialize() {
      try {
        await hub.init()
        if (disposed) return

        await hub.showTextPage('\n\n      OURA')
        if (disposed) return

        hub.onEvent((event) => {
          if (disposed) return
          const action = eventToAction(event)
          if (!action) return

          const actionKey =
            action.type === 'HIGHLIGHT_MOVE' ? `${action.type}:${action.direction}` : action.type
          const now = Date.now()
          if (actionKey === lastActionKey && now - lastActionTime < 150) return
          lastActionKey = actionKey
          lastActionTime = now

          if (action) handleAction(action)
        })

        await render()
        lastSnapshotKey = snapshotKey(getSnapshotRef.current())
        pollTimer = setInterval(() => {
          const nextKey = snapshotKey(getSnapshotRef.current())
          if (nextKey === lastSnapshotKey) return
          lastSnapshotKey = nextKey
          void render()
        }, 250)
      } catch (error) {
        console.error('Failed to initialize Oura glasses UI', error)
      }
    }

    void initialize()
    const unbindKeyboard = bindKeyboard(handleAction)
    activateKeepAlive('OURA_keep_alive')

    return () => {
      disposed = true
      if (pollTimer) clearInterval(pollTimer)
      unbindKeyboard()
      hub.dispose()
      deactivateKeepAlive()
    }
  }, [])
}
