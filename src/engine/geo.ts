/** 球面地理計算の基本関数群(純粋関数・Worker/テスト共用) */

/** 地球半径(km)— 平均半径 */
export const EARTH_RADIUS_KM = 6371.0088

/** 200海里(km) */
export const NM200_KM = 370.4

/** 12海里(領海、km) */
export const NM12_KM = 22.224

/** 1海里(km) */
export const NM_KM = 1.852

/**
 * 始点から方位・距離の目的地(球面)を返す。測地円の頂点生成に使う。
 */
export function destinationPoint(
  lon: number,
  lat: number,
  distKm: number,
  bearingDeg: number,
): [number, number] {
  const δ = distKm / EARTH_RADIUS_KM
  const θ = toRad(bearingDeg)
  const φ1 = toRad(lat)
  const λ1 = toRad(lon)
  const sinφ2 =
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  const φ2 = Math.asin(sinφ2)
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2,
    )
  return [toDeg(λ2), toDeg(φ2)]
}

/** 中心(lon,lat)・半径distKmの測地円の頂点リング(GeoJSON用、閉じる) */
export function geodesicCircle(
  lon: number,
  lat: number,
  distKm: number,
  steps = 72,
): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    ring.push(destinationPoint(lon, lat, distKm, (i * 360) / steps))
  }
  return ring
}

export const toRad = (deg: number): number => (deg * Math.PI) / 180
export const toDeg = (rad: number): number => (rad * 180) / Math.PI

/** 大圏距離(km) */
export function haversineKm(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** 経緯度 → 単位球面上の3D座標(kd木用。弦長は大圏距離と単調対応) */
export function lonLatToXyz(
  lon: number,
  lat: number,
  out: Float64Array,
  offset = 0,
): void {
  const φ = toRad(lat)
  const λ = toRad(lon)
  const cosφ = Math.cos(φ)
  out[offset] = cosφ * Math.cos(λ)
  out[offset + 1] = cosφ * Math.sin(λ)
  out[offset + 2] = Math.sin(φ)
}

/** 大圏距離(km) → 単位球上の弦長の2乗(kd木の距離比較用) */
export function arcKmToChordSq(km: number): number {
  const chord = 2 * Math.sin(km / EARTH_RADIUS_KM / 2)
  return chord * chord
}

/** 単位球上の弦長の2乗 → 大圏距離(km) */
export function chordSqToArcKm(chordSq: number): number {
  const half = Math.min(1, Math.sqrt(chordSq) / 2)
  return 2 * Math.asin(half) * EARTH_RADIUS_KM
}

/** Webメルカトルの縦座標(ラジアン単位、投影スケール1) */
export const mercY = (latDeg: number): number =>
  Math.log(Math.tan(Math.PI / 4 + toRad(latDeg) / 2))

/** mercYの逆変換(度) */
export const invMercY = (y: number): number =>
  toDeg(2 * Math.atan(Math.exp(y)) - Math.PI / 2)

/**
 * 経度幅dLonDeg・緯度帯[latBotDeg, latTopDeg]の球面台形の面積(km²)
 * A = R²·Δλ·(sinφ₂ − sinφ₁)
 */
export function bandCellAreaKm2(
  dLonDeg: number,
  latBotDeg: number,
  latTopDeg: number,
): number {
  return (
    EARTH_RADIUS_KM ** 2 *
    toRad(dLonDeg) *
    (Math.sin(toRad(latTopDeg)) - Math.sin(toRad(latBotDeg)))
  )
}
