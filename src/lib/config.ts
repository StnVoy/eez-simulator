/** 対象範囲・配色などアプリ全体の定数 */

/** 初期表示範囲: 日本のEEZ全体が収まるbbox(余白込み) */
export const DEFAULT_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [120.5, 16],
  [159.5, 47.5],
]

/**
 * パン・ズームの可動範囲。データ範囲(東経90〜180°、北緯0〜60°)の
 * 内側に収め、データの切れ目が画面に入らないようにする
 */
export const MAX_BOUNDS: [[number, number], [number, number]] = [
  [92, 1],
  [178, 58],
]

/** 国別の塗り色(日本=青系、他国は識別しやすい別色。隣接国同士の衝突を避ける) */
export const COUNTRY_COLORS: Record<string, string> = {
  Japan: '#2b6cd4',
  China: '#d45252',
  'South Korea': '#2f9e63',
  'North Korea': '#8fae3d',
  Taiwan: '#e08a2e',
  Russia: '#9061c9',
  Philippines: '#2aa5a0',
  Vietnam: '#c4a02a',
  'United States': '#b0729e',
  'Marshall Islands': '#c07a5a',
  Indonesia: '#8a7a4a',
  Malaysia: '#7a6a9e',
  Thailand: '#d09077',
  Myanmar: '#7ca24d',
  Cambodia: '#b45f79',
  Singapore: '#697580',
  Brunei: '#c96f35',
  India: '#4a8a99',
  Bangladesh: '#9e5a48',
  Palau: '#4a7fa5',
  Micronesia: '#93a05a',
  'Papua New Guinea': '#5e8f7a',
  Kiribati: '#b08c3e',
  Nauru: '#8a5a6e',
}

/** 係争中・共同管理海域(pol_typeが200NM以外)の色 */
export const DISPUTED_COLOR = '#8a8f98'

/** 国名の日本語表記 */
export const COUNTRY_NAMES_JA: Record<string, string> = {
  Japan: '日本',
  China: '中国',
  'South Korea': '韓国',
  'North Korea': '北朝鮮',
  Taiwan: '台湾',
  Russia: 'ロシア',
  Philippines: 'フィリピン',
  Vietnam: 'ベトナム',
  'United States': 'アメリカ',
  'Marshall Islands': 'マーシャル諸島',
  Indonesia: 'インドネシア',
  Malaysia: 'マレーシア',
  Thailand: 'タイ',
  Myanmar: 'ミャンマー',
  Cambodia: 'カンボジア',
  Singapore: 'シンガポール',
  Brunei: 'ブルネイ',
  India: 'インド',
  Bangladesh: 'バングラデシュ',
  Palau: 'パラオ',
  Micronesia: 'ミクロネシア連邦',
  'Papua New Guinea': 'パプアニューギニア',
  Kiribati: 'キリバス',
  Nauru: 'ナウル',
}

/** 日本の国土面積(km²)— 比較表示用 */
export const JAPAN_LAND_AREA_KM2 = 378_000

/** 各国の国土面積(km²)— フォーカス国の「国土の何倍」表示用(概算) */
export const COUNTRY_LAND_AREA_KM2: Record<string, number> = {
  Japan: 377_975,
  China: 9_600_000,
  'South Korea': 100_210,
  'North Korea': 120_540,
  Taiwan: 36_197,
  Russia: 17_098_246,
  Philippines: 300_000,
  Vietnam: 331_212,
  'United States': 9_833_517,
  'Marshall Islands': 181,
  Indonesia: 1_904_569,
  Malaysia: 330_803,
  Thailand: 513_120,
  Myanmar: 676_578,
  Cambodia: 181_035,
  Singapore: 728,
  Brunei: 5_765,
  India: 3_287_263,
  Bangladesh: 147_570,
  Palau: 459,
  Micronesia: 702,
  'Papua New Guinea': 462_840,
  Kiribati: 811,
  Nauru: 21,
}

/** 日本のEEZ+領海の公称面積(km²)— 精度比較用 */
export const JAPAN_OFFICIAL_EEZ_KM2 = 4_470_000

/** EEZフィーチャの属性(Marine Regions由来) */
export interface EezProperties {
  mrgid: number
  geoname: string
  pol_type: '200NM' | 'Overlapping claim' | 'Joint regime'
  sovereign1: string
  sovereign2: string | null
  sovereign3: string | null
  territory1: string
  area_km2: number
}
