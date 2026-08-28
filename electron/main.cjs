/* ==========================================================================
 *  公务员工资测算系统 · Electron 主进程
 *  职责：① 加载 dist/ 渲染主窗口（即 exe 界面）
 *        ② 内嵌本地 HTTP 服务，使局域网内浏览器可访问同一功能
 *        ③ 通过 /__lan.json 向界面提供真实局域网地址
 * ========================================================================== */
const { app, BrowserWindow, dialog } = require("electron");
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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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
   * 关键修复：不用 loadFile（file:// 协议下 Vite 的绝对路径 /assets/... 会失效导致白屏），
   * 改为从内嵌 HTTP 服务加载（http://127.0.0.1:端口/），与局域网浏览器走同一代码路径。
   */
  startLanServer(win, (port) => {
    win.loadURL(`http://127.0.0.1:${port}/`);
  });

  /* Ctrl+Shift+I 打开开发者工具（调试用） */
  win.webContents.on("before-input-event", (e, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
