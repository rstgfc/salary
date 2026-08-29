import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Employ, INITIAL_UNITS, PEOPLE, Person, Unit, WageZone } from "./data";
import { MenuRail, MenuKey, StatusBar, Theme, TitleBar, Toast, ToastStack, UserStrip } from "./components/chrome";
import { ChatWidget } from "./components/ChatWidget";
import { PersonList } from "./components/PersonList";
import { DetailPanel } from "./components/DetailPanel";
import { Login, Session } from "./components/Login";
import {
  ConfirmDeleteModal, ExitModal, ExitScreen, HelpModal, PersonAddModal, QueryModal,
  RecalcModal, RegisterModal, RollingModal, UnitModal,
} from "./components/modals";
import { AllowanceModal, CalcModal, CatalogModal } from "./components/tools";
import { Icon } from "./components/icons";
import { VerifyReport, recalcPerson, verifyPerson, PERSON_CALC_INPUTS } from "./core/calculator";
import {
  initDb, listPersons, listUnits, mirrorPersons, mirrorUnits, bindPersistors, getDbStats,
} from "./core/db";

type ModalKind =
  | "query" | "unit" | "person" | "allowance" | "recalc" | "rolling"
  | "del" | "catalog" | "calc" | "register" | "help" | "exit" | null;

interface Reg { code: string; at: string; }

const LS_REG = "gw_salary_reg";
const LS_MACHINE = "gw_salary_machine";
const LS_THEME = "gw_salary_theme";
const LS_SESSION = "gw_salary_session";

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

function getInitSession(): Session | null {
  try {
    const s = localStorage.getItem(LS_SESSION);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(getInitSession);
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [dbMode, setDbMode] = useState<"sqlite" | "memory">("memory");
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
  const [listTick, setListTick] = useState(0); // 需求2：测算保存后刷新左侧列表的最新职务

  const canEdit = session?.role === "admin";

  /* ---------- 登录 / 登出 ---------- */
  const handleLogin = (s: Session) => {
    setSession(s);
    try { localStorage.setItem(LS_SESSION, JSON.stringify(s)); } catch { /* noop */ }
    pushToast("success", `欢迎，${s.name}（${s.role === "admin" ? "可编辑" : "仅查看"}）`);
  };
  const handleLogout = () => {
    setSession(null);
    try { localStorage.removeItem(LS_SESSION); } catch { /* noop */ }
  };

  /* 需求9：修改当前用户名 */
  const handleRename = (name: string) => {
    setSession((s) => {
      if (!s) return s;
      const next = { ...s, name };
      try { localStorage.setItem(LS_SESSION, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
    pushToast("success", `用户名已修改为「${name}」`);
  };

  /* 需求5：点击局域网地址复制到剪贴板 */
  const handleCopyLan = (url: string) => {
    navigator.clipboard.writeText(url)
      .then(() => pushToast("success", `局域网地址已复制：${url}`))
      .catch(() => pushToast("error", "复制失败，请手动选择文本"));
  };

  /* 需求8：远程连接人数（localStorage 心跳，统计近15秒活跃会话） */
  const [remoteCount, setRemoteCount] = useState(1);
  useEffect(() => {
    const KEY = "gw_lan_presence";
    let sid = sessionStorage.getItem("gw_sid");
    if (!sid) { sid = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("gw_sid", sid); }
    const beat = () => {
      try {
        const now = Date.now();
        const map = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
        map[sid] = now;
        for (const key of Object.keys(map)) if (now - map[key] > 15000) delete map[key];
        localStorage.setItem(KEY, JSON.stringify(map));
        setRemoteCount(Math.max(1, Object.keys(map).length));
      } catch { setRemoteCount(1); }
    };
    beat();
    const t = setInterval(beat, 5000);
    return () => clearInterval(t);
  }, []);

  /* ---------- 主题 ---------- */
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(LS_THEME, theme); } catch { /* noop */ }
  }, [theme]);

  /* ---------- SQLite 数据库装载（sql.js · WASM） ---------- */
  useEffect(() => {
    let on = true;
    initDb()
      .then(() => {
        if (!on) return;
        setUnits(listUnits());
        setPersons(listPersons());
        setDbMode("sqlite");
        setDbReady(true);
      })
      .catch(() => {
        /* WASM/IndexedDB 不可用时降级为内存态（静态台账） */
        if (!on) return;
        setUnits(INITIAL_UNITS);
        setPersons(PEOPLE);
        setDbMode("memory");
        setDbReady(true);
      });
    return () => { on = false; };
  }, []);

  /* ---------- 状态变更 → 镜像写库（防抖落盘 IndexedDB） ---------- */
  useEffect(() => { if (dbReady) mirrorPersons(persons); }, [persons, dbReady]);
  useEffect(() => { if (dbReady) mirrorUnits(units); }, [units, dbReady]);
  useEffect(() => {
    bindPersistors(
      () => setPersons(listPersons()),
      () => setUnits(listUnits())
    );
  }, []);

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
      /* 需求7：检索范围增加职务 */
      return p.name.toLowerCase().includes(k) || String(p.id) === k || p.unitId.includes(k)
        || un.includes(k) || (p.position ?? "").toLowerCase().includes(k);
    });
  }, [persons, query, units]);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? "未知单位";

  /* ---------- Esc 关闭弹窗 ---------- */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ---------- 需要编辑权限的菜单 ---------- */
  const requireEdit = (label: string): boolean => {
    if (!canEdit) { pushToast("error", `「${label}」需要可编辑权限（当前为仅查看）`); return false; }
    return true;
  };

  const onMenu = (k: MenuKey) => {
    switch (k) {
      case "query": setModal("query"); break;
      case "catalog": setModal("catalog"); break;
      case "calc": setModal("calc"); break;
      case "register": setModal("register"); break;
      case "help": setModal("help"); break;
      case "exit": setModal("exit"); break;
      case "unit": if (requireEdit("增加单位")) setModal("unit"); break;
      case "person": if (requireEdit("人员")) setModal("person"); break;
      case "allowance":
        if (!selected) { pushToast("error", "请先在左侧选择一名人员"); return; }
        if (requireEdit("津贴编辑输出")) setModal("allowance");
        break;
      case "rolling":
        if (!selected) { pushToast("error", "请先在左侧选择一名人员"); return; }
        setModal("rolling"); break;
      case "del":
        if (!selected) { pushToast("error", "人员列表为空，无可删除对象"); return; }
        if (requireEdit("删除选择")) setModal("del");
        break;
      case "recalc":
        if (persons.length === 0) { pushToast("error", "人员列表为空，无法执行重算"); return; }
        if (requireEdit("全部重算")) { setReports(persons.map(verifyPerson)); setModal("recalc"); }
        break;
    }
  };

  /* ---------- 工具栏：查询 / 在职 / 退休 / 止薪 ---------- */
  const onTool = (a: "query" | Employ) => {
    if (a === "query") { setModal("query"); return; }
    if (!selected) return;
    if (!canEdit) { pushToast("error", "切换在职状态需要可编辑权限（当前为仅查看）"); return; }
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

  /* 需求3：工具栏"删除选择"按钮（止薪之后） */
  const requestDelete = () => {
    if (!selected) { pushToast("error", "人员列表为空，无可删除对象"); return; }
    if (!canEdit) { pushToast("error", "删除人员需要可编辑权限（当前为仅查看）"); return; }
    setModal("del");
  };

  /* ---------- 单位（含工资类区） ---------- */
  const addUnit = (id: string, name: string, zone: WageZone = "二类区") => {
    if (!id || !name.trim()) { pushToast("error", "单位编号与名称不能为空"); return; }
    if (units.some((u) => u.id === id)) { pushToast("error", `单位编号 [${id}] 已存在`); return; }
    setUnits((arr) => [...arr, { id, name: name.trim(), zone }]);
    pushToast("success", `已新增单位 [${id}] ${name.trim()}（${zone}）`);
  };
  const editUnit = (id: string, name: string, zone: WageZone) => {
    if (!name.trim()) { pushToast("error", "单位名称不能为空"); return; }
    setUnits((arr) => arr.map((u) => (u.id === id ? { ...u, name: name.trim(), zone } : u)));
    pushToast("success", `单位 [${id}] 已更新为「${name.trim()}（${zone}）」`);
  };
  const removeUnit = (id: string) => {
    const cnt = persons.filter((p) => p.unitId === id).length;
    if (cnt > 0) { pushToast("error", `单位 [${id}] 下仍有 ${cnt} 名人员，无法删除`); return; }
    setUnits((arr) => arr.filter((u) => u.id !== id));
    pushToast("success", `已删除单位 [${id}]`);
  };

  /* ---------- 新增人员（需求7） ---------- */
  const addPerson = (p: Person) => {
    setPersons((arr) => [...arr, p]);
    setSelectedId(p.id);
    setModal(null);
    pushToast("success", `已新增人员「${p.name}」（编号${p.id}），请核对参数后点击开始测算`);
  };
  const nextPersonId = useMemo(() => Math.max(0, ...persons.map((p) => p.id)) + 1, [persons]);

  /* ---------- 全部重算：核验（只读）→ 应用（重写演变表） ---------- */
  const applyRecalc = useCallback(() => {
    if (!canEdit) { pushToast("error", "应用重算需要可编辑权限"); return; }
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
    pushToast("success", `已应用重算结果：${applied} 人演变表重写（2006→${endYear}，含 2014/10 调资行）`);
  }, [canEdit, pushToast]);

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

  /* ---------- 登录页（需求2） ---------- */
  if (!session) {
    return (
      <>
        <Login onLogin={handleLogin} />
        <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
      </>
    );
  }

  if (exited) return <ExitScreen onRestart={() => { setExited(false); pushToast("info", "系统已重新启动，局域网服务已恢复"); }} />;

  /* ---------- SQLite 装载画面 ---------- */
  if (!dbReady) {
    return (
      <div className="app-bg h-full w-full flex flex-col items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[560px] h-[300px] rounded-full opacity-70"
          style={{ background: "radial-gradient(circle, rgba(10,132,255,.14), transparent 65%)" }} />
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center border border-[rgba(10,132,255,.4)]"
          style={{ background: "linear-gradient(140deg, rgba(10,132,255,.2), rgba(90,200,250,.07))" }}>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--acc)] opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--acc)]" />
          </span>
        </div>
        <p className="mt-5 font-disp text-[15px] font-semibold text-[var(--tx-1)] tracking-wide">正在装载本地数据库</p>
        <p className="mt-1.5 text-[11.5px] text-[var(--tx-3)] flex items-center gap-1.5">
          <Icon name="catalog" size={12} />
          SQLite · WASM 引擎 · IndexedDB 持久化
        </p>
      </div>
    );
  }

  return (
    <div className="app-bg h-full w-full flex flex-col overflow-hidden">
      <TitleBar
        theme={theme}
        onTheme={setTheme}
        onClose={() => setModal("exit")}
        onMin={() => pushToast("info", "演示环境不支持最小化，可点击绿色按钮折叠列表")}
        onZoom={() => { setSideHidden((v) => !v); }}
      />
      {/* 需求4：用户信息条（替换原菜单栏位置） */}
      <UserStrip userName={session.name} canEdit={canEdit} onSwitch={handleLogout} onRename={handleRename} />

      <div className="flex-1 flex min-h-0">
        {/* 需求5：左侧竖列图标菜单 */}
        <MenuRail onMenu={onMenu} />

        {/* 左侧人员列表 */}
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
            tick={listTick}
          />
        </aside>

        {/* 右侧详情 */}
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
          {selected ? (
            <DetailPanel
              key={selected.id}
              person={selected}
              unitName={unitName(selected.unitId)}
              canEdit={canEdit}
              onTool={onTool}
              onToast={pushToast}
              onDelete={requestDelete}
              onSaved={() => setListTick((t) => t + 1)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--tx-3)]">暂无人员，请通过「人员增加」菜单新增</div>
          )}
        </main>
      </div>

      <StatusBar
        personCount={persons.length}
        unitCount={units.length}
        registered={registered}
        lastRecalc={lastRecalc}
        onRegister={() => setModal("register")}
        storage={dbMode}
        onCopyLan={handleCopyLan}
        remoteCount={remoteCount}
      />

      {/* ---------- 弹窗 ---------- */}
      {modal === "query" && (
        <QueryModal persons={persons} units={units} onClose={() => setModal(null)} onLocate={locate} />
      )}
      {modal === "unit" && (
        <UnitModal units={units} persons={persons} canEdit={canEdit} onClose={() => setModal(null)}
          onAdd={addUnit} onRemove={removeUnit} onEdit={editUnit} />
      )}
      {modal === "person" && (
        <PersonAddModal units={units} nextId={nextPersonId} onClose={() => setModal(null)} onAdd={addPerson} />
      )}
      {modal === "allowance" && selected && (
        <AllowanceModal person={selected} unitName={unitName(selected.unitId)} onClose={() => setModal(null)} onToast={pushToast} />
      )}
      {modal === "recalc" && (
        <RecalcModal reports={reports} onClose={() => setModal(null)} onApply={applyRecalc} />
      )}
      {modal === "rolling" && selected && (
        <RollingModal person={selected} onClose={() => setModal(null)} />
      )}
      {modal === "del" && selected && (
        <ConfirmDeleteModal person={selected} onCancel={() => setModal(null)} onConfirm={confirmDelete} />
      )}
      {modal === "catalog" && (
        <CatalogModal onClose={() => setModal(null)} />
      )}
      {modal === "calc" && <CalcModal onClose={() => setModal(null)} />}
      {modal === "register" && (
        <RegisterModal machine={machine} registered={registered} onClose={() => setModal(null)} onRegister={onRegister} />
      )}
      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "exit" && <ExitModal onStay={() => setModal(null)} onExit={() => setExited(true)} />}

      {/* 需求7：悬浮聊天 */}
      <ChatWidget user={session.name} userName={session.name} onToast={pushToast} />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
