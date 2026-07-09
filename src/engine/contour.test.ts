import { describe, expect, it } from 'vitest'
import { traceAllRegions, traceRegionRings } from './contour'
import type { GridSpec } from './types'

/** 経度・緯度とも1度=1セルに近い小さなグリッド(赤道付近) */
const grid: GridSpec = { bbox: [0, 0, 10, 10], width: 10, height: 10 }

/** (c,r)のリストからcodes配列を作る */
function mask(cells: [number, number][], code = 1): Uint8Array {
  const codes = new Uint8Array(grid.width * grid.height)
  for (const [c, r] of cells) codes[r * grid.width + c] = code
  return codes
}

describe('traceRegionRings', () => {
  it('該当セルがなければ空', () => {
    expect(traceRegionRings(mask([]), grid, 1)).toEqual([])
    expect(traceRegionRings(mask([[1, 1]]), grid, 0)).toEqual([])
  })

  it('矩形の領域は1つの閉じたリングになる', () => {
    const cells: [number, number][] = []
    for (let r = 2; r < 7; r++) for (let c = 3; c < 8; c++) cells.push([c, r])
    const rings = traceRegionRings(mask(cells), grid, 1)
    expect(rings).toHaveLength(1)
    const ring = rings[0]
    // 閉じている
    expect(ring[0]).toEqual(ring[ring.length - 1])
    // 矩形なので簡略化後は5点(4隅+閉じ)
    expect(ring).toHaveLength(5)
    // 経度は3..8度の範囲に収まる
    const lons = ring.map((p) => p[0])
    expect(Math.min(...lons)).toBeCloseTo(3, 6)
    expect(Math.max(...lons)).toBeCloseTo(8, 6)
    // 緯度は上下が反転する(行0が北)
    const lats = ring.map((p) => p[1])
    expect(Math.max(...lats)).toBeGreaterThan(Math.min(...lats))
  })

  it('離れた2つの領域は2つのリングになる', () => {
    const a: [number, number][] = []
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) a.push([c, r])
    const b: [number, number][] = []
    for (let r = 6; r < 9; r++) for (let c = 6; c < 9; c++) b.push([c, r])
    const rings = traceRegionRings(mask([...a, ...b]), grid, 1)
    expect(rings).toHaveLength(2)
  })

  it('他のコードの領域は無視する', () => {
    const codes = new Uint8Array(grid.width * grid.height)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) codes[r * grid.width + c] = 1
    for (let r = 6; r < 10; r++) for (let c = 6; c < 10; c++) codes[r * grid.width + c] = 2
    expect(traceRegionRings(codes, grid, 1)).toHaveLength(1)
    expect(traceRegionRings(codes, grid, 2)).toHaveLength(1)
  })

  it('小さすぎるリング(量子化ノイズ)は捨てる', () => {
    // 1セルだけ=辺4本 → MIN_RING_POINTS(8)未満なので捨てられる
    expect(traceRegionRings(mask([[5, 5]]), grid, 1)).toEqual([])
  })
})

describe('traceAllRegions', () => {
  it('全コードの輪郭を1回で取り出す', () => {
    const codes = new Uint8Array(grid.width * grid.height)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) codes[r * grid.width + c] = 1
    for (let r = 6; r < 10; r++) for (let c = 6; c < 10; c++) codes[r * grid.width + c] = 2
    const all = traceAllRegions(codes, grid)
    expect([...all.keys()].sort()).toEqual([1, 2])
    expect(all.get(1)).toHaveLength(1)
    expect(all.get(2)).toHaveLength(1)
    // 個別に取り出したものと一致する
    expect(all.get(1)).toEqual(traceRegionRings(codes, grid, 1))
    expect(all.get(2)).toEqual(traceRegionRings(codes, grid, 2))
  })

  it('接し合う2つの領域でも、それぞれの輪郭が取れる', () => {
    const codes = new Uint8Array(grid.width * grid.height)
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) codes[r * grid.width + c] = c < 5 ? 1 : 2
    const all = traceAllRegions(codes, grid)
    expect(all.get(1)).toHaveLength(1)
    expect(all.get(2)).toHaveLength(1)
  })

  it('コード0(EEZ外)は輪郭を持たない', () => {
    const codes = new Uint8Array(grid.width * grid.height)
    for (let r = 2; r < 8; r++) for (let c = 2; c < 8; c++) codes[r * grid.width + c] = 3
    const all = traceAllRegions(codes, grid)
    expect([...all.keys()]).toEqual([3])
  })
})
