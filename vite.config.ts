import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'

// 前端 dev/build 配置。Tauri 期望固定端口、本地相对路径。
export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  // Tauri 内使用相对路径，便于打包后从 file:// 加载
  base: './',
  server: {
    port: 1420,
    strictPort: true,
    hmr: { protocol: 'ws', host: 'localhost', port: 1421 },
    watch: { ignored: ['**/src-tauri/**'] }
  },
  build: {
    target: 'es2020',
    outDir: 'dist'
  }
})
