/**
 * シミュレーションの操作フロー制御。
 * UIコンポーネントはここの関数を呼ぶだけにし、Worker呼び出しの
 * 直列化(ドラッグ中のフレーム間引き)と状態遷移をここに集約する。
 *
 * ドラッグは確定計算と同じ高解像度グリッドの差分更新で行う
 * (荒いプレビューを挟まない)。Workerプールは常に「現在の島の状態」
 * の計算結果を保持しており、ドラッグ開始時の再計算は不要。
 */
import {
  loadBaseline,
  requestCompute,
  requestComputeDetached,
  requestUpdate,
} from '../engine/client'
import { resolveBaseline } from '../engine/eezEngine'
import { haversineKm } from '../engine/geo'
import { COUNTRY_COLORS, COUNTRY_NAMES_JA } from '../lib/config'
import type {
  BaselineFile,
  EezResult,
  IslandDef,
  PointsByCountry,
} from '../engine/types'
import { CONTRIB_GRID, INFLUENCE_RADIUS_KM, SIM_GRID } from '../lib/simConfig'
import { islandDefs, useAppStore } from '../store/useAppStore'

/**
 * Workerプールの保持状態がストアの島の状態とずれているか。
 * リセット直後など、次のドラッグ/計算の前に全域計算が必要なら true
 */
let poolDirty = true

/** オーバーレイにまだ描かれていないグリッド矩形(行・列インデックス) */
type DirtyRect = NonNullable<EezResult['dirty']>
let pendingDirty: DirtyRect | null = null

/**
 * 結果をUIへ渡す唯一の入口。
 * ドラッグ中は結果が毎フレーム届くが、Reactは連続したsetStateを
 * まとめて1回しか再描画しないことがある。そのとき間引かれた結果の
 * dirty矩形は誰にも描かれないまま消え、矩形の縁でスパッと切れた
 * 残像になる。ここで和を取り、描画側が消費するまで持ち越す。
 */
function publishResult(result: EezResult): void {
  const d = result.dirty
  if (d) {
    pendingDirty = pendingDirty
      ? {
          r0: Math.min(pendingDirty.r0, d.r0),
          r1: Math.max(pendingDirty.r1, d.r1),
          c0: Math.min(pendingDirty.c0, d.c0),
          c1: Math.max(pendingDirty.c1, d.c1),
        }
      : { ...d }
  }
  useAppStore.getState().setSimResult(result)
}

/** 未描画の矩形を取り出して消す(オーバーレイ描画側が呼ぶ) */
export function consumeDirty(): DirtyRect | null {
  const d = pendingDirty
  pendingDirty = null
  return d
}

/** アプリ起動時に基線データを読み込む */
export async function initBaseline(): Promise<void> {
  const store = useAppStore.getState()
  if (store.baseline) return
  store.setBaseline(await loadBaseline())
}

/** baseline+サンドボックス島を合わせた解決用ファイル */
function resolvedFile(): BaselineFile {
  const s = useAppStore.getState()
  if (!s.baseline) throw new Error('baseline not loaded')
  return { ...s.baseline, islands: islandDefs(s) }
}

/** 現在のストア状態を国別点群に解決する */
function currentPoints(): PointsByCountry {
  const { islands, disputedOwners } = useAppStore.getState()
  return resolveBaseline(resolvedFile(), { islands, disputedOwners })
}

/** 島の現在の帰属(状態の上書き→定義の既定の順) */
function effectiveOwner(id: string): string | null {
  const s = useAppStore.getState()
  return s.islands[id]?.owner ?? islandDefs(s)[id]?.owner ?? null
}

/** 現実そのまま(サンドボックス島なし・全島ON・現実位置・既定帰属)か */
function isDefaultState(): boolean {
  const { baseline, islands, customIslands, disputedOwners } = useAppStore.getState()
  if (!baseline) return false
  if (Object.keys(customIslands).length > 0) return false
  // 係争地域の帰属がどれか既定と違えば非既定
  const disputeChanged = Object.entries(disputedOwners).some(
    ([id, owner]) => owner !== baseline.disputed[id]?.defaultOwner,
  )
  if (disputeChanged) return false
  return Object.entries(baseline.islands).every(([id, isl]) => {
    const st = islands[id]
    return (
      st &&
      st.enabled &&
      st.lon === isl.anchor[0] &&
      st.lat === isl.anchor[1] &&
      (st.owner ?? isl.owner) === isl.owner
    )
  })
}

/** 増減表示の基準(全島ON・現実位置の各国面積)を裏で一度だけ計算する */
async function ensureDefaultArea(): Promise<void> {
  const { baseline, defaultSimAreasKm2 } = useAppStore.getState()
  if (defaultSimAreasKm2 !== null || !baseline) return
  const r = await requestComputeDetached(resolveBaseline(baseline), SIM_GRID)
  useAppStore.getState().setDefaultSimAreas(r.areaKm2)
}

/** 高解像度の確定計算(Workerプールを現在状態に同期させる) */
export async function runFullSim(): Promise<void> {
  const store = useAppStore.getState()
  store.setSimRunning(true)
  const result = await requestCompute(currentPoints(), SIM_GRID)
  poolDirty = false
  publishResult(result)
  store.setMode('sim')

  if (isDefaultState()) {
    if (useAppStore.getState().defaultSimAreasKm2 === null) {
      useAppStore.getState().setDefaultSimAreas(result.areaKm2)
    }
  } else {
    void ensureDefaultArea()
  }
}

/** 実データ表示に戻す(島の状態は維持) */
export function showRealData(): void {
  useAppStore.getState().setMode('real')
}

/** 島のON/OFF切替 → 確定計算 */
export async function toggleIsland(id: string): Promise<void> {
  const store = useAppStore.getState()
  store.setIslandState(id, { enabled: !store.islands[id].enabled })
  await runFullSim()
}

/** 島の帰属(支配国)を変更 → 確定計算 */
export async function setIslandOwner(
  id: string,
  owner: string | null,
): Promise<void> {
  useAppStore.getState().setIslandState(id, { owner })
  poolDirty = true // 静的点群の構成が変わるので全域再計算が要る
  await runFullSim()
}

/**
 * 係争地域(北方領土・竹島・尖閣)の帰属を切り替える → 確定計算。
 * その地域に属する島(択捉島など)の帰属も連動させる。
 */
export async function setDisputeOwner(id: string, owner: string): Promise<void> {
  const store = useAppStore.getState()
  store.setDisputedOwner(id, owner)
  for (const [iid, def] of Object.entries(islandDefs(store))) {
    if (def.disputeId === id) store.setIslandState(iid, { owner })
  }
  poolDirty = true
  await runFullSim()
}

/** 空白地点に仮想の島を新設 → 選択して確定計算。返り値は生成id */
export async function addIslandAt(
  lon: number,
  lat: number,
  owner: string = 'Japan',
): Promise<string> {
  const def: IslandDef = {
    nameJa: `新しい島(${COUNTRY_NAMES_JA[owner] ?? owner})`,
    owner,
    // 帰属は凡例の全ての国から選び直せる
    ownerOptions: Object.keys(COUNTRY_COLORS),
    anchor: [lon, lat],
    points: [[lon, lat]],
    custom: true,
  }
  const id = useAppStore.getState().addCustomIsland(def)
  useAppStore.getState().setSelectedIslandId(id)
  poolDirty = true
  await runFullSim()
  return id
}

/** サンドボックス島を削除 → 確定計算 */
export async function removeIsland(id: string): Promise<void> {
  useAppStore.getState().removeCustomIsland(id)
  poolDirty = true
  await runFullSim()
}

/** ワンクリックで現実の状態に戻す */
export function resetAll(): void {
  const store = useAppStore.getState()
  store.resetIslands()
  store.setMode('real')
  poolDirty = true
}

/** 「もしも」シナリオ: 現実状態から指定の島だけOFFにして確定計算 */
export async function applyScenario(disableIds: string[]): Promise<void> {
  const store = useAppStore.getState()
  store.resetIslands()
  for (const id of disableIds) {
    store.setIslandState(id, { enabled: false })
  }
  await runFullSim()
}

/**
 * 島の寄与EEZ面積(km²) = 現在の構成での帰属国の面積 −
 * その島だけOFFにした帰属国の面積。「この島がなければ帰属国のEEZは
 * これだけ縮む」の値。現在位置・現在の帰属で評価する。
 * 返り値は { owner, diff }。未帰属なら owner=null, diff=0。
 */
const contributionCache = new Map<string, { owner: string | null; diff: number }>()
export async function getIslandContribution(
  id: string,
): Promise<{ owner: string | null; diff: number }> {
  const state = useAppStore.getState()
  const file = resolvedFile()
  const def = islandDefs(state)[id]
  const owner = effectiveOwner(id)
  const st = state.islands[id]
  if (!def || !owner || !st) return { owner: null, diff: 0 }
  const key = `${id}:${owner}:${st.lon.toFixed(3)},${st.lat.toFixed(3)}`
  const cached = contributionCache.get(key)
  if (cached) return cached
  const withAll = await requestComputeDetached(
    resolveBaseline(file, {
      islands: state.islands,
      disputedOwners: state.disputedOwners,
    }),
    CONTRIB_GRID,
  )
  const without = await requestComputeDetached(
    resolveBaseline(file, {
      islands: { ...state.islands, [id]: { ...st, enabled: false } },
      disputedOwners: state.disputedOwners,
    }),
    CONTRIB_GRID,
  )
  const result = {
    owner,
    diff: (withAll.areaKm2[owner] ?? 0) - (without.areaKm2[owner] ?? 0),
  }
  contributionCache.set(key, result)
  return result
}

// ---- ドラッグセッション(高解像度グリッドの差分更新) ----

let activeDrag: string | null = null
/**
 * 差分更新を受け付けてよいか。startDragが全域計算を待っている間はfalse。
 * この間にupdateを投げるとWorkerのバンド状態が競合する
 */
let dragReady = false
/**
 * Workerのキャッシュ済みグリッドに反映済みの島位置。
 * 更新windowはここから新位置までを覆う必要があるため、
 * ジョブを実際にディスパッチした時点でのみ進める
 * (イベントごとに進めると、間引かれた中間位置の影響範囲が
 *  windowから漏れて更新されないセル=継ぎ目・残像が生じる)
 */
let committedPos: [number, number] | null = null
let updateBusy = false
let queued: { pos: [number, number] } | null = null
/** ドラッグ中の静的点群(掴んだ島以外)の版数と実体 */
let staticVersion = 0
let staticSent = false
let staticPoints: PointsByCountry | null = null
let dragOwner = ''
let dragIslandPoints: [number, number][] = []
let dragAnchor: [number, number] = [0, 0]
/**
 * 更新ウィンドウの半径(km)。基本の影響圏に「島の点群の広がり」を足す。
 * 択捉島のように点群が広い島は、アンカーから離れた点の200海里圏が
 * 基本半径をはみ出すため、これを怠ると更新漏れ=残像になる
 */
let dragWindowRadiusKm = INFLUENCE_RADIUS_KM
/** プレビュー性能計測(受け入れ基準の確認用) */
export const previewStats = { frames: 0, totalMs: 0 }

// 開発時のみ: ブラウザ自動テストから性能とストアを覗けるようにする
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__eezDebug = {
    previewStats,
    getStore: () => useAppStore.getState(),
  }
}

export async function startDrag(id: string): Promise<void> {
  activeDrag = id
  dragReady = false
  queued = null
  const store = useAppStore.getState()
  const st = store.islands[id]
  const island = islandDefs(store)[id]
  const startPos: [number, number] = [st.lon, st.lat]
  store.setMode('sim')

  if (poolDirty) {
    // リセット直後など、プールが現在状態を持っていない場合のみ全域計算。
    // この待ち時間に差分更新を投げてはいけない。後から届く全域計算の
    // 結果がWorkerのバンド状態を「島が元位置」の姿で上書きしてしまい、
    // 動かしたはずの島のEEZが丸ごと元に戻る(dragReadyで塞ぐ)
    const result = await requestCompute(currentPoints(), SIM_GRID)
    poolDirty = false
    publishResult(result)
    if (activeDrag !== id) {
      // 計算を待つ間にドラッグが終わっていた: 最終位置で計算し直す
      const now = useAppStore.getState().islands[id]
      if (now && (now.lon !== startPos[0] || now.lat !== startPos[1])) {
        await runFullSim()
      }
      return
    }
  }

  committedPos = startPos
  dragOwner = effectiveOwner(id) ?? ''
  dragIslandPoints = island.points
  dragAnchor = island.anchor
  const islandExtentKm = island.points.reduce(
    (max, [lon, lat]) =>
      Math.max(max, haversineKm(island.anchor[0], island.anchor[1], lon, lat)),
    0,
  )
  dragWindowRadiusKm = INFLUENCE_RADIUS_KM + islandExtentKm
  // 掴んだ島を除いた静的点群(kd木はWorker側で版数単位にキャッシュ)。
  // 全域計算はWorkerのkd木キャッシュを捨てるので、版数の更新はその後に行う
  staticPoints = resolveBaseline(resolvedFile(), {
    islands: {
      ...store.islands,
      [id]: { ...st, enabled: false },
    },
    disputedOwners: store.disputedOwners,
  })
  staticVersion++
  staticSent = false
  dragReady = true
  pump() // 待っている間に溜まった最新位置を流す
}

export function dragTo(id: string, lon: number, lat: number): void {
  if (activeDrag !== id) return
  useAppStore.getState().setIslandState(id, { lon, lat })
  queued = { pos: [lon, lat] }
  pump()
}

/** 島の点群を現在位置に平行移動する */
function movingPointsAt(pos: [number, number]): [number, number][] {
  const dLon = pos[0] - dragAnchor[0]
  const dLat = pos[1] - dragAnchor[1]
  return dragIslandPoints.map(([lon, lat]) => [lon + dLon, lat + dLat])
}

function pump(): void {
  if (!dragReady || updateBusy || !queued || !committedPos || !staticPoints) return
  const job = queued
  queued = null
  updateBusy = true
  const win = influenceWindow(committedPos, job.pos)
  committedPos = job.pos
  // OFFにされている島はドラッグしてもEEZに寄与しない
  const enabled = activeDrag
    ? (useAppStore.getState().islands[activeDrag]?.enabled ?? true)
    : true
  const payload = {
    staticVersion,
    staticPoints: staticSent ? undefined : staticPoints,
    movingCountry: dragOwner,
    movingPoints: enabled ? movingPointsAt(job.pos) : [],
    window: win,
  }
  staticSent = true
  const t0 = performance.now()
  requestUpdate(payload).then((result) => {
    previewStats.frames++
    previewStats.totalMs += performance.now() - t0
    publishResult(result)
    updateBusy = false
    pump()
  })
}

export async function endDrag(id: string): Promise<void> {
  if (activeDrag !== id) return
  activeDrag = null
  // committedPos/queuedは触らない: 残りのキューはpumpが流しきり、
  // 最終位置まで厳密に反映される(次のstartDragで再初期化)。
  // まだ全域計算待ちなら、startDrag側が最終位置で計算し直す
  await ensureDefaultArea()
}

/** 旧位置・新位置それぞれの影響圏(200海里+島の広がり+余裕)を覆うbbox */
function influenceWindow(
  a: [number, number],
  b: [number, number],
): [number, number, number, number] {
  const r = dragWindowRadiusKm
  const dLat = r / 111.32
  const maxLat = Math.min(85, Math.max(Math.abs(a[1]), Math.abs(b[1])) + dLat)
  const dLon = r / (111.32 * Math.cos((maxLat * Math.PI) / 180))
  return [
    Math.min(a[0], b[0]) - dLon,
    Math.min(a[1], b[1]) - dLat,
    Math.max(a[0], b[0]) + dLon,
    Math.max(a[1], b[1]) + dLat,
  ]
}