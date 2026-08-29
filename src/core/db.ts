/* ========================================================================== */
/*  SQLite 存储层（sql.js · WASM 引擎）                                         */
/*                                                                            */
/*  架构：                                                                      */
/*  · 真正的 SQLite 数据库（C 引擎编译为 WASM，浏览器 / Electron 同源同构）        */
/*  · units 表 + persons 表（可检索列 + 完整 JSON 文档，嵌套演变台账整体读写）      */
/*  · 数据库二进制持久化到 IndexedDB，应用启动时自动装载；空库时以演示台账播种      */
/*  · 所有写入经 250ms 防抖整体落盘，千人级规模单次落盘仍在毫秒级                  */
/* ========================================================================== */

import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { INITIAL_UNITS, PEOPLE, Person, Unit } from "../data";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let persistPersons: (() => void) | null = null;
let persistUnits: (() => void) | null = null;

const IDB_NAME = "gw_salary_store";
const IDB_KEY = "sqlite_db";

/* ---------------- IndexedDB 持久化 ---------------- */

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<Uint8Array | null> {
  const store = await idbOpen();
  return new Promise((resolve) => {
    const tx = store.transaction("kv", "readonly");
    const req = tx.objectStore("kv").get(IDB_KEY);
    req.onsuccess = () => resolve((req.result as Uint8Array) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(buf: Uint8Array): Promise<void> {
  const store = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = store.transaction("kv", "readwrite");
    tx.objectStore("kv").put(buf, IDB_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------------- 初始化 ---------------- */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS units (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT '二类区'
);
CREATE TABLE IF NOT EXISTS persons (
  id      INTEGER PRIMARY KEY,
  name    TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  tag     TEXT NOT NULL DEFAULT '',
  employ  TEXT NOT NULL DEFAULT '在职',
  doc     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_persons_unit ON persons(unit_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE TABLE IF NOT EXISTS wage_duty (
  era        TEXT NOT NULL,
  duty_index INTEGER NOT NULL,
  leader     INTEGER,
  non_leader INTEGER,
  PRIMARY KEY (era, duty_index)
);
CREATE TABLE IF NOT EXISTS wage_grade (
  era    TEXT NOT NULL,
  lvl    INTEGER NOT NULL,
  step   INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  PRIMARY KEY (era, lvl, step)
);
CREATE TABLE IF NOT EXISTS tibet_abs (
  duty_label TEXT PRIMARY KEY,
  zone2 INTEGER NOT NULL DEFAULT 0,
  zone3 INTEGER NOT NULL DEFAULT 0,
  zone4 INTEGER NOT NULL DEFAULT 0
);
`;

export async function initDb(): Promise<void> {
  if (db) return;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  const saved = await idbGet().catch(() => null);
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  db.run(SCHEMA);
  /* 兼容旧库：若 units 表无 zone 列则补充 */
  try { db.run("ALTER TABLE units ADD COLUMN zone TEXT NOT NULL DEFAULT '二类区'"); } catch { /* 列已存在 */ }

  /* 空库播种：首次运行写入演示台账 */
  const res = db.exec("SELECT COUNT(*) AS c FROM persons");
  const count = Number(res?.[0]?.values?.[0]?.[0] ?? 0);
  if (count === 0) {
    INITIAL_UNITS.forEach((u) => upsertUnit(u));
    PEOPLE.forEach((p) => upsertPerson(p));
    await flush();
  }

  /* 工资标准表播种（含西藏特殊津贴绝对额对照表） */
  try {
    const { seedWageTables } = await import("./wageStd");
    seedWageTables();
  } catch { /* ignore */ }
}

/* ---------------- 通用 SQL 辅助（供 wageStd 等模块使用） ---------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dbRun(sql: string, params: unknown[] = []): void {
  if (!db) return;
  db.run(sql, params as any);
}

export function dbAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (!db) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stmt = (db as any).prepare(sql);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stmt.bind(params as any);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>);
  stmt.free();
  return rows;
}

export const isDbReady = () => !!db;

async function flush(): Promise<void> {
  if (!db) return;
  try {
    await idbSet(db.export());
  } catch {
    /* 私密模式等场景下降级为内存态，功能不受影响 */
  }
}

/** 防抖落盘（状态镜像变更后调用） */
export function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 250);
}

/* ---------------- 状态镜像注册（App 侧注入） ---------------- */

export function bindPersistors(p: () => void, u: () => void): void {
  persistPersons = p;
  persistUnits = u;
}

/* ---------------- 单位 ---------------- */

export function listUnits(): Unit[] {
  const res = db.exec("SELECT id, name, zone FROM units ORDER BY id");
  if (!res.length) return [];
  return res[0].values.map((r: unknown[]) => ({
    id: String(r[0]), name: String(r[1]),
    zone: (["二类区", "三类区", "四类区"].includes(String(r[2])) ? String(r[2]) : "二类区") as Unit["zone"],
  }));
}

export function upsertUnit(u: Unit): void {
  db.run("INSERT OR REPLACE INTO units (id, name, zone) VALUES (?, ?, ?)", [u.id, u.name, u.zone ?? "二类区"]);
}

export function removeUnitRow(id: string): void {
  db.run("DELETE FROM units WHERE id = ?", [id]);
}

/* ---------------- 人员 ---------------- */

export function listPersons(): Person[] {
  const res = db.exec("SELECT doc FROM persons ORDER BY id");
  if (!res.length) return [];
  return res[0].values.map((r: unknown[]) => JSON.parse(String(r[0])) as Person);
}

export function upsertPerson(p: Person): void {
  db.run(
    "INSERT OR REPLACE INTO persons (id, name, unit_id, tag, employ, doc) VALUES (?, ?, ?, ?, ?, ?)",
    [p.id, p.name, p.unitId, p.tag, p.employ, JSON.stringify(p)]
  );
}

export function removePersonRow(id: number): void {
  db.run("DELETE FROM persons WHERE id = ?", [id]);
}

export function replaceAllPersons(list: Person[]): void {
  db.run("DELETE FROM persons");
  list.forEach((p) => upsertPerson(p));
}

export function replaceAllUnits(list: Unit[]): void {
  db.run("DELETE FROM units");
  list.forEach((u) => upsertUnit(u));
}

/** App 状态变化 → 镜像写库（防抖落盘） */
export function mirrorPersons(list: Person[]): void {
  if (!db) return;
  replaceAllPersons(list);
  scheduleFlush();
}

export function mirrorUnits(list: Unit[]): void {
  if (!db) return;
  replaceAllUnits(list);
  scheduleFlush();
}

/* ---------------- 统计 / 导入导出 ---------------- */

export function getDbStats(): { persons: number; sizeKB: number } {
  const res = db.exec("SELECT COUNT(*) AS c FROM persons");
  const persons = Number(res?.[0]?.values?.[0]?.[0] ?? 0);
  const sizeKB = Math.round(db.export().length / 1024);
  return { persons, sizeKB };
}

export function exportJson(): string {
  return JSON.stringify({ units: listUnits(), persons: listPersons() }, null, 2);
}

export function importJson(raw: string): { units: number; persons: number } {
  const data = JSON.parse(raw) as { units?: Unit[]; persons?: Person[] };
  db.run("BEGIN");
  try {
    if (Array.isArray(data.units)) replaceAllUnits(data.units);
    if (Array.isArray(data.persons)) replaceAllPersons(data.persons);
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
  void flush();
  persistPersons?.();
  persistUnits?.();
  return { units: data.units?.length ?? 0, persons: data.persons?.length ?? 0 };
}
