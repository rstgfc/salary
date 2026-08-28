# 公务员工资测算系统 · 导出与测试指南

> 架构：React + Vite + TailwindCSS（界面）· `src/core/calculator.ts`（由微信小程序 `utils/calculator.js` 移植的测算核心）· SQLite（sql.js · WASM 本地库）· Electron（桌面 exe + 局域网 HTTP 服务）

---

## 〇、从 GitHub 下载源码并测试（完整流程）

### 1. 环境准备（仅一次）
- 安装 [Node.js 18+](https://nodejs.org)（`node -v` 验证）与 [Git](https://git-scm.com)（`git --version` 验证）
- 配置国内镜像，避免依赖与 Electron 二进制下载失败：
  ```bash
  npm config set registry https://registry.npmmirror.com
  ```

### 2. 下载源码（二选一）
```bash
# 方式 A：Git 克隆（推荐，便于后续 git pull 同步更新）
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名

# 方式 B：网页下载 ZIP —— 仓库页面 → 绿色 Code 按钮 → Download ZIP → 解压
```

### 3. 安装依赖（Electron 镜像写入项目 .npmrc，一次配好）
```bash
cat > .npmrc << 'EOF'
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
EOF
npm install
```
> 若 Electron 安装报 `Cannot find module '@electron/get'`：执行
> `rm -rf node_modules/electron && npm install electron --save-dev` 重装。

### 4. 构建 + 浏览器测试（最快验证路径）
```bash
npm run build          # 生成 dist/
npm run dev            # 开发服务器（改代码自动热更新）
```
浏览器打开 `http://localhost:3000` → 登录页 → `admin / admin123`。

**验收清单**：登录后左下角出现「正在装载本地数据库」→ 状态栏显示「SQLite 本地库」；
左侧 8 人列表；切换人员右侧联动；「开始测算」生成演变明细；右下角聊天图标可拖拽对话。

### 5. 桌面端测试（需要图形界面）
```bash
npx electron electron/main.cjs
```
窗口打开即桌面版；状态栏显示真实局域网地址（如 `http://192.168.x.x:8080`），
同网段其他电脑浏览器输入该地址访问，功能一致。

### 6. 打包 Windows exe（须在 Windows 上执行）
```bash
npm i -D electron electron-builder
npm run build && npx electron-builder --win
```
产物在 `release/`：安装包 + 「便携版.exe」（免安装，拷贝即用）。

### 7. 以后更新
```bash
git pull origin main   # 拉取 GitHub 上的新代码
npm install            # 若依赖有变化
npm run build          # 重新构建
```

---

## 零、登录账户（打开软件先登录）

| 用户名 | 密码 | 权限 |
|---|---|---|
| `admin` | `admin123` | 可编辑（全部功能） |
| `viewer` | `viewer123` | 仅查看（不能改数据 / 测算 / 增删） |

登录页提供快捷填充按钮。仅查看权限下：增加单位、人员、删除选择、津贴编辑、在职/退休/止薪切换、开始测算与重算应用均被禁用，查询与浏览功能正常。

## 本次界面改版要点

1. 「单位增加」改为「**增加单位**」，每条现有单位的删除按钮前新增**修改**按钮
2. 打开软件先进**登录页**，账户分「可编辑 / 仅查看」两种权限
3. 级别显示统一由 `18.6` 格式改为 `18-6` 格式
4. 人员基本信息与套改明细之间新增**职务变化情况 + 开始测算 + 截止时间**框
5. 基本信息精简为两行（姓名/性别/出生年月 · 身份/职务），测算参数置于其下
6. 「2006年前参公（套改）/ 2006年后参公」切换置于**基本信息框内最上方**
7. 顶部新增「**人员**」按钮：填写参加工作时间（年份下拉）→ 自动判定 2006 前/后 → 填写新增人员资料
8. 「大专以上未计工龄的套改年限」并入**套改明细 - 参工时间**的备注
9. 用测算页的**工资演变明细**框替换原「工资演变情况」
10. 用测算页的**套改明细对比**结论替换原静态套改明细（格式不变）
11. 点击「开始测算」后**自动保存**基本信息与结果，下次进入该人员自动载入，无需再次测算

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

## 四、存储格式与千人级数据设计（已实现 SQLite 模式）

**当前状态**：人员与单位数据已切换为 **SQLite 数据库**存储，不再是纯内存 JSON。

- 引擎：**sql.js**（SQLite 官方 C 引擎编译为 WASM），浏览器与 Electron 同源同构，无需原生编译（避免 better-sqlite3 的 node-gyp 重编译问题），打包 exe 零额外配置。
- 表结构：`units` / `persons`（`persons` 含可检索列 `id/name/unit_id/tag/employ` + 完整 JSON 文档 `doc`，嵌套的工资演变台账整体读写），并对 `unit_id`、`name` 建索引。
- 持久化：数据库二进制经 250ms 防抖整体写入 **IndexedDB**；应用启动自动装载，空库时以演示台账播种。WASM/IndexedDB 不可用时自动降级为内存态。
- 数据交换：`src/core/db.ts` 提供 `exportJson` / `importJson`，与微信小程序后台按同一 JSON Schema 互导，导出即备份。
- 界面反馈：启动时显示「正在装载本地数据库」画面；状态栏显示「SQLite 本地库 / 内存态」标识。

**分层说明**：人员/单位主数据走 SQLite；测算参数存档、工资面板、聊天记录等按人/按会话的轻量 KV 仍走 `localStorage`；主题/注册/机器码等配置亦在 `localStorage`。

**千人级渲染**：左侧人员列表在该量级下改为「搜索 + 分页」（当前内置检索已可定位），
后续可平滑升级为虚拟滚动，数据层接口（`src/core/db.ts`）无需改动。

---

## 五、常见问题

| 现象 | 处理 |
|---|---|
| `npm install` 很慢 | `npm config set registry https://registry.npmmirror.com` |
| `Cannot find module '@electron/get'` / Electron 下载失败 | 见下方「Electron 下载失败专项处理」 |
| 打包报 "cannot find module" | 确认已在根目录执行过 `npm install` 且 `dist/` 已生成 |
| exe 启动后白屏 | 确认先执行过 `npm run build`（main.cjs 加载的是 dist/） |
| 局域网地址显示为占位 `192.168.1.106` | 说明当前是纯浏览器预览（未走 exe 主进程），属正常降级 |

### Electron 下载失败专项处理（`@electron/get` 报错）

原因：安装 electron 时会从 GitHub 下载二进制，国内网络易中断。按顺序执行：

```bash
# 1. 配置国内镜像（推荐，一次性）
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

# 2. 删除损坏的 electron 并重装
rm -rf node_modules/electron
npm install electron --save-dev

# 3. 验证
npx electron --version
```

若仍失败，可把镜像写入项目 `.npmrc` 永久生效：
```
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```
再执行 `npm cache clean --force` 后重装。Linux 下运行 `npx electron` 需要有图形界面（X11/Wayland）。

---

## 六、目录速览

```
├─ electron/main.cjs        # Electron 主进程：窗口 + 局域网 HTTP 服务(8080)
├─ electron-builder.yml     # exe 打包配置（nsis 安装包 + 便携版）
├─ src/core/calculator.ts   # 测算核心（= 小程序 utils/calculator.js）+ 重算引擎
├─ src/core/salarydata.ts   # 2015 标准数据（生成 2014/10 调资行用，已精简）
├─ src/components/          # 界面：主框架 / 人员列表 / 详情 / 套改测算 / 弹窗
├─ src/data.ts              # 人员台账（8 人演示数据，JSON 结构同小程序后台）
└─ dist/                    # 构建产物（exe 与浏览器共用）
```
