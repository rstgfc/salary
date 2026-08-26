import React from "react";
import { EMPLOY_META, Person, TAG_META, Unit } from "../data";
import { Icon } from "./icons";

export function PersonList({ persons, total, selectedId, onSelect, query, onQuery, units }: {
  persons: Person[];
  total: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
  query: string;
  onQuery: (q: string) => void;
  units: Unit[];
}) {
  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "未知单位";
  const onDuty = persons.filter((p) => p.employ === "在职").length;

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

      {/* 搜索 */}
      <div className="px-2.5 py-2 shrink-0">
        <div className="relative">
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
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-1">
        {persons.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Icon name="search" size={22} className="mx-auto text-[var(--tx-3)]" />
            <p className="mt-2 text-[12px] text-[var(--tx-3)]">无匹配人员</p>
          </div>
        )}
        {persons.map((p) => {
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
        <span>筛选 <b className="font-mono2 text-[var(--tx-2)]">{persons.length}</b> / {total}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#30d158]" />
          在职 <b className="font-mono2 text-[var(--tx-2)]">{onDuty}</b>
        </span>
      </div>
    </div>
  );
}
