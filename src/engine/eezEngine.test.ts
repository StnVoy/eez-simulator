import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_KM, NM200_KM, toRad } from './geo'
import { DISPUTED_COUNTRY } from './types'
import {
  buildTree,
  computeEez,
  computeEezState,
  resolveBaseline,
  toMovingPoints,
  updateEezWindow,
  updateEezWindowPartial,
} from './eezEngine'
import type { BaselineFile, GridSpec } from './types'

/** 半径d(km)の球面キャップ面積 = 2πR²(1−cos(d/R)) */
const capAreaKm2 = (dKm: number) =>
  2 * Math.PI * EARTH_RADIUS_KM ** 2 * (1 - Math.cos(dKm / EARTH_RADIUS_KM))

describe('computeEez', () => {
  it('孤島1点 → 200海里の球面キャップ面積', () => {
    const grid: GridSpec = { bbox: [130, 14, 142, 27], width: 400, height: 440 }
    const result = computeEez({ Japan: [[136, 20.5]] }, grid)
    const expected = capAreaKm2(NM200_KM) // ≈ 43.1万km²
    expect(result.areaKm2.Japan).toBeGreaterThan(expected * 0.99)
    expect(result.areaKm2.Japan).toBeLessThan(expected * 1.01)
  })

  it('2国の等距離中間線で対称に分割される', () => {
    // 東西に300km離れた2つの孤島(200海里圏が大きく重複)
    const lat = 20
    const dLon = 300 / ((Math.PI / 180) * EARTH_RADIUS_KM * Math.cos(toRad(lat)))
    const grid: GridSpec = { bbox: [128, 12, 144, 28], width: 500, height: 520 }
    const result = computeEez(
      { A: [[136 - dLon / 2, lat]], B: [[136 + dLon / 2, lat]] },
      grid,
    )
    // 対称配置なので両国の面積はほぼ等しい
    const ratio = result.areaKm2.A / result.areaKm2.B
    expect(ratio).toBeGreaterThan(0.98)
    expect(ratio).toBeLessThan(1.02)
    // 合計は「キャップ2枚−重複」なのでキャップ2枚分より小さい
    expect(result.areaKm2.A + result.areaKm2.B).toBeLessThan(
      2 * capAreaKm2(NM200_KM),
    )
  })

  it('200海里の外は無所属(コード0)', () => {
    const grid: GridSpec = { bbox: [130, 14, 142, 27], width: 100, height: 110 }
    const result = computeEez({ Japan: [[136, 20.5]] }, grid)
    // グリッド四隅(島から200海里超)は0
    expect(result.codes[0]).toBe(0)
    expect(result.codes[grid.width - 1]).toBe(0)
    expect(result.codes[grid.width * (grid.height - 1)]).toBe(0)
    expect(result.codes[grid.width * grid.height - 1]).toBe(0)
  })
})

describe('updateEezWindow(差分更新)', () => {
  const grid: GridSpec = { bbox: [128, 12, 144, 28], width: 200, height: 210 }
  const before = { A: [[133, 20]] as [number, number][], B: [[139, 20]] as [number, number][] }
  const after = { A: [[133, 20]] as [number, number][], B: [[140, 22]] as [number, number][] }
  // 旧位置(139,20)・新位置(140,22)の400km圏を覆うwindow
  const win: [number, number, number, number] = [135, 16.4, 144, 25.6]

  it('島の移動後、window内差分更新が全域再計算と完全一致する', () => {
    const { state } = computeEezState(before, grid)
    const updated = updateEezWindow(state, after, win)
    const full = computeEez(after, grid)
    expect(Array.from(updated.codes)).toEqual(Array.from(full.codes))
    expect(updated.areaKm2.A).toBeCloseTo(full.areaKm2.A, 6)
    expect(updated.areaKm2.B).toBeCloseTo(full.areaKm2.B, 6)
  })

  it('静的kd木+動く点の総当たり方式でも全域再計算と完全一致する', () => {
    const { state } = computeEezState(before, grid)
    // 静的=Aのみの木、動く点=Bの新位置
    const staticBundle = buildTree({ A: after.A, B: [] }, state.countries)
    const moving = toMovingPoints(after.B, state.countries.indexOf('B') + 1)
    const updated = updateEezWindowPartial(state, staticBundle, moving, win)
    const full = computeEez(after, grid)
    expect(Array.from(updated.codes)).toEqual(Array.from(full.codes))
    expect(updated.areaKm2.A).toBeCloseTo(full.areaKm2.A, 6)
    expect(updated.areaKm2.B).toBeCloseTo(full.areaKm2.B, 6)
  })
})

describe('resolveBaseline', () => {
  const file = {
    countries: { Japan: [[140, 35]] as [number, number][], Russia: [[150, 45]] as [number, number][] },
    disputed: {
      'northern-territories': {
        defaultOwner: 'Japan',
        points: [[147, 45]] as [number, number][],
      },
    },
  }
  it('デフォルトは係争中(どの国にも帰属しない)', () => {
    const merged = resolveBaseline(file)
    expect(merged.Japan).toHaveLength(1)
    expect(merged.Russia).toHaveLength(1)
    expect(merged[DISPUTED_COUNTRY]).toEqual([[147, 45]])
  })
  it('係争中を明示しても同じ', () => {
    const merged = resolveBaseline(file, {
      disputedOwners: { 'northern-territories': '' },
    })
    expect(merged[DISPUTED_COUNTRY]).toHaveLength(1)
    expect(merged.Japan).toHaveLength(1)
  })
  it('帰属の上書きができる', () => {
    const merged = resolveBaseline(file, {
      disputedOwners: { 'northern-territories': 'Russia' },
    })
    expect(merged.Japan).toHaveLength(1)
    expect(merged.Russia).toHaveLength(2)
  })

  const fileWithIsland = {
    ...file,
    islands: {
      okinotorishima: {
        nameJa: '沖ノ鳥島',
        owner: 'Japan',
        anchor: [136, 20.4] as [number, number],
        points: [[136, 20.4]] as [number, number][],
      },
    },
  }
  it('係争地に属する島は係争グループの帰属に連動する', () => {
    const f = {
      ...file,
      islands: {
        etorofu: {
          nameJa: '択捉島',
          owner: 'Japan',
          disputeId: 'northern-territories',
          anchor: [148, 45] as [number, number],
          points: [[148, 45]] as [number, number][],
        },
      },
    }
    // 島定義のowner='Japan'は無視され、既定の「係争中」に従う
    expect(resolveBaseline(f).Japan).toHaveLength(1)
    expect(resolveBaseline(f)[DISPUTED_COUNTRY]).toHaveLength(2)
    // ロシアを選べば島も一緒に動く
    const ru = resolveBaseline(f, { disputedOwners: { 'northern-territories': 'Russia' } })
    expect(ru.Russia).toHaveLength(3)
    expect(ru[DISPUTED_COUNTRY]).toBeUndefined()
  })

  it('島はデフォルトでownerに現実位置で追加される', () => {
    const merged = resolveBaseline(fileWithIsland)
    expect(merged.Japan).toContainEqual([136, 20.4])
  })
  it('島のOFFで点群から除外される', () => {
    const merged = resolveBaseline(fileWithIsland, {
      islands: { okinotorishima: { enabled: false, lon: 136, lat: 20.4 } },
    })
    expect(merged.Japan).toHaveLength(1) // 元のJapan 1点のみ(係争地は別枠)
  })
  it('島の移動は平行移動として反映される', () => {
    const merged = resolveBaseline(fileWithIsland, {
      islands: { okinotorishima: { enabled: true, lon: 138, lat: 22.4 } },
    })
    expect(merged.Japan).toContainEqual([138, 22.4])
  })

  const disputedIslandFile = {
    ...file,
    islands: {
      spratly: {
        nameJa: '南沙諸島',
        owner: null,
        ownerOptions: ['China', 'Vietnam'],
        anchor: [114, 10] as [number, number],
        points: [[114, 10]] as [number, number][],
      },
    },
  }
  it('帰属未選択(owner=null)の島はどの国にも寄与しない', () => {
    const merged = resolveBaseline(disputedIslandFile)
    expect(merged.China).toBeUndefined()
    expect(merged.Vietnam).toBeUndefined()
  })
  it('帰属を選ぶとその国の点群に入る', () => {
    const merged = resolveBaseline(disputedIslandFile, {
      islands: { spratly: { enabled: true, lon: 114, lat: 10, owner: 'Vietnam' } },
    })
    expect(merged.Vietnam).toContainEqual([114, 10])
    expect(merged.China).toBeUndefined()
  })
})

describe('実データでの精度(受け入れ基準)', () => {
  const file = JSON.parse(
    readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../public/data/baseline-points.json',
      ),
      'utf8',
    ),
  ) as BaselineFile
  // 表示bboxと同じ範囲、約0.1度解像度
  const grid: GridSpec = { bbox: [110, 15, 160, 50], width: 500, height: 430 }

  /** 3つの係争地をすべて日本に割り当てた場合(=日本の主張どおり) */
  const allToJapan = {
    'northern-territories': 'Japan',
    takeshima: 'Japan',
    senkaku: 'Japan',
  }

  it('係争地を日本に割り当てると公称447万km²の±10%以内', () => {
    const result = computeEez(resolveBaseline(file, { disputedOwners: allToJapan }), grid)
    const japan = result.areaKm2.Japan
    const official = 4_470_000 // 領海+EEZの公称値
    expect(japan).toBeGreaterThan(official * 0.9)
    expect(japan).toBeLessThan(official * 1.1)
  })

  it('既定は係争中: どの国にも算入されず、日本に割り当てた分だけ増える', () => {
    const contested = computeEez(resolveBaseline(file), grid)
    const japanese = computeEez(resolveBaseline(file, { disputedOwners: allToJapan }), grid)
    const disputed = contested.areaKm2[DISPUTED_COUNTRY]
    expect(disputed).toBeGreaterThan(0)
    expect(japanese.areaKm2.Japan - contested.areaKm2.Japan).toBeCloseTo(disputed, 0)
    expect(japanese.areaKm2[DISPUTED_COUNTRY]).toBeUndefined()
  })

  it('相手国に割り当てても日本の面積は既定から変わらない', () => {
    const contested = computeEez(resolveBaseline(file), grid)
    const toOthers = computeEez(
      resolveBaseline(file, {
        disputedOwners: {
          'northern-territories': 'Russia',
          takeshima: 'South Korea',
          senkaku: 'China',
        },
      }),
      grid,
    )
    expect(toOthers.areaKm2.Japan).toBeCloseTo(contested.areaKm2.Japan, 0)
  })

  it('沖ノ鳥島OFFで日本EEZが約40万km²減る', () => {
    const on = computeEez(resolveBaseline(file), grid)
    const off = computeEez(
      resolveBaseline(file, {
        islands: { okinotorishima: { enabled: false, lon: 0, lat: 0 } },
      }),
      grid,
    )
    const diff = on.areaKm2.Japan - off.areaKm2.Japan
    expect(diff).toBeGreaterThan(330_000)
    expect(diff).toBeLessThan(480_000)
  })
})
