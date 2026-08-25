import React, { useState } from "react";
import {
  AllowanceItem, DUTY_TABLE, POSITION_LEVELS, Person, RANK_TABLE, Unit,
  defaultAllowances, fmt, lastOf,
} from "../data";
import { Icon } from "./icons";
import { Btn, Modal } from "./modals";

/* ================= 计算器 ================= */
export function CalcModal({ onClose }: { onClose: () => void }) {
  const [disp, setDisp] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);
  const [tape, setTape] = useState<string[]>([]);

  const input = (d: string) => {
    if (fresh) { setDisp(d === "." ? "0." : d); setFresh(false); return; }
    if (d === "." && disp.includes(".")) return;
    if (disp.replace("-", "").replace(".", "").length >= 12) return;
    setDisp(disp === "0" && d !== "." ? d : disp + d);
  };
  const apply = (a: number, b: number, o: string) =>
    o === "+" ? a + b : o === "−" ? a - b : o === "×" ? a * b : b === 0 ? NaN : a / b;
  const format = (n: number) => {
    if (Number.isNaN(n)) return "错误";
    const r = parseFloat(n.toPrecision(12));
    return String(r);
  };
  const chooseOp = (o: string) => {
    const cur = parseFloat(disp);
    if (acc !== null && op && !fresh) {
      const r = apply(acc, cur, op);
      setAcc(r); setDisp(format(r));
    } else setAcc(cur);
    setOp(o); setFresh(true);
  };
  const equals = () => {
    if (acc === null || !op) return;
    const cur = parseFloat(disp);
    const r = apply(acc, cur, op);
    setTape((t) => [`${format(acc)} ${op} ${format(cur)} = ${format(r)}`, ...t].slice(0, 8));
    setDisp(format(r)); setAcc(null); setOp(null); setFresh(true);
  };
  const clear = () => { setDisp("0"); setAcc(null); setOp(null); setFresh(true); };

  const Key = ({ label, onClick, kind = "num", span }: {
    label: string; onClick: () => void; kind?: "num" | "op" | "fn" | "eq"; span?: boolean;
  }) => {
    const cls = {
      num: "bg-[#262b35] hover:bg-[#303743] text-[#e2e6ee]",
      op: "bg-[rgba(10,132,255,.16)] hover:bg-[rgba(10,132,255,.28)] text-[#6db1ff]",
      fn: "bg-[#333a47] hover:bg-[#3d4553] text-[#c3cad6]",
      eq: "bg-[#0a84ff] hover:bg-[#3395ff] text-white shadow-[0_4px_14px_rgba(10,132,255,.35)]",
    }[kind];
    return (
      <button onClick={onClick}
        className={`h-10 rounded-lg text-[14px] font-mono2 font-semibold transition-all active:scale-[.94] ${cls} ${span ? "col-span-2" : ""}`}>
        {label}
      </button>
    );
  };

  return (
    <Modal title="计算器" icon="calc" onClose={onClose} w={520}
      footer={<><Btn onClick={() => setTape([])}>清空记录</Btn><Btn kind="primary" onClick={onClose}>完成</Btn></>}>
      <div className="grid grid-cols-[1fr_190px] gap-3">
        <div>
          <div className="rounded-lg border border-[#2c323e] bg-[#14171d] px-3.5 py-2.5">
            <p className="h-4 text-right font-mono2 text-[11px] text-[#5d6779]">
              {acc !== null && op ? `${format(acc)} ${op}` : ""}
            </p>
            <p className="text-right font-mono2 text-[27px] font-semibold text-[#e8eaf0] truncate leading-tight">{disp}</p>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            <Key label="C" kind="fn" onClick={clear} />
            <Key label="±" kind="fn" onClick={() => setDisp(disp.startsWith("-") ? disp.slice(1) : disp === "0" ? disp : "-" + disp)} />
            <Key label="%" kind="fn" onClick={() => setDisp(format(parseFloat(disp) / 100))} />
            <Key label="÷" kind="op" onClick={() => chooseOp("÷")} />
            <Key label="7" onClick={() => input("7")} /><Key label="8" onClick={() => input("8")} /><Key label="9" onClick={() => input("9")} />
            <Key label="×" kind="op" onClick={() => chooseOp("×")} />
            <Key label="4" onClick={() => input("4")} /><Key label="5" onClick={() => input("5")} /><Key label="6" onClick={() => input("6")} />
            <Key label="−" kind="op" onClick={() => chooseOp("−")} />
            <Key label="1" onClick={() => input("1")} /><Key label="2" onClick={() => input("2")} /><Key label="3" onClick={() => input("3")} />
            <Key label="+" kind="op" onClick={() => chooseOp("+")} />
            <Key label="0" span onClick={() => input("0")} />
            <Key label="." onClick={() => input(".")} />
            <Key label="=" kind="eq" onClick={equals} />
          </div>
        </div>
        <div className="rounded-lg border border-[#2c323e] bg-[#191d24] flex flex-col overflow-hidden">
          <p className="px-3 h-8 flex items-center gap-1.5 text-[10.5px] text-[#8b95a7] border-b border-[#2c323e]">
            <Icon name="clock" size={11} /> 计算记录
          </p>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {tape.length === 0 && <p className="text-[10.5px] text-[#5d6779] text-center pt-6">暂无记录</p>}
            {tape.map((t, i) => (
              <p key={i} className="font-mono2 text-[10.5px] text-[#9aa3b2] bg-white/[.03] rounded px-2 py-1.5 truncate">{t}</p>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ================= 津贴编辑输出 ================= */
export function AllowanceModal({ person, unitName, onClose, onToast }: {
  person: Person; unitName: string; onClose: () => void;
  onToast: (type: "success" | "error" | "info", msg: string) => void;
}) {
  const [items, setItems] = useState<AllowanceItem[]>(() => defaultAllowances(person));
  const last = lastOf(person);
  const total = items.reduce((s, i) => s + (i.std || 0), 0);
  const monthly = last.pw + last.lw + total;

  const setStd = (id: string, v: string) =>
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, std: Math.max(0, Number(v) || 0) } : i)));

  const output = async () => {
    const lines = [
      "【津贴编辑输出】公务员工资测算系统 V8.2",
      `单位：[${person.unitId}] ${unitName}`,
      `人员：编号${person.id} ${person.name}（${person.tag} · ${person.employ}）`,
      `现执行基本工资：职务 ¥${fmt(last.pw)} + 级别 ¥${fmt(last.lw)} = ¥${fmt(last.pw + last.lw)}`,
      "----------------------------------------",
      ...items.map((i) => `${i.name}（${i.base}）：¥${fmt(i.std)} /月`),
      "----------------------------------------",
      `津贴补贴小计：¥${fmt(total)} /月`,
      `月度合计发放：¥${fmt(monthly)} /月`,
      `输出时间：${new Date().toLocaleString("zh-CN")}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      onToast("success", "津贴方案已输出到剪贴板，可粘贴至报表或小程序后台");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = lines;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onToast("success", "津贴方案已输出到剪贴板");
    }
  };

  return (
    <Modal title={`津贴编辑输出 · ${person.name}`} icon="allowance" onClose={onClose} w={560}
      footer={
        <>
          <Btn onClick={() => setItems(defaultAllowances(person))}>恢复默认</Btn>
          <Btn onClick={onClose}>关闭</Btn>
          <Btn kind="primary" onClick={output}><span className="flex items-center gap-1.5"><Icon name="copy" size={12} />输出</span></Btn>
        </>
      }>
      <div className="rounded-lg border border-[#2c323e] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              {["津贴项目", "计发依据", "月标准（元）"].map((h) => (
                <th key={h} className="px-3 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] bg-[#242935] border-b border-[#333a47]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-white/[.04] hover:bg-white/[.03] transition-colors">
                <td className="px-3 py-1.5 text-[#e2e6ee]">{i.name}</td>
                <td className="px-3 py-1.5 text-[#8b95a7]">{i.base}</td>
                <td className="px-3 py-1.5">
                  <input type="number" min={0} value={i.std}
                    onChange={(e) => setStd(i.id, e.target.value)}
                    className="field w-24 h-7 px-2 text-right font-mono2 text-[12.5px]" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["基本工资", last.pw + last.lw, "#c3cad6"],
          ["津贴小计", total, "#8ed6fa"],
          ["月度合计", monthly, "#7ede99"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="rounded-lg border border-[#2c323e] bg-[#191d24] px-3 py-2.5">
            <p className="text-[10.5px] text-[#667082]">{k}</p>
            <p className="font-mono2 text-[16px] font-semibold mt-0.5" style={{ color: c as string }}>¥{fmt(v as number)}</p>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-[10.5px] text-[#5d6779]">
        提示：修改后的标准仅保存在本次会话，点击「输出」生成文本结果，供小程序后台或报表使用。
      </p>
    </Modal>
  );
}

/* ================= 目录数据 ================= */
type CatalogTab = "unit" | "duty" | "rank" | "position";

export function CatalogModal({ units, persons, onClose }: {
  units: Unit[]; persons: Person[]; onClose: () => void;
}) {
  const [tab, setTab] = useState<CatalogTab>("rank");
  const tabs: [CatalogTab, string][] = [
    ["unit", "单位目录"], ["duty", "职务工资表"], ["rank", "级别工资表"], ["position", "职务层次表"],
  ];

  return (
    <Modal title="目录数据" icon="catalog" onClose={onClose} w={680}
      footer={<><span className="mr-auto text-[11px] text-[#667082]">数据基准：2006 年工资制度改革 · 仅作测算参考</span><Btn kind="primary" onClick={onClose}>关闭</Btn></>}>
      <div className="flex items-center gap-1 border-b border-[#2c323e]">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 h-8 text-[12px] rounded-t-md border-b-2 transition ${
              tab === k
                ? "border-[#0a84ff] text-[#6db1ff] bg-[rgba(10,132,255,.06)]"
                : "border-transparent text-[#8b95a7] hover:text-[#e2e6ee]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-[#2c323e] overflow-hidden">
        <div className="max-h-[380px] overflow-auto">
          {tab === "unit" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["单位编号", "单位名称", "人员数"].map((h) => (
                <th key={h} className="sticky top-0 px-3 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] bg-[#242935] border-b border-[#333a47]">{h}</th>))}
              </tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-b border-white/[.04] hover:bg-white/[.03]">
                    <td className="px-3 py-2 font-mono2 text-[#8ed6fa]">[{u.id}]</td>
                    <td className="px-3 py-2 text-[#e2e6ee]">{u.name}</td>
                    <td className="px-3 py-2 font-mono2 text-[#8b95a7]">{persons.filter((p) => p.unitId === u.id).length} 人</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "duty" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["职务", "职务工资（元/月）", "对应级别"].map((h) => (
                <th key={h} className="sticky top-0 px-3 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] bg-[#242935] border-b border-[#333a47]">{h}</th>))}
              </tr></thead>
              <tbody>
                {DUTY_TABLE.map(([d, w, l], i) => (
                  <tr key={d} className={`border-b border-white/[.04] ${i % 2 === 1 ? "bg-white/[.015]" : ""} hover:bg-[rgba(10,132,255,.05)]`}>
                    <td className="px-3 py-1.5 text-[#e2e6ee]">{d}</td>
                    <td className="px-3 py-1.5 font-mono2 text-[#c3cad6] text-right">{fmt(w)}</td>
                    <td className="px-3 py-1.5 font-mono2 text-[#8b95a7]">{l}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "rank" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["级别", "", "档次 1", "档次 2", "档次 3", "档次 4"].map((h, i) => (
                <th key={i} className={`sticky top-0 px-3 py-1.5 text-[10.5px] font-medium text-[#8b95a7] bg-[#242935] border-b border-[#333a47] ${i >= 2 ? "text-right" : "text-left"}`}>{h}</th>))}
              </tr></thead>
              <tbody>
                {RANK_TABLE.map(([name, , d1, d2, d3, d4], i) => (
                  <tr key={name} className={`border-b border-white/[.04] ${i % 2 === 1 ? "bg-white/[.015]" : ""} hover:bg-[rgba(10,132,255,.05)]`}>
                    <td className="px-3 py-1.5 text-[#8ed6fa]">{name}</td>
                    <td className="px-1 py-1.5" />
                    {[d1, d2, d3, d4].map((d, j) => (
                      <td key={j} className="px-3 py-1.5 font-mono2 text-[#c3cad6] text-right">{fmt(d)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "position" && (
            <table className="w-full text-[12px]">
              <thead><tr>{["职务层次", "对应级别范围"].map((h) => (
                <th key={h} className="sticky top-0 px-3 py-1.5 text-left text-[10.5px] font-medium text-[#8b95a7] bg-[#242935] border-b border-[#333a47]">{h}</th>))}
              </tr></thead>
              <tbody>
                {POSITION_LEVELS.map((r, i) => (
                  <tr key={r.rank} className={`border-b border-white/[.04] ${i % 2 === 1 ? "bg-white/[.015]" : ""} hover:bg-[rgba(10,132,255,.05)]`}>
                    <td className="px-3 py-2 text-[#e2e6ee]">{r.rank}</td>
                    <td className="px-3 py-2 font-mono2 text-[#8ed6fa]">{r.levels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
