import React, { useEffect, useMemo, useState } from "react";
import { EMPLOY_META, Employ, Person, TAG_META, fmt, fmtLevel } from "../data";
import { Icon, IconName } from "./icons";
import {
  runCalculation, CalcRunInput, CalcRunResult, CalcType, PosChange,
  EDUCATION_OPTIONS, EDUCATION_VALUES, DUTY_OPTIONS, DUTY_VALUES,
  LOWER_DUTY_OPTIONS, LOWER_DUTY_VALUES, POSITION_PICKER_LABELS, POSITION_PICKER_VALUES,
  POLICY_CONFIG, dutyIndexByName, PERSON_CALC_INPUTS, Calculator,
} from "../core/calculator";

/* ---------- 区块标题 ---------- */
function CardHead({ icon, title, extra }: { icon: IconName; title: string; extra?: React.ReactNode }) {
  return (
    <div className="card-head flex items-center gap-2 px-3.5 h-9 rounded-t-[10px] shrink-0">
      <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#0a84ff] to-[#5ac8fa]" />
      <Icon name={icon} size={14} className="text-[var(--acc)]" />
      <span className="text-[12.5px] font-semibold text-[var(--tx-1)] tracking-wide">{title}</span>
      <span className="ml-auto">{extra}</span>
    </div>
  );
}

/* ---------- 工具栏按钮 ---------- */
function ToolBtn({ icon, label, color, active, disabled, onClick }: {
  icon: IconName; label: string; color: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[12px] transition-all active:scale-[.97] disabled:opacity-35 disabled:pointer-events-none ${
        active ? `${color} shadow-[0_2px_8px_rgba(20,60,120,.12)]` : "border-[var(--line)] text-[var(--tx-2)] bg-[var(--bg-2)] hover:bg-[var(--hov)] hover:text-[var(--tx-1)]"
      }`}>
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const saveKey = (id: number) => `gw_calc_v1_${id}`;

/* ---------- 初始化职务变化列表（同 salary.js initPositionList） ---------- */
function buildInitList(type: CalcType, startYear: number, currentDutyIndex: number, currentDutyYear: number, educationIndex: number): PosChange[] {
  if (type === "pre2006") {
    const di = DUTY_VALUES[currentDutyIndex];
    const yr = currentDutyYear || 2002;
    return [{ year: yr + 3, dutyIndex: POLICY_CONFIG.getNextDuty(di), reason: "职务晋升" }];
  }
  const eduVal = EDUCATION_VALUES[educationIndex];
  const ec = POLICY_CONFIG.EDUCATION[eduVal];
  return [{ year: (startYear || 2007) + 1, dutyIndex: ec.probation.dutyIndex, reason: "转正定级", isInitial: true }];
}

/* ---------- 从人员档案推导默认测算参数 ---------- */
function deriveParams(p: Person): CalcRunInput {
  const exist = PERSON_CALC_INPUTS[p.id];
  if (exist) {
    const cdi = DUTY_VALUES.indexOf(exist.currentDuty);
    return {
      type: "pre2006", startYear: exist.startYear, educationIndex: exist.educationIndex,
      deductYears: exist.deductYears, currentDutyIndex: cdi, currentDutyYear: exist.currentDutyYear,
      lowerDutyIndex: LOWER_DUTY_VALUES.indexOf(exist.lowerDuty), lowerDutyYear: exist.lowerDutyYear,
      positionChanges: buildInitList("pre2006", exist.startYear, cdi, exist.currentDutyYear, exist.educationIndex),
      endYear: new Date().getFullYear(),
    };
  }
  const startYear = parseInt(p.join, 10) || 2010;
  const type: CalcType = startYear < 2006 ? "pre2006" : "post2006";
  const dutyName = p.position.replace(/（.*?）/g, "").trim();
  const di = dutyIndexByName(dutyName);
  const cdi = di ? Math.max(0, DUTY_VALUES.indexOf(di)) : 1;
  const eduIdx = p.edu.includes("研究") ? 0 : p.edu.includes("本科") ? 1 : p.edu.includes("专") ? 2 : 3;
  return {
    type, startYear, educationIndex: eduIdx, deductYears: 0,
    currentDutyIndex: cdi, currentDutyYear: startYear < 2006 ? 2002 : startYear + 1,
    lowerDutyIndex: 0, lowerDutyYear: 1999,
    positionChanges: buildInitList(type, startYear, cdi, startYear < 2006 ? 2002 : startYear + 1, eduIdx),
    endYear: new Date().getFullYear(),
  };
}

export function DetailPanel({ person, unitName, canEdit, onTool, onToast }: {
  person: Person;
  unitName: string;
  canEdit: boolean;
  onTool: (a: "query" | Employ) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [params, setParams] = useState<CalcRunInput>(() => deriveParams(person));
  const [results, setResults] = useState<CalcRunResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fromSave, setFromSave] = useState(false);

  /* 挂载时：有存档则载入（需求11），否则自动测算一次用于展示 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(saveKey(person.id));
      if (raw) {
        const saved = JSON.parse(raw);
        setParams(saved.params);
        setResults(saved.results);
        setFromSave(true);
        setSavedAt(saved.savedAt ?? null);
        return;
      }
    } catch { /* ignore */ }
    const p0 = deriveParams(person);
    setParams(p0);
    try { setResults(runCalculation(p0)); } catch { setResults(null); }
    setFromSave(false);
    setSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  const set = (patch: Partial<CalcRunInput>) => setParams((p) => ({ ...p, ...patch }));

  const switchType = (t: CalcType) => {
    setParams((p) => {
      const startYear = t === "pre2006" ? 2004 : 2007;
      return {
        ...p, type: t, startYear,
        positionChanges: buildInitList(t, startYear, p.currentDutyIndex, p.currentDutyYear, p.educationIndex),
      };
    });
  };

  const onCurrentDutyChange = (idx: number) => {
    setParams((p) => {
      const val = DUTY_VALUES[idx];
      const lowerIdx = LOWER_DUTY_VALUES.indexOf(Math.max(0, val - 1));
      return {
        ...p, currentDutyIndex: idx, lowerDutyIndex: lowerIdx >= 0 ? lowerIdx : 0,
        positionChanges: p.type === "pre2006"
          ? buildInitList("pre2006", p.startYear, idx, p.currentDutyYear, p.educationIndex)
          : p.positionChanges,
      };
    });
  };

  const pickerIndex = (dutyIndex: number) => POSITION_PICKER_VALUES.indexOf(dutyIndex);

  /* ---------- 开始测算 + 保存（需求11） ---------- */
  const doCalculate = () => {
    try {
      const r = runCalculation(params);
      setResults(r);
      const at = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      setSavedAt(at);
      setFromSave(true);
      localStorage.setItem(saveKey(person.id), JSON.stringify({ params, results: r, savedAt: at }));
      onToast("success", `已完成「${person.name}」测算并保存（级别 ${r.hero.levelGrade}）`);
    } catch {
      onToast("error", "测算失败，请检查参数");
    }
  };

  const tag = TAG_META[person.tag];
  const emp = EMPLOY_META[person.employ];

  const copyTable = async () => {
    if (!results) return;
    let text = "序号\t起薪时间\t原因\t职务/职级\t级别\t档次\t级别考核起算\t档次考核起算\n";
    results.evolution.forEach((it, i) => {
      text += `${i + 1}\t${it.year}\t${it.reason}\t${it.duty}\t${it.level}级\t${it.grade}档\t${it.levelStartYear}年\t${it.gradeStartYear}年\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast("success", `已复制 ${results.evolution.length} 行演变明细到剪贴板`);
    } catch {
      onToast("error", "复制失败，请手动选择文本");
    }
  };

  const wageNow = useMemo(() => {
    if (!results) return 0;
    return Calculator.getSalary(results.finalLevel, results.finalGrade);
  }, [results]);

  const sel = "field w-full h-8 px-2 text-[12px]";
  const pre = params.type === "pre2006";

  return (
    <div className="anim-panel flex-1 min-h-0 flex flex-col gap-3">
      {/* ================= 工具栏 ================= */}
      <div className="shrink-0 flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono2 text-[12px] px-2 py-1 rounded-md border border-[var(--line)] bg-[var(--bg-2)] text-[var(--acc)]">
            №{String(person.id).padStart(3, "0")}
          </span>
          <h2 className="text-[17px] font-bold text-[var(--tx-1)] tracking-wide truncate">{person.name}</h2>
          {tag && <span className={`text-[10.5px] leading-none px-2 py-[4px] rounded border ${tag.cls}`}>{person.tag}</span>}
          <span className={`flex items-center gap-1.5 text-[10.5px] leading-none px-2 py-[4px] rounded border ${emp.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: emp.dot }} />
            {person.employ}
          </span>
          <span className="font-mono2 text-[11px] text-[var(--tx-3)] truncate hidden md:inline">[{person.unitId}] {unitName}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0 flex-wrap">
          <ToolBtn icon="search" label="查询" color="" onClick={() => onTool("query")} />
          <span className="w-px h-4 bg-[var(--line)] mx-0.5" />
          <ToolBtn icon="on" label="在职" color="border-[rgba(48,209,88,.55)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.12)]"
            active={person.employ === "在职"} disabled={!canEdit} onClick={() => onTool("在职")} />
          <ToolBtn icon="retire" label="退休" color="border-[rgba(255,159,10,.55)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.12)]"
            active={person.employ === "退休"} disabled={!canEdit} onClick={() => onTool("退休")} />
          <ToolBtn icon="stop" label="止薪" color="border-[rgba(255,69,58,.55)] text-[#d70015] dark:text-[#ff8b84] bg-[rgba(255,69,58,.1)]"
            active={person.employ === "止薪"} disabled={!canEdit} onClick={() => onTool("止薪")} />
        </div>
      </div>

      {/* ================= 上部：三栏（中栏=职务变化+开始测算+截止时间，需求4） ================= */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_minmax(0,1.1fr)] xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1.15fr)] gap-3 items-start">
        {/* -------- 左：人员基本信息（需求5/6） -------- */}
        <div className="card-panel overflow-hidden">
          <CardHead icon="user" title="人员基本信息"
            extra={<span className="font-mono2 text-[10px] text-[var(--tx-3)]">ID {String(person.id).padStart(4, "0")}</span>} />
          <div className="p-3 flex flex-col gap-3">
            {/* 需求6：类型切换置顶 */}
            <div className="seg w-full">
              <button className={`seg-item flex-1 justify-center ${pre ? "active" : ""}`} onClick={() => switchType("pre2006")}>
                2006年前参公（套改）
              </button>
              <button className={`seg-item flex-1 justify-center ${!pre ? "active" : ""}`} onClick={() => switchType("post2006")}>
                2006年后参公
              </button>
            </div>

            {/* 需求5：两行精简信息 */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-2">
              {[
                ["姓名", person.name], ["性别", person.gender], ["出生年月", person.birth],
                ["身份", person.identity], ["职务", person.position.replace(/（.*?）/g, "")],
              ].map(([k, v]) => (
                <div key={k as string} className="min-w-0">
                  <p className="text-[10px] text-[var(--tx-3)]">{k}</p>
                  <p className={`text-[12.5px] text-[var(--tx-1)] truncate ${k === "姓名" ? "font-semibold" : ""}`}>{v}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-[var(--line)] pt-2.5">
              <p className="text-[10.5px] font-semibold text-[var(--acc)] mb-2 flex items-center gap-1">
                <Icon name="sum" size={11} />测算参数
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[10px] text-[var(--tx-3)]">参工年份
                  <select className={sel + " font-mono2 mt-0.5"} value={params.startYear}
                    onChange={(e) => set({ startYear: Number(e.target.value) })} disabled={!canEdit}>
                    {years(1950, 2020).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-[var(--tx-3)]">学历
                  <select className={sel + " mt-0.5"} value={params.educationIndex}
                    onChange={(e) => set({ educationIndex: Number(e.target.value) })} disabled={!canEdit}>
                    {EDUCATION_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-[var(--tx-3)] col-span-2">考核扣除年限
                  <input type="number" min={0} className={sel + " font-mono2 mt-0.5"} value={params.deductYears}
                    onChange={(e) => set({ deductYears: Math.max(0, Number(e.target.value) || 0) })} disabled={!canEdit} />
                </label>
                {pre && (
                  <>
                    <label className="block text-[10px] text-[var(--tx-3)]">2006时任职务
                      <select className={sel + " mt-0.5"} value={params.currentDutyIndex}
                        onChange={(e) => onCurrentDutyChange(Number(e.target.value))} disabled={!canEdit}>
                        {DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block text-[10px] text-[var(--tx-3)]">任职时间
                      <select className={sel + " font-mono2 mt-0.5"} value={params.currentDutyYear}
                        onChange={(e) => set({ currentDutyYear: Number(e.target.value) })} disabled={!canEdit}>
                        {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                      </select>
                    </label>
                    <label className="block text-[10px] text-[var(--tx-3)]">低一职务
                      <select className={sel + " mt-0.5"} value={params.lowerDutyIndex}
                        onChange={(e) => set({ lowerDutyIndex: Number(e.target.value) })} disabled={!canEdit}>
                        {LOWER_DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block text-[10px] text-[var(--tx-3)]">任职时间
                      <select className={sel + " font-mono2 mt-0.5"} value={params.lowerDutyYear}
                        onChange={(e) => set({ lowerDutyYear: Number(e.target.value) })} disabled={!canEdit}>
                        {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* -------- 中：职务变化 + 测算（需求4） -------- */}
        <div className="card-panel overflow-hidden flex flex-col">
          <CardHead icon="rolling" title="职务变化情况"
            extra={<span className="font-mono2 text-[10px] px-1.5 py-px rounded-full bg-[rgba(48,209,88,.1)] border border-[rgba(48,209,88,.35)] text-[#1f8f4d] dark:text-[#7ede99]">{params.positionChanges.length} 条</span>} />
          <div className="p-3 flex-1 flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              {params.positionChanges.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold text-white" style={{ animation: "none" }}>
                    {idx + 1}
                  </span>
                  <select className="field h-8 w-[92px] shrink-0 px-2 text-[12px] font-mono2" value={item.year}
                    onChange={(e) => setParams((p) => ({ ...p, positionChanges: p.positionChanges.map((r, i) => i === idx ? { ...r, year: Number(e.target.value) } : r) }))}
                    disabled={!canEdit}>
                    {years(1950, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={pickerIndex(item.dutyIndex)}
                    onChange={(e) => setParams((p) => ({ ...p, positionChanges: p.positionChanges.map((r, i) => i === idx ? { ...r, dutyIndex: POSITION_PICKER_VALUES[Number(e.target.value)] } : r) }))}
                    disabled={!canEdit}>
                    {POSITION_PICKER_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                  <button title="删除此行" disabled={!canEdit}
                    onClick={() => setParams((p) => ({ ...p, positionChanges: p.positionChanges.filter((_, i) => i !== idx) }))}
                    className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95 disabled:opacity-35">
                    删除
                  </button>
                </div>
              ))}
              <button disabled={!canEdit}
                onClick={() => setParams((p) => {
                  const l = p.positionChanges[p.positionChanges.length - 1];
                  return { ...p, positionChanges: [...p.positionChanges, { year: (l?.year ?? 2006) + 3, dutyIndex: POLICY_CONFIG.getNextDuty(l?.dutyIndex ?? 1), reason: "职务晋升" }] };
                })}
                className="h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition active:scale-[.99] flex items-center justify-center gap-1 disabled:opacity-35">
                <Icon name="plus" size={12} />新增职务变化
              </button>
            </div>

            <div className="mt-auto pt-2.5 border-t border-dashed border-[var(--line)] flex items-center gap-2.5">
              <button onClick={doCalculate} disabled={!canEdit}
                className="flex-1 h-9 rounded-lg hero-grad text-[13px] font-semibold text-white tracking-wide shadow-[0_6px_18px_rgba(10,132,255,.3)] transition-all hover:brightness-110 active:scale-[.98] flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:pointer-events-none"
                style={{ animation: "none" }}>
                <Icon name="bolt" size={14} />开始测算
              </button>
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--tx-2)] shrink-0">
                截止
                <select className="field h-8 w-[88px] px-2 text-[12px] font-mono2" value={params.endYear}
                  onChange={(e) => set({ endYear: Number(e.target.value) })} disabled={!canEdit}>
                  {years(2024, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
              </div>
            </div>

            {/* 保存状态（需求11） */}
            <div className="text-[10.5px] flex items-center gap-1.5">
              {fromSave && savedAt ? (
                <span className="text-[#1f8f4d] dark:text-[#7ede99] flex items-center gap-1"><Icon name="check" size={11} />已保存测算结果 · {savedAt}，下次进入自动载入</span>
              ) : fromSave ? (
                <span className="text-[#1f8f4d] dark:text-[#7ede99] flex items-center gap-1"><Icon name="check" size={11} />已载入保存的测算结果</span>
              ) : (
                <span className="text-[var(--tx-3)] flex items-center gap-1"><Icon name="info" size={11} />自动测算预览 · 点击「开始测算」保存</span>
              )}
            </div>
          </div>
        </div>

        {/* -------- 右：套改明细（需求8/10） -------- */}
        <div className="card-panel overflow-hidden">
          <CardHead icon="sum" title="套改明细（2006 工资套改）"
            extra={results && (
              <span className="text-[10px] px-2 py-[3px] rounded border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)] text-[#1f8f4d] dark:text-[#7ede99]">
                当前套改类型：{results.curTypeLabel}
              </span>
            )} />
          <div className="p-3 flex flex-col gap-2.5">
            {/* 结果摘要 */}
            {results && (
              <div className="hero-grad rounded-lg px-3 py-2.5 text-white" style={{ animation: "none" }}>
                <p className="text-[9.5px] tracking-[2px] opacity-85">{results.hero.title}</p>
                <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
                  <span className="text-[15px] font-bold font-mono2">{results.hero.levelGrade}</span>
                  <span className="text-[11px] opacity-90">{results.hero.duty}</span>
                  {wageNow > 0 && (
                    <span className="font-mono2 text-[10.5px] px-1.5 py-0.5 rounded bg-white/18 border border-white/25">级别工资 ¥{wageNow.toLocaleString()}/月</span>
                  )}
                </div>
              </div>
            )}

            {/* 需求10：套改明细对比表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px] border-collapse min-w-[420px]">
                <thead>
                  <tr>
                    <th className="tbl-head px-2 py-1.5 text-left">套改方式</th>
                    <th className="tbl-head px-2 py-1.5 text-right">套改年限</th>
                    <th className="tbl-head px-2 py-1.5 text-right">任职年限</th>
                    <th className="tbl-head px-2 py-1.5 text-right">结果</th>
                    <th className="tbl-head px-2 py-1.5 text-center w-[44px]">采纳</th>
                  </tr>
                </thead>
                <tbody>
                  {(results?.compare ?? []).map((r, i) => (
                    <tr key={r.method} className={`border-b border-[var(--line-2)] ${r.isBest ? "bg-[var(--sel)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""}`}>
                      <td className={`px-2 py-1.5 ${r.isBest ? "font-semibold text-[var(--acc)]" : "text-[var(--tx-1)]"}`}>
                        {r.method}
                        <span className="ml-1.5 text-[10px] text-[var(--tx-3)]">{r.duty}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-2)]">{r.years}</td>
                      <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-2)]">{r.tenure}</td>
                      <td className="px-2 py-1.5 text-right font-mono2 font-semibold text-[var(--tx-1)]">{r.level}-{r.grade}</td>
                      <td className={`px-2 py-1.5 text-center font-bold ${r.isBest ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[var(--tx-3)]"}`}>
                        {r.isBest ? "✓" : "-"}
                      </td>
                    </tr>
                  ))}
                  {!results && (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--tx-3)] text-[11px]">点击「开始测算」生成对比结果</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 需求8：参工时间（备注含大专以上未计工龄） */}
            <div className="flex items-baseline gap-3 rounded-md bg-[var(--hov)] px-2.5 py-2">
              <span className="w-[64px] shrink-0 text-[11px] text-[var(--tx-2)]">参工时间</span>
              <span className="font-mono2 text-[12.5px] font-semibold text-[var(--tx-1)] shrink-0">{person.join}</span>
              <span className="text-[10.5px] text-[var(--tx-3)] leading-snug">
                工龄间断 {person.gap} 年，{person.unq}，大专以上未计工龄学习 {person.studyYears} 年
                {results && <>，套改年限 <b className="font-mono2 text-[var(--tx-2)]">{results.taogaoYears}</b> 年</>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 下部：工资演变明细（需求9） ================= */}
      <div className="flex-1 min-h-0 flex flex-col card-panel overflow-hidden">
        <CardHead icon="grid" title="工资演变明细"
          extra={
            <span className="flex items-center gap-2">
              <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-2)]">
                {results?.evolution.length ?? 0} 行
              </span>
              <button onClick={copyTable} disabled={!results}
                className="flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(90,200,250,.55)] text-[#0a6cd6] dark:text-[#93d9fb] text-[11px] hover:bg-[rgba(90,200,250,.12)] transition active:scale-95 disabled:opacity-35">
                <Icon name="copy" size={11} />复制
              </button>
            </span>
          } />
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[11.5px] border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="tbl-head px-2 py-1.5 text-right w-[44px]">序号</th>
                <th className="tbl-head px-2 py-1.5 text-left">起薪时间</th>
                <th className="tbl-head px-2 py-1.5 text-left">原因</th>
                <th className="tbl-head px-2 py-1.5 text-left">职务/职级</th>
                <th className="tbl-head px-2 py-1.5 text-right">级别</th>
                <th className="tbl-head px-2 py-1.5 text-right">档次</th>
                <th className="tbl-head px-2 py-1.5 text-right">级别起算</th>
                <th className="tbl-head px-2 py-1.5 text-right">档次起算</th>
              </tr>
            </thead>
            <tbody>
              {(results?.evolution ?? []).map((item, i) => {
                const isLast = i === (results?.evolution.length ?? 0) - 1;
                return (
                  <tr key={i} className={`border-b border-[var(--line-2)] ${isLast ? "bg-[var(--sel)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""}`}>
                    <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-3)] relative">
                      {isLast && <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[var(--acc)]" />}
                      {i + 1}
                    </td>
                    <td className="px-2 py-1 font-mono2 text-[#0a6cd6] dark:text-[#a9c4e6] whitespace-nowrap">{item.year}</td>
                    <td className={`px-2 py-1 whitespace-nowrap ${isLast ? "font-medium text-[var(--tx-1)]" : "text-[var(--tx-1)]"}`}>{item.reason}</td>
                    <td className="px-2 py-1 text-[var(--tx-1)] whitespace-nowrap">{item.duty}</td>
                    <td className="px-2 py-1 text-right font-mono2 text-[#0a6cd6] dark:text-[#8ed6fa]">{item.level}</td>
                    <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-1)]">{item.grade}</td>
                    <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-2)]">{item.levelStartYear}年</td>
                    <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-2)]">{item.gradeStartYear}年</td>
                  </tr>
                );
              })}
              {!results && (
                <tr><td colSpan={8} className="px-3 py-10 text-center text-[var(--tx-3)]">
                  <Icon name="grid" size={20} className="mx-auto mb-2 opacity-50" />点击「开始测算」生成工资演变明细
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {results && (
          <div className="shrink-0 h-8 px-3.5 flex items-center gap-4 border-t border-[var(--line)] bg-[var(--head)] text-[11px] text-[var(--tx-2)]">
            <span>当前级别档次</span>
            <span className="font-mono2 text-[13px] font-semibold text-[var(--acc)]">{fmtLevel(results.hero.levelGrade)}</span>
            <span className="font-mono2 text-[var(--tx-1)]">级别工资 ¥{fmt(wageNow)}</span>
            <span className="ml-auto flex items-center gap-1 text-[var(--tx-3)]">
              <Icon name="clock" size={11} />数据源：测算引擎 calculator.js
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
