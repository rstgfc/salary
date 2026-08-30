import React, { useEffect, useMemo, useState } from "react";
import { EMPLOY_META, Employ, Person, TAG_META, Unit, fmt, fmtLevel } from "../data";
import type { WageZone } from "../data";
import { Icon, IconName } from "./icons";
import { SalaryPanel } from "./SalaryPanel";
import { TaogaiModal } from "./modals";
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

/* 需求1：历史保存记录（撤回保存） */
const histKey = (id: number) => `gw_calc_hist_v1_${id}`;
interface HistEntry { savedAt: string; params: CalcRunInput; results: CalcRunResult; }
const stampNow = () => {
  const d = new Date(); const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};

/* ---------- 需求1：列着色调色板 ---------- */
const COL_COLORS = ["#0a84ff", "#bf5af2", "#ff9f0a", "#30d158", "#ff375f", "#5ac8fa", "#b8860b", "#64d2ff", "#e05299", "#7a9a3e"];
function buildColorMap(vals: string[]): Map<string, string> {
  const m = new Map<string, string>();
  let i = 0;
  vals.forEach((v) => { if (!m.has(v)) m.set(v, COL_COLORS[i++ % COL_COLORS.length]); });
  return m;
}
const chipStyle = (v: string, m: Map<string, string>): React.CSSProperties => {
  const c = m.get(v) ?? "#8b95a7";
  return { color: c, background: `${c}1c`, borderLeft: `3px solid ${c}` };
};

/* 需求1：原因文案归一（兼容旧存档） */
const reasonLabel = (r: string) =>
  r.replace(/两年晋升级别档次/g, "两年晋档").replace(/五年晋升级别（就近就高）/g, "五年晋级");

/* ---------- 初始化职务变化列表 ---------- */
/* 需求10：上一条为职级（101-111）时，新增职级向更高递增；否则职务正常晋升 */
function nextDutyAfter(lastIndex: number): number {
  if (lastIndex >= 101 && lastIndex <= 111) return Math.max(101, lastIndex - 1);
  return POLICY_CONFIG.getNextDuty(lastIndex);
}

function buildInitList(type: CalcType, startYear: number, currentDutyIndex: number, currentDutyYear: number, educationIndex: number): PosChange[] {
  if (type === "pre2006") {
    const di = DUTY_VALUES[currentDutyIndex];
    /* 需求10：第一条职务变化默认 2008 年 */
    return [{ year: 2008, dutyIndex: POLICY_CONFIG.getNextDuty(di), reason: "职务晋升" }];
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
  const di = dutyName ? dutyIndexByName(dutyName) : null;
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

/* ---------- 详细资料行类型（需求6） ---------- */
interface AltRow { ym: string; tier: number; }
interface AssessRow { year: number; result: string; }
const ASSESS_OPTS = ["优秀", "称职", "基本称职", "不称职", "不定等次"];

/* 需求6：海拔档次 → 折算工龄补贴标准（元/年） */
const ALT_TIERS = [
  { label: "3500以下", amount: 0 },
  { label: "3500米-3999米", amount: 34 },
  { label: "4000米-4499米", amount: 45 },
  { label: "4500米以上", amount: 68 },
];

/* 需求6：由参工时间（如"1972年9月"）解析出"YYYY-MM" */
function joinToYm(join: string): string {
  const m = /(\d{4})年(\d{1,2})月/.exec(join ?? "");
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}`;
  return `${new Date().getFullYear()}-01`;
}

/* 需求6：每年1月按当时海拔档次累加至当前年份 */
function calcAltitudeSubsidy(rows: AltRow[], currentYear: number): number {
  /* 防御：过滤无效行（旧版本残留数据可能缺失 ym），防止 localeCompare 崩溃 */
  const valid = (Array.isArray(rows) ? rows : []).filter(
    (r): r is AltRow => !!r && typeof r.ym === "string" && !!r.ym
  );
  if (!valid.length) return 0;
  const sorted = [...valid].sort((a, b) => a.ym.localeCompare(b.ym));
  const firstYear = parseInt(sorted[0].ym.slice(0, 4), 10);
  let total = 0;
  for (let jy = firstYear + 1; jy <= currentYear; jy++) {
    const janYm = `${jy}-01`;
    let tier = sorted[0].tier;
    for (const e of sorted) { if (e.ym <= janYm) tier = e.tier; else break; }
    total += ALT_TIERS[tier]?.amount ?? 0;
  }
  return total;
}

export function DetailPanel({ person, unitName, zone, canEdit, onTool, onToast, onDelete, onSaved, units, onChangeUnit }: {
  person: Person;
  unitName: string;
  zone?: WageZone;               // 单位工资类区（西藏特殊津贴按类区计算）
  canEdit: boolean;
  onTool: (a: "query" | Employ) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
  onDelete: () => void;          // 需求3
  onSaved?: () => void;
  units?: Unit[];                        // 需求7：点击单位名可改单位
  onChangeUnit?: (unitId: string) => void;
}) {
  const [params, setParams] = useState<CalcRunInput>(() => deriveParams(person));
  const [results, setResults] = useState<CalcRunResult | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fromSave, setFromSave] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [taogaiOpen, setTaogaiOpen] = useState(false);
  /* 需求1：历史保存记录（撤回保存） */
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [histOpen, setHistOpen] = useState(false);
  /* 需求7：点击单位名修改单位 */
  const [unitOpen, setUnitOpen] = useState(false);

  /* 需求6：页签模式 基本信息 | 详细资料 */
  const [mode, setMode] = useState<"base" | "detail">("base");
  const [altRows, setAltRows] = useState<AltRow[]>([]);
  const [assessRows, setAssessRows] = useState<AssessRow[]>([]);

  /* 需求1：表格排序 / 筛选 / 高亮 */
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [hlReason, setHlReason] = useState<string | null>(null);

  /* 挂载时载入存档 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(saveKey(person.id));
      if (raw) {
        const saved = JSON.parse(raw);
        setParams(saved.params);
        setResults(saved.results);
        setFromSave(true);
        setSavedAt(saved.savedAt ?? null);
      } else {
        const p0 = deriveParams(person);
        setParams(p0);
        try { setResults(runCalculation(p0)); } catch { setResults(null); }
        setFromSave(false);
        setSavedAt(null);
      }
    } catch { /* ignore */ }
    /* 详细资料载入（需求6：海拔默认第一条为参工年月） */
    try {
      const savedAlt = JSON.parse(localStorage.getItem(`gw_alt_${person.id}`) ?? "null");
      const validAlt = Array.isArray(savedAlt)
        ? savedAlt.filter((r) => r && typeof r.ym === "string" && r.ym && typeof r.tier === "number")
        : [];
      setAltRows(validAlt.length ? validAlt : [{ ym: joinToYm(person.join), tier: 0 }]);
      setAssessRows(JSON.parse(localStorage.getItem(`gw_assess_${person.id}`) ?? "[]"));
    } catch { setAltRows([{ ym: joinToYm(person.join), tier: 0 }]); setAssessRows([]); }
    /* 需求1：历史保存记录载入 */
    try { setHistory(JSON.parse(localStorage.getItem(histKey(person.id)) ?? "[]")); } catch { setHistory([]); }
    setHistOpen(false); setUnitOpen(false);
    setMode("base");
    setSortDir("asc"); setReasonFilter(null); setHlReason(null); setFilterOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  const set = (patch: Partial<CalcRunInput>) => setParams((p) => ({ ...p, ...patch }));

  /* 需求2：参公类型按参公年份自动选择（用户不可点击） */
  useEffect(() => {
    setParams((p) => {
      const t: CalcType = p.startYear < 2006 ? "pre2006" : "post2006";
      if (t === p.type) return p;
      return { ...p, type: t, positionChanges: buildInitList(t, p.startYear, p.currentDutyIndex, p.currentDutyYear, p.educationIndex) };
    });
  }, [params.startYear]);

  const onCurrentDutyChange = (idx: number) => {
    setParams((p) => {
      const val = DUTY_VALUES[idx];
      const lowerIdx = LOWER_DUTY_VALUES.indexOf(Math.max(0, val - 1));
      return {
        ...p, currentDutyIndex: idx, lowerDutyIndex: lowerIdx >= 0 ? lowerIdx : 0,
        positionChanges: p.type === "pre2006" ? buildInitList("pre2006", p.startYear, idx, p.currentDutyYear, p.educationIndex) : p.positionChanges,
      };
    });
  };

  const pickerIndex = (dutyIndex: number) => POSITION_PICKER_VALUES.indexOf(dutyIndex);

  const doCalculate = () => {
    try {
      const r = runCalculation(params);
      setResults(r);
      const at = stampNow();
      setSavedAt(at);
      setFromSave(true);
      localStorage.setItem(saveKey(person.id), JSON.stringify({ params, results: r, savedAt: at }));
      /* 需求1：写入历史保存记录（最多保留 30 条） */
      try {
        const prev: HistEntry[] = JSON.parse(localStorage.getItem(histKey(person.id)) ?? "[]");
        const hist = [{ savedAt: at, params, results: r }, ...(Array.isArray(prev) ? prev : [])].slice(0, 30);
        localStorage.setItem(histKey(person.id), JSON.stringify(hist));
        setHistory(hist);
      } catch { /* ignore */ }
      onToast("success", `已完成「${person.name}」测算并保存（级别 ${r.hero.levelGrade}）`);
      onSaved?.();
    } catch {
      onToast("error", "测算失败，请检查参数");
    }
  };

  const tag = TAG_META[person.tag];
  const emp = EMPLOY_META[person.employ];

  const copyTable = async () => {
    if (!displayRows.length) return;
    let text = "序号\t起薪时间\t变动原因\t职务/职级\t级别\t档次\t级别考核起算\t档次考核起算\n";
    displayRows.forEach((it, i) => {
      text += `${i + 1}\t${it.year}\t${reasonLabel(it.reason)}\t${it.duty}\t${it.level}级\t${it.grade}档\t${it.levelStartYear}年\t${it.gradeStartYear}年\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast("success", `已复制 ${displayRows.length} 行演变明细到剪贴板`);
    } catch {
      onToast("error", "复制失败，请手动选择文本");
    }
  };

  const wageNow = useMemo(() => (results ? Calculator.getSalary(results.finalLevel, results.finalGrade) : 0), [results]);

  /* 需求2：参加工作年限（由参工时间年份推算，供五年浮动/学历固定/20年固定自动计算） */
  const workYears = useMemo(() => {
    const y = parseInt(person.join, 10);
    return Number.isFinite(y) ? Math.max(0, new Date().getFullYear() - y) : 0;
  }, [person.join]);

  const latestDutyIndex = useMemo(() => {
    if (results) return results.finalDutyIndex;
    const ch = params.positionChanges;
    return ch.length ? ch[ch.length - 1].dutyIndex : DUTY_VALUES[params.currentDutyIndex];
  }, [results, params.positionChanges, params.currentDutyIndex]);
  const dutyLabel = POLICY_CONFIG.getLabel(latestDutyIndex);
  /* 需求2：职务信息随测算结果刷新（有测算结果显示测算职务，否则显示档案职务） */
  const displayPosition = results ? dutyLabel : (person.position.replace(/（.*?）/g, "").trim() || dutyLabel);

  /* ---------- 需求1：排序 + 筛选后的行 ---------- */
  const allRows = results?.evolution ?? [];
  const uniqueReasons = useMemo(() => Array.from(new Set(allRows.map((r) => reasonLabel(r.reason)))), [allRows]);

  const displayRows = useMemo(() => {
    let rows = allRows;
    if (reasonFilter) rows = rows.filter((r) => reasonLabel(r.reason) === reasonFilter);
    /* 防御：year 异常时按字符串安全比较，防止 localeCompare 崩溃 */
    const sorted = [...rows].sort((a, b) => {
      const ya = typeof a?.year === "string" ? a.year : String(a?.year ?? "");
      const yb = typeof b?.year === "string" ? b.year : String(b?.year ?? "");
      return ya.localeCompare(yb);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [allRows, reasonFilter, sortDir]);

  /* 需求1：各列着色映射（按当前显示行） */
  const dutyColor = useMemo(() => buildColorMap(displayRows.map((r) => r.duty)), [displayRows]);
  const levelColor = useMemo(() => buildColorMap(displayRows.map((r) => String(r.level))), [displayRows]);
  const lsyColor = useMemo(() => buildColorMap(displayRows.map((r) => `${r.levelStartYear}年`)), [displayRows]);
  const gsyColor = useMemo(() => buildColorMap(displayRows.map((r) => `${r.gradeStartYear}年`)), [displayRows]);

  /* ---------- 详细资料持久化（需求6） ---------- */
  const setAlt = (rows: AltRow[]) => { setAltRows(rows); try { localStorage.setItem(`gw_alt_${person.id}`, JSON.stringify(rows)); } catch { /* ignore */ } };
  const setAssess = (rows: AssessRow[]) => { setAssessRows(rows); try { localStorage.setItem(`gw_assess_${person.id}`, JSON.stringify(rows)); } catch { /* ignore */ } };

  /* 需求6：海拔折算工龄补贴 */
  const altitudeSubsidy = useMemo(() => calcAltitudeSubsidy(altRows, new Date().getFullYear()), [altRows]);

  const sel = "field w-full h-8 px-2 text-[12px]";
  const pre = params.type === "pre2006";

  /* ================= 详细资料：三列（需求6） ================= */
  const detailView = (
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-3 items-start overflow-y-auto pb-1">
      {/* 海拔变动 */}
      <div className="card-panel overflow-hidden flex flex-col max-h-full">
        <CardHead icon="mountain" title="海拔变动"
          extra={<span className="font-mono2 text-[10px] px-1.5 py-px rounded-full bg-[rgba(90,200,250,.1)] border border-[rgba(90,200,250,.35)] text-[#0a6cd6] dark:text-[#93d9fb]">{altRows.length} 条</span>} />
        <div className="p-3 flex flex-col gap-2">
          {altRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold text-white" style={{ animation: "none" }}>{idx + 1}</span>
              <input type="month" className="field h-8 w-[124px] shrink-0 px-2 text-[12px] font-mono2" value={row.ym} disabled={!canEdit}
                onChange={(e) => setAlt(altRows.map((r, i) => i === idx ? { ...r, ym: e.target.value || r.ym } : r))} />
              <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={row.tier} disabled={!canEdit}
                onChange={(e) => setAlt(altRows.map((r, i) => i === idx ? { ...r, tier: Number(e.target.value) } : r))}>
                {ALT_TIERS.map((t, i) => <option key={t.label} value={i}>{t.label}（{t.amount}元/年）</option>)}
              </select>
              <button title="删除此行" disabled={!canEdit}
                onClick={() => setAlt(altRows.filter((_, i) => i !== idx))}
                className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95 disabled:opacity-35">删除</button>
            </div>
          ))}
          <button disabled={!canEdit}
            onClick={() => setAlt([...altRows, { ym: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, tier: 0 }])}
            className="h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition active:scale-[.99] flex items-center justify-center gap-1 disabled:opacity-35">
            <Icon name="plus" size={12} />新增海拔变动
          </button>
          {/* 需求6：折算工龄补贴实时结果 */}
          <div className="mt-1 pt-2 border-t border-dashed border-[var(--line)] flex items-center justify-between text-[11.5px]">
            <span className="text-[var(--tx-2)]">折算工龄补贴（累计至{new Date().getFullYear()}年）</span>
            <span className="font-mono2 font-bold text-[var(--acc)]">{fmt(altitudeSubsidy)}元</span>
          </div>
        </div>
      </div>

      {/* 考核情况 */}
      <div className="card-panel overflow-hidden flex flex-col max-h-full">
        <CardHead icon="clipboard" title="考核情况"
          extra={<span className="font-mono2 text-[10px] px-1.5 py-px rounded-full bg-[rgba(48,209,88,.1)] border border-[rgba(48,209,88,.35)] text-[#1f8f4d] dark:text-[#7ede99]">{assessRows.length} 条</span>} />
        <div className="p-3 flex flex-col gap-2">
          {assessRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold text-white" style={{ animation: "none" }}>{idx + 1}</span>
              <select className="field h-8 w-[92px] shrink-0 px-2 text-[12px] font-mono2" value={row.year} disabled={!canEdit}
                onChange={(e) => setAssess(assessRows.map((r, i) => i === idx ? { ...r, year: Number(e.target.value) } : r))}>
                {years(1950, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
              <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={row.result} disabled={!canEdit}
                onChange={(e) => setAssess(assessRows.map((r, i) => i === idx ? { ...r, result: e.target.value } : r))}>
                {ASSESS_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <button title="删除此行" disabled={!canEdit}
                onClick={() => setAssess(assessRows.filter((_, i) => i !== idx))}
                className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95 disabled:opacity-35">删除</button>
            </div>
          ))}
          <button disabled={!canEdit}
            onClick={() => setAssess([...assessRows, { year: new Date().getFullYear(), result: "称职" }])}
            className="h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition active:scale-[.99] flex items-center justify-center gap-1 disabled:opacity-35">
            <Icon name="plus" size={12} />新增考核记录
          </button>
        </div>
      </div>

      {/* 工资变动审批表（留空） */}
      <div className="card-panel overflow-hidden flex flex-col max-h-full">
        <CardHead icon="allowance" title="工资变动审批表" />
        <div className="p-3 flex-1 flex flex-col items-center justify-center text-center text-[var(--tx-3)] min-h-[160px]">
          <Icon name="clipboard" size={28} className="opacity-35 mb-2.5" />
          <p className="text-[12px]">暂无审批记录</p>
          <p className="text-[10.5px] mt-1">该栏目预留，待接入审批流程后启用</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="anim-panel flex-1 min-h-0 flex flex-col gap-3">
      {/* ================= 工具栏（需求3：页签位于行首，与人员信息同行） ================= */}
      <div className="shrink-0 flex items-center gap-2.5 flex-wrap">
        {/* 页签切换：基本信息 | 详细资料 */}
        <div className="shrink-0 seg">
          <button className={`seg-item ${mode === "base" ? "active" : ""}`} onClick={() => setMode("base")}>
            <Icon name="user" size={12} />基本信息
          </button>
          <button className={`seg-item ${mode === "detail" ? "active" : ""}`} onClick={() => setMode("detail")}>
            <Icon name="grid" size={12} />详细资料
          </button>
        </div>
        <span className="w-px h-5 bg-[var(--line)] shrink-0 hidden sm:block" />

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
          {/* 需求7：点击单位名可修改单位 */}
          <span className="relative hidden md:inline">
            <button
              onClick={() => { if (canEdit && onChangeUnit) setUnitOpen((v) => !v); }}
              title={canEdit && onChangeUnit ? "点击修改单位" : undefined}
              className={`font-mono2 text-[11px] truncate rounded px-1 -mx-1 transition ${canEdit && onChangeUnit ? "text-[var(--acc)] hover:bg-[var(--sel)]" : "text-[var(--tx-3)] cursor-default"}`}
            >
              [{person.unitId}] {unitName}
            </button>
            {unitOpen && canEdit && onChangeUnit && (
              <>
                <span className="fixed inset-0 z-[29]" onMouseDown={() => setUnitOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-30 w-[200px] max-h-[240px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_12px_32px_rgba(10,20,45,.28)] py-1 anim-fade">
                  {units?.map((u) => (
                    <button key={u.id} onClick={() => { setUnitOpen(false); if (u.id !== person.unitId) onChangeUnit(u.id); }}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-[var(--hov)] transition flex items-center gap-1.5 ${u.id === person.unitId ? "text-[var(--acc)] font-semibold" : "text-[var(--tx-1)]"}`}>
                      <span className="font-mono2 text-[10px] text-[var(--tx-3)]">[{u.id}]</span>
                      <span className="truncate">{u.name}</span>
                      {u.id === person.unitId && <Icon name="check" size={10} className="ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* 需求3：查询按钮已移至左侧人员列表检索框右侧 */}
          <ToolBtn icon="on" label="在职" color="border-[rgba(48,209,88,.55)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.12)]"
            active={person.employ === "在职"} disabled={!canEdit} onClick={() => onTool("在职")} />
          <ToolBtn icon="retire" label="退休" color="border-[rgba(255,159,10,.55)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.12)]"
            active={person.employ === "退休"} disabled={!canEdit} onClick={() => onTool("退休")} />
          <ToolBtn icon="stop" label="止薪" color="border-[rgba(255,69,58,.55)] text-[#d70015] dark:text-[#ff8b84] bg-[rgba(255,69,58,.1)]"
            active={person.employ === "止薪"} disabled={!canEdit} onClick={() => onTool("止薪")} />
          {/* 需求3：删除选择（止薪之后，鲜艳警示红，长显） */}
          <button onClick={onDelete}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md border text-[12px] font-semibold transition-all active:scale-[.97] text-white shadow-[0_2px_10px_rgba(255,45,85,.35)]"
            style={{ background: "linear-gradient(120deg,#ff2d55,#ff453a)", borderColor: "transparent" }}>
            <Icon name="trash" size={13} />删除选择
          </button>
        </div>
      </div>

      {mode === "detail" ? detailView : (
        /* ================= 基本信息模式 ================= */
        <div className="flex-1 min-h-0 flex gap-3">
          {/* -------- 左列 -------- */}
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            {/* 上部：两栏（基本信息 + 职务变化） */}
            <div className="shrink-0 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] gap-3">
              {/* ---- 人员基本信息 ---- */}
              <div className="card-panel overflow-hidden">
                <CardHead icon="user" title="人员基本信息"
                  extra={<span className="font-mono2 text-[10px] text-[var(--tx-3)]">ID {String(person.id).padStart(4, "0")}</span>} />
                <div className="p-3 flex flex-col gap-3">
                  {/* 需求2：按参公年份自动选择，用户不可点击，样式不变 */}
                  <div className="seg w-full" title="按参公年份自动选择">
                    <button type="button" aria-disabled className={`seg-item flex-1 justify-center ${pre ? "active" : ""}`} style={{ cursor: "default" }}>2006年前参公（套改）</button>
                    <button type="button" aria-disabled className={`seg-item flex-1 justify-center ${!pre ? "active" : ""}`} style={{ cursor: "default" }}>2006年后参公</button>
                  </div>

                  <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                    {[
                      ["姓名", person.name], ["性别", person.gender], ["出生年月", person.birth],
                      ["身份", person.identity], ["职务", displayPosition],
                    ].map(([k, v]) => (
                      <div key={k as string} className="min-w-0">
                        <p className="text-[10px] text-[var(--tx-3)]">{k}</p>
                        <p className={`text-[12.5px] text-[var(--tx-1)] truncate ${k === "姓名" ? "font-semibold" : ""}`}>{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-[var(--line)] pt-2.5">
                    <p className="text-[10.5px] font-semibold text-[var(--acc)] mb-2 flex items-center gap-1"><Icon name="sum" size={11} />测算参数</p>
                    <div className="grid grid-cols-[88px_minmax(0,1fr)_30px] items-end gap-1.5">
                      <label className="block text-[10px] text-[var(--tx-3)]">参公年份
                        <select className={sel + " font-mono2 mt-0.5"} value={params.startYear} disabled={!canEdit}
                          onChange={(e) => set({ startYear: Number(e.target.value) })}>
                          {years(1950, 2020).map((y) => <option key={y} value={y}>{y}年</option>)}
                        </select>
                      </label>
                      <label className="block text-[10px] text-[var(--tx-3)]">学历
                        <select className={sel + " mt-0.5"} value={params.educationIndex} disabled={!canEdit}
                          onChange={(e) => set({ educationIndex: Number(e.target.value) })}>
                          {EDUCATION_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                        </select>
                      </label>
                      <button onClick={() => setDeductOpen((v) => !v)} title="考核扣除年限"
                        className={`h-8 rounded-md border flex items-center justify-center transition active:scale-95 ${
                          deductOpen ? "border-[rgba(10,132,255,.6)] bg-[var(--sel)] text-[var(--acc)]" : "border-[var(--line)] bg-[var(--bg-3)] text-[var(--tx-2)] hover:text-[var(--acc)] hover:border-[rgba(10,132,255,.5)]"
                        }`}>
                        <Icon name="del" size={14} sw={2.4} className="rotate-90" />
                      </button>
                    </div>

                    {deductOpen && (
                      <div className="mt-1.5 anim-fade flex items-center gap-2 rounded-md border border-[rgba(10,132,255,.4)] bg-[var(--sel)] px-2.5 py-2">
                        <span className="text-[10.5px] text-[var(--tx-2)] whitespace-nowrap">考核扣除年限</span>
                        <input type="number" min={0} value={params.deductYears} disabled={!canEdit}
                          onChange={(e) => set({ deductYears: Math.max(0, Number(e.target.value) || 0) })}
                          className="w-16 h-7 px-1.5 text-center font-mono2 text-[12px] rounded border border-[var(--line)] bg-[var(--bg-2)] text-[var(--tx-1)] outline-none focus:border-[rgba(10,132,255,.6)] transition disabled:opacity-40" />
                        <span className="text-[10.5px] text-[var(--tx-3)]">年</span>
                        <button onClick={() => setDeductOpen(false)} className="ml-auto text-[var(--tx-3)] hover:text-[var(--tx-1)] transition" title="收起"><Icon name="close" size={12} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ---- 职务变化 + 测算（高度与「人员基本信息」一致，列表内部滚动） ---- */}
              <div className="card-panel overflow-hidden relative min-h-[300px]">
                <div className="absolute inset-0 flex flex-col">
                <CardHead icon="rolling" title="职务变化情况"
                  extra={<span className="font-mono2 text-[10px] px-1.5 py-px rounded-full bg-[rgba(48,209,88,.1)] border border-[rgba(48,209,88,.35)] text-[#1f8f4d] dark:text-[#7ede99]">{params.positionChanges.length} 条</span>} />
                <div className="p-3 flex-1 min-h-0 flex flex-col gap-2.5">
                  <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
                    {/* 2006年前参公套改参数（纳入滚动范围；窗口宽度足够时一行显示） */}
                    {pre && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
                        <label className="block text-[10px] text-[var(--tx-3)]">2006时任职务
                          <select className={sel + " mt-0.5"} value={params.currentDutyIndex} disabled={!canEdit}
                            onChange={(e) => onCurrentDutyChange(Number(e.target.value))}>
                            {DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                          </select>
                        </label>
                        <label className="block text-[10px] text-[var(--tx-3)]">任职时间
                          <select className={sel + " font-mono2 mt-0.5"} value={params.currentDutyYear} disabled={!canEdit}
                            onChange={(e) => set({ currentDutyYear: Number(e.target.value) })}>
                            {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                          </select>
                        </label>
                        <label className="block text-[10px] text-[var(--tx-3)]">低一职务
                          <select className={sel + " mt-0.5"} value={params.lowerDutyIndex} disabled={!canEdit}
                            onChange={(e) => set({ lowerDutyIndex: Number(e.target.value) })}>
                            {LOWER_DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                          </select>
                        </label>
                        <label className="block text-[10px] text-[var(--tx-3)]">任职时间
                          <select className={sel + " font-mono2 mt-0.5"} value={params.lowerDutyYear} disabled={!canEdit}
                            onChange={(e) => set({ lowerDutyYear: Number(e.target.value) })}>
                            {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                          </select>
                        </label>
                      </div>
                    )}
                    {params.positionChanges.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold text-white" style={{ animation: "none" }}>{idx + 1}</span>
                        <select className="field h-8 w-[92px] shrink-0 px-2 text-[12px] font-mono2" value={item.year} disabled={!canEdit}
                          onChange={(e) => setParams((p) => ({ ...p, positionChanges: p.positionChanges.map((r, i) => i === idx ? { ...r, year: Number(e.target.value) } : r) }))}>
                          {/* 需求3：年份选项不能低于2006 */}
                          {years(2006, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                        </select>
                        <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={pickerIndex(item.dutyIndex)} disabled={!canEdit}
                          onChange={(e) => setParams((p) => ({ ...p, positionChanges: p.positionChanges.map((r, i) => i === idx ? { ...r, dutyIndex: POSITION_PICKER_VALUES[Number(e.target.value)] } : r) }))}>
                          {/* 需求3：职务与职级之间用虚线隔开 */}
                          {POSITION_PICKER_LABELS.map((l, i) => (
                            <React.Fragment key={l}>
                              {i === DUTY_OPTIONS.length && <option value="sep" disabled>┈┈┈┈┈┈ 职级 ┈┈┈┈┈┈</option>}
                              <option value={i}>{l}</option>
                            </React.Fragment>
                          ))}
                        </select>
                        <button title="删除此行" disabled={!canEdit}
                          onClick={() => setParams((p) => ({ ...p, positionChanges: p.positionChanges.filter((_, i) => i !== idx) }))}
                          className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95 disabled:opacity-35">删除</button>
                      </div>
                    ))}
                    <button disabled={!canEdit}
                      onClick={() => setParams((p) => {
                        const l = p.positionChanges[p.positionChanges.length - 1];
                        return { ...p, positionChanges: [...p.positionChanges, { year: (l?.year ?? 2008) + 2, dutyIndex: nextDutyAfter(l?.dutyIndex ?? 1), reason: "职务晋升" }] };
                      })}
                      className="h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition active:scale-[.99] flex items-center justify-center gap-1 disabled:opacity-35">
                      <Icon name="plus" size={12} />新增职务变化
                    </button>
                  </div>

                  <div className="shrink-0 pt-2.5 border-t border-dashed border-[var(--line)] flex items-center gap-2.5">
                    <button onClick={doCalculate} disabled={!canEdit}
                      className="flex-1 h-9 rounded-lg hero-grad text-[13px] font-semibold text-white tracking-wide shadow-[0_6px_18px_rgba(10,132,255,.3)] transition-all hover:brightness-110 active:scale-[.98] flex items-center justify-center gap-1.5 disabled:opacity-35 disabled:pointer-events-none"
                      style={{ animation: "none" }}>
                      <Icon name="bolt" size={14} />开始测算
                    </button>
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--tx-2)] shrink-0">
                      截止
                      <select className="field h-8 w-[88px] px-2 text-[12px] font-mono2" value={params.endYear} disabled={!canEdit}
                        onChange={(e) => set({ endYear: Number(e.target.value) })}>
                        {years(2024, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="shrink-0 text-[10.5px] flex items-center gap-1.5">
                    {fromSave && savedAt ? (
                      <span className="text-[#1f8f4d] dark:text-[#7ede99] flex items-center gap-1"><Icon name="check" size={11} />已保存测算结果 · {savedAt}，下次进入自动载入</span>
                    ) : fromSave ? (
                      <span className="text-[#1f8f4d] dark:text-[#7ede99] flex items-center gap-1"><Icon name="check" size={11} />已载入保存的测算结果</span>
                    ) : (
                      <span className="text-[var(--tx-3)] flex items-center gap-1"><Icon name="info" size={11} />自动测算预览 · 点击「开始测算」保存</span>
                    )}
                    {/* 需求1：撤回保存（历史保存时间选择） */}
                    <span className="ml-auto relative shrink-0">
                      <button onClick={() => setHistOpen((v) => !v)} title="撤回到某次历史保存"
                        className="h-6 px-2 rounded-md border border-[var(--line)] bg-[var(--bg-2)] text-[10.5px] text-[var(--tx-3)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)] transition flex items-center gap-1 active:scale-95">
                        <Icon name="clock" size={11} />撤回保存
                      </button>
                      {histOpen && (
                        <>
                          <span className="fixed inset-0 z-[29]" onMouseDown={() => setHistOpen(false)} />
                          <div className="absolute right-0 bottom-full mb-1 z-30 w-[252px] max-h-[220px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_12px_32px_rgba(10,20,45,.28)] py-1 anim-fade">
                            {history.length === 0 && (
                              <p className="px-2.5 py-2 text-[11px] text-[var(--tx-3)]">暂无历史保存记录</p>
                            )}
                            {history.map((h, i) => (
                              <button key={`${h.savedAt}_${i}`}
                                onClick={() => {
                                  setParams(h.params); setResults(h.results); setSavedAt(h.savedAt); setFromSave(true); setHistOpen(false);
                                  try { localStorage.setItem(saveKey(person.id), JSON.stringify({ params: h.params, results: h.results, savedAt: h.savedAt })); } catch { /* ignore */ }
                                  onToast("success", `已撤回至 ${h.savedAt} 的保存结果`);
                                }}
                                className="w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-[var(--hov)] transition flex items-center gap-1.5 text-[var(--tx-1)]">
                                <Icon name="clock" size={10} className="text-[var(--tx-3)] shrink-0" />
                                <span className="font-mono2 truncate">{h.savedAt}</span>
                                {h.results && <span className="ml-auto font-mono2 text-[10px] text-[var(--acc)] shrink-0">{h.results.hero.levelGrade}</span>}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                </div>
              </div>
            </div>

            {/* 下部：工资演变明细（需求1增强） */}
            <div className="flex-1 min-h-0 flex flex-col card-panel overflow-hidden">
              <CardHead icon="grid" title="工资演变明细"
                extra={
                  <span className="flex items-center gap-2">
                    <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-2)]">{displayRows.length} 行</span>
                    <button onClick={() => setTaogaiOpen(true)}
                      className="flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(10,132,255,.55)] text-[var(--acc)] text-[11px] hover:bg-[var(--sel)] transition active:scale-95">
                      <Icon name="sum" size={11} />套改明细
                    </button>
                    <button onClick={copyTable} disabled={!displayRows.length}
                      className="flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(90,200,250,.55)] text-[#0a6cd6] dark:text-[#93d9fb] text-[11px] hover:bg-[rgba(90,200,250,.12)] transition active:scale-95 disabled:opacity-35">
                      <Icon name="copy" size={11} />复制
                    </button>
                  </span>
                } />
              <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-[11.5px] border-collapse min-w-[680px]">
                  <thead>
                    <tr>
                      <th className="tbl-head px-2 py-1.5 text-right w-[44px]">序号</th>
                      {/* 需求1：起薪时间排序 */}
                      <th className="tbl-head px-2 py-1.5 text-left">
                        <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          title="点击切换升序 / 降序"
                          className="inline-flex items-center gap-1 hover:text-[var(--acc)] transition">
                          起薪时间
                          <Icon name="sort" size={11} className={sortDir === "asc" ? "text-[var(--acc)]" : "text-[var(--tx-3)] rotate-180"} />
                        </button>
                      </th>
                      {/* 需求1：变动原因筛选 + 点击高亮 */}
                      <th className="tbl-head px-2 py-1.5 text-left relative">
                        <button onClick={() => setFilterOpen((v) => !v)}
                          title="按变动原因筛选"
                          className={`inline-flex items-center gap-1 transition ${reasonFilter ? "text-[var(--acc)]" : "hover:text-[var(--acc)]"}`}>
                          变动原因
                          <Icon name="filter" size={11} className={reasonFilter ? "text-[var(--acc)]" : ""} />
                        </button>
                        {filterOpen && (
                          <div className="absolute left-1 top-full mt-1 z-30 w-[150px] rounded-lg border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_12px_32px_rgba(10,20,45,.28)] py-1 anim-fade">
                            <button onClick={() => { setReasonFilter(null); setFilterOpen(false); }}
                              className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-[var(--hov)] transition ${!reasonFilter ? "text-[var(--acc)] font-semibold" : "text-[var(--tx-1)]"}`}>全部</button>
                            {uniqueReasons.map((r) => (
                              <button key={r} onClick={() => { setReasonFilter(r); setFilterOpen(false); }}
                                className={`w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-[var(--hov)] transition truncate ${reasonFilter === r ? "text-[var(--acc)] font-semibold" : "text-[var(--tx-1)]"}`}>{r}</button>
                            ))}
                          </div>
                        )}
                      </th>
                      <th className="tbl-head px-2 py-1.5 text-left">职务/职级</th>
                      <th className="tbl-head px-2 py-1.5 text-right">级别</th>
                      <th className="tbl-head px-2 py-1.5 text-right">档次</th>
                      <th className="tbl-head px-2 py-1.5 text-right">级别起算</th>
                      <th className="tbl-head px-2 py-1.5 text-right">档次起算</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((item, i) => {
                      const rl = reasonLabel(item.reason);
                      const isHl = hlReason !== null && rl === hlReason;
                      return (
                        <tr key={i}
                          className={`border-b border-[var(--line-2)] transition-colors ${
                            isHl ? "bg-[rgba(255,159,10,.16)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""
                          }`}>
                          <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-3)]">{i + 1}</td>
                          <td className="px-2 py-1 font-mono2 text-[#0a6cd6] dark:text-[#a9c4e6] whitespace-nowrap">{item.year}</td>
                          {/* 点击原因 → 同原因行高亮 */}
                          <td className="px-2 py-1 whitespace-nowrap">
                            <button onClick={() => setHlReason((h) => (h === rl ? null : rl))}
                              title="点击高亮相同变动原因的行"
                              className={`text-[11.5px] rounded px-1 py-0.5 transition hover:bg-[var(--sel)] ${isHl ? "font-semibold text-[#a26603] dark:text-[#ffbe69]" : "text-[var(--tx-1)]"}`}>
                              {rl}
                            </button>
                          </td>
                          {/* 需求1：列着色 */}
                          <td className="px-2 py-1 whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded-r text-[11px]" style={chipStyle(item.duty, dutyColor)}>{item.duty}</span>
                          </td>
                          <td className="px-2 py-1 text-right whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded-r font-mono2 text-[11px]" style={chipStyle(String(item.level), levelColor)}>{item.level}</span>
                          </td>
                          <td className="px-2 py-1 text-right font-mono2 text-[var(--tx-1)]">{item.grade}</td>
                          <td className="px-2 py-1 text-right whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded-r font-mono2 text-[11px]" style={chipStyle(`${item.levelStartYear}年`, lsyColor)}>{item.levelStartYear}年</span>
                          </td>
                          <td className="px-2 py-1 text-right whitespace-nowrap">
                            <span className="inline-block px-1.5 py-0.5 rounded-r font-mono2 text-[11px]" style={chipStyle(`${item.gradeStartYear}年`, gsyColor)}>{item.gradeStartYear}年</span>
                          </td>
                        </tr>
                      );
                    })}
                    {!displayRows.length && (
                      <tr><td colSpan={8} className="px-3 py-10 text-center text-[var(--tx-3)]">
                        <Icon name="grid" size={20} className="mx-auto mb-2 opacity-50" />{results ? "当前筛选条件下无记录" : "点击「开始测算」生成工资演变明细"}
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

          {/* -------- 右列：当前工资 -------- */}
          <SalaryPanel personId={person.id} results={results} latestDutyIndex={latestDutyIndex} canEdit={canEdit} onToast={onToast} altitudeSubsidy={altitudeSubsidy} zone={zone} eduIndex={params.educationIndex} workYears={workYears} />
        </div>
      )}

      {/* 套改明细弹窗 */}
      {taogaiOpen && <TaogaiModal person={person} results={results} onClose={() => setTaogaiOpen(false)} />}
    </div>
  );
}
