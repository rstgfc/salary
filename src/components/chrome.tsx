import React, { useEffect, useState } from "react";
import { Icon, IconName, Logo } from "./icons";

/* ============ 时钟 ============ */
export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
const p2 = (n: number) => String(n).padStart(2, "0");

export type Theme = "light" | "dark";

/* ============ 标题栏 ============ */
export function TitleBar({ theme, onTheme, onExport, exporting, onClose, onMin, onZoom }: {
  theme: Theme; onTheme: (t: Theme) => void;
  onExport: () => void; exporting: boolean;
  onClose: () => void; onMin: () => void; onZoom: () => void;
}) {
  const now = useClock();
  return (
    <div className="h-10 shrink-0 relative flex items-center px-3.5 border-b border-[var(--line)] bg-[var(--head)] select-none">
      {/* mac 红绿灯 */}
      <div className="flex items-center gap-2">
        <button onClick={onClose} title="退出系统"
          className="group w-[13px] h-[13px] rounded-full bg-[#ff5f57] border border-[rgba(0,0,0,.22)] flex items-center justify-center hover:brightness-110 active:scale-90 transition">
          <span className="opacity-0 group-hover:opacity-100 text-[9px] leading-none text-[rgba(0,0,0,.6)] font-bold">×</span>
        </button>
        <button onClick={onMin} title="最小化（演示）"
          className="group w-[13px] h-[13px] rounded-full bg-[#febc2e] border border-[rgba(0,0,0,.22)] flex items-center justify-center hover:brightness-110 active:scale-90 transition">
          <span className="opacity-0 group-hover:opacity-100 text-[9px] leading-none text-[rgba(0,0,0,.6)] font-bold">−</span>
        </button>
        <button onClick={onZoom} title="折叠 / 展开人员列表"
          className="group w-[13px] h-[13px] rounded-full bg-[#28c840] border border-[rgba(0,0,0,.22)] flex items-center justify-center hover:brightness-110 active:scale-90 transition">
          <span className="opacity-0 group-hover:opacity-100 text-[8px] leading-none text-[rgba(0,0,0,.6)] font-bold">⤢</span>
        </button>
      </div>

      {/* 中央标题 */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Logo size={17} />
        <span className="font-disp font-semibold tracking-wide text-[13px] text-[var(--tx-1)]">公务员工资测算系统</span>
        <span className="font-mono2 text-[10px] px-1.5 py-px rounded border border-[rgba(10,132,255,.4)] text-[var(--acc)] bg-[var(--sel)]">V8.2</span>
      </div>

      {/* 右侧：源码下载 + 主题切换 + 局域网 + 时钟 */}
      <div className="ml-auto flex items-center gap-2.5 text-[11px] text-[var(--tx-2)]">
        <button
          onClick={onExport}
          disabled={exporting}
          title="下载全部工程源码（ZIP，浏览器端即时生成）"
          className="flex items-center gap-1.5 h-6 px-2 rounded-md border border-[rgba(10,132,255,.45)] bg-[var(--sel)] text-[var(--acc)] hover:bg-[var(--sel-strong)] transition-all active:scale-95 disabled:opacity-50"
        >
          <Icon name="download" size={12} className={exporting ? "animate-bounce" : ""} />
          <span className="hidden md:inline">{exporting ? "打包中…" : "下载源码"}</span>
        </button>
        <button
          onClick={() => onTheme(theme === "light" ? "dark" : "light")}
          title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
          className="flex items-center gap-1.5 h-6 px-2 rounded-md border border-[var(--line)] bg-[var(--bg-2)] text-[var(--tx-2)] hover:text-[var(--acc)] hover:border-[rgba(10,132,255,.5)] transition-all active:scale-95"
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={12} />
          <span className="hidden md:inline">{theme === "light" ? "夜间" : "日间"}</span>
        </button>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] live-dot" />
          <Icon name="lan" size={13} />
          <span className="font-mono2 hidden sm:inline">LAN :8080</span>
        </span>
        <span className="font-mono2 text-[var(--tx-1)]">
          {p2(now.getHours())}:{p2(now.getMinutes())}:{p2(now.getSeconds())}
        </span>
      </div>

      {/* 顶部扫描光 */}
      <div className="absolute left-0 right-0 top-0 h-px overflow-hidden pointer-events-none">
        <div className="title-scan h-px w-1/3" />
      </div>
    </div>
  );
}

/* ============ 菜单栏 ============ */
export type MenuKey =
  | "unit" | "allowance" | "query" | "recalc" | "rolling"
  | "del" | "catalog" | "calc" | "register" | "help" | "exit";

const MENUS: { key: MenuKey; label: string; icon: IconName; danger?: boolean }[] = [
  { key: "unit", label: "单位增加", icon: "unit" },
  { key: "allowance", label: "津贴编辑输出", icon: "allowance" },
  { key: "query", label: "综合查询", icon: "query" },
  { key: "recalc", label: "全部重算", icon: "recalc" },
  { key: "rolling", label: "滚动判断", icon: "rolling" },
  { key: "del", label: "删除选择", icon: "trash" },
  { key: "catalog", label: "目录数据", icon: "catalog" },
  { key: "calc", label: "计算器", icon: "calc" },
  { key: "register", label: "注册", icon: "key" },
  { key: "help", label: "帮助", icon: "help" },
  { key: "exit", label: "退出", icon: "power", danger: true },
];

const SEP_AFTER: MenuKey[] = ["allowance", "rolling", "del", "calc", "help"];

export function MenuBar({ onMenu }: { onMenu: (k: MenuKey) => void }) {
  return (
    <div className="h-10 shrink-0 flex items-center gap-1 px-2.5 border-b border-[var(--line)] bg-[var(--bg-1)] overflow-x-auto">
      {MENUS.map((m) => (
        <React.Fragment key={m.key}>
          <button
            onClick={() => onMenu(m.key)}
            className={`menu-btn flex items-center gap-1.5 px-2.5 h-[27px] rounded-md text-[12.5px] whitespace-nowrap ${
              m.danger
                ? "text-[#c2554f] hover:!bg-[rgba(255,69,58,.12)] hover:!text-[#e0453a] dark:text-[#d99a96]"
                : "text-[var(--tx-2)] hover:text-[var(--tx-1)]"
            }`}
          >
            <Icon name={m.icon} size={14} />
            {m.label}
          </button>
          {SEP_AFTER.includes(m.key) && <span className="w-px h-4 bg-[var(--line)] mx-0.5 shrink-0" />}
        </React.Fragment>
      ))}
      <span className="ml-auto hidden lg:flex items-center gap-1.5 text-[10.5px] text-[var(--tx-3)] pr-1 shrink-0">
        <Icon name="bolt" size={12} className="text-[#e0a800]" />
        测算核心 calculator.js 已接入 · 与小程序后台同源
      </span>
    </div>
  );
}

/* ============ 状态栏 ============ */
export function StatusBar({ personCount, unitCount, registered, lastRecalc, onRegister }: {
  personCount: number; unitCount: number; registered: { code: string; at: string } | null;
  lastRecalc: string; onRegister: () => void;
}) {
  const now = useClock();
  /* 运行在 Electron（exe）内时，主进程会提供真实局域网地址；浏览器预览时静默降级 */
  const [lanUrl, setLanUrl] = useState("http://192.168.1.106:8080");
  const [lanLive, setLanLive] = useState(false);
  useEffect(() => {
    let stop = false;
    fetch("/__lan.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!stop && d && d.url) { setLanUrl(d.url); setLanLive(true); }
      })
      .catch(() => { /* 浏览器预览环境：保持占位地址 */ });
    return () => { stop = true; };
  }, []);
  return (
    <div className="h-[26px] shrink-0 flex items-center gap-3 px-3 border-t border-[var(--line)] bg-[var(--bg-1)] text-[11px] text-[var(--tx-2)] select-none">
      <span className="font-mono2 text-[var(--tx-3)]">BUILD 2026.01</span>
      <button onClick={onRegister}
        className={`flex items-center gap-1 px-1.5 py-px rounded border transition hover:brightness-110 ${
          registered
            ? "border-[rgba(48,209,88,.45)] text-[#1f8f4d] bg-[rgba(48,209,88,.1)] dark:text-[#7ede99]"
            : "border-[rgba(255,159,10,.5)] text-[#a26603] bg-[rgba(255,159,10,.1)] dark:text-[#ffbe69]"
        }`}>
        <Icon name={registered ? "shield" : "key"} size={11} />
        {registered ? `已注册 ${registered.code}` : "试用版 · 点击注册"}
      </button>
      <span className="w-px h-3.5 bg-[var(--line)]" />
      <span className="flex items-center gap-1.5" title={lanLive ? "主进程 HTTP 服务运行中，局域网内可用浏览器访问" : "浏览器预览模式（exe 运行时将显示真实地址）"}>
        <span className={`w-1.5 h-1.5 rounded-full ${lanLive ? "bg-[#30d158] live-dot" : "bg-[var(--tx-3)]"}`} />
        局域网服务
        <span className={`font-mono2 ${lanLive ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[var(--acc)]"}`}>{lanUrl}</span>
      </span>
      <span className="w-px h-3.5 bg-[var(--line)]" />
      <span>人员 <b className="font-mono2 text-[var(--tx-1)]">{personCount}</b></span>
      <span>单位 <b className="font-mono2 text-[var(--tx-1)]">{unitCount}</b></span>
      {lastRecalc && (
        <>
          <span className="w-px h-3.5 bg-[var(--line)]" />
          <span>最近核验 <b className="font-mono2 text-[#1f8f4d] dark:text-[#7ede99]">{lastRecalc}</b></span>
        </>
      )}
      <span className="ml-auto font-mono2 text-[var(--tx-1)]">
        {now.getFullYear()}-{p2(now.getMonth() + 1)}-{p2(now.getDate())} {p2(now.getHours())}:{p2(now.getMinutes())}:{p2(now.getSeconds())}
      </span>
    </div>
  );
}

/* ============ Toast ============ */
export interface Toast { id: number; type: "success" | "error" | "info"; msg: string; }

const TOAST_META = {
  success: { icon: "check" as IconName, cls: "border-[rgba(48,209,88,.5)] text-[#1f8f4d] dark:text-[#7ede99]" },
  error: { icon: "warn" as IconName, cls: "border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84]" },
  info: { icon: "info" as IconName, cls: "border-[rgba(10,132,255,.5)] text-[#0a6cd6] dark:text-[#8ed6fa]" },
};

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed right-3 top-12 z-[95] w-[310px] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const m = TOAST_META[t.type];
        return (
          <div key={t.id}
            className={`anim-toast pointer-events-auto flex items-start gap-2.5 px-3 py-2.5 rounded-lg border bg-[var(--bg-2)]/95 backdrop-blur shadow-[0_12px_32px_rgba(15,30,60,.22)] ${m.cls}`}>
            <Icon name={m.icon} size={15} className="mt-px shrink-0" />
            <span className="text-[12.5px] text-[var(--tx-1)] leading-snug flex-1">{t.msg}</span>
            <button onClick={() => onDismiss(t.id)} className="text-[var(--tx-3)] hover:text-[var(--tx-1)] transition shrink-0">
              <Icon name="close" size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
