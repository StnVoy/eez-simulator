import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { BaselineFile, LonLat } from './types'

const file = JSON.parse(
  readFileSync('public/data/baseline-points.json', 'utf8'),
) as BaselineFile

/** 基線点の全グループ(国・係争地・島)を [名前, 点群] で列挙する */
function groups(): [string, LonLat[]][] {
  return [
    ...Object.entries(file.countries).map(
      ([k, pts]): [string, LonLat[]] => [`country:${k}`, pts],
    ),
    ...Object.entries(file.disputed).map(
      ([k, d]): [string, LonLat[]] => [`disputed:${k}`, d.points],
    ),
    ...Object.entries(file.islands).map(
      ([k, i]): [string, LonLat[]] => [`island:${k}`, i.points],
    ),
  ]
}

describe('baseline-points.json', () => {
  /**
   * 同一座標が2つのグループにあると、そこからの距離が常に同着になり、
   * 二等分線が定義できない。その点を最近傍とする海域がまるごと片方に倒れ、
   * どちらに倒れるかはkd木の構造 ―― つまり「他の島を1つON/OFFしたかどうか」
   * ―― で変わる。島を動かすと無関係な国のEEZが数万km²増減した原因。
   * 生成側(scripts/fetch-data.mjs)が海岸線上の点だけを採り、なお共有される
   * 点(河口・軍事境界線の東端)を両者から落とすことで保証している。
   */
  it('同じ座標が2つ以上のグループに現れない', () => {
    const owners = new Map<string, string[]>()
    for (const [name, pts] of groups()) {
      for (const p of pts) {
        const k = String(p)
        owners.set(k, [...(owners.get(k) ?? []), name])
      }
    }
    const shared = [...owners]
      .filter(([, gs]) => new Set(gs).size > 1)
      .map(([k, gs]) => `${k} → ${[...new Set(gs)].join(', ')}`)
    expect(shared).toEqual([])
  })

  it('全ての点が宣言されたbboxの中にある', () => {
    const [w, s, e, n] = file.bbox
    const outside = groups().flatMap(([name, pts]) =>
      pts
        .filter(([lon, lat]) => lon < w || lon > e || lat < s || lat > n)
        .map((p) => `${name} ${p}`),
    )
    expect(outside).toEqual([])
  })

  /** 陸上の国境から点を採っていれば、内陸国境を持つ国の点数がこれより多くなる */
  it('国境を共有する国の基線点が、海岸線の規模に収まっている', () => {
    // 中国の海岸線は約1.5万km。10km間隔なら1,500点前後。陸上の国境(2万km超)
    // まで拾っていた頃は2,530点あった
    expect(file.countries.China.length).toBeLessThan(1800)
    // 日本は陸の国境を持たないので、この修正の前後で変わらないはず
    expect(file.countries.Japan.length).toBeGreaterThan(1000)
  })
})
