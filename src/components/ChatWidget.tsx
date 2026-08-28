import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

/* ========================================================================== */
/*  悬浮聊天（需求7）：可移动图标 + IM 对话 + 文件发送 + 个人共享空间             */
/*  说明：本地演示环境以 localStorage 作为消息/文件中转，不同账号共览同一会话。   */
/* ========================================================================== */

interface Msg {
  id: string;
  user: string;        // 账号名
  userName: string;    // 显示名
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

export function ChatWidget({ user, userName, onToast }: {
  user: string; userName: string;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => load(POS_KEY, { x: window.innerWidth - 76, y: window.innerHeight - 140 }));
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

  /* ---------- 刷新消息/文件（跨账号、跨标签页） ---------- */
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
    const size = 52;
    const nx = Math.min(Math.max(d.origX + dx, 8), window.innerWidth - size - 8);
    const ny = Math.min(Math.max(d.origY + dy, 8), window.innerHeight - size - 8);
    setPos({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    save(POS_KEY, pos);
    if (d && !d.moved) setOpen((v) => !v); // 视为点击
  };

  /* ---------- 发送 ---------- */
  const doSend = () => {
    const text = draft.trim();
    if (!text && !pendingFile) return;
    const m: Msg = { id: uid(), user, userName, time: Date.now() };
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

  /* ---------- 需求1：面板独立定位（标题栏拖动）+ 可调节大小 ---------- */
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>(() =>
    load("gw_chat_pp_v1", { x: Math.max(8, (typeof window !== "undefined" ? window.innerWidth : 1200) - 380), y: 110 }));
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>(() => load("gw_chat_ps_v1", { w: 340, h: 470 }));
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
    const vw = window.innerWidth, vh = window.innerHeight;
    if (d.mode === "move") {
      setPanelPos({
        x: Math.min(Math.max(d.origX + dx, 60 - panelSize.w), vw - 60),
        y: Math.min(Math.max(d.origY + dy, 0), vh - 44),
      });
    } else {
      setPanelSize({
        w: Math.min(Math.max(d.origW + dx, 300), Math.max(300, vw - panelPos.x - 8)),
        h: Math.min(Math.max(d.origH + dy, 320), Math.max(320, vh - panelPos.y - 8)),
      });
    }
  };
  const onWinUp = () => {
    if (!winDrag.current) return;
    winDrag.current = null;
    save("gw_chat_pp_v1", panelPos);
    save("gw_chat_ps_v1", panelSize);
  };

  const myMsgs = (m: Msg) => m.user === user;

  return (
    <>
      {/* 悬浮图标（可拖拽） */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="内部消息 · 点击打开，可拖动"
        className="fixed z-[90] w-[52px] h-[52px] rounded-full flex items-center justify-center text-white shadow-[0_10px_30px_rgba(10,132,255,.45)] transition-transform active:scale-95 touch-none select-none"
        style={{ left: pos.x, top: pos.y, background: "linear-gradient(135deg,#0a84ff,#5ac8fa)", cursor: "grab" }}
      >
        <Icon name="chat" size={24} />
        {msgs.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff375f] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-0)]">
            {msgs.length > 99 ? "99+" : msgs.length}
          </span>
        )}
      </button>

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
          {/* 头部（需求1：可拖动整个对话框） */}
          <div
            onPointerDown={onTitleDown} onPointerMove={onWinMove} onPointerUp={onWinUp}
            className="shrink-0 flex items-center gap-2 px-3 h-11 cursor-move touch-none select-none"
            style={{ background: "linear-gradient(120deg,#0a6cd6,#0a84ff 60%,#19b8f0)" }}
            title="拖动移动窗口"
          >
            <Icon name="chat" size={16} className="text-white" />
            <span className="text-[13px] font-semibold text-white tracking-wide">内部消息</span>
            <span className="text-[10px] text-white/75">· {userName}</span>
            <button onClick={() => setOpen(false)} onPointerDown={(e) => e.stopPropagation()} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-white/85 hover:bg-white/15 transition">
              <Icon name="close" size={13} />
            </button>
          </div>

          {/* 标签页 */}
          <div className="shrink-0 seg w-full m-2" style={{ marginBottom: 0 }}>
            <button className={`seg-item flex-1 justify-center ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
              <Icon name="chat" size={12} />对话
            </button>
            <button className={`seg-item flex-1 justify-center ${tab === "files" ? "active" : ""}`} onClick={() => setTab("files")}>
              <Icon name="folder" size={12} />共享空间
            </button>
          </div>

          {tab === "chat" ? (
            <>
              {/* 消息列表 */}
              <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 flex flex-col gap-2.5">
                {msgs.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--tx-3)]">
                    <Icon name="chat" size={26} className="opacity-40 mb-2" />
                    <p className="text-[11.5px]">暂无消息，发一条打个招呼吧</p>
                  </div>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className={`flex flex-col ${myMsgs(m) ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-[var(--tx-3)] mb-0.5 px-0.5">
                      {myMsgs(m) ? "我" : m.userName} · {fmtTime(m.time)}
                    </span>
                    <div
                      className="max-w-[82%] rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed break-words"
                      style={myMsgs(m)
                        ? { background: "linear-gradient(120deg,#0a84ff,#199bf0)", color: "#fff", borderBottomRightRadius: 3 }
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
                <div className="shrink-0 mx-3 mb-1.5 flex items-center gap-2 rounded-md border border-dashed border-[rgba(10,132,255,.5)] bg-[var(--sel)] px-2.5 py-1.5">
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
                  placeholder="输入消息，回车发送"
                  className="flex-1 h-8 px-2.5 rounded-md text-[12px] outline-none"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--tx-1)" }}
                />
                <button onClick={doSend} title="发送"
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white transition active:scale-95"
                  style={{ background: "linear-gradient(120deg,#0a84ff,#199bf0)" }}>
                  <Icon name="send" size={15} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* 共享空间 */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 flex flex-col gap-2">
                <input ref={shareInputRef} type="file" className="hidden" onChange={(e) => pickFile(e, true)} />
                <button onClick={() => shareInputRef.current?.click()}
                  className="shrink-0 h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-medium text-white transition active:scale-[.98]"
                  style={{ background: "linear-gradient(120deg,#0a84ff,#199bf0)" }}>
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
            </>
          )}

          {/* 需求1：右下角缩放手柄 */}
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
