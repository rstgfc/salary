# 人员导入/导出 · 仅输入项 · 往返一致性 — 实施计划

> 根 AC 映射：FR-1 → AC-1/2；FR-2 → AC-1；FR-3 → AC-3/4/5；FR-4 → AC-7；FR-5 → AC-6；NFR-4 → AC-8；NFR-1 → AC-9。

## Task 1：数据层集中化 — PersonInputs 类型 + 纯函数采集/回写
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `src/data.ts` 扩展 `Person` 接口，新增 `idCard?: string`；同步修改 `makePerson` 签名及默认值。
  - 在 `src/data.ts` 新增 `PersonInputs` 接口，完整覆盖 FR-1 的 a-g：
    ```
    interface PersonInputs {
      basic: { ...Person 基本字段（不含输出项） };
      params: Omit<CalcRunInput,'endYear'> | null;   // 从 gw_calc_v1_ 读 params（不是 results）
      positionChanges: PosChange[];
      altChanges: AltRow[];                          // 即 Assess 海拔行
      reviews: AssessRow[];
      gradeAddons: AddonItem[];                       // 保留 steps 不保留 amount
      allowances: AllowanceRow[];
    }
    ```
    注意 AltRow/AssessRow/AddonItem/AllowanceRow/CalcRunInput/PosChange 目前定义在 DetailPanel.tsx、modals.tsx、calculator.ts 三处，本任务要**将它们迁移到 data.ts**（保持等价类型），以便在 data.ts 中定义 PersonInputs 无循环引用。
  - 新增两个纯函数并导出：
    - `snapshotPersonInputs(p: Person, storage: ReadStorage): PersonInputs`；其中 `ReadStorage = (k: string) => string | null`，UI 层传入 `(k) => localStorage.getItem(k)`。snapshot 必须严格读取 key：`gw_calc_v1_{id}`（只取 params，不取 results）、`gw_salary_items_v1_{id}`（addons + allowances，剥离 v2 元字段）、`gw_alt_{id}`、`gw_assess_{id}`。
    - `applyPersonInputs(p: Person, inputs: PersonInputs, storage: WriteStorage): Person`；其中 `WriteStorage = (k: string, v: string) => void`；apply 会：
      1. 返回一个"Person 基础字段更新为 inputs.basic + 输出项重置为待测算"的新对象（tYears/curType/tgNow/tgLow/tgEdu/history 全部置 makePerson 初始值，即剥离输出项）；
      2. 写入 localStorage：`gw_calc_v1_{id} = { params: inputs.params }`（故意不带 results，确保下次开 UI 看到"待测算"，点击测算才重新生成）、`gw_salary_items_v1_{id} = { addons, allowances, v2: true }`、`gw_alt_{id}`、`gw_assess_{id}`。
  - 新增 `stripOutputs(p: Person): Person` 工具：把输出字段回写为"待测算"占位，保证导出序列化绝对不含推论。
  - 新增 `sanitizeNullish` 空值归一工具：`'' / 全空白字符` 转 `null`（数字 0 和合法空数组不转），满足 NFR-1 / AC-9。
- **Acceptance Criteria Addressed**: AC-1 (rule), AC-2 (rule), AC-8 (rubric), AC-9 (rule)
- **Test Requirements**:
  - `rule` TR-1.1：在 data.ts 编写并导出 `__spec_smoke` 导出函数（或临时脚本）验证：对 `PERSON_CALC_INPUTS` 中 id=1 的钱广才对象 + 一个模拟 storage（带对应 key），调用 snapshot → apply → 再次 snapshot，两次 JSON 深度相等（除 apply 过程中 stripOutputs 的 Person 字段，inputs 子树完全相同）。Pass = 深度相等 true，Evidence = 运行命令输出。
  - `rule` TR-1.2：stripOutputs 执行后，`p.history.length === 0` 且 `p.tgNow.result === '—'`。Pass = true，Evidence = 单测输出。
  - `rule` TR-1.3：sanitizeNullish 对 `''` 返回 `null`，对 `0` 返回 `0`，对 `[]` 返回 `[]`。Pass = true，Evidence = 比较输出。
  - `rubric` TR-1.4：类型集中化。Scale 1-5。Anchors：1 = 类型散落在 3+ 文件，重复定义；3 = 类型迁移至 data.ts 但仍有 `// @ts-ignore`；5 = 无循环引用、UI 层仅从 data.ts import 并全链路严格类型。Threshold >= 4。Evidence = 代码走查 + `npm run typecheck` 输出 0 errors。

---

## Task 2：Person 接口补齐 idCard + 导出/导入 payload 版本升级
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - （如 Task1 已完成 Person.idCard 添加则略过接口部分，此处仅做 payload 升级）
  - 在 `src/data.ts` 定义 **`ExportPayloadV2`** 顶层类型：
    ```
    interface ExportPayloadV2 {
      kind: 'gw-salary-persons';
      version: 2;
      exportedAt: string;
      units: Unit[];
      persons: Array<Person & { inputs?: PersonInputs }>;
    }
    ```
    并提供 `buildExportPayload(selected: Person[], ctx)` 和 `parseImportPayload(raw: unknown)`：
    - `buildExportPayload`：对每个 selected 调 `stripOutputs + snapshotPersonInputs`，写入 `{ inputs, ...strippedPerson }`；
    - `parseImportPayload`：识别 version（缺省视为 1）；对 version 1：按旧逻辑（只从 Person 字段构建 PersonInputs 的 basic 部分，其余置默认）；version 2：直接取 `p.inputs`，缺失子字段时用空数组 / null 归一。
- **Acceptance Criteria Addressed**: AC-1 (rule), AC-6 (rule)
- **Test Requirements**:
  - `rule` TR-2.1：用 V2 payload（带 inputs）喂 `parseImportPayload`，返回 `version===2` 且每条人员均能产出 inputs。Pass = true，Evidence = 命令断言。
  - `rule` TR-2.2：用 V1 payload（无 version、无 inputs，仅 persons 数组含 history）喂 parser，返回 `version===1` 且不抛错；每条人员 `inputs.params === null`（由 parser 按旧逻辑 null 化）。Pass = true，Evidence = 命令断言。

---

## Task 3：综合查询导出入口（modals.tsx）重写 exportSel + 导入预览
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - 替换 modals.tsx `exportSel()`（~line 522-537）：**不再** `JSON.parse(JSON.stringify(p)) as Person`；改为调用 `buildExportPayload(勾选人员列表, storage=localStorage.getItem)`，其余 Blob + 下载逻辑保持，Toast 文案改为 `已导出 ${n} 名人员（输入项快照，不含系统推算结果）`。
  - 导入预览 `ImportRow` 增加 `"hasInputs": boolean` 字段（用于 UI 标记"含测算参数"）；预览行组件增加图标或颜色提示。
  - `rowToPerson`（约 line 574-580）改造：**不再**接受 raw 里的 `tgNow / tgLow / tgEdu / history` 真实值，统一在 new 出来后对 Person 调 `stripOutputs` 兜底，防止导入旧版残留输出项被误当真。
  - `onImportFile` 调 parser（Task 2 parseImportPayload）取代当前 `JSON.parse` 裸解析；查重逻辑 personKey 保持已修的 idCard 优先版本（上一次会话已改）。
- **Acceptance Criteria Addressed**: AC-1 (rule), AC-6 (rule), AC-7 (rule)
- **Test Requirements**:
  - `rule` TR-3.1：勾选已测算人员 → 点击导出 → 下载 JSON 后手动解析：`persons[0].history.length === 0` 且 `persons[0].tgNow.result === '—'`。Pass = true，Evidence = diff。
  - `rule` TR-3.2：导入同名同出生但同身份证号人员，预览"重复"标记显示 hasInputs。Pass = true，Evidence = UI 截图或 DOM 断言。

---

## Task 4：App.tsx 导入回调升级为"分发 + 覆盖"
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - `importPersons(ps: Person[], units?: Unit[])` 原逻辑仅重编号 + 补单位；需扩展签名为 `importPersons(payload: ParsedImportResult)`（或者直接让 importPersons 接收带 inputs 的 Person 数组 + 单位数组），并在循环里：
    1. 用之前返回的 dupN 查重命中 → **覆盖**：调 `applyPersonInputs(hit, inputs, localStorage.setItem)` 返回更新 Person，更新 `persons.map` 中的该 id；命中时**保持原 id 不变**（避免 id 变化对应用户列表"人员丢失"的体验）；
    2. 未命中 → **新增**：先生成 nextId，再调 `applyPersonInputs(newPersonFromBasic, inputs, localStorage.setItem)`。
  - 新增 Toast：`成功导入（新增 X 人 / 覆盖 Y 人 / 跳过 Z 人）`。
- **Acceptance Criteria Addressed**: AC-3/4/5 (rule 基础)、AC-7 (rule)
- **Test Requirements**:
  - `rule` TR-4.1：目标库 3 人，导入含 1 名重复 + 1 名新 + 1 名（用户勾选跳过）的 3 人文件，实际总人数 3+1=4，Toast 显示"新增 1 / 覆盖 1 / 跳过 1"。Pass = true，Evidence = Console。
  - `rule` TR-4.2：覆盖模式下，原人员 id（如 1）保持不变，`gw_calc_v1_1.params.startYear` 被更新为导入 inputs.params.startYear。Pass = true，Evidence = localStorage read 比较。

---

## Task 5：DetailPanel / SalaryPanel 在导入后仍能正确消费（确保 AC-3/4/5 的 UI 通路）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - 验证 `DetailPanel.tsx` 的 `useEffect([person.id])` 载入逻辑（~line 189-215）对 `gw_calc_v1_` 只有 params 无 results 的情况能正确显示「待测算」并在点击"开始测算"后生成 results；当前逻辑 `raw` 有 params 就会 `setParams(saved.params)`，results 未保存时 setResults 为 null，此时 UI 面板按设计应展示"请先开始测算"。确认这个路径正常（如果 UI 组件缺少 results 时 crash，需要修）。
  - 若 DetailPanel 的 wageNow/最终级别的 UI 区域在 `results === null` 时会抛错，加 `results ? ... : '待测算'` 兜底。
  - `SalaryPanel.tsx` 的 useEffect 对 `gw_salary_items_v1_`（导入写入的 addons/allowances + v2:true）能按现有合并逻辑读取，不必改动（已兼容 v2:true 标记），本任务仅做回归验证。
- **Acceptance Criteria Addressed**: AC-3 (rule), AC-4 (rule), AC-5 (rule)
- **Test Requirements**:
  - `rule` TR-5.1：导入新人员（无旧存档）→ 打开详情，确认"开始测算"按钮可见且不抛未捕获异常。Pass = true，Evidence = Browser console error count 0。
  - `rule` TR-5.2：点击"开始测算" → 控制台 `runCalculation(params)` 无抛错，最终结果存在。Pass = true，Evidence = DevTools。

---

## Task 6：综合查询默认列 + 检索字段同步 idCard（保证 UI 侧体验与之前身份证号修改一致）
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1（因为 idCard 类型需先定义）
- **Description**:
  - modals.tsx `INFO_COLS` 在姓名和性别之间插入「身份证号」列（上一次会话已有修改预览，若尚未落盘则补齐）。
  - `DEFAULT_COLS` 默认显示列加入 idCard。
  - App.tsx `filtered`（检索）匹配字段加入 idCard。
- **Acceptance Criteria Addressed**: AC-1 (rule 子项 1.4)
- **Test Requirements**:
  - `rule` TR-6.1：INFO_COLS.find(c => c.key === 'idCard') 存在且 group='基础信息'。Pass = true，Evidence = 代码读取。
  - `rule` TR-6.2：PersonList 检索框输入身份证号片段能命中对应人员。Pass = true，Evidence = UI 行为。

---

## Task 7：端到端往返一致性脚本验证（实现最终验收）
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3, 4, 5
- **Description**:
  - 在项目根提供 `scripts/verify-roundtrip.mjs`（或 `src/__spec__/roundtrip.test.ts`，但避免引入测试框架依赖，选 mjs），做伪环境：
    - 用 `localStorage-mock` 或直接构造 `Map<string,string>` 模拟 2 个 storage（oldEnv / newEnv）；
    - 取 2-3 名样本人员（钱广才 / 李卫东 / 吴海燕 都在 PERSON_CALC_INPUTS 中，params 可构造），在 oldEnv 手动写入 inputs 存档 → 调 snapshot + buildExportPayload 出 V2 JSON → 在 newEnv 调 parser + importPersons(覆盖) 且 applyPersonInputs → 用 Calculator.runCalculation 对旧/新参数各跑一次 → 比较 finalLevel/finalGrade、evolution 五元组、薪资 breakdown 四项。
  - 脚本失败 `process.exit(1)`，成功 exit(0)。
- **Acceptance Criteria Addressed**: AC-3 (rule), AC-4 (rule), AC-5 (rule)
- **Test Requirements**:
  - `rule` TR-7.1：`node scripts/verify-roundtrip.mjs` 退出码为 0 并打印样本对比摘要。Pass = true，Evidence = 命令输出。
  - `rule` TR-7.2：脚本中故意改一个 params.currentDutyYear +1 再跑，确认 evolution 五元组不相等（脚本能捕获差异并 exit 1，反向验证测试有效）。Pass = exit 1，Evidence = 命令输出。

---

## Task 8：构建/类型检查零错误收尾
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1-6
- **Description**:
  - 在 VSCode 中对相关文件 tsx/ts 保存后，跑 `npm run typecheck` 0 error；
  - 修复 AC-8 rubric 不达 4 分以上所需的集中化/类型补充；
  - 跑 `npm run build`（可选）验证 Vite 构建无错误（若环境有网络取依赖则执行，否则跳过）。
- **Acceptance Criteria Addressed**: AC-8 (rubric)
- **Test Requirements**:
  - `rule` TR-8.1：`npm run typecheck` 退出码 0，0 error。Pass = true，Evidence = 命令输出。
  - `rubric` TR-8.2：同 AC-8 维度再次评分；Threshold >= 4。Evidence = 代码走查 + typecheck 结果。

---

## 总览（AC → Task 映射表）

| AC  | 性质 | 映射 Task / TR |
|-----|------|----------------|
| AC-1 导出 payload 含 inputs + 剥离输出项 | rule | T1/TR1.1/1.2; T2/TR2.1; T3/TR3.1; T6/TR6.1 |
| AC-2 档次参数 steps 不 amount | rule | T1/TR1.1（snapshot 剥离 amount） |
| AC-3 最终级别档次一致 | rule | T4/TR4.2; T5/TR5.2; T7/TR7.1 |
| AC-4 演变明细逐行一致 | rule | T5/TR5.2; T7/TR7.1 |
| AC-5 四项工资金额两位一致 | rule | T7/TR7.1 |
| AC-6 V1 旧文件兼容 | rule | T2/TR2.2; T3 内 rowToPerson 兜底 |
| AC-7 查重用身份证号优先 | rule | T4/TR4.1 |
| AC-8 类型集中化 + tsc 0 错 | rubric (≥4) | T1/TR1.4; T8/TR8.2 |
| AC-9 空值语义正确 | rule | T1/TR1.3 |
