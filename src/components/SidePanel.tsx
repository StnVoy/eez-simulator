import { useEffect, useState } from 'react'
import {
  COUNTRY_COLORS,
  COUNTRY_LAND_AREA_KM2,
  COUNTRY_NAMES_JA,
  DISPUTED_COLOR,
} from '../lib/config'
import { islandDefs, useAppStore } from '../store/useAppStore'
import { useAnimatedNumber } from '../lib/useAnimatedNumber'
import { ARTICLE121, ISLAND_INFO, SCENARIOS } from '../data/islandInfo'
import { WorldRanking } from './WorldRanking'
import {
  applyScenario,
  getIslandContribution,
  removeIsland,
  setDisputeOwner,
  setIslandOwner,
  toggleIsland,
} from '../sim/controller'

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
  const simRunning = useAppStore((s) => s.simRunning)
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
              <option value="">未帰属(どの国のEEZにもならない)</option>
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
      {island.custom ? (
        <button
          className="action-button action-button-danger"
          disabled={simRunning}
          onClick={() => void removeIsland(islandId)}
        >
          この島を削除
        </button>
      ) : (
        // 実在する島は「消す」=OFF。いつでも復活できる
        !art121 && (
          <button
            className="action-button action-button-subtle"
            disabled={simRunning}
            onClick={() => void toggleIsland(islandId)}
          >
            {st.enabled ? 'この島を消す(EEZから除く)' : '島を復活させる'}
          </button>
        )
      )}
    </section>
  )
}

/** 係争地の情報カード(帰属を 日本/係争中/相手国 で切替) */
function DisputeCard({ disputeId }: { disputeId: string }) {
  const dispute = useAppStore((s) => s.baseline?.disputed[disputeId])
  const disputedOwners = useAppStore((s) => s.disputedOwners)
  const simRunning = useAppStore((s) => s.simRunning)
  const setSelectedDisputeId = useAppStore((s) => s.setSelectedDisputeId)
  if (!dispute) return null
  const current = disputedOwners[disputeId] ?? dispute.defaultOwner
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
      <p className="area-footnote">
        既定は日本の公式見解ベース。本アプリは特定の立場を示しません。
      </p>
    </section>
  )
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
  const [placeCountry, setPlaceCountry] = useState('Japan')

  const allIslands = { ...(baseline?.islands ?? {}), ...customIslands }
  const focusJa = COUNTRY_NAMES_JA[focusCountry] ?? focusCountry

  const isSim = mode === 'sim' && simResult !== null
  const rawArea = isSim
    ? (simResult.areaKm2[focusCountry] ?? 0)
    : (realAreas?.[focusCountry] ?? null)
  const shownArea = useAnimatedNumber(rawArea, 450)
  const landArea = COUNTRY_LAND_AREA_KM2[focusCountry]
  const ratio =
    shownArea !== null && landArea ? (shownArea / landArea).toFixed(1) : null
  const delta =
    isSim && defaultSimAreas !== null
      ? (simResult.areaKm2[focusCountry] ?? 0) -
        (defaultSimAreas[focusCountry] ?? 0)
      : null

  // 国別の増減(現実比)。変化の大きい順、1万km²未満は省略
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
    <aside className="side-panel">
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
              現実より{formatDelta(delta)}
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
            ? '※ 等距離中間線モデルによる自前計算。北方領土・竹島は既定で日本の基線に含みます。'
            : '※ Marine Regionsデータの算出値。日本の公称値(約447万km²)は領海等を含む区分のため異なります。'}
        </p>
      </section>

      {countryDeltas.length > 0 && (
        <section className="panel-card">
          <h2>各国のEEZ増減(現実比)</h2>
          <ul className="country-delta-list">
            {countryDeltas.map(({ country, delta: d }) => (
              <li key={country}>
                <span
                  className="swatch"
                  style={{ backgroundColor: COUNTRY_COLORS[country] ?? DISPUTED_COLOR }}
                />
                <span className="country-delta-name">
                  {COUNTRY_NAMES_JA[country] ?? country}
                </span>
                <span
                  className={`delta-badge ${d > 0 ? 'delta-up' : 'delta-down'}`}
                >
                  {formatDelta(d)}
                </span>
              </li>
            ))}
          </ul>
          <p className="area-footnote">
            島の移動・ON/OFFで海域を取り合う相手国が分かります(1万km²未満の変化は省略)。
          </p>
        </section>
      )}

      {selectedIslandId && <IslandCard islandId={selectedIslandId} />}
      {selectedDisputeId && <DisputeCard disputeId={selectedDisputeId} />}

      {baseline && Object.keys(baseline.disputed).some((id) => baseline.disputed[id].claimants.length >= 2 && baseline.disputed[id].claimants.includes('Japan')) && (
        <section className="panel-card panel-card-dispute">
          <h2>日本の領土問題</h2>
          <p className="area-note">
            日本と相手国が領有を争う海域です。「日本」「係争中」「相手国」を選ぶとEEZがどう変わるか試せます(本アプリは特定の立場を示しません)。
          </p>
          <ul className="dispute-list">
            {Object.entries(baseline.disputed)
              .filter(
                ([, d]) => d.claimants.length >= 2 && d.claimants.includes('Japan'),
              )
              .map(([id, d]) => {
                const current = disputedOwners[id] ?? d.defaultOwner
                const opponent = d.claimants.find((c) => c !== 'Japan') ?? ''
                return (
                  <li key={id}>
                    <span className="dispute-name">{d.nameJa}</span>
                    <div className="dispute-toggle">
                      <button
                        className={current === 'Japan' ? 'active' : ''}
                        disabled={simRunning}
                        onClick={() => void setDisputeOwner(id, 'Japan')}
                      >
                        日本
                      </button>
                      <button
                        className={current === '' ? 'active' : ''}
                        disabled={simRunning}
                        onClick={() => void setDisputeOwner(id, '')}
                      >
                        係争中
                      </button>
                      <button
                        className={current === opponent ? 'active' : ''}
                        disabled={simRunning}
                        onClick={() => void setDisputeOwner(id, opponent)}
                      >
                        {COUNTRY_NAMES_JA[opponent] ?? opponent}
                      </button>
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      )}

      <section className="panel-card">
        <h2>島リスト</h2>
        <ul className="island-list">
          {Object.entries(allIslands).map(([id, isl]) => {
            const st = islands[id]
            const moved =
              st &&
              (Math.abs(st.lon - isl.anchor[0]) > 1e-6 ||
                Math.abs(st.lat - isl.anchor[1]) > 1e-6)
            const owner = st?.owner ?? isl.owner
            return (
              <li key={id}>
                <label>
                  <input
                    type="checkbox"
                    checked={st?.enabled ?? true}
                    disabled={simRunning}
                    onChange={() => void toggleIsland(id)}
                  />
                  <span
                    className="island-name-link"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedIslandId(id)
                    }}
                  >
                    {isl.nameJa}
                  </span>
                </label>
                {isl.ownerOptions && (
                  <span className="island-owner-tag">
                    {owner ? (COUNTRY_NAMES_JA[owner] ?? owner) : '未帰属'}
                  </span>
                )}
                {moved && <span className="island-moved-tag">移動中</span>}
                {isl.custom && (
                  <button
                    className="island-delete"
                    aria-label="この島を削除"
                    disabled={simRunning}
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
          名前をタップで情報カード。チェックを外すと「その島が無かったら」を計算します(いつでも戻せます)。マーカーはドラッグで移動できます。
        </p>
      </section>

      <section className="panel-card">
        <h2>島を新設(サンドボックス)</h2>
        <p className="area-note">
          国を選んで海の好きな場所に仮想の島を置くと、EEZがどれだけ生まれ、どの国から奪うかを試せます。
        </p>
        <label className="place-country">
          国:
          <select
            value={placeCountry}
            disabled={simRunning || placing !== null}
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
          disabled={simRunning}
          onClick={() => setPlacing(placing ? null : placeCountry)}
        >
          {placing
            ? '地図をクリックして設置(取消)'
            : `＋ ${COUNTRY_NAMES_JA[placeCountry] ?? placeCountry}の島を置く`}
        </button>
      </section>

      <section className="panel-card">
        <h2>もしもシナリオ</h2>
        <ul className="scenario-list">
          {SCENARIOS.map((sc) => (
            <li key={sc.id}>
              <button
                className="scenario-button"
                disabled={simRunning}
                onClick={() => void applyScenario(sc.disable)}
              >
                <span className="scenario-label">{sc.label}</span>
                <span className="scenario-desc">{sc.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {isSim && (
        <p className="sim-hint">
          島や領土問題を操作するとシミュレーション表示に切り替わります。ヘッダーの「リセット」で実データ(係争中の表示)に戻せます。
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

      <section className="panel-card">
        <h2>ツール</h2>
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
      </section>

      <WorldRanking />

      <section className="panel-card">
        <h2>凡例</h2>
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
      </section>
    </aside>
  )
}
