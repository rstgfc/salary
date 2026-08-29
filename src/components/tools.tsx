import React, { useState } from "react";
import {
  AllowanceItem, Person, Unit, defaultAllowances, fmt, lastOf,
} from "../data";
import { Icon } from "./icons";
import { POLICY_CONFIG } from "../core/calculator";
import { LEVEL_SALARY, LOWER_POSITION, POSITIONS, POSITION_SALARY } from "../core/salarydata";
import { POSITION_LEVELS } from "../data";
import { Btn, Modal } from "./modals";

/* ================= 计算器 ================= */
export function CalcModal({ onClose }: { onClose: () => void }) {
  const [disp, setDisp] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [tape, setTape] = useState<string[]>([]);

  const input = (d: string) => {
    if (fresh) { setDisp(d === "." ? "0." : d); setFresh(false); return; }
    if (d === "." && disp.includes(".")) return;
    if (disp.length > 12) return;
    setDisp(disp === "0" && d !== "." ? d : disp + d);
  };

  const apply = (a: number, b: number, o: string): number => {
    switch (o) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const setOperator = (o: string) => {
    const cur = parseFloat(disp);
    if (acc !== null && op && !fresh) {
      const r = apply(acc, cur, op);
      setAcc(r); setDisp(String(round2(r))); setTape((t) => [...t, `${round2(acc)} ${op} ${round2(cur)} = ${round2(r)}`].slice(-8));
    } else {
      setAcc(cur);
    }
    setOp(o); setFresh(true);
  };

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const equals = () => {
    if (acc === null || !op) return;
    const cur = parseFloat(disp);
    const r = apply(acc, cur, op);
    setTape((t) => [...t, `${round2(acc)} ${op} ${round2(cur)} = ${round2(r)}`].slice(-8));
    setDisp(String(round2(r))); setAcc(null); setOp(null); setFresh(true);
  };

  const clear = () => { setDisp("0"); setAcc(null); setOp(null); setFresh(true); };

  const keys: { k: string; act: () => void; cls?: string }[] = [
    { k: "C", act: clear, cls: "text-[#d70015] dark:text-[#ff8b84]" },
    { k: "±", act: () => setDisp(disp.startsWith("-") ? disp.slice(1) : disp === "0" ? "0" : "-" + disp) },
    { k: "%", act: () => setDisp(String(round2(parseFloat(disp) / 100))) },
    { k: "÷", act: () => setOperator("÷"), cls: "op" },
    { k: "7", act: () => input("7") }, { k: "8", act: () => input("8") }, { k: "9", act: () => input("9") },
    { k: "×", act: () => setOperator("×"), cls: "op" },
    { k: "4", act: () => input("4") }, { k: "5", act: () => input("5") }, { k: "6", act: () => input("6") },
    { k: "−", act: () => setOperator("−"), cls: "op" },
    { k: "1", act: () => input("1") }, { k: "2", act: () => input("2") }, { k: "3", act: () => input("3") },
    { k: "+", act: () => setOperator("+"), cls: "op" },
    { k: "0", act: () => input("0") }, { k: ".", act: () => input(".") },
    { k: "=", act: equals, cls: "eq" },
  ];

  return (
    <Modal title="计算器" icon="calc" onClose={onClose} w={520}
      footer={<><span className="mr-auto text-[10.5px] text-[var(--tx-3)]">可用于增资额 / 月均奖金等辅助核算</span><Btn onClick={onClose}>关闭</Btn></>}>
      <div className="grid grid-cols-[1fr_240px] gap-3">
        <div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3 py-2.5 text-right">
            <div className="text-[10.5px] text-[var(--tx-3)] font-mono2 h-4">
              {acc !== null && op ? `${round2(acc)} ${op}` : ""}
            </div>
            <div className="font-mono2 text-[26px] font-semibold text-[var(--tx-1)] truncate">{disp}</div>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            {keys.map((b) => (
              <button key={b.k} onClick={b.act}
                className={`h-10 rounded-lg border text-[15px] font-mono2 transition-all active:scale-95 ${
                  b.cls === "eq"
                    ? "bg-[#0a84ff] border-transparent text-white hover:bg-[#3395ff] shadow-[0_4px_12px_rgba(10,132,255,.3)]"
                    : b.cls === "op"
                      ? "border-[var(--line)] bg-[var(--sel)] text-[var(--acc)] hover:bg-[var(--sel-strong)]"
                      : `border-[var(--line)] bg-[var(--bg-2)] hover:bg-[var(--hov)] ${b.cls ?? "text-[var(--tx-1)]"}`
                }`}>
                {b.k}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-3)] p-2.5 flex flex-col min-h-[240px]">
          <p className="text-[10.5px] text-[var(--tx-3)] mb-1.5 flex items-center gap-1"><Icon name="clock" size={11} />计算记录</p>
          <div className="flex-1 overflow-auto flex flex-col gap-1">
            {tape.length === 0 && <p className="text-[11px] text-[var(--tx-3)] py-4 text-center">暂无记录</p>}
            {tape.map((t, i) => (
              <p key={i} className="font-mono2 text-[11px] text-[var(--tx-2)] bg-[var(--bg-2)] border border-[var(--line-2)] rounded px-2 py-1">{t}</p>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= 津贴编辑输出 ================= */
export function AllowanceModal({ person, unitName, onClose, onToast }: {
  person: Person; unitName: string; onClose: () => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [items, setItems] = useState<AllowanceItem[]>(() => defaultAllowances(person));
  const last = lastOf(person);
  const total = items.reduce((s, i) => s + (i.std || 0), 0);
  const monthly = last.pw + last.lw + total;

  const setStd = (id: string, v: number) =>
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, std: Math.max(0, v) } : i)));

  const output = () => {
    let text = `【${person.name}（编号${person.id}）津贴补贴标准表】\n单位：[${person.unitId}] ${unitName}\n`;
    text += `基本工资：职务 ¥${last.pw} + 级别 ¥${last.lw} = ¥${last.pw + last.lw}\n`;
    text += "----------------------------------------\n";
    items.forEach((i) => { text += `${i.name}（${i.base}）\t¥${i.std}\n`; });
    text += "----------------------------------------\n";
    text += `津贴合计\t¥${total}\n月应发合计\t¥${monthly}\n`;
    return text;
  };

  const doOutput = async () => {
    try {
      await navigator.clipboard.writeText(output());
      onToast("success", `已输出「${person.name}」津贴标准表到剪贴板（¥${monthly}/月）`);
    } catch {
      onToast("error", "输出失败：剪贴板不可用");
    }
  };

  return (
    <Modal title={`津贴编辑输出 · ${person.name}`} icon="allowance" onClose={onClose} w={560}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" onClick={doOutput}>输出到剪贴板</Btn></>}>
      <div className="rounded-lg border border-[var(--line)] divide-y divide-[var(--line-2)]">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-[var(--tx-1)]">{i.name}</p>
              <p className="text-[10.5px] text-[var(--tx-3)]">计发口径：{i.base}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[var(--tx-3)]">¥</span>
              <input type="number" min={0} value={i.std}
                onChange={(e) => setStd(i.id, Number(e.target.value) || 0)}
                className="field w-[92px] h-7 px-2 text-right font-mono2 text-[12.5px]" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3 py-2.5">
        <span className="text-[12px] text-[var(--tx-2)]">月应发合计（基本工资 + 津贴）</span>
        <span className="font-mono2 text-[16px] font-bold text-[var(--acc)]">¥{fmt(monthly)}<span className="text-[10px] text-[var(--tx-3)] font-normal"> /月</span></span>
      </div>
    </Modal>
  );
}

/* ================= 目录数据 ================= */
type CatalogTab = "duty" | "rank" | "position";

const TH = "tbl-head px-2.5 py-1.5 text-left";
const TH_R = "tbl-head px-2 py-1.5 text-right";

export function CatalogModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<CatalogTab>("duty");
  const tabs: [CatalogTab, string][] = [
    ["duty", "职务工资标准表"], ["rank", "级别工资标准表"], ["position", "职务层次表"],
  ];

  /* 级别工资标准表最大档数（取所有级别中最长的） */
  const maxGrades = Math.max(...Object.values(LEVEL_SALARY).map((a) => a.length));

  return (
    <Modal title="工资标准" icon="catalog" onClose={onClose} w={760}
      footer={<><span className="mr-auto text-[11px] text-[var(--tx-3)]">依据：国办发〔2015〕3号 · 2014 年 10 月起执行 · 仅供测算参考</span><Btn kind="primary" onClick={onClose}>关闭</Btn></>}>
      <div className="flex items-center gap-1 border-b border-[var(--line)] overflow-x-auto">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 h-8 text-[12px] rounded-t-md border-b-2 transition whitespace-nowrap ${
              tab === k
                ? "border-[var(--acc)] text-[var(--acc)] bg-[var(--sel)]"
                : "border-transparent text-[var(--tx-2)] hover:text-[var(--tx-1)]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-[var(--line)] overflow-hidden">
        <div className="max-h-[400px] overflow-auto">
          {/* 职务工资标准表（2014 年后，按职务层次，领导/非领导分列） */}
          {tab === "duty" && (
            <div>
              <table className="w-full text-[12px]">
                <thead><tr>
                  <th className={TH}>职务层次</th>
                  <th className={TH_R}>领导职务（元/月）</th>
                  <th className={TH_R}>非领导职务（元/月）</th>
                </tr></thead>
                <tbody>
                  {[...POSITIONS].reverse().map((pos, i) => {
                    const s = POSITION_SALARY[pos];
                    return (
                      <tr key={pos} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                        <td className="px-3 py-1.5 text-[var(--tx-1)]">{pos}</td>
                        <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{s?.leader != null ? fmt(s.leader) : "—"}</td>
                        <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{s?.nonLeader != null ? fmt(s.nonLeader) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-3 pt-2 pb-1.5 text-[10px] text-[var(--tx-3)] leading-relaxed">
                2014 年 10 月调整后标准（国办发〔2015〕3号）。测算引擎在「调整工资标准」后自动套用本表（按领导/非领导区分）。
              </p>
            </div>
          )}

          {/* 级别工资标准表（2014 年后） */}
          {tab === "rank" && (
            <div>
              <table className="text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${TH} sticky left-0 z-20`}>级别</th>
                    {Array.from({ length: maxGrades }, (_, g) => g + 1).map((g) => (
                      <th key={g} className={TH_R + " font-mono2"}>{g}档</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 27 }, (_, i) => 27 - i).map((L) => {
                    const arr = LEVEL_SALARY[L] ?? [];
                    return (
                      <tr key={L} className={L % 2 === 0 ? "bg-[var(--hov)]" : ""}>
                        <td className="sticky left-0 z-10 px-2.5 py-1 font-mono2 border-r border-[var(--line-2)] whitespace-nowrap text-[var(--acc)] bg-[var(--bg-2)]">{L}级</td>
                        {Array.from({ length: maxGrades }, (_, g) => g).map((g) => {
                          const v = arr[g];
                          return (
                            <td key={g} className={`px-2 py-1 text-right font-mono2 whitespace-nowrap ${v == null ? "" : "text-[var(--tx-1)]"}`}>
                              {v != null ? v.toLocaleString() : ""}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="px-3 pt-2 pb-1.5 text-[10px] text-[var(--tx-3)] leading-relaxed">
                2014 年 10 月调整后级别工资标准（国办发〔2015〕3号），按级别 × 档次排列。
              </p>
            </div>
          )}

          {/* 职务层次表 */}
          {tab === "position" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["职务层次", "对应级别范围", "低一级职务"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {POSITION_LEVELS.map((r, i) => (
                  <tr key={r.rank} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                    <td className="px-3 py-1.5 text-[var(--tx-1)]">{r.rank}</td>
                    <td className="px-3 py-1.5 font-mono2 text-[var(--acc)]">{r.levels}</td>
                    <td className="px-3 py-1.5 text-[var(--tx-2)]">{LOWER_POSITION[r.rank] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
