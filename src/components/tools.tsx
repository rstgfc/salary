import React, { useState } from "react";
import {
  AllowanceItem, Person, Unit, defaultAllowances, fmt, lastOf,
} from "../data";
import { Icon } from "./icons";
import { POLICY_CONFIG } from "../core/calculator";
import {
  CONVERSION_TABLE_2006, LEVEL_SALARY, POSITIONS, POSITION_LEVEL_MAP,
  POSITION_SALARY, LOWER_POSITION, TAOGAO_BANDS, TENURE_ROWS,
} from "../core/salarydata";
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
type CatalogTab = "unit" | "duty" | "rank06" | "rank15" | "taogao" | "position";

const TH = "tbl-head px-2.5 py-1.5 text-left";
const TH_R = "tbl-head px-2 py-1.5 text-right";

export function CatalogModal({ units, persons, onClose }: {
  units: Unit[]; persons: Person[]; onClose: () => void;
}) {
  const [tab, setTab] = useState<CatalogTab>("taogao");
  const [taogaoDuty, setTaogaoDuty] = useState("乡科级正职");
  const tabs: [CatalogTab, string][] = [
    ["unit", "单位目录"], ["duty", "职务工资表"], ["rank06", "级别工资(2006)"],
    ["rank15", "级别工资(2015)"], ["taogao", "套改对照表"], ["position", "职务层次表"],
  ];

  const maxGrades06 = 14;

  return (
    <Modal title="目录数据" icon="catalog" onClose={onClose} w={720}
      footer={<><span className="mr-auto text-[11px] text-[var(--tx-3)]">依据：国办发〔2006〕22号 · 国办发〔2015〕3号 · 仅供测算参考</span><Btn kind="primary" onClick={onClose}>关闭</Btn></>}>
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
          {/* 单位目录 */}
          {tab === "unit" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["单位编号", "单位名称", "人员数"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--line-2)] hover:bg-[var(--hov)]">
                    <td className="px-3 py-2 font-mono2 text-[var(--acc)]">[{u.id}]</td>
                    <td className="px-3 py-2 text-[var(--tx-1)]">{u.name}</td>
                    <td className="px-3 py-2 font-mono2 text-[var(--tx-2)]">{persons.filter((p) => p.unitId === u.id).length} 人</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 职务工资表（2015 标准，领导 / 非领导） */}
          {tab === "duty" && (
            <table className="w-full text-[12px]">
              <thead><tr>
                <th className={TH}>职务层次</th>
                <th className={TH_R}>领导职务（元/月）</th>
                <th className={TH_R}>非领导职务（元/月）</th>
                <th className={TH}>低一级职务</th>
              </tr></thead>
              <tbody>
                {[...POSITIONS].reverse().map((pos, i) => {
                  const s = POSITION_SALARY[pos];
                  return (
                    <tr key={pos} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                      <td className="px-3 py-1.5 text-[var(--tx-1)]">{pos}</td>
                      <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{s?.leader != null ? fmt(s.leader) : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{s?.nonLeader != null ? fmt(s.nonLeader) : "—"}</td>
                      <td className="px-3 py-1.5 text-[var(--tx-2)]">{LOWER_POSITION[pos] ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 级别工资 2006（运算基准，核心模块 SALARY_STANDARD） */}
          {(tab === "rank06" || tab === "rank15") && (
            <div>
              <table className="text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className={`${TH} sticky left-0 z-20`}>级别</th>
                    {Array.from({ length: maxGrades06 }, (_, g) => g + 1).map((g) => (
                      <th key={g} className={TH_R + " font-mono2"}>{g}档</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 27 }, (_, i) => 27 - i).map((L) => {
                    const arr = tab === "rank06" ? (POLICY_CONFIG.SALARY_STANDARD[L] ?? []).slice(1) : (LEVEL_SALARY[L] ?? []);
                    return (
                      <tr key={L} className={L % 2 === 0 ? "bg-[var(--hov)]" : ""}>
                        <td className={`sticky left-0 z-10 px-2.5 py-1 font-mono2 border-r border-[var(--line-2)] whitespace-nowrap ${[16, 18, 25].includes(L) ? "text-[var(--acc)] bg-[var(--head)]" : "text-[var(--acc)] bg-[var(--bg-2)]"}`}>{L}级</td>
                        {Array.from({ length: maxGrades06 }, (_, g) => g).map((g) => {
                          const v = arr[g];
                          const hot = tab === "rank06" && ((L === 18 && v === 976) || (L === 19 && v === 945) || (L === 16 && v === 1213) || (L === 25 && v === 380));
                          return (
                            <td key={g} className={`px-2 py-1 text-right font-mono2 whitespace-nowrap ${v == null ? "" : hot ? "text-[#a26603] dark:text-[#ffd669] font-bold" : "text-[var(--tx-1)]"}`}>
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
                {tab === "rank06"
                  ? "2006 工改基准表（测算引擎运算口径）；加粗项为台账锚点：18级7档=976、19级8档=945、16级8档=1213、25级2档=380。"
                  : "2015 年调整后现行级别工资标准，仅用于对照查阅，不参与 2006 套改运算。"}
              </p>
            </div>
          )}

          {/* 套改对照表 */}
          {tab === "taogao" && (
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <span className="text-[11px] text-[var(--tx-2)]">现任职务</span>
                <select className="field h-7 px-2 text-[12px]" value={taogaoDuty} onChange={(e) => setTaogaoDuty(e.target.value)}>
                  {Object.keys(CONVERSION_TABLE_2006).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="text-[10.5px] text-[var(--tx-3)]">行：任职年限（至2006-07-01）· 列：套改年限（工龄含学习，虚年）→ 级别-档次</span>
              </div>
              <div className="overflow-auto rounded-md border border-[var(--line)]">
                <table className="text-[11px] border-collapse">
                  <thead>
                    <tr>
                      <th className={`${TH} sticky left-0 z-20`}>任职 \ 套改</th>
                      {TAOGAO_BANDS.map((b) => <th key={b} className={TH_R + " font-mono2"}>{b}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TENURE_ROWS.map((tr) => (
                      <tr key={tr} className="odd:bg-[var(--hov)]">
                        <td className="sticky left-0 z-10 px-2.5 py-1.5 font-mono2 text-[var(--acc)] bg-[var(--head)] border-r border-[var(--line-2)] whitespace-nowrap">{tr}年</td>
                        {TAOGAO_BANDS.map((b) => {
                          const cell = CONVERSION_TABLE_2006[taogaoDuty]?.[tr]?.[b];
                          const anchor = cell && `${cell[0]}-${cell[1]}` === "18-7" && taogaoDuty === "乡科级正职" && tr === "1-5" && b === "35-37";
                          return (
                            <td key={b} className={`px-1.5 py-1.5 text-center font-mono2 whitespace-nowrap ${
                              cell
                                ? anchor
                                  ? "text-white bg-[#0a84ff] font-bold"
                                  : "text-[var(--tx-1)] hover:bg-[var(--sel)]"
                                : "text-[var(--tx-3)]"
                            }`}>
                              {cell ? `${cell[0]}-${cell[1]}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-[var(--tx-3)] leading-relaxed">
                蓝底单元格为钱广才（编号1）实际套改坐标：乡科级正职 · 任职1-5年 · 套改35-37年 → <b className="text-[var(--acc)]">18-7</b>，与台账起薪行一致。
                运算引擎使用 calculator.js 内置索引表，二者结构同源、口径以引擎为准。
              </p>
            </div>
          )}

          {/* 职务层次表 */}
          {tab === "position" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["职务层次", "对应级别范围", "低一级职务"].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
              <tbody>
                {[...POSITIONS].reverse().map((pos, i) => {
                  const m = POSITION_LEVEL_MAP[pos];
                  return (
                    <tr key={pos} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                      <td className="px-3 py-1.5 text-[var(--tx-1)]">{pos}</td>
                      <td className="px-3 py-1.5 font-mono2 text-[var(--acc)]">
                        {m.minLevel === m.maxLevel ? `${m.minLevel}级` : `${m.minLevel}级至${m.maxLevel}级`}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--tx-2)]">{LOWER_POSITION[pos] ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
