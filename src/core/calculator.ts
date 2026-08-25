/* ========================================================================== */
/*  公务员工资测算系统 · 计算核心                                              */
/*  由微信小程序 utils/calculator.js 原样移植（TS 化），运算口径以本文件为准     */
/*  —— 套改表 TAOGAO_TABLE / 级别工资 SALARY_STANDARD 均为 2006 工改基准        */
/* ========================================================================== */

import type { Person } from "../data";

export interface LG { level: number; grade: number; }

export interface PositionOption { value: number; label: string; type: "duty" | "rank"; }

export interface EduConfig {
  name: string;
  settleYears: number;
  probation: { level: number; grade: number; dutyIndex: number };
}

export interface CompareItem {
  method: string;
  duty: string;
  years: number | string;
  tenure: number | string;
  level: number;
  grade: number;
  isBest?: boolean;
}

export interface RollingStep {
  year: number;
  level: number;
  grade: number;
  reason: string;
  levelStartYear: number;
  gradeStartYear: number;
}

export interface RollingResult extends LG {
  levelStartYear: number;
  gradeStartYear: number;
  history: RollingStep[];
}

/* ---------------- POLICY_CONFIG ---------------- */

const POSITION_OPTIONS: PositionOption[] = [
  { value: 1, label: "办事员", type: "duty" },
  { value: 2, label: "科员", type: "duty" },
  { value: 3, label: "乡科级副职", type: "duty" },
  { value: 4, label: "乡科级正职", type: "duty" },
  { value: 5, label: "县处级副职", type: "duty" },
  { value: 6, label: "县处级正职", type: "duty" },
  { value: 7, label: "厅局级副职", type: "duty" },
  { value: 8, label: "厅局级正职", type: "duty" },
  { value: 9, label: "省部级副职", type: "duty" },
  { value: 10, label: "省部级正职", type: "duty" },
];

function getLabel(value: number): string {
  for (const o of POSITION_OPTIONS) if (o.value === value) return o.label;
  return "未知";
}

function getNextDuty(currentValue: number): number {
  const duties = POSITION_OPTIONS.filter((o) => o.type === "duty");
  for (let j = 0; j < duties.length; j++) {
    if (duties[j].value === currentValue) return j < duties.length - 1 ? duties[j + 1].value : currentValue;
  }
  return currentValue;
}

/* 【修复点1】研究生转正定级修正为 24-3 */
const EDUCATION: Record<number, EduConfig> = {
  0: { name: "高中", settleYears: 0, probation: { level: 27, grade: 1, dutyIndex: 1 } },
  3: { name: "专科", settleYears: 3, probation: { level: 26, grade: 2, dutyIndex: 1 } },
  4: { name: "本科", settleYears: 4, probation: { level: 25, grade: 2, dutyIndex: 2 } },
  5: { name: "本科(双证)", settleYears: 5, probation: { level: 25, grade: 2, dutyIndex: 2 } },
  6: { name: "研究生", settleYears: 6, probation: { level: 24, grade: 3, dutyIndex: 3 } },
};

const DUTY_LEVEL_RANGE: Record<number, { min: number; max: number }> = {
  1: { min: 27, max: 19 }, 2: { min: 26, max: 18 }, 3: { min: 24, max: 17 }, 4: { min: 22, max: 16 },
  5: { min: 20, max: 14 }, 6: { min: 18, max: 12 }, 7: { min: 16, max: 10 }, 8: { min: 14, max: 8 },
  9: { min: 12, max: 6 }, 10: { min: 10, max: 4 },
};

/* 级别工资标准表（2006 基准，下标 0 占位） */
const SALARY_STANDARD: Record<number, number[]> = {
  1: [0, 3020, 3180, 3340, 3500, 3660, 3820],
  2: [0, 2770, 2915, 3060, 3205, 3350, 3495, 3640],
  3: [0, 2530, 2670, 2810, 2950, 3090, 3230, 3370, 3510],
  4: [0, 2290, 2426, 2562, 2698, 2834, 2970, 3106, 3242, 3378],
  5: [0, 2070, 2202, 2334, 2466, 2598, 2730, 2862, 2994, 3126, 3258],
  6: [0, 1870, 1996, 2122, 2248, 2374, 2500, 2626, 2752, 2878, 3004, 3130],
  7: [0, 1700, 1818, 1936, 2054, 2172, 2290, 2408, 2526, 2644, 2762, 2880],
  8: [0, 1560, 1669, 1778, 1887, 1996, 2105, 2214, 2323, 2432, 2541, 2650],
  9: [0, 1438, 1538, 1638, 1738, 1838, 1938, 2038, 2138, 2238, 2338, 2438],
  10: [0, 1324, 1416, 1508, 1600, 1692, 1784, 1876, 1968, 2060, 2152, 2244],
  11: [0, 1217, 1302, 1387, 1472, 1557, 1642, 1727, 1812, 1897, 1982, 2067, 2152],
  12: [0, 1117, 1196, 1275, 1354, 1433, 1512, 1591, 1670, 1749, 1828, 1907, 1986, 2065],
  13: [0, 1024, 1098, 1172, 1246, 1320, 1394, 1468, 1542, 1616, 1690, 1764, 1838, 1912, 1986],
  14: [0, 938, 1007, 1076, 1145, 1214, 1283, 1352, 1421, 1490, 1559, 1628, 1697, 1766, 1835],
  15: [0, 859, 924, 989, 1054, 1119, 1184, 1249, 1314, 1379, 1444, 1509, 1574, 1639, 1704],
  16: [0, 786, 847, 908, 969, 1030, 1091, 1152, 1213, 1274, 1335, 1396, 1457, 1518, 1579],
  17: [0, 719, 776, 833, 890, 947, 1004, 1061, 1118, 1175, 1232, 1289, 1346, 1403],
  18: [0, 658, 711, 764, 817, 870, 923, 976, 1029, 1082, 1135, 1188, 1241, 1294],
  19: [0, 602, 651, 700, 749, 798, 847, 896, 945, 994, 1043, 1092, 1141],
  20: [0, 551, 596, 641, 686, 731, 776, 821, 866, 911, 956, 1001],
  21: [0, 504, 545, 586, 627, 668, 709, 750, 791, 832, 873],
  22: [0, 461, 498, 535, 572, 609, 646, 683, 720, 757],
  23: [0, 422, 455, 488, 521, 554, 587, 620, 653],
  24: [0, 386, 416, 446, 476, 506, 536, 566, 596],
  25: [0, 352, 380, 408, 436, 464, 492, 520],
  26: [0, 320, 347, 374, 401, 428, 455],
  27: [0, 290, 316, 342, 368, 394, 420],
};

/* 2006 套改表：TAOGAO_TABLE[职务][任职年限区间][套改年限区间] = "级-档" */
const TAOGAO_TABLE: Record<number, Record<number, Record<number, string>>> = {
  4: { 1: { 5: "22-1", 6: "22-2", 7: "22-3", 8: "21-3", 9: "21-4", 10: "20-4", 11: "20-5", 12: "19-5", 13: "19-6", 14: "18-6", 15: "18-7", 16: "17-7", 17: "17-8", 18: "16-8" }, 2: { 6: "21-2", 7: "21-3", 8: "21-4", 9: "21-5", 10: "20-5", 11: "20-6", 12: "19-6", 13: "19-7", 14: "18-7", 15: "18-8", 16: "17-8", 17: "17-9", 18: "16-9" }, 3: { 7: "20-2", 8: "20-3", 9: "20-4", 10: "20-5", 11: "20-6", 12: "19-6", 13: "19-7", 14: "18-7", 15: "18-8", 16: "17-8", 17: "17-9", 18: "16-9" }, 4: { 8: "19-3", 9: "19-4", 10: "19-5", 11: "19-6", 12: "19-7", 13: "19-8", 14: "18-8", 15: "18-9", 16: "17-9", 17: "17-10", 18: "16-10" } },
  3: { 1: { 3: "24-1", 4: "24-2", 5: "23-2", 6: "23-3", 7: "22-3", 8: "22-4", 9: "21-4", 10: "21-5", 11: "20-5", 12: "20-6", 13: "19-6", 14: "19-7", 15: "18-7", 16: "18-8", 17: "17-8" }, 2: { 4: "23-2", 5: "23-3", 6: "23-4", 7: "22-4", 8: "22-5", 9: "21-5", 10: "21-6", 11: "20-6", 12: "20-7", 13: "19-7", 14: "19-8", 15: "18-8", 16: "18-9", 17: "17-9" }, 3: { 5: "22-2", 6: "22-3", 7: "22-4", 8: "22-5", 9: "21-5", 10: "21-6", 11: "20-6", 12: "20-7", 13: "19-7", 14: "19-8", 15: "18-8", 16: "18-9", 17: "17-9" }, 4: { 6: "21-3", 7: "21-4", 8: "21-5", 9: "21-6", 10: "21-7", 11: "20-7", 12: "20-8", 13: "19-8", 14: "19-9", 15: "18-9", 16: "18-10", 17: "17-10" } },
  2: { 1: { 2: "26-1", 3: "26-2", 4: "25-2", 5: "25-3", 6: "24-3", 7: "24-4", 8: "23-4", 9: "23-5", 10: "22-5", 11: "22-6", 12: "21-6", 13: "21-7", 14: "20-7", 15: "20-8", 16: "19-8", 17: "19-9", 18: "18-9" } },
  1: { 1: { 1: "27-1", 2: "27-2", 3: "27-3", 4: "26-3", 5: "26-4", 6: "25-4", 7: "25-5", 8: "24-5", 9: "24-6", 10: "23-6", 11: "23-7", 12: "22-7", 13: "22-8", 14: "21-8", 15: "21-9", 16: "20-9", 17: "20-10", 18: "19-10" } },
  5: { 1: { 6: "20-1", 7: "20-2", 8: "20-3", 9: "20-4", 10: "19-4", 11: "19-5", 12: "18-5", 13: "18-6", 14: "17-6", 15: "17-7", 16: "16-7", 17: "16-8", 18: "15-8" }, 2: { 7: "19-2", 8: "19-3", 9: "19-4", 10: "19-5", 11: "19-6", 12: "18-6", 13: "18-7", 14: "17-7", 15: "17-8", 16: "16-8", 17: "16-9", 18: "15-9" }, 3: { 8: "18-2", 9: "18-3", 10: "18-4", 11: "18-5", 12: "18-6", 13: "18-7", 14: "17-7", 15: "17-8", 16: "16-8", 17: "16-9", 18: "15-9" }, 4: { 9: "17-3", 10: "17-4", 11: "17-5", 12: "17-6", 13: "17-7", 14: "17-8", 15: "17-9", 16: "16-9", 17: "16-10", 18: "15-10" } },
  6: { 1: { 7: "18-1", 8: "18-2", 9: "18-3", 10: "18-4", 11: "18-5", 12: "17-5", 13: "17-6", 14: "16-6", 15: "16-7", 16: "15-7", 17: "15-8", 18: "14-8", 19: "14-9" }, 2: { 8: "17-2", 9: "17-3", 10: "17-4", 11: "17-5", 12: "17-6", 13: "17-7", 14: "16-7", 15: "16-8", 16: "15-8", 17: "15-9", 18: "14-9", 19: "14-10" }, 3: { 9: "16-2", 10: "16-3", 11: "16-4", 12: "16-5", 13: "16-6", 14: "16-7", 15: "16-8", 16: "15-8", 17: "15-9", 18: "14-9", 19: "14-10" }, 4: { 10: "15-3", 11: "15-4", 12: "15-5", 13: "15-6", 14: "15-7", 15: "15-8", 16: "15-9", 17: "15-10", 18: "14-10", 19: "14-11" } },
  7: { 1: { 9: "15-1", 10: "15-2", 11: "15-3", 12: "15-4", 13: "15-5", 14: "15-6", 15: "15-7", 16: "14-7", 17: "14-8", 18: "13-8", 19: "13-9", 20: "12-9" }, 2: { 10: "14-2", 11: "14-3", 12: "14-4", 13: "14-5", 14: "14-6", 15: "14-7", 16: "14-8", 17: "14-9", 18: "13-9", 19: "13-10", 20: "12-10" }, 3: { 11: "13-2", 12: "13-3", 13: "13-4", 14: "13-5", 15: "13-6", 16: "13-7", 17: "13-8", 18: "13-9", 19: "13-10", 20: "12-10" }, 4: { 12: "12-3", 13: "12-4", 14: "12-5", 15: "12-6", 16: "12-7", 17: "12-8", 18: "12-9", 19: "12-10", 20: "12-11" } },
  8: { 1: { 10: "13-1", 11: "13-2", 12: "13-3", 13: "13-4", 14: "13-5", 15: "13-6", 16: "13-7", 17: "13-8", 18: "12-8", 19: "12-9", 20: "11-9" }, 2: { 11: "12-2", 12: "12-3", 13: "12-4", 14: "12-5", 15: "12-6", 16: "12-7", 17: "12-8", 18: "12-9", 19: "12-10", 20: "11-10" }, 3: { 12: "11-2", 13: "11-3", 14: "11-4", 15: "11-5", 16: "11-6", 17: "11-7", 18: "11-8", 19: "11-9", 20: "11-10" }, 4: { 13: "10-3", 14: "10-4", 15: "10-5", 16: "10-6", 17: "10-7", 18: "10-8", 19: "10-9", 20: "10-10" } },
  9: { 1: { 12: "10-1", 13: "10-2", 14: "10-3", 15: "10-4", 16: "10-5", 17: "10-6", 18: "10-7", 19: "10-8", 20: "10-9" }, 2: { 13: "9-2", 14: "9-3", 15: "9-4", 16: "9-5", 17: "9-6", 18: "9-7", 19: "9-8", 20: "9-9" }, 3: { 14: "8-2", 15: "8-3", 16: "8-4", 17: "8-5", 18: "8-6", 19: "8-7", 20: "8-8" }, 4: { 15: "7-3", 16: "7-4", 17: "7-5", 18: "7-6", 19: "7-7", 20: "7-8" } },
  10: { 1: { 13: "8-1", 14: "8-2", 15: "8-3", 16: "8-4", 17: "8-5", 18: "8-6", 19: "8-7", 20: "8-8" }, 2: { 14: "7-2", 15: "7-3", 16: "7-4", 17: "7-5", 18: "7-6", 19: "7-7", 20: "7-8" }, 3: { 15: "6-2", 16: "6-3", 17: "6-4", 18: "6-5", 19: "6-6", 20: "6-7" }, 4: { 16: "5-3", 17: "5-4", 18: "5-5", 19: "5-6", 20: "5-7" } },
};

const ROLLING_RULES = { levelYears: 5, gradeYears: 2 };

export const POLICY_CONFIG = {
  POSITION_OPTIONS,
  getLabel,
  getNextDuty,
  EDUCATION,
  DUTY_LEVEL_RANGE,
  SALARY_STANDARD,
  TAOGAO_TABLE,
  ROLLING_RULES,
};

/* ---------------- 区间索引 ---------------- */

export function getTaogaoRangeIndex(years: number): number {
  if (years <= 3) return 1; if (years <= 5) return 2; if (years <= 7) return 3; if (years <= 9) return 4;
  if (years <= 12) return 5; if (years <= 14) return 6; if (years <= 17) return 7; if (years <= 19) return 8;
  if (years <= 22) return 9; if (years <= 24) return 10; if (years <= 27) return 11; if (years <= 29) return 12;
  if (years <= 32) return 13; if (years <= 34) return 14; if (years <= 37) return 15; if (years <= 39) return 16;
  if (years <= 42) return 17; if (years <= 44) return 18; if (years <= 47) return 19; return 20;
}

export function getTenureRangeIndex(years: number): number {
  if (years <= 5) return 1; if (years <= 10) return 2; if (years <= 15) return 3; return 4;
}

export const TENURE_BANDS = ["1-5年", "6-10年", "11-15年", "16年以上"];

/* ---------------- Calculator ---------------- */

export const Calculator = {
  calcTaogaoYears(s: number, e: number, d: number): number {
    const result = 2006 - s + e - d;
    return result > 0 ? result + 1 : 1;
  },

  lookupTaogaoTable(di: number, ty: number, tenure: number): LG {
    const tIdx = getTaogaoRangeIndex(ty);
    let nIdx = getTenureRangeIndex(tenure);
    if (di === 1 || di === 2) nIdx = 1;
    const table = TAOGAO_TABLE[di];
    if (!table || !table[nIdx] || !table[nIdx][tIdx]) return { level: 27, grade: 1 };
    const parts = table[nIdx][tIdx].split("-");
    return { level: parseInt(parts[0], 10), grade: parseInt(parts[1], 10) };
  },

  compareThreeWays(cdi: number, ldi: number, ek: number, ty: number, ct: number, lt: number) {
    const results: CompareItem[] = [];
    const cr = this.lookupTaogaoTable(cdi, ty, ct);
    results.push({ method: "按现职务套改", duty: getLabel(cdi), years: ty, tenure: ct, level: cr.level, grade: cr.grade });
    if (ldi > 0) {
      const lr = this.lookupTaogaoTable(ldi, ty, lt);
      results.push({ method: "按低一职务套改", duty: getLabel(ldi), years: ty, tenure: lt, level: lr.level, grade: lr.grade });
    }
    const ec = EDUCATION[ek];
    if (ec) {
      results.push({ method: "按最高学历保底", duty: ec.name, years: "-", tenure: "-", level: ec.probation.level, grade: ec.probation.grade });
    }
    let best = results[0];
    for (let i = 1; i < results.length; i++) {
      const r = results[i];
      if (r.level < best.level || (r.level === best.level && r.grade > best.grade)) best = r;
    }
    return { results, best };
  },

  /* 【修复点2】职务晋升跳级时，引入工资表实现"就近就高"套档 */
  calcPromotion(cl: number, cg: number, npi: number): { level: number; grade: number; forced: boolean } {
    const range = DUTY_LEVEL_RANGE[npi];
    if (!range) return { level: cl, grade: cg, forced: false };

    /* 级别高于新职务上限（数字更小），降级别 */
    if (cl < range.max) return { level: range.max, grade: 1, forced: true };

    /* 级别低于新职务下限（数字更大），升级别（就近就高套档） */
    if (cl > range.min) {
      const newLevel = range.min;
      const oldSalary = this.getSalary(cl, cg);
      const newLevelGrades = SALARY_STANDARD[newLevel];
      let newGrade = cg;
      if (newLevelGrades) {
        let found = false;
        for (let g = 1; g < newLevelGrades.length; g++) {
          if (newLevelGrades[g] >= oldSalary) { newGrade = g; found = true; break; }
        }
        if (!found) newGrade = newLevelGrades.length - 1;
      }
      return { level: newLevel, grade: newGrade, forced: true };
    }

    return { level: cl, grade: cg, forced: false };
  },

  calcRolling(sl: number, sg: number, syIn: number, eyIn: number, di: number): RollingResult {
    const rules = ROLLING_RULES;
    let range = DUTY_LEVEL_RANGE[di];
    if (!range) range = { min: 1, max: 27 };
    let level = sl;
    let grade = sg;
    let sy = parseInt(String(syIn), 10);
    const ey = parseInt(String(eyIn), 10);
    const lsy0 = sy;
    let lsy = sy;
    let gsy = sy;
    const history: RollingStep[] = [];

    if (sy >= ey) return { level, grade, levelStartYear: lsy0, gradeStartYear: lsy0, history };

    for (let y = sy + 1; y <= ey; y++) {
      let changed = false;
      const reasons: string[] = [];

      /* 1. 五年晋升级别（就近就高套档） */
      if (y - lsy >= rules.levelYears && level > range.max) {
        const oldSalary = this.getSalary(level, grade);
        const newLevel = level - 1;
        let newGrade = grade;
        const newLevelGrades = SALARY_STANDARD[newLevel];
        if (newLevelGrades) {
          let found = false;
          for (let g = 1; g < newLevelGrades.length; g++) {
            if (newLevelGrades[g] >= oldSalary) { newGrade = g; found = true; break; }
          }
          if (!found) newGrade = newLevelGrades.length - 1;
        }
        level = newLevel;
        grade = newGrade;
        lsy = y;
        gsy = y;
        changed = true;
        reasons.push("五年晋升级别（就近就高）");
      }

      /* 2. 两年晋升级别档次（无上限） */
      if (y - gsy >= rules.gradeYears) {
        grade++;
        gsy = y;
        changed = true;
        reasons.push("两年晋升级别档次");
      }

      if (changed) {
        history.push({ year: y, level, grade, reason: reasons.join("、"), levelStartYear: lsy, gradeStartYear: gsy });
      }
    }

    return { level, grade, levelStartYear: lsy, gradeStartYear: gsy, history };
  },

  getSalary(level: number, grade: number): number {
    const table = SALARY_STANDARD[level];
    if (!table || !table[grade]) return 0;
    return table[grade];
  },
};

export function levelWage(level: number, grade: number): number {
  return Calculator.getSalary(level, grade);
}

/* ---------------- 下拉选项（与 salary.js data 一致） ---------------- */

export const EDUCATION_OPTIONS = ["研究生（套改学历6年）", "大学本科（套改学历4年）", "专科（套改学历3年）", "高中（无套改学历）"];
export const EDUCATION_VALUES = [6, 4, 3, 0];

export const DUTY_OPTIONS = ["办事员", "科员", "乡科级副职", "乡科级正职", "县处级副职", "县处级正职", "厅局级副职", "厅局级正职", "省部级副职", "省部级正职"];
export const DUTY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const LOWER_DUTY_OPTIONS = ["无", ...DUTY_OPTIONS];
export const LOWER_DUTY_VALUES = [0, ...DUTY_VALUES];

/* 职务变动可选：职务 + 职级（与 buildPositionPickerOptions 一致，职级 101 起） */
export const POSITION_PICKER_LABELS = [
  ...DUTY_OPTIONS,
  "二级巡视员", "一级调研员", "二级调研员", "三级调研员", "四级调研员",
  "一级主任科员", "二级主任科员", "三级主任科员", "四级主任科员",
  "一级科员", "二级科员",
];
export const POSITION_PICKER_VALUES = [
  ...DUTY_VALUES, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
];

export const RANK_LABELS: Record<number, string> = {
  101: "二级巡视员", 102: "一级调研员", 103: "二级调研员", 104: "三级调研员", 105: "四级调研员",
  106: "一级主任科员", 107: "二级主任科员", 108: "三级主任科员", 109: "四级主任科员", 110: "一级科员", 111: "二级科员",
};
export const RANK_LEVELS: Record<number, LG> = {
  101: { level: 13, grade: 6 }, 102: { level: 15, grade: 5 }, 103: { level: 16, grade: 6 },
  104: { level: 17, grade: 7 }, 105: { level: 18, grade: 8 }, 106: { level: 19, grade: 7 },
  107: { level: 20, grade: 8 }, 108: { level: 21, grade: 8 }, 109: { level: 22, grade: 9 },
  110: { level: 24, grade: 9 }, 111: { level: 25, grade: 9 },
};

/* ---------------- 人员档案 → 测算参数 ---------------- */

export interface CalcInputs {
  startYear: number;
  educationIndex: number; // EDUCATION_VALUES 下标
  deductYears: number;
  currentDuty: number;
  currentDutyYear: number;
  lowerDuty: number;
  lowerDutyYear: number;
}

/* 参数经 2006 套改表反推校准，保证"按现职务套改"结果与台账起薪行一致 */
export const PERSON_CALC_INPUTS: Record<number, CalcInputs | null> = {
  1: { startYear: 1972, educationIndex: 1, deductYears: 2, currentDuty: 4, currentDutyYear: 2002, lowerDuty: 3, lowerDutyYear: 1995 },
  2: { startYear: 1975, educationIndex: 2, deductYears: 6, currentDuty: 4, currentDutyYear: 2000, lowerDuty: 3, lowerDutyYear: 1992 },
  3: { startYear: 1978, educationIndex: 1, deductYears: 6, currentDuty: 4, currentDutyYear: 2003, lowerDuty: 3, lowerDutyYear: 1994 },
  4: { startYear: 1985, educationIndex: 0, deductYears: 6, currentDuty: 3, currentDutyYear: 2001, lowerDuty: 2, lowerDutyYear: 1996 },
  5: null, // 机关技术工人序列，不适用公务员 2006 套改
  6: null, // 2006 年后考录，不适用 2006 套改
  7: { startYear: 1988, educationIndex: 2, deductYears: 0, currentDuty: 4, currentDutyYear: 2004, lowerDuty: 3, lowerDutyYear: 1998 },
  8: null, // 专业技术序列，不适用公务员 2006 套改
};

/* ---------------- 台账核验 ---------------- */

export interface VerifyCell {
  method: string;
  ledger: string | null;   // 台账值 "18.7"
  engine: string;          // 重算值 "18.7"
  wage: number;
  match: boolean | null;   // null = 台账无此项
}

export interface VerifyReport {
  person: Person;
  status: "match" | "partial" | "diff" | "skip";
  skipReason?: string;
  taogaoYears?: number;
  cells: VerifyCell[];
}

const SKIP_REASON: Record<number, string> = {
  5: "机关技术工人序列，不适用公务员2006套改",
  6: "2006年后考录人员，按转正定级确定",
  8: "专业技术序列，不适用公务员2006套改",
};

function parseLedgerLG(result: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})/.exec(result.trim());
  return m ? `${m[1]}.${m[2]}` : null;
}

export function verifyPerson(p: Person): VerifyReport {
  const inp = PERSON_CALC_INPUTS[p.id];
  if (!inp) {
    return { person: p, status: "skip", skipReason: SKIP_REASON[p.id] ?? "无测算参数", cells: [] };
  }
  const eduVal = EDUCATION_VALUES[inp.educationIndex];
  const ec = POLICY_CONFIG.EDUCATION[eduVal];
  const taogao = Calculator.calcTaogaoYears(inp.startYear, ec ? ec.settleYears : 0, inp.deductYears);
  const ct = 2006 - inp.currentDutyYear;
  const lt = inp.lowerDuty > 0 ? 2006 - inp.lowerDutyYear : 0;
  const comp = Calculator.compareThreeWays(inp.currentDuty, inp.lowerDuty, eduVal, taogao, ct, lt);

  const ledgerRows = [p.tgNow, p.tgLow, p.tgEdu];
  const cells: VerifyCell[] = comp.results.map((r, i) => {
    const ledger = parseLedgerLG(ledgerRows[i] ? ledgerRows[i].result : "—");
    const engine = `${r.level}.${r.grade}`;
    return {
      method: r.method,
      ledger,
      engine,
      wage: Calculator.getSalary(r.level, r.grade),
      match: ledger === null ? null : ledger === engine,
    };
  });

  const judged = cells.filter((c) => c.match !== null);
  const ok = judged.filter((c) => c.match).length;
  const status: VerifyReport["status"] =
    judged.length === 0 ? "skip" : ok === judged.length ? "match" : ok > 0 ? "partial" : "diff";
  return { person: p, status, taogaoYears: taogao, cells };
}
