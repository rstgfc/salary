/* =====================================================================
 * 测算核心模块（Web 移植版）
 * 与微信小程序 utils/calculator.js 保持完全一致的 API：
 *   POLICY_CONFIG.{ POSITION_OPTIONS, EDUCATION, getLabel, getNextDuty }
 *   Calculator.{ calcTaogaoYears, compareThreeWays, calcRolling, calcPromotion }
 * 封装为 exe 时与小程序后台共用同一份计算逻辑，替换本文件即可接入正式参数表。
 * ===================================================================== */

export interface PositionOption {
  type: "duty" | "rank";
  value: number;
  label: string;
}

export interface ProbationInfo {
  level: number;
  grade: number;
  dutyIndex: number;
}

export interface EduConfig {
  label: string;
  settleYears: number;
  /** 2006 工改「按学历套」结果 */
  taogao: { level: number; grade: number };
  /** 2006 年后考入「转正定级」结果 */
  probation: ProbationInfo;
}

export interface CompareItem {
  method: string;
  duty: string;
  years: number | string;
  tenure: number | string;
  level: number;
  grade: number;
  isBest: boolean;
}

export interface RollingEvent {
  year: number;
  reason: string;
  level: number;
  grade: number;
  levelStartYear: number;
  gradeStartYear: number;
}

export interface RollingResult {
  level: number;
  grade: number;
  levelStartYear: number;
  gradeStartYear: number;
  history: RollingEvent[];
}

export interface PositionChange {
  year: number;
  dutyIndex: number;
  reason: string;
  isInitial?: boolean;
}

export interface CalcInput {
  type: "pre2006" | "post2006";
  startYear: number;
  eduValue: number; // 0 | 3 | 4 | 6
  deductYears: number;
  currentDuty: number; // 职务/职级 value
  currentDutyYear: number;
  lowerDuty: number; // 0 = 无
  lowerDutyYear: number;
  isLeader: boolean;
  changes: PositionChange[];
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ---------------- 职务 / 职级 目录 ---------------- */

const DUTY_LIST: PositionOption[] = [
  { type: "duty", value: 1, label: "办事员" },
  { type: "duty", value: 2, label: "科员" },
  { type: "duty", value: 3, label: "乡科级副职" },
  { type: "duty", value: 4, label: "乡科级正职" },
  { type: "duty", value: 5, label: "县处级副职" },
  { type: "duty", value: 6, label: "县处级正职" },
  { type: "duty", value: 7, label: "厅局级副职" },
  { type: "duty", value: 8, label: "厅局级正职" },
  { type: "duty", value: 9, label: "省部级副职" },
  { type: "duty", value: 10, label: "省部级正职" },
];

const RANK_LIST: PositionOption[] = [
  { type: "rank", value: 11, label: "一级巡视员" },
  { type: "rank", value: 12, label: "二级巡视员" },
  { type: "rank", value: 13, label: "一级调研员" },
  { type: "rank", value: 14, label: "二级调研员" },
  { type: "rank", value: 15, label: "三级调研员" },
  { type: "rank", value: 16, label: "四级调研员" },
  { type: "rank", value: 17, label: "一级主任科员" },
  { type: "rank", value: 18, label: "二级主任科员" },
  { type: "rank", value: 19, label: "三级主任科员" },
  { type: "rank", value: 20, label: "四级主任科员" },
  { type: "rank", value: 21, label: "一级科员" },
  { type: "rank", value: 22, label: "二级科员" },
];

/** 级别范围 [最大级别号(最低), 最小级别号(最高)] */
const LEVEL_RANGE: Record<number, [number, number]> = {
  1: [27, 19], 2: [26, 18], 3: [24, 17], 4: [22, 16], 5: [20, 14],
  6: [18, 12], 7: [15, 10], 8: [13, 8], 9: [10, 6], 10: [8, 4],
  11: [13, 8], 12: [15, 10], 13: [17, 11], 14: [18, 12], 15: [19, 13],
  16: [20, 14], 17: [21, 15], 18: [22, 16], 19: [23, 17], 20: [24, 18],
  21: [26, 18], 22: [27, 19],
};

/** 职务工资标准（基准年，非领导职务；职级按对应职务靠档） */
const DUTY_WAGE: Record<number, number> = {
  1: 340, 2: 380, 3: 430, 4: 480, 5: 540, 6: 600, 7: 680, 8: 760, 9: 900, 10: 1150,
  11: 760, 12: 680, 13: 600, 14: 600, 15: 540, 16: 540,
  17: 480, 18: 480, 19: 430, 20: 430, 21: 380, 22: 340,
};

/* ---------------- 级别工资速算表 ----------------
 * 以工资台账锚点反推：18级7档=976、17级7档=1061(档差57)、
 * 16级8档=1213(档差61)、19级8档=945、25级2档=380，
 * wage(level, grade) = A(level) + grade × S(level)，锚点间分段线性。
 * ------------------------------------------------ */
const ANCHORS: [number, number, number][] = [
  [16, 725, 61],
  [17, 662, 57],
  [18, 605, 53],
  [19, 553, 49],
  [25, 330, 25],
];

function anchorAt(level: number): { A: number; S: number } {
  const L = clamp(level, 1, 27);
  if (L <= ANCHORS[0][0]) {
    const [l0, a0, s0] = ANCHORS[0];
    const [l1, a1, s1] = ANCHORS[1];
    return { A: a0 + ((a1 - a0) / (l1 - l0)) * (L - l0), S: s0 + ((s1 - s0) / (l1 - l0)) * (L - l0) };
  }
  const last = ANCHORS.length - 1;
  if (L >= ANCHORS[last][0]) {
    const [l0, a0, s0] = ANCHORS[last - 1];
    const [l1, a1, s1] = ANCHORS[last];
    return { A: a1 + ((a1 - a0) / (l1 - l0)) * (L - l1), S: s1 + ((s1 - s0) / (l1 - l0)) * (L - l1) };
  }
  for (let i = 0; i < last; i++) {
    const [l0, a0, s0] = ANCHORS[i];
    const [l1, a1, s1] = ANCHORS[i + 1];
    if (L >= l0 && L <= l1) {
      const t = (L - l0) / (l1 - l0);
      return { A: a0 + (a1 - a0) * t, S: s0 + (s1 - s0) * t };
    }
  }
  return { A: 605, S: 53 };
}

/** 级别工资（元/月） */
export function levelWage(level: number, grade: number): number {
  const { A, S } = anchorAt(level);
  return Math.round(A + grade * S);
}

/** 就近就高：在新级别中找工资不低于目标值的最小档次 */
export function nearestGrade(level: number, targetWage: number): number {
  for (let g = 1; g <= 14; g++) {
    if (levelWage(level, g) >= targetWage) return g;
  }
  return 14;
}

export function dutyWage(dutyValue: number): number {
  return DUTY_WAGE[dutyValue] ?? 0;
}

/* ---------------- POLICY_CONFIG ---------------- */

export const POLICY_CONFIG = {
  POSITION_OPTIONS: [...DUTY_LIST, ...RANK_LIST],

  EDU_OPTIONS: [
    { label: "研究生（套改学历6年）", value: 6 },
    { label: "大学本科（套改学历4年）", value: 4 },
    { label: "专科（套改学历3年）", value: 3 },
    { label: "高中（无套改学历）", value: 0 },
  ],

  EDUCATION: {
    0: { label: "高中", settleYears: 0, taogao: { level: 27, grade: 1 }, probation: { level: 27, grade: 1, dutyIndex: 1 } },
    3: { label: "大学专科", settleYears: 3, taogao: { level: 26, grade: 2 }, probation: { level: 26, grade: 2, dutyIndex: 2 } },
    4: { label: "大学本科", settleYears: 4, taogao: { level: 25, grade: 2 }, probation: { level: 25, grade: 2, dutyIndex: 2 } },
    6: { label: "研究生", settleYears: 6, taogao: { level: 24, grade: 2 }, probation: { level: 24, grade: 3, dutyIndex: 2 } },
  } as Record<number, EduConfig>,

  getLabel(value: number): string {
    const o = this.POSITION_OPTIONS.find((x) => x.value === value);
    return o ? o.label : "—";
  },

  getNextDuty(value: number): number {
    if (value >= 1 && value < 10) return value + 1;
    if (value === 10) return 10;
    if (value >= 11 && value <= 22) return Math.max(11, value - 1);
    return value;
  },

  getLevelRange(value: number): [number, number] {
    return LEVEL_RANGE[value] ?? [27, 19];
  },
};

/* ---------------- Calculator ---------------- */

function taogaoByDuty(dutyValue: number, taogaoYears: number, tenure: number) {
  const [hi, lo] = POLICY_CONFIG.getLevelRange(dutyValue);
  const sum = taogaoYears + tenure;
  const level = clamp(hi - Math.floor(sum / 9), lo, hi);
  const grade = clamp(Math.floor((sum + 2) / 6), 1, 14);
  return { level, grade };
}

export const Calculator = {
  /** 套改年限 = (2006 - 参工年份) + 套改学历年限 - 扣减年限 */
  calcTaogaoYears(startYear: number, settleYears: number, deductYears: number): number {
    return 2006 - startYear + settleYears - deductYears;
  },

  /** 三方案套改比对：按现职 / 按低职 / 按学历，取级别工资最高者为最优 */
  compareThreeWays(
    currentDuty: number,
    lowerDuty: number,
    eduValue: number,
    taogaoYears: number,
    tenureYears: number,
    lowerTenure: number
  ): { results: CompareItem[]; best: CompareItem } {
    const results: CompareItem[] = [];

    const r1 = taogaoByDuty(currentDuty, taogaoYears, tenureYears);
    results.push({
      method: "按现职套", duty: POLICY_CONFIG.getLabel(currentDuty),
      years: taogaoYears, tenure: tenureYears, ...r1, isBest: false,
    });

    if (lowerDuty > 0) {
      const r2 = taogaoByDuty(lowerDuty, taogaoYears, lowerTenure);
      results.push({
        method: "按低职套", duty: POLICY_CONFIG.getLabel(lowerDuty),
        years: taogaoYears, tenure: lowerTenure, ...r2, isBest: false,
      });
    }

    const edu = POLICY_CONFIG.EDUCATION[eduValue] ?? POLICY_CONFIG.EDUCATION[4];
    results.push({
      method: "按学历套", duty: edu.label,
      years: "—", tenure: "—", ...edu.taogao, isBest: false,
    });

    let best = results[0];
    for (const r of results) {
      if (levelWage(r.level, r.grade) > levelWage(best.level, best.grade)) best = r;
    }
    best.isBest = true;
    return { results, best };
  },

  /** 滚动推演：2年晋一档、5年晋一级（先晋级后晋档，晋级后档次考核重新起算） */
  calcRolling(level: number, grade: number, fromYear: number, toYear: number, _dutyIndex: number): RollingResult {
    let L = level, G = grade, ls = fromYear, gs = fromYear;
    const history: RollingEvent[] = [];
    for (let y = fromYear + 1; y <= toYear; y++) {
      if (L > 1 && y - ls >= 5) {
        const oldW = levelWage(L, G);
        L = L - 1;
        G = nearestGrade(L, oldW);
        ls = y; gs = y;
        history.push({ year: y, reason: "正常晋升级别", level: L, grade: G, levelStartYear: ls, gradeStartYear: gs });
      } else if (y - gs >= 2) {
        G = Math.min(14, G + 1);
        gs = y;
        history.push({ year: y, reason: "正常晋升档次", level: L, grade: G, levelStartYear: ls, gradeStartYear: gs });
      }
    }
    return { level: L, grade: G, levelStartYear: ls, gradeStartYear: gs, history };
  },

  /** 职务晋升：原级别低于新职务最低级别的强制提档（就近就高），否则晋一档 */
  calcPromotion(level: number, grade: number, dutyIndex: number): { level: number; grade: number; forced: boolean } {
    const [hi] = POLICY_CONFIG.getLevelRange(dutyIndex);
    if (level > hi) {
      return { level: hi, grade: nearestGrade(hi, levelWage(level, grade)), forced: true };
    }
    return { level, grade: Math.min(14, grade + 1), forced: false };
  },
};

/* ---------------- 人员档案参数（供「全部重算」与测算预填使用） ---------------- */

export const PERSON_CALC_INPUTS: Record<number, CalcInput> = {
  // 1 钱广才 · 普通工改：1972年参工，本科，乡科级正职2002年任，低职乡科级副职1995年任
  1: { type: "pre2006", startYear: 1972, eduValue: 4, deductYears: 0, currentDuty: 4, currentDutyYear: 2002, lowerDuty: 3, lowerDutyYear: 1995, isLeader: false, changes: [] },
  // 2 李卫东 · 低职套1：1975年参工，大专，现职2000年任，低职1992年任
  2: { type: "pre2006", startYear: 1975, eduValue: 3, deductYears: 0, currentDuty: 4, currentDutyYear: 2000, lowerDuty: 3, lowerDutyYear: 1992, isLeader: false, changes: [] },
  // 3 王秀英 · 低职套2：1978年参工，本科，工龄间断1年，现职2003年任，低职1994年任
  3: { type: "pre2006", startYear: 1978, eduValue: 4, deductYears: 1, currentDuty: 4, currentDutyYear: 2003, lowerDuty: 3, lowerDutyYear: 1994, isLeader: false, changes: [] },
  // 4 刘志远 · 学历套：1985年参工，硕士研究生（未计工龄学习3年），乡科级副职2001年任，低职科员1996年任
  4: { type: "pre2006", startYear: 1985, eduValue: 6, deductYears: 3, currentDuty: 3, currentDutyYear: 2001, lowerDuty: 2, lowerDutyYear: 1996, isLeader: false, changes: [] },
  // 5 赵长顺 · 工人（技术等级套改，不适用公务员三方案比对，重算时跳过）
  // 6 周晓芸 · 新考录：2015年考入，本科，2016年转正定级
  6: { type: "post2006", startYear: 2015, eduValue: 4, deductYears: 0, currentDuty: 2, currentDutyYear: 2016, lowerDuty: 0, lowerDutyYear: 2016, isLeader: false, changes: [] },
  // 7 孙立群 · 管理：1988年参工，大专，乡科级正职（领导）2004年任，低职1998年任
  7: { type: "pre2006", startYear: 1988, eduValue: 3, deductYears: 0, currentDuty: 4, currentDutyYear: 2004, lowerDuty: 3, lowerDutyYear: 1998, isLeader: true, changes: [] },
  // 8 吴海燕 · 技术（专业技术岗位套改，不适用公务员三方案比对，重算时跳过）
};
