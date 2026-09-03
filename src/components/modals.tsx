import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPLOY_META, Employ, Person, TAG_META, Unit, WAGE_ZONES, WageZone, makePerson, yearOf, fmt, fmtLevel, lastOf,
  /* ---- Spec: person-import-export-inputs-only ---- */
  buildExportPayload, parseImportPayload, ParsedImportResult, PersonInputs, stripOutputs,
} from "../data";
import {
  VerifyReport, CalcRunResult, Calculator, latestDutyLabel,
  EDUCATION_OPTIONS, DUTY_OPTIONS, dutyWage2006, POLICY_CONFIG,
  runCalculation, CalcRunInput, deriveParams,
} from "../core/calculator";
import { getTibetAbs, getTibetFactor } from "../core/wageStd";
import { addAccount, loadAccounts, Role } from "./Login";
import { PersonFilterSort } from "./PersonList";
import { Icon, IconName, Logo } from "./icons";

/* ================= 通用弹窗 ================= */
export function Modal({ title, icon, onClose, children, footer, w = 580, allowFullscreen }: {
  title: string; icon: IconName; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; w?: number;
  allowFullscreen?: boolean; // 需求3：支持全屏切换
}) {
  /* 弹窗可拖动：按住标题栏移动整个窗口 */
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false); // 需求3：全屏状态
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onHeadDown = (e: React.PointerEvent) => {
    if (full) return; // 全屏时禁止拖动
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeadMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) });
  };
  const onHeadUp = () => { dragRef.current = null; };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center anim-fade" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,.45)] dark:bg-[rgba(8,10,14,.62)] backdrop-blur-[3px]" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`anim-modal relative border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_28px_80px_rgba(15,30,60,.35)] flex flex-col ${
          full ? "rounded-none max-h-full" : "rounded-xl max-h-[86vh]"
        }`}
        style={full
          ? { width: "100vw", height: "100vh", maxWidth: "100vw", transform: `translate(${offset.x}px, ${offset.y}px)` }
          : { width: w, maxWidth: "94vw", transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <div
          onPointerDown={onHeadDown} onPointerMove={onHeadMove} onPointerUp={onHeadUp}
          className={`h-11 shrink-0 flex items-center gap-2.5 px-4 border-b border-[var(--line)] card-head touch-none select-none ${full ? "" : "rounded-t-xl cursor-move"}`}
          title={full ? undefined : "拖动移动窗口"}
        >
          <Icon name={icon} size={15} className="text-[var(--acc)]" />
          <span className="text-[13.5px] font-semibold text-[var(--tx-1)]">{title}</span>
          <span className="ml-auto flex items-center gap-1">
            {/* 需求3：全屏切换按钮 */}
            {allowFullscreen && (
              <button onClick={() => setFull((v) => !v)} onPointerDown={(e) => e.stopPropagation()}
                title={full ? "退出全屏" : "全屏显示"}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[var(--acc)] hover:bg-[var(--hov)] transition">
                <Icon name={full ? "collapse" : "fullscreen"} size={13} />
              </button>
            )}
            <button onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)] transition">
              <Icon name="close" size={13} />
            </button>
          </span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
        {footer && <div className="shrink-0 px-4 py-3 border-t border-[var(--line)] flex items-center justify-end gap-2 bg-[var(--head)] rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}

export function Btn({ children, kind = "ghost", onClick, disabled, title }: {
  children: React.ReactNode; kind?: "primary" | "ghost" | "danger" | "success";
  onClick?: () => void; disabled?: boolean; title?: string;
}) {
  const cls = {
    primary: "bg-[#0a84ff] hover:bg-[#3395ff] text-white border-transparent shadow-[0_4px_14px_rgba(10,132,255,.35)]",
    ghost: "bg-[var(--bg-3)] hover:bg-[var(--hov)] text-[var(--tx-1)] border-[var(--line)]",
    danger: "bg-[rgba(255,69,58,.12)] hover:bg-[rgba(255,69,58,.2)] text-[#d70015] dark:text-[#ff8b84] border-[rgba(255,69,58,.45)]",
    success: "bg-[rgba(48,209,88,.12)] hover:bg-[rgba(48,209,88,.2)] text-[#1f8f4d] dark:text-[#7ede99] border-[rgba(48,209,88,.45)]",
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`h-8 px-3.5 rounded-lg border text-[12.5px] font-medium transition-all active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none ${cls}`}>
      {children}
    </button>
  );
}

/* ================= 综合查询（需求3：全信息列可增减 / 复制 / 全屏；需求4：人员导入导出） ================= */

/* -------- 工资计算（与 SalaryPanel 逻辑保持一致） -------- */
interface AltRow { ym: string; tier: number; type?: "month" | "year"; }
interface AddonItem { id: string; label: string; steps: number; unit: number; }
interface AllowanceRow { id: string; label: string; detail: string; amount: number; }

const DEFAULT_ADDONS: AddonItem[] = [
  { id: "gaoTao", label: "高套", steps: 0, unit: 25 },
  { id: "xueLiFloat", label: "学历浮动", steps: 0, unit: 25 },
  { id: "fiveYear", label: "五年浮动", steps: 0, unit: 25 },
  { id: "xueLiFixed", label: "学历固定", steps: 0, unit: 25 },
  { id: "nian20", label: "20年固定", steps: 0, unit: 25 },
  // {/*{ id: "xianXiang", label: "县以下提高", steps: 0, unit: 25 },*/}
];
const ADDON_CAPS: Record<string, number> = { fiveYear: 1, xianXiang: 1, xueLiFixed: 4, nian20: 4 };
const AUTO_IDS = ["fiveYear", "xueLiFixed", "nian20"];
const DEFAULT_ALLOWANCES: AllowanceRow[] = [
  { id: "xzMulti", label: "西藏特殊津贴倍数", detail: "140%", amount: 0 },
  { id: "xzAbs", label: "西藏特殊津贴绝对额", detail: "", amount: 0 },
  { id: "zheSuan", label: "折算工龄补贴", detail: "", amount: 0 },
  { id: "zhuFang", label: "住房补贴", detail: "", amount: 0 },
];
const ADDON_OPTIONS = ["交通补贴", "通讯补贴", "餐补", "取暖补贴", "物业补贴", "年终绩效奖"];

function clampSteps(id: string, v: number) { return Math.min(ADDON_CAPS[id] ?? 99, Math.max(0, Math.round(Number(v) || 0))); }
const isAboveEdu = (eduIndex: number) => eduIndex <= 2;
function ruleSteps(id: string, above: boolean, workYears: number): number {
  switch (id) {
    case "fiveYear": return above && workYears >= 5 ? 1 : 0;
    case "xueLiFixed": return Math.min(4, Math.floor(workYears / 8));
    case "nian20": return Math.min(4, Math.floor(workYears / 20));
    default: return 0;
  }
}
function defaultAddons(above: boolean, workYears: number): AddonItem[] {
  return [
    { id: "gaoTao", label: "高套", steps: above ? 2 : 0, unit: 25 },
    { id: "xueLiFloat", label: "学历浮动", steps: above ? 1 : 0, unit: 25 },
    { id: "fiveYear", label: "五年浮动", steps: ruleSteps("fiveYear", above, workYears), unit: 25 },
    { id: "xueLiFixed", label: "学历固定", steps: ruleSteps("xueLiFixed", above, workYears), unit: 25 },
    { id: "nian20", label: "20年固定", steps: ruleSteps("nian20", above, workYears), unit: 25 },
    // {/*{ id: "xianXiang", label: "县以下提高", steps: 0, unit: 25 },*/}
  ]
}
/* 海拔折算工龄补贴（与 DetailPanel calcAltitudeSubsidy 一致） */
function calcAltitudeSubsidy(rows: AltRow[] | null | undefined, currentYear: number): number {
  const valid = (Array.isArray(rows) ? rows : []).filter(
    (r): r is AltRow => !!r && typeof r.ym === "string" && !!r.ym && typeof r.tier === "number" && Number.isFinite(r.tier)
  );
  if (!valid.length) return 0;
  const sorted = [...valid].sort((a, b) => a.ym.localeCompare(b.ym));
  const firstYear = parseInt(sorted[0].ym.slice(0, 4), 10);
  let total = 0;
  for (let jy = firstYear + 1; jy <= currentYear; jy++) {
    const janYm = `${jy}-01`;
    let cur = sorted[0].tier;
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].ym <= janYm) cur = sorted[i].tier;
      else break;
    }
    if (cur >= 1) total += 50 * cur;
  }
  return total;
}

type CalcSave = { params?: { educationIndex?: number; currentDutyIndex?: number }; results?: CalcRunResult | null };
type ItemsSave = { addons?: AddonItem[]; allowances?: AllowanceRow[]; v2?: boolean };

interface SalaryBreakdown {
  dutyWage: number; levelWage: number; levelGrade: string; dutyLabel: string;
  addons: Array<{ id: string; label: string; steps: number; amount: number }>;
  addonsTotal: number;
  basicSubtotal: number;
  allowances: Array<{ id: string; label: string; detail: string; amount: number }>;
  allowancesTotal: number;
  total: number;
  gradeStep: number;
}

const ITEMS_KEY = (id: number) => `gw_salary_items_v1_${id}`;
const CALC_KEY = (id: number) => `gw_calc_v1_${id}`;
const ALT_KEY = (id: number) => `gw_alt_${id}`;

function workYearsOf(p: Person): number {
  const y = /(\d{4})/.exec(p.join ?? "");
  return y ? Math.max(0, new Date().getFullYear() - Number(y[1])) : 0;
}

function eduIndexOf(p: Person): number {
  const i = EDUCATION_OPTIONS.indexOf(p.edu || "高中（无套改学历）");
  return i >= 0 ? i : 3;
}

function loadSalary(p: Person, zone: WageZone): SalaryBreakdown {
  const currentYear = new Date().getFullYear();

  // 读取测算结果与 addons/allowances
  let calc: CalcSave = {};
  try { const raw = localStorage.getItem(CALC_KEY(p.id)); if (raw) calc = JSON.parse(raw) || {}; } catch { /* ignore */ }
  let items: ItemsSave = {};
  try { const raw = localStorage.getItem(ITEMS_KEY(p.id)); if (raw) items = JSON.parse(raw) || {}; } catch { /* ignore */ }
  let altRows: AltRow[] = [];
  try { const raw = localStorage.getItem(ALT_KEY(p.id)); if (raw) altRows = JSON.parse(raw) || []; } catch { /* ignore */ }

  const eduIndex = (calc.params?.educationIndex ?? eduIndexOf(p));
  const workYears = workYearsOf(p);
  const r = calc.results;
  const finalLevel = r?.finalLevel ?? 25;
  const finalGrade = r?.finalGrade ?? 2;
  const finalDutyIndex = (r?.finalDutyIndex ?? (calc.params?.currentDutyIndex ?? 0));
  const levelWage = Calculator.getSalary(finalLevel, finalGrade);
  const levelWageNext = Calculator.getSalary(finalLevel, finalGrade + 1);
  const levelWagePrev = Calculator.getSalary(finalLevel, finalGrade - 1);
  let gradeStep = levelWageNext > levelWage ? levelWageNext - levelWage : (levelWage > levelWagePrev ? levelWage - levelWagePrev : 25);
  const dutyLabelRaw = (r?.hero?.duty) || POLICY_CONFIG.getLabel(finalDutyIndex) || DUTY_OPTIONS[Math.min(DUTY_OPTIONS.length - 1, Math.max(0, finalDutyIndex))] || "办事员";
  const dutyLabel = dutyLabelRaw.replace(/^职务[：:]\s*/, "");  // 去掉 hero.duty 的"职务："前缀
  const dutyWage = dutyWage2006(finalDutyIndex);
  const levelGrade = `${finalLevel}-${finalGrade}`;

  // addons 合并（存档 → 默认 + 学历规则 → 自动档合并）
  const defs = defaultAddons(isAboveEdu(eduIndex), workYears);
  const savedAddons: AddonItem[] = Array.isArray(items.addons) ? items.addons : [];
  const merged: AddonItem[] = defs.map((d) => {
    const s = savedAddons.find((a) => a.id === d.id);
    if (!s) return { ...d };
    const steps = AUTO_IDS.includes(d.id) ? Math.max(ruleSteps(d.id, isAboveEdu(eduIndex), workYears), clampSteps(d.id, s.steps)) : clampSteps(d.id, s.steps);
    return { ...d, steps };
  });
  // 补上存档里有但默认没有的扩展 addon
  savedAddons.forEach((s) => { if (!merged.some((m) => m.id === s.id)) merged.push({ ...s }); });
  const extraSteps = merged.reduce((sum, a) => sum + a.steps, 0);
  const addonsTotal = extraSteps * gradeStep;
  const addonRows = merged.map((a) => ({ id: a.id, label: a.label, steps: a.steps, amount: a.steps * gradeStep }));

  // allowances 处理（海拔、西藏津贴按规则计算）
  const altitudeSubsidy = calcAltitudeSubsidy(altRows, currentYear);
  const tibetFactor = getTibetFactor(zone);
  const basicSubtotal = dutyWage + levelWage + addonsTotal;
  const savedAllowances: AllowanceRow[] = Array.isArray(items.allowances) ? items.allowances : [];
  const ws: AllowanceRow[] = savedAllowances.length
    ? savedAllowances.map((a) => ({ ...a }))
    : DEFAULT_ALLOWANCES.map((a) => ({ ...a }));
  // 补齐缺失的默认项
  DEFAULT_ALLOWANCES.forEach((d) => { if (!ws.some((w) => w.id === d.id)) ws.push({ ...d }); });
  const effectiveAllowances = ws.map((a) => {
    if (a.id === "zheSuan") return { ...a, amount: altitudeSubsidy, detail: "按海拔档次累计" };
    if (a.id === "xzMulti") return { ...a, amount: Math.round(basicSubtotal * tibetFactor), detail: `${Math.round(tibetFactor * 100)}%（${zone}）` };
    if (a.id === "xzAbs") return { ...a, amount: getTibetAbs(dutyLabel, zone), detail: zone };
    return a;
  });
  const allowancesTotal = effectiveAllowances.reduce((s, a) => s + a.amount, 0);
  const total = basicSubtotal + allowancesTotal;

  return { dutyWage, levelWage, levelGrade, dutyLabel, addons: addonRows, addonsTotal, basicSubtotal, allowances: effectiveAllowances, allowancesTotal, total, gradeStep };
}

const M2 = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

/* 信息列定义 —— QCol 允许 getter 动态访问工资 breakdown（由 salaryOf 函数统一返回） */
interface SalaryCtx {
  salary: SalaryBreakdown;
  unitName: (id: string) => string;
  zone: WageZone;
}
type ColGetter = (p: Person, ctx: SalaryCtx) => string;
interface QCol2 { key: string; label: string; mono?: boolean; group?: string; get: ColGetter; }

const pLast = (p: Person) => p.history[p.history.length - 1];

const INFO_COLS: QCol2[] = [
  { key: "id", label: "序号", mono: true, group: "基础信息", get: (p) => String(p.id) },
  { key: "name", label: "姓名", group: "基础信息", get: (p) => p.name },
  { key: "idCard", label: "身份证号", mono: true, group: "基础信息", get: (p) => (p as Person & { idCard?: string | null }).idCard || "—" },
  { key: "gender", label: "性别", group: "基础信息", get: (p) => p.gender },
  { key: "birth", label: "出生年月", mono: true, group: "基础信息", get: (p) => p.birth },
  { key: "join", label: "参公时间", mono: true, group: "基础信息", get: (p) => p.join },
  { key: "identity", label: "身份", group: "基础信息", get: (p) => p.identity },
  { key: "edu", label: "学历", group: "基础信息", get: (p) => p.edu },
  { key: "unit", label: "单位", group: "基础信息", get: (p, { unitName }) => `[${p.unitId}] ${unitName(p.unitId)}` },
  { key: "tag", label: "人员状态", group: "基础信息", get: (p) => p.tag },
  { key: "employ", label: "在职状态", group: "基础信息", get: (p) => p.employ },
  { key: "position", label: "现职务职级", group: "职务/级别/套改", get: (p) => p.position || "—" },
  { key: "duty", label: "职务", group: "职务/级别/套改", get: (p) => latestDutyLabel(p) || "—" },
  { key: "level", label: "级别", mono: true, group: "职务/级别/套改", get: (p) => (p.history.length ? fmtLevel(pLast(p).level) : "—") },
  { key: "curType", label: "高套类型", group: "职务/级别/套改", get: (p) => p.curType || "—" },
  { key: "eduFloat", label: "学历浮动(套改)", group: "职务/级别/套改", get: (p) => p.tgEdu?.result || "—" },
  { key: "taogai", label: "套改结果", group: "职务/级别/套改", get: (p) => p.tgNow?.result || "—" },
  { key: "gap", label: "工龄间断", mono: true, group: "职务/级别/套改", get: (p) => `${p.gap} 年` },
  { key: "tYears", label: "套改年限", mono: true, group: "职务/级别/套改", get: (p) => `${p.tYears} 年` },
  { key: "unq", label: "不称职年说明", group: "职务/级别/套改", get: (p) => p.unq || "—" },
];

/* 工资列（动态计算） */
const WAGE_BASE_COLS: QCol2[] = [
  { key: "w_duty", label: "职务工资", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.dutyWage) },
  { key: "w_level", label: "级别工资", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.levelWage) },
  { key: "w_levelGrade", label: "级别/档次", mono: true, group: "基本工资", get: (_p, { salary }) => salary.levelGrade },
  { key: "w_dutyLabel", label: "执行职务", group: "基本工资", get: (_p, { salary }) => salary.dutyLabel },
  { key: "w_gradeStep", label: "档差", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.gradeStep) },
  { key: "w_gaoTao", label: "高套(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "gaoTao")?.amount ?? 0) },
  { key: "w_xueLiFloat", label: "学历浮动(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "xueLiFloat")?.amount ?? 0) },
  { key: "w_fiveYear", label: "五年浮动(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "fiveYear")?.amount ?? 0) },
  { key: "w_xueLiFixed", label: "学历固定(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "xueLiFixed")?.amount ?? 0) },
  { key: "w_nian20", label: "20年固定(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "nian20")?.amount ?? 0) },
  // {/*{ key: "w_xianXiang", label: "县以下提高(金额)", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.addons.find((a) => a.id === "xianXiang")?.amount ?? 0) },*/}
  { key: "w_basicSubtotal", label: "基本工资小计", mono: true, group: "基本工资", get: (_p, { salary }) => M2(salary.basicSubtotal) },
];

const WAGE_ALLOW_COLS: QCol2[] = [
  { key: "w_xzMulti", label: "西藏特殊津贴倍数", mono: true, group: "津贴补贴", get: (_p, { salary }) => { const a = salary.allowances.find((x) => x.id === "xzMulti"); return a ? M2(a.amount) : "—"; } },
  { key: "w_xzAbs", label: "西藏特殊津贴绝对额", mono: true, group: "津贴补贴", get: (_p, { salary }) => { const a = salary.allowances.find((x) => x.id === "xzAbs"); return a ? M2(a.amount) : "—"; } },
  { key: "w_zheSuan", label: "折算工龄补贴", mono: true, group: "津贴补贴", get: (_p, { salary }) => { const a = salary.allowances.find((x) => x.id === "zheSuan"); return a ? M2(a.amount) : "—"; } },
  { key: "w_zhuFang", label: "住房补贴", mono: true, group: "津贴补贴", get: (_p, { salary }) => { const a = salary.allowances.find((x) => x.id === "zhuFang"); return a ? M2(a.amount) : "—"; } },
];

/* 自定义津贴项目列（用户在 SalaryPanel 中添加，id 以 w_aid_ 开头，内存中仅展示出现过的标签） */
const CUSTOM_ALLOW_LABELS: string[] = ADDON_OPTIONS.slice();

const WAGE_TOTAL_COLS: QCol2[] = [
  { key: "w_addonsTotal", label: "加项金额合计", mono: true, group: "合计", get: (_p, { salary }) => M2(salary.addonsTotal) },
  { key: "w_allowancesTotal", label: "津贴补贴合计", mono: true, group: "合计", get: (_p, { salary }) => M2(salary.allowancesTotal) },
  { key: "w_total", label: "工资合计", mono: true, group: "合计", get: (_p, { salary }) => M2(salary.total) },
];

/* 信息列定义（旧版 QCol 接口，通过 salaryMap 上下文桥接） */
interface QCol { key: string; label: string; mono?: boolean; group?: string; get: (p: Person, unitName: (id: string) => string, extras: { salaryMap: Map<number, SalaryBreakdown>; zoneMap: Map<string, WageZone> }) => string; }

function buildQCols(customAllowLabels: string[]): QCol[] {
  const fix = (c: QCol2): QCol => ({
    key: c.key, label: c.label, mono: c.mono, group: c.group,
    get: (p, un, { salaryMap, zoneMap }) => c.get(p, { salary: salaryMap.get(p.id) ?? loadSalaryDefault(), unitName: un, zone: zoneMap.get(p.unitId) ?? "二类区" }),
  });
  const base: QCol[] = [...INFO_COLS.map(fix), ...WAGE_BASE_COLS.map(fix)];
  const allow = WAGE_ALLOW_COLS.map(fix);
  const customs: QCol[] = customAllowLabels.map((label) => ({
    key: `w_custom_${label}`, label, mono: true, group: "津贴补贴",
    get: (_p, _un, { salaryMap, zoneMap }) => {
      const list = [...salaryMap.entries()];
      const pid = _p.id;
      const sb = salaryMap.get(pid);
      if (!sb) return "—";
      const hit = sb.allowances.find((a) => a.label === label);
      return hit ? M2(hit.amount) : "—";
    },
  }));
  const total = WAGE_TOTAL_COLS.map(fix);
  return [...base, ...allow, ...customs, ...total];
}

function loadSalaryDefault(): SalaryBreakdown {
  return { dutyWage: 0, levelWage: 0, levelGrade: "—", dutyLabel: "—", addons: [], addonsTotal: 0, basicSubtotal: 0, allowances: [], allowancesTotal: 0, total: 0, gradeStep: 0 };
}

/* 从全部人员的存档中发现出现过的自定义津贴名 */
function discoverCustomAllowLabels(ids: number[]): string[] {
  const found = new Set<string>();
  for (const id of ids) {
    try {
      const raw = localStorage.getItem(ITEMS_KEY(id));
      if (!raw) continue;
      const v: ItemsSave = JSON.parse(raw);
      if (Array.isArray(v.allowances)) {
        v.allowances.forEach((a) => {
          if (!DEFAULT_ALLOWANCES.some((d) => d.id === a.id)) found.add(a.label);
        });
      }
    } catch { /* ignore */ }
  }
  return [...CUSTOM_ALLOW_LABELS.filter((l) => !DEFAULT_ALLOWANCES.some((d) => d.label === l)), ...[...found]].filter((v, i, a) => a.indexOf(v) === i);
}

/* 默认显示列（精简） */
const DEFAULT_COLS = ["id", "name", "idCard", "gender", "birth", "join", "position", "duty", "level", "curType", "unit", "tag", "employ", "w_duty", "w_level", "w_total"];
const LS_QCOLS = "gw_query_cols_v2";

/* 需求4：人员全字段指纹（去掉编号与流水号，用于重复判定） */
function normPerson(p: unknown): string {
  try {
    const { id: _id, ...rest } = (p ?? {}) as Record<string, unknown> & { id?: number };
    const hist = Array.isArray(rest.history)
      ? (rest.history as Record<string, unknown>[]).map((h) => { const { seq: _seq, ...row } = h; return row; })
      : rest.history;
    return JSON.stringify({ ...rest, history: hist });
  } catch { return JSON.stringify(p); }
}

/* 轻量级：按身份核心字段判定为同一自然人
   身份证号优先（精确去重）；回退姓名+出生+身份组合。 */
function personKey(p: Person): string {
  const card = typeof (p as Person & { idCard?: string | null }).idCard === "string"
    ? (p as Person & { idCard?: string | null }).idCard?.trim() ?? ""
    : "";
  if (card) return `CARD|${card}`;
  const n = (p.name ?? "").trim();
  const b = (p.birth ?? "").trim();
  const i = (p.identity ?? "").trim();
  return `${n}|${b}|${i}`;
}
interface ImportRow {
  person: Person;
  inputs?: PersonInputs | null;
  hasInputs: boolean;    // 含完整快照（测算参数/档次/海拔/考核），预览时图标标记
  isDup: boolean;
  dupWith?: string;      // 与库内哪位人员重复（姓名）
}

/* 需求4：时间戳文件名 */
const fileStamp = () => {
  const d = new Date(); const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
};

export function QueryModal({ persons, units, canEdit, onClose, onLocate, onToast, onImport }: {
  persons: Person[]; units: Unit[]; canEdit: boolean; onClose: () => void;
  onLocate: (id: number) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
  onImport: (payload: ParsedImportResult & { selectedIdx: number[] }) => void;
}) {
  const [kw, setKw] = useState("");
  const [tag, setTag] = useState("all");
  const [emp, setEmp] = useState("all");

  /* 需求修复：自定义津贴列发现 */
  const customLabels = useMemo(() => discoverCustomAllowLabels(persons.map((p) => p.id)), [persons]);
  const QCOLS = useMemo(() => buildQCols(customLabels), [customLabels]);

  /* 预计算工资 breakdown（按 id 缓存） */
  const zoneMap = useMemo(() => {
    const m = new Map<string, WageZone>();
    units.forEach((u) => m.set(u.id, u.zone ?? "二类区"));
    return m;
  }, [units]);
  const salaryMap = useMemo(() => {
    const m = new Map<number, SalaryBreakdown>();
    persons.forEach((p) => m.set(p.id, loadSalary(p, zoneMap.get(p.unitId) ?? "二类区")));
    return m;
  }, [persons, zoneMap]);

  const extras = useMemo(() => ({ salaryMap, zoneMap }), [salaryMap, zoneMap]);

  /* 需求3：信息列（可自行增减，记忆到 localStorage；校验 key 对应当前 QCOLS） */
  const [cols, setCols] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_QCOLS) ?? "null");
      if (Array.isArray(saved) && saved.length && saved.every((k: string) => QCOLS.some((c) => c.key === k))) return saved;
    } catch { /* ignore */ }
    return DEFAULT_COLS.filter((k) => QCOLS.some((c) => c.key === k));
  });
  /* 自定义津贴标签变化时，允许新增的 key 不触发重置 */
  useEffect(() => {
    setCols((prev) => {
      const next = prev.filter((k) => QCOLS.some((c) => c.key === k));
      return next.length ? next : DEFAULT_COLS.filter((k) => QCOLS.some((c) => c.key === k));
    });
  }, [QCOLS]);

  const [colOpen, setColOpen] = useState(false);
  /* 需求4：勾选人员 */
  const [selIds, setSelIds] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  /* ============ 人员导入预览弹窗状态 ============ */
  const [impOpen, setImpOpen] = useState(false);
  const [impRows, setImpRows] = useState<ImportRow[]>([]);
  const [impSel, setImpSel] = useState<Set<number>>(new Set());
  const [impUnits, setImpUnits] = useState<Unit[] | undefined>(undefined);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "";

  const rows = useMemo(() => persons.filter((p) => {
    const k = kw.trim().toLowerCase();
    const hitK = !k || p.name.toLowerCase().includes(k) || String(p.id) === k || p.unitId.includes(k);
    const hitT = tag === "all" || p.tag === tag;
    const hitE = emp === "all" || p.employ === (emp as Employ);
    return hitK && hitT && hitE;
  }), [persons, kw, tag, emp]);

  const activeCols = cols.map((k) => QCOLS.find((c) => c.key === k)).filter(Boolean) as QCol[];
  const toggleCol = (k: string) => {
    setCols((arr) => {
      const next = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];
      const ordered = QCOLS.filter((c) => next.includes(c.key)).map((c) => c.key);
      try { localStorage.setItem(LS_QCOLS, JSON.stringify(ordered)); } catch { /* ignore */ }
      return ordered;
    });
  };

  /* 分组展示列配置 */
  const groupedCols = useMemo(() => {
    const groups = new Map<string, QCol[]>();
    QCOLS.forEach((c) => {
      const g = c.group ?? "其他";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(c);
    });
    return [...groups.entries()];
  }, [QCOLS]);

  /* 需求4：全选 / 反选（作用于当前筛选结果） */
  const allSel = rows.length > 0 && rows.every((p) => selIds.has(p.id));
  const toggleAll = () => setSelIds((s) => {
    const next = new Set(s);
    if (allSel) rows.forEach((p) => next.delete(p.id));
    else rows.forEach((p) => next.add(p.id));
    return next;
  });
  const toggleSel = (id: number) => setSelIds((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /* 需求3：左下角复制按钮（TSV 到剪贴板，含 execCommand 降级） */
  const copyRows = async () => {
    if (!rows.length) { onToast("info", "当前无人员可复制"); return; }
    let text = activeCols.map((c) => c.label).join("\t") + "\n";
    rows.forEach((p) => { text += activeCols.map((c) => c.get(p, unitName, extras)).join("\t") + "\n"; });
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      document.body.removeChild(ta);
      return ok;
    };
    let done = false;
    try { await navigator.clipboard.writeText(text); done = true; } catch { done = false; }
    if (!done) done = legacyCopy();
    if (done) onToast("success", `已复制 ${rows.length} 名人员（${activeCols.length} 列）到剪贴板`);
    else onToast("error", "复制失败，请手动选择文本");
  };

  /* 【Spec】人员导出：仅输入项快照（不含系统推算结果 + 含 7 类 inputs） */
  const exportSel = () => {
    if (selIds.size === 0) { onToast("error", "请先在列表中勾选要导出的人员"); return; }
    try {
      const selected = persons.filter((p) => selIds.has(p.id));
      const payload = buildExportPayload(selected, units, (k) => localStorage.getItem(k));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `人员导出_${fileStamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onToast("success", `已导出 ${selected.length} 名人员（输入项快照，不含系统推算结果）`);
    } catch (err) {
      console.error("[exportSel] failed", err);
      onToast("error", "导出失败：浏览器环境异常");
    }
  };

  /* ============ 人员导入预览弹窗相关 ============ */
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    let parsed: ParsedImportResult;
    try {
      const rawText = await f.text();
      let raw: unknown;
      try { raw = JSON.parse(rawText); } catch { onToast("error", "导入失败：文件不是有效的 JSON"); return; }
      parsed = parseImportPayload(raw);
    } catch {
      onToast("error", "导入失败：读取文件失败"); return;
    }
    const list = parsed.persons as Array<Person & { inputs?: PersonInputs }>;
    const fileUnits = parsed.units.length ? parsed.units : undefined;
    if (!list.length) { onToast("error", "导入失败：文件中没有人员数据"); return; }

    /* 使用轻量身份字段构建库内人员查找表 */
    const keyMap = new Map<string, string>();
    persons.forEach((p) => keyMap.set(personKey(p), p.name));

    /* 校验文件中每项为基本合法的 Person（必填字段兜底），并对所有导入项调 stripOutputs 保证无输出项 */
    const cleaned: Array<Person & { inputs?: PersonInputs }> = list
      .filter((x) => x && typeof x === "object")
      .map((raw, idx) => {
        const p: Person = stripOutputs({
          id: typeof (raw as Person).id === "number" ? (raw as Person).id : idx,
          name: String((raw as Person).name ?? `未命名_${idx + 1}`),
          idCard: typeof (raw as Person & { idCard?: unknown }).idCard === "string"
            ? (raw as Person & { idCard?: string }).idCard
            : null,
          gender: ((raw as Person).gender === "女" ? "女" : "男") as "男" | "女",
          identity: String((raw as Person).identity ?? "公务员"),
          leader: String((raw as Person).leader ?? ""),
          birth: String((raw as Person).birth ?? ""),
          edu: String((raw as Person).edu ?? "大学本科毕业"),
          studyYears: Number((raw as Person).studyYears) || 0,
          tag: String((raw as Person).tag ?? "普通工改"),
          employ: (["在职", "退休", "止薪"].includes((raw as Person).employ) ? (raw as Person).employ : "在职") as Employ,
          unitId: String((raw as Person).unitId ?? "0001"),
          position: String((raw as Person).position ?? ""),
          join: String((raw as Person).join ?? ""),
          gap: Number((raw as Person).gap) || 0,
          unq: String((raw as Person).unq ?? "无考核记录"),
          tYears: 0, curType: "待测算",
          tgLabels: ["按现职套", "按低职套", "按学历套"],
          tgNow: { result: "—", note: "待测算" },
          tgLow: { result: "—", note: "待测算" },
          tgEdu: { result: "—", note: "待测算" },
          history: [],
        } satisfies Person);
        return { ...p, inputs: (raw as { inputs?: PersonInputs }).inputs ?? undefined } as Person & { inputs?: PersonInputs };
      });

    if (cleaned.length === 0) { onToast("error", "导入失败：文件中人员数据格式无效"); return; }

    /* 构建预览行 + 重复判定（hasInputs 标记含完整快照） */
    const rowsArr: ImportRow[] = cleaned.map((p) => {
      const k = personKey(p);
      const dupN = keyMap.get(k);
      const inp = p.inputs as PersonInputs | undefined;
      const hasInputs = !!(inp && typeof inp === "object" && (inp.params || inp.positionChanges?.length || inp.altChanges?.length || inp.reviews?.length || inp.gradeAddons?.length || inp.allowances?.length));
      return { person: p, inputs: inp ?? null, hasInputs, isDup: !!dupN, dupWith: dupN };
    });

    /* 默认勾选：全部不重复的人员；重复人员不勾选（默认不覆盖，避免误覆盖已有手改） */
    const defaultSel = new Set<number>();
    rowsArr.forEach((r, i) => { if (!r.isDup) defaultSel.add(i); });

    setImpRows(rowsArr);
    setImpSel(defaultSel);
    setImpUnits(fileUnits);
    setImpOpen(true);
  };

  /* 取消导入预览 */
  const cancelImp = () => { setImpOpen(false); setImpRows([]); setImpSel(new Set()); setImpUnits(undefined); };

  /* 切换预览单行勾选 */
  const toggleImpRow = (idx: number) => {
    setImpSel((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  /* 切换预览全选 */
  const allImpChecked = impRows.length > 0 && impSel.size === impRows.length;
  const toggleImpAll = () => {
    if (allImpChecked) setImpSel(new Set());
    else setImpSel(new Set(impRows.map((_, i) => i)));
  };

  /* 确认导入（仅勾选的人员） — 将 V1/V2 解析结果、附带单位、勾选下标、导入行 inputs 透传给 App.tsx */
  const confirmImp = () => {
    const chosenIdx: number[] = [];
    impSel.forEach((i) => { if (impRows[i]) chosenIdx.push(i); });
    if (chosenIdx.length === 0) {
      onToast("info", "未勾选任何人员，已取消导入");
      return;
    }
    // 重建 ParsedImportResult（其中 persons 只保留勾选且已清洗的 Person；inputs 在各自对象上）
    const chosen: Array<Person & { inputs?: PersonInputs }> = chosenIdx.map((i) => {
      const r = impRows[i];
      const base = r.person as Person & { inputs?: PersonInputs };
      if (r.inputs) base.inputs = r.inputs;
      return base;
    });
    const isV2 = impRows.some((r) => r.hasInputs || !!r.inputs);
    const base: ParsedImportResult = isV2
      ? { version: 2, units: impUnits ?? [], persons: chosen }
      : { version: 1, units: impUnits ?? [], persons: chosen as Person[] };
    onImport({ ...base, selectedIdx: chosenIdx });
    cancelImp();
  };

  return (
    <>
    <Modal title="综合查询" icon="query" onClose={onClose} w={860} allowFullscreen
      footer={
        <>
          {/* 需求3：左下角复制按钮；需求4：人员导入 / 导出按钮在复制右侧 */}
          <div className="mr-auto flex items-center gap-2">
            <Btn onClick={copyRows}><span className="flex items-center gap-1"><Icon name="copy" size={12} />复制</span></Btn>
            <Btn onClick={exportSel}><span className="flex items-center gap-1"><Icon name="download" size={12} />人员导出</span></Btn>
            <Btn onClick={() => fileRef.current?.click()} disabled={!canEdit}
              title={canEdit ? "导入人员 JSON 文件" : "导入人员需要可编辑权限"}>
              <span className="flex items-center gap-1"><Icon name="folder" size={12} />人员导入</span>
            </Btn>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
          </div>
          <span className="text-[11px] text-[var(--tx-3)]">命中 <b className="font-mono2 text-[var(--tx-2)]">{rows.length}</b> 条 · 已选 <b className="font-mono2 text-[var(--tx-2)]">{selIds.size}</b> · 双击行可快速定位</span>
          <Btn onClick={onClose}>关闭</Btn>
        </>
      }>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
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
        {/* 需求3：信息列增减（按组显示） */}
        <div className="relative">
          <button onClick={() => setColOpen((v) => !v)}
            className={`h-8 px-2.5 rounded-md border text-[12px] flex items-center gap-1 transition active:scale-95 ${
              colOpen ? "border-[rgba(10,132,255,.6)] bg-[var(--sel)] text-[var(--acc)]" : "border-[var(--line)] bg-[var(--bg-2)] text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)]"
            }`}>
            <Icon name="grid" size={12} />信息列
            <span className="font-mono2 text-[10px] text-[var(--tx-3)]">{cols.length}/{QCOLS.length}</span>
          </button>
          {colOpen && (
            <>
              <span className="fixed inset-0 z-[39]" onMouseDown={() => setColOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-40 w-[240px] max-h-[380px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--bg-2)] shadow-[0_12px_32px_rgba(10,20,45,.28)] py-1 anim-fade">
                <div className="flex items-center gap-1 px-2 pb-1 mb-0.5 border-b border-[var(--line-2)]">
                  <button onClick={() => { setCols(QCOLS.map((c) => c.key)); try { localStorage.setItem(LS_QCOLS, JSON.stringify(QCOLS.map((c) => c.key))); } catch { /* ignore */ } }}
                    className="text-[10.5px] px-1.5 py-1 rounded text-[var(--acc)] hover:bg-[var(--sel)] transition">全选</button>
                  <button onClick={() => { setCols(DEFAULT_COLS.filter((k) => QCOLS.some((c) => c.key === k))); try { localStorage.setItem(LS_QCOLS, JSON.stringify(DEFAULT_COLS.filter((k) => QCOLS.some((c) => c.key === k)))); } catch { /* ignore */ } }}
                    className="text-[10.5px] px-1.5 py-1 rounded text-[var(--tx-2)] hover:bg-[var(--hov)] transition">恢复默认</button>
                  <span className="ml-auto text-[10px] text-[var(--tx-3)]">共 {QCOLS.length} 列</span>
                </div>
                {groupedCols.map(([g, items]) => (
                  <div key={g} className="py-0.5">
                    <div className="px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--tx-3)]">{g}</div>
                    {items.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 px-2.5 py-[3px] text-[11.5px] hover:bg-[var(--hov)] cursor-pointer transition text-[var(--tx-1)]">
                        <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)}
                          className="w-3.5 h-3.5 accent-[#0a84ff] shrink-0" />
                        <span className={cols.includes(c.key) ? "font-medium" : ""}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--line)] overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {/* 需求4：勾选列 */}
                <th className="tbl-head px-2 py-1.5 text-center w-[36px]">
                  <input type="checkbox" checked={allSel} onChange={toggleAll} title="全选 / 反选" className="w-3.5 h-3.5 accent-[#0a84ff]" />
                </th>
                {activeCols.map((c) => (
                  <th key={c.key} className="tbl-head px-2.5 py-1.5 text-left whitespace-nowrap">{c.label}</th>
                ))}
                <th className="tbl-head px-2 py-1.5 text-center w-[56px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={activeCols.length + 2} className="px-3 py-10 text-center text-[var(--tx-3)]">
                  <Icon name="search" size={20} className="mx-auto mb-2 text-[var(--tx-3)]" />未查询到符合条件的人员
                </td></tr>
              )}
              {rows.map((p) => {
                const sel = selIds.has(p.id);
                return (
                  <tr key={p.id} onDoubleClick={() => onLocate(p.id)}
                    className={`border-b border-[var(--line-2)] cursor-pointer transition-colors ${sel ? "bg-[var(--sel)]" : "hover:bg-[var(--sel)]"}`}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={sel} onChange={() => toggleSel(p.id)} className="w-3.5 h-3.5 accent-[#0a84ff]" />
                    </td>
                    {activeCols.map((c) => (
                      <td key={c.key} className={`px-2.5 py-1.5 whitespace-nowrap ${c.mono ? "font-mono2" : ""} ${
                        c.key === "id" ? "text-[var(--acc)]" : c.key === "name" ? "text-[var(--tx-1)] font-medium" : "text-[var(--tx-2)]"
                      }`}>
                        {c.key === "tag" ? (
                          <span className={`text-[10px] px-1.5 py-[3px] rounded border ${TAG_META[p.tag]?.cls}`}>{p.tag}</span>
                        ) : c.key === "employ" ? (
                          <span className="flex items-center gap-1.5 w-fit text-[10.5px] px-1.5 py-[3px] rounded border" style={{ color: EMPLOY_META[p.employ].dot, borderColor: `${EMPLOY_META[p.employ].dot}55` }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: EMPLOY_META[p.employ].dot }} />{p.employ}
                          </span>
                        ) : (
                          c.get(p, unitName, extras)
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
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
      <p className="mt-2 text-[10.5px] text-[var(--tx-3)] flex items-center gap-1">
        <Icon name="info" size={11} />
        勾选人员后「人员导出」可导出单位、性别、历次任职情况等全部人工填写数据；导入时将弹窗预览所有人员，重复人员红色标记并默认不勾选。
      </p>
    </Modal>

    {/* ============ 人员导入预览弹窗 ============ */}
    {impOpen && (
      <Modal title="人员导入预览" icon="folder" onClose={cancelImp} w={760} allowFullscreen
        footer={
          <>
            <span className="mr-auto text-[11.5px] text-[var(--tx-3)]">
              共 <b className="font-mono2 text-[var(--tx-2)]">{impRows.length}</b> 人
              · 重复 <b className="font-mono2 text-[#ff453a]">{impRows.filter((r) => r.isDup).length}</b> 人（红色）
              · 已选 <b className="font-mono2 text-[var(--acc)]">{impSel.size}</b> 人
            </span>
            <Btn onClick={cancelImp}>取消</Btn>
            <Btn kind="primary" onClick={confirmImp}>确认导入</Btn>
          </>
        }>
        <div className="flex items-center gap-3 mb-3 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-[#ff453a] bg-[rgba(255,69,58,.1)]" />
            <span className="text-[var(--tx-2)]">红色 = 与库内人员身份重复</span>
          </span>
          <span className="text-[var(--tx-3)]">|</span>
          <span className="text-[var(--tx-3)]">默认仅勾选非重复人员；如需强制导入重复人员，可手动勾选。</span>
        </div>

        <div className="rounded-lg border border-[var(--line)] overflow-hidden">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="tbl-head px-2 py-1.5 text-center w-[36px]">
                    <input type="checkbox" checked={allImpChecked} onChange={toggleImpAll} title="全选 / 反选" className="w-3.5 h-3.5 accent-[#0a84ff]" />
                  </th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[54px]">#</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left">姓名</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[48px]">性别</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[108px]">出生</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left">单位</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[110px]">职务</th>
                  <th className="tbl-head px-2.5 py-1.5 text-center w-[60px]">含参数</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[90px]">状态</th>
                  <th className="tbl-head px-2.5 py-1.5 text-left w-[120px]">重复提示</th>
                </tr>
              </thead>
              <tbody>
                {impRows.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-[var(--tx-3)]">暂无待导入人员</td></tr>
                )}
                {impRows.map((r, i) => {
                  const p = r.person;
                  const checked = impSel.has(i);
                  return (
                    <tr key={i}
                      className={`border-b border-[var(--line-2)] transition-colors ${
                        r.isDup
                          ? "bg-[rgba(255,69,58,.08)] hover:bg-[rgba(255,69,58,.16)]"
                          : checked ? "bg-[var(--sel)]" : "hover:bg-[var(--sel)]"
                      }`}>
                      <td className="px-2 py-1.5 text-center">
                        <input type="checkbox" checked={checked} onChange={() => toggleImpRow(i)} className="w-3.5 h-3.5 accent-[#0a84ff]" />
                      </td>
                      <td className="px-2.5 py-1.5 font-mono2 text-[var(--tx-3)] text-[11px]">{i + 1}</td>
                      <td className={`px-2.5 py-1.5 font-medium ${r.isDup ? "text-[#ff453a]" : "text-[var(--tx-1)]"}`}>{p.name}</td>
                      <td className="px-2.5 py-1.5 text-[var(--tx-2)]">{p.gender}</td>
                      <td className="px-2.5 py-1.5 text-[var(--tx-2)] whitespace-nowrap font-mono2 text-[11.5px]">{p.birth || "—"}</td>
                      <td className="px-2.5 py-1.5 text-[var(--tx-2)] truncate max-w-[160px]" title={unitName(p.unitId) || p.unitId}>
                        {unitName(p.unitId) || <span className="text-[var(--tx-3)]">[{p.unitId}]</span>}
                      </td>
                      <td className="px-2.5 py-1.5 text-[var(--tx-2)] truncate max-w-[130px]" title={p.position}>{p.position || "—"}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        {r.hasInputs ? (
                          <span title="含完整输入项快照（测算参数/档次/津贴等）" className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-[3px] rounded border border-[rgba(48,209,88,.55)] bg-[rgba(48,209,88,.1)] text-[#30d158]">
                            <Icon name="check" size={10} />快照
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--tx-3)]">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <span className="flex items-center gap-1 w-fit text-[10.5px] px-1.5 py-[3px] rounded border" style={{
                          color: EMPLOY_META[p.employ as Employ]?.dot ?? "#30d158",
                          borderColor: `${EMPLOY_META[p.employ as Employ]?.dot ?? "#30d158"}55`,
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: EMPLOY_META[p.employ as Employ]?.dot ?? "#30d158" }} />
                          {p.employ}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5">
                        {r.isDup ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-[3px] rounded border border-[rgba(255,69,58,.45)] bg-[rgba(255,69,58,.08)] text-[#ff453a]">
                            <Icon name="warn" size={11} /> 与库内「{r.dupWith}」重复
                          </span>
                        ) : (
                          <span className="text-[11px] text-[var(--tx-3)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {impUnits && impUnits.length > 0 && (
          <p className="mt-3 text-[11px] text-[var(--tx-3)] flex items-center gap-1.5">
            <Icon name="unit" size={11} />
            文件附带 <b className="font-mono2 text-[var(--tx-2)]">{impUnits.length}</b> 个单位信息，导入时将自动补全库中缺失的单位。
          </p>
        )}
      </Modal>
    )}
    </>
  );
}

/* ================= 增加单位（需求1） ================= */
export function UnitModal({ units, persons, canEdit, onClose, onAdd, onRemove, onEdit }: {
  units: Unit[]; persons: Person[]; canEdit: boolean; onClose: () => void;
  onAdd: (id: string, name: string, zone: WageZone) => void; onRemove: (id: string) => void;
  onEdit: (id: string, name: string, zone: WageZone) => void;
}) {
  const next = String(Math.max(0, ...units.map((u) => parseInt(u.id, 10))) + 1).padStart(4, "0");
  const [id, setId] = useState(next);
  const [name, setName] = useState("");
  const [zone, setZone] = useState<WageZone>("二类区");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editZone, setEditZone] = useState<WageZone>("二类区");

  return (
    <Modal title="单位管理" icon="unit" onClose={onClose} w={520}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" disabled={!canEdit} onClick={() => { onAdd(id, name, zone); setId(String(Math.max(0, ...units.map((u) => parseInt(u.id, 10)), parseInt(id || "0", 10)) + 1).padStart(4, "0")); setName(""); setZone("二类区"); }}>确认增加</Btn></>}>
      <div className="grid grid-cols-3 gap-2.5">
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
        <label className="text-[11px] text-[var(--tx-2)]">
          工资类区
          <select value={zone} onChange={(e) => setZone(e.target.value as WageZone)}
            className="field mt-1 w-full h-8 px-2 text-[12.5px]">
            {WAGE_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
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
              {editId === u.id ? (
                <>
                  <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="field h-7 flex-1 min-w-0 px-2 text-[12.5px]" />
                  <select value={editZone} onChange={(e) => setEditZone(e.target.value as WageZone)}
                    className="field h-7 w-[84px] px-1.5 text-[12px]">
                    {WAGE_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <button onClick={() => { onEdit(u.id, editName, editZone); setEditId(null); }} title="保存"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#1f8f4d] dark:text-[#7ede99] hover:bg-[rgba(48,209,88,.12)] transition">
                    <Icon name="check" size={12} />
                  </button>
                  <button onClick={() => setEditId(null)} title="取消"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:bg-[var(--hov)] transition">
                    <Icon name="close" size={12} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[12.5px] text-[var(--tx-1)] truncate">{u.name}</span>
                  <span className="shrink-0 text-[10px] px-1.5 py-px rounded border border-[rgba(10,132,255,.4)] bg-[var(--sel)] text-[var(--acc)]">{u.zone}</span>
                  <span className="ml-auto shrink-0 font-mono2 text-[10.5px] text-[var(--tx-3)]">{cnt} 人</span>
                  {/* 需求6：显性编辑按钮 */}
                  <button onClick={() => { setEditId(u.id); setEditName(u.name); setEditZone(u.zone); }} title="编辑单位" disabled={!canEdit}
                    className="shrink-0 h-6 px-2 rounded-md border border-[rgba(10,132,255,.45)] text-[10.5px] text-[var(--acc)] hover:bg-[var(--sel)] transition disabled:opacity-35">
                    编辑
                  </button>
                  <button onClick={() => onRemove(u.id)} title="删除单位" disabled={!canEdit}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--tx-3)] hover:text-[#d70015] dark:hover:text-[#ff8b84] hover:bg-[rgba(255,69,58,.1)] transition disabled:opacity-35">
                    <Icon name="trash" size={12} />
                  </button>
                </>
              )}
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

export function RecalcModal({ reports, onClose, onApply }: {
  reports: VerifyReport[]; onClose: () => void; onApply: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, reports.length)), 220);
    return () => clearInterval(t);
  }, [done, reports.length]);

  useEffect(() => {
    if (idx >= reports.length && !done) setDone(true);
  }, [idx, done, reports.length]);

  const pct = Math.round((idx / Math.max(1, reports.length)) * 100);
  const cnt = { match: 0, partial: 0, diff: 0, skip: 0 };
  reports.forEach((r) => { cnt[r.status]++; });
  const applicable = reports.length - cnt.skip;
  const endYear = new Date().getFullYear();

  return (
    <Modal title="全部重算 · 核心引擎核验" icon="recalc" onClose={onClose} w={640}
      footer={
        <>
          <span className="mr-auto text-[10.5px] text-[var(--tx-3)]">
            <b className="text-[#1f8f4d] dark:text-[#7ede99]">一致</b> 引擎与台账相同 ·
            <b className="text-[#a26603] dark:text-[#ffbe69]"> 差异</b> 台账行与引擎结果不同 ·
            <b className="text-[var(--tx-2)]"> 跳过</b> 非公务员轨道
          </span>
          <Btn onClick={onClose}>仅查看报告</Btn>
          {done && (
            <Btn kind="primary" onClick={onApply}>
              应用重算 · 重写演变表（{applicable} 人）
            </Btn>
          )}
        </>
      }>
      {done && (
        <div className="mb-3 rounded-lg border border-[rgba(10,132,255,.4)] bg-[var(--sel)] px-3 py-2.5 text-[11px] text-[var(--tx-2)] leading-relaxed">
          <b className="text-[var(--acc)]">应用规则：</b>三方案比对取最高作为 2006/7/1 套改基线 → 按「两年晋档 · 五年晋级（就近就高）」逐年推演至 {endYear} 年 →
          2014/10/1 自动生成「调整工资标准」行（级档不变，工资切换 2015 标准）。应用后将重写 {applicable} 人的工资演变表并刷新套改明细。
        </div>
      )}
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

/* ================= 工资业务预测 ================= */

interface FcRow {
  person: Person;
  reason: string;  // 当年变动原因（同年多项以"、"连接，一人一行）
  duty: string;    // 变动后职务/职级
  level: number;   // 变动后级别
  grade: number;   // 变动后档次
}

/* 原因文案映射：五年晋级→五年晋升级别；两年晋档→两年晋升级别档次 */
const fcReason = (r: string) =>
  r.replace(/五年晋级/g, "五年晋升级别").replace(/两年晋档/g, "两年晋升级别档次");

/* 以每人现有输入数据为准：优先读取已保存测算参数（职务变化按已录入列表执行），否则按档案推导 */
function loadFcParams(p: Person): CalcRunInput {
  try {
    const raw = localStorage.getItem(`gw_calc_v1_${p.id}`);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.params?.type) {
        const params = saved.params as CalcRunInput;
        /* 防御：旧存档可能缺 positionChanges */
        return { ...params, positionChanges: Array.isArray(params.positionChanges) ? params.positionChanges : [] };
      }
    }
  } catch { /* ignore */ }
  return deriveParams(p);
}

export function ForecastModal({ persons, units, onClose, onLocate, onToast }: {
  persons: Person[]; units: Unit[]; onClose: () => void;
  onLocate: (id: number) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const NOW = new Date().getFullYear();
  /* 年份备选：当前年份-10 ～ 当前年份+10；默认选中下一年 */
  const YEAR_OPTS = useMemo(() => Array.from({ length: 21 }, (_, i) => NOW - 10 + i), [NOW]);
  const [year, setYear] = useState(NOW + 1);
  const [rows, setRows] = useState<FcRow[]>([]);

  /* 名单筛选 / 排序：完全复用左侧人员名单的筛选/排序控件与逻辑 */
  const [view, setView] = useState<Person[]>(persons);
  const onView = useCallback((v: Person[]) => setView(v), []);

  const forecast = useCallback((y: number) => {
    const out: FcRow[] = [];
    for (const p of persons) {
      let res: CalcRunResult;
      try { res = runCalculation({ ...loadFcParams(p), endYear: y }); } catch { continue; }
      /* 提取预测当年发生变动的演变行（year 形如 "2027-01" / "2027-07"） */
      const inYear = res.evolution.filter((r) => typeof r.year === "string" && r.year.startsWith(`${y}-`));
      if (!inYear.length) continue;
      const last = inYear[inYear.length - 1];
      const reasons: string[] = [];
      inYear.forEach((r) => String(r.reason).split("、").forEach((seg) => {
        const lab = fcReason(seg.trim());
        if (lab && !reasons.includes(lab)) reasons.push(lab);
      }));
      out.push({ person: p, reason: reasons.join("、"), duty: last.duty, level: last.level, grade: last.grade });
    }
    setRows(out);
  }, [persons]);

  /* 打开时按默认年份（下一年）自动预测一次；点击「预测」后按所选年份刷新名单 */
  useEffect(() => {
    forecast(NOW + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 筛选 / 排序作用于预测名单 */
  const viewIds = useMemo(() => new Set(view.map((p) => p.id)), [view]);
  const shown = useMemo(() => rows.filter((r) => viewIds.has(r.person.id)), [rows, viewIds]);

  /* 左下角复制按钮（TSV 到剪贴板，含 execCommand 降级） */
  const copyRows = async () => {
    if (!shown.length) { onToast("info", "当前无预测名单可复制"); return; }
    let text = "序号\t姓名\t变动原因\t职务/职级\t级别\t档次\n";
    shown.forEach((r, i) => {
      text += `${i + 1}\t${r.person.name}\t${r.reason}\t${r.duty}\t${r.level}级\t${r.grade}档\n`;
    });
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      document.body.removeChild(ta);
      return ok;
    };
    let done = false;
    try { await navigator.clipboard.writeText(text); done = true; } catch { done = false; }
    if (!done) done = legacyCopy();
    if (done) onToast("success", `已复制 ${shown.length} 名人员的预测名单到剪贴板`);
    else onToast("error", "复制失败，请手动选择文本");
  };

  return (
    <Modal title="工资业务预测" icon="forecast" onClose={onClose} w={860} allowFullscreen
      footer={
        <>
          {/* 左下角复制按钮 */}
          <div className="mr-auto flex items-center gap-2">
            <Btn onClick={copyRows}><span className="flex items-center gap-1"><Icon name="copy" size={12} />复制</span></Btn>
          </div>
          <span className="text-[11px] text-[var(--tx-3)]">
            <b className="font-mono2 text-[var(--tx-2)]">{year}</b> 年变动 <b className="font-mono2 text-[var(--tx-2)]">{shown.length}</b> 人
            {shown.length !== rows.length && <>（共 {rows.length} 人）</>}
          </span>
          <Btn onClick={onClose}>关闭</Btn>
        </>
      }>
      {/* 左上角：预测年份选择框 + 预测按钮 */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--tx-2)] shrink-0">
          预测年份
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="field h-8 w-[104px] px-2 font-mono2 text-[12.5px]">
            {YEAR_OPTS.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
        </label>
        <Btn kind="primary" onClick={() => forecast(year)}>
          <span className="flex items-center gap-1"><Icon name="forecast" size={12} />预测</span>
        </Btn>
        <span className="text-[10.5px] text-[var(--tx-3)] ml-1">职务变化按已录入列表执行；未录入考核的年份视同称职</span>
      </div>

      {/* 名单筛选 / 排序（复用左侧人员名单控件） */}
      <div className="mt-2.5">
        <PersonFilterSort persons={persons} units={units} onView={onView} />
      </div>

      {/* 预测名单（样式参照「工资演变明细」） */}
      <div className="mt-3 rounded-lg border border-[var(--line)] overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th className="tbl-head px-2.5 py-1.5 text-right w-[52px]">序号</th>
                <th className="tbl-head px-2.5 py-1.5 text-left w-[92px]">姓名</th>
                <th className="tbl-head px-2.5 py-1.5 text-left">变动原因</th>
                <th className="tbl-head px-2.5 py-1.5 text-left">职务/职级</th>
                <th className="tbl-head px-2.5 py-1.5 text-right w-[60px]">级别</th>
                <th className="tbl-head px-2.5 py-1.5 text-right w-[60px]">档次</th>
                <th className="tbl-head px-2 py-1.5 text-center w-[56px]">操作</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-10 text-center text-[var(--tx-3)]">
                  <Icon name="forecast" size={20} className="mx-auto mb-2 text-[var(--tx-3)]" />
                  {rows.length === 0 ? `${year} 年无人员发生级别 / 档次 / 职务变动` : "当前筛选条件下无人员"}
                </td></tr>
              )}
              {shown.map((r, i) => (
                <tr key={r.person.id}
                  className={`border-b border-[var(--line-2)] transition-colors ${i % 2 === 1 ? "bg-[var(--hov)]" : "hover:bg-[var(--sel)]"}`}>
                  <td className="px-2.5 py-1.5 text-right font-mono2 text-[var(--tx-3)]">{i + 1}</td>
                  <td className="px-2.5 py-1.5 text-[var(--tx-1)] font-medium whitespace-nowrap">{r.person.name}</td>
                  <td className="px-2.5 py-1.5 text-[var(--tx-1)] whitespace-nowrap">{r.reason}</td>
                  <td className="px-2.5 py-1.5 text-[var(--tx-2)] whitespace-nowrap">{r.duty}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{r.level}</td>
                  <td className="px-2.5 py-1.5 text-right font-mono2 text-[var(--tx-1)]">{r.grade}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => onLocate(r.person.id)}
                      title="关闭预测窗口并定位到该人员"
                      className="text-[11px] px-3.5 py-1 whitespace-nowrap rounded-md border border-[rgba(10,132,255,.45)] text-[var(--acc)] hover:bg-[var(--sel)] transition">
                      定位
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-[10.5px] text-[var(--tx-3)] flex items-center gap-1">
        <Icon name="info" size={11} />
        以每人现有输入数据（含职务变化列表）用滚动计算引擎推演至所选年份，仅列出该年发生「五年晋升级别 / 两年晋升级别档次 / 职务晋升」等变动的人员，显示变动后的取值；点击「定位」可跳转至左侧名单中的该人员。
      </p>
    </Modal>
  );
}

/* ================= 删除确认 ================= */
export function ConfirmDeleteModal({ person, onCancel, onConfirm }: {
  person: Person; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <Modal title="人员删除" icon="trash" onClose={onCancel} w={420}
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

/* ================= 用户管理（需求4：新增账户，首次登录密码生效） ================= */
export function UserManageModal({ onClose, onToast }: {
  onClose: () => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [, setTick] = useState(0); // 仅用于触发重新渲染以刷新账户列表
  const accounts = loadAccounts(); // 每次渲染读取最新账户

  const add = () => {
    const key = name.trim();
    if (!key) { onToast("error", "请输入新用户名"); return; }
    if (accounts[key.toLowerCase()]) { onToast("error", `账户「${key}」已存在`); return; }
    if (addAccount(key, role)) {
      onToast("success", `已新增账户「${key}」（${role === "admin" ? "管理员" : "查阅用户"}），首次登录时输入的密码将成为其账户密码`);
      setName("");
      setTick((t) => t + 1);
    } else {
      onToast("error", "新增账户失败");
    }
  };

  const rows = Object.entries(accounts);
  return (
    <Modal title="用户管理" icon="users" onClose={onClose} w={490}
      footer={<><Btn onClick={onClose}>关闭</Btn><Btn kind="primary" onClick={add}><Icon name="plus" size={12} />新增账户</Btn></>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="block text-[11px] text-[var(--tx-2)] flex-1 min-w-0">新用户名
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="输入新账户用户名" className="field w-full h-9 px-2.5 mt-1 text-[12.5px]" />
          </label>
          <label className="block text-[11px] text-[var(--tx-2)] w-[150px] shrink-0">权限
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="field w-full h-9 px-2 mt-1 text-[12.5px]">
              <option value="viewer">查阅用户（仅查看）</option>
              <option value="admin">管理员（可编辑）</option>
            </select>
          </label>
        </div>
        <p className="text-[10.5px] text-[var(--tx-3)] leading-relaxed flex items-start gap-1.5">
          <Icon name="info" size={12} className="mt-0.5 shrink-0 text-[var(--acc)]" />
          新账户初始无密码：该用户首次登录时在密码框输入的密码将成为其账户密码，之后须凭该密码登录。
        </p>
        <div className="border-t border-dashed border-[var(--line)] pt-2.5 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-[var(--acc)] flex items-center gap-1"><Icon name="users" size={12} />现有账户（{rows.length}）</p>
          {rows.map(([key, acc]) => (
            <div key={key} className="flex items-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-2.5 py-1.5">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
                style={{ background: acc.role === "admin" ? "linear-gradient(135deg,#0a84ff,#5ac8fa)" : "linear-gradient(135deg,#98a2b3,#b9c0cc)" }}>
                {acc.name.slice(0, 1)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--tx-1)] font-medium truncate">{acc.name}</p>
                <p className="text-[10px] text-[var(--tx-3)] font-mono2 truncate">{key}</p>
              </div>
              <span className={`shrink-0 text-[10px] px-1.5 py-px rounded border ${acc.role === "admin"
                ? "border-[rgba(10,132,255,.45)] text-[var(--acc)] bg-[var(--sel)]"
                : "border-[rgba(255,159,10,.45)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.1)]"}`}>
                {acc.role === "admin" ? "可编辑" : "仅查看"}
              </span>
              <span className={`shrink-0 text-[10px] px-1.5 py-px rounded border ${acc.password
                ? "border-[rgba(48,209,88,.45)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.1)]"
                : "border-[var(--line)] text-[var(--tx-3)]"}`}>
                {acc.password ? "密码已设置" : "待首登设密"}
              </span>
            </div>
          ))}
          {rows.length === 0 && <p className="text-[11px] text-[var(--tx-3)] px-1">暂无账户</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ================= 帮助 ================= */
const HELP_MENUS: [IconName, string, string][] = [
  ["unit", "单位增加", "维护单位目录，新增 / 删除预算单位"],
  ["allowance", "编辑津贴", "增删津贴名目、调整标准并导出文本"],
  ["query", "综合查询", "按编号、姓名、状态多条件检索人员"],
  ["recalc", "全部重算", "以 calculator.js 核心对全体人员重新核验三方案套改结果"],
  ["rolling", "滚动判断", "判断当前人员是否满足 5 年滚动晋级"],
  ["trash", "人员删除", "删除当前选中人员及其演变台账"],
  ["catalog", "工资标准", "查阅 2014 年后职务 / 级别工资标准表与职务层次表"],
  ["calc", "计算器", "标准计算与增资测算辅助工具"],
];

/* Electron 预加载桥（开机自启开关）；浏览器局域网访问时不存在 */
interface GwNativeBridge {
  autostartGet: () => Promise<{ supported: boolean; pref: boolean; registered: boolean }>;
  autostartSet: (enabled: boolean) => Promise<{ pref: boolean } | undefined>;
}
const gwNative = (): GwNativeBridge | undefined =>
  (window as unknown as { gwNative?: GwNativeBridge }).gwNative;

export function HelpModal({ onClose }: { onClose: () => void }) {
  /* 开机自启（需求）：默认开启，仅 Electron 打包环境提供开关 */
  const native = useMemo(gwNative, []);
  const [as, setAs] = useState<{ supported: boolean; on: boolean } | null>(null);
  useEffect(() => {
    if (!native) return;
    let alive = true;
    native.autostartGet()
      .then((r) => { if (alive) setAs({ supported: r.supported, on: r.registered }); })
      .catch(() => { if (alive) setAs(null); });
    return () => { alive = false; };
  }, [native]);

  const toggleAutoStart = async () => {
    if (!native || !as?.supported) return;
    const next = !as.on;
    setAs({ supported: true, on: next }); // 乐观更新
    try {
      const r = await native.autostartSet(next);
      if (r && typeof r.pref === "boolean") setAs({ supported: true, on: r.pref });
    } catch { setAs({ supported: true, on: !next }); } // 失败回滚
  };

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

      {/* 开机自启开关（仅 Electron 打包环境显示） */}
      {native && as?.supported && (
        <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3.5 py-3">
          <Icon name="bolt" size={15} className="text-[var(--acc)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-medium text-[var(--tx-1)]">开机自启</p>
            <p className="text-[10.5px] text-[var(--tx-3)] mt-0.5 leading-relaxed">默认开启，电脑开机后自动运行本系统（局域网访问不受影响）；关闭后需手动启动。</p>
          </div>
          <button onClick={toggleAutoStart}
            title={as.on ? "已开启开机自启，点击关闭" : "已关闭开机自启，点击开启"}
            className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${as.on ? "bg-[#30d158]" : "bg-[var(--line)]"}`}>
            <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${as.on ? "left-[20px]" : "left-[2px]"}`} />
          </button>
        </div>
      )}

      <p className="mt-4 mb-1.5 text-[11px] text-[var(--tx-2)]">测算核心与部署</p>
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3.5 py-3 text-[11.5px] text-[var(--tx-2)] leading-relaxed">
        <p>· 测算核心 <span className="font-mono2">src/core/calculator.ts</span> 与微信小程序 <span className="font-mono2">utils/calculator.js</span> 同源：2006 套改表、级别工资表、五年晋级 / 两年晋档滚动规则完全一致。</p>
        <p className="mt-1">· 详情页「套改测算」工作区 1:1 移植小程序页面逻辑（2006 年前套改 / 2006 年后定级、三方案对比、截止年份推演）。</p>
        <p className="mt-1">· 基于 <b className="text-[var(--tx-1)]">Electron</b> 封装为本地 <span className="font-mono2">.exe</span>；主进程内嵌 HTTP 服务，局域网终端通过浏览器访问 <span className="font-mono2 text-[var(--acc)]">http://本机IP:8080</span> 即可使用。</p>
        <p className="mt-1">· 快捷键：<span className="font-mono2">Esc</span> 关闭弹窗；标题栏右侧可切换日间 / 夜间模式（默认日间）。</p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10.5px] text-[var(--tx-3)]">
        <Logo size={14} />
        <span className="font-mono2">V8.2 · BUILD 2026.08 · 数据基准：国办发〔2006〕22号 / 藏政发〔2007〕9号</span>
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

/* ================= 套改明细弹窗（需求7：由栏目改为按钮弹出框） ================= */
export function TaogaiModal({ person, results, onClose }: {
  person: Person; results: CalcRunResult | null; onClose: () => void;
}) {
  const wageNow = results ? Calculator.getSalary(results.finalLevel, results.finalGrade) : 0;
  return (
    <Modal title={`套改明细（2006 工资套改）· ${person.name}`} icon="sum" onClose={onClose} w={620}
      footer={<Btn kind="primary" onClick={onClose}>关闭</Btn>}>
      {!results ? (
        <p className="text-[12px] text-[var(--tx-3)] text-center py-8">暂无测算结果，请先点击「开始测算」。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* 结果摘要 */}
          <div className="hero-grad rounded-lg px-3.5 py-3 text-white" style={{ animation: "none" }}>
            <p className="text-[9.5px] tracking-[2px] opacity-85">{results.hero.title}</p>
            <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
              <span className="text-[16px] font-bold font-mono2">{fmtLevel(results.hero.levelGrade)}</span>
              <span className="text-[11.5px] opacity-90">{results.hero.duty}</span>
              {wageNow > 0 && (
                <span className="font-mono2 text-[10.5px] px-1.5 py-0.5 rounded bg-white/18 border border-white/25">级别工资 ¥{fmt(wageNow)}/月</span>
              )}
            </div>
            <p className="mt-1 text-[10.5px] opacity-90">{results.hero.sub}</p>
          </div>

          {/* 套改明细对比表 */}
          <div className="rounded-lg border border-[var(--line)] overflow-hidden">
            <table className="w-full text-[11.5px] border-collapse">
              <thead>
                <tr>
                  <th className="tbl-head px-2.5 py-1.5 text-left">套改方式</th>
                  <th className="tbl-head px-2 py-1.5 text-right">套改年限</th>
                  <th className="tbl-head px-2 py-1.5 text-right">任职年限</th>
                  <th className="tbl-head px-2 py-1.5 text-right">结果</th>
                  <th className="tbl-head px-2 py-1.5 text-center w-[48px]">采纳</th>
                </tr>
              </thead>
              <tbody>
                {results.compare.map((r, i) => (
                  <tr key={r.method} className={`border-b border-[var(--line-2)] last:border-0 ${r.isBest ? "bg-[var(--sel)]" : i % 2 === 1 ? "bg-[var(--hov)]" : ""}`}>
                    <td className={`px-2.5 py-1.5 ${r.isBest ? "font-semibold text-[var(--acc)]" : "text-[var(--tx-1)]"}`}>
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
              </tbody>
            </table>
          </div>

          {/* 参工时间 */}
          <div className="flex items-baseline gap-3 rounded-md bg-[var(--hov)] px-3 py-2">
            <span className="w-[64px] shrink-0 text-[11px] text-[var(--tx-2)]">参工时间</span>
            <span className="font-mono2 text-[12.5px] font-semibold text-[var(--tx-1)] shrink-0">{person.join}</span>
            <span className="text-[10.5px] text-[var(--tx-3)] leading-snug">
              工龄间断 {person.gap} 年，{person.unq}，大专以上未计工龄学习 {person.studyYears} 年，套改年限 <b className="font-mono2 text-[var(--tx-2)]">{results.taogaoYears}</b> 年
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ================= 新增人员（需求7） ================= */
const joinYears = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 1950 + i).reverse();

export function PersonAddModal({ units, nextId, onClose, onAdd, editingPerson }: {
  units: Unit[]; nextId: number; onClose: () => void;
  onAdd: (p: Person) => void;
  /** UI-T2：编辑模式入口——传入 Person 则所有表单字段预填，submit 保持原 id 并回写 idCard/basic 字段 */
  editingPerson?: Person | null;
}) {
  const [step, setStep] = useState<1 | 2>(editingPerson ? 2 : 1);
  // 如果是编辑模式：用 editingPerson.birth 里的年份回显 joinYear；若 birth 非 "{Y}年{M}" 格式则取参工 join 前 4 位
  const initialJoinYear = editingPerson
    ? (() => {
        const j = /^(\d{4})/.exec(editingPerson.join || "");
        const b = /^\s*(\d{4})/.exec(editingPerson.birth || "");
        const y = j ? Number(j[1]) : b ? Number(b[1]) : 2010;
        return Number.isFinite(y) ? y : 2010;
      })()
    : 2010;
  const [joinYear, setJoinYear] = useState(initialJoinYear);
  const [form, setForm] = useState(() => ({
    name: editingPerson?.name ?? "",
    gender: (editingPerson?.gender as "男" | "女") ?? "男",
    identity: editingPerson?.identity ?? "公务员",
    birth: editingPerson?.birth ?? "1990年1月",
    unitId: editingPerson?.unitId ?? (units[0]?.id ?? "0001"),
    /* UI-T1：新增人员第二步——身份证号 */
    idCard: (editingPerson as Person & { idCard?: string | null })?.idCard ?? "",
  }));

  const isPre2006 = joinYear < 2006;

  const submit = () => {
    if (!form.name.trim()) return;
    onAdd(makePerson({
      id: editingPerson?.id ?? nextId,
      name: form.name.trim(), gender: form.gender, identity: form.identity,
      unitId: form.unitId, birth: form.birth,
      join: `${joinYear}年7月`, startYear: joinYear, isPre2006,
      idCard: form.idCard.trim() ? form.idCard.trim() : null,
      /* 编辑模式：保持原 employ/tag/edu/gap/unq/studyYears/leader 等已有字段（makePerson 签名内取 defaults 会覆盖为默认 → 所以传 editingPerson 原字段） */
      ...(editingPerson
        ? { employ: editingPerson.employ, tag: editingPerson.tag, edu: editingPerson.edu,
            gap: editingPerson.gap, unq: editingPerson.unq, studyYears: editingPerson.studyYears,
            leader: editingPerson.leader, position: editingPerson.position,
            tgLabels: editingPerson.tgLabels, tgNow: editingPerson.tgNow, tgLow: editingPerson.tgLow, tgEdu: editingPerson.tgEdu,
            curType: editingPerson.curType, tYears: editingPerson.tYears, history: editingPerson.history,
          }
        : {}),
    }));
  };

  const sel = "field w-full h-8 px-2 text-[12px]";

  return (
    <Modal
      title={editingPerson
        ? (step === 1 ? "修改人员 · 第一步" : "修改人员")
        : (step === 1 ? "人员增加 · 第一步" : "人员增加 · 第二步")}
      icon="user" onClose={onClose} w={480}
      footer={
        step === 1 ? (
          <><Btn onClick={onClose}>取消</Btn><Btn kind="primary" onClick={() => setStep(2)}>确定</Btn></>
        ) : (
          <>
            {editingPerson ? null : <Btn onClick={() => setStep(1)}>上一步</Btn>}
            <Btn onClick={onClose}>取消</Btn>
            <Btn kind="primary" onClick={submit} disabled={!form.name.trim()}>
              {editingPerson ? "保存修改" : "保存人员"}
            </Btn>
          </>
        )
      }>
      {step === 1 ? (
        <div>
          <label className="block text-[11px] text-[var(--tx-2)]">
            参加工作时间（年份）
            <select className={sel + " font-mono2 mt-1"} value={joinYear} onChange={(e) => setJoinYear(Number(e.target.value))}>
              {joinYears.map((y) => <option key={y} value={y}>{y} 年</option>)}
            </select>
          </label>
          <div className={`mt-3 rounded-lg border px-3 py-2.5 flex items-center gap-2.5 text-[12px] ${
            isPre2006
              ? "border-[rgba(10,132,255,.4)] bg-[var(--sel)] text-[var(--acc)]"
              : "border-[rgba(48,209,88,.4)] bg-[rgba(48,209,88,.08)] text-[#1f8f4d] dark:text-[#7ede99]"
          }`}>
            <Icon name={isPre2006 ? "clock" : "check"} size={15} />
            <span>系统判定：<b>{isPre2006 ? "2006年前参公（套改）" : "2006年后参公"}</b></span>
          </div>
          <p className="mt-2 text-[10.5px] text-[var(--tx-3)] leading-relaxed">
            参加工作年份 {isPre2006 ? "早于" : "不早于"} 2006 年，将按「{isPre2006 ? "2006年前参公（套改）" : "2006年后参公"}」规则进行测算。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block text-[11px] text-[var(--tx-2)]">
            姓名
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="请输入姓名" className="field mt-1 w-full h-8 px-2.5 text-[12.5px]" />
          </label>
          {/* UI-T1：身份证号输入框（姓名右侧，非必填） */}
          <label className="block text-[11px] text-[var(--tx-2)]">
            <span className="inline-flex items-center gap-1">
              身份证号
              <span className="text-[9.5px] text-[var(--tx-3)] font-normal">(非必填)</span>
            </span>
            <input value={form.idCard} onChange={(e) => setForm({ ...form, idCard: e.target.value })}
              placeholder="18 位身份证号" maxLength={18}
              className="field mt-1 w-full h-8 px-2.5 text-[12px] font-mono2 tracking-wide" />
          </label>
          <label className="block text-[11px] text-[var(--tx-2)]">
            性别
            <select className={sel + " mt-1"} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as "男" | "女" })}>
              <option value="男">男</option><option value="女">女</option>
            </select>
          </label>
          <label className="block text-[11px] text-[var(--tx-2)]">
            出生年月
            <input value={form.birth} onChange={(e) => setForm({ ...form, birth: e.target.value })} className="field mt-1 w-full h-8 px-2.5 text-[12.5px] font-mono2" />
          </label>
          <label className="block text-[11px] text-[var(--tx-2)]">
            身份
            <select className={sel + " mt-1"} value={form.identity} onChange={(e) => setForm({ ...form, identity: e.target.value })}>
              <option value="公务员">公务员</option><option value="参公管理人员">参公管理人员</option><option value="机关技术工人">机关技术工人</option>
            </select>
          </label>
          <label className="block text-[11px] text-[var(--tx-2)] col-span-2">
            所属单位
            <select className={sel + " mt-1"} value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              {units.map((u) => <option key={u.id} value={u.id}>[{u.id}] {u.name}</option>)}
            </select>
          </label>
          {/*
          <div className="col-span-2 flex items-start gap-2 rounded-md border border-dashed border-[var(--line)] bg-[var(--bg-3)] px-2.5 py-2 text-[10.5px] text-[var(--tx-3)] leading-relaxed">
            <Icon name="info" size={13} className="text-[var(--acc)] shrink-0 mt-px" />
            <span>无需填写职务——保存后在详情页「职务变化情况」中维护，系统自动取最新一条作为现任职务。</span>
          </div>
          */}
          <div className="col-span-2 rounded-lg border border-[var(--line)] bg-[var(--bg-3)] px-3 py-2 text-[11px] text-[var(--tx-2)] flex items-center gap-2">
            <Icon name="info" size={13} className="text-[var(--acc)]" />
            参加工作时间 <b className="font-mono2">{joinYear} 年</b> · 类型 <b>{isPre2006 ? "2006年前参公（套改）" : "2006年后参公"}</b>
          </div>
        </div>
      )}
    </Modal>
  );
}
