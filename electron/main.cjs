/* ==========================================================================
 *  公务员工资测算系统 · Electron 主进程
 *  职责：① 加载 dist/ 渲染主窗口（即 exe 界面）
 *        ② 内嵌本地 HTTP 服务，使局域网内浏览器可访问同一功能
 *        ③ 通过 /__lan.json 向界面提供真实局域网地址
 *        ④ 开机自启（默认开启，帮助弹窗内可开关）
 * ========================================================================== */
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DIST_DIR = path.join(__dirname, "..", "dist");
const BASE_PORT = 8080;
const PORT_TRY_MAX = 10;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

/* ---------- 获取本机局域网 IPv4 ---------- */
function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

/* ---------- 局域网 HTTP 服务（SPA 回退 + 真实地址接口） ---------- */
/* onReady(port)：服务监听成功后回调，主窗口据此 loadURL */
function startLanServer(win, onReady) {
  const ip = getLanIP();
  let port = BASE_PORT;
  let server = null;

  const handler = (req, res) => {
    const url = (req.url || "/").split("?")[0];

    if (url === "/__lan.json") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ url: `http://${ip}:${port}`, ip, port }));
      return;
    }

    let file = path.normalize(path.join(DIST_DIR, url === "/" ? "index.html" : url));
    if (!file.startsWith(DIST_DIR)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST_DIR, "index.html"); // SPA 回退
    }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  };

  const tryListen = (p) => {
    server = http.createServer(handler);
    server.once("error", (err) => {
      if (err.code === "EADDRINUSE" && p < BASE_PORT + PORT_TRY_MAX) {
        tryListen(p + 1);
      } else {
        console.error("[LAN] 服务启动失败:", err.message);
      }
    });
    server.listen(p, "0.0.0.0", () => {
      port = p;
      console.log(`[LAN] 局域网访问地址: http://${ip}:${port}`);
      if (win) win.webContents.send("lan-ready", { url: `http://${ip}:${port}` });
      if (onReady) onReady(port);
    });
  };

  tryListen(BASE_PORT);
  return () => server && server.close();
}

/* ---------- 开机自启（需求）：默认开启，帮助弹窗内可开关 ---------- */
/* 写入注册表 HKCU\...\Run，无需管理员权限。便携版 exe 以 PORTABLE_EXECUTABLE_FILE
 * （用户双击的真实路径）注册；每次启动按偏好重写一次，exe 移动位置后再次运行即自动修正。 */
const exePathForStartup = () =>
  process.env.PORTABLE_EXECUTABLE_FILE || app.getPath("exe");

const autoStartPrefFile = () => path.join(app.getPath("userData"), "autostart.json");

function readAutoStartPref() {
  try {
    const v = JSON.parse(fs.readFileSync(autoStartPrefFile(), "utf8"));
    return typeof v.enabled === "boolean" ? v.enabled : true; // 无偏好文件 → 默认开启
  } catch { return true; }
}

function applyAutoStart() {
  if (!app.isPackaged) return; // 开发模式不注册
  try {
    app.setLoginItemSettings({ openAtLogin: readAutoStartPref(), path: exePathForStartup() });
  } catch (err) {
    console.error("[AUTOSTART] 设置开机自启失败:", err.message);
  }
}

/* 渲染进程（帮助弹窗）读取 / 切换自启状态 */
ipcMain.handle("autostart:get", () => ({
  supported: app.isPackaged,
  pref: readAutoStartPref(),
  registered: app.getLoginItemSettings({ path: exePathForStartup() }).openAtLogin,
}));
ipcMain.handle("autostart:set", (_e, enabled) => {
  try { fs.writeFileSync(autoStartPrefFile(), JSON.stringify({ enabled: !!enabled })); }
  catch (err) { console.error("[AUTOSTART] 保存偏好失败:", err.message); }
  applyAutoStart();
  return { pref: readAutoStartPref() };
});

/* ---------- 主窗口 ---------- */
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 700,
    title: "公务员工资测算系统 V8.2",
    backgroundColor: "#e9edf3",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") },
  });

  const indexFile = path.join(DIST_DIR, "index.html");
  if (!fs.existsSync(indexFile)) {
    dialog.showErrorBox(
      "未找到构建产物",
      "请先执行 npm run build 生成 dist 目录，再启动程序。"
    );
    app.quit();
    return;
  }

  /*
   * 加载策略：产物已打包为单一自包含 index.html（JS/CSS/WASM 全部内联），
   * 优先从内嵌 HTTP 服务加载（http://127.0.0.1:端口/）——与局域网浏览器同一代码路径，
   * 且 http origin 下 IndexedDB 可用（SQLite 持久化）；loadURL 失败时回退 loadFile。
   */
  win.webContents.on("did-fail-load", (e, code, desc, url) => {
    console.error(`[LOAD] 加载失败: code=${code} desc=${desc} url=${url}`);
    win.webContents.openDevTools({ mode: "detach" });
  });

  startLanServer(win, (port) => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`[MAIN] 窗口加载地址: ${url}`);
    win.loadURL(url).catch((err) => {
      console.error("[MAIN] loadURL 失败，回退 loadFile:", err.message);
      win.loadFile(indexFile);
    });
  });

  /* Ctrl+Shift+I 打开开发者工具（调试用） */
  win.webContents.on("before-input-event", (e, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  applyAutoStart(); // 开机自启（需求）：默认开启，可在帮助弹窗关闭
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
