/// <reference lib="webworker" />
/**
 * 計算Workerエントリ(プールの1メンバー)。
 * 行をインターリーブ(rowOffset, +rowStride, …)で担当し、状態を保持して
 * 差分更新(update)に備える。ロジック本体はeezEngine.ts側。
 *
 * ドラッグ用のupdateでは、静的点群のkd木をstaticVersion単位で
 * キャッシュし、動く島の点だけ毎フレーム受け取る(木の再構築を回避)。
 */
import {
  alignRow,
  buildTree,
  computeEezBand,
  toMovingPoints,
  updateBand,
  windowToRange,
  type EezState,
  type TreeBundle,
} from './eezEngine'
import type { BandResponse, WorkerRequest } from './types'

/** 直近のcomputeで得た担当行の状態。updateの差分更新基準 */
let cached: EezState | null = null
/** update用の静的kd木キャッシュ(staticVersion単位) */
let staticBundle: TreeBundle | null = null
let staticVersion = -1

/** 担当行のうち[r0,r1)の行を行順に詰めて取り出す */
function gatherRows(state: EezState, r0: number, r1: number): Uint8Array {
  const { width } = state.grid
  const { rowOffset, rowStride } = state
  const first = alignRow(r0, rowOffset, rowStride)
  const n = first >= r1 ? 0 : Math.floor((r1 - 1 - first) / rowStride) + 1
  const out = new Uint8Array(n * width)
  for (let k = 0, r = first; r < r1; r += rowStride, k++) {
    out.set(state.codes.subarray(r * width, (r + 1) * width), k * width)
  }
  return out
}

function bandResponse(
  requestId: number,
  state: EezState,
  elapsedMs: number,
  gatherR0: number,
  gatherR1: number,
  dirty: BandResponse['dirty'],
): BandResponse {
  return {
    type: 'result',
    requestId,
    changed: true,
    rowOffset: state.rowOffset,
    rowStride: state.rowStride,
    gatherR0,
    gatherR1,
    codes: gatherRows(state, gatherR0, gatherR1),
    areaByCode: state.areaByCode.slice(),
    dirty,
    elapsedMs,
  }
}

/** 処理できない要求への「何も変えていない」応答(呼び出し側のpendingを必ず解く) */
function noopResponse(requestId: number): BandResponse {
  return {
    type: 'result',
    requestId,
    changed: false,
    rowOffset: cached?.rowOffset ?? 0,
    rowStride: cached?.rowStride ?? 1,
    gatherR0: 0,
    gatherR1: 0,
    elapsedMs: 0,
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  let res: BandResponse
  if (msg.type === 'compute') {
    const t0 = performance.now()
    cached = computeEezBand(msg.points, msg.grid, {
      countries: msg.countries,
      rowOffset: msg.rowOffset,
      rowStride: msg.rowStride,
    })
    staticBundle = null
    staticVersion = -1
    res = bandResponse(msg.requestId, cached, performance.now() - t0, 0, msg.grid.height, {
      r0: 0,
      r1: msg.grid.height,
      c0: 0,
      c1: msg.grid.width,
    })
  } else if (msg.type === 'update') {
    // computeより先にupdateは来ない前提だが、黙って落とすと呼び出し側の
    // Promiseが永久に解けず、以降の差分更新が止まる。必ず応答を返す
    if (!cached) {
      ;(self as unknown as Worker).postMessage(noopResponse(msg.requestId))
      return
    }
    if (msg.staticVersion !== staticVersion) {
      if (!msg.staticPoints) {
        // 版が変わる最初のフレームには必ず同梱される
        ;(self as unknown as Worker).postMessage(noopResponse(msg.requestId))
        return
      }
      staticBundle = buildTree(msg.staticPoints, cached.countries)
      staticVersion = msg.staticVersion
    }
    const probe = windowToRange(cached.grid, msg.window)
    const hasRow =
      alignRow(Math.max(0, probe.r0), cached.rowOffset, cached.rowStride) <
      Math.min(cached.grid.height, probe.r1)
    if (!hasRow) {
      res = {
        type: 'result',
        requestId: msg.requestId,
        changed: false,
        rowOffset: cached.rowOffset,
        rowStride: cached.rowStride,
        gatherR0: 0,
        gatherR1: 0,
        elapsedMs: 0,
      }
    } else {
      const t0 = performance.now()
      const movingCode = cached.countries.indexOf(msg.movingCountry) + 1
      const moving =
        movingCode > 0 && msg.movingPoints.length > 0
          ? toMovingPoints(msg.movingPoints, movingCode)
          : null
      const range = updateBand(cached, staticBundle!, moving, msg.window)
      res = bandResponse(
        msg.requestId,
        cached,
        performance.now() - t0,
        range.r0,
        range.r1,
        range,
      )
    }
  } else {
    return
  }
  const transfer = res.codes ? [res.codes.buffer] : []
  ;(self as unknown as Worker).postMessage(res, transfer)
}
