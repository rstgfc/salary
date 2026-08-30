/* ========================================================================== */
/*  工资标准数据层（存入 SQLite，可调阅可修改）                                    */
/*                                                                            */
/*  基本工资标准历经 2006/7、2014/10、2018/7、2021/10、2024/7 五次调整。          */
/*  数据库中按期列出工资标准表；暂无新数据的期次先沿用上一期（2014/10）标准，       */
/*  待用户直接在「工资标准」弹窗中更新。                                          */
/*  西藏特殊津贴标准表：竖列=职务职级，横列=工资类区（二/三/四类区），           */
/*  已录入真实标准数据；旧库检测到临时示意值时自动重建。                            */
/* ========================================================================== */

import { POLICY_CONFIG, DUTY_WAGE_2006 } from "./calculator";
import { LEVEL_SALARY, POSITION_SALARY } from "./salarydata";
import { dbAll, dbRun, scheduleFlush } from "./db";

/** 基本工资标准调整期次 */
export const WAGE_ERAS = ["2006-07", "2014-10", "2018-07", "2021-10", "2024-07"];

/** 职级层次（职务与职级并行，2018/7 调整期起在职务工资表中列示，从高到低） */
export const RANK_LABELS = [
  "一级巡视员", "二级巡视员",
  "一级调研员", "二级调研员", "三级调研员", "四级调研员",
  "一级主任科员", "二级主任科员", "三级主任科员", "四级主任科员",
  "一级科员", "二级科员",
];

/** 西藏特殊津贴标准表（元/月）：竖列=职务职级，横列=二/三/四类区 */
export const TIBET_STD: { dutyLabel: string; zone2: number; zone3: number; zone4: number }[] = [
  { dutyLabel: "省部级正职", zone2: 982.1, zone3: 0, zone4: 0 },
  { dutyLabel: "省部级副职", zone2: 874.8, zone3: 0, zone4: 1091.4 },
  { dutyLabel: "厅局级正职", zone2: 767.3, zone3: 0, zone4: 957.1 },
  { dutyLabel: "厅局级副职", zone2: 681, zone3: 764.3, zone4: 848.4 },
  { dutyLabel: "县处级正职", zone2: 602.1, zone3: 675.9, zone4: 751.2 },
  { dutyLabel: "县处级副职", zone2: 547.8, zone3: 614.7, zone4: 683.1 },
  { dutyLabel: "乡科级正职", zone2: 495.5, zone3: 556.5, zone4: 617.5 },
  { dutyLabel: "乡科级副职", zone2: 459.8, zone3: 516.1, zone4: 573.2 },
  { dutyLabel: "科员", zone2: 441, zone3: 495, zone4: 549 },
  { dutyLabel: "办事员", zone2: 437.8, zone3: 491.4, zone4: 545.6 },
  { dutyLabel: "一级巡视员", zone2: 767.3, zone3: 0, zone4: 957.1 },
  { dutyLabel: "二级巡视员", zone2: 681, zone3: 764.3, zone4: 848.4 },
  { dutyLabel: "一级调研员", zone2: 641.6, zone3: 720.1, zone4: 799.8 },
  { dutyLabel: "二级调研员", zone2: 602.1, zone3: 675.9, zone4: 751.2 },
  { dutyLabel: "三级调研员", zone2: 575, zone3: 645.3, zone4: 717.2 },
  { dutyLabel: "四级调研员", zone2: 547.8, zone3: 614.7, zone4: 683.1 },
  { dutyLabel: "一级主任科员", zone2: 521.7, zone3: 585.6, zone4: 650.3 },
  { dutyLabel: "二级主任科员", zone2: 495.5, zone3: 556.5, zone4: 617.5 },
  { dutyLabel: "三级主任科员", zone2: 477.7, zone3: 536.3, zone4: 595.4 },
  { dutyLabel: "四级主任科员", zone2: 459.8, zone3: 516.1, zone4: 573.2 },
  { dutyLabel: "一级科员", zone2: 441, zone3: 495, zone4: 549 },
  { dutyLabel: "二级科员", zone2: 437.8, zone3: 491.4, zone4: 545.6 },
];

export interface DutyStdRow { dutyIndex: number; label: string; leader: number | null; nonLeader: number | null; }

/* ---------------- 播种（首次运行，仅当表为空） ---------------- */

export function seedWageTables(): void {
  const cnt = dbAll("SELECT COUNT(*) c FROM wage_duty");
  if (Number(cnt[0]?.c ?? 0) === 0) {
    /* 职务工资标准表 */
    for (const era of WAGE_ERAS) {
      for (let di = 1; di <= 10; di++) {
        const label = POLICY_CONFIG.getLabel(di);
        let leader: number | null = null;
        let nonLeader: number | null = null;
        if (era === "2006-07") {
          leader = DUTY_WAGE_2006[di] ?? null;
          nonLeader = DUTY_WAGE_2006[di] ?? null;
        } else {
          /* 2014/10 有真实标准；2018/2021/2024 暂无数据，先沿用 2014/10 标准 */
          const s = POSITION_SALARY[label];
          leader = s?.leader ?? null;
          nonLeader = s?.nonLeader ?? null;
        }
        dbRun("INSERT OR REPLACE INTO wage_duty(era,duty_index,leader,non_leader) VALUES(?,?,?,?)", [era, di, leader, nonLeader]);
      }
    }

    /* 级别工资标准表 */
    for (const era of WAGE_ERAS) {
      for (let lvl = 1; lvl <= 27; lvl++) {
        const arr = era === "2006-07" ? (POLICY_CONFIG.SALARY_STANDARD[lvl] ?? []).slice(1) : (LEVEL_SALARY[lvl] ?? []);
        arr.forEach((amt, i) => {
          dbRun("INSERT OR REPLACE INTO wage_grade(era,lvl,step,amount) VALUES(?,?,?,?)", [era, lvl, i + 1, amt]);
        });
      }
    }
  }

  /* 西藏特殊津贴标准表：旧库为临时示意值（无职级行），检测到即重建为真实标准 */
  const t = dbAll("SELECT COUNT(*) c FROM tibet_abs WHERE duty_label='一级巡视员'");
  if (Number(t[0]?.c ?? 0) === 0) {
    dbRun("DELETE FROM tibet_abs");
    TIBET_STD.forEach((r) => {
      dbRun("INSERT OR REPLACE INTO tibet_abs(duty_label,zone2,zone3,zone4) VALUES(?,?,?,?)", [r.dutyLabel, r.zone2, r.zone3, r.zone4]);
    });
  }

  scheduleFlush();
}

/* ---------------- 查询 ---------------- */

export function getDutyStd(era: string): DutyStdRow[] {
  return dbAll("SELECT duty_index, leader, non_leader FROM wage_duty WHERE era=? ORDER BY duty_index DESC", [era]).map(
    (r) => ({
      dutyIndex: Number(r.duty_index),
      label: POLICY_CONFIG.getLabel(Number(r.duty_index)),
      leader: r.leader == null ? null : Number(r.leader),
      nonLeader: r.non_leader == null ? null : Number(r.non_leader),
    })
  );
}

export interface RankStdRow { rankIndex: number; label: string; amount: number | null; }

/** 职务工资表内的职级层次标准（2018/7 起列示，从高到低） */
export function getRankStd(era: string): RankStdRow[] {
  const rows = dbAll("SELECT rank_index, amount FROM wage_rank WHERE era=? ORDER BY rank_index ASC", [era]);
  const map = new Map<number, number | null>();
  rows.forEach((r) => map.set(Number(r.rank_index), r.amount == null ? null : Number(r.amount)));
  return RANK_LABELS.map((label, i) => ({ rankIndex: i + 1, label, amount: map.get(i + 1) ?? null }));
}

/** 级别工资表：返回 { lvl, steps: number[] }，级别从 1 升序到 27 */
export function getGradeStd(era: string): { lvl: number; steps: number[] }[] {
  const rows = dbAll("SELECT lvl, step, amount FROM wage_grade WHERE era=? ORDER BY lvl ASC, step ASC", [era]);
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const lvl = Number(r.lvl);
    if (!map.has(lvl)) map.set(lvl, []);
    map.get(lvl)![Number(r.step) - 1] = Number(r.amount);
  }
  return Array.from(map.entries()).map(([lvl, steps]) => ({ lvl, steps }));
}

export function getMaxSteps(era: string): number {
  return Math.max(1, ...getGradeStd(era).map((g) => g.steps.length));
}

export interface TibetRow { dutyLabel: string; zone2: number; zone3: number; zone4: number; }

export function getTibet(): TibetRow[] {
  return dbAll("SELECT duty_label, zone2, zone3, zone4 FROM tibet_abs ORDER BY rowid ASC").map((r) => ({
    dutyLabel: String(r.duty_label),
    zone2: Number(r.zone2 ?? 0),
    zone3: Number(r.zone3 ?? 0),
    zone4: Number(r.zone4 ?? 0),
  }));
}

/** 供当前工资面板查询：某职务在指定类区的西藏特殊津贴绝对额 */
export function getTibetAbs(dutyLabel: string, zone: "二类区" | "三类区" | "四类区"): number {
  const col = zone === "二类区" ? "zone2" : zone === "三类区" ? "zone3" : "zone4";
  const rows = dbAll(`SELECT ${col} v FROM tibet_abs WHERE duty_label=?`, [dutyLabel]);
  return rows.length ? Number(rows[0].v ?? 0) : 0;
}

/** 西藏特殊津贴倍数：二类区×1.4 三类区×1.7 四类区×2.0（作用于基本工资小计） */
export function getTibetFactor(zone: "二类区" | "三类区" | "四类区"): number {
  return zone === "二类区" ? 1.4 : zone === "三类区" ? 1.7 : 2.0;
}

/* ---------------- 更新（用户在「工资标准」弹窗中修改） ---------------- */

export function updateDutyCell(era: string, dutyIndex: number, field: "leader" | "non_leader", val: number | null): void {
  dbRun(`UPDATE wage_duty SET ${field}=? WHERE era=? AND duty_index=?`, [val, era, dutyIndex]);
  scheduleFlush();
}

export function updateRankCell(era: string, rankIndex: number, val: number | null): void {
  dbRun("INSERT OR REPLACE INTO wage_rank(era,rank_index,amount) VALUES(?,?,?)", [era, rankIndex, val]);
  scheduleFlush();
}

export function updateGradeCell(era: string, lvl: number, step: number, val: number): void {
  dbRun("INSERT OR REPLACE INTO wage_grade(era,lvl,step,amount) VALUES(?,?,?,?)", [era, lvl, step, val]);
  scheduleFlush();
}

export function updateTibet(dutyLabel: string, zone: "zone2" | "zone3" | "zone4", val: number): void {
  dbRun(`UPDATE tibet_abs SET ${zone}=? WHERE duty_label=?`, [val, dutyLabel]);
  scheduleFlush();
}
