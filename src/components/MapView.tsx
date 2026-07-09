import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type {
  ExpressionSpecification,
  StyleSpecification,
} from 'maplibre-gl'
import type { Feature } from 'geojson'
import {
  COUNTRY_COLORS,
  DEFAULT_VIEW_BOUNDS,
  DISPUTED_COLOR,
  MAX_BOUNDS,
  type EezProperties,
} from '../lib/config'
import { islandDefs, useAppStore } from '../store/useAppStore'
import type { EezResult } from '../engine/types'
import {
  NM12_KM,
  NM200_KM,
  geodesicCircle,
  haversineKm,
} from '../engine/geo'
import {
  addIslandAt,
  consumeDirty,
  dragTo,
  endDrag,
  startDrag,
} from '../sim/controller'

const BASE = import.meta.env.BASE_URL
// 開発時はデータ再生成後の古いキャッシュ描画を避けるためURLを毎読み込みで変える
const V = import.meta.env.DEV ? `?t=${Date.now()}` : ''

const EMPTY_FC = {
  type: 'FeatureCollection' as const,
  features: [] as Feature[],
}

/** 海の背景色。EEZ塗りはこの上に半透明を重ねた見た目を再現する */
const OCEAN_RGB: [number, number, number] = [198, 220, 236] // #c6dcec

/**
 * 色を「海の上にalphaで重ねた不透明色」に事前ブレンドする。
 * 半透明の塗りは複雑なポリゴンが重なると色が濃くなる(濃い三角形の原因)。
 * 事前ブレンドした色を opacity=1 で描けば、二度塗りしても色が変わらず
 * アーティファクトが原理的に出ない。
 */
function blendOverOcean(hex: string, alpha: number): string {
  const c = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const m = c.map((v, i) => Math.round(alpha * v + (1 - alpha) * OCEAN_RGB[i]))
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** sovereign1 → 事前ブレンド塗り色 のMapLibre式(通常/ホバーの2段) */
const buildFillExpr = (alpha: number) =>
  [
    'match',
    ['get', 'sovereign1'],
    ...Object.entries(COUNTRY_COLORS).flatMap(([k, v]) => [
      k,
      blendOverOcean(v, alpha),
    ]),
    blendOverOcean(DISPUTED_COLOR, alpha),
  ] as unknown as ExpressionSpecification

const fillColorNormal = buildFillExpr(0.38)
const fillColorHover = buildFillExpr(0.55)
/** 境界線は塗りより濃い原色系(不透明ではない細線なので二重描画の影響が小さい) */
const lineColorExpr = [
  'match',
  ['get', 'sovereign1'],
  ...Object.entries(COUNTRY_COLORS).flat(),
  DISPUTED_COLOR,
] as unknown as ExpressionSpecification

/** タイルサーバー非依存の自前スタイル(海=背景色、陸=Natural Earth) */
const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    eez: {
      type: 'geojson',
      data: `${BASE}data/eez.geojson${V}`,
      generateId: true,
      // データは事前簡略化済み。実行時の追加簡略化は自己交差による
      // 塗りの二重描画アーティファクトを生むため無効化
      tolerance: 0,
    },
    land: { type: 'geojson', data: `${BASE}data/land.geojson${V}` },
    borders: { type: 'geojson', data: `${BASE}data/borders.geojson${V}` },
    // 実行時に更新する空ソース(領海リング・距離測定)
    rings: { type: 'geojson', data: EMPTY_FC },
    measure: { type: 'geojson', data: EMPTY_FC },
  },
  layers: [
    { id: 'ocean', type: 'background', paint: { 'background-color': '#c6dcec' } },
    {
      id: 'eez-fill',
      type: 'fill',
      source: 'eez',
      filter: ['==', ['get', 'pol_type'], '200NM'],
      paint: {
        // 事前ブレンド色を不透明で描く(二度塗りで濃くならない)
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          fillColorHover,
          fillColorNormal,
        ] as unknown as ExpressionSpecification,
        'fill-antialias': false,
      },
    },
    {
      // 係争中・共同管理海域: 中間色+破線縁取りの専用スタイル
      id: 'eez-disputed-fill',
      type: 'fill',
      source: 'eez',
      filter: ['!=', ['get', 'pol_type'], '200NM'],
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          blendOverOcean(DISPUTED_COLOR, 0.55),
          blendOverOcean(DISPUTED_COLOR, 0.4),
        ],
        'fill-antialias': false,
      },
    },
    {
      id: 'eez-line',
      type: 'line',
      source: 'eez',
      filter: ['==', ['get', 'pol_type'], '200NM'],
      paint: {
        'line-color': lineColorExpr,
        // 低ズームでは細く薄く。海岸線に沿う境界線が密集して
        // 濃い帯に見えるのを防ぐ(拡大すると通常の太さに戻る)
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 0.35, 6, 1.2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0.2, 6, 0.8],
      },
    },
    {
      id: 'eez-disputed-line',
      type: 'line',
      source: 'eez',
      filter: ['!=', ['get', 'pol_type'], '200NM'],
      paint: {
        'line-color': '#5c626b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3.5, 0.4, 6, 1.2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3.5, 0.35, 6, 1],
        'line-dasharray': [2, 2],
      },
    },
    {
      id: 'land-fill',
      type: 'fill',
      source: 'land',
      paint: { 'fill-color': '#f5f2ea' },
    },
    {
      id: 'land-line',
      type: 'line',
      source: 'land',
      paint: { 'line-color': '#b0a996', 'line-width': 0.6 },
    },
    {
      // 国境(陸上の国と国の境界)。通常の国境は実線
      id: 'country-borders',
      type: 'line',
      source: 'borders',
      filter: ['==', ['get', 'featurecla'], 'International boundary (verify)'],
      paint: {
        'line-color': '#8a8177',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 1.1],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 0.85],
      },
    },
    {
      // 係争中の境界・停戦ライン等は破線(特定の立場を示さない)
      id: 'country-borders-disputed',
      type: 'line',
      source: 'borders',
      filter: ['!=', ['get', 'featurecla'], 'International boundary (verify)'],
      paint: {
        'line-color': '#8a8177',
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 1.1],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 6, 0.85],
        'line-dasharray': [2, 2],
      },
    },
    {
      // EEZ(200海里)の同心円(破線)
      id: 'ring-eez',
      type: 'line',
      source: 'rings',
      filter: ['==', ['get', 'kind'], 'eez'],
      paint: { 'line-color': '#1c4fa0', 'line-width': 1.2, 'line-dasharray': [3, 2] },
    },
    {
      // 領海(12海里)の同心円(実線・塗り)
      id: 'ring-territorial-fill',
      type: 'fill',
      source: 'rings',
      filter: ['==', ['get', 'kind'], 'territorial'],
      paint: { 'fill-color': '#1c355c', 'fill-opacity': 0.35 },
    },
    {
      id: 'ring-territorial',
      type: 'line',
      source: 'rings',
      filter: ['==', ['get', 'kind'], 'territorial'],
      paint: { 'line-color': '#0d2444', 'line-width': 1.4 },
    },
    {
      // 距離測定の線
      id: 'measure-line',
      type: 'line',
      source: 'measure',
      paint: { 'line-color': '#b25d0e', 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
    },
  ],
}

/**
 * 初期URLハッシュ(#zoom/lat/lng)をカメラ位置として読む。
 * StrictModeの二重マウントでmap.remove()がハッシュを消すため、
 * MapLibre任せにせずモジュール読み込み時に一度だけ保存しておく。
 */
const initialCamera = (() => {
  const m = window.location.hash.match(
    /^#(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/,
  )
  if (!m) return null
  return {
    zoom: Number(m[1]),
    center: [Number(m[3]), Number(m[2])] as [number, number],
  }
})()

/** 実データ表示のEEZレイヤー(シミュレーション時に隠す) */
const REAL_EEZ_LAYERS = [
  'eez-fill',
  'eez-disputed-fill',
  'eez-disputed-hatch',
  'eez-line',
  'eez-disputed-line',
]

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

/**
 * シミュレーション結果を描くオーバーレイ用キャンバス。
 * dataURL画像と違い同期描画なので、ドラッグ中に古いフレームが
 * 後から表示される「残像」が起きない。dirty範囲のみ部分再描画する。
 */
interface SimOverlay {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  img: ImageData
}

/** 描き直す矩形(グリッドの行・列インデックス) */
type DirtyRect = NonNullable<EezResult['dirty']>

function paintSimOverlay(
  overlay: SimOverlay,
  result: EezResult,
  d: DirtyRect,
): void {
  const { width } = result.grid
  const palette: [number, number, number][] = result.countries.map((c) =>
    hexToRgb(COUNTRY_COLORS[c] ?? DISPUTED_COLOR),
  )
  const { codes } = result
  const data = overlay.img.data
  for (let r = d.r0; r < d.r1; r++) {
    for (let c = d.c0; c < d.c1; c++) {
      const i = r * width + c
      const code = codes[i]
      if (code === 0) {
        data[i * 4 + 3] = 0
      } else {
        const rgb = palette[code - 1]
        data[i * 4] = rgb[0]
        data[i * 4 + 1] = rgb[1]
        data[i * 4 + 2] = rgb[2]
        data[i * 4 + 3] = 105 // ≈0.41
      }
    }
  }
  overlay.ctx.putImageData(overlay.img, 0, 0, d.c0, d.r0, d.c1 - d.c0, d.r1 - d.r0)
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapObj, setMapObj] = useState<maplibregl.Map | null>(null)
  /**
   * スタイルの初回ロードが済んだか。
   * isStyleLoaded()は自前のsetLayoutProperty等の直後にfalseを返すため、
   * これで代用してはいけない。falseのとき'idle'待ちにすると、animate中の
   * canvasソースが常時再描画を要求してidleが来ず、描画が永久に落ちる
   */
  const [styleReady, setStyleReady] = useState(false)
  const markersRef = useRef<Record<string, maplibregl.Marker>>({})
  const disputeMarkersRef = useRef<Record<string, maplibregl.Marker>>({})
  const draggingRef = useRef<string | null>(null)
  const setSelected = useAppStore((s) => s.setSelected)
  const setRealAreas = useAppStore((s) => s.setRealAreas)
  const mode = useAppStore((s) => s.mode)
  const simResult = useAppStore((s) => s.simResult)
  const baseline = useAppStore((s) => s.baseline)
  const customIslands = useAppStore((s) => s.customIslands)
  const islands = useAppStore((s) => s.islands)
  const hintSeen = useAppStore((s) => s.hintSeen)
  const setHintSeen = useAppStore((s) => s.setHintSeen)
  const placing = useAppStore((s) => s.placing)
  const measuring = useAppStore((s) => s.measuring)
  const showTerritorial = useAppStore((s) => s.showTerritorial)
  const selectedIslandId = useAppStore((s) => s.selectedIslandId)
  const measurePtsRef = useRef<[number, number][]>([])

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: mapStyle,
      ...(initialCamera ?? {
        bounds: DEFAULT_VIEW_BOUNDS,
        fitBoundsOptions: { padding: 20 },
      }),
      // データ範囲の外(何もない海・切れた陸地)が見えないように制限
      maxBounds: MAX_BOUNDS,
      hash: true,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }))

    // Appleマップ風のトラックパッド操作にする:
    //  2本指スクロール(ctrlKeyなしwheel) → パン
    //  ピンチ(macOSはctrlKey付きwheelとして送る) → ズーム
    // 既定のscrollZoom(スクロールで拡大)は無効化する。
    map.scrollZoom.disable()
    const canvas = map.getCanvas()
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        // ピンチ: カーソル位置を固定してズーム
        const rect = canvas.getBoundingClientRect()
        const around = map.unproject([e.clientX - rect.left, e.clientY - rect.top])
        map.easeTo({
          zoom: map.getZoom() - e.deltaY * 0.01,
          around,
          duration: 0,
        })
      } else {
        // 2本指スクロール: パン(OSのスクロール方向に追従)
        map.panBy([e.deltaX, e.deltaY], { duration: 0 })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // 係争海域の斜線ハッチングパターン(企画書8章の専用スタイル)
    map.on('load', () => {
      setStyleReady(true)
      if (map.hasImage('hatch')) return
      const size = 12
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.strokeStyle = 'rgba(70, 76, 86, 0.55)'
      ctx.lineWidth = 2
      for (const off of [-size, 0, size]) {
        ctx.beginPath()
        ctx.moveTo(off, size)
        ctx.lineTo(off + size, 0)
        ctx.stroke()
      }
      map.addImage('hatch', ctx.getImageData(0, 0, size, size))
      map.addLayer(
        {
          id: 'eez-disputed-hatch',
          type: 'fill',
          source: 'eez',
          filter: ['!=', ['get', 'pol_type'], '200NM'],
          paint: { 'fill-pattern': 'hatch', 'fill-opacity': 0.55 },
        },
        'eez-line',
      )
    })

    // 各国のEEZ面積はデータ属性(Marine Regions算出値)から取得
    map.on('sourcedata', function onSource(e) {
      if (e.sourceId !== 'eez' || !e.isSourceLoaded) return
      const feats = map.querySourceFeatures('eez')
      if (feats.length === 0) return
      map.off('sourcedata', onSource)
      const areas: Record<string, number> = {}
      for (const f of feats) {
        if (f.properties.pol_type !== '200NM') continue
        const c = f.properties.sovereign1 as string
        // MultiPolygonはタイル毎に複数featureで返るため最大値を採用
        areas[c] = Math.max(areas[c] ?? 0, f.properties.area_km2 as number)
      }
      setRealAreas(areas)
    })

    // ホバーで強調+クリックで選択(サイドパネルに詳細表示)
    let hoveredId: number | string | undefined
    const fillLayers = ['eez-fill', 'eez-disputed-fill']
    map.on('mousemove', fillLayers, (e) => {
      const f = e.features?.[0]
      if (!f) return
      if (hoveredId !== undefined && hoveredId !== f.id) {
        map.setFeatureState({ source: 'eez', id: hoveredId }, { hover: false })
      }
      hoveredId = f.id
      map.setFeatureState({ source: 'eez', id: f.id }, { hover: true })
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', fillLayers, () => {
      if (hoveredId !== undefined) {
        map.setFeatureState({ source: 'eez', id: hoveredId }, { hover: false })
        hoveredId = undefined
      }
      map.getCanvas().style.cursor = ''
    })
    map.on('click', fillLayers, (e) => {
      const f = e.features?.[0]
      if (f) setSelected(f.properties as unknown as EezProperties)
    })
    map.on('click', (e) => {
      const store = useAppStore.getState()
      // 距離測定モード: 2点をクリックして距離を測る
      if (store.measuring) {
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        const pts = measurePtsRef.current
        // 既に2点あれば新しい計測を始める
        if (pts.length >= 2) pts.length = 0
        pts.push(pt)
        const src = map.getSource('measure') as maplibregl.GeoJSONSource
        if (pts.length === 2) {
          src.setData({
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } },
            ],
          })
          store.setMeasureKm(haversineKm(pts[0][0], pts[0][1], pts[1][0], pts[1][1]))
        } else {
          src.setData(EMPTY_FC)
          store.setMeasureKm(null)
        }
        return
      }
      // 「島を新設」モード中は次のクリックでその国の島を設置する
      if (store.placing) {
        const owner = store.placing
        store.setPlacing(null)
        void addIslandAt(e.lngLat.lng, e.lngLat.lat, owner)
        return
      }
      const hits = map.queryRenderedFeatures(e.point, { layers: fillLayers })
      if (hits.length === 0) setSelected(null)
    })

    setMapObj(map)
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__eezMap = map
    }
    return () => {
      setMapObj(null)
      setStyleReady(false)
      markersRef.current = {}
      canvas.removeEventListener('wheel', onWheel)
      map.remove()
    }
  }, [setSelected, setRealAreas])

  // 島マーカーの生成・同期(baseline島+サンドボックス島)
  useEffect(() => {
    if (!mapObj) return
    const markers = markersRef.current
    const defs = { ...(baseline?.islands ?? {}), ...customIslands }
    // 消えた島(削除されたサンドボックス島)のマーカーを撤去
    for (const id of Object.keys(markers)) {
      if (!defs[id]) {
        markers[id].remove()
        delete markers[id]
      }
    }
    for (const [id, isl] of Object.entries(defs)) {
      if (markers[id]) continue
      const el = document.createElement('div')
      el.className = isl.custom ? 'island-marker island-marker-custom' : 'island-marker'
      const dot = document.createElement('span')
      dot.className = 'island-dot'
      const label = document.createElement('span')
      label.className = 'island-label'
      label.textContent = isl.nameJa
      el.append(dot, label)
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(isl.anchor)
        .addTo(mapObj)
      let dragged = false
      marker.on('dragstart', () => {
        dragged = true
        draggingRef.current = id
        void startDrag(id)
      })
      marker.on('drag', () => {
        const p = marker.getLngLat()
        dragTo(id, p.lng, p.lat)
      })
      marker.on('dragend', () => {
        draggingRef.current = null
        void endDrag(id)
      })
      // ドラッグではない純粋なクリックで情報カードを開く
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        if (dragged) {
          dragged = false
          return
        }
        const store = useAppStore.getState()
        store.setSelectedIslandId(store.selectedIslandId === id ? null : id)
      })
      markers[id] = marker
    }
  }, [mapObj, baseline, customIslands])

  // アンマウント時に全マーカーを撤去
  useEffect(() => {
    const markers = markersRef.current
    return () => {
      for (const m of Object.values(markers)) m.remove()
    }
  }, [])

  // 領土問題マーカー(北方領土・竹島・尖閣)を代表点に立てて場所を明示
  useEffect(() => {
    if (!mapObj || !baseline) return
    const markers = disputeMarkersRef.current
    for (const [id, d] of Object.entries(baseline.disputed)) {
      if (markers[id]) continue
      if (!(d.claimants.length >= 2 && d.claimants.includes('Japan'))) continue
      const el = document.createElement('div')
      el.className = 'dispute-marker'
      const dot = document.createElement('span')
      dot.className = 'dispute-dot'
      dot.textContent = '⚖'
      const label = document.createElement('span')
      label.className = 'dispute-label'
      label.textContent = d.nameJa
      el.append(dot, label)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const store = useAppStore.getState()
        store.setSelectedDisputeId(store.selectedDisputeId === id ? null : id)
      })
      markers[id] = new maplibregl.Marker({ element: el })
        .setLngLat(d.centroid)
        .addTo(mapObj)
    }
    return () => {
      for (const m of Object.values(markers)) m.remove()
      disputeMarkersRef.current = {}
    }
  }, [mapObj, baseline])

  // 「島を新設」/距離測定モード中はカーソルを十字に
  useEffect(() => {
    if (!mapObj) return
    mapObj.getCanvas().style.cursor = placing || measuring ? 'crosshair' : ''
  }, [mapObj, placing, measuring])

  // 距離測定モードを抜けたら線と結果を消す
  useEffect(() => {
    if (!mapObj || measuring) return
    measurePtsRef.current = []
    const src = mapObj.getSource('measure') as maplibregl.GeoJSONSource | undefined
    if (src) src.setData(EMPTY_FC)
  }, [mapObj, measuring])

  // 領海(12海里)・EEZ(200海里)の同心円: ONのとき有効な各島に描く
  useEffect(() => {
    const map = mapObj
    if (!map || !styleReady) return
    const src = map.getSource('rings') as maplibregl.GeoJSONSource | undefined
    if (!src) return
    if (!showTerritorial) {
      src.setData(EMPTY_FC)
      return
    }
    const defs = islandDefs(useAppStore.getState())
    const features: Feature[] = []
    for (const [id, def] of Object.entries(defs)) {
      const st = islands[id]
      if (st && !st.enabled) continue
      const lon = st?.lon ?? def.anchor[0]
      const lat = st?.lat ?? def.anchor[1]
      features.push({
        type: 'Feature',
        properties: { kind: 'eez' },
        geometry: { type: 'Polygon', coordinates: [geodesicCircle(lon, lat, NM200_KM)] },
      })
      features.push({
        type: 'Feature',
        properties: { kind: 'territorial' },
        geometry: { type: 'Polygon', coordinates: [geodesicCircle(lon, lat, NM12_KM)] },
      })
    }
    src.setData({ type: 'FeatureCollection', features })
  }, [
    mapObj,
    styleReady,
    showTerritorial,
    islands,
    customIslands,
    selectedIslandId,
    baseline,
  ])

  // ストアの島状態をマーカーに反映(リセット時の位置復帰・OFF時の淡色化)
  useEffect(() => {
    for (const [id, st] of Object.entries(islands)) {
      const m = markersRef.current[id]
      if (!m) continue
      if (draggingRef.current !== id) {
        const cur = m.getLngLat()
        if (Math.abs(cur.lng - st.lon) > 1e-9 || Math.abs(cur.lat - st.lat) > 1e-9) {
          m.setLngLat([st.lon, st.lat])
        }
      }
      m.getElement().classList.toggle('island-marker-off', !st.enabled)
      // 初回操作までマーカーを脈動させて「触れる」ことを示す
      m.getElement().classList.toggle('island-marker-pulse', !hintSeen)
    }
  }, [islands, mapObj, baseline, hintSeen])

  // シミュレーション結果のオーバーレイ表示と実データレイヤーの切替
  const overlayRef = useRef<SimOverlay | null>(null)
  useEffect(() => {
    const map = mapObj
    if (!map || !styleReady) return
    if (mode === 'sim' && simResult) {
      const { width, height } = simResult.grid
      // キャンバスの用意(グリッドサイズが変わったら作り直して全再描画)
      let overlay = overlayRef.current
      const sizeChanged =
        !overlay || overlay.canvas.width !== width || overlay.canvas.height !== height
      if (sizeChanged) {
        const canvas = overlay?.canvas ?? document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        overlay = { canvas, ctx, img: ctx.createImageData(width, height) }
        overlayRef.current = overlay
      }
      // 未描画の矩形を必ず消費する。キャンバスを作り直したときだけ全面。
      const pending = consumeDirty()
      const rect = sizeChanged ? { r0: 0, r1: height, c0: 0, c1: width } : pending
      if (rect) paintSimOverlay(overlay!, simResult, rect)

      if (!map.getSource('sim')) {
        const [west, south, east, north] = simResult.grid.bbox
        map.addSource('sim', {
          type: 'canvas',
          canvas: overlay!.canvas,
          coordinates: [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
          ],
          animate: true,
        })
        map.addLayer(
          {
            id: 'sim-overlay',
            type: 'raster',
            source: 'sim',
            paint: { 'raster-fade-duration': 0 },
          },
          'land-fill',
        )
      }
      const src = map.getSource('sim') as maplibregl.CanvasSource
      src.play()
      map.setLayoutProperty('sim-overlay', 'visibility', 'visible')
      for (const l of REAL_EEZ_LAYERS)
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'none')
    } else {
      if (map.getLayer('sim-overlay')) {
        map.setLayoutProperty('sim-overlay', 'visibility', 'none')
        ;(map.getSource('sim') as maplibregl.CanvasSource).pause()
      }
      for (const l of REAL_EEZ_LAYERS)
        if (map.getLayer(l)) map.setLayoutProperty(l, 'visibility', 'visible')
    }
  }, [mapObj, styleReady, mode, simResult])

  return (
    <div className="map-wrap">
      <div ref={containerRef} className="map-container" />
      {!hintSeen && baseline && (
        <div className="map-hint" role="note">
          <span>
            💡 島のマーカーを<b>ドラッグ</b>したり、島リストで<b>ON/OFF</b>
            すると、EEZ(排他的経済水域)の変化を体感できます
          </span>
          <button
            className="map-hint-close"
            aria-label="ヒントを閉じる"
            onClick={setHintSeen}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
