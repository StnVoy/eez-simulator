import type { GridSpec } from '../engine/types'

/**
 * シミュレーション計算のグリッド設定。行数はメルカトル空間で
 * セルが正方形に近くなるように選んである。
 */

/** 確定計算用の高解像度(0.045°≈4.4km/セル)。可動範囲全体を覆う */
export const SIM_GRID: GridSpec = {
  bbox: [90, 0, 180, 60],
  width: 2000,
  height: 1677,
}

/**
 * 島の寄与計算など裏方の単発計算用(中解像度)。
 * 南沙諸島やサンドボックス島は広域のどこにでも置けるので、
 * SIM_GRIDと同じ範囲全体を覆う
 */
export const CONTRIB_GRID: GridSpec = {
  bbox: [90, 0, 180, 60],
  width: 900,
  height: 755,
}

/**
 * 島の移動で割り当てが変わり得る影響半径(km)。
 * 変化は旧位置・新位置の200海里(370.4km)圏内に限られるため、
 * グリッド離散化の余裕を足した値
 */
export const INFLUENCE_RADIUS_KM = 400
