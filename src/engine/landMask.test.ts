import { describe, expect, it } from 'vitest'
import { landEdges, rasterizeLand } from './landMask'
import { computeEezState } from './eezEngine'
import { EARTH_RADIUS_KM, NM200_KM } from './geo'
import type { GridSpec } from './types'

/** 正方形の陸地1つからなるGeoJSON */
const square = (w: number, s: number, e: number, n: number) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [w, s],
            [e, s],
            [e, n],
            [w, n],
            [w, s],
          ],
        ],
      },
    },
  ],
})

const grid: GridSpec = { bbox: [130, 14, 142, 27], width: 400, height: 440 }

/** 経緯度→セル番号 */
function cellAt(g: GridSpec, lon: number, lat: number): number {
  const [west, south, east, north] = g.bbox
  const mercY = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  const c = Math.floor(((lon - west) / (east - west)) * g.width)
  const yTop = mercY(north)
  const r = Math.floor(((yTop - mercY(lat)) / (yTop - mercY(south))) * g.height)
  return r * g.width + c
}

describe('rasterizeLand', () => {
  it('陸の内側を塗り、外側は塗らない', () => {
    const mask = rasterizeLand(landEdges(square(134, 18, 138, 22)), grid)
    expect(mask[cellAt(grid, 136, 20)]).toBe(1) // 内側
    expect(mask[cellAt(grid, 134.5, 18.5)]).toBe(1) // 内側の隅
    expect(mask[cellAt(grid, 133, 20)]).toBe(0) // 西の外
    expect(mask[cellAt(grid, 140, 20)]).toBe(0) // 東の外
    expect(mask[cellAt(grid, 136, 25)]).toBe(0) // 北の外
  })

  it('rowOffset/rowStride で担当行だけを塗る', () => {
    const edges = landEdges(square(134, 18, 138, 22))
    const full = rasterizeLand(edges, grid)
    const bands = [0, 1, 2].map((o) => rasterizeLand(edges, grid, o, 3))
    // 3バンドの和は全面と一致する(重複も欠落もない)
    for (let i = 0; i < full.length; i++) {
      expect(bands[0][i] + bands[1][i] + bands[2][i]).toBe(full[i])
    }
  })
})

describe('landMask と面積', () => {
  const capAreaKm2 = (dKm: number) =>
    2 * Math.PI * EARTH_RADIUS_KM ** 2 * (1 - Math.cos(dKm / EARTH_RADIUS_KM))

  it('陸のセルは面積に数えない', () => {
    const points = { Japan: [[136, 20.5] as [number, number]] }
    const noMask = computeEezState(points, grid).result.areaKm2.Japan
    expect(noMask).toBeGreaterThan(capAreaKm2(NM200_KM) * 0.99)

    // 島の周りに1°四方の陸を置くと、その分だけ面積が減る
    const mask = rasterizeLand(landEdges(square(135.5, 20, 136.5, 21)), grid)
    const masked = computeEezState(points, grid, NM200_KM, { landMask: mask })
    expect(masked.result.areaKm2.Japan).toBeLessThan(noMask)
    // 1°×1°(北緯20度)は約11,600km²
    const removed = noMask - masked.result.areaKm2.Japan
    expect(removed).toBeGreaterThan(10_000)
    expect(removed).toBeLessThan(13_000)
  })

  it('陸のセルにも帰属コードは与える(描画と輪郭追跡に使うため)', () => {
    const points = { Japan: [[136, 20.5] as [number, number]] }
    const mask = rasterizeLand(landEdges(square(135.5, 20, 136.5, 21)), grid)
    const { result } = computeEezState(points, grid, NM200_KM, { landMask: mask })
    // 陸のど真ん中のセルも「日本」として塗られる(面積には入らない)
    expect(result.codes[cellAt(grid, 136, 20.5)]).toBe(1)
    expect(result.countries[0]).toBe('Japan')
  })
})
