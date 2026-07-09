/**
 * グリッド(codes)上の1つの国コードが占める領域の輪郭を、経緯度のリングとして取り出す。
 *
 * 用途: 係争中の海域を、実データ表示と同じ斜線パターン(fill-pattern)で描くため。
 * ラスタのオーバーレイに縞を直接描くと、ズームに比例して縞が太る(拡大すると
 * 帯や市松模様になる)。ベクタにしてMapLibreのfill-patternに任せれば、
 * 縞の太さは画面座標で一定になる。
 *
 * 方式: セルの辺をたどる輪郭追跡(marching squaresの辺版)。
 * 領域内のセルについて、外側と接する辺だけを「領域が左に来る向き」で集め、
 * 端点でつないで閉ループにする。
 */
import { invMercY, mercY } from './geo'
import type { GridSpec, LonLat } from './types'

/** 輪郭を間引く許容誤差(セル数)。1セル≒4.6kmなので見た目に影響しない */
const SIMPLIFY_EPS_CELLS = 1.5
/** これより頂点が少ないリングは、量子化ノイズとみなして捨てる */
const MIN_RING_POINTS = 8

/**
 * 閉じたリングの簡略化。
 * 始点=終点のままRDPに渡すと基準線が退化して全点が落ちるので、
 * 始点から最も遠い点で2つの開いた線に割ってから簡略化する。
 */
function simplifyClosed(ring: [number, number][], eps: number): [number, number][] {
  const pts = ring.slice(0, -1) // 閉じの重複を外す
  if (pts.length < 4) return ring
  let far = 0
  let maxD = -1
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1])
    if (d > maxD) {
      maxD = d
      far = i
    }
  }
  const a = simplify(pts.slice(0, far + 1), eps)
  const b = simplify([...pts.slice(far), pts[0]], eps)
  return [...a.slice(0, -1), ...b]
}

/** Ramer–Douglas–Peucker(グリッド座標のまま、開いた線用) */
function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length <= 3) return pts
  let maxD = -1
  let idx = 0
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]]
  const left = simplify(pts.slice(0, idx + 1), eps)
  const right = simplify(pts.slice(idx), eps)
  return [...left.slice(0, -1), ...right]
}

/** 角(corner)のキー -> そこから出る辺の終点キー(斜めに接すると複数になる) */
type EdgeMap = Map<number, number[]>

/** 辺の集合を閉ループにつなぎ、簡略化して経緯度に直す */
function linkRings(
  out: EdgeMap,
  grid: GridSpec,
  cornerStride: number,
): LonLat[][] {
  const { width, height, bbox } = grid
  const [west, south, east, north] = bbox
  const dLon = (east - west) / width
  const yTop = mercY(north)
  const dy = (yTop - mercY(south)) / height
  const toLonLat = ([c, r]: [number, number]): LonLat => [
    west + dLon * c,
    invMercY(yTop - dy * r),
  ]

  const rings: LonLat[][] = []
  for (const start of [...out.keys()]) {
    while ((out.get(start)?.length ?? 0) > 0) {
      const path: [number, number][] = []
      let cur = start
      // 開始点に戻るまで辺を消費しながらたどる
      for (;;) {
        const nexts = out.get(cur)
        if (!nexts || nexts.length === 0) break
        const next = nexts.pop()!
        if (nexts.length === 0) out.delete(cur)
        path.push([cur % cornerStride, Math.floor(cur / cornerStride)])
        cur = next
        if (cur === start) break
      }
      if (path.length < MIN_RING_POINTS) continue
      path.push(path[0]) // 閉じる
      const simple = simplifyClosed(path, SIMPLIFY_EPS_CELLS)
      if (simple.length < 4) continue
      rings.push(simple.map(toLonLat))
    }
  }
  return rings
}

/**
 * 全ての国コードの輪郭リングを1回の走査で取り出す。
 * 国ごとに traceRegionRings を呼ぶと走査が国の数だけ増える(3.35Mセル×24)。
 */
export function traceAllRegions(
  codes: Uint8Array,
  grid: GridSpec,
): Map<number, LonLat[][]> {
  const { width, height } = grid
  const cornerStride = width + 1
  const key = (c: number, r: number): number => r * cornerStride + c

  const perCode = new Map<number, EdgeMap>()
  const add = (
    code: number,
    c0: number,
    r0: number,
    c1: number,
    r1: number,
  ): void => {
    let out = perCode.get(code)
    if (!out) perCode.set(code, (out = new Map()))
    const k = key(c0, r0)
    const arr = out.get(k)
    if (arr) arr.push(key(c1, r1))
    else out.set(k, [key(c1, r1)])
  }

  for (let r = 0; r < height; r++) {
    const row = r * width
    for (let c = 0; c < width; c++) {
      const code = codes[row + c]
      if (code === 0) continue
      // 領域を左に見る向きで、別コード(や外側)と接する辺だけを積む
      if (r === 0 || codes[row - width + c] !== code) add(code, c, r, c + 1, r)
      if (c === width - 1 || codes[row + c + 1] !== code)
        add(code, c + 1, r, c + 1, r + 1)
      if (r === height - 1 || codes[row + width + c] !== code)
        add(code, c + 1, r + 1, c, r + 1)
      if (c === 0 || codes[row + c - 1] !== code) add(code, c, r + 1, c, r)
    }
  }

  const result = new Map<number, LonLat[][]>()
  for (const [code, out] of perCode) {
    const rings = linkRings(out, grid, cornerStride)
    if (rings.length > 0) result.set(code, rings)
  }
  return result
}

/**
 * codes のうち値が code のセルが作る領域の輪郭リング(閉じたLonLatの配列)を返す。
 * 穴(領域の内側の空白)も1つのリングとして返る。呼び出し側でeven-odd扱いにするか、
 * このアプリのように穴が生じない前提で使う。
 */
export function traceRegionRings(
  codes: Uint8Array,
  grid: GridSpec,
  code: number,
): LonLat[][] {
  if (code <= 0) return []
  const { width, height } = grid
  const cornerStride = width + 1

  const inside = (c: number, r: number): boolean =>
    c >= 0 && r >= 0 && c < width && r < height && codes[r * width + c] === code

  const out: EdgeMap = new Map()
  const key = (c: number, r: number): number => r * cornerStride + c
  const add = (c0: number, r0: number, c1: number, r1: number): void => {
    const k = key(c0, r0)
    const arr = out.get(k)
    if (arr) arr.push(key(c1, r1))
    else out.set(k, [key(c1, r1)])
  }

  for (let r = 0; r < height; r++) {
    const row = r * width
    for (let c = 0; c < width; c++) {
      if (codes[row + c] !== code) continue
      if (!inside(c, r - 1)) add(c, r, c + 1, r)
      if (!inside(c + 1, r)) add(c + 1, r, c + 1, r + 1)
      if (!inside(c, r + 1)) add(c + 1, r + 1, c, r + 1)
      if (!inside(c - 1, r)) add(c, r + 1, c, r)
    }
  }
  if (out.size === 0) return []
  return linkRings(out, grid, cornerStride)
}
