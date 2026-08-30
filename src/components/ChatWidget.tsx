import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

/* ========================================================================== */
/*  悬浮聊天（需求7）：可移动图标 + 聊天室 + 文件发送 + 个人共享空间             */
/*  需求5：换一种色调（青绿）、「对话」→「聊天室」、左侧用户标签页私聊+发文件      */
/*  说明：本地演示环境以 localStorage 作为消息/文件中转，不同账号共览同一会话。   */
/* ========================================================================== */

interface Msg {
  id: string;
  user: string;        // 发送方账号
  userName: string;    // 发送方显示名
  to?: string;         // 接收方（undefined = 聊天室群聊；否则为对方用户名的私聊）
  text?: string;
  fileName?: string;
  fileSize?: number;
  fileData?: string;   // dataURL
  time: number;
}

interface SharedFile {
  id: string;
  owner: string;
  ownerName: string;
  name: string;
  size: number;
  dataUrl: string;
  time: number;
}

const MSG_KEY = "gw_chat_msgs";
const FILE_KEY = "gw_filespace";
const POS_KEY = "gw_chat_pos";
const MAX_FILE = 1.5 * 1024 * 1024; // 1.5MB（localStorage 限额保护）

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, val: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

const fmtTime = (t: number) => {
  const d = new Date(t);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/* 需求5：换一种色调 —— 聊天窗口整体改用青绿色调 */
const CHAT_ICON_GRAD = "linear-gradient(135deg,#0d9488,#2fd4bd)";
const CHAT_HEAD_GRAD = "linear-gradient(120deg,#0b7d6e,#0d9488 60%,#17bfa9)";
const CHAT_BUBBLE_GRAD = "linear-gradient(120deg,#0d9488,#12b3a0)";
const CHAT_SHADOW = "0 10px 30px rgba(13,148,136,.45)";
const CHAT_LINE = "rgba(13,148,136,.5)";

/* 需求5：账户在线状态（App 每5秒写入心跳，15秒内视为在线） */
const PRESENCE_KEY = "gw_user_presence";
function isUserOnline(name: string): boolean {
  try {
    const map = JSON.parse(localStorage.getItem(PRESENCE_KEY) ?? "{}") as Record<string, number>;
    const t = map[name];
    return typeof t === "number" && Date.now() - t < 15000;
  } catch { return false; }
}

/* 相对定位辅助：以窗口宽高的比例存储坐标，窗口缩放后仍保持相对位置 */
const vw = () => (typeof window !== "undefined" ? window.innerWidth : 1200);
const vh = () => (typeof window !== "undefined" ? window.innerHeight : 800);
const clamp01 = (n: number) => Math.min(Math.max(n, 0.02), 0.98);
const ICON_SIZE = 52;

export function ChatWidget({ user, userName, users, onToast }: {
  user: string; userName: string;
  users?: string[];               // 需求5：所有账户用户（左侧标签页展示）
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  /* 当前会话对象：null = 聊天室（群聊）；否则为对方用户名（私聊） */
  const [activeUser, setActiveUser] = useState<string | null>(null);
  /* 图标位置以「相对窗口的比例」存储，窗口缩放后仍保持相对位置、不会消失 */
  const [iconRatio, setIconRatio] = useState<{ rx: number; ry: number }>(() => {
    const d = load<{ rx?: number; ry?: number; x?: number; y?: number } | null>(POS_KEY, null);
    if (d && typeof d.rx === "number" && typeof d.ry === "number") return { rx: d.rx, ry: d.ry };
    /* 兼容旧版绝对坐标存档 */
    if (d && typeof d.x === "number" && typeof d.y === "number") return { rx: clamp01(d.x / vw()), ry: clamp01(d.y / vh()) };
    return { rx: 0.94, ry: 0.82 };
  });
  const [, setFrame] = useState(0);
  useEffect(() => {
    const onResize = () => setFrame((f) => f + 1); // 缩放窗口时重新计算位置
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const pos = {
    x: Math.min(Math.max(iconRatio.rx * vw(), 8), vw() - ICON_SIZE - 8),
    y: Math.min(Math.max(iconRatio.ry * vh(), 8), vh() - ICON_SIZE - 8),
  };
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"chat" | "files">("chat");
  const [msgs, setMsgs] = useState<Msg[]>(() => load<Msg[]>(MSG_KEY, []));
  const [files, setFiles] = useState<SharedFile[]>(() => load<SharedFile[]>(FILE_KEY, []));
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; dataUrl: string } | null>(null);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shareInputRef = useRef<HTMLInputElement>(null);

  /* ---------- 用户花名册（左侧标签页，需求5：展示所有账户用户，首字图标，离线灰色） ---------- */
  const contacts = useMemo(
    () =>
      (users ?? [])
        .filter((n) => n && n !== userName)
        .map((name) => ({
          id: name,
          name,
          initial: name.slice(0, 1),
          online: isUserOnline(name),
        })),
    [users, userName]
  );

  /* 当前会话可见消息：群聊 = 无 to 的消息；私聊 = 双方互发 */
  const visibleMsgs = useMemo(() => {
    if (activeUser === null) return msgs.filter((m) => !m.to);
    return msgs.filter(
      (m) => (m.to === activeUser && m.user === user) || (m.to === user && m.user === activeUser)
    );
  }, [msgs, activeUser, user]);

  const activeName = activeUser === null ? "聊天室" : contacts.find((c) => c.id === activeUser)?.name ?? "私聊";

  /* ---------- 刷新消息/文件（跨账号、跨标签页；顺带驱动在线状态刷新） ---------- */
  const reload = useCallback(() => {
    setMsgs(load<Msg[]>(MSG_KEY, []));
    setFiles(load<SharedFile[]>(FILE_KEY, []));
  }, []);
  useEffect(() => {
    reload();
    const onStorage = () => reload();
    window.addEventListener("storage", onStorage);
    const iv = setInterval(reload, 2500);
    return () => { window.removeEventListener("storage", onStorage); clearInterval(iv); };
  }, [reload, user]);

  /* 打开或收到新消息时滚动到底 */
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, msgs.length, tab]);

  /* ---------- 拖拽 ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    const nx = Math.min(Math.max(d.origX + dx, 8), vw() - ICON_SIZE - 8);
    const ny = Math.min(Math.max(d.origY + dy, 8), vh() - ICON_SIZE - 8);
    setIconRatio({ rx: nx / vw(), ry: ny / vh() });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    save(POS_KEY, iconRatio);
    if (d && !d.moved) setOpen((v) => !v); // 视为点击
  };

  /* ---------- 发送（群聊 to=undefined，私聊 to=对方用户名） ---------- */
  const doSend = () => {
    const text = draft.trim();
    if (!text && !pendingFile) return;
    const m: Msg = { id: uid(), user, userName, time: Date.now() };
    if (activeUser !== null) m.to = activeUser;
    if (text) m.text = text;
    if (pendingFile) { m.fileName = pendingFile.name; m.fileSize = pendingFile.size; m.fileData = pendingFile.dataUrl; }
    const next = [...msgs, m];
    if (!save(MSG_KEY, next)) { onToast("error", "发送失败：本地存储已满，请减小文件体积"); return; }
    setMsgs(next);
    setDraft("");
    setPendingFile(null);
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>, toShared: boolean) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_FILE) { onToast("error", `文件过大（限 ${fmtSize(MAX_FILE)} 以内）`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (toShared) {
        const sf: SharedFile = { id: uid(), owner: user, ownerName: userName, name: f.name, size: f.size, dataUrl, time: Date.now() };
        const next = [...files, sf];
        if (!save(FILE_KEY, next)) { onToast("error", "上传失败：本地存储已满"); return; }
        setFiles(next);
        onToast("success", `已上传「${f.name}」到共享空间`);
      } else {
        setPendingFile({ name: f.name, size: f.size, dataUrl });
      }
    };
    reader.readAsDataURL(f);
  };

  /* ---------- 面板独立定位（标题栏拖动）+ 可调节大小 ---------- */
  /* 面板位置同样以比例存储，窗口缩放后保持相对位置、不会跑出屏幕 */
  const [panelRatio, setPanelRatio] = useState<{ rx: number; ry: number }>(() => {
    const d = load<{ rx?: number; ry?: number; x?: number; y?: number } | null>("gw_chat_pp_v1", null);
    if (d && typeof d.rx === "number" && typeof d.ry === "number") return { rx: d.rx, ry: d.ry };
    if (d && typeof d.x === "number" && typeof d.y === "number") return { rx: clamp01(d.x / vw()), ry: clamp01(d.y / vh()) };
    return { rx: 0.66, ry: 0.18 };
  });
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>(() => load("gw_chat_ps_v1", { w: 420, h: 500 }));
  const panelPos = {
    x: Math.min(Math.max(panelRatio.rx * vw(), 8), Math.max(8, vw() - panelSize.w - 8)),
    y: Math.min(Math.max(panelRatio.ry * vh(), 8), Math.max(8, vh() - panelSize.h - 8)),
  };
  const winDrag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);

  const onTitleDown = (e: React.PointerEvent) => {
    winDrag.current = { mode: "move", startX: e.clientX, startY: e.clientY, origX: panelPos.x, origY: panelPos.y, origW: 0, origH: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    winDrag.current = { mode: "resize", startX: e.clientX, startY: e.clientY, origX: 0, origY: 0, origW: panelSize.w, origH: panelSize.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onWinMove = (e: React.PointerEvent) => {
    const d = winDrag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (d.mode === "move") {
      const nx = Math.min(Math.max(d.origX + dx, 60 - panelSize.w), vw() - 60);
      const ny = Math.min(Math.max(d.origY + dy, 0), vh() - 44);
      setPanelRatio({ rx: nx / vw(), ry: ny / vh() });
    } else {
      setPanelSize({
        w: Math.min(Math.max(d.origW + dx, 340), Math.max(340, vw() - panelPos.x - 8)),
        h: Math.min(Math.max(d.origH + dy, 340), Math.max(340, vh() - panelPos.y - 8)),
      });
    }
  };
  const onWinUp = () => {
    if (!winDrag.current) return;
    winDrag.current = null;
    save("gw_chat_pp_v1", panelRatio);
    save("gw_chat_ps_v1", panelSize);
  };

  const myMsgs = (m: Msg) => m.user === user;

  /* ============ 聊天主体（需求5：标签页 + 左侧用户标签页 + 私聊/发文件） ============ */
  const chatBody = (
    <>
      {/* 标签页：聊天室 | 共享空间 */}
      <div className="shrink-0 seg w-full m-2" style={{ marginBottom: 0 }}>
        <button className={`seg-item flex-1 justify-center ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
          <Icon name="chat" size={12} />聊天室
        </button>
        <button className={`seg-item flex-1 justify-center ${tab === "files" ? "active" : ""}`} onClick={() => setTab("files")}>
          <Icon name="folder" size={12} />共享空间
        </button>
      </div>

      {tab === "chat" ? (
        <div className="flex flex-1 min-h-0">
          {/* 左侧用户标签页 */}
          <div className="w-[64px] shrink-0 border-r border-[var(--line)] bg-[var(--bg-1)] overflow-y-auto flex flex-col items-center gap-1.5 py-2">
            {/* 聊天室（群聊）入口 */}
            <button
              onClick={() => setActiveUser(null)}
              title="聊天室（群聊）"
              className={`w-[54px] flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition ${activeUser === null ? "bg-[var(--sel)] ring-1 ring-[var(--acc)]" : "hover:bg-[var(--hov)]"}`}
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: CHAT_ICON_GRAD }}>
                <Icon name="chat" size={15} />
              </span>
              <span className="text-[9.5px] text-[var(--tx-2)] leading-none">聊天室</span>
            </button>
            <span className="w-8 h-px bg-[var(--line)] my-0.5" />
            {/* 用户列表：首字头像，离线灰色，点击私聊 */}
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveUser(c.id)}
                title={`${c.name}（${c.online ? "在线" : "离线"}）· 点击私聊`}
                className={`w-[54px] flex flex-col items-center gap-0.5 rounded-lg py-1.5 transition ${activeUser === c.id ? "bg-[var(--sel)] ring-1 ring-[var(--acc)]" : "hover:bg-[var(--hov)]"}`}
              >
                <span
                  className={`relative w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white ${c.online ? "" : "grayscale opacity-60"}`}
                  style={{ background: c.online ? CHAT_ICON_GRAD : "#9aa3b2" }}
                >
                  {c.initial}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-1)] ${c.online ? "bg-[#30d158]" : "bg-[#9aa3b2]"}`} />
                </span>
                <span className="text-[9.5px] text-[var(--tx-2)] leading-none max-w-[50px] truncate">{c.name}</span>
              </button>
            ))}
          </div>

          {/* 右侧消息区 */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* 会话标题 */}
            <div className="shrink-0 flex items-center gap-1.5 px-3 h-8 border-b border-[var(--line)] bg-[var(--bg-1)] text-[11px] text-[var(--tx-2)]">
              <Icon name={activeUser === null ? "chat" : "user"} size={12} className="text-[var(--acc)]" />
              <span className="font-medium text-[var(--tx-1)]">{activeName}</span>
              {activeUser !== null && (
                <span className={`text-[9.5px] px-1.5 py-px rounded-full border ${contacts.find((c) => c.id === activeUser)?.online ? "border-[rgba(48,209,88,.45)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.08)]" : "border-[var(--line)] text-[var(--tx-3)]"}`}>
                  {contacts.find((c) => c.id === activeUser)?.online ? "在线" : "离线"}
                </span>
              )}
            </div>

            {/* 消息列表 */}
            <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5">
              {visibleMsgs.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--tx-3)]">
                  <Icon name="chat" size={26} className="opacity-40 mb-2" />
                  <p className="text-[11.5px]">{activeUser === null ? "暂无消息，发一条打个招呼吧" : `向 ${activeName} 发送第一条消息吧`}</p>
                </div>
              )}
              {visibleMsgs.map((m) => (
                <div key={m.id} className={`flex flex-col ${myMsgs(m) ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-[var(--tx-3)] mb-0.5 px-0.5">
                    {myMsgs(m) ? "我" : m.userName} · {fmtTime(m.time)}
                  </span>
                  <div
                    className="max-w-[82%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed break-words"
                    style={myMsgs(m)
                      ? { background: CHAT_BUBBLE_GRAD, color: "#fff", borderBottomRightRadius: 3 }
                      : { background: "var(--bg-3)", color: "var(--tx-1)", border: "1px solid var(--line)", borderBottomLeftRadius: 3 }}
                  >
                    {m.text}
                    {m.fileName && (
                      <a
                        href={m.fileData} download={m.fileName}
                        className={`mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] transition ${myMsgs(m) ? "bg-white/15 hover:bg-white/25 text-white" : "bg-[var(--bg-2)] hover:bg-[var(--hov)] text-[var(--acc)] border border-[var(--line)]"}`}
                      >
                        <Icon name="clip" size={13} />
                        <span className="truncate max-w-[150px]">{m.fileName}</span>
                        <span className="opacity-70 shrink-0">{fmtSize(m.fileSize ?? 0)}</span>
                        <Icon name="download" size={12} className="shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 待发文件预览 */}
            {pendingFile && (
              <div className="shrink-0 mx-3 mb-1.5 flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5" style={{ borderColor: CHAT_LINE, background: "var(--sel)" }}>
                <Icon name="clip" size={13} className="text-[var(--acc)]" />
                <span className="text-[11px] text-[var(--tx-1)] truncate flex-1">{pendingFile.name}</span>
                <span className="text-[10px] text-[var(--tx-3)]">{fmtSize(pendingFile.size)}</span>
                <button onClick={() => setPendingFile(null)} className="text-[var(--tx-3)] hover:text-[#d70015] transition"><Icon name="close" size={12} /></button>
              </div>
            )}

            {/* 输入区 */}
            <div className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 border-t border-[var(--line)] bg-[var(--bg-1)]">
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => pickFile(e, false)} />
              <button onClick={() => fileInputRef.current?.click()} title="发送文件"
                className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--tx-2)] hover:text-[var(--acc)] hover:bg-[var(--hov)] transition">
                <Icon name="clip" size={16} />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSend(); }}
                placeholder={activeUser === null ? "输入消息，回车发送" : `发消息给 ${activeName}…`}
                className="flex-1 h-8 px-2.5 rounded-md text-[12px] outline-none"
                style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--tx-1)" }}
              />
              <button onClick={doSend} title="发送"
                className="w-8 h-8 rounded-md flex items-center justify-center text-white transition active:scale-95"
                style={{ background: CHAT_BUBBLE_GRAD }}>
                <Icon name="send" size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 共享空间 */
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 flex flex-col gap-2">
          <input ref={shareInputRef} type="file" className="hidden" onChange={(e) => pickFile(e, true)} />
          <button onClick={() => shareInputRef.current?.click()}
            className="shrink-0 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-white transition active:scale-[.98]"
            style={{ background: CHAT_BUBBLE_GRAD }}>
            <Icon name="download" size={14} className="rotate-180" />上传文件到共享空间
          </button>
          <p className="text-[10px] text-[var(--tx-3)]">所有账号上传的文件在此汇聚，任何账号均可下载。</p>
          {files.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--tx-3)]">
              <Icon name="folder" size={26} className="opacity-40 mb-2" />
              <p className="text-[11.5px]">共享空间还是空的</p>
            </div>
          )}
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-2.5 py-2">
              <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--sel)" }}>
                <Icon name="clip" size={15} className="text-[var(--acc)]" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--tx-1)] truncate">{f.name}</p>
                <p className="text-[10px] text-[var(--tx-3)]">{f.ownerName} · {fmtSize(f.size)} · {fmtTime(f.time)}</p>
              </div>
              <a href={f.dataUrl} download={f.name} title="下载"
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--acc)] hover:bg-[var(--sel)] transition shrink-0">
                <Icon name="download" size={15} />
              </a>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* 悬浮图标（可拖拽）；打开聊天窗时隐藏 */}
      {!open && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title="内部消息 · 点击打开，可拖动"
          className="fixed z-[90] w-[52px] h-[52px] rounded-full flex items-center justify-center text-white transition-transform active:scale-95 touch-none select-none"
          style={{ left: pos.x, top: pos.y, background: CHAT_ICON_GRAD, boxShadow: CHAT_SHADOW, cursor: "grab" }}
        >
          <Icon name="chat" size={24} />
          {msgs.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff375f] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-0)]">
              {msgs.length > 99 ? "99+" : msgs.length}
            </span>
          )}
        </button>
      )}

      {/* 聊天面板 */}
      {open && (
        <div
          className="fixed z-[91] flex flex-col rounded-xl overflow-hidden anim-panel"
          style={{
            left: panelPos.x, top: panelPos.y, width: panelSize.w, height: panelSize.h,
            background: "var(--bg-2)", border: "1px solid var(--line)",
            boxShadow: "0 24px 64px rgba(10,20,45,.35)",
          }}
        >
          {/* 头部（可拖动整个对话框） */}
          <div
            onPointerDown={onTitleDown} onPointerMove={onWinMove} onPointerUp={onWinUp}
            className="shrink-0 flex items-center gap-2 px-3 h-11 cursor-move touch-none select-none"
            style={{ background: CHAT_HEAD_GRAD }}
            title="拖动移动窗口"
          >
            <Icon name="chat" size={16} className="text-white" />
            <span className="text-[13px] font-semibold text-white tracking-wide">内部消息</span>
            <span className="text-[10px] text-white/75">· {userName}</span>
            <button onClick={() => setOpen(false)} onPointerDown={(e) => e.stopPropagation()} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-white/85 hover:bg-white/15 transition">
              <Icon name="close" size={13} />
            </button>
          </div>

          {/* 标签页 + 会话主体 */}
          {chatBody}

          {/* 右下角缩放手柄 */}
          <div
            onPointerDown={onResizeDown} onPointerMove={onWinMove} onPointerUp={onWinUp}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize touch-none flex items-end justify-end p-[2.5px] text-[var(--tx-3)] hover:text-[var(--acc)] transition"
            title="拖动调节窗口大小"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M9 1L1 9M9 5L5 9M9 8.5L8.5 9" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
}
