import React, { useEffect, useMemo, useState } from "react";
import { EMPLOY_META, Employ, Person, TAG_META, Unit, yearOf } from "../data";
import { VerifyReport } from "../core/calculator";
import { Icon, IconName, Logo } from "./icons";

/* ================= 通用弹窗 ================= */
export function Modal({ title, icon, onClose, children, footer, w = 580 }: {
  title: string; icon: IconName; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; w?: number;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,.45)] dark:bg-[rgba(8,10,14,.62)] backdrop-blur-[3px]" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="anim-modal relative rounded-xl border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_28px_80px_rgba(15,30,60,.35)] flex flex-col max-h-[86vh]"
        style={{ width: w, maxWidth: "94vw" }}
      >
        <div className="h-11 shrink-0 flex items-center gap-2.5 px-4 border-b border-[var(--line)] card-head rounded-t-xl">
          <Icon name={icon} size={15} className="text-[var(--acc)]" />
          <span className="text-[13.5px] font-semibold text-[var(--tx-1)]">{title}</span>
          <button onClick={onClose} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)] transition">
            <Icon name="close" size={13} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="shrink-0 px-4 py-3 border-t border-[var(--line)] flex items-center justify-end gap-2 bg-[var(--head)] rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Btn({ children, kind = "ghost", onClick, disabled }: {
  children: React.ReactNode; kind?: "primary" | "ghost" | "danger" | "success";
  onClick?: () => void; disabled?: boolean;
}) {
  const cls = {
    primary: "bg-[#0a84ff] hover:bg-[#3395ff] text-white border-transparent shadow-[0_4px_14px_rgba(10,132,255,.35)]",
    ghost: "bg-[var(--bg-3)] hover:bg-[var(--hov)] text-[var(--tx-1)] border-[var(--line)]",
    danger: "bg-[rgba(255,69,58,.12)] hover:bg-[rgba(255,69,58,.2)] text-[#d70015] dark:text-[#ff8b84] border-[rgba(255,69,58,.45)]",
    success: "bg-[rgba(48,209,88,.12)] hover:bg-[rgba(48,209,88,.2)] text-[#1f8f4d] dark:text-[#7ede99] border-[rgba(48,209,88,.45)]",
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`h-8 px-3.5 rounded-lg border text-[12.5px] font-medium transition-all active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none ${cls}`}>
      {children}
    </button>
  );
}

/* ================= 综合查询 ================= */
export function QueryModal({ persons, units, onClose, onLocate }: {
  persons: Person[]; units: Unit[]; onClose: () => void; onLocate: (id: number) => void;
}) {
  const [kw, setKw] = useState("");
  const [tag, setTag] = useState("all");
  const [emp, setEmp] = useState("all");

  const rows = useMemo(() => persons.filter((p) => {
    const k = kw.trim().toLowerCase();
    const hitK = !k || p.name.toLowerCase().includes(k) || String(p.id) === k || p.unitId.includes(k);
    const hitT = tag === "all" || p.tag === tag;
    const hitE = emp === "all" || p.employ === (emp as Employ);
    return hitK && hitT && hitE;
  }), [persons, kw, tag, emp]);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "";

  return (
    <Modal title="综合查询" icon="query" onClose={onClose} w={760}
      footer={<><span className="mr-auto text-[11px] text-[var(--tx-3)]">命中 <b className="font-mono2 text-[var(--tx-2)]">{rows.length}</b> 条 · 双击行可快速定位</span><Btn onClick={onClose}>关闭</Btn></>}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
          <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="编号 / 姓名 / 单位编号"
            className="field w-full h-8 pl-8 pr-3 text-[12.5px]" />
        </div>
        <select value={tag} onChange={(e) => setTag(e.target.value)} className="field h-8 px-2 text-[12px] w-[120px]">
          <option value="all">全部状态</option>
          {Object.keys(TAG_META).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={emp} onChange={(e) => setEmp(e.target.value)} className="field h-8 px-2 text-[12px] w-[100px]">
          <option value="all">全部在职</option>
          <option value="在职">在职</option>
          <option value="退休">退休</option>
          <option value="止薪">止薪</option>
        </select>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--line)] overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                {["编号", "姓名", "单位", "人员状态", "在职状态", "现执行基本工资", ""].map((h, i) => (
                  <th key={i} className="tbl-head px-2.5 py-1.5 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--tx-3)]">
                  <Icon name="search" size={20} className="mx-auto mb-2 text-[var(--tx-3)]" />未查询到符合条件的人员
                </td></tr>
              )}
              {rows.map((p) => {
                const last = p.history[p.history.length - 1];
                return (
                  <tr key={p.id} onDoubleClick={() => onLocate(p.id)}
                    className="border-b border-[var(--line-2)] hover:bg-[var(--sel)] cursor-pointer transition-colors">
                    <td className="px-2.5 py-1.5 font-mono2 text-[var(--acc)]">{p.id}</td>
                    <td className="px-2.5 py-1.5 text-[var(--tx-1)] font-medium">{p.name}</td>
                    <td className="px-2.5 py-1.5 font-mono2 text-[var(--tx-2)]">[{p.unitId}] {unitName(p.unitId)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`text-[10px] px-1.5 py-[3px] rounded border ${TAG_META[p.tag]?.cls}`}>{p.tag}</span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className="flex items-center gap-1.5 w-fit text-[10.5px] px-1.5 py-[3px] rounded border" style={{ color: EMPLOY_META[p.employ].dot, borderColor: `${EMPLOY_META[p.employ].dot}55` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: EMPLOY_META[p.employ].dot }} />{p.employ}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono2 text-[var(--tx-1)]">¥{(last.pw + last.lw).toLocaleString()}</td>
                    <td className="px-2.5 py-1.5">
                      <button onClick={() => onLocate(p.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[rgba(10,132,255,.45)] text-[var(--acc)] hover:bg-[var(--sel)] transition">
                        定位
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* ================= 单位增加 ================= */
export function UnitModal({ units, persons, onClose, onAdd, onRemove }: {
  units: Unit[]; persons: Person[]; onClose: () => void;
  onAdd: (id: string, name: string) => void; onRemove: (id: string) => void;
}) {
  const next = String(Math.max(0, ...units.map((u) => parseInt(u.id, 10))) + 1).padStart(4, "0");
  const [id, setId] = useState(next);
  const [name, setName] = useState("");

  return (
    <Modal title="单位增加" icon="unit" onClose={onClose} w={520}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" onClick={() => { onAdd(id, name); setId(String(Math.max(0, ...units.map((u) => parseInt(u.id, 10)), parseInt(id || "0", 10)) + 1).padStart(4, "0")); setName(""); }}>确认增加</Btn></>}>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="text-[11px] text-[var(--tx-2)]">
          单位编号
          <input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="field mt-1 w-full h-8 px-2.5 font-mono2 text-[13px]" />
        </label>
        <label className="text-[11px] text-[var(--tx-2)]">
          单位名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：测试单位2"
            className="field mt-1 w-full h-8 px-2.5 text-[12.5px]" />
        </label>
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[var(--tx-2)]">现有单位（{units.length}）</p>
      <div className="rounded-lg border border-[var(--line)] divide-y divide-[var(--line-2)] max-h-[220px] overflow-auto">
        {units.map((u) => {
          const cnt = persons.filter((p) => p.unitId === u.id).length;
          return (
            <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--hov)] transition">
              <Icon name="unit" size={14} className="text-[var(--tx-3)]" />
              <span className="font-mono2 text-[12px] text-[var(--acc)]">[{u.id}]</span>
              <span className="text-[12.5px] text-[var(--tx-1)]">{u.name}</span>
              <span className="ml-auto font-mono2 text-[10.5px] text-[var(--tx-3)]">{cnt} 人</span>
              <button onClick={() => onRemove(u.id)} title="删除单位"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[#d70015] dark:hover:text-[#ff8b84] hover:bg-[rgba(255,69,58,.1)] transition">
                <Icon name="trash" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ================= 全部重算（核心引擎核验） ================= */
const STATUS_META: Record<VerifyReport["status"], { label: string; cls: string }> = {
  match: { label: "一致", cls: "border-[rgba(48,209,88,.5)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.1)]" },
  partial: { label: "部分差异", cls: "border-[rgba(255,159,10,.5)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.1)]" },
  diff: { label: "差异", cls: "border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] bg-[rgba(255,69,58,.1)]" },
  skip: { label: "跳过", cls: "border-[var(--line)] text-[var(--tx-3)] bg-[var(--bg-3)]" },
};

export function RecalcModal({ reports, onClose, onDone }: {
  reports: VerifyReport[]; onClose: () => void; onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, reports.length)), 220);
    return () => clearInterval(t);
  }, [done, reports.length]);

  useEffect(() => {
    if (idx >= reports.length && !done) { setDone(true); onDone(); }
  }, [idx, done, reports.length, onDone]);

  const pct = Math.round((idx / Math.max(1, reports.length)) * 100);
  const cnt = { match: 0, partial: 0, diff: 0, skip: 0 };
  reports.forEach((r) => { if (r.status !== "skip") cnt[r.status]++; });

  return (
    <Modal title="全部重算 · 核心引擎核验" icon="recalc" onClose={onClose} w={620}
      footer={
        <>
          <span className="mr-auto text-[10.5px] text-[var(--tx-3)]">
            <b className="text-[#1f8f4d] dark:text-[#7ede99]">一致</b> 引擎与台账相同 ·
            <b className="text-[#a26603] dark:text-[#ffbe69]"> 差异</b> 两版套改表口径不同 ·
            <b className="text-[var(--tx-2)]"> 跳过</b> 非公务员轨道
          </span>
          <Btn kind={done ? "primary" : "ghost"} onClick={onClose}>{done ? "完成" : "后台运行"}</Btn>
        </>
      }>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${done ? "border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)]" : "border-[rgba(10,132,255,.4)] bg-[var(--sel)]"}`}>
          {done ? <Icon name="check" size={18} className="text-[#1f8f4d] dark:text-[#7ede99] anim-tick" /> : <Icon name="recalc" size={18} className="text-[var(--acc)] animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[var(--tx-1)]">
            {done ? "全部重算完成" : `正在以 calculator.js 核心重算 ${Math.min(idx + 1, reports.length)} / ${reports.length} …`}
          </p>
          <p className="text-[11px] text-[var(--tx-3)] mt-0.5">
            {done
              ? `一致 ${cnt.match} · 部分差异 ${cnt.partial} · 差异 ${cnt.diff} · 跳过 ${cnt.skip}`
              : "逐人执行 按现职务 / 按低一职务 / 按最高学历保底 三方案比对"}
          </p>
        </div>
        <span className="font-mono2 text-[15px] font-semibold text-[var(--acc)]">{pct}%</span>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-[var(--bg-3)] border border-[var(--line)] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-200 ${done ? "bg-[#30d158]" : "bg-gradient-to-r from-[#0a84ff] to-[#5ac8fa] prog-stripes"}`}
          style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 rounded-lg border border-[var(--line)] divide-y divide-[var(--line-2)] max-h-[300px] overflow-auto">
        {reports.map((r, i) => {
          const st = i < idx ? "done" : i === idx && !done ? "run" : "wait";
          const meta = STATUS_META[r.status];
          return (
            <div key={r.person.id} className={`px-3 py-2 text-[12px] ${st === "run" ? "bg-[var(--sel)]" : ""}`}>
              <div className="flex items-center gap-2.5">
                <span className="font-mono2 w-6 text-[var(--tx-3)]">{r.person.id}</span>
                <span className="text-[var(--tx-1)] font-medium">{r.person.name}</span>
                <span className={`text-[10px] px-1.5 py-[3px] rounded border ${TAG_META[r.person.tag]?.cls}`}>{r.person.tag}</span>
                <span className="ml-auto flex items-center gap-1.5 text-[10.5px]">
                  {st === "done" && <span className={`px-1.5 py-[3px] rounded border anim-tick ${meta.cls}`}>{meta.label}</span>}
                  {st === "run" && <><span className="w-2.5 h-2.5 rounded-full border-2 border-[var(--acc)] border-t-transparent animate-spin" /><span className="text-[var(--acc)]">计算中</span></>}
                  {st === "wait" && <span className="text-[var(--tx-3)]">等待</span>}
                </span>
              </div>
              {st === "done" && r.status === "skip" && (
                <p className="mt-1 pl-9 text-[10.5px] text-[var(--tx-3)]">{r.skipReason}</p>
              )}
              {st === "done" && r.status !== "skip" && (
                <div className="mt-1.5 pl-9 flex flex-col gap-1">
                  {r.cells.map((c) => (
                    <div key={c.method} className="flex items-center gap-2 text-[10.5px]">
                      <span className="w-[92px] text-[var(--tx-3)]">{c.method}</span>
                      <span className="font-mono2 text-[var(--tx-2)]">台账 {c.ledger ?? "—"}</span>
                      <Icon name="chevR" size={9} className="text-[var(--tx-3)]" />
                      <span className="font-mono2 text-[var(--tx-1)]">引擎 {c.engine}</span>
                      <span className="font-mono2 text-[var(--tx-3)]">(¥{c.wage.toLocaleString()})</span>
                      <span className={`ml-auto font-bold ${c.match ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[#d70015] dark:text-[#ff8b84]"}`}>
                        {c.match === null ? "—" : c.match ? "✓" : "Δ"}
                      </span>
                    </div>
                  ))}
                  {r.taogaoYears !== undefined && (
                    <span className="font-mono2 text-[10px] text-[var(--tx-3)]">套改年限（虚年）{r.taogaoYears} 年</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ================= 滚动判断 ================= */
export function RollingModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const levelEvts = person.history.filter((r) => r.reason.includes("晋升级别") || r.reason.includes("滚动级别"));
  const lastLvl = levelEvts[levelEvts.length - 1];
  const lastYear = lastLvl ? yearOf(lastLvl.start) : yearOf(person.history[0].start);
  const NOW = new Date().getFullYear();
  const nextYear = lastYear + 5;
  const eligible = NOW >= nextYear;
  const remain = Math.max(0, nextYear - NOW);

  return (
    <Modal title={`滚动判断 · ${person.name}`} icon="rolling" onClose={onClose} w={560}
      footer={<Btn kind="primary" onClick={onClose}>确定</Btn>}>
      <div className={`rounded-lg border px-3.5 py-3 flex items-center gap-3 ${eligible ? "border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.07)]" : "border-[rgba(255,159,10,.45)] bg-[rgba(255,159,10,.06)]"}`}>
        <Icon name={eligible ? "check" : "clock"} size={22} className={eligible ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[#a26603] dark:text-[#ffbe69]"} />
        <div>
          <p className={`text-[14px] font-bold ${eligible ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[#a26603] dark:text-[#ffbe69]"}`}>
            {eligible ? `${nextYear} 年符合滚动晋升级别条件` : `距下次滚动晋级还需 ${remain} 年`}
          </p>
          <p className="text-[11px] text-[var(--tx-3)] mt-0.5">
            规则：年度考核累计 5 年称职及以上滚动晋升一个级别（就近就高套档），2 年晋升一个档次
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["上次级别变动", `${lastYear} 年`, lastLvl?.reason ?? "—"],
          ["下次滚动年份", `${nextYear} 年`, `距今 ${remain} 年`],
          ["当前级别", person.history[person.history.length - 1].level, person.position],
        ].map(([a, b, c]) => (
          <div key={a} className="rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3 py-2.5">
            <p className="text-[10.5px] text-[var(--tx-3)]">{a}</p>
            <p className="font-mono2 text-[15px] font-semibold text-[var(--tx-1)] mt-0.5">{b}</p>
            <p className="text-[10.5px] text-[var(--tx-3)] mt-0.5 truncate">{c}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[var(--tx-2)]">级别变动时间线</p>
      <div className="rounded-lg border border-[var(--line)] px-4 py-3">
        {person.history.filter((r) => r.reason.includes("级别") || r.reason.includes("套改")).map((r, i, arr) => (
          <div key={r.seq} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mt-1 ${i === arr.length - 1 ? "bg-[var(--acc)] shadow-[0_0_8px_rgba(10,132,255,.7)]" : "bg-[var(--tx-3)]"}`} />
              {i < arr.length - 1 && <span className="w-px flex-1 bg-[var(--line)]" />}
            </div>
            <div className="pb-3">
              <p className="text-[12px] text-[var(--tx-1)]">
                <span className="font-mono2 text-[var(--acc)] mr-2">{r.start}</span>{r.reason}
                <span className="font-mono2 text-[var(--tx-1)] ml-2">→ {r.level}</span>
              </p>
              <p className="text-[10.5px] text-[var(--tx-3)] mt-0.5">级别工资 ¥{r.lw.toLocaleString()}{r.incr ? ` · 增资 +¥${r.incr}` : ""}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ================= 删除确认 ================= */
export function ConfirmDeleteModal({ person, onCancel, onConfirm }: {
  person: Person; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal title="删除选择" icon="trash" onClose={onCancel} w={420}
      footer={<><Btn onClick={onCancel}>取消</Btn><Btn kind="danger" onClick={onConfirm}>确认删除</Btn></>}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[rgba(255,69,58,.12)] border border-[rgba(255,69,58,.4)] flex items-center justify-center shrink-0">
          <Icon name="warn" size={16} className="text-[#d70015] dark:text-[#ff8b84]" />
        </div>
        <div>
          <p className="text-[13px] text-[var(--tx-1)] leading-relaxed">
            确定删除人员 <b>编号 {person.id} · {person.name}</b> 吗？
          </p>
          <p className="text-[11.5px] text-[var(--tx-3)] mt-1 leading-relaxed">
            其工资演变台账（{person.history.length} 条记录）将一并移除，该操作可通过小程序后台重新同步恢复。
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ================= 注册 ================= */
export function RegisterModal({ machine, registered, onClose, onRegister }: {
  machine: string; registered: { code: string; at: string } | null;
  onClose: () => void; onRegister: (code: string) => boolean;
}) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);

  const submit = () => {
    if (!onRegister(code.trim())) { setErr(true); setTimeout(() => setErr(false), 550); }
  };

  return (
    <Modal title="软件注册" icon="key" onClose={onClose} w={460}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" onClick={submit}>{registered ? "重新注册" : "立即注册"}</Btn></>}>
      {registered ? (
        <div className="rounded-lg border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.07)] px-3.5 py-3 flex items-center gap-3 mb-3">
          <Icon name="shield" size={20} className="text-[#1f8f4d] dark:text-[#7ede99]" />
          <div>
            <p className="text-[13px] font-semibold text-[#1f8f4d] dark:text-[#7ede99]">本机已注册</p>
            <p className="text-[11px] text-[var(--tx-3)] mt-0.5 font-mono2">注册码 {registered.code} · {registered.at}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-[var(--tx-3)] leading-relaxed mb-3">
          试用版功能完整，仅状态栏显示试用标识。注册码请联系系统管理员获取（演示注册码：<b className="font-mono2 text-[var(--acc)]">GW-2006-0701</b>）。
        </p>
      )}

      <label className="block text-[11px] text-[var(--tx-2)]">机器码（本机唯一）
        <div className="field mt-1 w-full h-8 px-2.5 flex items-center justify-between">
          <span className="font-mono2 text-[12.5px] text-[var(--acc)]">{machine}</span>
          <Icon name="shield" size={13} className="text-[var(--tx-3)]" />
        </div>
      </label>
      <label className="block text-[11px] text-[var(--tx-2)] mt-2.5">注册码
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GW-XXXX-XXXX"
          className={`field mt-1 w-full h-8 px-2.5 font-mono2 text-[13px] tracking-wider ${err ? "anim-shake !border-[#ff453a]" : ""}`}
        />
      </label>
      {err && <p className="mt-1.5 text-[11px] text-[#d70015] dark:text-[#ff8b84] flex items-center gap-1"><Icon name="warn" size={11} />注册码格式不正确或校验失败</p>}
    </Modal>
  );
}

/* ================= 帮助 ================= */
const HELP_MENUS: [IconName, string, string][] = [
  ["unit", "单位增加", "维护单位目录，新增 / 删除预算单位"],
  ["allowance", "津贴编辑输出", "编辑当前人员津贴补贴标准并导出文本"],
  ["query", "综合查询", "按编号、姓名、状态多条件检索人员"],
  ["recalc", "全部重算", "以 calculator.js 核心对全体人员重新核验三方案套改结果"],
  ["rolling", "滚动判断", "判断当前人员是否满足 5 年滚动晋级"],
  ["trash", "删除选择", "删除当前选中人员及其演变台账"],
  ["catalog", "目录数据", "查阅工资标准表 / 套改对照表 / 职务层次表"],
  ["calc", "计算器", "标准计算与增资测算辅助工具"],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="帮助 · 公务员工资测算系统" icon="help" onClose={onClose} w={620}
      footer={<Btn kind="primary" onClick={onClose}>知道了</Btn>}>
      <div className="grid grid-cols-2 gap-2">
        {HELP_MENUS.map(([ic, t, d]) => (
          <div key={t} className="flex items-start gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3 py-2.5">
            <Icon name={ic} size={15} className="text-[var(--acc)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12.5px] font-medium text-[var(--tx-1)]">{t}</p>
              <p className="text-[10.5px] text-[var(--tx-3)] mt-0.5 leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[var(--tx-2)]">测算核心与部署</p>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3.5 py-3 text-[11.5px] text-[var(--tx-2)] leading-relaxed">
        <p>· 测算核心 <span className="font-mono2">src/core/calculator.ts</span> 与微信小程序 <span className="font-mono2">utils/calculator.js</span> 同源：2006 套改表、级别工资表、五年晋级 / 两年晋档滚动规则完全一致。</p>
        <p className="mt-1">· 详情页「套改测算」工作区 1:1 移植小程序页面逻辑（2006 年前套改 / 2006 年后定级、三方案对比、截止年份推演）。</p>
        <p className="mt-1">· 基于 <b className="text-[var(--tx-1)]">Electron</b> 封装为本地 <span className="font-mono2">.exe</span>；主进程内嵌 HTTP 服务，局域网终端通过浏览器访问 <span className="font-mono2 text-[var(--acc)]">http://本机IP:8080</span> 即可使用。</p>
        <p className="mt-1">· 快捷键：<span className="font-mono2">Esc</span> 关闭弹窗；标题栏右侧可切换日间 / 夜间模式（默认日间）。</p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[var(--tx-3)]">
        <Logo size={14} />
        <span className="font-mono2">V8.2 · BUILD 2026.01 · 数据基准：国办发〔2006〕22号 / 〔2015〕3号</span>
      </div>
    </Modal>
  );
}

/* ================= 退出确认 ================= */
export function ExitModal({ onStay, onExit }: { onStay: () => void; onExit: () => void }) {
  return (
    <Modal title="退出系统" icon="power" onClose={onStay} w={400}
      footer={<><Btn onClick={onStay}>继续使用</Btn><Btn kind="danger" onClick={onExit}>退出</Btn></>}>
      <p className="text-[13px] text-[var(--tx-1)]">确定退出公务员工资测算系统吗？</p>
      <p className="text-[11.5px] text-[var(--tx-3)] mt-1.5">退出后局域网访问服务将同时停止，未输出的测算结果不会丢失。</p>
    </Modal>
  );
}

/* ================= 退出后画面 ================= */
export function ExitScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="fixed inset-0 z-[99] app-bg flex flex-col items-center justify-center anim-fade">
      <div className="w-16 h-16 rounded-2xl border border-[var(--line)] bg-[var(--bg-2)] flex items-center justify-center shadow-[0_20px_60px_rgba(15,30,60,.25)]">
        <Logo size={34} />
      </div>
      <p className="mt-5 font-disp text-[18px] font-semibold text-[var(--tx-1)]">系统已安全退出</p>
      <p className="mt-1.5 text-[12px] text-[var(--tx-3)]">局域网服务已停止 · 数据已保存至本地</p>
      <button onClick={onRestart}
        className="mt-6 h-9 px-5 rounded-lg bg-[#0a84ff] hover:bg-[#3395ff] text-white text-[13px] font-medium transition-all active:scale-[.97] shadow-[0_6px_20px_rgba(10,132,255,.4)] flex items-center gap-2">
        <Icon name="power" size={14} />
        重新启动
      </button>
    </div>
  );
}
