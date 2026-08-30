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

/* ---------- 数据目录：便携版/安装版 = exe 同级 data\，开发模式 = 项目根 data\ ---------- */
const DATA_ROOT = process.env.PORTABLE_EXECUTABLE_FILE
  ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE)
  : app.isPackaged ? path.dirname(app.getPath("exe")) : path.join(__dirname, "..");
const DATA_DIR = path.join(DATA_ROOT, "data");
const FILES_DIR = path.join(DATA_DIR, "files");
const DB_FILE = path.join(DATA_DIR, "gw_salary.sqlite");

function atomicWrite(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
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

    /* ---------- 文件服务：浏览器上传/下载/删除（流式落 exe 同级 data\files\） ---------- */
    if (url === "/upload" && req.method === "POST") {
      const qs = new URL(req.url || "/", "http://localhost").searchParams;
      const safe = String(qs.get("name") || "未命名").replace(/[\\/:*?"<>|]/g, "_") || "未命名";
      const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(obj)); };
      let stored = `${Date.now().toString(36)}_${safe}`;
      while (fs.existsSync(path.join(FILES_DIR, stored))) stored = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${safe}`;
      const out = path.join(FILES_DIR, stored);
      const len = Number(req.headers["content-length"] || 0);
      if (len > MAX_UPLOAD) { json(413, { success: false, message: "文件超过 500MB 限制" }); return; }
      const ws = fs.createWriteStream(out);
      let received = 0, ok = true;
      req.on("data", (c) => {
        received += c.length;
        if (received > MAX_UPLOAD) { /* 无 content-length 时流式兜底 */
          ok = false; req.destroy(); ws.destroy();
          try { fs.unlinkSync(out); } catch { /* noop */ }
        }
      });
      ws.on("finish", () => {
        if (!ok) return;
        indexWrite(indexRead().concat({
          id: String(qs.get("id") || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`),
          owner: String(qs.get("owner") || ""),
          ownerName: String(qs.get("ownerName") || ""),
          name: safe, size: received,
          storedName: stored, time: Number(qs.get("time")) || Date.now(),
        }));
        json(200, { success: true, storedName: stored, size: received, name: safe });
      });
      ws.on("error", () => { try { fs.unlinkSync(out); } catch { /* noop */ } if (ok) json(500, { success: false, message: "写入失败" }); });
      req.on("error", () => { try { fs.unlinkSync(out); } catch { /* noop */ } });
      req.pipe(ws);
      return;
    }

    if (url.startsWith("/files/") && req.method === "GET") {
      const stored = path.basename(decodeURIComponent(url.slice("/files/".length)));
      const p = path.join(FILES_DIR, stored);
      if (!stored || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); res.end(); return; }
      const dlName = new URL(req.url || "/", "http://localhost").searchParams.get("name") || stored;
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": fs.statSync(p).size,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(dlName)}`,
      });
      fs.createReadStream(p).pipe(res);
      return;
    }

    if (url === "/file-delete" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const stored = path.basename(String((parsed && parsed.storedName) || ""));
          if (stored) {
            const p = path.join(FILES_DIR, stored);
            if (fs.existsSync(p)) fs.unlinkSync(p);
            indexWrite(indexRead().filter((x) => x.storedName !== stored));
          }
          res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ success: true }));
        } catch { res.writeHead(500); res.end(JSON.stringify({ success: false, message: "删除失败" })); }
      });
      return;
    }

    if (url === "/file-list" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(indexRead()));
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

const autoStartPrefFile = () => path.join(DATA_DIR, "autostart.json");

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

/* ---------- 数据落盘：SQLite 库与聊天/共享文件存于 exe 同级 data\ ---------- */
ipcMain.handle("db:read", () => {
  try { return fs.existsSync(DB_FILE) ? new Uint8Array(fs.readFileSync(DB_FILE)) : null; }
  catch (err) { console.error("[DB] 读取失败:", err.message); return null; }
});
ipcMain.handle("db:write", (_e, buf) => {
  try { atomicWrite(DB_FILE, Buffer.from(buf)); return true; }
  catch (err) { console.error("[DB] 写入失败:", err.message); return false; }
});
ipcMain.handle("file:save", (_e, name, buf) => {
  try {
    const safe = String(name).replace(/[\\/:*?"<>|]/g, "_");
    let stored = `${Date.now().toString(36)}_${safe}`;
    while (fs.existsSync(path.join(FILES_DIR, stored))) stored = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}_${safe}`;
    fs.writeFileSync(path.join(FILES_DIR, stored), Buffer.from(buf));
    return { storedName: stored };
  } catch (err) { console.error("[FILE] 保存失败:", err.message); return null; }
});
ipcMain.handle("file:read", (_e, storedName) => {
  try {
    const p = path.join(FILES_DIR, path.basename(String(storedName)));
    return fs.existsSync(p) ? new Uint8Array(fs.readFileSync(p)) : null;
  } catch (err) { console.error("[FILE] 读取失败:", err.message); return null; }
});
ipcMain.handle("file:delete", (_e, storedName) => {
  try {
    const p = path.join(FILES_DIR, path.basename(String(storedName)));
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch { return false; }
});
ipcMain.handle("data:paths", () => ({ dataDir: DATA_DIR, dbFile: DB_FILE, filesDir: FILES_DIR }));

/* ---------- 全量 KV：localStorage 镜像落盘 data\kv.json（桌面端接管） ---------- */
const KV_FILE = path.join(DATA_DIR, "kv.json");

/* ---------- 共享文件索引：HTTP 上传文件的元数据（跨机器可见的共享空间） ---------- */
const FILE_INDEX = path.join(DATA_DIR, "file-index.json");
const MAX_UPLOAD = 1024 * 1024 * 500; // 500MB（局域网上传上限）

function indexRead() {
  try { const a = JSON.parse(fs.readFileSync(FILE_INDEX, "utf8")); return Array.isArray(a) ? a : []; }
  catch { return []; }
}
function indexWrite(list) {
  try { atomicWrite(FILE_INDEX, Buffer.from(JSON.stringify(list), "utf8")); }
  catch (err) { console.error("[INDEX] 写入失败:", err.message); }
}
ipcMain.handle("kv:read", () => {
  try { return fs.existsSync(KV_FILE) ? JSON.parse(fs.readFileSync(KV_FILE, "utf8")) : null; }
  catch (err) { console.error("[KV] 读取失败:", err.message); return null; }
});
ipcMain.handle("kv:write", (_e, obj) => {
  try { atomicWrite(KV_FILE, Buffer.from(JSON.stringify(obj ?? {}), "utf8")); return true; }
  catch (err) { console.error("[KV] 写入失败:", err.message); return false; }
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
  try { fs.mkdirSync(FILES_DIR, { recursive: true }); } catch (err) { console.error("[DATA] 创建数据目录失败:", err.message); }
  applyAutoStart(); // 开机自启（需求）：默认开启，可在帮助弹窗关闭
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
