import React, { useEffect, useMemo, useState } from "react";
import { EMPLOY_META, Employ, Person, TAG_META, Unit, yearOf } from "../data";
import { Icon, IconName, Logo } from "./icons";

/* ================= 通用弹窗 ================= */
export function Modal({ title, icon, onClose, children, footer, w = 580 }: {
  title: string; icon: IconName; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; w?: number;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-[rgba(8,10,14,.62)] backdrop-blur-[3px]" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="anim-modal relative rounded-xl border border-[#333a47] bg-[#1c2028] shadow-[0_28px_80px_rgba(0,0,0,.6)] flex flex-col max-h-[86vh]"
        style={{ width: w, maxWidth: "94vw" }}
      >
        <div className="h-11 shrink-0 flex items-center gap-2.5 px-4 border-b border-[#2c323e] bg-gradient-to-r from-[rgba(10,132,255,.1)] to-transparent rounded-t-xl">
          <Icon name={icon} size={15} className="text-[#6db1ff]" />
          <span className="text-[13.5px] font-semibold text-[#e8eaf0]">{title}</span>
          <button onClick={onClose} className="ml-auto w-6 h-6 rounded-md flex items-center justify-center text-[#667082] hover:text-white hover:bg-white/10 transition">
            <Icon name="close" size={13} />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <div className="shrink-0 px-4 py-3 border-t border-[#2c323e] flex items-center justify-end gap-2 bg-[#191d24] rounded-b-xl">{footer}</div>}
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
    ghost: "bg-[#262b35] hover:bg-[#2e3441] text-[#c3cad6] border-[#333a47]",
    danger: "bg-[rgba(255,69,58,.14)] hover:bg-[rgba(255,69,58,.24)] text-[#ff8b84] border-[rgba(255,69,58,.45)]",
    success: "bg-[rgba(48,209,88,.14)] hover:bg-[rgba(48,209,88,.24)] text-[#7ede99] border-[rgba(48,209,88,.45)]",
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
      footer={<><span className="mr-auto text-[11px] text-[#667082]">命中 <b className="font-mono2 text-[#9aa3b2]">{rows.length}</b> 条 · 双击行可快速定位</span><Btn onClick={onClose}>关闭</Btn></>}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5d6779]" />
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

      <div className="mt-3 rounded-lg border border-[#2c323e] overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                {["编号", "姓名", "单位", "人员状态", "在职状态", "现执行基本工资", ""].map((h, i) => (
                  <th key={i} className="sticky top-0 bg-[#242935] px-2.5 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] border-b border-[#333a47] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[#667082]">
                  <Icon name="search" size={20} className="mx-auto mb-2 text-[#3d4553]" />未查询到符合条件的人员
                </td></tr>
              )}
              {rows.map((p) => {
                const last = p.history[p.history.length - 1];
                return (
                  <tr key={p.id} onDoubleClick={() => onLocate(p.id)}
                    className="border-b border-white/[.04] hover:bg-[rgba(10,132,255,.07)] cursor-pointer transition-colors">
                    <td className="px-2.5 py-1.5 font-mono2 text-[#8ed6fa]">{p.id}</td>
                    <td className="px-2.5 py-1.5 text-[#e2e6ee] font-medium">{p.name}</td>
                    <td className="px-2.5 py-1.5 font-mono2 text-[#8b95a7]">[{p.unitId}] {unitName(p.unitId)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`text-[10px] px-1.5 py-[3px] rounded border ${TAG_META[p.tag]?.cls}`}>{p.tag}</span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className="flex items-center gap-1.5 w-fit text-[10.5px] px-1.5 py-[3px] rounded border" style={{ color: EMPLOY_META[p.employ].dot, borderColor: `${EMPLOY_META[p.employ].dot}55` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: EMPLOY_META[p.employ].dot }} />{p.employ}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 font-mono2 text-[#c3cad6]">¥{(last.pw + last.lw).toLocaleString()}</td>
                    <td className="px-2.5 py-1.5">
                      <button onClick={() => onLocate(p.id)}
                        className="text-[11px] px-2 py-1 rounded-md border border-[rgba(10,132,255,.4)] text-[#6db1ff] hover:bg-[rgba(10,132,255,.15)] transition">
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
        <label className="text-[11px] text-[#8b95a7]">
          单位编号
          <input value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="field mt-1 w-full h-8 px-2.5 font-mono2 text-[13px]" />
        </label>
        <label className="text-[11px] text-[#8b95a7]">
          单位名称
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：测试单位2"
            className="field mt-1 w-full h-8 px-2.5 text-[12.5px]" />
        </label>
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[#8b95a7]">现有单位（{units.length}）</p>
      <div className="rounded-lg border border-[#2c323e] divide-y divide-white/[.04] max-h-[220px] overflow-auto">
        {units.map((u) => {
          const cnt = persons.filter((p) => p.unitId === u.id).length;
          return (
            <div key={u.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/[.03] transition">
              <Icon name="unit" size={14} className="text-[#5d6779]" />
              <span className="font-mono2 text-[12px] text-[#8ed6fa]">[{u.id}]</span>
              <span className="text-[12.5px] text-[#e2e6ee]">{u.name}</span>
              <span className="ml-auto font-mono2 text-[10.5px] text-[#667082]">{cnt} 人</span>
              <button onClick={() => onRemove(u.id)} title="删除单位"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#5d6779] hover:text-[#ff8b84] hover:bg-[rgba(255,69,58,.12)] transition">
                <Icon name="trash" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ================= 全部重算 ================= */
export function RecalcModal({ persons, onClose, onDone }: {
  persons: Person[]; onClose: () => void; onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, persons.length)), 160);
    return () => clearInterval(t);
  }, [done, persons.length]);

  useEffect(() => {
    if (idx >= persons.length && !done) { setDone(true); onDone(); }
  }, [idx, done, persons.length, onDone]);

  const pct = Math.round((idx / Math.max(1, persons.length)) * 100);

  return (
    <Modal title="全部重算" icon="recalc" onClose={onClose} w={480}
      footer={<Btn kind={done ? "primary" : "ghost"} onClick={onClose}>{done ? "完成" : "后台运行"}</Btn>}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${done ? "border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)]" : "border-[rgba(10,132,255,.4)] bg-[rgba(10,132,255,.08)]"}`}>
          {done ? <Icon name="check" size={18} className="text-[#7ede99] anim-tick" /> : <Icon name="recalc" size={18} className="text-[#6db1ff] animate-spin" />}
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[#e2e6ee]">
            {done ? "全部重算完成" : `正在重算 ${Math.min(idx + 1, persons.length)} / ${persons.length} …`}
          </p>
          <p className="text-[11px] text-[#667082] mt-0.5">
            {done ? `共 ${persons.length} 人，套改结果与工资演变台账已刷新` : "按现职 / 按低职 / 按学历三种方案并行比对"}
          </p>
        </div>
        <span className="font-mono2 text-[15px] font-semibold text-[#6db1ff]">{pct}%</span>
      </div>

      <div className="mt-3 h-2.5 rounded-full bg-[#14171d] border border-[#2c323e] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-150 ${done ? "bg-[#30d158]" : "bg-gradient-to-r from-[#0a84ff] to-[#5ac8fa] prog-stripes"}`}
          style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 rounded-lg border border-[#2c323e] divide-y divide-white/[.04] max-h-[200px] overflow-auto">
        {persons.map((p, i) => {
          const st = i < idx ? "done" : i === idx && !done ? "run" : "wait";
          return (
            <div key={p.id} className={`flex items-center gap-2.5 px-3 py-1.5 text-[12px] ${st === "run" ? "bg-[rgba(10,132,255,.07)]" : ""}`}>
              <span className="font-mono2 w-6 text-[#5d6779]">{p.id}</span>
              <span className="text-[#c3cad6]">{p.name}</span>
              <span className="ml-auto flex items-center gap-1.5 text-[10.5px]">
                {st === "done" && <><Icon name="check" size={11} className="text-[#7ede99]" /><span className="text-[#7ede99]">已重算</span></>}
                {st === "run" && <><span className="w-2.5 h-2.5 rounded-full border-2 border-[#0a84ff] border-t-transparent animate-spin" /><span className="text-[#6db1ff]">计算中</span></>}
                {st === "wait" && <span className="text-[#5d6779]">等待</span>}
              </span>
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
        <Icon name={eligible ? "check" : "clock"} size={22} className={eligible ? "text-[#7ede99]" : "text-[#ffbe69]"} />
        <div>
          <p className={`text-[14px] font-bold ${eligible ? "text-[#7ede99]" : "text-[#ffbe69]"}`}>
            {eligible ? `${nextYear} 年符合滚动晋升级别条件` : `距下次滚动晋级还需 ${remain} 年`}
          </p>
          <p className="text-[11px] text-[#8b95a7] mt-0.5">
            规则：公务员年度考核累计 5 年称职及以上，滚动晋升一个级别（级别工资就近就高套档）
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["上次级别变动", `${lastYear} 年`, lastLvl?.reason ?? "—"],
          ["下次滚动年份", `${nextYear} 年`, `距今 ${remain} 年`],
          ["当前级别", person.history[person.history.length - 1].level, person.position],
        ].map(([a, b, c]) => (
          <div key={a} className="rounded-lg border border-[#2c323e] bg-[#191d24] px-3 py-2.5">
            <p className="text-[10.5px] text-[#667082]">{a}</p>
            <p className="font-mono2 text-[15px] font-semibold text-[#e2e6ee] mt-0.5">{b}</p>
            <p className="text-[10.5px] text-[#5d6779] mt-0.5 truncate">{c}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[#8b95a7]">级别变动时间线</p>
      <div className="rounded-lg border border-[#2c323e] px-4 py-3">
        {person.history.filter((r) => r.reason.includes("级别") || r.reason.includes("套改")).map((r, i, arr) => (
          <div key={r.seq} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mt-1 ${i === arr.length - 1 ? "bg-[#0a84ff] shadow-[0_0_8px_rgba(10,132,255,.7)]" : "bg-[#3d4553]"}`} />
              {i < arr.length - 1 && <span className="w-px flex-1 bg-[#333a47]" />}
            </div>
            <div className="pb-3">
              <p className="text-[12px] text-[#e2e6ee]">
                <span className="font-mono2 text-[#8ed6fa] mr-2">{r.start}</span>{r.reason}
                <span className="font-mono2 text-[#c3cad6] ml-2">→ {r.level}</span>
              </p>
              <p className="text-[10.5px] text-[#5d6779] mt-0.5">级别工资 ¥{r.lw.toLocaleString()}{r.incr ? ` · 增资 +¥${r.incr}` : ""}</p>
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
          <Icon name="warn" size={16} className="text-[#ff8b84]" />
        </div>
        <div>
          <p className="text-[13px] text-[#e2e6ee] leading-relaxed">
            确定删除人员 <b className="text-white">编号 {person.id} · {person.name}</b> 吗？
          </p>
          <p className="text-[11.5px] text-[#667082] mt-1 leading-relaxed">
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
          <Icon name="shield" size={20} className="text-[#7ede99]" />
          <div>
            <p className="text-[13px] font-semibold text-[#7ede99]">本机已注册</p>
            <p className="text-[11px] text-[#8b95a7] mt-0.5 font-mono2">注册码 {registered.code} · {registered.at}</p>
          </div>
        </div>
      ) : (
        <p className="text-[11.5px] text-[#8b95a7] leading-relaxed mb-3">
          试用版功能完整，仅状态栏显示试用标识。注册码请联系系统管理员获取（演示注册码：<b className="font-mono2 text-[#8ed6fa]">GW-2006-0701</b>）。
        </p>
      )}

      <label className="block text-[11px] text-[#8b95a7]">机器码（本机唯一）
        <div className="field mt-1 w-full h-8 px-2.5 flex items-center justify-between">
          <span className="font-mono2 text-[12.5px] text-[#8ed6fa]">{machine}</span>
          <Icon name="shield" size={13} className="text-[#5d6779]" />
        </div>
      </label>
      <label className="block text-[11px] text-[#8b95a7] mt-2.5">注册码
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="GW-XXXX-XXXX"
          className={`field mt-1 w-full h-8 px-2.5 font-mono2 text-[13px] tracking-wider ${err ? "anim-shake !border-[#ff453a]" : ""}`}
        />
      </label>
      {err && <p className="mt-1.5 text-[11px] text-[#ff8b84] flex items-center gap-1"><Icon name="warn" size={11} />注册码格式不正确或校验失败</p>}
    </Modal>
  );
}

/* ================= 帮助 ================= */
const HELP_MENUS: [IconName, string, string][] = [
  ["unit", "单位增加", "维护单位目录，新增 / 删除预算单位"],
  ["allowance", "津贴编辑输出", "编辑当前人员津贴补贴标准并导出文本"],
  ["query", "综合查询", "按编号、姓名、状态多条件检索人员"],
  ["recalc", "全部重算", "对全体人员重新执行三方案套改比对"],
  ["rolling", "滚动判断", "判断当前人员是否满足 5 年滚动晋级"],
  ["trash", "删除选择", "删除当前选中人员及其演变台账"],
  ["catalog", "目录数据", "查阅职务工资 / 级别工资 / 职务层次表"],
  ["calc", "计算器", "标准计算与增资测算辅助工具"],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="帮助 · 公务员工资测算系统" icon="help" onClose={onClose} w={620}
      footer={<Btn kind="primary" onClick={onClose}>知道了</Btn>}>
      <div className="grid grid-cols-2 gap-2">
        {HELP_MENUS.map(([ic, t, d]) => (
          <div key={t} className="flex items-start gap-2.5 rounded-lg border border-[#2c323e] bg-[#191d24] px-3 py-2.5">
            <Icon name={ic} size={15} className="text-[#6db1ff] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12.5px] font-medium text-[#e2e6ee]">{t}</p>
              <p className="text-[10.5px] text-[#667082] mt-0.5 leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 mb-1.5 text-[11px] text-[#8b95a7]">部署与运行</p>
      <div className="rounded-lg border border-[#2c323e] bg-[#191d24] px-3.5 py-3 text-[11.5px] text-[#9aa3b2] leading-relaxed">
        <p>· 本系统基于 <b className="text-[#c3cad6]">Electron</b> 封装为本地 <span className="font-mono2">.exe</span> 程序，测算核心与微信小程序后台共用同一 JS 计算模块。</p>
        <p className="mt-1">· 主进程内嵌本地 HTTP 服务，局域网内其他终端通过浏览器访问 <span className="font-mono2 text-[#8ed6fa]">http://本机IP:8080</span> 即可登录使用。</p>
        <p className="mt-1">· 快捷键：<span className="font-mono2 text-[#c3cad6]">Esc</span> 关闭弹窗；点击窗口绿色按钮可折叠人员列表。</p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[#5d6779]">
        <Logo size={14} />
        <span className="font-mono2">V8.2 · BUILD 2026.01 · 数据基准：2006 工改台账</span>
      </div>
    </Modal>
  );
}

/* ================= 退出确认 ================= */
export function ExitModal({ onStay, onExit }: { onStay: () => void; onExit: () => void }) {
  return (
    <Modal title="退出系统" icon="power" onClose={onStay} w={400}
      footer={<><Btn onClick={onStay}>继续使用</Btn><Btn kind="danger" onClick={onExit}>退出</Btn></>}>
      <p className="text-[13px] text-[#e2e6ee]">确定退出公务员工资测算系统吗？</p>
      <p className="text-[11.5px] text-[#667082] mt-1.5">退出后局域网访问服务将同时停止，未输出的测算结果不会丢失。</p>
    </Modal>
  );
}

/* ================= 退出后画面 ================= */
export function ExitScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="fixed inset-0 z-[99] app-bg flex flex-col items-center justify-center anim-fade">
      <div className="w-16 h-16 rounded-2xl border border-[#333a47] bg-[#1d2129] flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,.5)]">
        <Logo size={34} />
      </div>
      <p className="mt-5 font-disp text-[18px] font-semibold text-[#e8eaf0]">系统已安全退出</p>
      <p className="mt-1.5 text-[12px] text-[#667082]">局域网服务已停止 · 数据已保存至本地</p>
      <button onClick={onRestart}
        className="mt-6 h-9 px-5 rounded-lg bg-[#0a84ff] hover:bg-[#3395ff] text-white text-[13px] font-medium transition-all active:scale-[.97] shadow-[0_6px_20px_rgba(10,132,255,.4)] flex items-center gap-2">
        <Icon name="power" size={14} />
        重新启动
      </button>
    </div>
  );
}
