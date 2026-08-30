import React, { useMemo, useState } from "react";
import { EMPLOY_META, Person, POSITION_LEVELS, TAG_META, Unit } from "../data";
import { latestDutyLabel } from "../core/calculator";
import { Icon } from "./icons";

/* 需求2：排序 / 筛选辅助 —— "1952年9月" → 195209 */
const ymOf = (s: string): number => {
  const m = /(\d{4})年(\d{1,2})月/.exec(s ?? "");
  return m ? Number(m[1]) * 100 + Number(m[2]) : 999912;
};
/* 需求2：职务层次（用于筛选与排序）—— 与列表显示同源，取最新测算职务，回退档案职务 */
const dutyOf = (p: Person): string => {
  const raw = (latestDutyLabel(p) || p.position || "").replace(/（.*?）/g, "").trim();
  return raw || "未定职务";
};
/* 职务层次序号（POSITION_LEVELS 自高到低，未匹配排最后） */
const rankOfDuty = (d: string): number => {
  const i = POSITION_LEVELS.findIndex((r) => d === r.rank || d.startsWith(r.rank));
  return i >= 0 ? i : POSITION_LEVELS.length;
};

type SortKey = "none" | "duty" | "birth" | "join";

export function PersonList({ persons, total, selectedId, onSelect, query, onQuery, units, tick, onQueryModal }: {
  persons: Person[];
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  query: string;
  onQuery: (q: string) => void;
  units: Unit[];
  tick?: number; // 需求2：测算保存后变化，触发最新职务重新读取
  onQueryModal?: () => void; // 需求3：打开综合查询弹窗
}) {
  void tick;
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "未知单位";
  const onDuty = persons.filter((p) => p.employ === "在职").length;

  /* 需求2：筛选 + 排序状态 */
  const [filOpen, setFilOpen] = useState(false);
  const [fUnit, setFUnit] = useState("all");
  const [fGender, setFGender] = useState("all");
  const [fDuty, setFDuty] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /* 需求2：职务筛选项（去重，按职务层次自高到低） */
  const dutyOpts = useMemo(() => {
    const set = new Set<string>();
    persons.forEach((p) => set.add(dutyOf(p)));
    return Array.from(set).sort((a, b) => rankOfDuty(a) - rankOfDuty(b));
  }, [persons]);

  const filCount = (fUnit !== "all" ? 1 : 0) + (fGender !== "all" ? 1 : 0) + (fDuty !== "all" ? 1 : 0);
  const clearFilter = () => { setFUnit("all"); setFGender("all"); setFDuty("all"); };

  /* 需求2：筛选 + 排序后的列表 */
  const view = useMemo(() => {
    let arr = persons.filter((p) =>
      (fUnit === "all" || p.unitId === fUnit) &&
      (fGender === "all" || p.gender === fGender) &&
      (fDuty === "all" || dutyOf(p) === fDuty)
    );
    if (sortKey !== "none") {
      const key = sortKey === "duty" ? (p: Person) => rankOfDuty(dutyOf(p)) : sortKey === "birth" ? (p: Person) => ymOf(p.birth) : (p: Person) => ymOf(p.join);
      arr = [...arr].sort((a, b) => (sortDir === "asc" ? 1 : -1) * (key(a) - key(b)));
    }
    return arr;
  }, [persons, fUnit, fGender, fDuty, sortKey, sortDir]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-1)]">
      {/* 表头标签 */}
      <div className="h-9 shrink-0 flex items-center justify-between px-3 border-b border-[var(--line)]">
        <span className="text-[11px] tracking-wide text-[var(--tx-2)]">
          编号/姓名&nbsp;&nbsp;单位
        </span>
        <span className="font-mono2 text-[11px] px-1.5 py-px rounded border border-[rgba(10,132,255,.4)] bg-[var(--sel)] text-[var(--acc)]">
          （{total}）人
        </span>
      </div>

      {/* 搜索 + 需求3：查询按钮移到检索框右侧 */}
      <div className="px-2.5 py-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Icon name="search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--tx-3)]" />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="检索编号 / 姓名 / 单位"
              className="field w-full h-7 pl-8 pr-7 text-[12px]"
            />
            {query && (
              <button onClick={() => onQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx-3)] hover:text-[var(--tx-1)]">
                <Icon name="close" size={11} />
              </button>
            )}
          </div>
          <button onClick={() => onQueryModal?.()} title="打开综合查询"
            className="shrink-0 h-7 px-2.5 rounded-md border border-[rgba(10,132,255,.5)] bg-[var(--sel)] text-[var(--acc)] text-[12px] font-medium flex items-center gap-1 hover:bg-[var(--sel-strong)] transition active:scale-95">
            <Icon name="query" size={12} />查询
          </button>
        </div>
      </div>

      {/* 需求2：筛选 + 排序工具行 */}
      <div className="px-2.5 pb-2 shrink-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setFilOpen((v) => !v)}
            title="按单位 / 性别 / 职务筛选"
            className={`shrink-0 h-7 px-2 rounded-md border text-[11px] flex items-center gap-1 transition active:scale-95 ${
              filCount ? "border-[rgba(10,132,255,.55)] bg-[var(--sel)] text-[var(--acc)]" : "border-[var(--line)] bg-[var(--bg-2)] text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)]"
            }`}>
            <Icon name="filter" size={11} />筛选
            {filCount > 0 && (
              <span className="min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#0a84ff] text-white text-[10px] font-bold flex items-center justify-center">{filCount}</span>
            )}
          </button>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            title="选择排序依据"
            className="field h-7 flex-1 min-w-0 px-1.5 text-[11px]">
            <option value="none">默认排序</option>
            <option value="duty">按职务层次</option>
            <option value="birth">按出生年月</option>
            <option value="join">按参公时间</option>
          </select>
          <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            disabled={sortKey === "none"} title={sortDir === "asc" ? "当前升序，点击降序" : "当前降序，点击升序"}
            className="shrink-0 w-7 h-7 rounded-md border border-[var(--line)] bg-[var(--bg-2)] flex items-center justify-center text-[var(--tx-2)] hover:text-[var(--acc)] hover:bg-[var(--hov)] transition active:scale-95 disabled:opacity-35 disabled:pointer-events-none">
            <Icon name="sort" size={12} className={sortDir === "asc" ? "" : "rotate-180"} />
          </button>
        </div>

        {filOpen && (
          <div className="anim-fade rounded-lg border border-[var(--line)] bg-[var(--bg-2)] p-1.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 w-8 text-[10.5px] text-[var(--tx-3)]">单位</span>
              <select value={fUnit} onChange={(e) => setFUnit(e.target.value)} className="field h-7 flex-1 min-w-0 px-1.5 text-[11px]">
                <option value="all">全部单位</option>
                {units.map((u) => <option key={u.id} value={u.id}>[{u.id}] {u.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 w-8 text-[10.5px] text-[var(--tx-3)]">性别</span>
              <select value={fGender} onChange={(e) => setFGender(e.target.value)} className="field h-7 flex-1 min-w-0 px-1.5 text-[11px]">
                <option value="all">全部</option>
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 w-8 text-[10.5px] text-[var(--tx-3)]">职务</span>
              <select value={fDuty} onChange={(e) => setFDuty(e.target.value)} className="field h-7 flex-1 min-w-0 px-1.5 text-[11px]">
                <option value="all">全部职务</option>
                {dutyOpts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {filCount > 0 && (
              <button onClick={clearFilter}
                className="h-6 rounded-md border border-dashed border-[rgba(255,69,58,.5)] text-[#d70015] dark:text-[#ff8b84] text-[10.5px] hover:bg-[rgba(255,69,58,.08)] transition active:scale-95">
                清除全部筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-1">
        {view.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Icon name="search" size={22} className="mx-auto text-[var(--tx-3)]" />
            <p className="mt-2 text-[12px] text-[var(--tx-3)]">无匹配人员</p>
          </div>
        )}
        {view.map((p) => {
          const sel = p.id === selectedId;
          const tag = TAG_META[p.tag];
          const emp = EMPLOY_META[p.employ];
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`list-row w-full text-left px-2.5 py-2 border-l-2 ${
                sel ? "bg-[var(--sel)] border-l-[var(--acc)]" : "border-l-transparent hover:bg-[var(--hov)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono2 text-[12px] w-5 shrink-0 ${sel ? "text-[var(--acc)]" : "text-[var(--tx-3)]"}`}>
                  {p.id}
                </span>
                <span className={`text-[13px] font-medium truncate ${sel ? "text-[var(--tx-1)]" : "text-[var(--tx-1)]"}`}>
                  {p.name}
                </span>
                <span
                  className="ml-auto w-2 h-2 rounded-full shrink-0"
                  style={{ background: emp.dot, boxShadow: `0 0 6px ${emp.dot}66` }}
                  title={p.employ}
                />
              </div>
              {/* 需求2：最新职务 */}
              <div className="mt-1 pl-7 flex items-center gap-1.5 min-w-0">
                <Icon name="user" size={11} className="text-[var(--acc)] shrink-0" />
                <span className="text-[11px] text-[var(--tx-1)] truncate font-medium">{latestDutyLabel(p)}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 pl-7">
                <span className="font-mono2 text-[10.5px] text-[var(--tx-3)] truncate">[{p.unitId}] {unitName(p.unitId)}</span>
                {tag && (
                  <span className={`ml-auto shrink-0 text-[10px] leading-none px-1.5 py-[3px] rounded border ${tag.cls}`}>
                    {p.tag}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 底栏 */}
      <div className="h-8 shrink-0 border-t border-[var(--line)] flex items-center justify-between px-3 text-[11px] text-[var(--tx-3)]">
        <span>筛选 <b className="font-mono2 text-[var(--tx-2)]">{view.length}</b> / {total}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
          在职 <b className="font-mono2 text-[var(--tx-2)]">{onDuty}</b>
        </span>
      </div>
    </div>
  );
}
