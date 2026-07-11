/**
 * UIスレッド側のエンジン窓口(Workerプール)。
 * グリッドを行バンドに分割して全コアで並列計算し、結果を結合して返す。
 * 各Workerは自分のバンド状態を保持するので、差分更新(ドラッグ)も
 * バンドごとに並列で走る。
 */
import { alignRow, countryOrder } from './eezEngine'
import type {
  BandResponse,
  BaselineFile,
  EezResult,
  GridSpec,
  LonLat,
  PointsByCountry,
  WorkerRequest,
} from './types'

const POOL_SIZE = Math.min(
  6,
  Math.max(2, (globalThis.navigator?.hardwareConcurrency ?? 4) - 1),
)

/**
 * 陸マスク用データの絶対URL。ここ(メインスレッド)で解決する。
 * BASE_URLは'./'なので、Worker内でfetchするとWorkerスクリプトの場所を
 * 基準に解決されてしまう(サブパス配信下で404になる)
 */
const LAND_URL = new URL(
  `${import.meta.env.BASE_URL}data/land.geojson`,
  globalThis.location?.href,
).href

let workers: Worker[] | null = null
let baselinePromise: Promise<BaselineFile> | null = null
let requestSeq = 0
const pending = new Map<number, (r: BandResponse) => void>()

/** 直近のcomputeの結合状態(update結果のマージ先) */
interface PoolState {
  grid: GridSpec
  countries: string[]
  codes: Uint8Array
  bandAreas: Float64Array[]
}
let poolState: PoolState | null = null

function getWorkers(): Worker[] {
  if (!workers) {
    workers = Array.from({ length: POOL_SIZE }, () => {
      const w = new Worker(new URL('./worker.ts', import.meta.url), {
        type: 'module',
      })
      w.onmessage = (e: MessageEvent<BandResponse>) => {
        if (e.data.type !== 'result') return
        const resolve = pending.get(e.data.requestId)
        if (resolve) {
          pending.delete(e.data.requestId)
          resolve(e.data)
        }
      }
      return w
    })
  }
  return workers
}

/** ユニオン型の各メンバーからrequestIdを除く(Omitはユニオンを潰すため) */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never

function post(
  worker: Worker,
  msg: DistributiveOmit<WorkerRequest, 'requestId'>,
): Promise<BandResponse> {
  const requestId = ++requestSeq
  return new Promise((resolve) => {
    pending.set(requestId, resolve)
    worker.postMessage({ ...msg, requestId })
  })
}

export function loadBaseline(): Promise<BaselineFile> {
  baselinePromise ??= fetch(
    `${import.meta.env.BASE_URL}data/baseline-points.json${
      import.meta.env.DEV ? `?t=${Date.now()}` : ''
    }`,
  ).then((r) => {
    if (!r.ok) throw new Error(`baseline-points.json: ${r.status}`)
    return r.json() as Promise<BaselineFile>
  })
  return baselinePromise
}

/** バンド応答をpoolStateへマージして結合結果を作る */
function assemble(responses: BandResponse[], elapsedMs: number): EezResult {
  const st = poolState!
  const { width } = st.grid
  let dirty: EezResult['dirty']
  responses.forEach((res, i) => {
    if (!res.changed || !res.codes || !res.areaByCode) return
    // インターリーブされた担当行を元の位置に書き戻す
    let k = 0
    for (
      let r = alignRow(res.gatherR0, res.rowOffset, res.rowStride);
      r < res.gatherR1;
      r += res.rowStride, k++
    ) {
      st.codes.set(res.codes.subarray(k * width, (k + 1) * width), r * width)
    }
    st.bandAreas[i] = res.areaByCode
    if (res.dirty) {
      dirty = dirty
        ? {
            r0: Math.min(dirty.r0, res.dirty.r0),
            r1: Math.max(dirty.r1, res.dirty.r1),
            c0: Math.min(dirty.c0, res.dirty.c0),
            c1: Math.max(dirty.c1, res.dirty.c1),
          }
        : { ...res.dirty }
    }
  })
  const areaKm2: Record<string, number> = {}
  st.countries.forEach((country, ci) => {
    areaKm2[country] = st.bandAreas.reduce((s, a) => s + (a[ci + 1] ?? 0), 0)
  })
  return {
    grid: st.grid,
    countries: st.countries,
    // 結合バッファをそのまま渡す(毎フレームのMB級コピーを避ける)。
    // 消費側は受け取ったタイミングで読み切ること(保持すると次の
    // 更新で書き換わる)
    codes: st.codes,
    areaKm2,
    dirty,
    elapsedMs,
  }
}

/** 全域計算(行バンドを並列実行)。結果は差分更新の基準として保持される */
export async function requestCompute(
  points: PointsByCountry,
  grid: GridSpec,
): Promise<EezResult> {
  const pool = getWorkers()
  const countries = countryOrder(points)
  poolState = {
    grid,
    countries,
    codes: new Uint8Array(grid.width * grid.height),
    bandAreas: pool.map(() => new Float64Array(countries.length + 1)),
  }
  const t0 = performance.now()
  const jobs = pool.map((w, i) =>
    post(w, {
      type: 'compute',
      points,
      grid,
      countries,
      rowOffset: i,
      rowStride: pool.length,
      landUrl: LAND_URL,
    }),
  )
  const responses = await Promise.all(jobs)
  return assemble(responses, performance.now() - t0)
}

/** 差分更新(各Workerが自バンドとwindowの交差部分だけ再分類) */
export async function requestUpdate(payload: {
  staticVersion: number
  staticPoints?: PointsByCountry
  movingCountry: string
  movingPoints: LonLat[]
  window: [number, number, number, number]
}): Promise<EezResult> {
  if (!poolState) throw new Error('requestUpdate before requestCompute')
  const t0 = performance.now()
  const responses = await Promise.all(
    getWorkers().map((w) => post(w, { type: 'update', ...payload })),
  )
  return assemble(responses, performance.now() - t0)
}

// ---- プールとは独立した単発計算(島の寄与・基準面積などの裏方処理用) ----
// プールのバンド状態(ドラッグの差分更新基準)を汚さないよう専用Workerで行う。

let detachedWorker: Worker | null = null

export async function requestComputeDetached(
  points: PointsByCountry,
  grid: GridSpec,
): Promise<EezResult> {
  if (!detachedWorker) {
    detachedWorker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })
    detachedWorker.onmessage = (e: MessageEvent<BandResponse>) => {
      if (e.data.type !== 'result') return
      const resolve = pending.get(e.data.requestId)
      if (resolve) {
        pending.delete(e.data.requestId)
        resolve(e.data)
      }
    }
  }
  const countries = countryOrder(points)
  const res = await post(detachedWorker, {
    type: 'compute',
    points,
    grid,
    countries,
    rowOffset: 0,
    rowStride: 1,
    landUrl: LAND_URL,
  })
  const areaKm2: Record<string, number> = {}
  countries.forEach((country, ci) => {
    areaKm2[country] = res.areaByCode?.[ci + 1] ?? 0
  })
  return {
    grid,
    countries,
    codes: res.codes ?? new Uint8Array(0),
    areaKm2,
    elapsedMs: res.elapsedMs,
  }
}
