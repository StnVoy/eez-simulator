/**
 * 実データ(Marine Regions)から各国のEEZ面積を集計する。
 *
 * 地図のタイル(querySourceFeatures)から拾ってはいけない:
 *   - 1つのポリゴンがタイルごとに複数フィーチャに割れるので二重に数えてしまう
 *   - 表示範囲に入っていないタイルは読み込まれず、そもそも数えられない
 *     (初期表示は日本周辺なので、ハワイやグアムのポリゴンが漏れる)
 * mrgid がフィーチャの一意キーなので、GeoJSONを直接読んで重複排除して合算する。
 *
 * pol_type が '200NM' のものだけを足す。'Overlapping claim'(係争中)と
 * 'Joint regime'(共同管理)は、どの国の取り分とも決まっていないため足さない。
 * 日本の場合、除かれるのは北方領土・尖閣・竹島の周辺と日韓暫定水域で、
 * 合計約37万km²になる(詳細は columns.ts の method を参照)。
 */

interface EezProps {
  pol_type: string
  sovereign1: string
  area_km2: number
  mrgid: number
}

export async function loadRealAreas(): Promise<Record<string, number>> {
  const res = await fetch(
    `${import.meta.env.BASE_URL}data/eez.geojson${
      import.meta.env.DEV ? `?t=${Date.now()}` : ''
    }`,
  )
  if (!res.ok) throw new Error(`eez.geojson: ${res.status}`)
  const fc = (await res.json()) as {
    features: { properties: EezProps }[]
  }
  const seen = new Set<number>()
  const areas: Record<string, number> = {}
  for (const { properties: p } of fc.features) {
    if (p.pol_type !== '200NM') continue
    if (seen.has(p.mrgid)) continue
    seen.add(p.mrgid)
    areas[p.sovereign1] = (areas[p.sovereign1] ?? 0) + p.area_km2
  }
  return areas
}
