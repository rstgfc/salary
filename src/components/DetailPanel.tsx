import React from "react";
import { EMPLOY_META, Employ, Person, SalaryRecord, TAG_META, fmt, lastOf } from "../data";
import { Icon, IconName } from "./icons";

/* ---------- 区块标题 ---------- */
function CardHead({ icon, title, extra }: { icon: IconName; title: string; extra?: React.ReactNode }) {
  return (
    <div className="card-head flex items-center gap-2 px-3.5 h-9 rounded-t-[10px]">
      <span className="w-1 h-3.5 rounded-full bg-gradient-to-b from-[#0a84ff] to-[#5ac8fa]" />
      <Icon name={icon} size={14} className="text-[#6db1ff]" />
      <span className="text-[12.5px] font-semibold text-[#dde2ec] tracking-wide">{title}</span>
      <span className="ml-auto">{extra}</span>
    </div>
  );
}

/* ---------- 信息行 ---------- */
function InfoRow({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-[7px] border-b border-white/[.045] last:border-0">
      <span className="w-[150px] shrink-0 text-[11.5px] text-[#8b95a7]">{k}</span>
      <span className={`text-[12.5px] text-[#e2e6ee] ${mono ? "font-mono2" : ""}`}>{v}</span>
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
        active ? `${color} shadow-[0_0_12px_rgba(255,255,255,.05)]` : "border-[#333a47] text-[#aab3c2] bg-[#1d2129] hover:bg-[#242935] hover:text-[#e2e6ee]"
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
  { key: "ten", label: "10%工资", num: true, w: 72 },
  { key: "promo", label: "晋级档起", w: 92 },
  { key: "exam", label: "考年份", w: 86 },
  { key: "retire", label: "基本离退休费", num: true, w: 96 },
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
            <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[#333a47] text-[#8b95a7]">
              {history.length} 条记录
            </span>
            <span className="font-mono2 text-[10.5px] px-1.5 py-px rounded border border-[rgba(48,209,88,.4)] bg-[rgba(48,209,88,.08)] text-[#7ede99]">
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
                  className={`sticky top-0 z-10 px-2 py-1.5 bg-[#242935] border-b border-[#333a47] text-[10.5px] font-medium text-[#8b95a7] whitespace-nowrap ${
                    c.num ? "text-right" : "text-left"
                  }`}
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
                  className={`border-b border-white/[.04] transition-colors ${
                    isLast
                      ? "bg-[rgba(10,132,255,.06)] hover:bg-[rgba(10,132,255,.1)]"
                      : i % 2 === 1
                        ? "bg-white/[.015] hover:bg-white/[.05]"
                        : "hover:bg-white/[.05]"
                  }`}
                >
                  <td className="px-2 py-[5px] text-right font-mono2 text-[#5d6779] relative">
                    {isLast && <span className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-[#0a84ff]" />}
                    {r.seq}
                  </td>
                  <td className="px-2 py-[5px] font-mono2 text-[#a9c4e6] whitespace-nowrap">{r.start}</td>
                  <td className={`px-2 py-[5px] whitespace-nowrap ${isLast ? "text-[#e2e6ee] font-medium" : "text-[#c3cad6]"}`}>
                    {r.reason}
                  </td>
                  <td className="px-2 py-[5px] text-[#c3cad6] whitespace-nowrap">{r.position}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[#8ed6fa] whitespace-nowrap">{r.level}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[#e2e6ee]">{fmt(r.pw)}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[#e2e6ee]">{fmt(r.lw)}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[#667082]">{r.ten}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[#8b95a7] whitespace-nowrap">{r.promo}</td>
                  <td className="px-2 py-[5px] font-mono2 text-[#8b95a7] whitespace-nowrap">{r.exam}</td>
                  <td className="px-2 py-[5px] text-right font-mono2 text-[#8b95a7]">{r.retire}</td>
                  <td className={`px-2 py-[5px] text-right font-mono2 ${incr > 0 ? "text-[#7ede99]" : "text-[#5d6779]"}`}>
                    {incr > 0 ? `+${fmt(incr)}` : r.incr || "—"}
                  </td>
                  <td className="px-2 py-[5px] text-[#8b95a7]">{r.note || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {last && (
        <div className="shrink-0 h-8 px-3.5 flex items-center gap-4 border-t border-[#2c323e] bg-[#1a1e25] text-[11px] text-[#8b95a7]">
          <span>现执行标准（{last.start} 起）</span>
          <span className="font-mono2 text-[#c3cad6]">职务 ¥{fmt(last.pw)}</span>
          <span className="font-mono2 text-[#c3cad6]">级别 ¥{fmt(last.lw)}</span>
          <span className="font-mono2 text-[13px] font-semibold text-[#6db1ff]">
            基本工资合计 ¥{fmt(last.pw + last.lw)}<span className="text-[10px] text-[#667082] font-normal"> /月</span>
          </span>
          <span className="ml-auto flex items-center gap-1 text-[#5d6779]">
            <Icon name="clock" size={11} />
            数据源：2006 工改台账
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- 主面板 ---------- */
export function DetailPanel({ person, unitName, onTool }: {
  person: Person | null;
  unitName: string;
  onTool: (a: "query" | Employ) => void;
}) {
  if (!person) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-14 h-14 rounded-2xl border border-dashed border-[#3d4553] flex items-center justify-center">
          <Icon name="user" size={26} className="text-[#3d4553]" />
        </div>
        <p className="mt-4 text-[14px] font-medium text-[#9aa3b2]">人员列表为空</p>
        <p className="mt-1.5 text-[12px] text-[#667082] max-w-[340px] leading-relaxed">
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
      <div className="shrink-0 flex items-center gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono2 text-[12px] px-2 py-1 rounded-md border border-[#333a47] bg-[#1d2129] text-[#8ed6fa]">
            №{String(p.id).padStart(3, "0")}
          </span>
          <h2 className="text-[17px] font-bold text-white tracking-wide truncate">{p.name}</h2>
          {tag && <span className={`text-[10.5px] leading-none px-2 py-[4px] rounded border ${tag.cls}`}>{p.tag}</span>}
          <span className={`flex items-center gap-1.5 text-[10.5px] leading-none px-2 py-[4px] rounded border ${emp.cls}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: emp.dot }} />
            {p.employ}
          </span>
          <span className="font-mono2 text-[11px] text-[#667082] truncate hidden md:inline">[{p.unitId}] {unitName}</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <ToolBtn icon="search" label="查询" color="" onClick={() => onTool("query")} />
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          <ToolBtn icon="on" label="在职" color="border-[rgba(48,209,88,.5)] text-[#7ede99] bg-[rgba(48,209,88,.1)]"
            active={p.employ === "在职"} onClick={() => onTool("在职")} />
          <ToolBtn icon="retire" label="退休" color="border-[rgba(255,159,10,.5)] text-[#ffbe69] bg-[rgba(255,159,10,.1)]"
            active={p.employ === "退休"} onClick={() => onTool("退休")} />
          <ToolBtn icon="stop" label="止薪" color="border-[rgba(255,69,58,.5)] text-[#ff8b84] bg-[rgba(255,69,58,.1)]"
            active={p.employ === "止薪"} onClick={() => onTool("止薪")} />
        </div>
      </div>

      {/* 上部：基本信息 + 套改明细 */}
      <div className="shrink-0 grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-3">
        <div className="card-panel overflow-hidden">
          <CardHead icon="user" title="人员基本信息"
            extra={<span className="font-mono2 text-[10.5px] text-[#5d6779]">ID {String(p.id).padStart(4, "0")}</span>} />
          <div className="px-3.5 py-1.5">
            <InfoRow k="编号" v={p.id} mono />
            <InfoRow k="姓名" v={<b>{p.name}</b>} />
            <InfoRow k="性别" v={p.gender} />
            <InfoRow k="身份" v={p.identity} />
            <InfoRow k="是否领导" v={p.leader ? <span className="text-[#ffbe69]">{p.leader}</span> : <span className="text-[#5d6779]">（未填写）</span>} />
            <InfoRow k="出生时间" v={p.birth} mono />
            <InfoRow k="工改时学历" v={p.edu} />
            <InfoRow k="大专以上未计工龄学习" v={<span className="font-mono2">{p.studyYears} 年</span>} />
          </div>
        </div>

        <div className="card-panel overflow-hidden">
          <CardHead icon="sum" title="套改明细（2006 工资套改）"
            extra={
              <span className="text-[10.5px] px-2 py-[3px] rounded border border-[rgba(48,209,88,.45)] bg-[rgba(48,209,88,.08)] text-[#7ede99]">
                当前套改类型：{p.curType}
              </span>
            } />
          <div className="px-1.5 py-1.5">
            {tgRows.map(([label, row], i) => {
              const isWin = i === win;
              return (
                <div
                  key={label}
                  className={`flex items-baseline gap-3 mx-2 px-2 py-[7px] rounded-md border-b border-white/[.04] last:border-0 ${
                    isWin ? "bg-[rgba(10,132,255,.07)] border-l-2 border-l-[#0a84ff]" : ""
                  }`}
                >
                  <span className="w-[76px] shrink-0 text-[11.5px] text-[#8b95a7] flex items-center gap-1.5">
                    {isWin && <Icon name="check" size={11} className="text-[#6db1ff]" />}
                    {label}
                  </span>
                  <span className={`font-mono2 text-[13px] font-semibold shrink-0 w-[130px] ${isWin ? "text-[#6db1ff]" : "text-[#c3cad6]"}`}>
                    {row.result}
                  </span>
                  <span className="text-[11px] text-[#667082] leading-snug">{row.note}</span>
                </div>
              );
            })}
            <div className="flex items-baseline gap-3 mx-2 mt-1 px-2 py-[7px] rounded-md bg-white/[.03]">
              <span className="w-[76px] shrink-0 text-[11.5px] text-[#8b95a7]">参工时间</span>
              <span className="font-mono2 text-[13px] font-semibold text-[#e2e6ee] shrink-0 w-[130px]">{p.join}</span>
              <span className="text-[11px] text-[#667082]">
                工龄间断 {p.gap} 年，{p.unq}，套改年限 <b className="font-mono2 text-[#9aa3b2]">{p.tYears}</b> 年
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 下部：工资演变 */}
      <HistoryTable history={p.history} />
    </div>
  );
}
