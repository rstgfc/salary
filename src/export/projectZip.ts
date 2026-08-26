/* ========================================================================== */
/*  工程源码打包导出                                                            */
/*  构建时由 Vite 以 ?raw 形式内嵌全部源文件，运行时用 JSZip 在浏览器端生成 ZIP    */
/*  —— 应用自身的访问地址即"源码下载入口"，无需外部临时链接                      */
/* ========================================================================== */

const RAW_FILES = import.meta.glob(
  [
    "/src/**/*.{ts,tsx,css}",
    "/electron/**/*.{cjs,js,json}",
    "/index.html",
    "/package.json",
    "/vite.config.ts",
    "/electron-builder.yml",
    "/README.md",
    "/tsconfig.json",
    "/tsconfig.app.json",
    "/tsconfig.node.json",
  ],
  { query: "?raw", import: "default", eager: true }
) as Record<string, string>;

const ROOT_NAME = "公务员工资测算系统-源码";

const DEPLOY_NOTE = `公务员工资测算系统 · 源码部署说明
====================================

一、环境要求
  Node.js 18 及以上（建议 LTS）

二、本机命令
  1. npm install                        安装依赖（package-lock 未包含，由本步生成）
  2. npm run build                      构建网页产物到 dist/
  3. 快速试运行：npm i -D electron 后执行  npx electron electron/main.cjs
  4. 打包 exe：npm i -D electron electron-builder 后执行  npx electron-builder --win
     产物位于 release/ 目录（安装包 + 便携版）

三、局域网使用
  运行 exe 后，状态栏显示真实服务地址（默认 8080 端口，被占用自动顺延），
  同网段其他电脑浏览器直接访问该地址即可。

四、目录说明
  src/core/calculator.ts   测算核心（与微信小程序 utils/calculator.js 同源）
  src/core/salarydata.ts   2015 标准数据（生成 2014/10 调资行）
  src/components/          界面组件
  src/data.ts              人员台账（JSON 结构，与小程序后台同构）
  electron/main.cjs        Electron 主进程（窗口 + 局域网 HTTP 服务）

五、下载较慢时
  npm config set registry https://registry.npmmirror.com

导出时间：__EXPORT_TIME__
`;

export async function exportProjectZip(): Promise<{ count: number; name: string }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();

  for (const [path, content] of Object.entries(RAW_FILES)) {
    if (typeof content !== "string" || !content) continue;
    zip.file(`${ROOT_NAME}/${path.replace(/^\//, "")}`, content);
  }

  zip.file(
    `${ROOT_NAME}/部署说明.txt`,
    DEPLOY_NOTE.replace("__EXPORT_TIME__", new Date().toLocaleString("zh-CN"))
  );

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  const name = "公务员工资测算系统-源码.zip";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);

  return { count: Object.keys(RAW_FILES).length + 1, name };
}
