# 公务员工资测算系统 · 导出与测试指南

> 架构：React + Vite + TailwindCSS（界面）· `src/core/calculator.ts`（由微信小程序 `utils/calculator.js` 移植的测算核心）· Electron（桌面 exe + 局域网 HTTP 服务）

---

## 一、本机需要执行的命令（Windows）

### 0. 准备（仅一次）
- 安装 Node.js 18+：<https://nodejs.org>（安装后命令行可用 `node -v` 验证）

### 1. 获取代码并安装依赖
```bash
cd 公务员工资测算系统        # 进入项目根目录（含 package.json 的目录）
npm install
```

### 2. 构建网页产物
```bash
npm run build               # 生成 dist/ 目录（exe 与浏览器访问共用这一份）
```

### 3. 本地快速测试（不打包，先验证功能）
```bash
npm i -D electron            # 仅一次
npx electron electron/main.cjs
```
窗口即为本软件；同时本机浏览器打开 <http://localhost:8080> 可验证局域网服务。

### 4. 打包成 exe
```bash
npm i -D electron electron-builder   # 仅一次
npx electron-builder --win
```
约 2–5 分钟（首次会从镜像下载 Electron 运行时，约 90MB）。

> 若下载慢，先设置国内镜像：
> ```bash
> npm config set electron_mirror https://npmmirror.com/mirrors/electron/
> npm config set electron_builder_binaries_mirror https://npmmirror.com/mirrors/electron-builder-binaries/
> ```

---

## 二、软件在哪里下载 / 产物位置

打包完成后，exe 在项目根目录的 **`release/`** 文件夹中：

| 文件 | 说明 |
|---|---|
| `公务员工资测算系统-1.0.0-x64.exe` | NSIS 安装包：可自选安装路径、生成桌面快捷方式 |
| `公务员工资测算系统-1.0.0-便携版.exe` | 免安装单文件：**直接拷贝到任意电脑双击即可运行**（推荐用于分发测试） |

- 本文件（README.md）位于**项目根目录**，编辑器左侧文件树顶部可见。
- 当前在线环境产出的是 `dist/`（Web 产物）；exe 需按上面第 4 步在本机 Windows 上打包生成（Electron 打包要求 Windows 环境产出 `.exe`）。

---

## 三、局域网测试步骤

1. 双击运行 exe（或第 3 步的 `npx electron`），软件窗口右下角**状态栏**会显示真实服务地址，如：
   `局域网服务 ● http://192.168.1.106:8080`（地址由主进程探测本机网卡自动填入）
2. 查询本机 IP（与状态栏一致即可）：命令行执行 `ipconfig`，看"IPv4 地址"。
3. 同一局域网的其他电脑，浏览器直接输入该地址访问，功能与桌面窗口完全一致。
4. 若对方无法访问：
   - Windows 防火墙首次会弹窗，请允许"允许访问"；
   - 或入站规则放行 TCP **8080**（端口被占用时程序自动改用 8081 / 8082，以状态栏显示为准）。

---

## 四、常见问题

| 现象 | 处理 |
|---|---|
| `npm install` 很慢 | `npm config set registry https://registry.npmmirror.com` |
| 打包报 "cannot find module" | 确认已在根目录执行过 `npm install` 且 `dist/` 已生成 |
| exe 启动后白屏 | 确认先执行过 `npm run build`（main.cjs 加载的是 dist/） |
| 局域网地址显示为占位 `192.168.1.106` | 说明当前是纯浏览器预览（未走 exe 主进程），属正常降级 |

---

## 五、目录速览

```
├─ electron/main.cjs        # Electron 主进程：窗口 + 局域网 HTTP 服务(8080)
├─ electron-builder.yml     # exe 打包配置（nsis 安装包 + 便携版）
├─ src/core/calculator.ts   # 测算核心（= 小程序 utils/calculator.js）
├─ src/core/salarydata.ts   # 参考数据（= 小程序 salarydata.js）
├─ src/components/          # 界面：主框架 / 人员列表 / 详情 / 套改测算 / 弹窗
├─ src/data.ts              # 人员台账（8 人演示数据）
└─ dist/                    # 构建产物（exe 与浏览器共用）
```
