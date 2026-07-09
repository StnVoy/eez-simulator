/**
 * データ事前処理スクリプト(開発時に一度だけ実行)
 *
 * 1. Marine Regions WFS から対象範囲のEEZポリゴンを取得
 * 2. Natural Earth 10m 陸地を取得
 * 3. bboxでクリップ・簡略化して public/data/ に静的GeoJSONとして出力
 *
 * 実行: node scripts/fetch-data.mjs
 * 出典: Flanders Marine Institute (VLIZ), Marine Regions (CC BY-NC-SA)
 *       Natural Earth (パブリックドメイン)
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, 'scripts', '.cache');
const outDir = path.join(root, 'public', 'data');
mkdirSync(tmpDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

// 対象範囲: 東経90°〜180°、北緯0°〜60°
// (日本の全EEZを中心に、東南アジア〜ミクロネシア〜オホーツクまで
//  自由にパンしても見切れない広域)
const BBOX = [90, 0, 180, 60];

async function download(url, file) {
  const dest = path.join(tmpDir, file);
  try {
    if (statSync(dest).size > 0) {
      console.log(`skip (cached): ${file}`);
      return dest;
    }
  } catch {
    /* not cached */
  }
  console.log(`download: ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`  -> ${file} (${(buf.length / 1e6).toFixed(1)} MB)`);
  return dest;
}

function mapshaper(args) {
  execFileSync('npx', ['mapshaper', ...args], { cwd: root, stdio: 'inherit' });
}

// ---- 1. EEZ (Marine Regions WFS) ----
const wfsParams = new URLSearchParams({
  service: 'WFS',
  version: '2.0.0',
  request: 'GetFeature',
  typeNames: 'MarineRegions:eez',
  outputFormat: 'application/json',
  srsName: 'EPSG:4326',
  // GeoServerのEPSG:4326は緯度が先(lat,lon順)
  cql_filter: `BBOX(the_geom,${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]})`,
  propertyName:
    'the_geom,mrgid,geoname,pol_type,sovereign1,sovereign2,sovereign3,' +
    'territory1,iso_ter1,iso_sov1,area_km2',
});
const eezRaw = await download(
  `https://geo.vliz.be/geoserver/MarineRegions/ows?${wfsParams}`,
  'eez_raw.json',
);

// ---- 2. 陸地 (Natural Earth 10m) ----
const landRaw = await download(
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_land.geojson',
  'ne_10m_land_raw.json',
);

// ---- 2b. 国別ポリゴン (基線サンプリング用) ----
const adminRaw = await download(
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson',
  'ne_10m_admin_0_raw.json',
);

// ---- 2c. 国境線 (陸上の国と国の境界) ----
const bordersRaw = await download(
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_boundary_lines_land.geojson',
  'ne_10m_boundary_lines_land_raw.json',
);

// ---- 3. クリップ・簡略化 ----
const clip = `bbox=${BBOX.join(',')}`;

console.log('\nprocess: eez.geojson');
// 2パス: 先に簡略化・dissolve・precision丸めをして中間ファイルへ。
// precision丸めは密な海岸線の頂点を同一格子へ寄せ、稀に自己交差を
// 生む(半透明塗りが海側に濃い三角形を描くアーティファクトの原因)。
// そこで丸めた座標に対してもう一度 -clean を掛けて交差を除去する。
const eezPre = path.join(tmpDir, 'eez_pre.geojson');
mapshaper([
  eezRaw,
  '-clip', clip,
  '-simplify', '8%', 'keep-shapes',
  '-clean',
  '-dissolve2', 'mrgid',
  `copy-fields=geoname,pol_type,sovereign1,sovereign2,sovereign3,territory1,iso_ter1,iso_sov1,area_km2`,
  '-o', 'precision=0.001', 'format=geojson', eezPre,
]);
mapshaper([
  eezPre,
  '-clean', // 丸めで生じた自己交差を除去
  '-o', 'format=geojson', path.join(outDir, 'eez.geojson'),
]);

console.log('\nprocess: land.geojson');
mapshaper([
  landRaw,
  '-clip', clip,
  '-simplify', '15%', 'keep-shapes',
  '-clean',
  '-filter-slivers',
  '-o', 'precision=0.001', 'format=geojson', path.join(outDir, 'land.geojson'),
]);

console.log('\nprocess: borders.geojson');
mapshaper([
  bordersRaw,
  '-clip', clip,
  '-simplify', '12%', 'keep-shapes',
  // FEATURECLA(境界の種別: International boundary / Disputed / Line of control 等)だけ残す
  '-filter-fields', 'FEATURECLA',
  '-rename-fields', 'featurecla=FEATURECLA',
  '-o', 'precision=0.001', 'format=geojson', path.join(outDir, 'borders.geojson'),
]);

// ---- 4. 基線点群のサンプリング ----
// 海岸線(国別ポリゴンの外周リング)から一定間隔で点を抽出し、
// 計算エンジン(最近傍=Voronoi配分)の入力にする。
console.log('\nprocess: baseline-points.json');

const SPACING_KM = 10;
// EEZ計算に影響する範囲は表示bboxより広い(200海里=370km+余裕)
const EXT_BBOX = [86, -4, 180, 64];

/** Natural EarthのSOVEREIGNT → エンジンで使う国名 */
const SOV_MAP = {
  Japan: 'Japan',
  China: 'China',
  Taiwan: 'Taiwan',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
  Russia: 'Russia',
  Philippines: 'Philippines',
  Vietnam: 'Vietnam',
  'United States of America': 'United States',
  'Marshall Islands': 'Marshall Islands',
  Indonesia: 'Indonesia',
  Malaysia: 'Malaysia',
  Thailand: 'Thailand',
  Myanmar: 'Myanmar',
  Cambodia: 'Cambodia',
  Singapore: 'Singapore',
  Brunei: 'Brunei',
  India: 'India',
  Bangladesh: 'Bangladesh',
  Palau: 'Palau',
  // Marine Regionsのsovereign名に合わせる
  'Federated States of Micronesia': 'Micronesia',
  'Papua New Guinea': 'Papua New Guinea',
  Kiribati: 'Kiribati',
  Nauru: 'Nauru',
};

/**
 * 係争島のポリゴンは所属国から切り離して独立グループにする。
 * デフォルト帰属は日本の公式見解ベース(UIで注記・将来切替可能)。
 */
const DISPUTED_REGIONS = [
  {
    id: 'northern-territories',
    nameJa: '北方領土',
    bbox: [145.3, 43.2, 149.2, 45.7],
    from: 'Russia',
    claimants: ['Japan', 'Russia'],
    defaultOwner: 'Japan',
  },
  {
    id: 'takeshima',
    nameJa: '竹島',
    bbox: [131.7, 37.1, 132.0, 37.4],
    from: 'South Korea',
    claimants: ['Japan', 'South Korea'],
    defaultOwner: 'Japan',
  },
  {
    id: 'senkaku',
    nameJa: '尖閣諸島',
    bbox: [123.4, 25.6, 124.7, 26.05],
    from: 'Japan', // NE上は日本領。日本の基線から切り離して独立グループ化
    claimants: ['Japan', 'China'],
    defaultOwner: 'Japan',
  },
];

/**
 * ドラッグ/ON・OFF可能な島。基線点群から独立グループとして抽出する。
 * manual: Natural Earthに存在しない微小島は座標を直接指定
 * from: 'country:名前' / 'disputed:グループid' / 'sovereign:NE主権名' から
 *       bbox内の点を移す(sovereignはSOV_MAP対象外の独立フィーチャ用)
 * ownerOptions: 帰属をユーザーが選べる島(係争地)。ownerは既定(nullで未帰属)
 */
const DRAGGABLE_ISLANDS = [
  {
    id: 'okinotorishima',
    nameJa: '沖ノ鳥島',
    owner: 'Japan',
    manual: [[136.0817, 20.4253]], // NE 10mに存在しない
  },
  {
    id: 'minamitorishima',
    nameJa: '南鳥島',
    owner: 'Japan',
    from: 'country:Japan',
    bbox: [153.9, 24.2, 154.1, 24.4],
  },
  {
    id: 'yonaguni',
    nameJa: '与那国島',
    owner: 'Japan',
    from: 'country:Japan',
    bbox: [122.85, 24.38, 123.06, 24.52],
  },
  {
    id: 'tsushima',
    nameJa: '対馬',
    owner: 'Japan',
    from: 'country:Japan',
    bbox: [129.15, 34.0, 129.55, 34.75],
  },
  {
    id: 'ogasawara',
    nameJa: '小笠原・硫黄列島',
    owner: 'Japan',
    from: 'country:Japan',
    bbox: [140.8, 24.0, 143.5, 27.8], // 小笠原(父島・母島)＋硫黄列島
  },
  {
    // 択捉島は北方領土グループから抽出。帰属は北方領土の切替と連動させる
    id: 'etorofu',
    nameJa: '択捉島',
    owner: 'Japan',
    from: 'disputed:northern-territories',
    bbox: [146.5, 44.3, 149.1, 45.75],
    disputeId: 'northern-territories',
  },
  {
    // 南沙諸島は主権が激しく争われる。既定は未帰属(どの国のEEZにもならない)、
    // ユーザーが「支配国」を選んで観察する
    id: 'spratly',
    nameJa: '南沙諸島',
    owner: null,
    ownerOptions: ['China', 'Vietnam', 'Philippines', 'Malaysia', 'Taiwan', 'Brunei'],
    from: 'sovereign:Spratly Islands',
    bbox: [113.5, 9.0, 116.5, 11.5],
  },
];

const R_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
function haversineKm([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(a));
}

const inBbox = ([x, y], [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** 外周リングをspacing間隔でサンプリング(微小リングも最低1点保証) */
function sampleRing(ring, spacingKm, bbox, out) {
  let emitted = 0;
  let acc = spacingKm; // 最初のbbox内頂点を必ず拾う
  let prev = null;
  for (const pt of ring) {
    if (prev) acc += haversineKm(prev, pt);
    prev = pt;
    if (acc >= spacingKm && inBbox(pt, bbox)) {
      out.push([Math.round(pt[0] * 1e4) / 1e4, Math.round(pt[1] * 1e4) / 1e4]);
      emitted++;
      acc = 0;
    }
  }
  return emitted;
}

const adminFc = JSON.parse(readFileSync(adminRaw, 'utf8'));
const countries = {};
const disputedOut = {};
for (const d of DISPUTED_REGIONS) {
  disputedOut[d.id] = {
    nameJa: d.nameJa,
    claimants: d.claimants,
    defaultOwner: d.defaultOwner,
    // マーカー表示用の代表点(係争島クラスタのbbox中心)
    centroid: [
      Math.round(((d.bbox[0] + d.bbox[2]) / 2) * 1e4) / 1e4,
      Math.round(((d.bbox[1] + d.bbox[3]) / 2) * 1e4) / 1e4,
    ],
    points: [],
  };
}

for (const f of adminFc.features) {
  const country = SOV_MAP[f.properties.SOVEREIGNT];
  if (!country) continue;
  countries[country] ??= [];
  const polys =
    f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const poly of polys) {
    const ring = poly[0]; // 外周のみ(穴=湖は海岸線ではない)
    // 係争地域のリングは独立グループへ
    const disputed = DISPUTED_REGIONS.find(
      (d) => country === SOV_MAP[d.from] && ring.every((pt) => inBbox(pt, d.bbox)),
    );
    const out = disputed ? disputedOut[disputed.id].points : countries[country];
    sampleRing(ring, SPACING_KM, EXT_BBOX, out);
  }
}
// ドラッグ可能な島の点群を抽出(元のグループからは取り除く)
const islandsOut = {};
for (const isl of DRAGGABLE_ISLANDS) {
  let points = [];
  if (isl.manual) {
    points = isl.manual;
  } else {
    const [kind, key] = isl.from.split(':');
    if (kind === 'sovereign') {
      // SOV_MAP対象外の独立フィーチャ(南沙諸島等)をその場でサンプリング
      const all = [];
      for (const f of adminFc.features) {
        if (f.properties.SOVEREIGNT !== key) continue;
        const polys =
          f.geometry.type === 'MultiPolygon'
            ? f.geometry.coordinates
            : [f.geometry.coordinates];
        for (const poly of polys) sampleRing(poly[0], SPACING_KM, EXT_BBOX, all);
      }
      points = all.filter((pt) => inBbox(pt, isl.bbox));
    } else {
      const src = kind === 'country' ? countries[key] : disputedOut[key].points;
      points = src.filter((pt) => inBbox(pt, isl.bbox));
      const rest = src.filter((pt) => !inBbox(pt, isl.bbox));
      if (kind === 'country') countries[key] = rest;
      else disputedOut[key].points = rest;
    }
  }
  if (points.length === 0) throw new Error(`island ${isl.id}: no points extracted`);
  const anchor = [
    Math.round((points.reduce((s, p) => s + p[0], 0) / points.length) * 1e4) / 1e4,
    Math.round((points.reduce((s, p) => s + p[1], 0) / points.length) * 1e4) / 1e4,
  ];
  islandsOut[isl.id] = {
    nameJa: isl.nameJa,
    owner: isl.owner ?? null,
    ...(isl.ownerOptions ? { ownerOptions: isl.ownerOptions } : {}),
    ...(isl.disputeId ? { disputeId: isl.disputeId } : {}),
    anchor,
    points,
  };
}

const baseline = {
  spacingKm: SPACING_KM,
  bbox: EXT_BBOX,
  countries,
  disputed: disputedOut,
  islands: islandsOut,
};
writeFileSync(path.join(outDir, 'baseline-points.json'), JSON.stringify(baseline));
for (const [c, pts] of Object.entries(countries)) console.log(`  ${c}: ${pts.length} pts`);
for (const [id, d] of Object.entries(disputedOut)) console.log(`  [disputed] ${id}: ${d.points.length} pts`);
for (const [id, isl] of Object.entries(islandsOut)) console.log(`  [island] ${id}: ${isl.points.length} pts @ ${isl.anchor}`);

for (const f of ['eez.geojson', 'land.geojson', 'borders.geojson', 'baseline-points.json']) {
  const size = statSync(path.join(outDir, f)).size;
  console.log(`${f}: ${(size / 1e6).toFixed(2)} MB`);
}
console.log('done');
