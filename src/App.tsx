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
          {mode === 'real'
            ? '実データ表示モード'
            : 'シミュレーションモード(等距離中間線)'}
        </span>
        <button
          className="header-column-button"
          onClick={() => openColumn('method')}
        >
          EEZはどう計算しているか
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
        <span>
          本アプリは教育目的の簡略モデルであり、法的な境界を示すものではありません。
          {SOURCES_AS_OF}時点の情報をもとに作成しています(各国の主張や国際的な判断は変わりえます)。
        </span>
        <span>
          出典: Marine Regions (VLIZ) World EEZ v12 (CC BY-NC-SA) / Natural Earth
        </span>
      </footer>
    </div>
  )
}
