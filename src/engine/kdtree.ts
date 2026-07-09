/**
 * 3次元の静的kd木。単位球面上の点の最近傍検索に使う。
 * (弦長=ユークリッド距離は大圏距離と単調対応するので、
 *  平面近似なしに厳密な「最も近い基線点」が求まる)
 */
export class KdTree3 {
  /** xyzの平坦配列(長さ3n) */
  private readonly pts: Float64Array
  /** ノード順のインデックス(中央値分割で並べ替え済み) */
  private readonly idx: Uint32Array
  private readonly n: number

  constructor(coords: Float64Array) {
    if (coords.length % 3 !== 0) throw new Error('coords length must be 3n')
    this.pts = coords
    this.n = coords.length / 3
    this.idx = new Uint32Array(this.n)
    for (let i = 0; i < this.n; i++) this.idx[i] = i
    this.build(0, this.n, 0)
  }

  private build(lo: number, hi: number, axis: number): void {
    if (hi - lo <= 1) return
    const mid = (lo + hi) >> 1
    this.select(lo, hi, mid, axis)
    const next = (axis + 1) % 3
    this.build(lo, mid, next)
    this.build(mid + 1, hi, next)
  }

  /** idx[lo..hi)をaxis座標でquickselectし、k番目を確定させる */
  private select(lo: number, hi: number, k: number, axis: number): void {
    const { pts, idx } = this
    while (hi - lo > 1) {
      const pivot = pts[idx[(lo + hi) >> 1] * 3 + axis]
      let i = lo
      let j = hi - 1
      while (i <= j) {
        while (pts[idx[i] * 3 + axis] < pivot) i++
        while (pts[idx[j] * 3 + axis] > pivot) j--
        if (i <= j) {
          const t = idx[i]
          idx[i] = idx[j]
          idx[j] = t
          i++
          j--
        }
      }
      if (k <= j) hi = j + 1
      else if (k >= i) lo = i
      else return
    }
  }

  /** nearest()の作業用スタック(lo, hi, axis, deltaSq の4要素刻み) */
  private readonly stack = new Float64Array(256)
  /** nearest()の返却オブジェクト(セル数分の割り当てを避けるため再利用) */
  private readonly result = { index: -1, distSq: 0 }

  /**
   * (qx,qy,qz)の最近傍点を返す。
   * 反復実装(再帰クロージャはホットループで遅い)。
   * @param seedIndex 初期候補の点番号(前のクエリの答え等)。近い初期候補が
   *   あると枝刈りが効いて大幅に速くなる(空間的コヒーレンスの利用)
   * @returns 再利用オブジェクト {index, distSq}(次のnearest呼び出しで上書き)
   */
  nearest(
    qx: number,
    qy: number,
    qz: number,
    seedIndex = -1,
  ): { index: number; distSq: number } {
    const { pts, idx, stack } = this
    let bestD = Infinity
    let bestI = -1
    if (seedIndex >= 0) {
      const dx = pts[seedIndex * 3] - qx
      const dy = pts[seedIndex * 3 + 1] - qy
      const dz = pts[seedIndex * 3 + 2] - qz
      bestD = dx * dx + dy * dy + dz * dz
      bestI = seedIndex
    }

    stack[0] = 0
    stack[1] = this.n
    stack[2] = 0
    stack[3] = 0
    let sp = 4
    while (sp > 0) {
      sp -= 4
      if (stack[sp + 3] >= bestD) continue // 分割面がbestより遠ければ枝ごと捨てる
      let lo = stack[sp]
      let hi = stack[sp + 1]
      let axis = stack[sp + 2]
      // 近い側の子へは反復で降りる(遠い側だけスタックに積む)
      while (hi > lo) {
        const mid = (lo + hi) >> 1
        const i = idx[mid]
        const dx = pts[i * 3] - qx
        const dy = pts[i * 3 + 1] - qy
        const dz = pts[i * 3 + 2] - qz
        const d = dx * dx + dy * dy + dz * dz
        if (d < bestD) {
          bestD = d
          bestI = i
        }
        const q = axis === 0 ? qx : axis === 1 ? qy : qz
        const delta = q - pts[i * 3 + axis]
        const deltaSq = delta * delta
        let nearLo, nearHi, farLo, farHi
        if (delta < 0) {
          nearLo = lo
          nearHi = mid
          farLo = mid + 1
          farHi = hi
        } else {
          nearLo = mid + 1
          nearHi = hi
          farLo = lo
          farHi = mid
        }
        axis = axis === 2 ? 0 : axis + 1
        if (deltaSq < bestD && farHi > farLo) {
          stack[sp] = farLo
          stack[sp + 1] = farHi
          stack[sp + 2] = axis
          stack[sp + 3] = deltaSq
          sp += 4
        }
        lo = nearLo
        hi = nearHi
      }
    }
    this.result.index = bestI
    this.result.distSq = bestD
    return this.result
  }
}
