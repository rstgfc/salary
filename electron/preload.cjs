/* ==========================================================================
 *  预加载脚本：向渲染进程安全暴露主进程能力（contextIsolation 开启）
 *  当前提供：开机自启状态读取 / 开关（帮助弹窗使用）
 *  浏览器局域网访问时不存在 window.gwNative，调用方需判空。
 * ========================================================================== */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gwNative", {
  autostartGet: () => ipcRenderer.invoke("autostart:get"),
  autostartSet: (enabled) => ipcRenderer.invoke("autostart:set", enabled),
});
