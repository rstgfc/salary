import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/*
 * 打包策略说明：
 * · base: "./"            资源用相对路径，file:// 与 http:// 均可解析
 * · viteSingleFile        把全部 JS/CSS 内联进 index.html，产物为单一 HTML，
 *                         Electron 无论用 loadFile（file://）还是 loadURL（http://）
 *                         都不会出现"Failed to load resource / stylesheet"白屏
 * · stripCrossOrigin      移除 crossorigin 属性（file:// 的 opaque origin 下 CORS 必失败）
 */
const stripCrossOrigin = () => ({
  name: "strip-crossorigin",
  enforce: "post",
  transformIndexHtml(html) {
    return html.replace(/ crossorigin/g, "");
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile(), stripCrossOrigin()],
  build: {
    /* SQLite 的 WASM 体积较大，保持外链（由内嵌 HTTP 服务提供），不参与内联 */
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 4000,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
