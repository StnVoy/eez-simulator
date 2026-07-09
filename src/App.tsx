import { useEffect } from 'react'
import { MapView } from './components/MapView'
import { SidePanel } from './components/SidePanel'
import { InfoModal } from './components/InfoModal'
import { SOURCES_AS_OF } from './data/columns'
import { useAppStore } from './store/useAppStore'
import { initBaseline, resetAll } from './sim/controller'

export default function App() {
  const mode = useAppStore((s) => s.mode)
  const openColumn = useAppStore((s) => s.openColumn)

  useEffect(() => {
    void initBaseline()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>EEZシミュレーター</h1>
        <span className={`mode-badge ${mode === 'sim' ? 'mode-badge-sim' : ''}`}>
          <span className="label-wide">
            {mode === 'real'
              ? '実データ表示モード'
              : 'シミュレーションモード(等距離中間線)'}
          </span>
          <span className="label-narrow">
            {mode === 'real' ? '実データ' : 'シミュレーション'}
          </span>
        </span>
        <button
          className="header-column-button"
          onClick={() => openColumn('method')}
        >
          {/* 狭い画面ではヘッダーが折り返さないよう短いラベルに切り替える */}
          <span className="label-wide">EEZはどう計算しているか</span>
          <span className="label-narrow">計算方法</span>
        </button>
        <button className="reset-button" onClick={resetAll}>
          リセット
        </button>
      </header>
      <main className="app-main">
        <MapView />
        <SidePanel />
      </main>
      <InfoModal />
      <footer className="app-footer">
        {/* 広い画面では全文。狭い画面では1行にして、中身はモーダルで読む
            (出典表示はライセンス上必須なので、消さずに畳む) */}
        <span className="label-wide">
          本アプリは教育目的の簡略モデルであり、法的な境界を示すものではありません。
          {SOURCES_AS_OF}時点の情報をもとに作成しています(各国の主張や国際的な判断は変わりえます)。
        </span>
        <span className="label-wide">
          出典: Marine Regions (VLIZ) World EEZ v12 (CC BY-NC-SA) / Natural Earth
        </span>
        <button
          className="footer-compact label-narrow"
          onClick={() => openColumn('about')}
        >
          ⓘ 教育目的の簡略モデルです・出典とライセンス
        </button>
      </footer>
    </div>
  )
}
