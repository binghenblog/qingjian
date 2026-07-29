// vite.config.ts
import { defineConfig } from "file:///D:/web/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C%E5%8F%B0/node_modules/.pnpm/vite@5.4.0/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/web/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C%E5%8F%B0/node_modules/.pnpm/@vitejs+plugin-vue@5.2.0_vi_f9376f7ac3ae6f2e9723c2741d2bd53a/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import UnoCSS from "file:///D:/web/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C%E5%8F%B0/node_modules/.pnpm/unocss@0.64.0_postcss@8.5.2_fae7873d63caff7c9ca914238ef866f0/node_modules/unocss/dist/vite.mjs";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///D:/web/%E4%B8%AA%E4%BA%BA%E5%B7%A5%E4%BD%9C%E5%8F%B0/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url)) }
  },
  // Tauri 内使用相对路径，便于打包后从 file:// 加载
  base: "./",
  server: {
    port: 1420,
    strictPort: true,
    hmr: { protocol: "ws", host: "localhost", port: 1421 },
    watch: { ignored: ["**/src-tauri/**"] }
  },
  build: {
    target: "es2020",
    outDir: "dist"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFx3ZWJcXFxcXHU0RTJBXHU0RUJBXHU1REU1XHU0RjVDXHU1M0YwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFx3ZWJcXFxcXHU0RTJBXHU0RUJBXHU1REU1XHU0RjVDXHU1M0YwXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi93ZWIvJUU0JUI4JUFBJUU0JUJBJUJBJUU1JUI3JUE1JUU0JUJEJTlDJUU1JThGJUIwL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJ1xuaW1wb3J0IFVub0NTUyBmcm9tICd1bm9jc3Mvdml0ZSdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJ1xuXG4vLyBcdTUyNERcdTdBRUYgZGV2L2J1aWxkIFx1OTE0RFx1N0Y2RVx1MzAwMlRhdXJpIFx1NjcxRlx1NjcxQlx1NTZGQVx1NUI5QVx1N0FFRlx1NTNFM1x1MzAwMVx1NjcyQ1x1NTczMFx1NzZGOFx1NUJGOVx1OERFRlx1NUY4NFx1MzAwMlxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3Z1ZSgpLCBVbm9DU1MoKV0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczogeyAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSB9XG4gIH0sXG4gIC8vIFRhdXJpIFx1NTE4NVx1NEY3Rlx1NzUyOFx1NzZGOFx1NUJGOVx1OERFRlx1NUY4NFx1RkYwQ1x1NEZCRlx1NEU4RVx1NjI1M1x1NTMwNVx1NTQwRVx1NEVDRSBmaWxlOi8vIFx1NTJBMFx1OEY3RFxuICBiYXNlOiAnLi8nLFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAxNDIwLFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgaG1yOiB7IHByb3RvY29sOiAnd3MnLCBob3N0OiAnbG9jYWxob3N0JywgcG9ydDogMTQyMSB9LFxuICAgIHdhdGNoOiB7IGlnbm9yZWQ6IFsnKiovc3JjLXRhdXJpLyoqJ10gfVxuICB9LFxuICBidWlsZDoge1xuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gICAgb3V0RGlyOiAnZGlzdCdcbiAgfVxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1EsU0FBUyxvQkFBb0I7QUFDalMsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWUsV0FBVztBQUhrRyxJQUFNLDJDQUEyQztBQU10TCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQztBQUFBLEVBQ3pCLFNBQVM7QUFBQSxJQUNQLE9BQU8sRUFBRSxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQyxFQUFFO0FBQUEsRUFDakU7QUFBQTtBQUFBLEVBRUEsTUFBTTtBQUFBLEVBQ04sUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osS0FBSyxFQUFFLFVBQVUsTUFBTSxNQUFNLGFBQWEsTUFBTSxLQUFLO0FBQUEsSUFDckQsT0FBTyxFQUFFLFNBQVMsQ0FBQyxpQkFBaUIsRUFBRTtBQUFBLEVBQ3hDO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsRUFDVjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
