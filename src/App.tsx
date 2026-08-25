import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Employ, INITIAL_UNITS, PEOPLE, Person, Unit } from "./data";
import { MenuBar, MenuKey, StatusBar, TitleBar, Toast, ToastStack } from "./components/chrome";
import { PersonList } from "./components/PersonList";
import { DetailPanel } from "./components/DetailPanel";
import {
  ConfirmDeleteModal, ExitModal, ExitScreen, HelpModal, QueryModal,
  RecalcModal, RegisterModal, RollingModal, UnitModal,
} from "./components/modals";
import { AllowanceModal, CalcModal, CatalogModal } from "./components/tools";
import { Icon } from "./components/icons";
import { Calculator, PERSON_CALC_INPUTS, POLICY_CONFIG, levelWage } from "./core/calculator";

/* ---------- 全部重算：调用核心模块重新执行三方案套改比对 ---------- */
function recomputePerson(p: Person): { next: Person; changed: boolean; skipped: boolean } {
  const inp = PERSON_CALC_INPUTS[p.id];
  if (!inp) return { next: p, changed: false, skipped: true }; // 工人/专技等轨道不适用

  if (inp.type === "post2006") {
    const edu = POLICY_CONFIG.EDUCATION[inp.eduValue] ?? POLICY_CONFIG.EDUCATION[4];
    const pb = edu.probation;
    const result = `${pb.level}.${pb.grade} 工资 ${levelWage(pb.level, pb.grade)}`;
    const note = `转正定级：${POLICY_CONFIG.getLabel(pb.dutyIndex)}，时间${inp.startYear + 1}年，试用期1年，任职年限0年`;
    const changed = p.tgNow.result !== result;
    return {
      next: { ...p, tgNow: { result, note }, tYears: inp.startYear + 1 - inp.startYear },
      changed, skipped: false,
    };
  }

  const taogao = Calculator.calcTaogaoYears(inp.startYear, POLICY_CONFIG.EDUCATION[inp.eduValue]?.settleYears ?? 0, inp.deductYears);
  const tenure = Math.max(0, 2006 - inp.currentDutyYear);
  const lowerTenure = inp.lowerDuty > 0 ? Math.max(0, 2006 - inp.lowerDutyYear) : 0;
  const comp = Calculator.compareThreeWays(inp.currentDuty, inp.lowerDuty, inp.eduValue, taogao, tenure, lowerTenure);
  const [now, low] = [comp.results[0], comp.results.length === 3 ? comp.results[1] : null];
  const eduItem = comp.results[comp.results.length - 1];
  const best = comp.best;

  const curType = best.method === "按现职套" ? "按现职级套改" : best.method === "按低职套" ? "按低职级套改" : "按学历套改";
  // 结果不变时保留台账原备注，避免无谓差异
  const keep = (old: { result: string; note: string }, result: string, note: string) =>
    old.result === result ? old : { result, note };
  const next: Person = {
    ...p,
    tYears: taogao,
    curType,
    tgNow: keep(
      p.tgNow,
      `${now.level}.${now.grade} 工资 ${levelWage(now.level, now.grade)}`,
      `时任职务：${POLICY_CONFIG.getLabel(inp.currentDuty)}，时间${inp.currentDutyYear}年，间断${inp.deductYears}年，任职年限${tenure}年，退休费提高比例0%`
    ),
    tgLow: low
      ? keep(
          p.tgLow,
          `${low.level}.${low.grade} 工资 ${levelWage(low.level, low.grade)}`,
          `低一职务：${POLICY_CONFIG.getLabel(inp.lowerDuty)}，时间${inp.lowerDutyYear}年，间断${inp.deductYears}年，任职年限${lowerTenure}年`
        )
      : p.tgLow,
    tgEdu: keep(
      p.tgEdu,
      `${eduItem.level}.${eduItem.grade} 工资 ${levelWage(eduItem.level, eduItem.grade)}`,
      p.tgEdu.note
    ),
  };
  const changed =
    p.tgNow.result !== next.tgNow.result ||
    p.tgLow.result !== next.tgLow.result ||
    p.tgEdu.result !== next.tgEdu.result;
  return { next, changed, skipped: false };
}

type ModalKind =
  | "query" | "unit" | "allowance" | "recalc" | "rolling"
  | "del" | "catalog" | "calc" | "register" | "help" | "exit" | null;

interface Reg { code: string; at: string; }

const LS_REG = "gw_salary_reg";
const LS_MACHINE = "gw_salary_machine";

function getMachine(): string {
  try {
    let m = localStorage.getItem(LS_MACHINE);
    if (!m) {
      const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
      m = `PC-${seg()}-${seg()}${String(Date.now()).slice(-4)}`;
      localStorage.setItem(LS_MACHINE, m);
    }
    return m;
  } catch {
    return "PC-DEMO-2006";
  }
}

export default function App() {
  const [persons, setPersons] = useState<Person[]>(PEOPLE);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalKind>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [registered, setRegistered] = useState<Reg | null>(() => {
    try { const s = localStorage.getItem(LS_REG); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [machine] = useState(getMachine);
  const [lastRecalc, setLastRecalc] = useState("");
  const [exited, setExited] = useState(false);
  const [sideHidden, setSideHidden] = useState(false);

  /* ---------- 基础 ---------- */
  const pushToast = useCallback((type: Toast["type"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const selected = useMemo(
    () => persons.find((p) => p.id === selectedId) ?? persons[0] ?? null,
    [persons, selectedId]
  );

  const filtered = useMemo(() => {
    const k = query.trim().toLowerCase();
    if (!k) return persons;
    return persons.filter((p) => {
      const un = units.find((u) => u.id === p.unitId)?.name ?? "";
      return p.name.toLowerCase().includes(k) || String(p.id) === k || p.unitId.includes(k) || un.includes(k);
    });
  }, [persons, query, units]);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "未知单位";

  /* ---------- Esc 关闭弹窗 ---------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ---------- 菜单 ---------- */
  const onMenu = (k: MenuKey) => {
    switch (k) {
      case "unit": setModal("unit"); break;
      case "query": setModal("query"); break;
      case "catalog": setModal("catalog"); break;
      case "calc": setModal("calc"); break;
      case "register": setModal("register"); break;
      case "help": setModal("help"); break;
      case "exit": setModal("exit"); break;
      case "allowance":
        if (!selected) { pushToast("error", "请先在左侧选择一名人员"); return; }
        setModal("allowance"); break;
      case "rolling":
        if (!selected) { pushToast("error", "请先在左侧选择一名人员"); return; }
        setModal("rolling"); break;
      case "del":
        if (!selected) { pushToast("error", "人员列表为空，无可删除对象"); return; }
        setModal("del"); break;
      case "recalc":
        if (persons.length === 0) { pushToast("error", "人员列表为空，无法执行重算"); return; }
        setModal("recalc"); break;
    }
  };

  /* ---------- 工具栏：查询 / 在职 / 退休 / 止薪 ---------- */
  const onTool = (a: "query" | Employ) => {
    if (a === "query") { setModal("query"); return; }
    if (!selected) return;
    if (selected.employ === a) { pushToast("info", `${selected.name} 当前已是「${a}」状态`); return; }
    setPersons((arr) => arr.map((p) => (p.id === selected.id ? { ...p, employ: a } : p)));
    pushToast(a === "在职" ? "success" : a === "退休" ? "info" : "error",
      `${selected.name}（编号${selected.id}）已切换为「${a}」状态`);
  };

  /* ---------- 删除 ---------- */
  const confirmDelete = () => {
    if (!selected) return;
    const name = selected.name;
    setPersons((arr) => arr.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    setModal(null);
    pushToast("success", `已删除人员「${name}」及其 ${selected.history.length} 条工资演变记录`);
  };

  /* ---------- 单位 ---------- */
  const addUnit = (id: string, name: string) => {
    if (!id || !name.trim()) { pushToast("error", "单位编号与名称不能为空"); return; }
    if (units.some((u) => u.id === id)) { pushToast("error", `单位编号 [${id}] 已存在`); return; }
    setUnits((arr) => [...arr, { id, name: name.trim() }]);
    pushToast("success", `已新增单位 [${id}] ${name.trim()}`);
  };
  const removeUnit = (id: string) => {
    const cnt = persons.filter((p) => p.unitId === id).length;
    if (cnt > 0) { pushToast("error", `单位 [${id}] 下仍有 ${cnt} 名人员，无法删除`); return; }
    setUnits((arr) => arr.filter((u) => u.id !== id));
    pushToast("success", `已删除单位 [${id}]`);
  };

  /* ---------- 重算：核心模块逐人重新比对 ---------- */
  const onRecalcDone = useCallback(() => {
    const t = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    setLastRecalc(`${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`);
    let updated = 0, same = 0, skipped = 0;
    setPersons((arr) =>
      arr.map((p) => {
        const r = recomputePerson(p);
        if (r.skipped) skipped++;
        else if (r.changed) updated++;
        else same++;
        return r.next;
      })
    );
    pushToast(
      "success",
      `全部重算完成：${updated} 人结果更新，${same} 人与台账一致${skipped ? `，${skipped} 人非公务员轨道跳过` : ""}`
    );
  }, [pushToast]);

  /* ---------- 注册 ---------- */
  const onRegister = (code: string): boolean => {
    if (/^GW-\d{4}-\d{4}$/.test(code)) {
      const reg = { code, at: new Date().toLocaleDateString("zh-CN") };
      setRegistered(reg);
      try { localStorage.setItem(LS_REG, JSON.stringify(reg)); } catch { /* noop */ }
      setModal(null);
      pushToast("success", "注册成功，感谢使用公务员工资测算系统");
      return true;
    }
    return false;
  };

  /* ---------- 查询定位 ---------- */
  const locate = (id: number) => {
    setSelectedId(id);
    setQuery("");
    setModal(null);
    const p = persons.find((x) => x.id === id);
    pushToast("info", `已定位到 编号${id} ${p?.name ?? ""}`);
  };

  if (exited) return <ExitScreen onRestart={() => { setExited(false); pushToast("info", "系统已重新启动，局域网服务已恢复"); }} />;

  return (
    <div className="app-bg h-full w-full flex flex-col overflow-hidden">
      <TitleBar
        onClose={() => setModal("exit")}
        onMin={() => pushToast("info", "演示环境不支持最小化，可点击绿色按钮折叠列表")}
        onZoom={() => { setSideHidden((v) => !v); }}
      />
      <MenuBar onMenu={onMenu} />

      <div className="flex-1 flex min-h-0">
        {/* 左侧人员列表 */}
        <aside
          className={`shrink-0 border-r border-[#272c36] overflow-hidden transition-all duration-300 ${
            sideHidden ? "w-0 border-r-0" : "w-[252px]"
          }`}
        >
          <PersonList
            persons={filtered}
            total={persons.length}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            query={query}
            onQuery={setQuery}
            units={units}
          />
        </aside>

        {/* 右侧详情 */}
        <main className="flex-1 min-w-0 flex flex-col px-3.5 py-3">
          {sideHidden && (
            <button
              onClick={() => setSideHidden(false)}
              className="mb-2 w-fit flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-md border border-[#333a47] bg-[#1d2129] text-[#9aa3b2] hover:text-[#e2e6ee] hover:bg-[#242935] transition"
            >
              <Icon name="chevR" size={11} className="rotate-180" />
              展开人员列表
            </button>
          )}
          <DetailPanel
            person={selected}
            unitName={selected ? unitName(selected.unitId) : ""}
            onTool={onTool}
            onToast={pushToast}
          />
        </main>
      </div>

      <StatusBar
        personCount={persons.length}
        unitCount={units.length}
        registered={registered}
        lastRecalc={lastRecalc}
        onRegister={() => setModal("register")}
      />

      {/* ---------- 弹窗 ---------- */}
      {modal === "query" && (
        <QueryModal persons={persons} units={units} onClose={() => setModal(null)} onLocate={locate} />
      )}
      {modal === "unit" && (
        <UnitModal units={units} persons={persons} onClose={() => setModal(null)} onAdd={addUnit} onRemove={removeUnit} />
      )}
      {modal === "allowance" && selected && (
        <AllowanceModal person={selected} unitName={unitName(selected.unitId)} onClose={() => setModal(null)} onToast={pushToast} />
      )}
      {modal === "recalc" && (
        <RecalcModal persons={persons} onClose={() => setModal(null)} onDone={onRecalcDone} />
      )}
      {modal === "rolling" && selected && (
        <RollingModal person={selected} onClose={() => setModal(null)} />
      )}
      {modal === "del" && selected && (
        <ConfirmDeleteModal person={selected} onCancel={() => setModal(null)} onConfirm={confirmDelete} />
      )}
      {modal === "catalog" && (
        <CatalogModal units={units} persons={persons} onClose={() => setModal(null)} />
      )}
      {modal === "calc" && <CalcModal onClose={() => setModal(null)} />}
      {modal === "register" && (
        <RegisterModal machine={machine} registered={registered} onClose={() => setModal(null)} onRegister={onRegister} />
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "exit" && <ExitModal onStay={() => setModal(null)} onExit={() => setExited(true)} />}

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
