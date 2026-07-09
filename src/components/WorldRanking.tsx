import { WORLD_EEZ } from '../data/worldEez'

/**
 * 世界の主要国のEEZ面積ランキング(横棒)。
 * 「大きさ比較」なので単一系列の横棒グラフにし、色は乱用せず1色。
 * 日本だけ強調色。各バーに「国土の◯倍」を直接ラベルして
 * 「小さな国土でも島々で巨大な海を持つ」対比を見せる。
 */
export function WorldRanking() {
  const rows = [...WORLD_EEZ].sort((a, b) => b.eezManKm2 - a.eezManKm2)
  const max = rows[0].eezManKm2

  return (
    <section className="panel-card">
      <h2>世界のEEZ面積ランキング</h2>
      <ul className="rank-list">
        {rows.map((r) => {
          const ratio = r.eezManKm2 / r.landManKm2
          const ratioText =
            ratio >= 100 ? `${Math.round(ratio)}` : ratio.toFixed(1)
          const isJapan = r.key === 'Japan'
          return (
            <li key={r.key} className={isJapan ? 'rank-row rank-row-jp' : 'rank-row'}>
              <div className="rank-head">
                <span className="rank-name">{r.nameJa}</span>
                <span className="rank-value">
                  {r.eezManKm2.toLocaleString()}万km²
                  <span className="rank-ratio">国土の{ratioText}倍</span>
                </span>
              </div>
              <span className="rank-bar-track">
                <span
                  className="rank-bar"
                  style={{ width: `${(r.eezManKm2 / max) * 100}%` }}
                />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="area-footnote">
        EEZ面積の概算値。国土が小さくても遠方の島々で巨大なEEZを持つ国(日本・イギリス・フランス・キリバス等)ほど「国土の◯倍」が大きくなります。出典: Sea Around Us / Marine Regions ほか。
      </p>
    </section>
  )
}
