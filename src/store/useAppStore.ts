import { create } from 'zustand'
import { track } from '../lib/analytics'
import type { EezProperties } from '../lib/config'
import type {
  BaselineFile,
  EezResult,
  IslandDef,
  IslandState,
} from '../engine/types'

/** 表示モード: 実データ(Marine Regions) / 自前計算シミュレーション */
export type ViewMode = 'real' | 'sim'

/**
 * アプリ全体の状態(一方向フロー: UI操作 → ストア更新 → 地図/パネル再描画)
 */
interface AppState {
  /** 各国のEEZ総面積(km²、Marine Regions属性値)。データ読み込み後に設定 */
  realAreasKm2: Record<string, number> | null
  /** 面積・増減の主役として表示する国(既定=日本) */
  focusCountry: string
  /** クリックで選択中のEEZフィーチャ属性 */
  selected: EezProperties | null
  mode: ViewMode
  /** シミュレーション計算(確定計算)の実行中フラグ */
  simRunning: boolean
  /** 最後のシミュレーション計算結果(プレビュー含む) */
  simResult: EezResult | null
  /** 基線データ(起動時に読み込み) */
  baseline: BaselineFile | null
  /** サンドボックスで新設した島の定義(baseline.islandsに重ねる) */
  customIslands: Record<string, IslandDef>
  /** 島ごとの状態(位置・ON/OFF)。キーはbaseline/custom両方のid */
  islands: Record<string, IslandState>
  /** 係争地域の帰属(id→国名)。''=係争中。未設定は「係争中」として扱う */
  disputedOwners: Record<string, string>
  /** 全島ON・現実位置でのシミュレーション各国面積(増減表示の基準) */
  defaultSimAreasKm2: Record<string, number> | null
  /** 情報カードを表示中の島id(マーカークリックで選択) */
  selectedIslandId: string | null
  /** 情報カードを表示中の係争地id(⚖マーカークリックで選択) */
  selectedDisputeId: string | null
  /** 初見ヒントを消したか(操作を始めたら自動でtrue) */
  hintSeen: boolean
  /**
   * シミュレーションの「島をドラッグしてみよう」の吹き出しを見終えたか。
   * hintSeenとは別に持つ。実データ表示のヒントを閉じるとhintSeenが立つので、
   * 共用すると、吹き出しが必要になった瞬間(=シミュレーションに入った時)に
   * 消えてしまう
   */
  coachSeen: boolean
  /**
   * 一度でもシミュレーションモードに入ったか。
   * このアプリの主役はシミュレーションなので、入るまでは切替を目立たせる
   */
  simVisited: boolean
  /**
   * サンドボックス「島を新設」の配置待ち。値は設置する島の帰属国名。
   * null = 配置モードでない。次の地図クリックでこの国の島を設置する。
   */
  placing: string | null
  /** 距離測定モード(地図の2点をクリックして距離を測る) */
  measuring: boolean
  /** 直近の測定距離(km)。未測定はnull */
  measureKm: number | null
  /** 各島の 領海(12海里)と EEZ(200海里)の同心円を表示 */
  showTerritorial: boolean
  /**
   * 沖縄トラフ(中国がCLCSへ提出した大陸棚の外側限界)の参考線を表示。
   * EEZの計算には一切使わない。制度が違う(大陸棚 ≠ EEZ)
   */
  showTrough: boolean
  /** 表示中の解説コラムid(COLUMNSのキー)。nullなら閉じている */
  openColumnId: string | null
  setRealAreas: (v: Record<string, number>) => void
  setFocusCountry: (c: string) => void
  setSelected: (p: EezProperties | null) => void
  setSelectedIslandId: (id: string | null) => void
  setSelectedDisputeId: (id: string | null) => void
  setHintSeen: () => void
  setCoachSeen: () => void
  setPlacing: (v: string | null) => void
  setMeasuring: (v: boolean) => void
  setMeasureKm: (v: number | null) => void
  setShowTerritorial: (v: boolean) => void
  setShowTrough: (v: boolean) => void
  openColumn: (id: string) => void
  closeColumn: () => void
  setMode: (m: ViewMode) => void
  setSimRunning: (v: boolean) => void
  setSimResult: (r: EezResult) => void
  setBaseline: (f: BaselineFile) => void
  setIslandState: (id: string, patch: Partial<IslandState>) => void
  setDisputedOwner: (id: string, owner: string) => void
  addCustomIsland: (def: IslandDef) => string
  removeCustomIsland: (id: string) => void
  resetIslands: () => void
  setDefaultSimAreas: (v: Record<string, number>) => void
}

/** baselineの島定義から初期状態(全島ON・現実位置)を作る */
function defaultIslands(file: BaselineFile): Record<string, IslandState> {
  const out: Record<string, IslandState> = {}
  for (const [id, isl] of Object.entries(file.islands)) {
    out[id] = { enabled: true, lon: isl.anchor[0], lat: isl.anchor[1] }
  }
  return out
}

/** baseline島+サンドボックス島の定義をまとめて返す */
export function islandDefs(s: AppState): Record<string, IslandDef> {
  return { ...(s.baseline?.islands ?? {}), ...s.customIslands }
}

let customSeq = 0

export const useAppStore = create<AppState>((set) => ({
  realAreasKm2: null,
  focusCountry: 'Japan',
  selected: null,
  mode: 'real',
  simRunning: false,
  simResult: null,
  baseline: null,
  customIslands: {},
  islands: {},
  disputedOwners: {},
  defaultSimAreasKm2: null,
  selectedIslandId: null,
  selectedDisputeId: null,
  hintSeen: false,
  coachSeen: false,
  simVisited: false,
  placing: null,
  measuring: false,
  measureKm: null,
  showTerritorial: false,
  showTrough: false,
  openColumnId: null,
  setRealAreas: (v) => set({ realAreasKm2: v }),
  setFocusCountry: (c) => set({ focusCountry: c }),
  setSelected: (p) => set({ selected: p }),
  // 島と係争地のカードは同時に1つだけ表示する
  setSelectedIslandId: (id) => set({ selectedIslandId: id, selectedDisputeId: null }),
  setSelectedDisputeId: (id) => set({ selectedDisputeId: id, selectedIslandId: null }),
  setHintSeen: () => set({ hintSeen: true }),
  setCoachSeen: () => set({ coachSeen: true }),
  setPlacing: (v) => set({ placing: v }),
  // 測定モードのON/OFF切替時は前回の測定結果をクリア
  setMeasuring: (v) => set({ measuring: v, measureKm: null }),
  setMeasureKm: (v) => set({ measureKm: v }),
  setShowTerritorial: (v) => set({ showTerritorial: v }),
  setShowTrough: (v) => set({ showTrough: v }),
  openColumn: (id) => {
    track('column_open', { column: id })
    set({ openColumnId: id })
  },
  closeColumn: () => set({ openColumnId: null }),
  // シミュレーションに入ったら切替の強調は終わる。ヒントは中身が変わる
  // (実データ=切替の案内 / シミュレーション=ドラッグの案内)ので消さない
  setMode: (m) => set(m === 'sim' ? { mode: m, simVisited: true } : { mode: m }),
  setSimRunning: (v) => set({ simRunning: v }),
  setSimResult: (r) => set({ simResult: r, simRunning: false }),
  setBaseline: (f) => set({ baseline: f, islands: defaultIslands(f) }),
  setIslandState: (id, patch) =>
    set((s) => ({ islands: { ...s.islands, [id]: { ...s.islands[id], ...patch } } })),
  setDisputedOwner: (id, owner) =>
    set((s) => ({ disputedOwners: { ...s.disputedOwners, [id]: owner } })),
  addCustomIsland: (def) => {
    const id = `custom-${++customSeq}`
    set((s) => ({
      customIslands: { ...s.customIslands, [id]: def },
      islands: {
        ...s.islands,
        [id]: { enabled: true, lon: def.anchor[0], lat: def.anchor[1] },
      },
    }))
    return id
  },
  removeCustomIsland: (id) =>
    set((s) => {
      const customIslands = { ...s.customIslands }
      const islands = { ...s.islands }
      delete customIslands[id]
      delete islands[id]
      return {
        customIslands,
        islands,
        selectedIslandId: s.selectedIslandId === id ? null : s.selectedIslandId,
      }
    }),
  // 現実の状態に戻す: 島の位置・ON/OFF・係争帰属を既定へ、サンドボックス島は消す
  resetIslands: () =>
    set((s) =>
      s.baseline
        ? { islands: defaultIslands(s.baseline), customIslands: {}, disputedOwners: {} }
        : {},
    ),
  setDefaultSimAreas: (v) => set({ defaultSimAreasKm2: v }),
}))
