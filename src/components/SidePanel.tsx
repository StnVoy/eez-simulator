import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react'
import {
  COUNTRY_COLORS,
  COUNTRY_LAND_AREA_KM2,
  COUNTRY_NAMES_JA,
  DISPUTED_COLOR,
} from '../lib/config'
import { islandDefs, useAppStore } from '../store/useAppStore'
import { useAnimatedNumber } from '../lib/useAnimatedNumber'
import {
  ARTICLE121,
  ISLAND_INFO,
  LOCKED_ISLAND_IDS,
  SCENARIOS,
} from '../data/islandInfo'
import { WorldRanking } from './WorldRanking'
import { WORLD_EEZ } from '../data/worldEez'
import { DISPUTED_COUNTRY } from '../engine/types'
import {
  applyScenario,
  getIslandContribution,
  removeIsland,
  setDisputeOwner,
  setIslandOwner,
  setViewMode,
  toggleIsland,
} from '../sim/controller'

/** 帰属先の表示名。DISPUTED_COUNTRYは擬似的な帰属先なので専用の名前にする */
function ownerName(key: string): string {
  if (key === DISPUTED_COUNTRY) return '係争中(どの国にも属さない)'
  return COUNTRY_NAMES_JA[key] ?? key
}

function formatArea(km2: number): string {
  return `${Math.round(km2).toLocaleString('ja-JP')} km²`
}

/** 増減を「+12.3万km²」の形式で表す */
function formatDelta(km2: number): string {
  const man = Math.abs(km2) / 10000
  const sign = km2 > 0 ? '+' : '−'
  return `${sign}${man >= 100 ? Math.round(man) : man.toFixed(1)}万km²`
}

/** 選択中フィーチャの見出しを日本語化 */
function describeSelected(p: {
  pol_type: string
  sovereign1: string
  sovereign2: string | null
  geoname: string
}): { title: string; note?: string } {
  const ja = (s: string | null) => (s ? (COUNTRY_NAMES_JA[s] ?? s) : '')
  if (p.pol_type === 'Overlapping claim') {
    return {
      title: `係争中/未画定海域(${[p.sovereign1, p.sovereign2].filter(Boolean).map(ja).join('・')})`,
      note: '複数の国・地域が権利を主張している海域です。本アプリは特定の立場を示しません。',
    }
  }
  if (p.pol_type === 'Joint regime') {
    return {
      title: `共同管理水域(${[p.sovereign1, p.sovereign2].filter(Boolean).map(ja).join('・')})`,
      note: '関係国が共同で管理する取り決めのある海域です。',
    }
  }
  return { title: `${ja(p.sovereign1)}のEEZ` }
}

/** 島の情報カード(帰属選択・第121条トグル・EEZ寄与・豆知識) */
function IslandCard({ islandId }: { islandId: string }) {
  const island = useAppStore((s) => islandDefs(s)[islandId])
  const st = useAppStore((s) => s.islands[islandId])
  // 実データ表示中はシミュレーションの操作を受け付けない
  const frozen = useAppStore((s) => s.simRunning || s.mode === 'real')
  const simRunning = frozen
  const setSelectedIslandId = useAppStore((s) => s.setSelectedIslandId)
  const [contribution, setContribution] = useState<{
    owner: string | null
    diff: number
  } | null>(null)

  // 帰属・位置・ON/OFFが変わるたびに寄与を再計算する
  const owner = st?.owner ?? island?.owner ?? null
  const posKey = st ? `${st.lon.toFixed(3)},${st.lat.toFixed(3)},${st.enabled}` : ''
  useEffect(() => {
    let cancelled = false
    setContribution(null)
    getIslandContribution(islandId)
      .then((v) => {
        if (!cancelled) setContribution(v)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [islandId, owner, posKey])

  if (!island || !st) return null
  const info = ISLAND_INFO[islandId]
  const art121 = ARTICLE121[islandId]
  // 領有権が争われている島は、動かすことも消すこともできない
  const locked = LOCKED_ISLAND_IDS.has(islandId)
  const ja = (c: string | null) => (c ? (COUNTRY_NAMES_JA[c] ?? c) : '未帰属')

  return (
    <section className="panel-card panel-card-island">
      <div className="island-card-header">
        <h2>{island.nameJa}</h2>
        <button
          className="close-button"
          aria-label="カードを閉じる"
          onClick={() => setSelectedIslandId(null)}
        >
          ×
        </button>
      </div>

      {island.ownerOptions && (
        <div className="island-owner">
          <label>
            支配国:
            <select
              value={owner ?? ''}
              disabled={simRunning}
              onChange={(e) =>
                void setIslandOwner(islandId, e.target.value || null)
              }
            >
              <option value="">
                {info?.unassignedLabel ?? '未帰属(どの国のEEZにもならない)'}
              </option>
              {island.ownerOptions.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_NAMES_JA[c] ?? c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {art121 && (
        <div className="art121">
          <span className="art121-label">国連海洋法条約 第121条:</span>
          <div className="art121-toggle">
            <button
              className={st.enabled ? 'active' : ''}
              disabled={simRunning}
              onClick={() => {
                if (!st.enabled) void toggleIsland(islandId)
              }}
            >
              {art121.islandSide}
            </button>
            <button
              className={!st.enabled ? 'active' : ''}
              disabled={simRunning}
              onClick={() => {
                if (st.enabled) void toggleIsland(islandId)
              }}
            >
              {art121.rockSide}
            </button>
          </div>
        </div>
      )}

      <dl className="island-facts">
        {info && (
          <>
            <dt>島の面積</dt>
            <dd>{info.landAreaText}</dd>
          </>
        )}
        <dt>生み出すEEZ</dt>
        <dd>
          {!st.enabled
            ? 'なし(OFF)'
            : contribution === null
              ? '計算中…'
              : contribution.owner === null
                ? '支配国を選ぶと表示'
                : `${ja(contribution.owner)}に 約${(contribution.diff / 10000).toFixed(1)}万km²`}
        </dd>
      </dl>

      {info && <p className="area-note">{info.trivia}</p>}
      {info?.note && <p className="area-footnote">※ {info.note}</p>}

      {info?.columnId && <ColumnLink columnId={info.columnId} />}

      {island.custom ? (
        <button
          className="action-button action-button-danger"
          disabled={simRunning}
          onClick={() => void removeIsland(islandId)}
        >
          この島を削除
        </button>
      ) : (
        // 実在する島は「消す」=OFF。いつでも復活できる。
        // ただし領有権が争われている島は、動かすことも消すこともさせない
        !art121 &&
        !locked && (
          <button
            className="action-button action-button-subtle"
            disabled={simRunning}
            onClick={() => void toggleIsland(islandId)}
          >
            {st.enabled ? 'この島を消す(EEZから除く)' : '島を復活させる'}
          </button>
        )
      )}
      {locked && (
        <p className="locked-note">
          🔒 領有権が争われている島です。移動もON/OFFもできません。領有権は条約と歴史と実効支配の問題であって、島の位置の問題ではないからです。
        </p>
      )}
    </section>
  )
}

/**
 * 折りたためるパネルのまとまり。
 * 全部を開いたまま縦に積むとメニューが長くなりすぎるので、
 * よく使うもの(島リスト)だけ開いた状態にし、残りは畳んでおく。
 */
function Section({
  title,
  defaultOpen = false,
  tone,
  children,
}: {
  title: string
  defaultOpen?: boolean
  tone?: 'dispute'
  children: React.ReactNode
}) {
  return (
    <details
      className={`panel-card panel-section${tone ? ` panel-card-${tone}` : ''}`}
      open={defaultOpen}
    >
      <summary>
        <h2>{title}</h2>
      </summary>
      <div className="panel-section-body">{children}</div>
    </details>
  )
}

/** 解説コラムを開くリンクボタン */
function ColumnLink({ columnId, label }: { columnId: string; label?: string }) {
  const openColumn = useAppStore((s) => s.openColumn)
  return (
    <button className="column-link" onClick={() => openColumn(columnId)}>
      {label ?? '📖 各国の主張と出典を読む'}
    </button>
  )
}

/** 係争地の情報カード(帰属を 日本/係争中/相手国 で切替) */
function DisputeCard({ disputeId }: { disputeId: string }) {
  const dispute = useAppStore((s) => s.baseline?.disputed[disputeId])
  const disputedOwners = useAppStore((s) => s.disputedOwners)
  const simRunning = useAppStore((s) => s.simRunning || s.mode === 'real')
  const setSelectedDisputeId = useAppStore((s) => s.setSelectedDisputeId)
  if (!dispute) return null
  // 既定は「係争中」。島を動かしただけで特定の国のものになってはいけない
  const current = disputedOwners[disputeId] ?? ''
  const opponent = dispute.claimants.find((c) => c !== 'Japan') ?? ''

  return (
    <section className="panel-card panel-card-dispute">
      <div className="island-card-header">
        <h2>{dispute.nameJa}(領土問題)</h2>
        <button
          className="close-button"
          aria-label="カードを閉じる"
          onClick={() => setSelectedDisputeId(null)}
        >
          ×
        </button>
      </div>
      <p className="area-note">
        日本と{COUNTRY_NAMES_JA[opponent] ?? opponent}が領有を争う海域です。どちらのものにするか、あるいは「係争中(どちらにもしない)」かを選べます。
      </p>
      <div className="dispute-toggle">
        <button
          className={current === 'Japan' ? 'active' : ''}
          disabled={simRunning}
          onClick={() => void setDisputeOwner(disputeId, 'Japan')}
        >
          日本
        </button>
        <button
          className={current === '' ? 'active' : ''}
          disabled={simRunning}
          onClick={() => void setDisputeOwner(disputeId, '')}
        >
          係争中
        </button>
        <button
          className={current === opponent ? 'active' : ''}
          disabled={simRunning}
          onClick={() => void setDisputeOwner(disputeId, opponent)}
        >
          {COUNTRY_NAMES_JA[opponent] ?? opponent}
        </button>
      </div>
      <ColumnLink columnId={disputeId} />
      <p className="area-footnote">
        既定は「係争中」で、どの国のEEZにも算入しません。境界の引き方(中間線)は、どの国を選んでも変わりません。
      </p>
    </section>
  )
}

const MOBILE_QUERY = '(max-width: 800px)'
/** ボトムシートのスナップ位置(app-mainの高さに対する比) */
const SNAPS = [0.3, 0.55, 0.88]
/** 掴んで動かす前のクリック判定に使う移動量(px) */
const TAP_SLOP = 4
/** シートを縮めても地図がこれ以上潰れないようにする(px) */
const MIN_MAP_HEIGHT = 96
/** シートの最小高さ。グラバーと1行分が見える程度(px) */
const MIN_SHEET_HEIGHT = 56

/**
 * スマホでサイドパネルをボトムシートにして、高さを変えられるようにする。
 * グラバーをドラッグすると連続的に、タップするとスナップ位置を巡回する。
 * デスクトップでは何もしない(heightはnullのままCSSに任せる)。
 */
function useBottomSheet() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
  const [height, setHeight] = useState<number | null>(null)
  const asideRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ startY: number; startH: number; moved: boolean } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      setIsMobile(mq.matches)
      setHeight(null) // 画面が切り替わったらCSSの既定に戻す
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  /** 地図が潰れない範囲に高さを収める */
  const clampHeight = (h: number): number => {
    const main = asideRef.current?.parentElement
    const maxH = main ? main.clientHeight - MIN_MAP_HEIGHT : h
    return Math.max(MIN_SHEET_HEIGHT, Math.min(maxH, h))
  }

  /** 地図(MapLibre)に新しいサイズを気づかせる */
  const notifyResize = () => window.dispatchEvent(new Event('resize'))

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const aside = asideRef.current
    if (!aside) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startY: e.clientY,
      startH: aside.getBoundingClientRect().height,
      moved: false,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const dy = d.startY - e.clientY // 上に動かすほどシートが高くなる
    if (Math.abs(dy) > TAP_SLOP) d.moved = true
    setHeight(clampHeight(d.startH + dy))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (d && !d.moved) cycleSnap()
    notifyResize()
  }

  /**
   * タップ: 次に大きいスナップへ。一番上まで来たら一番下へ戻る。
   * 比率ではなくクランプ後のpxで比べる。一番上のスナップは地図の
   * 最小高さで切り詰められることがあり、比率のままだと自分自身を
   * 「次」に選び続けて巡回が止まってしまう
   */
  const cycleSnap = () => {
    const aside = asideRef.current
    const main = aside?.parentElement
    if (!aside || !main) return
    const snapPx = SNAPS.map((s) => clampHeight(s * main.clientHeight))
    const cur = aside.getBoundingClientRect().height
    const next = snapPx.find((h) => h > cur + 8) ?? snapPx[0]
    setHeight(next)
    notifyResize()
  }

  /** キーボードでも動かせるように(role=separator) */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const aside = asideRef.current
    if (!aside) return
    const cur = height ?? aside.getBoundingClientRect().height
    if (e.key === 'ArrowUp') setHeight(clampHeight(cur + 32))
    else if (e.key === 'ArrowDown') setHeight(clampHeight(cur - 32))
    else if (e.key === 'Enter' || e.key === ' ') cycleSnap()
    else return
    e.preventDefault()
    notifyResize()
  }

  return {
    asideRef,
    style: isMobile && height !== null ? { height: `${height}px` } : undefined,
    grabberProps: { onPointerDown, onPointerMove, onPointerUp, onKeyDown },
  }
}

export function SidePanel() {
  const realAreas = useAppStore((s) => s.realAreasKm2)
  const focusCountry = useAppStore((s) => s.focusCountry)
  const setFocusCountry = useAppStore((s) => s.setFocusCountry)
  const selected = useAppStore((s) => s.selected)
  const mode = useAppStore((s) => s.mode)
  const simRunning = useAppStore((s) => s.simRunning)
  const simResult = useAppStore((s) => s.simResult)
  const baseline = useAppStore((s) => s.baseline)
  const customIslands = useAppStore((s) => s.customIslands)
  const islands = useAppStore((s) => s.islands)
  const defaultSimAreas = useAppStore((s) => s.defaultSimAreasKm2)
  const selectedIslandId = useAppStore((s) => s.selectedIslandId)
  const selectedDisputeId = useAppStore((s) => s.selectedDisputeId)
  const placing = useAppStore((s) => s.placing)
  const setPlacing = useAppStore((s) => s.setPlacing)
  const setSelectedIslandId = useAppStore((s) => s.setSelectedIslandId)
  const disputedOwners = useAppStore((s) => s.disputedOwners)
  const measuring = useAppStore((s) => s.measuring)
  const setMeasuring = useAppStore((s) => s.setMeasuring)
  const measureKm = useAppStore((s) => s.measureKm)
  const showTerritorial = useAppStore((s) => s.showTerritorial)
  const setShowTerritorial = useAppStore((s) => s.setShowTerritorial)
  const showTrough = useAppStore((s) => s.showTrough)
  const setShowTrough = useAppStore((s) => s.setShowTrough)
  const openColumn = useAppStore((s) => s.openColumn)
  const [placeCountry, setPlaceCountry] = useState('Japan')
  const { asideRef, style, grabberProps } = useBottomSheet()

  const allIslands = { ...(baseline?.islands ?? {}), ...customIslands }
  const focusJa = COUNTRY_NAMES_JA[focusCountry] ?? focusCountry

  const isSim = mode === 'sim' && simResult !== null
  /** 実データ表示中・計算中はシミュレーションの操作を受け付けない */
  const frozen = simRunning || mode === 'real'
  const rawArea = isSim
    ? (simResult.areaKm2[focusCountry] ?? 0)
    : (realAreas?.[focusCountry] ?? null)
  const shownArea = useAnimatedNumber(rawArea, 450)
  const landArea = COUNTRY_LAND_AREA_KM2[focusCountry]
  const ratio =
    shownArea !== null && landArea ? (shownArea / landArea).toFixed(1) : null
  // この地図(太平洋西部)に収まらない国は、実データの合計が全世界の値に届かない。
  // 世界ランキングの値と大きく食い違えば、その旨を注記する。
  // 日本は全域が地図内にあり、公称値との差は係争海域の切り出しによるもの
  // (0.85のしきい値はそれを誤検知しないため。日本は91%)
  const worldRef = WORLD_EEZ.find((e) => e.key === focusCountry)
  const partialCoverage =
    !isSim &&
    worldRef &&
    focusCountry !== 'Japan' &&
    rawArea !== null &&
    rawArea < worldRef.eezManKm2 * 10_000 * 0.85
      ? worldRef
      : null
  const delta =
    isSim && defaultSimAreas !== null
      ? (simResult.areaKm2[focusCountry] ?? 0) -
        (defaultSimAreas[focusCountry] ?? 0)
      : null

  // 国別の増減。比較対象は実データではなく「操作前のシミュレーション既定状態」
  const countryDeltas =
    isSim && defaultSimAreas !== null
      ? simResult.countries
          .map((c) => ({
            country: c,
            delta: (simResult.areaKm2[c] ?? 0) - (defaultSimAreas[c] ?? 0),
          }))
          .filter((d) => Math.abs(d.delta) >= 10_000)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      : []

  return (
    <aside className="side-panel" ref={asideRef} style={style}>
      {/* スマホでのみ表示。掴んで高さを変え、タップでスナップ位置を巡回する */}
      <div
        className="panel-grabber"
        role="separator"
        aria-orientation="horizontal"
        aria-label="パネルの高さを変える"
        tabIndex={0}
        {...grabberProps}
      >
        <span className="panel-grabber-bar" />
      </div>

      <div className="panel-scroll">
      <section className="panel-card panel-card-primary">
        <div className="focus-head">
          <h2>{focusJa}のEEZ面積{isSim ? '(自前計算)' : ''}</h2>
          <select
            className="focus-select"
            value={focusCountry}
            onChange={(e) => setFocusCountry(e.target.value)}
            aria-label="表示する国"
          >
            {Object.keys(COUNTRY_COLORS).map((c) => (
              <option key={c} value={c}>
                {COUNTRY_NAMES_JA[c] ?? c}
              </option>
            ))}
          </select>
        </div>
        <p className="area-value">
          {shownArea !== null ? formatArea(shownArea) : '読み込み中…'}
        </p>
        {delta !== null && Math.abs(delta) > 10000 && (
          <p className="delta-row">
            <span className={`delta-badge ${delta > 0 ? 'delta-up' : 'delta-down'}`}>
              操作前より{formatDelta(delta)}
            </span>
          </p>
        )}
        {ratio && (
          <p className="area-note">
            国土面積(約{(landArea / 10000).toFixed(landArea < 10000 ? 2 : 1)}万km²)の約{ratio}倍
          </p>
        )}
        <p className="area-footnote">
          {isSim
            ? '※ 等距離中間線モデルによる自前計算。北方領土・竹島・尖閣は既定で「係争中」とし、どの国の面積にも算入していません。'
            : focusCountry === 'Japan'
              ? // 公称値との差は「領海の有無」ではなく「係争海域の切り出し」による。
                // MRのポリゴンは領海を含む(海岸から8kmの点も内側にある)
                '※ Marine Regionsの算出値。北方領土・尖閣・竹島の周辺と日韓暫定水域(合計約37万km²)は「係争中/共同管理」の別海域として切り出されており、この数字には含まれません。足し戻すと約444万km²で、日本の公称値(約447万km²)の99.3%になります。'
              : '※ Marine Regionsの算出値。係争中・共同管理の海域は、どの国の取り分とも決まっていないため含みません。'}
        </p>
        {isSim && focusCountry === 'Japan' && realAreas?.Japan != null && (
          <p className="area-footnote">
            ※ 実データでは {formatArea(realAreas.Japan)}。差の約42.6万km²は計算モデルの違いで、係争海域の帰属は変わっていません(下の「計算方法」に内訳)。
          </p>
        )}
        {partialCoverage && (
          <p className="area-footnote">
            ※ この地図は太平洋西部だけを収めているため、{focusJa}
            のEEZはこの範囲に入るぶんしか集計できていません(全世界では約
            {partialCoverage.eezManKm2.toLocaleString('ja-JP')}万km²)。
          </p>
        )}
        <div className="column-link-row">
          <ColumnLink columnId="what-is-eez" label="🌊 EEZとは？" />
          <ColumnLink columnId="method" label="📐 計算方法" />
        </div>
      </section>

      {mode === 'real' && (
        <section className="panel-card panel-card-mode">
          <h2>いまは実データ表示です</h2>
          <p className="area-note">
            Marine Regions が公表しているEEZの区画を、そのまま描いています。
            <strong>島は動かせません。</strong>
          </p>
          <button
            className="action-button action-button-cta"
            disabled={simRunning || !baseline}
            onClick={() => void setViewMode('sim')}
          >
            {simRunning ? '計算中…' : '▶ シミュレーションを始める'}
          </button>
          <p className="area-note mode-card-lead">
            島をドラッグしたり消したりすると、EEZがその場で計算し直されます。沖ノ鳥島を消すと日本のEEZが41万km²消えます ―― 国土面積より広い。
          </p>
          <p className="area-footnote">
            2つは別のモデルです。実データは各国の交渉結果を反映していますが、自前計算は全ての島に等しく200海里の効果を与えます。係争海域の形も広さも変わります。
          </p>
        </section>
      )}

      {countryDeltas.length > 0 && (
        <section className="panel-card">
          <h2>各国のEEZ増減(操作前との差)</h2>
          <ul className="country-delta-list">
            {countryDeltas.map(({ country, delta: d }) => (
              <li key={country}>
                <span
                  className="swatch"
                  style={{ backgroundColor: COUNTRY_COLORS[country] ?? DISPUTED_COLOR }}
                />
                <span className="country-delta-name">{ownerName(country)}</span>
                <span
                  className={`delta-badge ${d > 0 ? 'delta-up' : 'delta-down'}`}
                >
                  {formatDelta(d)}
                </span>
              </li>
            ))}
          </ul>
          <p className="area-footnote">
            島を動かす前の状態(全島ON・現実位置・係争地は係争中)を基準にした差です。海域を取り合う相手国が分かります(1万km²未満の変化は省略)。
          </p>
        </section>
      )}

      {selectedIslandId && <IslandCard islandId={selectedIslandId} />}
      {selectedDisputeId && <DisputeCard disputeId={selectedDisputeId} />}

      {baseline && Object.keys(baseline.disputed).some((id) => baseline.disputed[id].claimants.length >= 2 && baseline.disputed[id].claimants.includes('Japan')) && (
        <Section title="日本の領土問題" tone="dispute">
          <p className="area-note">
            日本と相手国が領有を争う海域です。既定は「係争中」で、どの国の面積にも入りません。「日本」「相手国」を選ぶとEEZがどう変わるか試せます(本アプリは特定の立場を示しません)。
          </p>
          <ul className="dispute-list">
            {Object.entries(baseline.disputed)
              .filter(
                ([, d]) => d.claimants.length >= 2 && d.claimants.includes('Japan'),
              )
              .map(([id, d]) => {
                const current = disputedOwners[id] ?? ''
                const opponent = d.claimants.find((c) => c !== 'Japan') ?? ''
                return (
                  <li key={id}>
                    <span className="dispute-name">
                      {d.nameJa}
                      <button
                        className="dispute-info"
                        aria-label={`${d.nameJa}の解説を読む`}
                        onClick={() => openColumn(id)}
                      >
                        ?
                      </button>
                    </span>
                    <div className="dispute-toggle">
                      <button
                        className={current === 'Japan' ? 'active' : ''}
                        disabled={frozen}
                        onClick={() => void setDisputeOwner(id, 'Japan')}
                      >
                        日本
                      </button>
                      <button
                        className={current === '' ? 'active' : ''}
                        disabled={frozen}
                        onClick={() => void setDisputeOwner(id, '')}
                      >
                        係争中
                      </button>
                      <button
                        className={current === opponent ? 'active' : ''}
                        disabled={frozen}
                        onClick={() => void setDisputeOwner(id, opponent)}
                      >
                        {COUNTRY_NAMES_JA[opponent] ?? opponent}
                      </button>
                    </div>
                  </li>
                )
              })}
          </ul>
        </Section>
      )}

      <Section title="島リスト" defaultOpen>
        <ul className="island-list">
          {Object.entries(allIslands).map(([id, isl]) => {
            const st = islands[id]
            const moved =
              st &&
              (Math.abs(st.lon - isl.anchor[0]) > 1e-6 ||
                Math.abs(st.lat - isl.anchor[1]) > 1e-6)
            const owner = st?.owner ?? isl.owner
            const locked = LOCKED_ISLAND_IDS.has(id)
            return (
              <li key={id}>
                {/* 名前はlabelの外に出す。ロック時にチェックボックスを
                    無効化しても、情報カードは開けるようにするため */}
                <input
                  type="checkbox"
                  aria-label={`${isl.nameJa}をEEZの計算に含める`}
                  checked={st?.enabled ?? true}
                  disabled={frozen || locked}
                  onChange={() => void toggleIsland(id)}
                />
                <span
                  className="island-name-link"
                  onClick={() => setSelectedIslandId(id)}
                >
                  {isl.nameJa}
                </span>
                {locked && (
                  <span className="island-locked-tag" title="領有権が争われている島です">
                    🔒
                  </span>
                )}
                {isl.ownerOptions && (
                  <span className="island-owner-tag">
                    {owner
                      ? (COUNTRY_NAMES_JA[owner] ?? owner)
                      : (ISLAND_INFO[id]?.unassignedLabel ? '仲裁判断' : '未帰属')}
                  </span>
                )}
                {moved && <span className="island-moved-tag">移動中</span>}
                {isl.custom && (
                  <button
                    className="island-delete"
                    aria-label="この島を削除"
                    disabled={frozen}
                    onClick={() => void removeIsland(id)}
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="area-footnote">
          名前をタップで情報カード。チェックを外すと「その島が無かったら」を計算します(いつでも戻せます)。マーカーはドラッグで移動できます。🔒 は領有権が争われている島で、移動もON/OFFもできません。
        </p>
      </Section>

      <Section title="島を新設(サンドボックス)">
        <p className="area-note">
          国を選んで海の好きな場所に仮想の島を置くと、EEZがどれだけ生まれ、どの国から奪うかを試せます。
        </p>
        <label className="place-country">
          国:
          <select
            value={placeCountry}
            disabled={frozen || placing !== null}
            onChange={(e) => setPlaceCountry(e.target.value)}
          >
            {Object.keys(COUNTRY_COLORS).map((c) => (
              <option key={c} value={c}>
                {COUNTRY_NAMES_JA[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`action-button ${placing ? 'action-button-active' : ''}`}
          disabled={frozen}
          onClick={() => setPlacing(placing ? null : placeCountry)}
        >
          {placing
            ? '地図をクリックして設置(取消)'
            : `＋ ${COUNTRY_NAMES_JA[placeCountry] ?? placeCountry}の島を置く`}
        </button>
      </Section>

      <Section title="もしもシナリオ" defaultOpen>
        <ul className="scenario-list">
          {SCENARIOS.map((sc) => (
            <li key={sc.id}>
              <button
                className="scenario-button"
                disabled={frozen}
                onClick={() => void applyScenario(sc.disable)}
              >
                <span className="scenario-label">{sc.label}</span>
                <span className="scenario-desc">{sc.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {isSim && (
        <p className="sim-hint">
          等距離中間線モデルによる自前計算を表示しています。「リセット」で島を現実の配置に戻せます。実データと比べるにはヘッダーの「実データ」へ。
        </p>
      )}

      {selected && mode === 'real' && (
        <section className="panel-card">
          <h2>選択中の海域</h2>
          {(() => {
            const d = describeSelected(selected)
            return (
              <>
                <p className="selected-title">{d.title}</p>
                <p className="selected-area">{formatArea(selected.area_km2)}</p>
                {d.note && <p className="area-note">{d.note}</p>}
                <p className="area-footnote">{selected.geoname}</p>
              </>
            )
          })()}
        </section>
      )}

      <Section title="地図ツール">
        <label className="tool-toggle">
          <input
            type="checkbox"
            checked={showTerritorial}
            onChange={(e) => setShowTerritorial(e.target.checked)}
          />
          <span>領海(12海里)とEEZ(200海里)の円を表示</span>
        </label>
        <p className="area-footnote">
          有効な各島に、領海(12海里)とEEZ(200海里)の同心円を重ねます。桁違いのスケール差が分かります。
        </p>
        <label className="tool-toggle">
          <input
            type="checkbox"
            checked={showTrough}
            onChange={(e) => setShowTrough(e.target.checked)}
          />
          <span>沖縄トラフ(中国の大陸棚主張)を表示</span>
        </label>
        <p className="area-footnote">
          中国が2012年に国連CLCSへ提出した「200海里を超える大陸棚の外側限界」の10点。
          <strong>大陸棚の主張であって、EEZの境界線ではありません。</strong>
          EEZの計算には一切使っていません。
        </p>
        <ColumnLink columnId="senkaku" label="📖 なぜEEZの計算に使わないのか" />

        <label className="tool-toggle">
          <input
            type="checkbox"
            checked={measuring}
            onChange={(e) => setMeasuring(e.target.checked)}
          />
          <span>距離を測る(地図の2点をクリック)</span>
        </label>
        {measuring && (
          <p className="measure-result">
            {measureKm === null
              ? '地図上の2点をクリックしてください'
              : `${Math.round(measureKm).toLocaleString()} km / ${(measureKm / 1.852).toFixed(0)} 海里(200海里の${((measureKm / 370.4) * 100).toFixed(0)}%)`}
          </p>
        )}
      </Section>

      <Section title="世界のEEZ面積ランキング">
        <WorldRanking />
      </Section>

      <Section title="凡例">
        <ul className="legend">
          {Object.entries(COUNTRY_COLORS).map(([key, color]) => (
            <li key={key}>
              <span className="swatch" style={{ backgroundColor: color }} />
              {COUNTRY_NAMES_JA[key] ?? key}
            </li>
          ))}
          <li>
            <span
              className="swatch swatch-disputed"
              style={{ backgroundColor: DISPUTED_COLOR }}
            />
            係争中・共同管理水域
          </li>
        </ul>
        <p className="area-footnote">
          {mode === 'real'
            ? '海域をクリックすると詳細を表示します。'
            : 'シミュレーションでは係争海域は等距離モデルで機械的に配分されます。'}
        </p>
      </Section>

      <Section title="解説を読む" defaultOpen>
        <ColumnLink columnId="what-is-eez" label="🌊 そもそもEEZとは何か" />
        <ColumnLink columnId="method" label="📐 EEZはどう計算しているか" />
        <ColumnLink columnId="about" label="ⓘ このアプリについて・出典" />
      </Section>
      </div>
    </aside>
  )
}
