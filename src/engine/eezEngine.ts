/**
 * EEZ計算エンジン本体(純粋関数+差分更新用の状態構造)
 *
 * アルゴリズム: グリッド各セルの中心について全基線点の最近傍を求め、
 * 200海里以内ならその点の国に割り当てる。これは「両国の基線から
 * 等距離の中間線で分割」(Voronoi配分)と等価。
 * 面積はセルを球面台形として積算する。
 *
 * ドラッグ用の差分更新: 島の移動で割り当てが変わり得るセルは
 * 「旧位置の200海里圏」∪「新位置の200海里圏」に限られるため、
 * その範囲(window)だけ再分類すれば全域再計算と同じ結果になる。
 */
import {
  NM200_KM,
  arcKmToChordSq,
  bandCellAreaKm2,
  invMercY,
  lonLatToXyz,
  mercY,
  toRad,
} from './geo'
import { KdTree3 } from './kdtree'
import {
  DISPUTED_COUNTRY,
  type BaselineFile,
  type EezResult,
  type GridSpec,
  type IslandState,
  type LonLat,
  type PointsByCountry,
} from './types'

/** 差分更新のために保持する計算状態(Workerプールでは行インターリーブ) */
export interface EezState {
  grid: GridSpec
  countries: string[]
  codes: Uint8Array
  /** index = 国コード(1..)。[0]は未使用 */
  areaByCode: Float64Array
  /** 担当行: rowOffset, rowOffset+rowStride, …(単体計算では 0, 1) */
  rowOffset: number
  rowStride: number
  /**
   * 陸セル=1 のマスク(engine/landMask.ts)。EEZは海の権利なので、
   * 陸のセルはどの国にも算入しない。null なら陸を除外しない
   */
  landMask: Uint8Array | null
}

/** r0以上で offset (mod stride) に合同な最初の行 */
export function alignRow(r0: number, offset: number, stride: number): number {
  return r0 + ((((offset - r0) % stride) + stride) % stride)
}

/** window(度単位bbox)をグリッドの行・列範囲に変換する */
export function windowToRange(
  grid: GridSpec,
  window: [number, number, number, number],
): { r0: number; r1: number; c0: number; c1: number } {
  const [west, south, east, north] = grid.bbox
  const dLonDeg = (east - west) / grid.width
  const yTop = mercY(north)
  const dy = (yTop - mercY(south)) / grid.height
  const clampLat = (v: number) => Math.min(north, Math.max(south, v))
  return {
    r0: Math.floor((yTop - mercY(clampLat(window[3]))) / dy),
    r1: Math.ceil((yTop - mercY(clampLat(window[1]))) / dy),
    c0: Math.floor((window[0] - west) / dLonDeg),
    c1: Math.ceil((window[2] - west) / dLonDeg),
  }
}

export interface TreeBundle {
  tree: KdTree3
  pointCode: Uint8Array
}

/** ドラッグ中の島など、kd木に入れず総当たりで判定する少数の点 */
export interface MovingPoints {
  /** xyz平坦配列(長さ3m) */
  coords: Float64Array
  /** 割り当てる国コード(countries index+1) */
  code: number
}

/** LonLat配列をMovingPointsに変換する */
export function toMovingPoints(points: LonLat[], code: number): MovingPoints {
  const coords = new Float64Array(points.length * 3)
  points.forEach(([lon, lat], i) => lonLatToXyz(lon, lat, coords, i * 3))
  return { coords, code }
}

/** 国順を固定して全点をkd木に平坦化する */
export function buildTree(points: PointsByCountry, countries: string[]): TreeBundle {
  const total = countries.reduce((s, c) => s + (points[c]?.length ?? 0), 0)
  const coords = new Float64Array(total * 3)
  const pointCode = new Uint8Array(total)
  let p = 0
  countries.forEach((country, ci) => {
    for (const [lon, lat] of points[country] ?? []) {
      lonLatToXyz(lon, lat, coords, p * 3)
      pointCode[p] = ci + 1
      p++
    }
  })
  return { tree: new KdTree3(coords), pointCode }
}

/**
 * グリッドの行[r0,r1)×列[c0,c1)を再分類し、codes/areaByCodeを更新する。
 */
function classifyRange(
  state: EezState,
  bundle: TreeBundle,
  r0: number,
  r1: number,
  c0: number,
  c1: number,
  limitKm: number,
  moving?: MovingPoints,
): void {
  const { grid, codes, areaByCode, landMask } = state
  const { width } = grid
  const [west, south, east, north] = grid.bbox
  const chordSqLimit = arcKmToChordSq(limitKm)
  const dLonDeg = (east - west) / width
  const yTop = mercY(north)
  const dy = (yTop - mercY(south)) / grid.height

  // 隣接セルの最近傍点はほぼ同じなので、直前の答えを初期候補にして
  // kd木の枝刈りを効かせる(空間的コヒーレンス)
  let seed = -1
  const rEnd = Math.min(grid.height, r1)
  for (
    let r = alignRow(Math.max(0, r0), state.rowOffset, state.rowStride);
    r < rEnd;
    r += state.rowStride
  ) {
    const latTop = invMercY(yTop - dy * r)
    const latBot = invMercY(yTop - dy * (r + 1))
    const latC = (latTop + latBot) / 2
    const cellArea = bandCellAreaKm2(dLonDeg, latBot, latTop)
    const cosφ = Math.cos(toRad(latC))
    const sinφ = Math.sin(toRad(latC))
    for (let c = Math.max(0, c0); c < Math.min(width, c1); c++) {
      const lon = west + dLonDeg * (c + 0.5)
      const λ = toRad(lon)
      const qx = cosφ * Math.cos(λ)
      const qy = cosφ * Math.sin(λ)
      const near = bundle.tree.nearest(qx, qy, sinφ, seed)
      seed = near.index
      let bestD = near.distSq
      let code = bestD <= chordSqLimit ? bundle.pointCode[near.index] : 0
      if (moving) {
        // 動く点(高々数十)は総当たりで最近傍と比較
        const mc = moving.coords
        for (let m = 0; m < mc.length; m += 3) {
          const dx = mc[m] - qx
          const dy = mc[m + 1] - qy
          const dz = mc[m + 2] - sinφ
          const d = dx * dx + dy * dy + dz * dz
          if (d < bestD) {
            bestD = d
            if (d <= chordSqLimit) code = moving.code
          }
        }
      }
      const i = r * width + c
      const old = codes[i]
      if (old !== code) {
        // 陸のセルにも帰属は与える(codesは描画と輪郭追跡にも使う。陸を0に
        // すると、ラスタが海岸で途切れて白い縁ができ、輪郭線が海岸線を
        // なぞって海の上を走る)。ただし面積には数えない ―― EEZは海の権利
        // であって、陸地がEEZになるわけではない
        if (!landMask?.[i]) {
          if (old) areaByCode[old] -= cellArea
          if (code) areaByCode[code] += cellArea
        }
        codes[i] = code
      }
    }
  }
}

function stateToResult(state: EezState, elapsedMs: number): EezResult {
  const areaKm2: Record<string, number> = {}
  state.countries.forEach((country, ci) => {
    areaKm2[country] = state.areaByCode[ci + 1]
  })
  return {
    grid: state.grid,
    countries: state.countries,
    // 呼び出し側に渡すコピー(stateは次の差分更新の基準として保持)
    codes: state.codes.slice(),
    areaKm2,
    elapsedMs,
  }
}

/** 点群から国コードの割当順を決める(全Worker間で共有するため分離) */
export function countryOrder(points: PointsByCountry): string[] {
  const countries = Object.keys(points).filter((c) => points[c].length > 0)
  if (countries.length > 255) throw new Error('too many countries for Uint8 codes')
  return countries
}

/**
 * 全域(または担当行)計算のstateのみ版。Workerが結果配列の不要な
 * コピーを避けるために使う
 */
export function computeEezBand(
  points: PointsByCountry,
  grid: GridSpec,
  opts: {
    countries?: string[]
    rowOffset?: number
    rowStride?: number
    landMask?: Uint8Array | null
  } = {},
  limitKm: number = NM200_KM,
): EezState {
  const countries = opts.countries ?? countryOrder(points)
  const state: EezState = {
    grid,
    countries,
    codes: new Uint8Array(grid.width * grid.height),
    areaByCode: new Float64Array(countries.length + 1),
    rowOffset: opts.rowOffset ?? 0,
    rowStride: opts.rowStride ?? 1,
    landMask: opts.landMask ?? null,
  }
  const bundle = buildTree(points, countries)
  classifyRange(state, bundle, 0, grid.height, 0, grid.width, limitKm)
  return state
}

/** 全域計算。返り値のstateはupdateEezWindowの基準として使える */
export function computeEezState(
  points: PointsByCountry,
  grid: GridSpec,
  limitKm: number = NM200_KM,
  opts: {
    countries?: string[]
    rowOffset?: number
    rowStride?: number
    landMask?: Uint8Array | null
  } = {},
): { state: EezState; result: EezResult } {
  const t0 = performance.now()
  const state = computeEezBand(points, grid, opts, limitKm)
  return { state, result: stateToResult(state, performance.now() - t0) }
}

/** 互換用の簡易API(テスト・単発計算) */
export function computeEez(
  points: PointsByCountry,
  grid: GridSpec,
  limitKm: number = NM200_KM,
): EezResult {
  return computeEezState(points, grid, limitKm).result
}

/**
 * 差分更新: window(度単位bbox)内のセルだけを新しい点群で再分類する。
 * windowが「変化し得る範囲」を覆っていれば全域再計算と同一結果。
 */
export function updateEezWindow(
  state: EezState,
  points: PointsByCountry,
  window: [number, number, number, number],
  limitKm: number = NM200_KM,
): EezResult {
  const bundle = buildTree(points, state.countries)
  return updateEezWindowPartial(state, bundle, null, window, limitKm)
}

/**
 * 差分更新の本体: 構築済みの静的kd木+動く点(総当たり)でwindow内を
 * 再分類し、処理した範囲を返す(結果配列のコピーはしない)。
 * ドラッグ中はこちらを使い、kd木のフレーム毎再構築を避ける。
 */
export function updateBand(
  state: EezState,
  staticBundle: TreeBundle,
  moving: MovingPoints | null,
  window: [number, number, number, number],
  limitKm: number = NM200_KM,
): { r0: number; r1: number; c0: number; c1: number } {
  const range = windowToRange(state.grid, window)
  const r0 = Math.max(0, range.r0)
  const r1 = Math.min(state.grid.height, range.r1)
  const c0 = Math.max(0, range.c0)
  const c1 = Math.min(state.grid.width, range.c1)
  classifyRange(state, staticBundle, r0, r1, c0, c1, limitKm, moving ?? undefined)
  return { r0, r1, c0, c1 }
}

/** updateBandのEezResult返却版(テスト・単体利用向け) */
export function updateEezWindowPartial(
  state: EezState,
  staticBundle: TreeBundle,
  moving: MovingPoints | null,
  window: [number, number, number, number],
  limitKm: number = NM200_KM,
): EezResult {
  const t0 = performance.now()
  updateBand(state, staticBundle, moving, window, limitKm)
  return stateToResult(state, performance.now() - t0)
}

/**
 * baseline-points.json を国別点群に解決する。
 *
 * - 係争地域: 既定は「係争中」。どの国のものにもせず DISPUTED_COUNTRY に集約する。
 *   島を動かしただけで係争地が特定の国のものになってはいけない。
 * - 係争地に属する島(択捉島など)は、島単体のownerではなく係争グループの帰属に従う。
 *   点群はグループとは別に持っているため、ここで揃えないと片方だけ日本に残る。
 * - 島: enabledのもののみ、anchorからの移動量だけ平行移動して帰属先に追加。
 *   owner=null の島(仲裁判断下の南沙諸島)はEEZを生まない。
 */
export function resolveBaseline(
  file: Pick<BaselineFile, 'countries' | 'disputed'> & Partial<Pick<BaselineFile, 'islands'>>,
  opts: {
    disputedOwners?: Record<string, string>
    islands?: Record<string, IslandState>
  } = {},
): PointsByCountry {
  const merged: PointsByCountry = {}
  const push = (key: string, pts: LonLat[]) => {
    merged[key] ??= []
    merged[key].push(...pts)
  }
  for (const [c, pts] of Object.entries(file.countries)) merged[c] = [...pts]
  for (const [id, group] of Object.entries(file.disputed)) {
    // 未設定は「係争中」。defaultOwnerは各国の立場の参考値であって既定値ではない
    const owner = opts.disputedOwners?.[id] ?? ''
    push(owner || DISPUTED_COUNTRY, group.points)
  }
  for (const [id, island] of Object.entries(file.islands ?? {})) {
    const st = opts.islands?.[id]
    if (st && !st.enabled) continue
    const owner = island.disputeId
      ? (opts.disputedOwners?.[island.disputeId] ?? '') // 係争グループに連動
      : (st?.owner ?? island.owner)
    if (owner === null) continue // 未帰属=EEZを生まない
    const dLon = st ? st.lon - island.anchor[0] : 0
    const dLat = st ? st.lat - island.anchor[1] : 0
    push(
      owner || DISPUTED_COUNTRY,
      island.points.map(([lon, lat]): LonLat => [lon + dLon, lat + dLat]),
    )
  }
  return merged
}
