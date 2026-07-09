import { useEffect, useRef, useState } from 'react'

/**
 * 数値変化をカウントアップ/ダウンでアニメーションするフック。
 * targetが変わるたびに現在表示値からease-outで補間する。
 */
export function useAnimatedNumber(
  target: number | null,
  durationMs = 500,
): number | null {
  const [value, setValue] = useState(target)
  const displayedRef = useRef(target)

  useEffect(() => {
    if (target === null) {
      displayedRef.current = null
      setValue(null)
      return
    }
    const from = displayedRef.current
    if (from === null || from === target) {
      displayedRef.current = target
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / durationMs)
      const eased = 1 - (1 - k) ** 3
      const v = from + (target - from) * eased
      displayedRef.current = v
      setValue(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}
