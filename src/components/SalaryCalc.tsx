import React, { useEffect, useMemo, useState } from "react";
import { Person } from "../data";
import {
  Calculator, POLICY_CONFIG, CompareItem,
  EDUCATION_OPTIONS, EDUCATION_VALUES,
  DUTY_OPTIONS, DUTY_VALUES, LOWER_DUTY_OPTIONS, LOWER_DUTY_VALUES,
  POSITION_PICKER_LABELS, POSITION_PICKER_VALUES,
} from "../core/calculator";
import type { CalcInputs } from "../core/calculator";
import { Icon, IconName } from "./icons";

type CalcType = "pre2006" | "post2006";

interface PosChange {
  year: number;
  dutyIndex: number;
  reason: string;
  isInitial?: boolean;
}

interface EvoRow {
  year: string;
  reason: string;
  duty: string;
  level: number;
  grade: number;
  levelStartYear: number;
  gradeStartYear: number;
}

const years = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

function Card({ dot, title, extra, children }: {
  dot: string; title: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card-panel overflow-hidden">
      <div className="card-head flex items-center gap-2 px-3.5 h-9">
        <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
        <span className="text-[12.5px] font-semibold text-[var(--tx-1)]">{title}</span>
        <span className="ml-auto">{extra}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
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

export function SalaryCalc({ person, onToast, prefill }: {
  person: Person;
  onToast: (t: "success" | "error" | "info", m: string) => void;
  prefill?: CalcInputs | null;
}) {
  /* ---------------- 与 salary.js data 对齐的状态 ---------------- */
  const [currentType, setCurrentType] = useState<CalcType>("pre2006");
  const [startYear, setStartYear] = useState(2004);
  const [educationIndex, setEducationIndex] = useState(1);
  const [deductYears, setDeductYears] = useState(0);
  const [currentDutyIndex, setCurrentDutyIndex] = useState(1);
  const [currentDutyYear, setCurrentDutyYear] = useState(2002);
  const [lowerDutyIndex, setLowerDutyIndex] = useState(0);
  const [lowerDutyYear, setLowerDutyYear] = useState(1999);
  const [positionChanges, setPositionChanges] = useState<PosChange[]>([]);
  const [endYear, setEndYear] = useState(2026);

  const [showResult, setShowResult] = useState(false);
  const [heroTitle, setHeroTitle] = useState("");
  const [heroDuty, setHeroDuty] = useState("");
  const [heroLevelGrade, setHeroLevelGrade] = useState("");
  const [heroSubResult, setHeroSubResult] = useState("");
  const [compareResults, setCompareResults] = useState<(CompareItem & { isBest: boolean })[]>([]);
  const [evolutionHistory, setEvolutionHistory] = useState<EvoRow[]>([]);

  const getDutyLabel = (dutyIndex: number) => POLICY_CONFIG.getLabel(dutyIndex);
  const pickerIndex = (dutyIndex: number) => POSITION_PICKER_VALUES.indexOf(dutyIndex);

  /* ---------------- initPositionList ---------------- */
  const buildInitList = (type: CalcType, sy: number, cdi: number, cdy: number, eduIdx: number): PosChange[] => {
    if (type === "pre2006") {
      const di = DUTY_VALUES[cdi];
      const yr = cdy || 2002;
      const nextDuty = POLICY_CONFIG.getNextDuty(di);
      return [{ year: yr + 3, dutyIndex: nextDuty, reason: "职务晋升" }];
    }
    const eduVal = EDUCATION_VALUES[eduIdx];
    const ec = POLICY_CONFIG.EDUCATION[eduVal];
    return [{ year: (sy || 2007) + 1, dutyIndex: ec.probation.dutyIndex, reason: "转正定级", isInitial: true }];
  };

  useEffect(() => {
    setPositionChanges(buildInitList(currentType, startYear, currentDutyIndex, currentDutyYear, educationIndex));
    setShowResult(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentType]);

  const refreshPostList = () => {
    if (currentType === "post2006") {
      setPositionChanges(buildInitList("post2006", startYear, currentDutyIndex, currentDutyYear, educationIndex));
    }
  };
  const refreshPreList = () => {
    if (currentType === "pre2006") {
      setPositionChanges(buildInitList("pre2006", startYear, currentDutyIndex, currentDutyYear, educationIndex));
    }
  };

  /* ---------------- 事件（对应 onXxxChange） ---------------- */
  const switchType = (t: CalcType) => {
    setCurrentType(t);
    setStartYear(t === "pre2006" ? 2004 : 2007);
    setShowResult(false);
  };

  const onStartYearChange = (v: number) => {
    setStartYear(v);
    if (currentType === "post2006") refreshPostList();
  };

  const onCurrentDutyChange = (idx: number) => {
    const val = DUTY_VALUES[idx];
    const lowerVal = Math.max(0, val - 1);
    const lowerIdx = LOWER_DUTY_VALUES.indexOf(lowerVal);
    setCurrentDutyIndex(idx);
    setLowerDutyIndex(lowerIdx >= 0 ? lowerIdx : 0);
    refreshPreList();
  };

  const onCurrentDutyYearChange = (v: number) => {
    setCurrentDutyYear(v);
    if (currentType === "pre2006") refreshPreList();
  };

  const addPositionRow = () => {
    setPositionChanges((list) => {
      if (!list.length) return list;
      const last = list[list.length - 1];
      return [...list, {
        year: last.year + 3,
        dutyIndex: POLICY_CONFIG.getNextDuty(last.dutyIndex),
        reason: "职务晋升",
      }];
    });
  };

  const deletePositionRow = (idx: number) =>
    setPositionChanges((list) => list.filter((_, i) => i !== idx));

  const updatePosition = (idx: number, patch: Partial<PosChange>) =>
    setPositionChanges((list) => list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  /* ---------------- 预填档案参数 ---------------- */
  const applyPrefill = () => {
    if (!prefill) return;
    setCurrentType("pre2006");
    setStartYear(prefill.startYear);
    setEducationIndex(prefill.educationIndex);
    setDeductYears(prefill.deductYears);
    setCurrentDutyIndex(DUTY_VALUES.indexOf(prefill.currentDuty));
    setCurrentDutyYear(prefill.currentDutyYear);
    setLowerDutyIndex(Math.max(0, LOWER_DUTY_VALUES.indexOf(prefill.lowerDuty)));
    setLowerDutyYear(prefill.lowerDutyYear);
    setPositionChanges(buildInitList("pre2006", prefill.startYear, DUTY_VALUES.indexOf(prefill.currentDuty), prefill.currentDutyYear, prefill.educationIndex));
    setShowResult(false);
    onToast("info", `已按「${person.name}」档案预填测算参数（参工 ${prefill.startYear} 年）`);
  };

  /* ---------------- calculate：salary.js 逐行移植 ---------------- */
  const calculate = () => {
    const ey = endYear || 2026;
    const eduVal = EDUCATION_VALUES[educationIndex];
    const eduConfig = POLICY_CONFIG.EDUCATION[eduVal];

    const evo: EvoRow[] = [];
    let compare: CompareItem[] = [];
    let finalResult = { level: 0, grade: 0, method: "" };
    let currentLevel = 0;
    let currentGrade = 0;
    let currentYear = 0;
    let currentDutyIndex = 0;
    let levelStartYear = 0;
    let gradeStartYear = 0;
    let taogaoYears = 0;
    let tenureYears = 0;

    if (currentType === "pre2006") {
      const cdi = DUTY_VALUES[currentDutyIndex];
      const ldi = LOWER_DUTY_VALUES[lowerDutyIndex];
      const cdy = currentDutyYear;
      const ldy = lowerDutyYear;

      taogaoYears = Calculator.calcTaogaoYears(startYear, eduConfig.settleYears, deductYears);
      tenureYears = 2006 - cdy;
      const lowerTenure = ldi > 0 ? 2006 - ldy : 0;

      const comp = Calculator.compareThreeWays(cdi, ldi, eduVal, taogaoYears, tenureYears, lowerTenure);
      compare = comp.results;
      finalResult = { ...comp.best, method: comp.best.method };

      currentLevel = finalResult.level;
      currentGrade = finalResult.grade;
      currentYear = 2006;
      currentDutyIndex = cdi;
      levelStartYear = 2006;
      gradeStartYear = 2006;

      evo.push({
        year: "2006-07", reason: "2006年工资套改", duty: POLICY_CONFIG.getLabel(cdi),
        level: currentLevel, grade: currentGrade, levelStartYear, gradeStartYear,
      });
    } else {
      const pb = eduConfig.probation;
      currentLevel = pb.level;
      currentGrade = pb.grade;
      currentYear = startYear + 1;
      currentDutyIndex = pb.dutyIndex;
      levelStartYear = currentYear;
      gradeStartYear = currentYear;
      finalResult = { level: currentLevel, grade: currentGrade, method: "转正定级" };
      compare = [{
        method: "转正定级", duty: POLICY_CONFIG.getLabel(currentDutyIndex),
        years: "-", tenure: "-", level: currentLevel, grade: currentGrade,
      }];
      evo.push({
        year: `${currentYear}-07`, reason: "转正定级", duty: POLICY_CONFIG.getLabel(currentDutyIndex),
        level: currentLevel, grade: currentGrade, levelStartYear, gradeStartYear,
      });
    }

    const sorted = positionChanges.slice().sort((a, b) => a.year - b.year);

    for (const change of sorted) {
      if (currentType === "pre2006" && change.year <= 2006) continue;
      if (currentType === "post2006" && change.isInitial) continue;
      if (change.year <= currentYear || change.year > ey) continue;

      const rolling = Calculator.calcRolling(currentLevel, currentGrade, currentYear, change.year - 1, currentDutyIndex);
      currentLevel = rolling.level;
      currentGrade = rolling.grade;
      levelStartYear = rolling.levelStartYear;
      gradeStartYear = rolling.gradeStartYear;

      for (const h of rolling.history) {
        evo.push({
          year: `${h.year}-01`, reason: h.reason, duty: POLICY_CONFIG.getLabel(currentDutyIndex),
          level: h.level, grade: h.grade, levelStartYear: h.levelStartYear, gradeStartYear: h.gradeStartYear,
        });
      }

      const promoted = Calculator.calcPromotion(currentLevel, currentGrade, change.dutyIndex);
      currentLevel = promoted.level;
      currentGrade = promoted.grade;
      currentYear = change.year;
      currentDutyIndex = change.dutyIndex;
      levelStartYear = change.year;
      gradeStartYear = change.year;

      let reason = change.reason || "职务晋升";
      if (promoted.forced) reason = reason + "（强制提档）";

      evo.push({
        year: `${change.year}-01`, reason, duty: POLICY_CONFIG.getLabel(currentDutyIndex),
        level: currentLevel, grade: currentGrade, levelStartYear, gradeStartYear,
      });
    }

    /* 关键修复：确保即使没有职务变化，也能推演到 endYear */
    if (currentYear < ey) {
      const fr = Calculator.calcRolling(currentLevel, currentGrade, currentYear, ey, currentDutyIndex);
      currentLevel = fr.level;
      currentGrade = fr.grade;
      for (const hm of fr.history) {
        evo.push({
          year: `${hm.year}-01`, reason: hm.reason, duty: POLICY_CONFIG.getLabel(currentDutyIndex),
          level: hm.level, grade: hm.grade, levelStartYear: hm.levelStartYear, gradeStartYear: hm.gradeStartYear,
        });
      }
    }

    const dn = POLICY_CONFIG.getLabel(currentDutyIndex);
    const heroSub = currentType === "pre2006"
      ? `按2006现职务套改为 ${finalResult.level}级${finalResult.grade}档，套改年限 ${taogaoYears} 年，任职年限 ${tenureYears} 年。`
      : `按学历转正定级为 ${finalResult.level}级${finalResult.grade}档。`;

    setHeroTitle(`截至 ${ey} 年当前状态`);
    setHeroDuty(`职务：${dn}`);
    setHeroLevelGrade(`级别档次：${currentLevel}级${currentGrade}档`);
    setHeroSubResult(heroSub);
    setCompareResults(compare.map((r) => ({ ...r, isBest: r === comp_best(compare) })));
    setEvolutionHistory(evo);
    setShowResult(true);
  };

  /* ---------------- 复制表格（同 copyTable） ---------------- */
  const copyTable = async () => {
    let text = "序号\t起薪时间\t原因\t职务/职级\t级别\t档次\t级别考核起算\t档次考核起算\n";
    evolutionHistory.forEach((item, i) => {
      text += `${i + 1}\t${item.year}\t${item.reason}\t${item.duty}\t${item.level}级\t${item.grade}档\t${item.levelStartYear}年\t${item.gradeStartYear}年\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast("success", `已复制 ${evolutionHistory.length} 行演变明细到剪贴板`);
    } catch {
      onToast("error", "复制失败，请手动选择文本");
    }
  };

  const wageNow = useMemo(() => {
    if (!evolutionHistory.length) return 0;
    const last = evolutionHistory[evolutionHistory.length - 1];
    return Calculator.getSalary(last.level, last.grade);
  }, [evolutionHistory]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
      <div className="grid grid-cols-1 xl:grid-cols-[430px_1fr] gap-3 items-start">
        {/* ================= 左列：参数 ================= */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="seg">
              <button className={`seg-item ${currentType === "pre2006" ? "active" : ""}`} onClick={() => switchType("pre2006")}>
                2006年前参公（套改）
              </button>
              <button className={`seg-item ${currentType === "post2006" ? "active" : ""}`} onClick={() => switchType("post2006")}>
                2006年后参公
              </button>
            </div>
            {prefill && (
              <button onClick={applyPrefill}
                className="flex items-center gap-1 h-[26px] px-2.5 rounded-md border border-dashed border-[rgba(10,132,255,.55)] text-[var(--acc)] text-[11px] hover:bg-[var(--sel)] transition active:scale-95">
                <Icon name="user" size={11} />
                按「{person.name}」档案预填
              </button>
            )}
          </div>

          {/* 基本信息 */}
          <Card dot="#0a84ff" title="基本信息">
            <div className="grid grid-cols-[92px_1fr_104px] gap-2.5">
              <Field label="参工年份">
                <select className="field w-full h-8 px-2 text-[12.5px] font-mono2" value={startYear}
                  onChange={(e) => onStartYearChange(Number(e.target.value))}>
                  {years(1950, 2020).map((y) => <option key={y} value={y}>{y}年</option>)}
                </select>
              </Field>
              <Field label="学历">
                <select className="field w-full h-8 px-2 text-[12px]" value={educationIndex}
                  onChange={(e) => setEducationIndex(Number(e.target.value))}>
                  {EDUCATION_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                </select>
              </Field>
              <Field label="考核扣除年限">
                <input type="number" min={0} className="field w-full h-8 px-2 text-[12.5px] font-mono2" value={deductYears}
                  onChange={(e) => setDeductYears(Math.max(0, Number(e.target.value) || 0))} />
              </Field>
            </div>

            {currentType === "pre2006" && (
              <div className="mt-3 pt-3 border-t border-[var(--line-2)] flex flex-col gap-2.5">
                <div className="grid grid-cols-[1fr_110px] gap-2.5">
                  <Field label="2006时任职务">
                    <select className="field w-full h-8 px-2 text-[12.5px]" value={currentDutyIndex}
                      onChange={(e) => onCurrentDutyChange(Number(e.target.value))}>
                      {DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="任职时间">
                    <select className="field w-full h-8 px-2 text-[12.5px] font-mono2" value={currentDutyYear}
                      onChange={(e) => onCurrentDutyYearChange(Number(e.target.value))}>
                      {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_110px] gap-2.5">
                  <Field label="低一职务">
                    <select className="field w-full h-8 px-2 text-[12.5px]" value={lowerDutyIndex}
                      onChange={(e) => setLowerDutyIndex(Number(e.target.value))}>
                      {LOWER_DUTY_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="任职时间">
                    <select className="field w-full h-8 px-2 text-[12.5px] font-mono2" value={lowerDutyYear}
                      onChange={(e) => setLowerDutyYear(Number(e.target.value))}>
                      {years(1950, 2006).map((y) => <option key={y} value={y}>{y}年</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            )}
          </Card>

          {/* 职务变化情况 */}
          <Card dot="#30d158" title="职务变化情况"
            extra={<span className="font-mono2 text-[10.5px] px-1.5 py-px rounded-full bg-[rgba(48,209,88,.12)] border border-[rgba(48,209,88,.4)] text-[#1f8f4d] dark:text-[#7ede99]">{positionChanges.length} 条</span>}>
            <div className="flex flex-col gap-2">
              {positionChanges.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 h-6 shrink-0 rounded-full hero-grad flex items-center justify-center text-[11px] font-bold" style={{ animation: "none" }}>
                    {idx + 1}
                  </span>
                  <select className="field h-8 w-[96px] shrink-0 px-2 text-[12px] font-mono2" value={item.year}
                    onChange={(e) => updatePosition(idx, { year: Number(e.target.value) })}>
                    {years(1950, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
                  </select>
                  <select className="field h-8 flex-1 min-w-0 px-2 text-[12px]" value={pickerIndex(item.dutyIndex)}
                    onChange={(e) => updatePosition(idx, { dutyIndex: POSITION_PICKER_VALUES[Number(e.target.value)] })}>
                    {POSITION_PICKER_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
                  </select>
                  <button onClick={() => deletePositionRow(idx)} title="删除此行"
                    className="shrink-0 h-7 px-2 rounded-md border border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[11px] hover:bg-[rgba(255,69,58,.1)] transition active:scale-95">
                    删除
                  </button>
                </div>
              ))}
              <button onClick={addPositionRow}
                className="mt-1 h-8 rounded-md border border-dashed border-[rgba(10,132,255,.5)] text-[var(--acc)] text-[12px] hover:bg-[var(--sel)] transition active:scale-[.99] flex items-center justify-center gap-1">
                <Icon name="plus" size={12} />
                新增职务变化
              </button>
            </div>
          </Card>

          {/* 计算行 */}
          <div className="flex items-center justify-center gap-3 py-1">
            <button onClick={calculate}
              className="flex-[2] h-9 rounded-lg hero-grad text-[13px] font-semibold tracking-wide shadow-[0_6px_18px_rgba(10,132,255,.35)] transition-all hover:brightness-110 active:scale-[.98] flex items-center justify-center gap-1.5" style={{ animation: "none" }}>
              <Icon name="bolt" size={14} />
              开始测算
            </button>
            <div className="flex items-center gap-1.5 text-[12px] text-[var(--tx-2)]">
              截止
              <select className="field h-8 w-[92px] px-2 text-[12px] font-mono2" value={endYear}
                onChange={(e) => setEndYear(Number(e.target.value))}>
                {years(2024, 2035).map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ================= 右列：结果 ================= */}
        <div className="flex flex-col gap-3">
          {!showResult ? (
            <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl hero-grad flex items-center justify-center shadow-[0_10px_30px_rgba(10,132,255,.3)]" style={{ animation: "none" }}>
                <Icon name="sum" size={26} className="text-white" />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-[var(--tx-1)]">公务员工资推算</p>
              <p className="mt-1.5 text-[11.5px] text-[var(--tx-3)] tracking-wide">套改查表 · 三行对比 · 滚动晋级 · 职级并行</p>
              <p className="mt-3 text-[11px] text-[var(--tx-3)]">填写左侧参数后点击「开始测算」，引擎调用 calculator.js 核心推演</p>
            </div>
          ) : (
            <div className="anim-panel flex flex-col gap-3">
              {/* 结果头 */}
              <div className="hero-grad rounded-[10px] px-4 py-3.5 shadow-[0_12px_32px_rgba(10,132,255,.28)]" style={{ animation: "none" }}>
                <p className="text-[10.5px] tracking-[3px] text-white/85">{heroTitle}</p>
                <div className="mt-1.5 flex items-baseline gap-3 flex-wrap">
                  <span className="text-[17px] font-bold">{heroDuty}</span>
                  <span className="text-[17px] font-bold font-mono2">{heroLevelGrade}</span>
                  {wageNow > 0 && (
                    <span className="font-mono2 text-[12px] px-2 py-0.5 rounded-md bg-white/18 border border-white/25">
                      级别工资 ¥{wageNow.toLocaleString()}/月
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11.5px] text-white/90">{heroSubResult}</p>
              </div>

              {/* 套改明细对比 */}
              <Card dot="#ff9f0a" title="套改明细对比">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] border-collapse min-w-[520px]">
                    <thead>
                      <tr>
                        <th className="tbl-head px-2.5 py-1.5 text-left w-[30%]">套改方式</th>
                        <th className="tbl-head px-2 py-1.5 text-right">套改年限</th>
                        <th className="tbl-head px-2 py-1.5 text-right">任职年限</th>
                        <th className="tbl-head px-2 py-1.5 text-right">结果</th>
                        <th className="tbl-head px-2 py-1.5 text-center w-[52px]">采纳</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResults.map((r, i) => (
                        <tr key={r.method} className={`border-b border-[var(--line-2)] ${r.isBest ? "bg-[var(--sel)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""}`}>
                          <td className={`px-2.5 py-1.5 ${r.isBest ? "font-semibold text-[var(--acc)]" : "text-[var(--tx-1)]"}`}>
                            {r.method}
                            <span className="ml-1.5 text-[10.5px] text-[var(--tx-3)]">{r.duty}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-2)]">{r.years}</td>
                          <td className="px-2 py-1.5 text-right font-mono2 text-[var(--tx-2)]">{r.tenure}</td>
                          <td className="px-2 py-1.5 text-right font-mono2 font-semibold text-[var(--tx-1)]">{r.level}级{r.grade}档</td>
                          <td className={`px-2 py-1.5 text-center font-bold ${r.isBest ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[var(--tx-3)]"}`}>
                            {r.isBest ? "✓" : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 工资演变明细 */}
              <Card dot="#bf5af2" title="工资演变明细"
                extra={
                  <span className="flex items-center gap-2">
                    <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-2)]">{evolutionHistory.length} 行</span>
                    <button onClick={copyTable}
                      className="flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(90,200,250,.55)] text-[#0a6cd6] dark:text-[#93d9fb] text-[11px] hover:bg-[rgba(90,200,250,.12)] transition active:scale-95">
                      <Icon name="copy" size={11} />
                      复制
                    </button>
                  </span>
                }>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
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
                      {evolutionHistory.map((item, i) => {
                        const isLast = i === evolutionHistory.length - 1;
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
              </Card>
            </div>
          )}

          <p className="text-center text-[10.5px] text-[var(--tx-3)] py-1">
            本工具仅供模拟推算，不作为工资审批依据。
          </p>
        </div>
      </div>
    </div>
  );
}

/* best 判定与 compareThreeWays 内部口径一致 */
function comp_best(list: CompareItem[]): CompareItem {
  let best = list[0];
  for (let i = 1; i < list.length; i++) {
    const r = list[i];
    if (r.level < best.level || (r.level === best.level && r.grade > best.grade)) best = r;
  }
  return best;
}
