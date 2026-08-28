import React, { useEffect, useMemo, useState } from "react";
import { fmt } from "../data";
import { Icon } from "./icons";
import { Calculator, dutyWage2006, POLICY_CONFIG } from "../core/calculator";
import type { CalcRunResult } from "../core/calculator";

/* ---------- 结构 ---------- */
interface AddonItem { id: string; label: string; steps: number; unit: number; }
interface AllowanceRow { id: string; label: string; detail: string; amount: number; }

const DEFAULT_ADDONS: AddonItem[] = [
  { id: "gaoTao", label: "高套", steps: 2, unit: 25 },
  { id: "xueLiFloat", label: "学历浮动", steps: 1, unit: 25 },
  { id: "xueLiFixed", label: "学历固定", steps: 1, unit: 25 },
  { id: "nian20", label: "20年固定", steps: 1, unit: 25 },
  { id: "xianXiang", label: "县乡提高", steps: 1, unit: 25 },
];

const DEFAULT_ALLOWANCES: AllowanceRow[] = [
  { id: "xzMulti", label: "西藏特殊津贴倍数", detail: "140%", amount: 500 },
  { id: "xzAbs", label: "西藏特殊津贴绝对额", detail: "", amount: 500 },
  { id: "zheSuan", label: "折算工龄补贴", detail: "", amount: 50 },
  { id: "zhuFang", label: "住房补贴", detail: "", amount: 50 },
];

const ADDON_OPTIONS = ["交通补贴", "通讯补贴", "餐补", "取暖补贴", "物业补贴", "年终绩效奖"];

const itemsKey = (id: number) => `gw_salary_items_v1_${id}`;

function loadItems(id: number): { addons: AddonItem[]; allowances: AllowanceRow[] } {
  try {
    const raw = localStorage.getItem(itemsKey(id));
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        addons: Array.isArray(saved.addons) && saved.addons.length ? saved.addons : DEFAULT_ADDONS,
        allowances: Array.isArray(saved.allowances) && saved.allowances.length ? saved.allowances : DEFAULT_ALLOWANCES,
      };
    }
  } catch { /* ignore */ }
  return { addons: DEFAULT_ADDONS, allowances: DEFAULT_ALLOWANCES };
}

/* ---------- 单行 ---------- */
function Row({ label, detail, amount, bold, accent, editable, canEdit, onAmount }: {
  label: React.ReactNode; detail: React.ReactNode; amount: number;
  bold?: boolean; accent?: boolean; editable?: boolean; canEdit: boolean;
  onAmount?: (v: number) => void;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-[7px] ${bold ? "bg-[var(--sel)]" : ""}`}>
      <span className={`text-[12px] ${bold ? "font-bold text-[var(--acc)]" : accent ? "text-[var(--tx-1)] font-medium" : "text-[var(--tx-1)]"}`}>{label}</span>
      <span className="ml-auto text-[11px] text-[var(--tx-2)] font-mono2 whitespace-nowrap">{detail}</span>
      {editable && canEdit ? (
        <span className="flex items-center gap-0.5 shrink-0">
          <span className="text-[10.5px] text-[var(--tx-3)]">¥</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmount?.(Math.max(0, Number(e.target.value) || 0))}
            className={`w-[64px] h-6 px-1.5 text-right font-mono2 text-[11.5px] rounded border bg-[var(--bg-3)] outline-none transition ${bold ? "border-[rgba(10,132,255,.5)] text-[var(--acc)] font-bold" : "border-[var(--line)] text-[var(--tx-1)] focus:border-[rgba(10,132,255,.6)]"}`}
          />
        </span>
      ) : (
        <span className={`shrink-0 font-mono2 text-[11.5px] ${bold ? "font-bold text-[var(--acc)] text-[13px]" : "text-[var(--tx-1)]"}`}>
          {fmt(amount)}元
        </span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="mx-3 my-1 border-t border-dashed border-[var(--line)]" />;
}

/* ---------- 当前工资面板（需求6） ---------- */
export function SalaryPanel({ personId, results, latestDutyIndex, canEdit, onToast, altitudeSubsidy = 0 }: {
  personId: number;
  results: CalcRunResult | null;
  latestDutyIndex: number;
  canEdit: boolean;
  onToast: (t: "success" | "error" | "info", m: string) => void;
  altitudeSubsidy?: number; // 需求6：海拔折算工龄补贴
}) {
  const [addons, setAddons] = useState<AddonItem[]>(DEFAULT_ADDONS);
  const [allowances, setAllowances] = useState<AllowanceRow[]>(DEFAULT_ALLOWANCES);
  const [newItem, setNewItem] = useState("");

  /* 切换人员时载入存档 */
  useEffect(() => {
    const loaded = loadItems(personId);
    setAddons(loaded.addons);
    setAllowances(loaded.allowances);
    setNewItem("");
  }, [personId]);

  const persist = (a: AddonItem[], w: AllowanceRow[]) => {
    try { localStorage.setItem(itemsKey(personId), JSON.stringify({ addons: a, allowances: w })); } catch { /* ignore */ }
  };

  const setAddonSteps = (id: string, steps: number) => {
    setAddons((arr) => {
      const next = arr.map((x) => (x.id === id ? { ...x, steps: Math.max(0, steps) } : x));
      persist(next, allowances);
      return next;
    });
  };

  const setAllowanceAmount = (id: string, amount: number) => {
    setAllowances((arr) => {
      const next = arr.map((x) => (x.id === id ? { ...x, amount } : x));
      persist(addons, next);
      return next;
    });
  };

  const addAllowance = () => {
    if (!newItem) return;
    if (allowances.some((a) => a.label === newItem)) {
      onToast("error", `「${newItem}」已存在`);
      setNewItem("");
      return;
    }
    setAllowances((arr) => {
      const next = [...arr, { id: `custom_${Date.now()}`, label: newItem, detail: "", amount: 0 }];
      persist(addons, next);
      return next;
    });
    onToast("success", `已新增津贴项「${newItem}」`);
    setNewItem("");
  };

  /* ---------- 计算 ---------- */
  const dutyLabel = POLICY_CONFIG.getLabel(latestDutyIndex);
  const dutyWage = useMemo(() => dutyWage2006(latestDutyIndex), [latestDutyIndex]);
  const finalLevel = results?.finalLevel ?? 25;
  const finalGrade = results?.finalGrade ?? 2;
  const levelGrade = `${finalLevel}-${finalGrade}`;
  const levelWage = useMemo(() => Calculator.getSalary(finalLevel, finalGrade), [finalLevel, finalGrade]);

  /* 需求11：一个档差 = 当前级别工资相邻两档之差 */
  const gradeStep = useMemo(() => {
    const cur = Calculator.getSalary(finalLevel, finalGrade);
    const next = Calculator.getSalary(finalLevel, finalGrade + 1);
    if (next > cur) return next - cur;
    const prev = Calculator.getSalary(finalLevel, finalGrade - 1);
    return cur > prev ? cur - prev : 0;
  }, [finalLevel, finalGrade]);

  /* 需求11：各加项每档金额 = 一个档差；合计档数叠加到级别档次上 */
  const extraSteps = addons.reduce((s, a) => s + a.steps, 0);
  const addonsTotal = extraSteps * gradeStep;
  const basicSubtotal = dutyWage + levelWage + addonsTotal;
  const displayGrade = finalGrade + extraSteps;

  /* 需求6：津贴里的"折算工龄补贴"由海拔累计驱动 */
  const effectiveAllowances = useMemo(
    () => allowances.map((a) => (a.id === "zheSuan" ? { ...a, amount: altitudeSubsidy, detail: "按海拔档次累计" } : a)),
    [allowances, altitudeSubsidy]
  );
  const allowancesTotal = effectiveAllowances.reduce((s, a) => s + a.amount, 0);
  const total = basicSubtotal + allowancesTotal;

  const now = new Date();

  return (
    <div className="w-[300px] xl:w-[320px] shrink-0 flex flex-col card-panel overflow-hidden">
      {/* 头部：当前状态 */}
      <div className="hero-grad rounded-t-[10px] px-3.5 py-3 text-white shrink-0" style={{ animation: "none" }}>
        <p className="text-[9.5px] tracking-[2px] opacity-80">当前 {now.getFullYear()}年{now.getMonth() + 1}月</p>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-[14px] font-bold">职务：{dutyLabel}</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="text-[11px] opacity-85">工资合计</span>
          <span className="font-mono2 text-[22px] font-bold leading-none">{fmt(total)}</span>
          <span className="text-[11px] opacity-85">元</span>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto py-1.5">
        <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-[var(--tx-3)] tracking-wide">基本工资</p>
        <Row label="职务" detail={dutyLabel} amount={dutyWage} canEdit={canEdit} />
        <Row label="级别" detail={levelGrade} amount={levelWage} canEdit={canEdit} />
        {addons.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-3 py-[7px]">
            <span className="text-[12px] text-[var(--tx-1)]">{a.label}</span>
            <span className="ml-auto flex items-center gap-1">
              {canEdit ? (
                <input
                  type="number"
                  value={a.steps}
                  onChange={(e) => setAddonSteps(a.id, Number(e.target.value))}
                  className="w-[40px] h-6 px-1 text-right font-mono2 text-[11.5px] rounded border border-[var(--line)] bg-[var(--bg-3)] text-[var(--tx-1)] outline-none focus:border-[rgba(10,132,255,.6)] transition"
                />
              ) : (
                <span className="font-mono2 text-[11.5px] text-[var(--tx-1)]">{a.steps}</span>
              )}
              <span className="text-[11px] text-[var(--tx-2)]">档</span>
            </span>
            <span className="shrink-0 font-mono2 text-[11.5px] text-[var(--tx-1)] w-[56px] text-right">{fmt(a.steps * gradeStep)}元</span>
          </div>
        ))}
        <Row label="基本工资小计" detail={`${finalLevel}-${displayGrade}（以上合计）`} amount={basicSubtotal} accent canEdit={canEdit} />

        <Divider />

        <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-[var(--tx-3)] tracking-wide">津贴补贴</p>
        {effectiveAllowances.map((a) => (
          <Row
            key={a.id}
            label={a.label}
            detail={a.detail}
            amount={a.amount}
            editable={a.id !== "zheSuan"}
            canEdit={canEdit}
            onAmount={(v) => setAllowanceAmount(a.id, v)}
          />
        ))}

        {/* 新增津贴项 */}
        <div className="px-3 py-1.5 flex items-center gap-1.5">
          <select
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            disabled={!canEdit}
            className="field flex-1 min-w-0 h-7 px-2 text-[11.5px] disabled:opacity-40"
          >
            <option value="">＋ 新增津贴项目…</option>
            {ADDON_OPTIONS.filter((o) => !allowances.some((a) => a.label === o)).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <button
            onClick={addAllowance}
            disabled={!canEdit || !newItem}
            className="shrink-0 h-7 px-2.5 rounded-md bg-[var(--acc)] text-white text-[11px] font-medium hover:brightness-110 transition active:scale-95 disabled:opacity-35 disabled:pointer-events-none"
          >
            添加
          </button>
        </div>

        <Divider />

        {/* 工资合计 */}
        <div className="flex items-center gap-2 px-3 py-2.5 mx-2 mb-1.5 rounded-lg bg-gradient-to-r from-[rgba(10,132,255,.14)] to-[rgba(90,200,250,.08)] border border-[rgba(10,132,255,.35)]">
          <Icon name="sum" size={15} className="text-[var(--acc)]" />
          <span className="text-[13px] font-bold text-[var(--tx-1)]">工资合计</span>
          <span className="ml-auto font-mono2 text-[17px] font-bold text-[var(--acc)]">{fmt(total)}元</span>
        </div>
      </div>

      {/* 底注 */}
      <div className="shrink-0 px-3 py-2 border-t border-[var(--line)] bg-[var(--head)] text-[10px] text-[var(--tx-3)] leading-relaxed">
        每档金额 = 当前级别一个档差（{fmt(gradeStep)}元）；小计档次 = 级别档 + 各加项档数合计。折算工龄补贴按海拔累计。
      </div>
    </div>
  );
}
