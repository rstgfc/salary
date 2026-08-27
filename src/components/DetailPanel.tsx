import React, { useEffect, useMemo, useState } from "react";
import { EMPLOY_META, Employ, Person, TAG_META, fmt, fmtLevel } from "../data";
import { Icon, IconName } from "./icons";
import {
  Calculator, POLICY_CONFIG,
  EDUCATION_OPTIONS, EDUCATION_VALUES,
  DUTY_OPTIONS, DUTY_VALUES, LOWER_DUTY_OPTIONS, LOWER_DUTY_VALUES,
  POSITION_PICKER_LABELS, POSITION_PICKER_VALUES,
  PERSON_CALC_INPUTS,
  runCalculation,
} from "../core/calculator";
import type { CalcType, CalcRunResult, PosChange } from "../core/calculator";

const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/* ---------------- 区块标题 ---------------- */
function CardHead({ icon, title, extra }: { icon: IconName; title: string; extra?: React.ReactNode }) {
  return (
    <div className="card-head flex items-center gap-2 px-3.5 h-9 rounded-t-[10px]">
      <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#0a84ff] to-[#5ac8fa]" />
      <Icon name={icon} size={14} className="text-[var(--acc)]" />
      <span className="text-[12.5px] font-semibold text-[var(--tx-1)] tracking-wide">{title}</span>
      <span className="ml-auto">{extra}</span>
    </div>
  );
}

/* ---------------- 工具栏按钮 ---------------- */
function ToolBtn({ icon, label, color, active, onClick, disabled }: {
  icon: IconName; label: string; color: string; active?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[12px] transition-all active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none ${
        active ? `${color} shadow-[0_2px_8px_rgba(20,60,120,.12)]` : "border-[var(--line)] text-[var(--tx-2)] bg-[var(--bg-2)] hover:bg-[var(--hov)] hover:text-[var(--tx-1)]"
      }`}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10.5px] text-[var(--tx-3)] mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ---------------- 内部测算状态 ---------------- */
interface CalcState {
  type: CalcType;
  startYear: number;
  educationIndex: number;
  deductYears: number;
  currentDutyIndex: number;
  currentDutyYear: number;
  lowerDutyIndex: number;
  lowerDutyYear: number;
  positionChanges: PosChange[];
  endYear: number;
}

function buildInitList(type: CalcType, sy: number, cdi: number, cdy: number, eduIdx: number): PosChange[] {
  if (type === "pre2006") {
    const di = DUTY_VALUES[cdi];
    return [{ year: (cdy || 2002) + 3, dutyIndex: POLICY_CONFIG.getNextDuty(di), reason: "职务晋升" }];
  }
  const ec = POLICY_CONFIG.EDUCATION[EDUCATION_VALUES[eduIdx]];
  return [{ year: (sy || 2007) + 1, dutyIndex: ec.probation.dutyIndex, reason: "转正定级", isInitial: true }];
}

function stateFromPerson(p: Person): CalcState {
  const NOW = new Date().getFullYear();
  const base = PERSON_CALC_INPUTS[p.id];
  if (base) {
    const type: CalcType = base.startYear < 2006 ? "pre2006" : "post2006";
    const cdi = DUTY_VALUES.indexOf(base.currentDuty);
    return {
      type,
      startYear: base.startYear,
      educationIndex: base.educationIndex,
      deductYears: base.deductYears,
      currentDutyIndex: cdi >= 0 ? cdi : 1,
      currentDutyYear: base.currentDutyYear,
      lowerDutyIndex: Math.max(0, LOWER_DUTY_VALUES.indexOf(base.lowerDuty)),
      lowerDutyYear: base.lowerDutyYear,
      positionChanges: buildInitList(type, base.startYear, cdi >= 0 ? cdi : 1, base.currentDutyYear, base.educationIndex),
      endYear: NOW,
    };
  }
  return {
    type: "pre2006",
    startYear: parseInt(p.join, 10) || 2004,
    educationIndex: 1,
    deductYears: 0,
    currentDutyIndex: 1,
    currentDutyYear: 2002,
    lowerDutyIndex: 0,
    lowerDutyYear: 1999,
    positionChanges: buildInitList("pre2006", parseInt(p.join, 10) || 2004, 1, 2002, 1),
    endYear: NOW,
  };
}

const saveKey = (id: number) => `gw_salary_calc_${id}`;

/* ---------------- 主面板 ---------------- */
export function DetailPanel({ person, unitName, canEdit, onTool, onToast }: {
  person: Person | null;
  unitName: string;
  canEdit: boolean;
  onTool: (a: "query" | Employ) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [st, setSt] = useState<CalcState | null>(null);
  const [result, setResult] = useState<CalcRunResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /* 载入：优先本地已保存的测算结果（需求11），否则由档案参数初始化 */
  useEffect(() => {
    if (!person) { setSt(null); setResult(null); setSavedAt(null); return; }
    try {
      const raw = localStorage.getItem(saveKey(person.id));
      if (raw) {
        const saved = JSON.parse(raw);
        setSt(saved.inputs as CalcState);
        setResult(saved.result as CalcRunResult);
        setSavedAt(saved.at ?? null);
        return;
      }
    } catch { /* 忽略损坏数据 */ }
    const init = stateFromPerson(person);
    setSt(init);
    if (PERSON_CALC_INPUTS[person.id]) {
      const res = runCalculation(init);
      setResult(res);
      const at = new Date().toLocaleString("zh-CN");
      try { localStorage.setItem(saveKey(person.id), JSON.stringify({ inputs: init, result: res, at })); } catch { /* noop */ }
      setSavedAt(at);
    } else {
      setResult(null);
      setSavedAt(null);
    }
  }, [person?.id]);

  if (!person || !st) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-2xl border border-dashed border-[var(--line)] flex items-center justify-center">
          <Icon name="user" size={26} className="text-[var(--tx-3)]" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-[var(--tx-2)]">人员列表为空</p>
        <p className="mt-1.5 text-[12px] text-[var(--tx-3)] max-w-[340px] leading-relaxed">
          可通过顶部「人员」按钮新增，或经微信小程序后台同步人员数据。
        </p>
      </div>
    );
  }

  const p = person;
  const tag = TAG_META[p.tag];
  const emp = EMPLOY_META[p.employ];

  const patch = (part: Partial<CalcState>) => setSt((s) => (s ? { ...s, ...part } : s));

  const switchType = (t: CalcType) => {
    const sy = t === "pre2006" ? 2004 : 2007;
    setSt((s) => s ? {
      ...s, type: t, startYear: sy,
      positionChanges: buildInitList(t, sy, s.currentDutyIndex, s.currentDutyYear, s.educationIndex),
    } : s);
  };

  const onCurrentDutyChange = (idx: number) => {
    const val = DUTY_VALUES[idx];
    const lowerIdx = Math.max(0, LOWER_DUTY_VALUES.indexOf(Math.max(0, val - 1)));
    setSt((s) => s ? {
      ...s, currentDutyIndex: idx, lowerDutyIndex: lowerIdx,
      positionChanges: s.type === "pre2006" ? buildInitList("pre2006", s.startYear, idx, s.currentDutyYear, s.educationIndex) : s.positionChanges,
    } : s);
  };

  const addRow = () => setSt((s) => {
    if (!s || !s.positionChanges.length) return s;
    const last = s.positionChanges[s.positionChanges.length - 1];
    return { ...s, positionChanges: [...s.positionChanges, { year: last.year + 3, dutyIndex: POLICY_CONFIG.getNextDuty(last.dutyIndex), reason: "职务晋升" }] };
  });
  const delRow = (idx: number) => setSt((s) => s ? { ...s, positionChanges: s.positionChanges.filter((_, i) => i !== idx) } : s);
  const updRow = (idx: number, part: Partial<PosChange>) => setSt((s) => s ? { ...s, positionChanges: s.positionChanges.map((r, i) => (i === idx ? { ...r, ...part } : r)) } : s);

  /* 开始测算：计算并保存（需求11） */
  const doCalc = () => {
    const res = runCalculation(st);
    setResult(res);
    const at = new Date().toLocaleString("zh-CN");
    try { localStorage.setItem(saveKey(p.id), JSON.stringify({ inputs: st, result: res, at })); } catch { /* noop */ }
    setSavedAt(at);
    onToast("success", `「${p.name}」测算完成并已保存，下次进入自动载入`);
  };

  const copyTable = async () => {
    if (!result) return;
    let text = "序号\t起薪时间\t原因\t职务/职级\t级别\t档次\t级别考核起算\t档次考核起算\n";
    result.evolution.forEach((item, i) => {
      text += `${i + 1}\t${item.year}\t${item.reason}\t${item.duty}\t${item.level}级\t${item.grade}档\t${item.levelStartYear}年\t${item.gradeStartYear}年\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast("success", `已复制 ${result.evolution.length} 行演变明细`);
    } catch {
      onToast("error", "复制失败，请手动选择文本");
    }
  };

  /* 套改明细备注（需求8：大专以上未计工龄的套改年限并入参工时间备注） */
  const dutyLabel = DUTY_OPTIONS[st.currentDutyIndex];
  const lowerLabel = st.lowerDutyIndex > 0 ? LOWER_DUTY_OPTIONS[st.lowerDutyIndex] : "无";
  const lowerTenure = st.lowerDutyIndex > 0 ? 2006 - st.lowerDutyYear : 0;
  const eduSettle = EDUCATION_VALUES[st.educationIndex];
  const joinNote = `工龄间断 ${p.gap} 年，${p.unq}，套改年限 ${result?.taogaoYears ?? p.tYears} 年` +
    (eduSettle > 0 ? `，大专以上未计工龄的套改年限 ${eduSettle} 年` : "");

  const methodNote = (method: string): string => {
    if (method.includes("现职")) return `时任职务：${dutyLabel}，时间${st.currentDutyYear}年，间断${st.deductYears}年，任职年限${result?.tenureYears ?? 0}年，退休费提高比例0%`;
    if (method.includes("低")) return `低一职务：${lowerLabel}，时间${st.lowerDutyYear}年，间断${st.deductYears}年，任职年限${lowerTenure}年`;
    return "—";
  };

  const curType = useMemo(() => {
    if (!result) return "待测算";
    const b = result.compare.find((c) => c.isBest);
    if (!b) return "—";
    if (b.method.includes("现职")) return "按现职级套改";
    if (b.method.includes("低")) return "按低职级套改";
    if (b.method.includes("学历")) return "按学历套改";
    return b.method;
  }, [result]);

  const selCls = "field w-full h-8 px-2 text-[12px]";
  const readOnly = !canEdit;

  return (
    <div key={p.id} className="anim-panel flex-1 min-h-0 flex flex-col gap-3">
      {/* 工具栏 */}
      <div className="shrink-0 flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono2 text-[12px] px-2 py-1 rounded-md border border-[var(--line)] bg-[var(--bg-2)] text-[var(--acc)]">
            №{String(p.id).padStart(3, "0")}
          </span>
          <h2 className="text-[17px] font-bold text-[var(--tx-1)] tracking-wide truncate">{p.name}</h2>
          {tag && <span className={`text-[10.5px] leading-none px-2 py-[4px] rounded border ${tag.cls}`}>{p.tag}</span>}
          <span className={`flex items-center gap-1.5 text-[10.5px] leading-none px-2 py-[4px] rounded border ${emp.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: emp.dot }} />
            {p.employ}
          </span>
          <span className="font-mono2 text-[11px] text-[var(--tx-3)] truncate hidden md:inline">[{p.unitId}] {unitName}</span>
          {savedAt && (
            <span className="text-[10px] text-[var(--tx-3)] hidden lg:inline flex items-center gap-1">
              <Icon name="check" size={10} className="text-[#1f8f4d] dark:text-[#7ede99]" />已保存 {savedAt}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0 flex-wrap">
          <ToolBtn icon="search" label="查询" color="" onClick={() => onTool("query")} />
          <span className="w-px h-4 bg-[var(--line)] mx-0.5" />
          <ToolBtn icon="on" label="在职" color="border-[rgba(48,209,88,.55)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.12)]"
            active={p.employ === "在职"} disabled={readOnly} onClick={() => onTool("在职")} />
          <ToolBtn icon="retire" label="退休" color="border-[rgba(255,159,10,.55)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.12)]"
            active={p.employ === "退休"} disabled={readOnly} onClick={() => onTool("退休")} />
          <ToolBtn icon="stop" label="止薪" color="border-[rgba(255,69,58,.55)] text-[#d70015] dark:text-[#ff8b84] bg-[rgba(255,69,58,.1)]"
            active={p.employ === "止薪"} disabled={readOnly} onClick={() => onTool("止薪")} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-3">
        {/* ===== 人员基本信息 + 测算参数（需求5/6） ===== */}
        <div className="shrink-0 card-panel overflow-hidden">
          <CardHead icon="user" title="人员基本信息"
            extra={<span className="font-mono2 text-[10.5px] text-[var(--tx-3)]">ID {String(p.id).padStart(4, "0")}</span>} />
          <div className="p-3.5">
            {/* 2006 前/后切换（需求6：置于基本信息框最上方） */}
            <div className="seg mb-3">
              <button className={`seg-item ${st.type === "pre2006" ? "active" : ""}`} disabled={readOnly} onClick={() => switchType("pre2006")}>
                2006年前参公（套改）
              </button>
              <button className={`seg-item ${st.type === "post2006" ? "active" : ""}`} disabled={readOnly} onClick={() => switchType("post2006")}>
                2006年后参公
              </button>
            </div>

            {/* 两行紧凑信息（需求5） */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 mb-3 pb-3 border-b border-[var(--line-2)]">
              <div className="flex items-baseline gap-2"><span className="text-[11px] text-[var(--tx-3)] w-14 shrink-0">姓名</span><b className="text-[13px] text-[var(--tx-1)]">{p.name}</b></div>
              <div className="flex items-baseline gap-2"><span className="text-[11px] text-[var(--tx-3)] w-14 shrink-0">性别</span><span className="text-[12.5px] text-[var(--tx-1)]">{p.gender}</span></div>
              <div className="flex items-baseline gap-2"><span className="text-[11px] text-[var(--tx-3)] w-14 shrink-0">出生年月</span><span className="text-[12.5px] font-mono2 text-[var(--tx-1)]">{p.birth}</span></div>
              <div className="flex items-baseline gap-2"><span className="text-[11px] text-[var(--tx-3)] w-14 shrink-0">身份</span><span className="text-[12.5px] text-[var(--tx-1)]">{p.identity}</span></div>
              <div className="flex items-baseline gap-2 col-span-2"><span className="text-[11px] text-[var(--tx-3)] w-14 shrink-0">职务</span><span className="text-[12.5px] text-[var(--tx-1)]">{p.position}</span></div>
            </div>

            {/* 测算基本信息（需求5：原套改测算页基本信息置于下方） */}
            <div className="grid grid-cols-[92px_1fr_104px] gap-2.5">
              <Field label="参工年份">
                <select className={selCls + " font-mono2"} value={st.startYear} disabled={readOnly}
                  onChange={(e) => patch({ startYear: Number(e.target.value), positionChanges: buildInitList(st.type, Number(e.target.value), st.currentDutyIndex, st.currentDutyYear, st.educationIndex) })}>
                  {years(1950, 2020).map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
              </Field>
              <Field label="学历">
                <select className={selCls} value={st.educationIndex} disabled={readOnly}
                  onChange={(e) => patch({ educationIndex: Number(e.target.value) })}>
                  {EDUCATION_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                </select>
              </Field>
              <Field label="考核扣除年限">
                <input type="number" min={0} className={selCls + " font-mono2"} value={st.deductYears} disabled={readOnly}
                  onChange={(e) => patch({ deductYears: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>

            {st.type === "pre2006" && (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Field label="2006时任职务">
                  <select className={selCls} value={st.currentDutyIndex} disabled={readOnly}
                    onChange={(e) => onCurrentDutyChange(Number(e.target.value))}>
                    {DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                  </select>
                </Field>
                <Field label="任职时间">
                  <select className={selCls + " font-mono2"} value={st.currentDutyYear} disabled={readOnly}
                    onChange={(e) => patch({ currentDutyYear: Number(e.target.value), positionChanges: buildInitList("pre2006", st.startYear, st.currentDutyIndex, Number(e.target.value), st.educationIndex) })}>
                    {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </Field>
                <Field label="低一职务">
                  <select className={selCls} value={st.lowerDutyIndex} disabled={readOnly}
                    onChange={(e) => patch({ lowerDutyIndex: Number(e.target.value) })}>
                    {LOWER_DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                  </select>
                </Field>
                <Field label="任职时间">
                  <select className={selCls + " font-mono2"} value={st.lowerDutyYear} disabled={readOnly}
                    onChange={(e) => patch({ lowerDutyYear: Number(e.target.value) })}>
                    {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* ===== 职务变化情况 + 测算（需求4） ===== */}
        <div className="shrink-0 card-panel overflow-hidden">
          <CardHead icon="grid" title="职务变化情况"
            extra={<span className="font-mono2 text-[10.5px] px-1.5 py-px rounded-full bg-[rgba(48,209,88,.12)] border border-[rgba(48,209,88,.4)] text-[#1f8f4d] dark:text-[#7ede99]">{st.positionChanges.length} 条</span>} />
          <div className="p-3.5">
            <div className="flex flex-col gap-2">
              {st.positionChanges.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold text-white" style={{ animation: "none" }}>
                    {idx + 1}
                  </span>
                  <select className="field h-8 w-[96px] shrink-0 px-2 text-[12px] font-mono2" value={item.year} disabled={readOnly}
                    onChange={(e) => updRow(idx, { year: Number(e.target.value) })}>
                    {years(1950, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={POSITION_PICKER_VALUES.indexOf(item.dutyIndex)} disabled={readOnly}
                    onChange={(e) => updRow(idx, { dutyIndex: POSITION_PICKER_VALUES[Number(e.target.value)] })}>
                    {POSITION_PICKER_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                  <button onClick={() => delRow(idx)} disabled={readOnly}
                    className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95 disabled:opacity-40">
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addRow} disabled={readOnly}
                className="mt-1 h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition flex items-center justify-center gap-1 disabled:opacity-40">
                <Icon name="plus" size={12} />新增职务变化
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-[var(--line-2)] flex items-center justify-center gap-3">
              <button onClick={doCalc} disabled={readOnly}
                className="flex-[2] h-9 rounded-lg hero-grad text-[13px] font-semibold tracking-wide text-white shadow-[0_6px_18px_rgba(10,132,255,.35)] hover:brightness-110 active:scale-[.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-40" style={{ animation: "none" }}>
                <Icon name="bolt" size={14} />开始测算
              </button>
              <div className="flex items-center gap-1.5 text-[12px] text-[var(--tx-2)]">
                截止
                <select className="field h-8 w-[92px] px-2 text-[12px] font-mono2" value={st.endYear} disabled={readOnly}
                  onChange={(e) => patch({ endYear: Number(e.target.value) })}>
                  {years(2024, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
              </div>
            </div>
            {readOnly && <p className="mt-2 text-center text-[10.5px] text-[var(--tx-3)]">当前为仅查看权限，测算与编辑功能不可用</p>}
          </div>
        </div>

        {/* ===== 套改明细（需求10：套改明细对比结论，格式不变；需求8） ===== */}
        <div className="shrink-0 card-panel overflow-hidden">
          <CardHead icon="sum" title="套改明细（2006 工资套改）"
            extra={<span className="text-[10.5px] px-2 py-[3px] rounded border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)] text-[#1f8f4d] dark:text-[#7ede99]">当前套改类型：{curType}</span>} />
          <div className="px-1.5 py-1.5">
            {result ? result.compare.map((r) => (
              <div key={r.method}
                className={`flex items-baseline gap-3 mx-2 px-2 py-[7px] rounded-md border-b border-[var(--line-2)] last:border-0 ${r.isBest ? "bg-[var(--sel)] border-l-2 border-l-[var(--acc)]" : ""}`}>
                <span className="w-[110px] shrink-0 text-[11.5px] text-[var(--tx-2)] flex items-center gap-1.5">
                  {r.isBest && <Icon name="check" size={11} className="text-[var(--acc)]" />}
                  {r.method}
                </span>
                <span className={`font-mono2 text-[13px] font-semibold shrink-0 w-[150px] ${r.isBest ? "text-[var(--acc)]" : "text-[var(--tx-1)]"}`}>
                  {r.level}-{r.grade} 工资 {Calculator.getSalary(r.level, r.grade)}
                </span>
                <span className="text-[11px] text-[var(--tx-3)] leading-snug">{methodNote(r.method)}</span>
              </div>
            )) : (
              <p className="mx-2 px-2 py-3 text-[12px] text-[var(--tx-3)] text-center">尚未测算 —— 请在上方点击「开始测算」</p>
            )}
            <div className="flex items-baseline gap-3 mx-2 mt-1 px-2 py-[7px] rounded-md bg-[var(--hov)]">
              <span className="w-[110px] shrink-0 text-[11.5px] text-[var(--tx-2)]">参工时间</span>
              <span className="font-mono2 text-[13px] font-semibold text-[var(--tx-1)] shrink-0 w-[150px]">{p.join}</span>
              <span className="text-[11px] text-[var(--tx-3)]">{joinNote}</span>
            </div>
          </div>
        </div>

        {/* ===== 工资演变明细（需求9：替换原工资演变情况） ===== */}
        <div className="card-panel overflow-hidden flex flex-col">
          <CardHead icon="grid" title="工资演变明细"
            extra={
              <span className="flex items-center gap-2">
                <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-2)]">{result ? result.evolution.length : 0} 行</span>
                <button onClick={copyTable} disabled={!result}
                  className="flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(90,200,250,.55)] text-[#0a6cd6] dark:text-[#93d9fb] text-[11px] hover:bg-[rgba(90,200,250,.12)] transition active:scale-95 disabled:opacity-40">
                  <Icon name="copy" size={11} />复制
                </button>
              </span>
            } />
          {result ? (
            <div className="overflow-auto max-h-[320px]">
              <table className="w-full text-[11.5px] border-collapse min-w-[640px]">
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
                  {result.evolution.map((item, i) => {
                    const isLast = i === result.evolution.length - 1;
                    return (
                      <tr key={i} className={`border-b border-[var(--line-2)] ${isLast ? "bg-[var(--sel)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""}`}>
                        <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-3)] relative">
                          {isLast && <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[var(--acc)]" />}
                          {i + 1}
                        </td>
                        <td className="px-2 py-1 font-mono2 text-[#0a6cd6] dark:text-[#a9c4e6] whitespace-nowrap">{item.year}</td>
                        <td className={`px-2 py-1 whitespace-nowrap ${isLast ? "font-medium text-[var(--tx-1)]" : "text-[var(--tx-1)]"}`}>{item.reason}</td>
                        <td className="px-2 py-1 text-[var(--tx-1)] whitespace-nowrap">{item.duty}</td>
                        <td className="px-2 py-1 text-right font-mono2 text-[#0a6cd6] dark:text-[#8ed6fa]">{item.level}级</td>
                        <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-1)]">{item.grade}档</td>
                        <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-2)]">{item.levelStartYear}年</td>
                        <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-2)]">{item.gradeStartYear}年</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-6 text-[12px] text-[var(--tx-3)] text-center">尚未测算 —— 请在上方点击「开始测算」生成演变明细</p>
          )}
          {result && (
            <div className="shrink-0 h-8 px-3.5 flex items-center gap-4 border-t border-[var(--line)] bg-[var(--head)] text-[11px] text-[var(--tx-2)]">
              <span>{result.hero.title}</span>
              <span className="font-mono2 text-[var(--tx-1)]">{result.hero.duty}</span>
              <span className="font-mono2 text-[13px] font-semibold text-[var(--acc)]">
                {fmtLevel(`${result.finalLevel}.${result.finalGrade}`)} · 级别工资 ¥{fmt(Calculator.getSalary(result.finalLevel, result.finalGrade))}
              </span>
            </div>
          )}
        </div>

        <p className="text-center text-[10.5px] text-[var(--tx-3)] py-1">
          本工具仅供模拟推算，不作为工资审批依据。
        </p>
      </div>
    </div>
  );
}
