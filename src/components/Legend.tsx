import { COUNTRY_COLORS, COUNTRY_NAMES_JA, DISPUTED_COLOR } from '../lib/config'

/**
 * EEZの色分けの凡例。地図の上とサイドパネルの両方で使う。
 * 2か所に別々に書くと、色や国名がいつか食い違う。
 */
export function Legend() {
  return (
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
  )
}
