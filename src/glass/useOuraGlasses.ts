import { useEffect, useRef } from 'react'
import {
  ImageContainerProperty,
  ImageRawDataUpdate,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerProperty,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { EvenHubBridge } from 'even-toolkit/bridge'
import { bindKeyboard } from 'even-toolkit/keyboard'
import { activateKeepAlive, deactivateKeepAlive } from 'even-toolkit/keep-alive'
import { renderTextPageLines, type GlassAction, type GlassNavState } from 'even-toolkit/types'
import { onGlassAction, toDisplayData } from './selectors'
import type { AppActions, AppSnapshot } from './shared'
import { HOME_IMAGE_TILES, renderOuraDashboard } from './oura-dashboard'
import { hasReadinessDetail, renderReadinessDetail } from './readiness-detail-image'
import { hasSleepDetail, renderSleepDetail } from './sleep-detail-image'
import { hasActivityDetail, renderActivityDetail } from './activity-detail-image'
import { IMAGE_TILES, TILE_H, TILE_W } from './glass-image'
import type { RenderedTile } from './glass-image'

const HOME_SCREEN = 'home'
const READINESS_SCREEN = 'readiness-detail'
const SLEEP_SCREEN = 'sleep-detail'
const ACTIVITY_SCREEN = 'activity-detail'
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

interface ImageTileLayout {
  id: number
  name: string
  x: number
  y: number
  w: number
  h: number
}

interface ImageScreen {
  key: string
  layout: 'home' | 'detail'
  tiles: readonly ImageTileLayout[]
  render: () => RenderedTile[]
}

const DETAIL_IMAGE_TILES: readonly ImageTileLayout[] = IMAGE_TILES.map((tile) => ({
  id: tile.id,
  name: tile.name,
  x: tile.x,
  y: tile.y,
  w: TILE_W,
  h: TILE_H,
}))

function imageScreenFor(snapshot: AppSnapshot, nav: GlassNavState): ImageScreen | null {
  const { oura } = snapshot

  if (nav.screen === HOME_SCREEN && hasDashboardData(snapshot)) {
    const selection = ((nav.highlightedIndex % METRIC_COUNT) + METRIC_COUNT) % METRIC_COUNT
    return {
      key: `${HOME_SCREEN}:${selection}`,
      layout: 'home',
      tiles: HOME_IMAGE_TILES,
      render: () => renderOuraDashboard(snapshot, selection),
    }
  }

  if (nav.screen === READINESS_SCREEN && hasReadinessDetail(oura)) {
    return {
      key: READINESS_SCREEN,
      layout: 'detail',
      tiles: DETAIL_IMAGE_TILES,
      render: () => renderReadinessDetail(oura),
    }
  }

  if (nav.screen === SLEEP_SCREEN && hasSleepDetail(oura)) {
    const page = nav.highlightedIndex > 0 ? 1 : 0
    return {
      key: `${SLEEP_SCREEN}:${page}`,
      layout: 'detail',
      tiles: DETAIL_IMAGE_TILES,
      render: () => renderSleepDetail(oura, page),
    }
  }

  if (nav.screen === ACTIVITY_SCREEN && hasActivityDetail(oura)) {
    const page = nav.highlightedIndex > 0 ? 1 : 0
    return {
      key: `${ACTIVITY_SCREEN}:${page}`,
      layout: 'detail',
      tiles: DETAIL_IMAGE_TILES,
      render: () => renderActivityDetail(oura, page),
    }
  }

  return null
}

async function rebuildImageLayout(hub: EvenHubBridge, tiles: readonly ImageTileLayout[]) {
  const bridge = hub.rawBridge
  if (!bridge) return

  await hub.showHomePage(' ', [...tiles])
  await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 1 + tiles.length,
      textObject: [
        new TextContainerProperty({
          containerID: 1,
          containerName: 'oura-events',
          xPosition: 0,
          yPosition: 0,
          width: 576,
          height: 288,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 0,
          content: ' ',
          isEventCapture: 1,
        }),
      ],
      imageObject: tiles.map(
        (tile) =>
          new ImageContainerProperty({
            containerID: tile.id,
            containerName: tile.name,
            xPosition: tile.x,
            yPosition: tile.y,
            width: tile.w,
            height: tile.h,
          }),
      ),
    }),
  )
}

export function useOuraGlasses(getSnapshot: () => AppSnapshot) {
  const getSnapshotRef = useRef(getSnapshot)
  getSnapshotRef.current = getSnapshot

  useEffect(() => {
    let disposed = false
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let renderBusy = false
    let renderPending = false
    let layout: 'home' | 'detail' | 'text' | null = null
    let lastSnapshotKey = ''
    let lastRenderedDataKey = ''
    let tileHashes = new Map<number, number>()
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
        const imageScreen = imageScreenFor(snapshot, nav)

        if (imageScreen) {
          const dataKey = `${imageScreen.key}|${snapshotKey(snapshot)}`
          const needsRebuild = layout !== imageScreen.layout

          if (needsRebuild) {
            await rebuildImageLayout(hub, imageScreen.tiles)
            layout = imageScreen.layout
            tileHashes = new Map()
          }

          if ((needsRebuild || dataKey !== lastRenderedDataKey) && hub.rawBridge) {
            const tiles = imageScreen.render()
            for (const tile of tiles) {
              if (!needsRebuild && tileHashes.get(tile.id) === tile.hash) continue
              await hub.rawBridge.updateImageRawData(
                new ImageRawDataUpdate({
                  containerID: tile.id,
                  containerName: tile.name,
                  imageData: tile.bytes,
                }),
              )
              tileHashes.set(tile.id, tile.hash)
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
          tileHashes = new Map()
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
        } else if (
          (navRef.current.screen === SLEEP_SCREEN ||
            navRef.current.screen === ACTIVITY_SCREEN) &&
          action.type === 'HIGHLIGHT_MOVE'
        ) {
          const current = navRef.current.highlightedIndex > 0 ? 1 : 0
          navRef.current = {
            ...navRef.current,
            highlightedIndex:
              action.direction === 'down' ? Math.min(1, current + 1) : Math.max(0, current - 1),
          }
        } else if (
          navRef.current.screen === READINESS_SCREEN &&
          action.type === 'HIGHLIGHT_MOVE'
        ) {
          return
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
