/**
 * 世界の主要国のEEZ面積・国土面積(概算、万km²)。
 * 出典により数値に幅があるため概算値。EEZは Sea Around Us / Marine Regions 系、
 * 国土は各国公表値をもとにした代表値。
 * 「小さな国土でも遠方の島々で巨大なEEZを持つ」ことを見せるためのデータ。
 */
export interface WorldEezEntry {
  /** 国名(内部キー。COUNTRY_NAMES_JAと一致するものは日本語化される) */
  key: string
  nameJa: string
  /** EEZ面積(万km²) */
  eezManKm2: number
  /** 国土面積(万km²) */
  landManKm2: number
  /** 島々でEEZが拡大している代表例か(注記用) */
  islandDriven?: boolean
}

export const WORLD_EEZ: WorldEezEntry[] = [
  { key: 'United States', nameJa: 'アメリカ', eezManKm2: 1135, landManKm2: 963, islandDriven: true },
  { key: 'France', nameJa: 'フランス', eezManKm2: 1020, landManKm2: 55, islandDriven: true },
  { key: 'Australia', nameJa: 'オーストラリア', eezManKm2: 848, landManKm2: 769 },
  { key: 'Russia', nameJa: 'ロシア', eezManKm2: 760, landManKm2: 1710 },
  { key: 'United Kingdom', nameJa: 'イギリス', eezManKm2: 680, landManKm2: 24, islandDriven: true },
  { key: 'Indonesia', nameJa: 'インドネシア', eezManKm2: 601, landManKm2: 191 },
  { key: 'Canada', nameJa: 'カナダ', eezManKm2: 559, landManKm2: 998 },
  { key: 'Japan', nameJa: '日本', eezManKm2: 447, landManKm2: 38, islandDriven: true },
  { key: 'New Zealand', nameJa: 'ニュージーランド', eezManKm2: 408, landManKm2: 27, islandDriven: true },
  { key: 'Chile', nameJa: 'チリ', eezManKm2: 350, landManKm2: 76 },
  { key: 'Kiribati', nameJa: 'キリバス', eezManKm2: 349, landManKm2: 0.08, islandDriven: true },
  { key: 'Micronesia', nameJa: 'ミクロネシア連邦', eezManKm2: 298, landManKm2: 0.07, islandDriven: true },
  { key: 'Brazil', nameJa: 'ブラジル', eezManKm2: 317, landManKm2: 851 },
]
