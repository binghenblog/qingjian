import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'

// 前端 dev/build 配置。Tauri 期望固定端口、本地相对路径。
export default defineConfig(({ mode }) => {
  // base 默认相对路径 './'：对 Tauri(file://) 与 GitHub Pages 子路径部署均友好；
  // 若部署到自定义域名根路径，可用环境变量覆盖：VITE_BASE=/（审查 L-36）
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), UnoCSS()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
    },
    base: env.VITE_BASE || './',
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
  }
})
