import { describe, expect, it } from 'vitest'
import { KdTree3 } from './kdtree'

/** 再現可能な擬似乱数(mulberry32) */
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bruteNearest(coords: Float64Array, q: [number, number, number]) {
  let bestD = Infinity
  let bestI = -1
  for (let i = 0; i < coords.length / 3; i++) {
    const d =
      (coords[i * 3] - q[0]) ** 2 +
      (coords[i * 3 + 1] - q[1]) ** 2 +
      (coords[i * 3 + 2] - q[2]) ** 2
    if (d < bestD) {
      bestD = d
      bestI = i
    }
  }
  return { index: bestI, distSq: bestD }
}

describe('KdTree3', () => {
  it('ランダム1000点でブルートフォースと一致', () => {
    const rand = rng(42)
    const n = 1000
    const coords = new Float64Array(n * 3)
    for (let i = 0; i < n * 3; i++) coords[i] = rand() * 2 - 1
    const tree = new KdTree3(coords)
    for (let k = 0; k < 200; k++) {
      const q: [number, number, number] = [
        rand() * 2 - 1,
        rand() * 2 - 1,
        rand() * 2 - 1,
      ]
      const got = tree.nearest(...q)
      const want = bruteNearest(coords, q)
      expect(got.distSq).toBeCloseTo(want.distSq, 12)
    }
  })

  it('1点だけでも動く', () => {
    const coords = new Float64Array([0.5, 0.5, 0.5])
    const tree = new KdTree3(coords)
    const r = tree.nearest(1, 1, 1)
    expect(r.index).toBe(0)
    expect(r.distSq).toBeCloseTo(0.75, 12)
  })

  it('重複点があっても壊れない', () => {
    const coords = new Float64Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0])
    const tree = new KdTree3(coords)
    const r = tree.nearest(0, 0.9, 0)
    expect(r.index).toBe(3)
  })
})
