import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Employ, INITIAL_UNITS, PEOPLE, Person, Unit } from "./data";
import { MenuBar, MenuKey, StatusBar, Theme, TitleBar, Toast, ToastStack } from "./components/chrome";
import { PersonList } from "./components/PersonList";
import { DetailPanel } from "./components/DetailPanel";
import { Login, SessionUser } from "./components/Login";
import {
  ConfirmDeleteModal, ExitModal, ExitScreen, HelpModal, PersonAddModal, QueryModal,
  RecalcModal, RegisterModal, RollingModal, UnitModal,
} from "./components/modals";
import { AllowanceModal, CalcModal, CatalogModal } from "./components/tools";
import { Icon } from "./components/icons";
import { VerifyReport, recalcPerson, verifyPerson, PERSON_CALC_INPUTS } from "./core/calculator";

type ModalKind =
  | "query" | "unit" | "person" | "allowance" | "recalc" | "rolling"
  | "del" | "catalog" | "calc" | "register" | "help" | "exit" | null;

interface Reg { code: string; at: string; }

const LS_REG = "gw_salary_reg";
const LS_MACHINE = "gw_salary_machine";
const LS_THEME = "gw_salary_theme";

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

function getInitTheme(): Theme {
  try {
    return localStorage.getItem(LS_THEME) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default function App() {
  /* ---------- 登录会话（需求2） ---------- */
  const [user, setUser] = useState<SessionUser | null>(null);

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
  const [theme, setTheme] = useState<Theme>(getInitTheme);
  const [reports, setReports] = useState<VerifyReport[]>([]);
  const [exporting, setExporting] = useState(false);

  const canEdit = user?.role === "edit";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(LS_THEME, theme); } catch { /* noop */ }
  }, [theme]);

  const pushToast = useCallback((type: Toast["type"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const onExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { exportProjectZip } = await import("./export/projectZip");
      const { count, name } = await exportProjectZip();
      pushToast("success", `已生成 ${name}（${count} 个文件），浏览器开始下载`);
    } catch {
      pushToast("error", "源码打包失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [exporting, pushToast]);

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ---------- 菜单 ---------- */
  const onMenu = (k: MenuKey) => {
    const needEdit = k === "unit" || k === "person" || k === "del" || k === "allowance";
    if (needEdit && !canEdit) { pushToast("error", "当前为仅查看权限，无法执行该操作"); return; }
    switch (k) {
      case "unit": setModal("unit"); break;
      case "person": setModal("person"); break;
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
        setReports(persons.map(verifyPerson));
        setModal("recalc"); break;
    }
  };

  const onTool = (a: "query" | Employ) => {
    if (a === "query") { setModal("query"); return; }
    if (!selected) return;
    if (selected.employ === a) { pushToast("info", `${selected.name} 当前已是「${a}」状态`); return; }
    setPersons((arr) => arr.map((p) => (p.id === selected.id ? { ...p, employ: a } : p)));
    pushToast(a === "在职" ? "success" : a === "退休" ? "info" : "error",
      `${selected.name}（编号${selected.id}）已切换为「${a}」状态`);
  };

  const confirmDelete = () => {
    if (!selected) return;
    const name = selected.name;
    setPersons((arr) => arr.filter((p) => p.id !== selected.id));
    setSelectedId(null);
    setModal(null);
    pushToast("success", `已删除人员「${name}」及其工资演变记录`);
  };

  /* ---------- 单位 ---------- */
  const addUnit = (id: string, name: string) => {
    if (!id || !name.trim()) { pushToast("error", "单位编号与名称不能为空"); return; }
    if (units.some((u) => u.id === id)) { pushToast("error", `单位编号 [${id}] 已存在`); return; }
    setUnits((arr) => [...arr, { id, name: name.trim() }]);
    pushToast("success", `已新增单位 [${id}] ${name.trim()}`);
  };
  const editUnit = (id: string, name: string) => {
    if (!name.trim()) { pushToast("error", "单位名称不能为空"); return; }
    setUnits((arr) => arr.map((u) => (u.id === id ? { ...u, name: name.trim() } : u)));
    pushToast("success", `单位 [${id}] 已更新为「${name.trim()}」`);
  };
  const removeUnit = (id: string) => {
    const cnt = persons.filter((p) => p.unitId === id).length;
    if (cnt > 0) { pushToast("error", `单位 [${id}] 下仍有 ${cnt} 名人员，无法删除`); return; }
    setUnits((arr) => arr.filter((u) => u.id !== id));
    pushToast("success", `已删除单位 [${id}]`);
  };

  /* ---------- 新增人员（需求7） ---------- */
  const nextPersonId = useMemo(() => Math.max(0, ...persons.map((p) => p.id)) + 1, [persons]);
  const addPerson = (p: Person) => {
    setPersons((arr) => [...arr, p]);
    setSelectedId(p.id);
    setModal(null);
    pushToast("success", `已新增人员「${p.name}」（编号${p.id}），请完善测算参数后点击开始测算`);
  };

  const applyRecalc = useCallback(() => {
    const t = new Date();
    const p2 = (n: number) => String(n).padStart(2, "0");
    let applied = 0;
    let endYear = new Date().getFullYear();
    setPersons((arr) =>
      arr.map((p) => {
        const inp = PERSON_CALC_INPUTS[p.id];
        if (!inp) return p;
        const r = recalcPerson(p, inp);
        endYear = r.endYear;
        applied++;
        return r.next;
      })
    );
    setLastRecalc(`${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`);
    setModal(null);
    pushToast("success", `已应用重算结果：${applied} 人演变表重写（2006→${endYear}）`);
  }, [pushToast]);

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

  const locate = (id: number) => {
    setSelectedId(id);
    setQuery("");
    setModal(null);
    const p = persons.find((x) => x.id === id);
    pushToast("info", `已定位到 编号${id} ${p?.name ?? ""}`);
  };

  /* ---------- 未登录：显示登录页（需求2） ---------- */
  if (!user) {
    return (
      <>
        <Login onLogin={(u) => { setUser(u); pushToast("success", `欢迎，${u.name}（${u.role === "edit" ? "可编辑权限" : "仅查看权限"}）`); }} />
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </>
    );
  }

  if (exited) return <ExitScreen onRestart={() => { setExited(false); pushToast("info", "系统已重新启动，局域网服务已恢复"); }} />;

  return (
    <div className="app-bg h-full w-full flex flex-col overflow-hidden">
      <TitleBar
        theme={theme}
        onTheme={setTheme}
        onExport={onExport}
        exporting={exporting}
        onClose={() => setModal("exit")}
        onMin={() => pushToast("info", "演示环境不支持最小化，可点击绿色按钮折叠列表")}
        onZoom={() => { setSideHidden((v) => !v); }}
      />
      <MenuBar onMenu={onMenu} />

      <div className="flex-1 flex min-h-0">
        <aside
          className={`shrink-0 border-r border-[var(--line)] overflow-hidden transition-all duration-300 ${
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

        <main className="flex-1 min-w-0 flex flex-col px-3.5 py-3">
          {sideHidden && (
            <button
              onClick={() => setSideHidden(false)}
              className="mb-2 w-fit flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--bg-2)] text-[var(--tx-2)] hover:text-[var(--tx-1)] hover:bg-[var(--hov)] transition"
            >
              <Icon name="chevR" size={11} className="rotate-180" />
              展开人员列表
            </button>
          )}
          <DetailPanel
            key={selected?.id ?? "none"}
            person={selected}
            unitName={selected ? unitName(selected.unitId) : ""}
            canEdit={canEdit}
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

      {modal === "query" && (
        <QueryModal persons={persons} units={units} onClose={() => setModal(null)} onLocate={locate} />
      )}
      {modal === "unit" && (
        <UnitModal units={units} persons={persons} onClose={() => setModal(null)} onAdd={addUnit} onRemove={removeUnit} onEdit={editUnit} />
      )}
      {modal === "person" && (
        <PersonAddModal units={units} nextId={nextPersonId} onClose={() => setModal(null)} onAdd={addPerson} />
      )}
      {modal === "allowance" && selected && (
        <AllowanceModal person={selected} unitName={unitName(selected.unitId)} onClose={() => setModal(null)} onToast={pushToast} />
      )}
      {modal === "recalc" && (
        <RecalcModal reports={reports} onClose={() => setModal(null)}
          onApply={canEdit ? applyRecalc : () => pushToast("error", "当前为仅查看权限，无法应用重算结果")} />
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
