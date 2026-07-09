/** エンジンの入出力型(UIスレッド・Worker・テスト共用) */

export type LonLat = [number, number]

/** scripts/fetch-data.mjs が生成する baseline-points.json の形 */
export interface BaselineFile {
  spacingKm: number
  bbox: [number, number, number, number]
  countries: Record<string, LonLat[]>
  disputed: Record<string, DisputedGroup>
  islands: Record<string, IslandDef>
}

/** 係争地域(北方領土・竹島・尖閣など)。帰属をユーザーが切替可能 */
export interface DisputedGroup {
  nameJa: string
  /** 領有を主張する当事国(先頭が既定の帰属=日本の公式見解ベース) */
  claimants: string[]
  defaultOwner: string
  /** マーカー表示用の代表点 */
  centroid: LonLat
  points: LonLat[]
}

/** ドラッグ/ON・OFF可能な島の定義(baseline由来・サンドボックス共通) */
export interface IslandDef {
  nameJa: string
  /** 既定の帰属国。null=未帰属(どの国のEEZにもならない) */
  owner: string | null
  /** 指定時は帰属をユーザーが選択できる(係争地・カスタム島) */
  ownerOptions?: string[]
  /** 点群の重心(ドラッグの基準点) */
  anchor: LonLat
  points: LonLat[]
  /** サンドボックスで新設した島(削除可能) */
  custom?: boolean
  /** 係争地域に属する島。帰属はこの係争グループの切替に連動する */
  disputeId?: string
}

/** 島の実行時状態(ドラッグ位置とON/OFF、帰属の上書き) */
export interface IslandState {
  enabled: boolean
  /** 現在位置(anchorからの移動を反映) */
  lon: number
  lat: number
  /** 帰属の上書き(選択可能な島のみ)。未設定なら定義のowner */
  owner?: string | null
}

/** 国ごとの基線点群(係争地域・島の帰属/位置解決後) */
export type PointsByCountry = Record<string, LonLat[]>

/** 計算グリッド。行はメルカトル縦座標で等分(タイル表示と整合) */
export interface GridSpec {
  /** [west, south, east, north] 度 */
  bbox: [number, number, number, number]
  /** 列数(経度方向) */
  width: number
  /** 行数(メルカトルy方向) */
  height: number
}

/** グリッド上の変更範囲(行・列、半開区間) */
export interface DirtyRange {
  r0: number
  r1: number
  c0: number
  c1: number
}

export interface EezResult {
  grid: GridSpec
  /** 国名リスト。codesの値は (index+1)、0は無所属(公海) */
  countries: string[]
  /** 行優先 width×height。行0が北端 */
  codes: Uint8Array
  /** 国ごとの獲得面積(km²) */
  areaKm2: Record<string, number>
  /** 前回結果から変わり得る範囲(部分再描画用)。undefinedなら全域 */
  dirty?: DirtyRange
  /** 計算時間(ms) */
  elapsedMs: number
}

/**
 * バンド計算(Workerプール用)。各Workerは行をインターリーブで担当する
 * (Worker iが行 rowOffset, rowOffset+rowStride, … を受け持つ)。
 * 局所的な差分更新でも全Workerに均等に仕事が分散する。
 */
export interface BandComputeRequest {
  type: 'compute'
  requestId: number
  points: PointsByCountry
  grid: GridSpec
  /** 国コードの割当順(全Workerで一致させる) */
  countries: string[]
  rowOffset: number
  rowStride: number
}

/**
 * 差分更新: キャッシュ済みバンドのwindow交差部分だけ再分類(ドラッグ用)。
 * ドラッグ中に動くのは島の点群だけなので、静的な点群(kd木)は
 * staticVersionが変わった時だけ送信・再構築し、動く点は毎回送る
 * (Worker側で総当たり判定。点数は高々数十)
 */
export interface BandUpdateRequest {
  type: 'update'
  requestId: number
  /** 静的点群の版数。Workerはこの版のkd木をキャッシュする */
  staticVersion: number
  /** staticVersionが前回と違う場合のみ同梱される静的点群 */
  staticPoints?: PointsByCountry
  /** ドラッグ中の島の所属国 */
  movingCountry: string
  /** ドラッグ中の島の点群(現在位置) */
  movingPoints: LonLat[]
  /** [west, south, east, north] 度 */
  window: [number, number, number, number]
}

export type WorkerRequest = BandComputeRequest | BandUpdateRequest

export interface BandResponse {
  type: 'result'
  requestId: number
  /** 変更がなかった場合はcodes/areaByCodeを省略 */
  changed: boolean
  rowOffset: number
  rowStride: number
  /** codesに含まれる行範囲 [gatherR0, gatherR1)(担当行のみ抽出済み) */
  gatherR0: number
  gatherR1: number
  /** 範囲内の担当行を行順に詰めたコード配列 */
  codes?: Uint8Array
  /** 担当行全体の国別面積(index=国コード) */
  areaByCode?: Float64Array
  /** このWorkerが実際に再分類した範囲(グリッド絶対座標) */
  dirty?: DirtyRange
  elapsedMs: number
}
