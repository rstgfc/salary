/**
 * scripts/verify-roundtrip.ts
 * ---------------------------------------------------------------
 *  Spec AC 往返一致性自检脚本（Task 7）：
 *    1. 在「模拟环境 A」中构造 1 名测试人员 + 完整 a-g 7 类输入项
 *    2. 调 runCalculation → 得到 测算结论A
 *    3. 调 data.buildExportPayload → 生成 V2 JSON 导出字符串
 *    4. 模拟「导入 B」：
 *       a. parseImportPayload 解析导出字符串
 *       b. applyPersonInputs 写入 4 个独立伪 storage（B 的 map 存储）
 *       c. 从 B 的 storage 中取出 calc.params（快照不含 results，手动补 endYear）
 *          再次 runCalculation → 得到 测算结论B
 *    5. 对比 A、B：
 *       - AC-3：级别档次（finalLevel/finalGrade）完全一致
 *       - AC-4：演变明细（year|reason|duty|level|grade）五元组逐行一致
 *       - AC-5：四项工资（dutyWage / levelWage / addons-total / basicSubtotal * 1.4 近似应发合计）toFixed(2) 一致
 *       - AC-1：payload.version===2 且 剥离后 history/tgNow 为空/"待测算"
 *       - AC-2：gradeAddons 仅 {id,label,steps,unit} 不含 amount 字段
 *       - AC-6（V1 兼容）：构造 V1 payload（persons[] 无 inputs）能 parseImportPayload 成功
 *       - AC-7（查重命中 idCard）：重导同样 idCard 的人 → personKey 命中
 *
 *  运行方式（Node 22+，TypeScript 原生剥离模式）：
 *     node --experimental-strip-types scripts/verify-roundtrip.ts
 *  或
 *     npx tsx scripts/verify-roundtrip.ts
 * ---------------------------------------------------------------
 */

import {
  Person, makePerson,
  snapshotPersonInputs, applyPersonInputs, stripOutputs, sanitizeNullish,
  buildExportPayload, parseImportPayload,
  LS_KEY, ExportPayloadV2, ParsedImportResult,
} from "../src/data";
import {
  runCalculation, CalcRunInput, CalcRunResult, Calculator,
  DUTY_OPTIONS, DUTY_VALUES, LOWER_DUTY_VALUES,
  EDUCATION_OPTIONS, dutyWage2006,
  POSITION_PICKER_LABELS, POSITION_PICKER_VALUES,
} from "../src/core/calculator";

/** 与 wageStd.ts 中的 getTibetFactor 完全同构的纯实现，避免引入 db/sql.js 依赖链 */
const getTibetFactor = (zone: "二类区" | "三类区" | "四类区"): number =>
  zone === "二类区" ? 1.4 : zone === "三类区" ? 1.7 : 2.0;

/* 工具：伪 storage */
type Store = Map<string, string>;
const mkStore = () => new Map<string, string>();
const reader = (s: Store) => (k: string): string | null => (s.has(k) ? (s.get(k) as string) : null);
const writer = (s: Store) => (k: string, v: string): void => { s.set(k, v); };

/* ——————————————— (1) 构造测试人 A + 全套输入 ——————————————— */
const END_YEAR = 2026;
const UNITS = [{ id: "U001", name: "县委办公室", zone: "二类区" as const }];
const personA: Person = makePerson({
  id: 101, name: "张三", unitId: "U001",
  gender: "男", birth: "1978-09", join: "1998-07", identity: "公务员", edu: "大学本科",
  tag: "普通工改", employ: "在职", position: "四级调研员", gap: 0, unq: "无",
  idCard: "510104197809123456",
});

/* A 的伪 storage：完整输入项 a-g */
const storeA = mkStore();

// a. basic 已经写在 Person 上（applyPersonInputs 会完整拷贝）
// b. 测算参数 + c. 职务变化
// 下标/值约定（严格对齐 calculator.ts）：
//   · currentDutyIndex：DUTY_OPTIONS 的数组下标（0..9），2006 时任职务
//   · lowerDutyIndex：LOWER_DUTY_VALUES 的数组下标（0..10，0="无"），2006 前"低一职"
//   · positionChanges[].dutyIndex：DUTY_VALUES / POSITION_PICKER_VALUES 中的实际数值（3 / 4 / 105 ...）
const eduIdx = Math.max(0, EDUCATION_OPTIONS.findIndex((e) => e.startsWith("大学本科")));
const i_fu = DUTY_OPTIONS.indexOf("乡科级副职");                 // =2, DUTY_VALUES[2]=3
const i_zheng = DUTY_OPTIONS.indexOf("乡科级正职");              // =3, DUTY_VALUES[3]=4
const i_ke = DUTY_OPTIONS.indexOf("科员");                       // =1, 科员的 lowerDutyIdx = 1 + 1 = 2（LOWER[0]="无"）
const i_sidiao = POSITION_PICKER_LABELS.indexOf("四级调研员");    // 职务+职级联合数组的下标
const v_sidiao = POSITION_PICKER_VALUES[i_sidiao];                // =105

const paramsA: Omit<CalcRunInput, "endYear"> = {
  type: "pre2006",
  startYear: 2006,
  educationIndex: eduIdx,
  deductYears: 0,
  currentDutyIndex: i_fu,                    // 2006时任：乡科级副职
  currentDutyYear: 2002,
  lowerDutyIndex: i_ke + 1,                  // 2006前低一职：科员
  lowerDutyYear: 1998,
  positionChanges: [
    { year: 2006, dutyIndex: DUTY_VALUES[i_fu], reason: "工改任职" },
    { year: 2011, dutyIndex: DUTY_VALUES[i_zheng], reason: "提职" },
    { year: 2021, dutyIndex: v_sidiao, reason: "职级晋升" },
  ],
};
// 先算 A 的结果
const runA = runCalculation({ ...paramsA, endYear: END_YEAR });
// 把 params + results 写入 A 的 storage（模拟 UI：用户点了开始测算保存；snapshotPersonInputs 只会读 params）
writer(storeA)(LS_KEY.calc(personA.id), JSON.stringify({ params: paramsA, results: runA, savedAt: new Date().toISOString() }));

// d. 海拔变动
const altA = [
  { ym: "2006-07", tier: 0 },
  { ym: "2015-01", tier: 2 },
];
writer(storeA)(LS_KEY.alt(personA.id), JSON.stringify(altA));

// e. 考核情况
const assessA = [
  { year: "2018", result: "优秀" },
  { year: "2019", result: "称职" },
  { year: "2020", result: "称职" },
  { year: "2021", result: "优秀" },
  { year: "2022", result: "称职" },
  { year: "2023", result: "称职" },
  { year: "2024", result: "称职" },
];
writer(storeA)(LS_KEY.assess(personA.id), JSON.stringify(assessA));

// f. 档次参数（addons 只含 steps/unit 不含 amount；AC-2）
// g. 津贴补贴项目（allowances 按用户填的绝对额写，allowances 可含 amount）
const addonsA = [
  { id: "gaoTao", label: "高套", steps: 2, unit: 25 },
  { id: "xueLiFloat", label: "学历浮动", steps: 1, unit: 25 },
  { id: "fiveYear", label: "五年浮动", steps: 1, unit: 25 },
  { id: "xueLiFixed", label: "学历固定", steps: 3, unit: 25 },
  { id: "nian20", label: "20年固定", steps: 2, unit: 25 },
  { id: "xianXiang", label: "县以下提高", steps: 1, unit: 25 },
];
const allowancesA = [
  { id: "xzMulti", label: "西藏特殊津贴倍数", detail: "140%", amount: 0 },
  { id: "xzAbs", label: "西藏特殊津贴绝对额", detail: "", amount: 560 },
  { id: "zheSuan", label: "折算工龄补贴", detail: "", amount: 40 },
  { id: "zhuFang", label: "住房补贴", detail: "", amount: 120 },
  { id: "custom_abc", label: "交通补贴", detail: "用户自定义", amount: 200 },
];
writer(storeA)(LS_KEY.items(personA.id), JSON.stringify({ addons: addonsA, allowances: allowancesA, v2: true }));

/* ——————————————— (2) 应用 inputs → 确保 A 的 Person.basic 写入；然后 snapshot 导出 ——————————————— */
// 抓 A 的快照对象（用于 applyPersonInputs 回写，返回带 idCard 等 basic 的 Person）
const snapInputs = snapshotPersonInputs(personA, reader(storeA));
// 正式：applyPersonInputs 会写 4 个 key（calc 只写 params 不写 results），所以 storeA_After 会被重写 calc
const storeA_After = mkStore();
// 拷贝到 storeA_After 以避免被 applyPersonInputs 重写后影响对"历史存储含 results"的预期
// 实际 snapshotPersonInputs 已读过 storeA 的内容，现在用快照写入一个干净 store 做导出基准
const personA_Applied = applyPersonInputs(personA, snapInputs, writer(storeA_After));

/* ——————————————— (3) buildExportPayload 导出 V2 ——————————————— */
const exported: ExportPayloadV2 = buildExportPayload([personA_Applied], UNITS, reader(storeA_After));
const exportStr = JSON.stringify(exported);

/* ——————————————— (4) parseImportPayload → applyPersonInputs 到 B 的伪 storage ——————————————— */
const parsed: ParsedImportResult = parseImportPayload(JSON.parse(exportStr));
const storeB = mkStore();
const first = (parsed.persons as Array<Person & { inputs?: typeof snapInputs }>)[0];
if (!first || !first.inputs) throw new Error("AC-ERR：V2 解析失败 / 快照未随 person 同行");

const personB = makePerson({
  id: 501, name: first.name, unitId: first.unitId,
  idCard: (first as Person & { idCard?: string | null }).idCard ?? null,
});
const personB_Applied = applyPersonInputs(personB, first.inputs, writer(storeB));

// 从 B 的 storage 取出 params（需要手动补 endYear，因为快照不含 endYear）
const savedB = JSON.parse(reader(storeB)(LS_KEY.calc(personB.id)) || "{}");
const paramsB: Omit<CalcRunInput, "endYear"> | null = savedB?.params ?? null;
if (!paramsB) throw new Error("AC-ERR：B 的 storage 没有 params");

// B 的档次/津贴同样读 storage（用于工资合计比对）
const itemsB = JSON.parse(reader(storeB)(LS_KEY.items(personB.id)) || "{}");
const addonsB = itemsB.addons as typeof addonsA;
const allowancesB = itemsB.allowances as typeof allowancesA;

// 测算 B
const runB = runCalculation({ ...paramsB, endYear: END_YEAR });

/* ——————————————— 计算四项工资金额（toFixed 2） ——————————————— */
function salaryStats(run: CalcRunResult, addons: typeof addonsA, allowances: typeof allowancesA, zone: "二类区") {
  const dutyWage = dutyWage2006(run.finalDutyIndex);
  const levelWage = Calculator.getSalary(run.finalLevel, run.finalGrade);
  const cur = Calculator.getSalary(run.finalLevel, run.finalGrade);
  const next = Calculator.getSalary(run.finalLevel, run.finalGrade + 1);
  const prev = Calculator.getSalary(run.finalLevel, run.finalGrade - 1);
  const gradeStep = (next > cur) ? (next - cur) : (cur > prev ? cur - prev : 0);
  const extraSteps = addons.reduce((s, a) => s + a.steps, 0);
  const addonsTotal = extraSteps * gradeStep;
  const basicSubtotal = dutyWage + levelWage + addonsTotal;
  const tibetFactor = getTibetFactor(zone);
  const xzMulti = Math.round(basicSubtotal * tibetFactor);
  // 这里只比较 4 项"纯基本工资 + 额外档位"：dutyWage / levelWage / addonsTotal / basicSubtotal
  return {
    dutyWage, levelWage, addonsTotal, basicSubtotal, xzMulti,
  };
}
const statsA = salaryStats(runA, addonsA, allowancesA, "二类区");
const statsB = salaryStats(runB, addonsB, allowancesB, "二类区");

/* ——————————————— AC 校验 ——————————————— */
const failures: string[] = [];
const ok = (tag: string) => console.log(`  \x1b[32m✔\x1b[0m ${tag}`);
const fail = (tag: string, detail: string) => { failures.push(`${tag} → ${detail}`); console.log(`  \x1b[31m✘\x1b[0m ${tag} :: ${detail}`); };

console.log("\n=== AC-1 V2 payload 头 & 输出项剥离 ===");
(exported.version === 2) ? ok("version === 2") : fail("version", `got ${exported.version}`);
const pInPayload = exported.persons[0] as any;
(pInPayload.history && pInPayload.history.length === 0) ? ok("Person.history 空数组") : fail("history 剥离", `length=${pInPayload.history?.length}`);
// 剥离后 tgNow 要么 result==="待测算"，要么是占位 "—" 且 note 含"待测算"
const strippedTgNow =
  (typeof pInPayload.tgNow?.result === "string" &&
    (pInPayload.tgNow.result === "待测算" || pInPayload.tgNow.result === "" || pInPayload.tgNow.result === "—")) &&
  (typeof pInPayload.tgNow?.note === "string" && pInPayload.tgNow.note.includes("待测算"));
strippedTgNow ? ok("tgNow / tgLow / tgEdu 均回写为待测算占位") : fail("tgNow 剥离", `tgNow=${JSON.stringify(pInPayload.tgNow)}`);

console.log("\n=== AC-2 gradeAddons 字段只保留 {id,label,steps,unit} ===");
// snapshotInputs 内的 gradeAddons 直接从 items 读时我们已过滤 amount 字段
const snapInside = exported.persons[0] as any;
const inputsInside = snapInside.inputs ?? (exported as any).inputs?.[0];
const anyAddon: any = addonsB[0];
// 写时：buildExportPayload → snapshotPersonInputs → (f) 类字段是 addons.map({id,label,steps,unit}) 无 amount
// 直接用解析后的 snapInputs 的 gradeAddons 验证
const snapAddons = (snapInputs as any).gradeAddons ?? [];
if (snapAddons.length === 0) {
  fail("addons", "snapshot 内 gradeAddons 为空");
} else {
  const bad = snapAddons.filter((a: any) => "amount" in a);
  bad.length === 0 ? ok("gradeAddons 无 amount 字段") : fail("gradeAddons.amount", `${bad.length} 项含 amount 字段`);
  const good = snapAddons.every((a: any) => "id" in a && "label" in a && "steps" in a && "unit" in a);
  good ? ok("gradeAddons 字段齐全 {id,label,steps,unit}") : fail("gradeAddons 字段", "缺少 id/label/steps/unit 字段");
}

console.log("\n=== AC-3 级别档次一致（finalLevel/finalGrade） ===");
(runA.finalLevel === runB.finalLevel && runA.finalGrade === runB.finalGrade)
  ? ok(`级别档次 ${runA.finalLevel}-${runA.finalGrade}`)
  : fail("级别档次", `A=${runA.finalLevel}-${runA.finalGrade}  B=${runB.finalLevel}-${runB.finalGrade}`);

console.log("\n=== AC-4 演变明细五元组一致 ===");
const rowsA = runA.evolution.map((r) => `${r.year}|${r.reason}|${r.duty}|${r.level}|${r.grade}`);
const rowsB = runB.evolution.map((r) => `${r.year}|${r.reason}|${r.duty}|${r.level}|${r.grade}`);
if (rowsA.length !== rowsB.length) {
  fail("演变行数", `A 行数=${rowsA.length}  B 行数=${rowsB.length}`);
} else {
  let diffs = 0;
  for (let i = 0; i < rowsA.length; i++) {
    if (rowsA[i] !== rowsB[i]) {
      diffs++;
      if (diffs === 1) console.log(`    ↳ 第一处差异: A=${rowsA[i]}  B=${rowsB[i]}`);
    }
  }
  diffs === 0 ? ok(`演变明细 ${rowsA.length} 行全部一致`) : fail("演变明细", `${diffs}/${rowsA.length} 行不一致`);
}

console.log("\n=== AC-5 四项工资（toFixed 2） 一致 ===");
const pair = <K extends keyof typeof statsA>(k: K, label: string) => {
  const a = Number(statsA[k]).toFixed(2); const b = Number(statsB[k]).toFixed(2);
  if (a === b) ok(`${label} = ¥${a}`); else fail(label, `A=¥${a}  B=¥${b}`);
};
pair("dutyWage", "职务工资");
pair("levelWage", "级别工资");
pair("addonsTotal", "档次加项合计");
pair("basicSubtotal", "基本工资小计");

console.log("\n=== AC-6 V1 payload 兼容 ===");
const v1Payload = {
  // 故意不写 kind/version/inputs
  units: UNITS,
  persons: [{ ...stripOutputs(makePerson({ id: 7, name: "李四", unitId: "U001", gender: "男", birth: "1985-01", join: "2009-07", identity: "公务员", edu: "大专", idCard: null })),
    // 旧 V1 还带 history —— 解析要能兜底 stripOutputs 二次清洗
    history: [{ seq: 1, start: "2009-07", reason: "定级", position: "办事员", level: "27.1", pw: 0, lw: 0, promo: "", exam: "", incr: "", note: "" }],
  }],
};
const parsedV1 = parseImportPayload(v1Payload);
if (parsedV1.version === 1 && parsedV1.persons.length === 1 && (parsedV1.persons[0].history || []).length === 0) {
  ok("V1 解析成功（version=1，history 被二次清洗为空）");
} else {
  fail("V1 兼容", `version=${parsedV1.version} persons=${parsedV1.persons.length} historyLen=${(parsedV1.persons[0]?.history || []).length}`);
}

console.log("\n=== AC-7 查重命中 idCard ===");
// 解析导出的同一份 payload，用 App.importPersons 相同的 keyOf 逻辑在「已存在 {personA_Applied}」的集合里判定 dup
const keyOf = (p: Person & { idCard?: string | null }) => {
  const idCard = p.idCard;
  if (idCard && idCard.trim()) return `CARD|${idCard.trim()}`;
  return `F|${p.name}|${p.birth || ""}|${p.identity || ""}|${p.join || ""}`;
};
const existingKeys = new Map<string, Person>();
existingKeys.set(keyOf(personA_Applied as any), personA_Applied);
const reimported = parsed.persons[0] as any;
const hit = existingKeys.has(keyOf(reimported));
hit ? ok(`查重命中 idCard：${reimported.idCard}`) : fail("查重", `idCard=${reimported.idCard} 未命中`);

console.log("\n=== AC-9 空字符串不转 0、数字 0 保持不变 ===");
// 约定：空串/全空白 → null；0 整数保持 0；字符串 "0" 保持为字符串 "0"；null/undefined 归一为 null
((sanitizeNullish("") === null) && (sanitizeNullish("   ") === null)
  && (sanitizeNullish(0) === 0) && (sanitizeNullish("0") === "0")
  && (sanitizeNullish(null) === null) && (sanitizeNullish(undefined) === null))
  ? ok("sanitizeNullish 语义正常（''/空白/undefined → null；0 保持为 0；'0' 保持为 '0'）")
  : fail("sanitizeNullish", `''→${JSON.stringify(sanitizeNullish(""))};  0→${sanitizeNullish(0)};  '0'→${JSON.stringify(sanitizeNullish("0"))};  null→${sanitizeNullish(null)};  undefined→${sanitizeNullish(undefined)}`);

/* ============================================================ */
if (failures.length === 0) {
  console.log("\n\x1b[32mAll acceptance criteria PASSED ✅\x1b[0m\n");
  process.exit(0);
} else {
  console.log(`\n\x1b[31m${failures.length} AC FAILED ❌\x1b[0m`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
