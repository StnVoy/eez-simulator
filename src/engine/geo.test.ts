import { describe, expect, it } from 'vitest'
import {
  EARTH_RADIUS_KM,
  arcKmToChordSq,
  bandCellAreaKm2,
  chordSqToArcKm,
  haversineKm,
  invMercY,
  lonLatToXyz,
  mercY,
} from './geo'

describe('haversineKm', () => {
  it('東京—大阪 ≈ 400km', () => {
    // 東京駅 139.767,35.681 / 大阪駅 135.495,34.702
    const d = haversineKm(139.767, 35.681, 135.495, 34.702)
    expect(d).toBeGreaterThan(390)
    expect(d).toBeLessThan(410)
  })
  it('同一点は0', () => {
    expect(haversineKm(140, 35, 140, 35)).toBe(0)
  })
  it('赤道上の経度1度 ≈ 111.19km', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(
      (Math.PI / 180) * EARTH_RADIUS_KM,
      3,
    )
  })
})

describe('lonLatToXyz / 弦長変換', () => {
  it('xyzは単位ベクトル', () => {
    const out = new Float64Array(3)
    lonLatToXyz(136.08, 20.43, out)
    const norm = Math.hypot(out[0], out[1], out[2])
    expect(norm).toBeCloseTo(1, 12)
  })
  it('弦長経由の距離がhaversineと一致', () => {
    const a = new Float64Array(3)
    const b = new Float64Array(3)
    lonLatToXyz(130, 30, a)
    lonLatToXyz(145, 42, b)
    const chordSq =
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    expect(chordSqToArcKm(chordSq)).toBeCloseTo(
      haversineKm(130, 30, 145, 42),
      6,
    )
  })
  it('arcKmToChordSqとchordSqToArcKmは逆関数', () => {
    expect(chordSqToArcKm(arcKmToChordSq(370.4))).toBeCloseTo(370.4, 9)
  })
})

describe('mercY / invMercY', () => {
  it('往復変換', () => {
    for (const lat of [-50, -15, 0, 15, 35, 50]) {
      expect(invMercY(mercY(lat))).toBeCloseTo(lat, 10)
    }
  })
})

describe('bandCellAreaKm2', () => {
  it('全球の合計 = 4πR²', () => {
    // 経度360°×緯度180°を1セルとして
    const total = bandCellAreaKm2(360, -90, 90)
    expect(total).toBeCloseTo(4 * Math.PI * EARTH_RADIUS_KM ** 2, 3)
  })
  it('高緯度ほど同じ度数幅の面積が小さい', () => {
    expect(bandCellAreaKm2(1, 45, 46)).toBeLessThan(bandCellAreaKm2(1, 0, 1))
  })
})
