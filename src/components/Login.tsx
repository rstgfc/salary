import React, { useState } from "react";
import { Icon, Logo } from "./icons";

export type Role = "admin" | "viewer";

export interface Session {
  role: Role;
  name: string;
}

const ACCOUNTS: Record<string, { password: string; session: Session }> = {
  admin: { password: "admin123", session: { role: "admin", name: "管理员" } },
  viewer: { password: "viewer123", session: { role: "viewer", name: "查阅用户" } },
};

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [user, setUser] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);

  const submit = () => {
    const u = user.trim().toLowerCase();
    const acc = ACCOUNTS[u];
    if (acc && acc.password === pwd) {
      onLogin(acc.session);
      return;
    }
    setErr("用户名或密码不正确");
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const quick = (name: string) => {
    setUser(name);
    setPwd(name === "admin" ? "admin123" : "viewer123");
    setErr("");
  };

  return (
    <div className="app-bg h-full w-full flex items-center justify-center relative overflow-hidden">
      {/* 环境光斑 */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full opacity-60"
        style={{ background: "radial-gradient(circle, rgba(10,132,255,.16), transparent 65%)" }} />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[520px] h-[520px] rounded-full opacity-50"
        style={{ background: "radial-gradient(circle, rgba(90,200,250,.12), transparent 65%)" }} />

      <div className={`relative w-[400px] max-w-[92vw] anim-panel ${shake ? "anim-shake" : ""}`}>
        {/* 品牌区 */}
        <div className="flex items-center gap-3 mb-5 px-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(140deg, rgba(10,132,255,.2), rgba(90,200,250,.08))", border: "1px solid rgba(10,132,255,.35)" }}>
            <Logo size={24} />
          </div>
          <div>
            <h1 className="font-disp text-[19px] font-bold text-[var(--tx-1)] tracking-wide leading-tight">公务员工资测算系统</h1>
            <p className="text-[11px] text-[var(--tx-3)] mt-0.5">Civil Servant Salary Estimator · V8.2</p>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="card-panel overflow-hidden">
          <div className="card-head px-4 h-10 flex items-center gap-2">
            <Icon name="key" size={14} className="text-[var(--acc)]" />
            <span className="text-[12.5px] font-semibold text-[var(--tx-1)]">用户登录</span>
            <span className="ml-auto font-mono2 text-[10px] text-[var(--tx-3)]">局域网服务已就绪</span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            <label className="block text-[11px] text-[var(--tx-2)]">
              用户名
              <div className="relative mt-1">
                <Icon name="user" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
                <input autoFocus value={user}
                  onChange={(e) => { setUser(e.target.value); setErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="admin / viewer"
                  className="field w-full h-9 pl-8 pr-3 text-[13px]" />
              </div>
            </label>

            <label className="block text-[11px] text-[var(--tx-2)]">
              密码
              <div className="relative mt-1">
                <Icon name="shield" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
                <input type="password" value={pwd}
                  onChange={(e) => { setPwd(e.target.value); setErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder="••••••••"
                  className="field w-full h-9 pl-8 pr-3 text-[13px]" />
              </div>
            </label>

            {err && (
              <p className="text-[11px] text-[#d70015] dark:text-[#ff8b84] flex items-center gap-1.5 -mt-1">
                <Icon name="warn" size={12} />{err}
              </p>
            )}

            <button onClick={submit}
              className="h-9 rounded-lg bg-[#0a84ff] hover:bg-[#3395ff] text-white text-[13px] font-semibold tracking-wide transition-all active:scale-[.98] shadow-[0_5px_16px_rgba(10,132,255,.35)] flex items-center justify-center gap-1.5 mt-1">
              <Icon name="power" size={14} />
              登 录
            </button>

            {/* 快捷填充 */}
            <div className="pt-1 border-t border-[var(--line-2)] mt-1">
              <p className="text-[10.5px] text-[var(--tx-3)] mb-1.5">演示账户（点击填充）</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => quick("admin")}
                  className="h-8 rounded-md border border-[rgba(48,209,88,.4)] bg-[rgba(48,209,88,.08)] hover:bg-[rgba(48,209,88,.16)] text-[#1f8f4d] dark:text-[#7ede99] text-[11px] flex items-center justify-center gap-1.5 transition active:scale-[.98]">
                  <Icon name="shield" size={12} />管理员 · 可编辑
                </button>
                <button onClick={() => quick("viewer")}
                  className="h-8 rounded-md border border-[rgba(255,159,10,.4)] bg-[rgba(255,159,10,.08)] hover:bg-[rgba(255,159,10,.16)] text-[#a26603] dark:text-[#ffbe69] text-[11px] flex items-center justify-center gap-1.5 transition active:scale-[.98]">
                  <Icon name="eye" size={12} />查阅 · 仅查看
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10.5px] text-[var(--tx-3)] mt-4 font-mono2">
          国办发〔2006〕22号 · 〔2015〕3号 数据基准
        </p>
      </div>
    </div>
  );
}
