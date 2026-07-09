import { useEffect } from 'react'
import { MapView } from './components/MapView'
import { SidePanel } from './components/SidePanel'
import { InfoModal } from './components/InfoModal'
import { SOURCES_AS_OF } from './data/columns'
import { useAppStore } from './store/useAppStore'
import { initBaseline, resetAll, setViewMode } from './sim/controller'

export default function App() {
  const mode = useAppStore((s) => s.mode)
  const simRunning = useAppStore((s) => s.simRunning)
  const baseline = useAppStore((s) => s.baseline)
  const openColumn = useAppStore((s) => s.openColumn)

  useEffect(() => {
    void initBaseline()
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>EEZシミュレーター</h1>
        {/* モードは明示的に切り替える。暗黙に切り替わると、動かした島と
            無関係な海域まで別モデルで塗り替わってしまう */}
        <div className="mode-switch" role="group" aria-label="表示モード">
          <button
            className={mode === 'real' ? 'active' : ''}
            disabled={simRunning}
            onClick={() => void setViewMode('real')}
          >
            <span className="label-wide">実データ</span>
            <span className="label-narrow">実データ</span>
          </button>
          <button
            className={mode === 'sim' ? 'active' : ''}
            disabled={simRunning || !baseline}
            onClick={() => void setViewMode('sim')}
          >
            <span className="label-wide">
              {simRunning ? '計算中…' : 'シミュレーション'}
            </span>
            <span className="label-narrow">{simRunning ? '計算中…' : 'シミュ'}</span>
          </button>
        </div>
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
