import React, { useState } from "react";
import {
  AllowanceItem, Person, Unit, defaultAllowances, lastOf,
} from "../data";
import { Icon } from "./icons";
import { POLICY_CONFIG } from "../core/calculator";
import { LOWER_POSITION } from "../core/salarydata";
import { POSITION_LEVELS } from "../data";
import {
  WAGE_ERAS, getDutyStd, getGradeStd, getRankStd, getTibet,
  updateDutyCell, updateGradeCell, updateRankCell, updateTibet,
} from "../core/wageStd";
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
/* 需求4：弹窗内可自行编辑增减津贴的名称和标准 */
export function AllowanceModal({ person, unitName, onClose, onToast }: {
  person: Person; unitName: string; onClose: () => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [items, setItems] = useState<AllowanceItem[]>(() => defaultAllowances(person));
  const [newName, setNewName] = useState("");
  const [newStd, setNewStd] = useState("");
  const last = lastOf(person);
  const total = items.reduce((s, i) => s + (i.std || 0), 0);

  const setItem = (id: string, patch: Partial<AllowanceItem>) =>
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((arr) => arr.filter((i) => i.id !== id));

  const addItem = () => {
    const name = newName.trim();
    if (!name) { onToast("error", "请填写津贴名称"); return; }
    if (items.some((i) => i.name === name)) { onToast("error", `「${name}」已存在`); return; }
    setItems((arr) => [...arr, { id: `custom_${Date.now()}`, name, base: "自定义", std: Math.max(0, Number(newStd) || 0) }]);
    setNewName(""); setNewStd("");
    onToast("success", `已新增津贴项「${name}」`);
  };

  const output = () => {
    let text = `【${person.name}（编号${person.id}）津贴补贴标准表】\n单位：[${person.unitId}] ${unitName}\n`;
    text += `基本工资：职务 ¥${last.pw} + 级别 ¥${last.lw} = ¥${last.pw + last.lw}\n`;
    text += "----------------------------------------\n";
    items.forEach((i) => { text += `${i.name}（${i.base}）\t¥${i.std}\n`; });
    text += "----------------------------------------\n";
    text += `津贴合计\t¥${total}\n`;
    return text;
  };

  const doOutput = async () => {
    try {
      await navigator.clipboard.writeText(output());
      onToast("success", `已输出「${person.name}」津贴标准表到剪贴板（津贴合计 ¥${total}）`);
    } catch {
      onToast("error", "输出失败：剪贴板不可用");
    }
  };

  return (
    <Modal title={`编辑津贴 · ${person.name}`} icon="allowance" onClose={onClose} w={560}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" onClick={doOutput}>输出到剪贴板</Btn></>}>
      <div className="rounded-lg border border-[var(--line)] divide-y divide-[var(--line-2)]">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <input value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })}
                placeholder="津贴名称" className="field h-7 flex-1 min-w-0 px-2 text-[12.5px]" />
              <span className="shrink-0 text-[10px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-3)] whitespace-nowrap">{i.base}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] text-[var(--tx-3)]">¥</span>
              <input type="number" min={0} value={i.std}
                onChange={(e) => setItem(i.id, { std: Math.max(0, Number(e.target.value) || 0) })}
                className="field w-[92px] h-7 px-2 text-right font-mono2 text-[12.5px]" />
            </div>
            <button onClick={() => removeItem(i.id)} title="删除此津贴项"
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[#d70015] dark:hover:text-[#ff8b84] hover:bg-[rgba(255,69,58,.1)] transition">
              <Icon name="trash" size={12} />
            </button>
          </div>
        ))}
        {!items.length && <p className="px-3 py-4 text-center text-[11.5px] text-[var(--tx-3)]">暂无津贴项，请在下方新增</p>}
      </div>

      {/* 需求4：新增津贴项（名称 + 标准） */}
      <div className="mt-3 flex items-center gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新增津贴名称，如：交通补贴"
          className="field h-8 flex-1 min-w-0 px-2.5 text-[12.5px]" />
        <input type="number" min={0} value={newStd} onChange={(e) => setNewStd(e.target.value)} placeholder="标准"
          className="field h-8 w-[100px] px-2 text-right font-mono2 text-[12.5px]" />
        <Btn kind="primary" onClick={addItem}>新增</Btn>
      </div>
    </Modal>
  );
}

/* ================= 工资标准（数据库驱动） ================= */
type CatalogTab = "duty" | "rank" | "tibet" | "position";

const TH = "tbl-head px-2.5 py-1.5 text-left";
const TH_R = "tbl-head px-2 py-1.5 text-right";

export function CatalogModal({ onClose, canEdit = true, onToast }: {
  onClose: () => void; canEdit?: boolean;
  onToast?: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [tab, setTab] = useState<CatalogTab>("duty");
  const [era, setEra] = useState<string>("2014-10");
  const [bump, setBump] = useState(0); // 编辑后强制重读数据库
  const tabs: [CatalogTab, string][] = [
    ["duty", "职务工资表"], ["rank", "级别工资表"], ["tibet", "西藏特殊津贴标准表"], ["position", "职务层次表"],
  ];

  const dutyRows = getDutyStd(era);
  const rankRows = getRankStd(era); // 职级层次（2018/7 起列示于职务层次下方）
  const showRanks = era === "2018-07";
  const gradeRows = getGradeStd(era); // 级别 1 升序 → 27
  const maxGrades = Math.max(1, ...gradeRows.map((g) => g.steps.length));
  const tibetRows = getTibet();

  const eraLabel = (e: string) => e.replace("-", " 年 ") + " 月";

  return (
    <Modal title="工资标准" icon="catalog" onClose={onClose} w={780}
      footer={<><span className="mr-auto text-[11px] text-[var(--tx-3)]">数据存于本地数据库，可直接修改；暂无新数据的期次沿用上一期标准</span><Btn kind="primary" onClick={onClose}>关闭</Btn></>}>
      {/* 调整期次选择 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11.5px] text-[var(--tx-2)]">基本工资标准期次</span>
        <select value={era} onChange={(e) => setEra(e.target.value)} className="field h-7 px-2 text-[12px] font-mono2">
          {WAGE_ERAS.map((e) => <option key={e} value={e}>{eraLabel(e)}</option>)}
        </select>
        <span className="text-[10.5px] text-[var(--tx-3)]">2006/7、2014/10、2018/7、2021/10、2024/7 五次调整</span>
      </div>
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
          {/* 职务工资表（数据库，按职务层次，领导/非领导分列，可编辑） */}
          {tab === "duty" && (
            <div>
              <table className="w-full text-[12px]">
                <thead><tr>
                  <th className={TH}>职务层次</th>
                  <th className={TH_R}>领导职务（元/月）</th>
                  <th className={TH_R}>非领导职务（元/月）</th>
                </tr></thead>
                <tbody>
                  {dutyRows.map((r, i) => (
                    <tr key={r.dutyIndex} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                      <td className="px-3 py-1.5 text-[var(--tx-1)]">{r.label}</td>
                      {(["leader", "nonLeader"] as const).map((f) => (
                        <td key={f} className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            value={r[f] ?? ""}
                            disabled={!canEdit}
                            onChange={(e) => {
                              updateDutyCell(era, r.dutyIndex, f === "leader" ? "leader" : "non_leader", e.target.value === "" ? null : Number(e.target.value));
                              setBump((b) => b + 1);
                              onToast?.("success", `已更新 ${r.label} ${f === "leader" ? "领导" : "非领导"}职务工资`);
                            }}
                            className="w-[76px] h-6 px-1.5 text-right font-mono2 text-[11.5px] rounded border border-[var(--line)] bg-[var(--bg-3)] text-[var(--tx-1)] outline-none focus:border-[rgba(10,132,255,.6)] transition disabled:opacity-50"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {showRanks && (
                    <>
                      {/* 2018/7 起：职务与职级并行，职级层次列于职务层次下方 */}
                      <tr>
                        <td colSpan={3} className="tbl-head px-3 py-1.5 text-[11.5px] font-semibold text-[var(--tx-2)]">职级层次（职级工资标准 · 元/月）</td>
                      </tr>
                      {rankRows.map((r, i) => (
                        <tr key={r.rankIndex} className={`border-b border-[var(--line-2)] ${(dutyRows.length + i) % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                          <td className="px-3 py-1.5 text-[var(--tx-1)]">{r.label}</td>
                          <td colSpan={2} className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              value={r.amount ?? ""}
                              disabled={!canEdit}
                              onChange={(e) => {
                                updateRankCell(era, r.rankIndex, e.target.value === "" ? null : Number(e.target.value));
                                setBump((b) => b + 1);
                                onToast?.("success", `已更新 ${r.label} 职级工资标准`);
                              }}
                              className="w-[76px] h-6 px-1.5 text-right font-mono2 text-[11.5px] rounded border border-[var(--line)] bg-[var(--bg-3)] text-[var(--tx-1)] outline-none focus:border-[rgba(10,132,255,.6)] transition disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
              <p className="px-3 pt-2 pb-1.5 text-[10px] text-[var(--tx-3)] leading-relaxed">
                {eraLabel(era)} 职务工资标准，按职务层次排列{showRanks ? "，职级层次列于职务层次下方" : ""}，可直接修改并存入数据库。
              </p>
            </div>
          )}

          {/* 级别工资表（数据库，级别从一级向下到二十七级，可编辑） */}
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
                  {gradeRows.map(({ lvl, steps }) => (
                    <tr key={lvl} className={lvl % 2 === 0 ? "bg-[var(--hov)]" : ""}>
                      <td className="sticky left-0 z-10 px-2.5 py-1 font-mono2 border-r border-[var(--line-2)] whitespace-nowrap text-[var(--acc)] bg-[var(--bg-2)]">{lvl}级</td>
                      {Array.from({ length: maxGrades }, (_, g) => g).map((g) => {
                        const v = steps[g];
                        return (
                          <td key={g} className="px-1 py-0.5 text-right">
                            {v == null ? (
                              <span className="px-1 text-[var(--tx-3)]">—</span>
                            ) : (
                              <input
                                type="number"
                                defaultValue={v}
                                disabled={!canEdit}
                                onBlur={(e) => {
                                  const nv = Number(e.target.value);
                                  if (!Number.isNaN(nv) && nv !== v) {
                                    updateGradeCell(era, lvl, g + 1, nv);
                                    setBump((b) => b + 1);
                                    onToast?.("success", `已更新 ${lvl}级${g + 1}档 = ${nv}`);
                                  }
                                }}
                                className="w-[58px] h-6 px-1 text-right font-mono2 text-[11px] rounded border border-transparent bg-transparent text-[var(--tx-1)] outline-none hover:border-[var(--line)] focus:border-[rgba(10,132,255,.6)] focus:bg-[var(--bg-3)] transition disabled:opacity-60"
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 pt-2 pb-1.5 text-[10px] text-[var(--tx-3)] leading-relaxed">
                {eraLabel(era)} 级别工资标准，级别从一级向下排至二十七级，修改后自动存入数据库。
              </p>
            </div>
          )}

          {/* 西藏特殊津贴标准表（竖列=职务职级，横列=工资类区） */}
          {tab === "tibet" && (
            <div>
              <table className="w-full text-[12px]">
                <thead><tr>
                  <th className={TH}>职务职级</th>
                  <th className={TH_R}>二类区（元）</th>
                  <th className={TH_R}>三类区（元）</th>
                  <th className={TH_R}>四类区（元）</th>
                </tr></thead>
                <tbody>
                  {tibetRows.map((r, i) => (
                    <tr key={r.dutyLabel} className={`border-b border-[var(--line-2)] ${i % 2 === 1 ? "bg-[var(--hov)]" : ""} hover:bg-[var(--sel)]`}>
                      <td className="px-3 py-1.5 text-[var(--tx-1)]">{r.dutyLabel}</td>
                      {([["zone2", r.zone2], ["zone3", r.zone3], ["zone4", r.zone4]] as const).map(([z, val]) => (
                        <td key={z} className="px-2 py-1.5 text-right">
                          <input
                            type="number"
                            defaultValue={val}
                            disabled={!canEdit}
                            onBlur={(e) => {
                              const nv = Number(e.target.value);
                              if (!Number.isNaN(nv) && nv !== val) {
                                updateTibet(r.dutyLabel, z, nv);
                                setBump((b) => b + 1);
                                onToast?.("success", `已更新 ${r.dutyLabel} ${z === "zone2" ? "二类区" : z === "zone3" ? "三类区" : "四类区"}绝对额 = ${nv}`);
                              }
                            }}
                            className="w-[70px] h-6 px-1.5 text-right font-mono2 text-[11.5px] rounded border border-transparent bg-transparent text-[var(--tx-1)] outline-none hover:border-[var(--line)] focus:border-[rgba(10,132,255,.6)] focus:bg-[var(--bg-3)] transition disabled:opacity-60"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 pt-2 pb-1.5 text-[10px] text-[var(--tx-3)] leading-relaxed">
                西藏特殊津贴标准表（元/月）：竖列为职务职级，横列为二/三/四类区绝对额，可直接修改并存入数据库。倍数另按类区计算：二类区×1.4、三类区×1.7、四类区×2.0（作用于基本工资小计）。
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
