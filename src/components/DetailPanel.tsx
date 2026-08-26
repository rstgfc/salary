import React, { useState } from "react";
import { EMPLOY_META, Employ, Person, SalaryRecord, TAG_META, fmt, lastOf } from "../data";
import { Icon, IconName } from "./icons";
import { SalaryCalc } from "./SalaryCalc";
import type { CalcInputs } from "../core/calculator";

/* ---------- 区块标题 ---------- */
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

/* ---------- 信息行 ---------- */
function InfoRow({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-[7px] border-b border-[var(--line-2)] last:border-0">
      <span className="w-[150px] shrink-0 text-[11.5px] text-[var(--tx-2)]">{k}</span>
      <span className={`text-[12.5px] text-[var(--tx-1)] ${mono ? "font-mono2" : ""}`}>{v}</span>
    </div>
  );
}

/* ---------- 套改结果判定 ---------- */
function winnerIdx(p: Person): number {
  if (p.curType.includes("现职")) return 0;
  if (p.curType.includes("学历")) return 2;
  if (p.curType.includes("低职") || p.curType.includes("等级")) return 1;
  return -1;
}

/* ---------- 工具栏按钮 ---------- */
function ToolBtn({ icon, label, color, active, onClick }: {
  icon: IconName; label: string; color: string; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[12px] transition-all active:scale-[.97] ${
        active ? `${color} shadow-[0_2px_8px_rgba(20,60,120,.12)]` : "border-[var(--line)] text-[var(--tx-2)] bg-[var(--bg-2)] hover:bg-[var(--hov)] hover:text-[var(--tx-1)]"
      }`}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  );
}

/* ---------- 历史表格 ---------- */
const COLS: { key: string; label: string; num?: boolean; w?: number }[] = [
  { key: "seq", label: "序号", num: true, w: 44 },
  { key: "start", label: "起薪时间", w: 92 },
  { key: "reason", label: "原因", w: 118 },
  { key: "position", label: "职务层次", w: 148 },
  { key: "level", label: "级别", w: 86 },
  { key: "pw", label: "职务工资", num: true, w: 82 },
  { key: "lw", label: "级别工资", num: true, w: 82 },
  { key: "promo", label: "晋级档起", w: 92 },
  { key: "exam", label: "考年份", w: 86 },
  { key: "incr", label: "增资额", num: true, w: 76 },
  { key: "note", label: "备注", w: 150 },
];

function HistoryTable({ history }: { history: SalaryRecord[] }) {
  const totalIncr = history.reduce((s, r) => s + (parseInt(r.incr, 10) || 0), 0);
  const last = history[history.length - 1];
  return (
    <div className="flex-1 min-h-0 flex flex-col card-panel overflow-hidden">
      <CardHead
        icon="grid"
        title="工资演变情况"
        extra={
          <span className="flex items-center gap-2">
            <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[var(--line)] text-[var(--tx-2)]">
              {history.length} 条记录
            </span>
            <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)] text-[#1f8f4d] dark:text-[#7ede99]">
              累计增资 ¥{fmt(totalIncr)}
            </span>
          </span>
        }
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  style={{ minWidth: c.w }}
                  className={`tbl-head px-2 py-1.5 ${c.num ? "text-right" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((r, i) => {
              const isLast = i === history.length - 1;
              const incr = parseInt(r.incr, 10) || 0;
              return (
                <tr
                  key={r.seq}
                  className={`border-b border-[var(--line-2)] transition-colors ${
                    isLast
                      ? "bg-[var(--sel)] hover:bg-[var(--sel-strong)]"
                      : i % 2 === 1
                        ? "bg-[var(--hov)] hover:bg-[var(--sel)]"
                        : "hover:bg-[var(--hov)]"
                  }`}
                >
                  <td className="px-2 py-[5px] text-right font-mono2 text-[var(--tx-3)] relative">
                    {isLast && <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[var(--acc)]" />}
                    {r.seq}
                  </td>
                  <td className="px-2 py-[5px] font-mono2 text-[#0a6cd6] dark:text-[#a9c4e6] whitespace-nowrap">{r.start}</td>
                  <td className={`px-2 py-[5px] whitespace-nowrap ${isLast ? "text-[var(--tx-1)] font-medium" : "text-[var(--tx-1)]"}`}>
                    {r.reason}
                  </td>
                  <td className="px-2 py-[5px] text-[var(--tx-1)] whitespace-nowrap">{r.position}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[#0a6cd6] dark:text-[#8ed6fa] whitespace-nowrap">{r.level}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[var(--tx-1)]">{fmt(r.pw)}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[var(--tx-1)]">{fmt(r.lw)}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[var(--tx-2)] whitespace-nowrap">{r.promo}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[var(--tx-2)] whitespace-nowrap">{r.exam}</td>
                  <td className={`px-2 py-[5px] text-right font-mono2 ${incr > 0 ? "text-[#1f8f4d] dark:text-[#7ede99]" : "text-[var(--tx-3)]"}`}>
                    {incr > 0 ? `+${fmt(incr)}` : r.incr || "—"}
                  </td>
                  <td className="px-2 py-[5px] text-[var(--tx-2)]">{r.note || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {last && (
        <div className="shrink-0 h-8 px-3.5 flex items-center gap-4 border-t border-[var(--line)] bg-[var(--head)] text-[11px] text-[var(--tx-2)]">
          <span>现执行标准（{last.start} 起）</span>
          <span className="font-mono2 text-[var(--tx-1)]">职务 ¥{fmt(last.pw)}</span>
          <span className="font-mono2 text-[var(--tx-1)]">级别 ¥{fmt(last.lw)}</span>
          <span className="font-mono2 text-[13px] font-semibold text-[var(--acc)]">
            基本工资合计 ¥{fmt(last.pw + last.lw)}<span className="text-[10px] text-[var(--tx-3)] font-normal"> /月</span>
          </span>
          <span className="ml-auto flex items-center gap-1 text-[var(--tx-3)]">
            <Icon name="clock" size={11} />
            数据源：2006 工改台账
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- 主面板 ---------- */
export function DetailPanel({ person, unitName, onTool, onToast, prefill }: {
  person: Person | null;
  unitName: string;
  onTool: (a: "query" | Employ) => void;
  onToast: (t: "success" | "error" | "info", m: string) => void;
  prefill?: CalcInputs | null;
}) {
  const [mode, setMode] = useState<"profile" | "calc">("profile");

  if (!person) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-2xl border border-dashed border-[var(--line)] flex items-center justify-center">
          <Icon name="user" size={26} className="text-[var(--tx-3)]" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-[var(--tx-2)]">人员列表为空</p>
        <p className="mt-1.5 text-[12px] text-[var(--tx-3)] max-w-[340px] leading-relaxed">
          可通过微信小程序后台同步人员数据，或在「综合查询」中恢复历史台账记录。
        </p>
      </div>
    );
  }

  const p = person;
  const tag = TAG_META[p.tag];
  const emp = EMPLOY_META[p.employ];
  const win = winnerIdx(p);
  const last = lastOf(p);
  const tgRows: [string, { result: string; note: string }][] = [
    [p.tgLabels[0], p.tgNow],
    [p.tgLabels[1], p.tgLow],
    [p.tgLabels[2], p.tgEdu],
  ];

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
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0 flex-wrap">
          <ToolBtn icon="search" label="查询" color="" onClick={() => onTool("query")} />
          <span className="w-px h-4 bg-[var(--line)] mx-0.5" />
          <ToolBtn icon="on" label="在职" color="border-[rgba(48,209,88,.55)] text-[#1f8f4d] dark:text-[#7ede99] bg-[rgba(48,209,88,.12)]"
            active={p.employ === "在职"} onClick={() => onTool("在职")} />
          <ToolBtn icon="retire" label="退休" color="border-[rgba(255,159,10,.55)] text-[#a26603] dark:text-[#ffbe69] bg-[rgba(255,159,10,.12)]"
            active={p.employ === "退休"} onClick={() => onTool("退休")} />
          <ToolBtn icon="stop" label="止薪" color="border-[rgba(255,69,58,.55)] text-[#d70015] dark:text-[#ff8b84] bg-[rgba(255,69,58,.1)]"
            active={p.employ === "止薪"} onClick={() => onTool("止薪")} />
        </div>

        {/* 工作区切换 */}
        <div className="seg shrink-0">
          <button className={`seg-item ${mode === "profile" ? "active" : ""}`} onClick={() => setMode("profile")}>
            <Icon name="user" size={12} />人员档案
          </button>
          <button className={`seg-item ${mode === "calc" ? "active" : ""}`} onClick={() => setMode("calc")}>
            <Icon name="sum" size={12} />套改测算
          </button>
        </div>
      </div>

      {mode === "calc" ? (
        <SalaryCalc person={p} onToast={onToast} prefill={prefill} />
      ) : (
        <>
          {/* 上部：基本信息 + 套改明细 */}
          <div className="shrink-0 grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-3">
            <div className="card-panel overflow-hidden">
              <CardHead icon="user" title="人员基本信息"
                extra={<span className="font-mono2 text-[10.5px] text-[var(--tx-3)]">ID {String(p.id).padStart(4, "0")}</span>} />
              <div className="px-3.5 py-1.5">
                <InfoRow k="编号" v={p.id} mono />
                <InfoRow k="姓名" v={<b>{p.name}</b>} />
                <InfoRow k="性别" v={p.gender} />
                <InfoRow k="身份" v={p.identity} />
                <InfoRow k="是否领导" v={p.leader ? <span className="text-[#a26603] dark:text-[#ffbe69]">{p.leader}</span> : <span className="text-[var(--tx-3)]">（未填写）</span>} />
                <InfoRow k="出生时间" v={p.birth} mono />
                <InfoRow k="工改时学历" v={p.edu} />
                <InfoRow k="大专以上未计工龄学习" v={<span className="font-mono2">{p.studyYears} 年</span>} />
              </div>
            </div>

            <div className="card-panel overflow-hidden">
              <CardHead icon="sum" title="套改明细（2006 工资套改）"
                extra={
                  <span className="text-[10.5px] px-2 py-[3px] rounded border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.1)] text-[#1f8f4d] dark:text-[#7ede99]">
                    当前套改类型：{p.curType}
                  </span>
                } />
              <div className="px-1.5 py-1.5">
                {tgRows.map(([label, row], i) => {
                  const isWin = i === win;
                  return (
                    <div
                      key={label}
                      className={`flex items-baseline gap-3 mx-2 px-2 py-[7px] rounded-md border-b border-[var(--line-2)] last:border-0 ${
                        isWin ? "bg-[var(--sel)] border-l-2 border-l-[var(--acc)]" : ""
                      }`}
                    >
                      <span className="w-[76px] shrink-0 text-[11.5px] text-[var(--tx-2)] flex items-center gap-1.5">
                        {isWin && <Icon name="check" size={11} className="text-[var(--acc)]" />}
                        {label}
                      </span>
                      <span className={`font-mono2 text-[13px] font-semibold shrink-0 w-[130px] ${isWin ? "text-[var(--acc)]" : "text-[var(--tx-1)]"}`}>
                        {row.result}
                      </span>
                      <span className="text-[11px] text-[var(--tx-3)] leading-snug">{row.note}</span>
                    </div>
                  );
                })}
                <div className="flex items-baseline gap-3 mx-2 mt-1 px-2 py-[7px] rounded-md bg-[var(--hov)]">
                  <span className="w-[76px] shrink-0 text-[11.5px] text-[var(--tx-2)]">参工时间</span>
                  <span className="font-mono2 text-[13px] font-semibold text-[var(--tx-1)] shrink-0 w-[130px]">{p.join}</span>
                  <span className="text-[11px] text-[var(--tx-3)]">
                    工龄间断 {p.gap} 年，{p.unq}，套改年限 <b className="font-mono2 text-[var(--tx-2)]">{p.tYears}</b> 年
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 下部：工资演变 */}
          <HistoryTable history={p.history} />
        </>
      )}
    </div>
  );
}
