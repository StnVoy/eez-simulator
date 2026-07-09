/** 島の教育コンテンツ(情報カード・豆知識)と「もしも」シナリオ定義 */

export interface IslandInfo {
  /** 陸地としての実面積(表示用テキスト) */
  landAreaText: string
  /** 豆知識 */
  trivia: string
  /** センシティブな論点の中立的な注記(あれば) */
  note?: string
  /** 「詳しく」から開く解説コラムのid(COLUMNSのキー) */
  columnId?: string
  /** 帰属を選ぶselectの「未帰属」選択肢のラベル(既定より具体的に書きたい島用) */
  unassignedLabel?: string
}

/**
 * 領有権が争われている島。ドラッグもON/OFFもできない。
 *
 * 島を動かせる・消せるという操作は「主権とは幾何学である」という誤った
 * 感覚を残す。領有権は条約と歴史と実効支配の積み重ねであって、位置の
 * 問題ではない。これらの島について意味のある操作は「どちらの国の基点と
 * して使うか」だけなので、それだけを残す。
 */
export const LOCKED_ISLAND_IDS: ReadonlySet<string> = new Set([
  'etorofu', // 北方領土
  'spratly', // 南沙諸島
])

export const ISLAND_INFO: Record<string, IslandInfo> = {
  okinotorishima: {
    landAreaText: '約9m²(満潮時に露出する2つの岩)',
    trivia:
      '日本最南端の島。満潮時にはテーブルほどの岩が2つ海面に出るだけだが、国土面積(約37.8万km²)を上回る広さのEEZを支える。波の浸食から守るため、約300億円をかけた護岸で保護されている。',
    note:
      '国連海洋法条約121条は「人間の居住又は独自の経済的生活を維持できない岩」はEEZを持たないと定めており、中国・韓国などは沖ノ鳥島を「岩」と主張、日本は「島」との立場をとる。本アプリは日本の立場(EEZあり)を既定とする。',
    columnId: 'okinotorishima',
  },
  minamitorishima: {
    landAreaText: '約1.5km²',
    trivia:
      '日本最東端の島。ほかの日本の島から1,000km以上離れた絶海の孤島で、この1島だけで約43万km²のEEZを生む。周辺の海底には次世代資源として注目されるレアアース泥が眠る。',
  },
  yonaguni: {
    landAreaText: '約29km²',
    trivia:
      '日本最西端の有人島。台湾までわずか約111km、晴れた日には台湾の山並みが見える。日本のEEZの西の縁を支える島。',
  },
  etorofu: {
    landAreaText: '約3,167km²',
    trivia:
      '北方四島で最大の島。沖縄本島の約2.6倍の面積があり、周辺は世界有数の好漁場として知られる。',
    note:
      '北方領土は日本固有の領土というのが日本の立場だが、現在はロシアが実効支配しており係争中。本アプリの既定は「係争中」で、どの国のEEZにも算入しない。領有権の問題は島の位置とは無関係なので、この島は動かせない。',
    columnId: 'northern-territories',
  },
  tsushima: {
    landAreaText: '約709km²',
    trivia:
      '長崎県の島。日本と韓国の中間線のほぼ真上に位置し、韓国・釜山までわずか約50km。日韓のEEZ境界を左右する要の島で、少し動かすだけで両国の取り分が大きく変わる。',
  },
  ogasawara: {
    landAreaText: '小笠原+硫黄列島で約100km²',
    trivia:
      '本州から約1,000km南に連なる島々。一度も大陸と地続きになったことがなく「東洋のガラパゴス」として世界自然遺産に登録。硫黄島まで含む列島が、太平洋へEEZを橋のように延ばしている。',
  },
  hachijojima: {
    landAreaText: '約69km²',
    trivia:
      '東京都・伊豆諸島南部の有人島。本州から約290km南にあり、東京から飛行機で約55分。本州と小笠原の間をつなぐ位置にあって、伊豆・小笠原諸島が連なることで日本のEEZが太平洋へ途切れずに延びている。',
  },
  okidaitojima: {
    landAreaText: '約1.15km²',
    trivia:
      '沖縄本島の東約400kmに浮かぶ無人島。ラサ島とも呼ばれ、かつてリン鉱石が採掘された。現在は民有地で、米軍の射爆撃場として使われており立ち入れない。人が住まない1km²の島が、沖縄の南東に広大なEEZを支えている。',
  },
  spratly: {
    landAreaText: '個々は数百m²〜数km²の岩礁・サンゴ礁の集まり',
    trivia:
      '南シナ海に散らばる100以上の岩礁群。石油・ガス・漁業資源と航路の要衝で、埋め立てによる人工島の造成が続く。小さな岩がどれだけ広いEEZを生むか——沖ノ鳥島と同じ構図を多国間で見られる。',
    note:
      '2016年の仲裁判断は、南沙諸島のいずれの地形もEEZを生まないと結論した。既定はこの立場。支配国を選ぶと、地形に完全な効果を与えた場合のEEZを描く(仲裁判断とは異なる仮定)。',
    columnId: 'spratly',
    unassignedLabel: 'どの地形もEEZを生まない(2016年仲裁判断)',
  },
}

/** 第121条(岩か島か)トグルを持つ島と、各国の立場 */
export interface Article121Config {
  /** 「島」の立場をとる側の説明 */
  islandSide: string
  /** 「岩」の立場をとる側の説明 */
  rockSide: string
}

export const ARTICLE121: Record<string, Article121Config> = {
  okinotorishima: {
    islandSide: '島(EEZあり)— 日本の立場',
    rockSide: '岩(EEZなし)— 中国・韓国の立場',
  },
}

export interface Scenario {
  id: string
  label: string
  description: string
  /** OFFにする島のid */
  disable: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'no-okinotori',
    label: 'もしも沖ノ鳥島がなかったら',
    description: '数m²の岩が支える約41万km²が消える',
    disable: ['okinotorishima'],
  },
  {
    id: 'no-minamitori',
    label: 'もしも南鳥島がなかったら',
    description: '最東端の孤島が生む約43万km²が消える',
    disable: ['minamitorishima'],
  },
  {
    id: 'no-remote-islands',
    label: 'もしも国境の離島が全部なかったら',
    // 領有権が争われている島(択捉島)は、消す操作の対象にしない
    description: '4つの島(沖ノ鳥島・南鳥島・与那国島・小笠原)を同時にOFF',
    disable: ['okinotorishima', 'minamitorishima', 'yonaguni', 'ogasawara'],
  },
]
