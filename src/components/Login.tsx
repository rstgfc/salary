import React, { useState } from "react";
import { Icon, Logo } from "./icons";

export type Role = "edit" | "view";
export interface SessionUser { name: string; role: Role; }

const ACCOUNTS: { user: string; pass: string; role: Role; label: string }[] = [
  { user: "admin", pass: "admin123", role: "edit", label: "可编辑权限" },
  { user: "viewer", pass: "viewer123", role: "view", label: "仅查看权限" },
];

export function Login({ onLogin }: { onLogin: (u: SessionUser) => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const hit = ACCOUNTS.find((a) => a.user === user.trim() && a.pass === pass);
    if (!hit) {
      setErr("用户名或密码不正确");
      setShake(true);
      setTimeout(() => setShake(false), 550);
      return;
    }
    onLogin({ name: hit.user, role: hit.role });
  };

  return (
    <div className="app-bg h-full w-full flex items-center justify-center relative overflow-hidden">
      {/* 背景装饰光斑 */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(10,132,255,.16),transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[460px] h-[460px] rounded-full bg-[radial-gradient(circle,rgba(90,200,250,.12),transparent_65%)]" />

      <div className={`anim-modal relative w-[380px] card-panel !rounded-2xl overflow-hidden ${shake ? "anim-shake" : ""}`}>
        <div className="h-1.5 hero-grad" style={{ animation: "none" }} />
        <div className="px-8 pt-8 pb-7">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[var(--sel)] border border-[rgba(10,132,255,.35)] flex items-center justify-center">
              <Logo size={24} />
            </div>
            <div>
              <h1 className="font-disp text-[17px] font-bold text-[var(--tx-1)] tracking-wide leading-tight">公务员工资测算系统</h1>
              <p className="text-[10.5px] text-[var(--tx-3)] font-mono2 mt-0.5">V8.2 · 局域网协同版</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-3.5">
            <label className="block">
              <span className="block text-[11px] text-[var(--tx-2)] mb-1.5">用户名</span>
              <div className="relative">
                <Icon name="user" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
                <input
                  autoFocus
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="请输入用户名"
                  className="field w-full h-9 pl-9 pr-3 text-[13px]"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-[11px] text-[var(--tx-2)] mb-1.5">密码</span>
              <div className="relative">
                <Icon name="key" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="请输入密码"
                  className="field w-full h-9 pl-9 pr-3 text-[13px]"
                />
              </div>
            </label>

            {err && (
              <p className="text-[11.5px] text-[#d70015] dark:text-[#ff8b84] flex items-center gap-1.5">
                <Icon name="warn" size={13} />{err}
              </p>
            )}

            <button
              type="submit"
              className="mt-1 h-10 rounded-lg hero-grad text-[13.5px] font-semibold tracking-wide text-white shadow-[0_6px_18px_rgba(10,132,255,.35)] hover:brightness-110 active:scale-[.98] transition-all"
              style={{ animation: "none" }}
            >
              登 录
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[var(--line-2)]">
            <p className="text-[10.5px] text-[var(--tx-3)] mb-2">演示账户（点击快速填充）</p>
            <div className="flex gap-2">
              {ACCOUNTS.map((a) => (
                <button
                  key={a.user}
                  type="button"
                  onClick={() => { setUser(a.user); setPass(a.pass); setErr(""); }}
                  className="flex-1 px-2 py-2 rounded-lg border border-[var(--line)] bg-[var(--bg-3)] hover:bg-[var(--sel)] hover:border-[rgba(10,132,255,.45)] transition text-left"
                >
                  <span className="block font-mono2 text-[11.5px] text-[var(--tx-1)]">{a.user} / {a.pass}</span>
                  <span className="block text-[10px] text-[var(--acc)] mt-0.5">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
