import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * public/data/ のデータファイル(fetch-data.mjsで再生成するGeoJSON等)を
 * 監視し、変更されたら開いているタブを全リロードする。
 * publicディレクトリの変更はViteの既定ではHMR/リロードを起こさないため、
 * データ再生成後に古いジオメトリが表示されたままになる混乱を防ぐ。
 */
function reloadOnDataChange(): PluginOption {
  return {
    name: 'reload-on-data-change',
    apply: 'serve',
    configureServer(server) {
      const dataDir = new URL('./public/data/', import.meta.url).pathname
      server.watcher.add(dataDir)
      const trigger = (file: string) => {
        if (file.startsWith(dataDir)) {
          server.ws.send({ type: 'full-reload', path: '*' })
        }
      }
      server.watcher.on('change', trigger)
      server.watcher.on('add', trigger)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages(サブパス配信)対応のため相対パス
  base: './',
  plugins: [react(), reloadOnDataChange()],
})
