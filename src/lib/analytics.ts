/**
 * GA4へのイベント送信。
 *
 * gtag.jsは広告ブロッカーに遮断されることが多く(日本のPC利用者の2割前後)、
 * その環境ではwindow.gtagが存在しない。計測が落ちてもアプリの操作は
 * 一切妨げないこと(例外を投げない・awaitさせない)をこの層の責務とする。
 */

/**
 * 送るイベント。「何人来たか」ではなく「主役のシミュレーションが
 * 使われたか」を知るための最小限に絞る
 */
type EezEvent =
  /** シミュレーションモードに入った(このアプリの本題に到達した) */
  | 'simulation_start'
  /** 島のON/OFF */
  | 'island_toggle'
  /** 島をドラッグして動かした */
  | 'island_drag'
  /** 係争地域の帰属を切り替えた */
  | 'dispute_set'
  /** 「もしも」シナリオを適用した */
  | 'scenario_apply'
  /** サンドボックスで島を新設した */
  | 'island_add'
  /** 解説コラムを開いた */
  | 'column_open'
  /** リセット */
  | 'reset'

type Gtag = (
  command: 'event',
  name: string,
  params?: Record<string, string | number | boolean>,
) => void

export function track(
  name: EezEvent,
  params?: Record<string, string | number | boolean>,
): void {
  const gtag = (globalThis as { gtag?: Gtag }).gtag
  if (typeof gtag !== 'function') return
  try {
    gtag('event', name, params)
  } catch {
    // 計測の失敗でアプリを止めない
  }
}
