/** 島の教育コンテンツ(情報カード・豆知識)と「もしも」シナリオ定義 */

export interface IslandInfo {
  /** 陸地としての実面積(表示用テキスト) */
  landAreaText: string
  /** 豆知識 */
  trivia: string
  /** センシティブな論点の中立的な注記(あれば) */
  note?: string
}

export const ISLAND_INFO: Record<string, IslandInfo> = {
  okinotorishima: {
    landAreaText: '約9m²(満潮時に露出する2つの岩)',
    trivia:
      '日本最南端の島。満潮時にはテーブルほどの岩が2つ海面に出るだけだが、国土面積(約37.8万km²)を上回る広さのEEZを支える。波の浸食から守るため、約300億円をかけた護岸で保護されている。',
    note:
      '国連海洋法条約121条は「人間の居住又は独自の経済的生活を維持できない岩」はEEZを持たないと定めており、中国・韓国などは沖ノ鳥島を「岩」と主張、日本は「島」との立場をとる。本アプリは日本の立場(EEZあり)を既定とする。',
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
      '北方領土は日本固有の領土というのが日本の立場だが、現在はロシアが実効支配しており係争中。本アプリは既定で日本の基線に含めて計算している。',
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
  spratly: {
    landAreaText: '個々は数百m²〜数km²の岩礁・サンゴ礁の集まり',
    trivia:
      '南シナ海に散らばる100以上の岩礁群。石油・ガス・漁業資源と航路の要衝で、埋め立てによる人工島の造成が続く。小さな岩がどれだけ広いEEZを生むか——沖ノ鳥島と同じ構図を多国間で見られる。',
    note:
      '中国・ベトナム・フィリピン・マレーシア・台湾・ブルネイが全部または一部の領有を主張する、世界有数の係争海域。本アプリはどの国の立場も取らない。「支配国」を選んで、同じ岩礁が国ごとにどれだけの海域を生むかを観察するための機能である。',
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
    description: '数m²の岩が支える約40万km²が消える',
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
    description: '4つの島(沖ノ鳥島・南鳥島・与那国島・択捉島)を同時にOFF',
    disable: ['okinotorishima', 'minamitorishima', 'yonaguni', 'etorofu'],
  },
]
