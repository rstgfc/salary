import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* 剥离产物 HTML 中的 crossorigin 属性：
   file:// 协议下 origin 为 opaque，CORS 校验必失败，导致样式表 / 模块脚本被拒载白屏。
   本应用由 Electron 内嵌 HTTP 服务同源加载，无需 crossorigin。 */
const stripCrossOrigin = () => ({
  name: "strip-crossorigin",
  enforce: "post",
  transformIndexHtml(html) {
    return html.replace(/ crossorigin/g, "");
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), stripCrossOrigin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
});
