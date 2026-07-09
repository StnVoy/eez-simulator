/**
 * 沖縄トラフ: 中国が国連の大陸棚限界委員会(CLCS)に提出した
 * 「200海里を超える大陸棚の外側限界」を構成する固定点(FP1〜FP10)。
 *
 * 出典: Submission by the People's Republic of China Concerning the Outer
 * Limits of the Continental Shelf beyond 200 Nautical Miles in Part of the
 * East China Sea, Executive Summary, Table 1 (2012年12月14日提出)
 * https://www.un.org/depts/los/clcs_new/submissions_files/submission_chn_63_2012.htm
 *
 * 各点は同文書で「沖縄トラフの軸上の最大水深点(maximum water depth point on
 * the axis of the Okinawa Trough)」と説明されている。
 *
 * 重要: これは【大陸棚】の外側限界であって、EEZの境界線ではない。
 * 中国はEEZの境界線を公表していない。したがってこの線はEEZ計算に一切
 * 使わず、参考レイヤーとしてのみ地図に描く。詳細は columns.ts の senkaku を参照。
 */

/** [経度, 緯度] の順(GeoJSONに合わせる) */
export const OKINAWA_TROUGH_POINTS: [number, number][] = [
  [129.1708, 30.8991], // FP1
  [129.1588, 30.6679], // FP2
  [129.2928, 30.4867], // FP3
  [129.2767, 30.1781], // FP4
  [128.8008, 29.6552], // FP5
  [128.6608, 29.2286], // FP6
  [128.5228, 28.9953], // FP7
  [128.2528, 28.4127], // FP8
  [127.8888, 28.1746], // FP9
  [127.6248, 27.9931], // FP10
]

/** 中国の部分申請であり、東シナ海全域を覆う線ではないことの注記 */
export const OKINAWA_TROUGH_NOTE =
  '中国が2012年にCLCSへ提出した「部分申請」の外側限界(10点)。大陸棚の主張であり、EEZの境界線ではありません。'
