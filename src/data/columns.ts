/**
 * 解説コラム(モーダルで表示)。
 *
 * 方針:
 * - 各国の主張は、その国の政府・公的機関自身が公表した文書を出典にする。
 *   相手国の立場を第三国の要約で代弁させない。
 * - このアプリの計算モデルが特定の立場と一致してしまう箇所は、隠さず書く。
 * - 計算できないこと(中国はEEZ境界線を公表していない等)は、
 *   もっともらしい線を捏造せず「計算できない」と書く。
 */

/**
 * 出典を確認した時点。各国の主張・国際的な判断・公表文書は変わりうるので、
 * 本アプリの記述が「いつの情報に基づくものか」を必ず示す。
 * 出典を追加・更新したときは、この値も更新すること。
 */
export const SOURCES_AS_OF = '2026年7月'

export interface Source {
  /** 発行主体(外務省・国連 など) */
  publisher: string
  title: string
  url: string
}

/** 引用(原文を改変しない) */
export interface Quote {
  text: string
  /** 出典の短い表示(文書番号・段落番号など) */
  cite: string
}

/** ある国の主張を、その国自身の出典とともに示すブロック */
export interface ClaimBlock {
  /** COUNTRY_NAMES_JAのキー。色分けと揃える */
  country: string
  paragraphs: string[]
  quote?: Quote
  sources: Source[]
}

export interface ColumnSection {
  heading?: string
  paragraphs: string[]
  quote?: Quote
}

export interface Column {
  id: string
  title: string
  /** 導入の一文 */
  lead: string
  sections: ColumnSection[]
  claims?: ClaimBlock[]
  /** 「このアプリはこう扱っている」— 計算モデルとの対応関係 */
  modelNote?: string[]
  sources: Source[]
}

// ---- よく使う出典 ----

const UNCLOS: Source = {
  publisher: '国際連合',
  title: '海洋法に関する国際連合条約(UNCLOS)全文',
  url: 'https://www.un.org/depts/los/convention_agreements/texts/unclos/unclos_e.pdf',
}

const CAS_ECS: Source = {
  publisher: '内閣官房 領土・主権対策企画調整室',
  title: '東シナ海における日中韓間の境界未画定海域と「自制義務」',
  url: 'https://www.cas.go.jp/jp/ryodo/kenkyu/senkaku/chapter04_column_03.html',
}

const MOFA_TERRITORY: Source = {
  publisher: '外務省',
  title: '日本の領土をめぐる情勢',
  url: 'https://www.mofa.go.jp/mofaj/territory/',
}

const CLCS_JPN: Source = {
  publisher: '国際連合 大陸棚限界委員会(CLCS)',
  title: '日本の申請(2008年11月12日)と各国の口上書',
  url: 'https://www.un.org/depts/los/clcs_new/submissions_files/submission_jpn.htm',
}

const CLCS_JPN_REC: Source = {
  publisher: '国際連合 大陸棚限界委員会(CLCS)',
  title: '日本の申請に対する勧告の要約(2012年4月19日採択)',
  url: 'https://www.un.org/depts/los/clcs_new/submissions_files/jpn08/com_sumrec_jpn_fin.pdf',
}

const PCA_2016: Source = {
  publisher: '常設仲裁裁判所(PCA)',
  title: '南シナ海仲裁事件(フィリピン対中国)判断 プレスリリース(2016年7月12日)',
  url: 'https://pcacases.com/web/sendAttach/1801',
}

const CHN_CLCS_ECS: Source = {
  publisher: '国際連合 / 中華人民共和国',
  title:
    '東シナ海の一部における200海里を超える大陸棚の外側限界に関する中国の部分申請(2012年12月14日)',
  url: 'https://www.un.org/depts/los/clcs_new/submissions_files/submission_chn_63_2012.htm',
}

const JCG_TERMS: Source = {
  publisher: '海上保安庁 海洋情報部',
  title: '領海等に関する用語',
  url: 'https://www1.kaiho.mlit.go.jp/ryokai/zyoho/msk_idx.html',
}

const JCG_DIAGRAM: Source = {
  publisher: '海上保安庁 海洋情報部',
  title: '日本の領海等概念図',
  url: 'https://www1.kaiho.mlit.go.jp/ryokai/gainenzu.html',
}

const JCG_FAQ: Source = {
  publisher: '海上保安庁',
  title: '排他的経済水域(EEZ)と領海及び公海の違いを教えて下さい',
  url: 'https://www.kaiho.mlit.go.jp/questions/situgi/faq16.html',
}

// ---- コラム本体 ----

const WHAT_IS_EEZ: Column = {
  id: 'what-is-eez',
  title: 'そもそもEEZとは何か',
  lead:
    'EEZ(排他的経済水域)は「海の領土」ではありません。資源については沿岸国のもの、通ることについては誰のものでもない ―― そういう二重の性格を持った海域です。',
  sections: [
    {
      heading: '海は、岸からの距離で3つに分かれる',
      paragraphs: [
        'すべては「基線」から測ります。基線とはおおむね干潮時の海岸線のことで、島があればその島の海岸線も基線になります。このアプリで島を動かすと海が塗り替わるのは、基線が動くからです。',
        '基線から12海里(約22km)までが領海。沿岸国の主権が及び、上空にも海底にも及びます。ただし外国船には無害通航権があります。',
        '基線から24海里(約44km)までが接続水域。密輸・密入国・伝染病といった通関・出入国・衛生の法令違反を、沿岸国が防止・処罰できる水域です。',
        'そして基線から200海里(約370km)までがEEZです。日本の公的な説明では、EEZは「領海を除く」海域とされています。',
      ],
      quote: {
        text:
          'The exclusive economic zone shall not extend beyond 200 nautical miles from the baselines from which the breadth of the territorial sea is measured.',
        cite: '国連海洋法条約 第57条(排他的経済水域の幅)',
      },
    },
    {
      heading: '「主権」ではなく「主権的権利」',
      paragraphs: [
        'ここが一番大事なところです。領海に及ぶのは主権(sovereignty)ですが、EEZで沿岸国が持つのは主権的権利(sovereign rights)であって、対象は資源とその周辺に限られます。',
        '条約56条が挙げるのは、(a)海底の上部水域・海底・その下の天然資源(生物も非生物も)を探査・開発・保存・管理する主権的権利、および水・海流・風からのエネルギー生産のような経済的な活動。(b)人工島や施設の設置、海洋の科学的調査、海洋環境の保護についての管轄権。それだけです。',
        'EEZは領土ではないので、そこに国境はありません。地図の色分けは「この海の資源は誰のものか」を示しているのであって、「ここから先は入れない」を示しているのではありません。',
      ],
      quote: {
        text:
          'In the exclusive economic zone, the coastal State has: (a) sovereign rights for the purpose of exploring and exploiting, conserving and managing the natural resources, whether living or non-living, of the waters superjacent to the seabed and of the seabed and its subsoil…',
        cite: '国連海洋法条約 第56条1項',
      },
    },
    {
      heading: '他の国も、そこを自由に通れる',
      paragraphs: [
        '内陸国も含めたすべての国が、EEZで航行の自由・上空飛行の自由・海底電線と海底パイプラインを敷設する自由を持ちます。外国の軍艦や軍用機がEEZを通っても、それだけでは条約違反にはなりません。',
        'ニュースで「日本のEEZ内に着弾」と聞くと領海侵犯のように感じますが、法的な意味はまったく違います。EEZについて沿岸国が持っているのは、あくまで資源と一部の管轄権です。',
      ],
      quote: {
        text:
          'In the exclusive economic zone, all States, whether coastal or land-locked, enjoy … the freedoms referred to in article 87 of navigation and overflight and of the laying of submarine cables and pipelines…',
        cite: '国連海洋法条約 第58条1項',
      },
    },
    {
      heading: '獲りきれない魚は、他の国に分けなければならない',
      paragraphs: [
        'EEZの資源は「独占できる」というより「管理する責任を負う」に近い制度です。沿岸国は漁獲可能量を定め、自国で獲りきる能力がなければ、その余剰分を他国に利用させなければならない ―― 条約はそこまで書いています。',
      ],
      quote: {
        text:
          'Where the coastal State does not have the capacity to harvest the entire allowable catch, it shall … give other States access to the surplus of the allowable catch…',
        cite: '国連海洋法条約 第62条2項',
      },
    },
    {
      heading: '海底は、また別の制度',
      paragraphs: [
        '海底とその下(大陸棚)については、EEZとは別に条約の第6部が定めています。沿岸国は大陸棚の天然資源を探査・開発する主権的権利を持ち、この権利は誰も採らなくても消えません。',
        '大陸棚は条件を満たせば200海里を超えて延びることがあります。EEZは距離で決まる制度、大陸棚は地形で決まりうる制度 ―― この違いが、東シナ海で日本と中国の主張が噛み合わない理由の一つです(「尖閣諸島 / 釣魚島」のコラムを参照)。',
      ],
    },
    {
      heading: '「日本のEEZは何km²か」に答えが2つある理由',
      paragraphs: [
        '日本の公称値は、EEZ(領海を除く)が約405万km²、領海を含めると約447万km²です。条約55条もEEZを「領海の外側に接続する海域」と定義しているので、EEZに領海を含めないのが本来の数え方です。',
        'ところがこのアプリが使っている Marine Regions のポリゴンは領海を含んでいます(海岸から8kmの点も内側にあることを点内外判定で確認しました)。だからこのアプリの数字はすべて「領海込み」で、公称値と比べるなら447万km²のほうです。',
      ],
    },
  ],
  modelNote: [
    'このアプリは領海(12海里)とEEZ(200海里)を区別せず、基線から200海里以内をひとまとめに塗っています。ツールの「領海(12海里)とEEZ(200海里)の円を表示」を使うと、両者の桁違いのスケール差が見られます。',
    '描いているのは面積だけです。資源も、航行の自由も、漁業協定も、この地図には描かれていません。EEZの本体はむしろそちらにあります。',
  ],
  sources: [UNCLOS, JCG_TERMS, JCG_DIAGRAM, JCG_FAQ],
}

const METHOD: Column = {
  id: 'method',
  title: 'EEZはどう計算しているか',
  lead:
    'このアプリは公表された境界線をなぞっているのではなく、島と海岸線から毎回EEZを計算し直しています。だから島を動かすと境界が動きます。その仕組みと、そこに紛れ込んでいる「立場」の話。',
  sections: [
    {
      heading: 'やっていることは、たった一つ',
      paragraphs: [
        '海岸線と島から一定間隔で「基線点」を取り出し、海を細かい格子(2000×1677セル)に分けます。各セルについて最も近い基線点を探し、その距離が200海里(370.4km)以内なら、その基線点を持つ国のEEZに割り当てる。それだけです。',
        '「最も近い基線点の国のものになる」というのは、2国の基線から等距離にある点を結んだ線 ―― 中間線 ―― で海を分けることと同じです。数学ではボロノイ分割と呼びます。島をドラッグすると境界が動くのは、たくさんのセルで「最も近い基線点」が入れ替わるからです。',
        '距離は地球を球とみなした大圏距離で測り、面積は各セルを球面上の台形として足し上げています。メルカトル図法の地図では高緯度のセルが大きく見えますが、面積の計算では正しく小さく扱われます。',
      ],
    },
    {
      heading: '中間線は、中立ではない',
      paragraphs: [
        '中間線は国際判例でも境界画定の出発点として使われる、標準的な手法です。しかし国連海洋法条約74条が求めているのは「衡平な解決」であって、中間線そのものではありません。実際の境界は交渉や判決を通じて中間線から調整されます。',
        'そして東シナ海では、中間線による境界画定を主張しているのは日本です。中国と韓国は、大陸棚について「自然の延長」に依拠した主張を行っています。',
        'つまり、あなたが今見ている地図は中立な地図ではありません。少なくとも東シナ海に関しては、日本の立場に沿ったモデルで描かれた地図です。これはアプリの下部に小さく免責文を置いて済ませられる話ではないので、ここに書いておきます。',
      ],
    },
    {
      heading: 'すべての島に、等しい効果を与えている',
      paragraphs: [
        '現実の境界画定では、小さな島に完全な効果を与えず、部分的な効果しか認めない(あるいは無視する)ことがしばしば行われます。このアプリは、すべての基線点を平等に扱います。小さな島の影響は、現実よりも大きく出ます。',
      ],
    },
    {
      heading: '「日本のEEZ」は、誰が数えるかで34万km²動く',
      paragraphs: [
        'このアプリには日本のEEZ面積がいくつも出てきます。数え方が違うからです。鍵は「争いのある海域を、日本の取り分に入れるかどうか」の一点にあります。',
        '係争海域を除いた場合: 実データ(Marine Regions)は 406.7万km²、自前計算は 449.2万km²。',
        'すべて日本に算入した場合: 実データは 443.8万km²、自前計算は 483.3万km²。',
        '実データの Marine Regions は、争いのある海域を日本のEEZから切り出して別のポリゴンにしています。北方領土周辺 21.4万km²、尖閣諸島周辺 7.4万km²、日韓暫定水域 8.3万km²、竹島周辺 0.16万km²。足し戻すと 443.8万km² になり、日本の公称値 447万km² の 99.3% と一致します。領海を含む・含まないの違いではありません(Marine Regionsのポリゴンは領海を含みます)。',
        'このアプリの既定は「係争中」です。北方領土・竹島・尖閣の周辺は、どの国の面積にも算入せず、灰色の斜線で描きます。3つとも日本に割り当てると 34.1万km² 増えて 483.3万km²、公称値の108%になります。相手国に割り当てても、日本の面積は既定から1km²も動きません(もともと入っていないからです)。',
        '同じ「日本のEEZ」という言葉が、誰がどの立場で数えるかで34万km²動く。この幅そのものが、この問題の性質をよく表しています。',
      ],
    },
    {
      heading: 'モードを切り替えると、数字が42万km²跳ねる',
      paragraphs: [
        '実データ表示は Marine Regions の 406.7万km²。シミュレーションに切り替えると、係争中のままでも 449.2万km² になります。係争地がこっそり日本のものにされたわけではありません(相手国に割り当てても同じ 449.2万km² です)。差の 42.6万km²、10.5% は、まるごと計算モデルの違いです。',
        '内訳で一番大きいのは竹島です。Marine Regions は竹島の周辺をわずか 0.16万km² しか切り出していませんが、このアプリは竹島に完全な効果(200海里)を与えるので 6.3万km² の係争海域が生まれます。実際の境界画定では、こうした小さな島の効果は減らされるのが普通です。',
        'もう一つは日韓暫定水域(8.3万km²)です。Marine Regions はこれをどちらの国のEEZにも入れませんが、このアプリには共同管理という概念がなく、中間線で機械的に割ってしまいます。',
        '残りは、実際の直線基線ではなく海岸線から等間隔にサンプリングしていること、グリッドの離散化などの積み重ねです。',
      ],
    },
    {
      heading: 'モデルは近似である',
      paragraphs: [
        '係争海域をすべて日本に算入した場合の自前計算は約483万km²で、公称値(約447万km²)の約108%になります。漁業協定線や未画定海域、実際の直線基線を再現していないためです。',
        'さらに、海をセルに区切って「セルの中心が200海里以内か」で数えているため、島を1セル分(約4.6km)動かすだけで面積が300km²ほど揺れます。円の輪郭にかかる約500個のセルが、採用側にも棄却側にも転ぶからです。表示している数字の下3桁は、この揺らぎの中にあります。',
        'ここに出てくる数字は、桁と比率を感じ取るためのものです。法的な面積ではありません。',
      ],
    },
  ],
  sources: [UNCLOS, CAS_ECS],
}

const NORTHERN_TERRITORIES: Column = {
  id: 'northern-territories',
  title: '北方領土',
  lead:
    '争われているのは島の領有権だけで、海の分け方については日露ともに距離を基準にしています。だからこの3択は、そのまま両国の主張どおりのEEZになります。',
  sections: [],
  claims: [
    {
      country: 'Japan',
      paragraphs: [
        '北方四島(択捉島・国後島・色丹島・歯舞群島)は日本固有の領土であり、その帰属の問題を解決して平和条約を締結する、というのが日本政府の方針です。',
      ],
      sources: [MOFA_TERRITORY],
    },
    {
      country: 'Russia',
      paragraphs: [
        '南クリル諸島はロシア連邦の不可分の一部であり、その主権は第二次世界大戦の結果として確立した動かしがたい現実である、というのがロシア外務省の立場です。平和条約は、日本が第二次世界大戦の結果を全面的に認めることを前提とするとしています。',
      ],
      sources: [
        {
          publisher: 'ロシア連邦外務省',
          title: '南クリル諸島の問題について(On the issue of Southern Kuril Islands)',
          url: 'https://www.mid.ru/en/foreign_policy/news/1513045/',
        },
      ],
    },
  ],
  modelNote: [
    '既定は「係争中」です。北方領土の基線点はどちらの国の基線にも加えず、生まれる海域を灰色の斜線で描き、どの国の面積にも算入しません。島を動かしただけでこの状態が変わることはありません。',
    '日本またはロシアを選ぶと、択捉島を含む北方領土の基線点がその国の基線に加わります。',
    '境界の引き方(中間線)は、どちらを選んでも変わりません。両国とも距離を基準としているため、領有権が決まればそのまま線が引けます。',
  ],
  sources: [MOFA_TERRITORY],
}

const TAKESHIMA: Column = {
  id: 'takeshima',
  title: '竹島 / 独島',
  lead:
    'この島を「どちらの国の基点として使うか」が、そのまま日韓それぞれの主張する中間線の違いになります。3択は、その基点の付け替えそのものです。',
  sections: [
    {
      paragraphs: [
        '1996年に日韓が相次いで200海里のEEZを宣言した結果、日本海に両国の主張が重なる海域が生まれました。境界は今も未画定で、漁業に関する事項だけを定めた協定が暫定的に機能しています。',
      ],
    },
  ],
  claims: [
    {
      country: 'Japan',
      paragraphs: [
        '竹島は歴史的事実に照らしても国際法上も明らかに日本固有の領土である、というのが日本政府の立場です。',
      ],
      sources: [
        {
          publisher: '外務省',
          title: '竹島',
          url: 'https://www.mofa.go.jp/mofaj/area/takeshima/index.html',
        },
      ],
    },
    {
      country: 'South Korea',
      paragraphs: [
        '独島は歴史的・地理的・国際法的に明白な大韓民国の領土である、というのが韓国外交部の立場です。',
      ],
      sources: [
        {
          publisher: '大韓民国外交部',
          title: '独島 — 大韓民国の領土である根拠',
          url: 'https://dokdo.mofa.go.kr/jp/dokdo/reason.jsp',
        },
      ],
    },
  ],
  modelNote: [
    '既定は「係争中」で、竹島が生む海域はどちらの国の面積にも算入しません。',
    '日本または韓国を選ぶと、竹島の基線点がその国の基線に加わります。日本を選べば中間線は西へ、韓国を選べば東へ寄ります。',
    'ただしこのアプリは竹島に完全な効果を与えています。現実の境界画定では、このような小さな島の効果は減らされることが多く、実際の線はここで見えるものより穏やかになり得ます。',
  ],
  sources: [UNCLOS],
}

const SENKAKU: Column = {
  id: 'senkaku',
  title: '尖閣諸島 / 釣魚島',
  lead:
    'このコラムは、アプリの他のどの部分よりも慎重に読んでください。ここには、このアプリが計算できないことがあります。',
  sections: [
    {
      heading: 'そもそも「領土問題」と呼ぶこと自体が、一方の立場',
      paragraphs: [
        '日本政府の立場は「尖閣諸島は日本固有の領土であり、解決すべき領有権の問題はそもそも存在しない」というものです。したがって、このアプリが尖閣諸島を「領土問題」として3択にしていること自体が、日本政府の立場とは一致していません。',
        '中立であろうとすると、どちらかの立場からは必ずずれます。このアプリは、対立の存在を可視化する側を選びました。それは選択であって、中立の達成ではありません。',
      ],
    },
    {
      heading: '中国のEEZ境界線は、存在しない',
      paragraphs: [
        '東シナ海の境界画定について、日本は中間線を主張しています。中国は大陸棚について「自然の延長」を援用し、自国の大陸棚は沖縄トラフまで自然に延長していると主張します。',
        '2012年12月14日、中国はこの立場に沿って、沖縄トラフの軸上にある最深点10点を結ぶ線を「200海里を超える大陸棚の外側限界」として国連の大陸棚限界委員会(CLCS)に提出しました。この10点は、ツールの「沖縄トラフ」で地図に表示できます。',
        'ただし、これは大陸棚の主張であってEEZの境界線ではありません。大陸棚とEEZは別の制度です。距離に基づくEEZの境界をどこに引くべきかについて、中国は具体的な線を示していません。',
      ],
      quote: {
        text:
          '中国・韓国の立場からは大陸棚については自然の延長に基づいた境界画定を行うとしても、距離に基づく制度であるEEZについてはどのように境界画定を行うのかが問題となるはずであるが、この点に関する具体的な主張はなされていない',
        cite: '内閣官房 領土・主権対策企画調整室',
      },
    },
    {
      heading: 'だから、このアプリは線を引き直さない',
      paragraphs: [
        '尖閣諸島で「中国」を選んでも、EEZが沖縄トラフまで広がることはありません。存在しない主張を中国に代弁させることになるからです。切り替わるのは尖閣諸島の基線点の帰属だけで、境界の引き方は中間線のままです。',
        '線が引けないから紛争が終わらない ―― この地図に描けないことのほうが、描けることより多くを語っていると思います。',
      ],
    },
  ],
  claims: [
    {
      country: 'Japan',
      paragraphs: [
        '尖閣諸島は歴史的にも国際法上も明らかに日本固有の領土であり、現に日本はこれを有効に支配している。したがって尖閣諸島をめぐって解決すべき領有権の問題はそもそも存在しない、というのが日本政府の立場です。',
      ],
      sources: [
        {
          publisher: '外務省',
          title: '尖閣諸島',
          url: 'https://www.mofa.go.jp/mofaj/area/senkaku/index.html',
        },
      ],
    },
    {
      country: 'China',
      paragraphs: [
        '釣魚島及びその附属島嶼は中国領土の不可分の一部である、というのが中国政府の立場です。国務院新聞弁公室が2012年9月に発表した白書『釣魚島は中国の固有の領土である』に、その主張がまとめられています。',
      ],
      quote: {
        text:
          'Diaoyu Dao and its affiliated islands are an inseparable part of the Chinese territory.',
        cite: '中国国務院新聞弁公室 白書(2012年9月)',
      },
      sources: [
        {
          publisher: '中華人民共和国国務院新聞弁公室',
          title: '白書『Diaoyu Dao, an Inherent Territory of China』(2012年9月)',
          url: 'https://english.www.gov.cn/archive/white_paper/2014/08/23/content_281474983043212.htm',
        },
      ],
    },
  ],
  modelNote: [
    '既定は「係争中」で、尖閣諸島が生む海域はどちらの国の面積にも算入しません。',
    '日本または中国を選ぶと、尖閣諸島の基線点がその国の基線に加わります。それだけです。境界の引き方は中間線のままです。',
    '沖縄トラフの線は、EEZの計算には一切使っていません。制度が違うからです。',
  ],
  sources: [CAS_ECS, CHN_CLCS_ECS, UNCLOS],
}

const OKINOTORISHIMA: Column = {
  id: 'okinotorishima',
  title: '沖ノ鳥島は「島」か「岩」か',
  lead:
    '国連海洋法条約121条3項をめぐる争い。このアプリが扱うなかで、最も法的に生きている論点です。数m²の岩の周りに、日本の国土面積より広い海が懸かっています。',
  sections: [
    {
      heading: '条文はこれだけ',
      paragraphs: [
        '国連海洋法条約121条3項は、たった一文です。この一文の解釈に、約40万km²が懸かっています。',
      ],
      quote: {
        text:
          '人間の居住又は独自の経済的生活を維持することのできない岩は、排他的経済水域又は大陸棚を有しない。',
        cite: '国連海洋法条約 第121条3項',
      },
    },
    {
      heading: '国連に残された、三者三様の記録',
      paragraphs: [
        '日本は2008年11月12日、沖ノ鳥島を基点の一つとする延長大陸棚をCLCSに申請しました。これに対し中国と韓国が口上書で異議を申し立て、日本が反論しました。すべて国連の公開文書です。',
        '中国(2009年2月6日、CML/2/2009): 「利用可能な科学的データは、沖ノ鳥の岩がその自然の状態において人間の居住も独自の経済的生活も維持できないことを完全に示しており、したがって排他的経済水域も大陸棚も有しない」',
        '韓国(2009年2月27日、MUN/046/09): 沖ノ鳥島は121条3項の岩であり、200海里を超える大陸棚を有しない。またその法的地位は科学的・技術的な問題ではなく121条の解釈適用の問題であって、委員会の権限外である。',
        '日本(2012年4月9日、PM/12/078): 委員会が沖ノ鳥島に関する区域について勧告を行うべきでないという中国・韓国の議論には、条約・附属書・委員会手続規則のいずれにも法的根拠がない。',
      ],
      quote: {
        text:
          'It is to be noted that the so-called Oki-no-Tori Shima Island is in fact a rock as referred to in Article 121(3) of the Convention.',
        cite: '中国 口上書 CML/2/2009 (2009年2月6日)',
      },
    },
    {
      heading: '委員会は、片方だけを棚上げした',
      paragraphs: [
        'CLCSは2012年4月、日本が申請した7区域のうち、九州・パラオ海嶺南部(KPR)についてのみ勧告を行わないと決めました。口上書で指摘された事項が解決されるまで勧告を行う立場にない、というのが理由です。',
        '一方で、同じく沖ノ鳥島を基点とする四国海盆(SKB)には勧告が出ています。つまり日本は、沖ノ鳥島を基点とする延長大陸棚を、一部は認められ、一部は保留されました。この非対称が、この問題の宙づりの状態をよく表しています。',
        'なお、CLCSが扱うのは200海里を超える大陸棚であって、EEZでも領有権でもありません。委員会の勧告は「沖ノ鳥島は島である」と認定したものではありません。',
      ],
      quote: {
        text:
          'The Commission considers that it will not be in a position to take action to make recommendations on the Southern Kyushu-Palau Ridge Region (KPR) until such time as the matters referred to in the notes verbales have been resolved.',
        cite: 'CLCS 勧告の要約 第20項(2012年)',
      },
    },
    {
      heading: '2016年、基準が示された',
      paragraphs: [
        '南シナ海仲裁裁判所は2016年、121条3項の判断は「地形が自然の状態において、安定した人間の共同体、または外部の資源に依存せず純粋な採取にとどまらない経済活動を維持しうる客観的な能力」によると述べました。人が常駐していても、それが外部からの補給に依存していれば足りない、という基準です。',
        'この基準をそのまま当てはめれば、沖ノ鳥島の法的地位は厳しくなります。ただし仲裁判断はフィリピンと中国の間の事件についてのものであり、沖ノ鳥島について判断したものではありません。',
      ],
    },
  ],
  modelNote: [
    '情報カードの「島(EEZあり)/岩(EEZなし)」トグルは、この対立をそのまま反映します。「岩」を選ぶと、沖ノ鳥島の基線点を計算から外します。',
    '既定は日本の立場(島)です。既定値であることと、正しさは別です。',
  ],
  sources: [UNCLOS, CLCS_JPN, CLCS_JPN_REC, PCA_2016],
}

const SPRATLY: Column = {
  id: 'spratly',
  title: '南沙諸島と2016年の仲裁判断',
  lead:
    '同じ岩礁を、どの国が支配するとどれだけの海域が生まれるか。沖ノ鳥島とまったく同じ構図を、多国間で見られる場所です。ただし2016年、その前提そのものが否定されました。',
  sections: [
    {
      paragraphs: [
        '南沙諸島は南シナ海に散らばる100以上の岩礁群で、中国・ベトナム・フィリピン・マレーシア・台湾・ブルネイが全部または一部の領有を主張しています。',
      ],
    },
    {
      heading: 'どの地形も、EEZを生まない',
      paragraphs: [
        '2016年7月12日、国連海洋法条約附属書VIIに基づく仲裁裁判所(フィリピン対中国)は全員一致の判断を下し、南沙諸島のいずれの地形も200海里を超える水域を生む能力を有しないと結論しました。南沙諸島を一体として扱っても水域は生まれない、とも述べています。',
        '高潮時に水面上にある地形は12海里の領海を生みますが、EEZは生みません。人が駐留していても、それが外部からの補給に依存する限り「人間の居住」には当たらない ―― これが裁判所の基準です。',
        '中国は、この仲裁判断を受け入れず承認しないとの立場をとっています。',
      ],
      quote: {
        text:
          'Accordingly, the Tribunal concluded that none of the Spratly Islands is capable of generating extended maritime zones.',
        cite: 'PCA プレスリリース(2016年7月12日)',
      },
    },
  ],
  modelNote: [
    '既定は「どの地形もEEZを生まない(2016年仲裁判断)」です。この場合、南沙諸島の基線点は計算に入りません。',
    '支配国を選ぶと、その地形に完全な効果を与えた場合のEEZを描きます。これは仲裁判断とは異なる仮定に立った、思考実験としての表示です。',
  ],
  sources: [PCA_2016, UNCLOS],
}

/** フッターに入りきらない免責・出典・ライセンスの置き場(スマホで開く) */
const ABOUT: Column = {
  id: 'about',
  title: 'このアプリについて',
  lead:
    '日本の排他的経済水域(EEZ)を地図上で可視化し、島を動かしたりON/OFFすると、その場でEEZを計算し直す教育用アプリです。',
  sections: [
    {
      heading: '免責',
      paragraphs: [
        '本アプリは教育目的の簡略モデルであり、法的な境界を示すものではありません。表示される面積は、桁と比率を感じ取るためのものです。',
        'すべての海域を等距離中間線で機械的に配分しており、現実の漁業協定線や未画定海域は再現していません。中間線モデルは中立ではないという点について、「EEZはどう計算しているか」に詳しく書いています。',
      ],
    },
    {
      heading: '情報の時点',
      paragraphs: [
        `本シミュレーターは${SOURCES_AS_OF}時点で公開されていた情報をもとに作成されています。各国の主張、国際機関の判断、条約の解釈、参照先の文書はいずれも変わりうるものです。`,
      ],
    },
    {
      heading: 'データ出典とライセンス',
      paragraphs: [
        'EEZの実データは Marine Regions (VLIZ) World EEZ v12、海岸線と基線点は Natural Earth 1:10m を使っています。',
        'Marine Regions のデータが CC BY-NC-SA 4.0 のため、本アプリも同じ条件(表示・非営利・継承)で提供しています。商用利用はできません。',
      ],
    },
  ],
  sources: [
    {
      publisher: 'VLIZ',
      title: 'Marine Regions — World EEZ v12 (CC BY-NC-SA 4.0)',
      url: 'https://www.marineregions.org/',
    },
    {
      publisher: 'Natural Earth',
      title: 'Natural Earth 1:10m (public domain)',
      url: 'https://www.naturalearthdata.com/',
    },
    {
      publisher: 'Creative Commons',
      title: 'CC BY-NC-SA 4.0 ライセンス条文',
      url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.ja',
    },
  ],
}

export const COLUMNS: Record<string, Column> = {
  about: ABOUT,
  'what-is-eez': WHAT_IS_EEZ,
  method: METHOD,
  'northern-territories': NORTHERN_TERRITORIES,
  takeshima: TAKESHIMA,
  senkaku: SENKAKU,
  okinotorishima: OKINOTORISHIMA,
  spratly: SPRATLY,
}
