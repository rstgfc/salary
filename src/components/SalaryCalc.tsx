import { useEffect, useState, type ReactNode } from "react";
import {
  Calculator, CalcInput, CompareItem, PERSON_CALC_INPUTS, POLICY_CONFIG, dutyWage, levelWage,
} from "../core/calculator";
import type { Person } from "../data";
import { Icon } from "./icons";

interface PChange { year: number; dutyIndex: number; reason: string; isInitial?: boolean; }

interface HistRow {
  year: string; reason: string; duty: string;
  level: number; grade: number; lsy: number; gsy: number;
}

interface CalcResult {
  endYear: number;
  dutyValue: number;
  dutyLabel: string;
  level: number;
  grade: number;
  sub: string;
  compare: CompareItem[];
  history: HistRow[];
}

const DUTIES = POLICY_CONFIG.POSITION_OPTIONS.filter((o) => o.type === "duty");
const LOWER_OPTS = [{ value: 0, label: "无" }, ...DUTIES];
const ALL_POS = POLICY_CONFIG.POSITION_OPTIONS;
const YEAR_OPTS: number[] = [];
for (let y = 1949; y <= 2040; y++) YEAR_OPTS.push(y);

export function SalaryCalc({ person, onToast }: {
  person: Person | null;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [type, setType] = useState<"pre2006" | "post2006">("pre2006");
  const [startYear, setStartYear] = useState("1972");
  const [eduValue, setEduValue] = useState(4);
  const [deduct, setDeduct] = useState("0");
  const [duty, setDuty] = useState(4);
  const [dutyYear, setDutyYear] = useState("2002");
  const [lowerDuty, setLowerDuty] = useState(3);
  const [lowerYear, setLowerYear] = useState("1995");
  const [endYear, setEndYear] = useState("2026");
  const [changes, setChanges] = useState<PChange[]>([]);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [calcTick, setCalcTick] = useState(0);

  /* 与小程序 initPositionList 一致：模式/关键参数变化时重建变动列表 */
  useEffect(() => {
    if (type === "pre2006") {
      const yr = (parseInt(dutyYear) || 2002) + 3;
      const nd = POLICY_CONFIG.getNextDuty(duty);
      setChanges([{ year: yr, dutyIndex: nd, reason: "职务晋升" }]);
    } else {
      const sy = parseInt(startYear) || 2007;
      const pb = POLICY_CONFIG.EDUCATION[eduValue].probation;
      setChanges([{ year: sy + 1, dutyIndex: pb.dutyIndex, reason: "转正定级", isInitial: true }]);
    }
  }, [type, dutyYear, duty, startYear, eduValue]);

  /* 与小程序 onCurrentDutyChange 一致：低职随现职联动 */
  const onDutyChange = (v: number) => {
    setDuty(v);
    setLowerDuty(Math.max(0, v - 1));
  };

  const addRow = () => {
    setChanges((list) => {
      if (!list.length) return list;
      const last = list[list.length - 1];
      const nd = POLICY_CONFIG.getNextDuty(last.dutyIndex);
      return [...list, { year: last.year + 3, dutyIndex: nd, reason: "职务晋升" }];
    });
  };

  const loadFromPerson = () => {
    if (!person) return;
    const inp: CalcInput | undefined = PERSON_CALC_INPUTS[person.id];
    if (!inp) { onToast("error", "该人员暂无档案测算参数"); return; }
    setType(inp.type);
    setStartYear(String(inp.startYear));
    setEduValue(inp.eduValue);
    setDeduct(String(inp.deductYears));
    setDuty(inp.currentDuty);
    setDutyYear(String(inp.currentDutyYear));
    setLowerDuty(inp.lowerDuty);
    setLowerYear(String(inp.lowerDutyYear));
    onToast("info", `已按「${person.name}」的档案参数预填`);
  };

  /* ============ calculate()：与小程序 calculate 同构 ============ */
  const calculate = () => {
    const ey = parseInt(endYear) || 2026;
    const sy = parseInt(startYear);
    if (!sy) { onToast("error", "请填写有效的起始年份"); return; }
    const ded = parseInt(deduct) || 0;
    const edu = POLICY_CONFIG.EDUCATION[eduValue] ?? POLICY_CONFIG.EDUCATION[4];

    const history: HistRow[] = [];
    let compare: CompareItem[] = [];
    let L: number, G: number, curYear: number, curDuty: number, lsy: number, gsy: number;
    let sub = "";
    let taogao = 0;

    if (type === "pre2006") {
      taogao = Calculator.calcTaogaoYears(sy, edu.settleYears, ded);
      const tenure = 2006 - (parseInt(dutyYear) || 2006);
      const lowerTenure = lowerDuty > 0 ? 2006 - (parseInt(lowerYear) || 2006) : 0;
      const comp = Calculator.compareThreeWays(duty, lowerDuty, eduValue, taogao, Math.max(0, tenure), Math.max(0, lowerTenure));
      compare = comp.results;
      L = comp.best.level; G = comp.best.grade;
      curYear = 2006; curDuty = duty; lsy = 2006; gsy = 2006;
      history.push({ year: "2006-07", reason: "2006年工资套改", duty: POLICY_CONFIG.getLabel(duty), level: L, grade: G, lsy, gsy });
      sub = `按2006${comp.best.method === "按现职套" ? "现职务" : comp.best.method === "按低职套" ? "低一职" : "学历"}套改为 ${L}级${G}档，套改年限 ${taogao} 年，任职年限 ${Math.max(0, tenure)} 年。`;
    } else {
      const pb = edu.probation;
      L = pb.level; G = pb.grade;
      curYear = sy + 1; curDuty = pb.dutyIndex; lsy = curYear; gsy = curYear;
      compare = [{ method: "转正定级", duty: POLICY_CONFIG.getLabel(curDuty), years: "—", tenure: "—", level: L, grade: G, isBest: true }];
      history.push({ year: `${curYear}-07`, reason: "转正定级", duty: POLICY_CONFIG.getLabel(curDuty), level: L, grade: G, lsy, gsy });
      sub = `按学历转正定级为 ${L}级${G}档。`;
    }

    const sorted = changes.slice().sort((a, b) => a.year - b.year);
    for (const ch of sorted) {
      if (type === "pre2006" && ch.year <= 2006) continue;
      if (type === "post2006" && ch.isInitial) continue;
      if (ch.year <= curYear || ch.year > ey) continue;

      const rolling = Calculator.calcRolling(L, G, curYear, ch.year - 1, curDuty);
      L = rolling.level; G = rolling.grade; lsy = rolling.levelStartYear; gsy = rolling.gradeStartYear;
      for (const h of rolling.history) {
        history.push({ year: `${h.year}-01`, reason: h.reason, duty: POLICY_CONFIG.getLabel(curDuty), level: h.level, grade: h.grade, lsy: h.levelStartYear, gsy: h.gradeStartYear });
      }

      const promoted = Calculator.calcPromotion(L, G, ch.dutyIndex);
      L = promoted.level; G = promoted.grade;
      curYear = ch.year; curDuty = ch.dutyIndex; lsy = ch.year; gsy = ch.year;
      history.push({
        year: `${ch.year}-01`,
        reason: promoted.forced ? `${ch.reason}（强制提档）` : ch.reason,
        duty: POLICY_CONFIG.getLabel(curDuty), level: L, grade: G, lsy, gsy,
      });
    }

    if (curYear < ey) {
      const fr = Calculator.calcRolling(L, G, curYear, ey, curDuty);
      for (const h of fr.history) {
        history.push({ year: `${h.year}-01`, reason: h.reason, duty: POLICY_CONFIG.getLabel(curDuty), level: h.level, grade: h.grade, lsy: h.levelStartYear, gsy: h.gradeStartYear });
      }
      L = fr.level; G = fr.grade;
    }

    setResult({ endYear: ey, dutyValue: curDuty, dutyLabel: POLICY_CONFIG.getLabel(curDuty), level: L, grade: G, sub, compare, history });
    setCalcTick((t) => t + 1);
  };

  const copyTable = async () => {
    if (!result) return;
    let text = "序号\t起薪时间\t原因\t职务/职级\t级别\t档次\t级别考核起算\t档次考核起算\n";
    result.history.forEach((h, i) => {
      text += `${i + 1}\t${h.year}\t${h.reason}\t${h.duty}\t${h.level}级\t${h.grade}档\t${h.lsy}年\t${h.gsy}年\n`;
    });
    try {
      await navigator.clipboard.writeText(text);
      onToast("success", `演变表格已复制（${result.history.length} 行），可粘贴至 Excel`);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        onToast("success", `演变表格已复制（${result.history.length} 行）`);
      } catch {
        onToast("error", "复制失败，请重试");
      }
    }
  };

  const curLw = result ? levelWage(result.level, result.grade) : 0;
  const curDw = result ? dutyWage(result.dutyValue) : 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-3 anim-panel">
      {/* ===== 左：参数表单 ===== */}
      <section className="card-panel shrink-0 xl:w-[318px] flex flex-col min-h-0">
        <header className="card-head h-9 shrink-0 flex items-center gap-2 px-3.5 rounded-t-[10px]">
          <Icon name="sum" size={14} className="text-[#6db1ff]" />
          <h3 className="text-[13px] font-semibold text-[#e8eaf0]">套改参数</h3>
          {person && (
            <button onClick={loadFromPerson}
              className="ml-auto flex items-center gap-1 h-6 px-2 rounded-md border border-[rgba(10,132,255,.4)] text-[10.5px] text-[#6db1ff] hover:bg-[rgba(10,132,255,.14)] transition">
              <Icon name="user" size={11} />
              按 {person.name} 预填
            </button>
          )}
        </header>

        <div className="p-3 space-y-3 overflow-y-auto min-h-0">
          {/* 类型切换 */}
          <div className="grid grid-cols-2 rounded-lg border border-[#2a303b] bg-[#14171d] p-0.5">
            {([["pre2006", "2006年前参加工作"], ["post2006", "2006年后考入"]] as const).map(([t, lb]) => (
              <button key={t} onClick={() => setType(t)}
                className={`h-7 rounded-md text-[11.5px] font-medium transition-all ${type === t ? "bg-[#0a84ff] text-white shadow-[0_2px_10px_rgba(10,132,255,.4)]" : "text-[#8b95a7] hover:text-[#e2e6ee]"}`}>
                {lb}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label={type === "pre2006" ? "参加工作年份" : "考入年份"}>
              <select className="field w-full h-[30px] px-2 font-mono2 text-[12px]" value={startYear} onChange={(e) => setStartYear(e.target.value)}>
                {YEAR_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="工改时学历">
              <select className="field w-full h-[30px] px-2 text-[11.5px]" value={eduValue} onChange={(e) => setEduValue(parseInt(e.target.value))}>
                {POLICY_CONFIG.EDU_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="未计工龄学习扣减">
              <input type="number" min={0} max={10} className="field w-full h-[30px] px-2 font-mono2 text-[12px]" value={deduct} onChange={(e) => setDeduct(e.target.value)} />
            </Field>
            <Field label="推演截止年份">
              <select className="field w-full h-[30px] px-2 font-mono2 text-[12px]" value={endYear} onChange={(e) => setEndYear(e.target.value)}>
                {YEAR_OPTS.filter((y) => y >= 2006).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="现任职务">
              <select className="field w-full h-[30px] px-2 text-[11.5px]" value={duty} onChange={(e) => onDutyChange(parseInt(e.target.value))}>
                {DUTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="任现职年份">
              <select className="field w-full h-[30px] px-2 font-mono2 text-[12px]" value={dutyYear} onChange={(e) => setDutyYear(e.target.value)} disabled={type === "post2006"}>
                {YEAR_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="低一职务">
              <select className="field w-full h-[30px] px-2 text-[11.5px]" value={lowerDuty} onChange={(e) => setLowerDuty(parseInt(e.target.value))} disabled={type === "post2006"}>
                {LOWER_OPTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="任低职年份">
              <select className="field w-full h-[30px] px-2 font-mono2 text-[12px]" value={lowerYear} onChange={(e) => setLowerYear(e.target.value)} disabled={type === "post2006"}>
                {YEAR_OPTS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
          </div>

          {/* 职务变动 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-[#8b95a7]">职务变动（晋升轨迹）</span>
              <button onClick={addRow}
                className="flex items-center gap-1 h-6 px-2 rounded-md border border-[#333a47] text-[10.5px] text-[#9aa3b2] hover:text-white hover:border-[rgba(10,132,255,.5)] hover:bg-[rgba(10,132,255,.08)] transition">
                <Icon name="plus" size={10} />增加变动
              </button>
            </div>
            <div className="space-y-1.5">
              {changes.length === 0 && (
                <p className="text-[10.5px] text-[#5d6779] border border-dashed border-[#333a47] rounded-md px-2 py-2 text-center">暂无变动，将从起点直接滚动推演</p>
              )}
              {changes.map((c, i) => (
                <div key={i} className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1.5 ${c.isInitial ? "border-[rgba(48,209,88,.3)] bg-[rgba(48,209,88,.04)]" : "border-[#2c323e] bg-[#14171d]"}`}>
                  <input type="number" className="field w-[62px] h-6 px-1.5 font-mono2 text-[11px]" value={c.year}
                    onChange={(e) => setChanges((l) => l.map((x, j) => (j === i ? { ...x, year: parseInt(e.target.value) || x.year } : x)))} />
                  <select className="field flex-1 h-6 px-1.5 text-[11px] min-w-0" value={c.dutyIndex} disabled={c.isInitial}
                    onChange={(e) => setChanges((l) => l.map((x, j) => (j === i ? { ...x, dutyIndex: parseInt(e.target.value) } : x)))}>
                    {ALL_POS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="text-[9.5px] text-[#667082] shrink-0 w-[52px]">{c.isInitial ? "初始定级" : c.reason}</span>
                  <button onClick={() => setChanges((l) => l.filter((_, j) => j !== i))} disabled={c.isInitial}
                    className="w-5 h-5 shrink-0 rounded flex items-center justify-center text-[#5d6779] hover:text-[#ff8b84] hover:bg-[rgba(255,69,58,.12)] transition disabled:opacity-30">
                    <Icon name="del" size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={calculate}
            className="w-full h-9 rounded-lg bg-gradient-to-r from-[#0a84ff] to-[#3d9bff] hover:from-[#2b93ff] hover:to-[#5aa9ff] text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-[.98] shadow-[0_6px_18px_rgba(10,132,255,.4)]">
            <Icon name="bolt" size={14} />
            开始测算
          </button>
          <p className="text-[10px] text-[#5d6779] leading-relaxed">
            规则：考核累计 2 年称职晋一档，5 年称职晋一级（就近就高）；职务晋升低于新职务最低级别时强制提档。与微信小程序共用核心算法。
          </p>
        </div>
      </section>

      {/* ===== 右：测算结果 ===== */}
      <section className="card-panel flex-1 flex flex-col min-w-0 min-h-0">
        <header className="card-head h-9 shrink-0 flex items-center gap-2 px-3.5 rounded-t-[10px]">
          <Icon name="eye" size={14} className="text-[#6db1ff]" />
          <h3 className="text-[13px] font-semibold text-[#e8eaf0]">测算结果</h3>
          {result && (
            <span className="ml-auto font-mono2 text-[10.5px] text-[#5d6779]">共 {result.history.length} 条推演记录</span>
          )}
        </header>

        {!result ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl border border-dashed border-[#3d4553] flex items-center justify-center">
              <Icon name="calc" size={26} className="text-[#3d4553]" />
            </div>
            <p className="mt-3 text-[13px] text-[#8b95a7]">设置左侧参数后点击「开始测算」</p>
            <p className="mt-1 text-[11px] text-[#5d6779]">将输出三方案比对结果与逐年工资演变推演</p>
          </div>
        ) : (
          <div key={calcTick} className="flex-1 overflow-y-auto p-3.5 space-y-3 anim-panel">
            {/* Hero 结果条 */}
            <div className="relative overflow-hidden rounded-xl border border-[rgba(10,132,255,.35)] bg-gradient-to-r from-[rgba(10,132,255,.12)] via-[rgba(90,200,250,.06)] to-transparent px-4 py-3.5">
              <div className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-[rgba(255,255,255,.06)] to-transparent title-scan" />
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div>
                  <p className="text-[10.5px] text-[#8b95a7]">截至 {result.endYear} 年当前状态</p>
                  <p className="font-disp text-[24px] font-bold text-white leading-tight">
                    {result.level}<span className="text-[13px] font-medium text-[#8ed6fa]">级</span>
                    {result.grade}<span className="text-[13px] font-medium text-[#8ed6fa]">档</span>
                  </p>
                </div>
                <div className="text-[11.5px] text-[#c3cad6] space-y-1">
                  <p>职务 / 职级：<b className="text-white">{result.dutyLabel}</b></p>
                  <p className="text-[#8b95a7] max-w-[420px]">{result.sub}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Stat label="级别工资" v={curLw} accent />
                  <Stat label="职务工资" v={curDw} />
                  <Stat label="基本工资合计" v={curLw + curDw} accent />
                </div>
              </div>
            </div>

            {/* 三方案比对 */}
            <div>
              <p className="text-[11px] text-[#8b95a7] mb-1.5 flex items-center gap-1.5">
                <Icon name="grid" size={11} />套改方案比对（{result.compare.length}）
              </p>
              <div className={`grid gap-2 ${result.compare.length > 1 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 max-w-[320px]"}`}>
                {result.compare.map((c) => {
                  const w = levelWage(c.level, c.grade);
                  return (
                    <div key={c.method}
                      className={`relative rounded-lg border px-3 py-2.5 transition-all ${c.isBest ? "border-[rgba(10,132,255,.6)] bg-[rgba(10,132,255,.09)] shadow-[0_6px_20px_rgba(10,132,255,.18)]" : "border-[#2c323e] bg-[#191d24]"}`}>
                      {c.isBest && (
                        <span className="absolute -top-2 right-2.5 text-[9.5px] px-1.5 py-0.5 rounded bg-[#0a84ff] text-white font-medium shadow-[0_2px_8px_rgba(10,132,255,.5)]">
                          最优方案
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-[12px] font-semibold ${c.isBest ? "text-[#8ed6fa]" : "text-[#c3cad6]"}`}>{c.method}</span>
                        <span className="text-[10px] text-[#667082]">{c.duty}</span>
                      </div>
                      <p className={`font-disp text-[19px] font-bold mt-1 ${c.isBest ? "text-white" : "text-[#d5dae4]"}`}>
                        {c.level}<span className="text-[11px] font-medium text-[#8b95a7]">级</span>
                        {c.grade}<span className="text-[11px] font-medium text-[#8b95a7]">档</span>
                        <span className="ml-2 font-mono2 text-[12px] font-medium text-[#7ede99]">¥{w.toLocaleString()}</span>
                      </p>
                      <p className="text-[10px] text-[#667082] mt-0.5">套改年限 {c.years} · 任职年限 {c.tenure}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 演变推演表 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] text-[#8b95a7] flex items-center gap-1.5">
                  <Icon name="clock" size={11} />工资演变推演
                </p>
                <button onClick={copyTable}
                  className="flex items-center gap-1 h-6 px-2 rounded-md border border-[#333a47] text-[10.5px] text-[#9aa3b2] hover:text-white hover:border-[rgba(10,132,255,.5)] hover:bg-[rgba(10,132,255,.08)] transition">
                  <Icon name="copy" size={10} />复制表格
                </button>
              </div>
              <div className="overflow-auto max-h-[300px] rounded-lg border border-[#2c323e]">
                <table className="text-[11.5px] w-full whitespace-nowrap">
                  <thead>
                    <tr>
                      {["序号", "起薪时间", "原因", "职务/职级", "级别", "档次", "级别工资", "级别考核起算", "档次考核起算"].map((h) => (
                        <th key={h} className="sticky top-0 z-10 bg-[#242935] px-2.5 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] border-b border-[#333a47]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.history.map((h, i) => {
                      const isNewDuty = h.reason.includes("晋升") && !h.reason.includes("档次") && !h.reason.includes("级别");
                      return (
                        <tr key={i} className={`border-b border-white/[.04] transition-colors hover:bg-[rgba(10,132,255,.06)] ${isNewDuty ? "bg-[rgba(255,214,10,.05)]" : i % 2 ? "bg-white/[.015]" : ""}`}>
                          <td className="px-2.5 py-1 font-mono2 text-[#5d6779]">{i + 1}</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#8ed6fa]">{h.year}</td>
                          <td className={`px-2.5 py-1 ${isNewDuty ? "text-[#ffd669] font-medium" : h.reason.includes("级别") ? "text-[#7ede99]" : "text-[#c3cad6]"}`}>{h.reason}</td>
                          <td className="px-2.5 py-1 text-[#c3cad6]">{h.duty}</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#e2e6ee]">{h.level}级</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#e2e6ee]">{h.grade}档</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#7ede99]">¥{levelWage(h.level, h.grade).toLocaleString()}</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#667082]">{h.lsy}年</td>
                          <td className="px-2.5 py-1 font-mono2 text-[#667082]">{h.gsy}年</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[10px] text-[#5d6779]">级别工资按核心速算表测算（基准年标准）；职务晋升行以黄色标记。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10.5px] text-[#8b95a7]">
      <span className="block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 min-w-[92px] ${accent ? "border-[rgba(10,132,255,.4)] bg-[rgba(10,132,255,.1)]" : "border-[#333a47] bg-[rgba(255,255,255,.03)]"}`}>
      <p className="text-[9.5px] text-[#8b95a7]">{label}</p>
      <p className={`font-mono2 text-[15px] font-bold ${accent ? "text-[#8ed6fa]" : "text-[#e2e6ee]"}`}>¥{v.toLocaleString()}</p>
    </div>
  );
}
