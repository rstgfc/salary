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

/* ============ 标题栏（需求2：窗口控制按钮移至右上角，顺序 全屏/折叠/最小化/关闭） ============ */
export function TitleBar({ theme, onTheme, onClose, onMin, onZoom }: {
  theme: Theme; onTheme: (t: Theme) => void;
  onClose: () => void; onMin: () => void; onZoom: () => void;
}) {
  const now = useClock();
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      document.documentElement.requestFullscreen().catch(() => undefined);
    }
  };

  const winBtn = "group w-7 h-6 rounded-md flex items-center justify-center text-[var(--tx-2)] hover:text-white transition active:scale-90";

  return (
    <div className="h-10 shrink-0 relative flex items-center px-3.5 border-b border-[var(--line)] bg-[var(--head)] select-none">
      {/* 左侧：品牌标题 */}
      <div className="flex items-center gap-2 min-w-0">
        <Logo size={17} />
        <span className="font-disp font-semibold tracking-wide text-[13px] text-[var(--tx-1)] truncate">公务员工资测算系统</span>
        <span className="font-mono2 text-[10px] px-1.5 py-px rounded border border-[rgba(10,132,255,.4)] text-[var(--acc)] bg-[var(--sel)] shrink-0">V8.2</span>
      </div>

      {/* 中部：主题切换 + 局域网 + 时钟 */}
      <div className="ml-auto mr-3 flex items-center gap-2.5 text-[11px] text-[var(--tx-2)]">
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
          <span className="font-mono2 hidden lg:inline">LAN :8080</span>
        </span>
        <span className="font-mono2 text-[var(--tx-1)] hidden sm:inline">
          {p2(now.getHours())}:{p2(now.getMinutes())}:{p2(now.getSeconds())}
        </span>
      </div>

      {/* 右侧：窗口控制按钮（全屏 / 折叠 / 最小化 / 关闭） */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={toggleFullscreen} title={isFs ? "退出全屏" : "全屏"} className={`${winBtn} hover:bg-[rgba(10,132,255,.85)]`}>
          <Icon name="fullscreen" size={13} />
        </button>
        <button onClick={onZoom} title="折叠 / 展开人员列表" className={`${winBtn} hover:bg-[#28c840]`}>
          <Icon name="collapse" size={13} />
        </button>
        <button onClick={onMin} title="最小化" className={`${winBtn} hover:bg-[#e0a800]`}>
          <Icon name="minimize" size={13} />
        </button>
        <button onClick={onClose} title="退出系统" className={`${winBtn} hover:bg-[#e0453a]`}>
          <Icon name="close" size={13} />
        </button>
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
  | "unit" | "person" | "allowance" | "query" | "recalc" | "rolling"
  | "del" | "catalog" | "calc" | "register" | "help" | "exit";

const MENUS: { key: MenuKey; label: string; icon: IconName; danger?: boolean }[] = [
  { key: "unit", label: "单位管理", icon: "unit" },
  { key: "person", label: "人员增加", icon: "user" },
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

const SEP_AFTER: MenuKey[] = ["person", "allowance", "rolling", "del", "calc", "help"];

/* 需求5：左侧竖列图标栏（鼠标指向提示功能） */
export function MenuRail({ onMenu }: { onMenu: (k: MenuKey) => void }) {
  return (
    <div className="w-[54px] shrink-0 flex flex-col items-center gap-1 py-2.5 border-r border-[var(--line)] bg-[var(--bg-1)] overflow-visible">
      {MENUS.map((m) => (
        <React.Fragment key={m.key}>
          <div className="relative group shrink-0">
            <button
              onClick={() => onMenu(m.key)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
                m.danger
                  ? "text-[#c2554f] hover:bg-[rgba(255,69,58,.14)] hover:text-[#e0453a]"
                  : "text-[var(--tx-2)] hover:bg-[var(--hov)] hover:text-[var(--acc)]"
              }`}
            >
              <Icon name={m.icon} size={17} />
            </button>
            {/* 悬停提示 */}
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 rounded-md text-[11.5px] font-medium whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-[60] bg-[var(--tx-1)] text-[var(--bg-0)] shadow-[0_6px_18px_rgba(10,20,45,.3)]">
              {m.label}
            </span>
          </div>
          {SEP_AFTER.includes(m.key) && <span className="w-6 h-px bg-[var(--line)] my-0.5 shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

/* 需求4：用户信息条（替换原"测算核心 calculator.js 已接入"位置） */
export function UserStrip({ userName, canEdit, onSwitch }: {
  userName: string; canEdit: boolean; onSwitch: () => void;
}) {
  return (
    <div className="h-8 shrink-0 flex items-center gap-2 px-3 border-b border-[var(--line)] bg-[var(--bg-1)] text-[11px] select-none">
      <Icon name="user" size={12} className="text-[var(--tx-3)]" />
      <span className="text-[var(--tx-2)]">当前用户：<b className="text-[var(--tx-1)]">{userName}</b></span>
      <span className={`px-1.5 py-px rounded border text-[10px] ${
        canEdit
          ? "border-[rgba(48,209,88,.45)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.1)]"
          : "border-[rgba(255,159,10,.45)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.1)]"
      }`}>
        {canEdit ? "可编辑" : "仅查看"}
      </span>
      <button onClick={onSwitch}
        className="ml-auto flex items-center gap-1 text-[var(--tx-3)] hover:text-[var(--acc)] transition">
        <Icon name="power" size={11} />切换账户
      </button>
    </div>
  );
}

/* ============ 状态栏 ============ */
export function StatusBar({ personCount, unitCount, registered, lastRecalc, onRegister, storage }: {
  personCount: number; unitCount: number; registered: { code: string; at: string } | null;
  lastRecalc: string; onRegister: () => void; storage?: "sqlite" | "memory";
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
      {storage && (
        <span
          title={storage === "sqlite" ? "数据存储于本地 SQLite 数据库（IndexedDB 持久化），支持千人级" : "WASM/IndexedDB 不可用，当前为内存态"}
          className={`flex items-center gap-1 px-1.5 py-px rounded border ${
            storage === "sqlite"
              ? "border-[rgba(10,132,255,.45)] text-[var(--acc)] bg-[var(--sel)]"
              : "border-[rgba(255,159,10,.5)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.1)]"
          }`}
        >
          <Icon name="catalog" size={11} />
          {storage === "sqlite" ? "SQLite 本地库" : "内存态"}
        </span>
      )}
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
