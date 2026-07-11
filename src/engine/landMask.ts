/**
 * 陸地マスク。
 *
 * EEZは海の制度である。国連海洋法条約57条の200海里は「領海の幅を測定する
 * 基線から」測るが、生まれるのは海の権利であって、陸地がEEZになるわけでは
 * ない。ところがこのエンジンは「基線から200海里以内のセル」を全てその国に
 * 割り当てるので、何も対策しないと陸のセルまで数えてしまう。実際、富士山頂
 * が日本のEEZ、北京が中国のEEZとして算入されていた(日本の表示値は国土面積
 * 37.8万km²をまるごと1回余計に足していた)。
 *
 * そこで陸のセルを計算から外す。地図に描いている land.geojson をそのまま
 * ラスタライズするので、EEZの縁は画面上の海岸線とぴったり一致する。
 */
import { invMercY, mercY } from './geo'
import type { GridSpec } from './types'

/** スキャンライン用に平坦化した辺。[x1,y1,x2,y2] の並び */
export type LandEdges = Float64Array

/**
 * GeoJSONの陸地から辺を取り出す。
 * 外周リングのみを使う。穴(=湖)を海として扱うと、琵琶湖のような内陸の湖が
 * EEZに算入されてしまう。湖は陸の一部として塗りつぶす。
 */
export function landEdges(geojson: unknown): LandEdges {
  const fc = geojson as {
    features?: { geometry?: { type: string; coordinates: unknown } }[]
  }
  const buf: number[] = []
  for (const f of fc.features ?? []) {
    const g = f.geometry
    if (!g) continue
    const polys = (
      g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]
    ) as [number, number][][][]
    for (const poly of polys) {
      const ring = poly[0]
      if (!ring) continue
      for (let i = 1; i < ring.length; i++) {
        const [x1, y1] = ring[i - 1]
        const [x2, y2] = ring[i]
        if (y1 === y2) continue // 水平な辺は交差判定に寄与しない
        buf.push(x1, y1, x2, y2)
      }
    }
  }
  return Float64Array.from(buf)
}

/**
 * 陸セル=1 のマスクを作る。偶奇規則のスキャンライン。
 *
 * rowOffset/rowStride を渡すと担当行だけを塗る(Workerのバンド分割と同じ
 * 刻み)。マスクの配列自体はグリッド全面だが、Workerは自分の行しか読まない
 * ので、全Workerで同じ処理を重複させずに済む。
 */
export function rasterizeLand(
  edges: LandEdges,
  grid: GridSpec,
  rowOffset = 0,
  rowStride = 1,
): Uint8Array {
  const { width, height, bbox } = grid
  const [west, south, east, north] = bbox
  const mask = new Uint8Array(width * height)
  const dLon = (east - west) / width
  const yTop = mercY(north)
  const dy = (yTop - mercY(south)) / height
  const xs: number[] = []

  for (let r = rowOffset; r < height; r += rowStride) {
    // セル中心の緯度で切る(帰属判定もセル中心で行っているため)
    const lat = invMercY(yTop - dy * (r + 0.5))
    xs.length = 0
    for (let e = 0; e < edges.length; e += 4) {
      const y1 = edges[e + 1]
      const y2 = edges[e + 3]
      // 半開区間で判定する。頂点をちょうど跨ぐ辺を二重に数えない
      if (lat < Math.min(y1, y2) || lat >= Math.max(y1, y2)) continue
      const x1 = edges[e]
      const x2 = edges[e + 2]
      xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1))
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    const row = r * width
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // セル中心が区間に入る列だけを陸とする
      const c0 = Math.max(0, Math.ceil((xs[k] - west) / dLon - 0.5))
      const c1 = Math.min(width - 1, Math.floor((xs[k + 1] - west) / dLon - 0.5))
      for (let c = c0; c <= c1; c++) mask[row + c] = 1
    }
  }
  return mask
}
