# 人员导入/导出 · 仅导出「输入项」 · 往返一致性 — 产品需求文档

## Overview
- **Summary**: 重构人员导出/导入通道：导出不再输出系统推算结果（级别档次结论、演变明细、工资合计等），只输出"用户填写数据"的完整快照；该文件重新导入后，无需人工补充，点击测算即可再次得出完全一致的结果（级别档次、演变明细、应发工资三方面完全相同）。
- **Purpose**: 1) 让导出文件语义清晰（"用户设置" vs "系统结论"解耦）；2) 支持跨设备迁移、多人协同、备份存档，保证"可复现"；3) 避免旧版导出携带系统推论字段导致"过时结论被误当作真"的问题。
- **Target Users**: 系统管理员、数据录入员、需要跨设备/账号迁移工资档案的用户。

## Goals
- G1. 导出结果严格区分"输入项/输出项"：**明确包含** 7 类用户填写的数据（详见 FR-1），**明确不包含** 系统推算结果（FR-2）。
- G2. 严格的往返一致性：同一存档人员 → 导出文件 → 导入后（覆盖或新增模式） → 重新测算 → 与导出前结论完全一致（FR-3）。
- G3. 与现有"人员导入预览 / 查重 / 勾选导出" UI 自然兼容，不打断现有使用习惯（FR-4）。
- G4. 保证旧版导出文件仍能导入（向后兼容），缺省字段按合理默认/已有规则回填（FR-5）。

## Non-Goals
- 不改变 2006 套改、滚动级别、晋晋级档、津贴核算等**计算逻辑本身**；本需求仅调整"哪些字段在导出/导入闭环里"。
- 不改变 localStorage 作为本地持久化主路径的地位（仅导出时"采集 + 打包"，导入时"分发 + 落库"）。
- 不提供 Excel/XLSX 格式（保留原 JSON 格式）；如用户后续需要可另行规划。
- 不新增服务端同步逻辑（纯前端离线闭环）。

## Background & Context
当前实现（截至 src/components/modals.tsx `exportSel` 约第 522-537 行）：
1. 导出 payload 只包含 `kind=gw-salary-persons`、`version=1`、`units[]`、`persons[]`，其中 `persons[]` 是 `Person` 对象的"全量 JSON 深拷贝" —— 这意味着输出项字段（history、tgNow、tgLow、tgEdu、tYears、curType）同时被导出；
2. 实际的用户填写数据分散在 **localStorage 的多个 key** 中：
   - 测算参数 + 结果：`gw_calc_v1_{id}` 里的 `{ params: CalcRunInput; results: CalcRunResult }`；
   - 档次参数 addons（高套/学历浮动/五年浮动/学历固定/20年固定/县以下提高）+ 津贴 allowances：`gw_salary_items_v1_{id}`；
   - 海拔变动：`gw_alt_{id}` → `AltRow[]`；
   - 考核情况：`gw_assess_{id}` → `AssessRow[]`；
3. **现有导出并未携带上述 localStorage 数据**，导致用户迁机或重装后：即使 Person 数据齐全，用户在"测算面板""当前工资""详细资料"手动调过的参数都会丢失，必须重新录入才能得出相同结论。
4. 另外，当前 `Person` 接口中用户填写的字段还应包括前次会话里刚加入、尚未落盘的 `idCard?: string`（身份证号，属于基本信息 a 类）。

## Functional Requirements

### FR-1：导出内容必须包含全部"用户填写数据"
导出 JSON payload 中，对每位人员新增 **`inputs`** 字段（或等价顶层对象，设计上可在 src/data.ts 定义统一 TS 类型），至少覆盖：

- **a. 人员基本信息（用户填写）**：姓名、性别、身份证号、出生年月、学历、studyYears（未计工龄学习年数）、参工年月 join、identity 身份、tag 人员类型（通过 `isPre2006` 或 tag 值可区分 2006 前/后）、leader、单位 unitId、在职状态 employ、不称职年说明 unq、工龄间断 gap；
- **b. 测算参数（用户填写）**：`CalcRunInput` 除 `endYear`（与当前时间相关，不视为用户真实输入）之外的字段快照：
  - type（pre2006 / post2006）、startYear（参工年份，从 join 派生但允许手改后保存的版本需完整保留）；
  - educationIndex、deductYears（考核扣除年限）；
  - currentDutyIndex（2006 时任职务/职级）、currentDutyYear（任职时间）；
  - lowerDutyIndex（低一职务/职级）、lowerDutyYear（任职时间，仅 2006 前必填）；
- **c. 职务变化情况**：`positionChanges: PosChange[]`（`{year, dutyIndex, reason, isInitial?}` 全量）—— 需求中要求的"职务/职级 + 任职年份完整列表"；
- **d. 海拔变动情况**：`gw_alt_{id}` 的 `AltRow[]`（`{ym, tier}` 全量）—— 需求"海拔类别 + 年份完整列表"；
- **e. 考核情况**：`gw_assess_{id}` 的 `AssessRow[]`（`{year, result}` 全量）；
- **f. 用户填写/确认的档次参数**：`gw_salary_items_v1_{id}` 的 `addons[]`（高套 gaoTao / 学历浮动 xueLiFloat / 五年浮动 fiveYear / 学历固定 xueLiFixed / 20年固定 nian20 / 县以下提高 xianXiang 及任何扩展项），保留每档 steps 而非导出金额；
- **g. 用户填写/编辑的津贴补贴**：`gw_salary_items_v1_{id}` 的 `allowances[]`（所有项目：西藏倍数/绝对额、折算工龄、住房、自定义等），保留每笔金额/标签/detail。

`units[]` 继续打包关联的单位（id/name/zone），保持原路径。

### FR-2：导出内容明确排除系统推算结果
导出 JSON **不得**包含以下"输出项"字段，即使 Person 原有字段存在也要在序列化前剥离/置空：
- `tYears`（套改年限由 startYear/edu/deductYears 推出）；
- `curType`（套改类型标签由三方案比对结果得出）；
- `tgLabels / tgNow / tgLow / tgEdu`（套改三行结论）；
- `history: SalaryRecord[]`（历次工资演变明细/工资标准结论/应发）；
- 以及 `CalcRunResult` 里的 `evolution/compare/finalLevel/finalGrade/hero/...` 等系统输出（允许"保留 params 但剥离 results"）。

导出完成时 UI Toast 必须明确告知"导出输入项 X 项，未含系统推算结果"。

### FR-3：往返一致性（核心验收）
对当前系统中任意一名已测算保存过的、津贴/海拔/考核/档次参数/职务变化均有手改痕迹的人员：
1. 勾选导出（只走新增输入项快照路径）；
2. 清空或另起浏览器环境后，按导入预览 → 导入；
3. 在新环境中打开该人员，**无需任何手改**，直接点击"开始测算"；
4. 断言：
   - 最终级别档次 `finalLevel-finalGrade` 与原环境中相等；
   - 演变明细行数、每行 `(year, reason, duty, level, grade)` 完全一致；
   - 当前工资面板中"基本工资小计 / 加项合计 / 津贴合计 / 应发工资合计"四项金额**按两位小数**完全一致。

### FR-4：与现有 UI 兼容
- 仍使用 `综合查询` 弹窗的"勾选人员 → 导出"入口，无需新增菜单项；
- 仍使用 `综合查询` 弹窗的"导入 → 预览 → 查重 → 勾选导入"流程；导入时预览表格需新增列："含测算参数"（若导入档案中 inputs.params 非空打勾/标记，提醒用户这是完整快照），原"姓名/性别/出生/参工"等列保持。
- 查重策略：若导入快照带 idCard，则使用 `CARD|{idCard}` 作为指纹；否则退化为 `姓名|出生年月|身份`（与需求前序身份证号改动一致）。
- 导入覆盖行为：若查重命中现有人员，默认"覆盖该人员全部输入项（Person + 4 类 localStorage）"；输出项（history/tgNow 等）在覆盖后清空为"待测算"占位；Toast 显示"X 人已覆盖，Y 人新增"。

### FR-5：向后兼容
- 新解析器必须能继续读取 **旧版 payload（version:1 且无 inputs 字段 / 直接 Person[]）**；缺省 inputs 字段时，系统按旧有"从 Person 字段 + 默认值"路径回填，不抛错；
- 新版 payload 使用 `version: 2`，parser 按 version 分支；`kind: "gw-salary-persons"` 必须保持不变。

## Non-Functional Requirements

### NFR-1：稳健性
- 导入/导出任意环节遇到损坏 JSON、缺字段、字段类型不匹配时，不得抛未捕获异常：UI Toast 提示 + 控制台 warn 即可，其他人员流程继续。空字符串与 null 严格区分（参考前次 Excel 经验：允许为空时，写 `null` 而非 `""` 或 `0`，避免空字符串/数值 0 污染数据）。
### NFR-2：性能
- 对 200 名人员的导出/导入单页交互 < 1.5 秒（含 localStorage 读写 + JSON 序列化）；
- localStorage 批量写入按 person.id 分批，避免一次性大字符串；
### NFR-3：可读性
- 导出 JSON 使用 2 空格缩进，字段命名直观（`inputs.basic / inputs.params / inputs.positionChanges / inputs.altChanges / inputs.reviews / inputs.gradeAddons / inputs.allowances`）；
### NFR-4：可维护性
- 输入项类型必须在 `src/data.ts` 中定义为唯一 TS 接口 `PersonInputs`，导出/导入/UI 三方共同引用；禁止在 modals.tsx/DetailPanel.tsx 出现重复定义；
- 所有"采集 localStorage 字段"的逻辑集中在 **`src/data.ts` 的两个纯函数**（`snapshotInputs(person, readStorage?): PersonInputs` 与 `applyInputs(person, inputs, writeStorage?): Person`），以便单测覆盖；

## Constraints
- **Technical**：前端纯 React + localStorage，Electron 壳子无文件写入 API 时退化为 Blob + `<a download>`；必须继续使用当前 tech stack；
- **Business**：导入时若单位 id 在目标系统不存在，按原 App.tsx `importPersons` 逻辑**自动补入** units（保持原行为）；
- **Dependencies**：不得引入 ExcelJS/SheetJS 等额外依赖（需求没要求换格式），不触碰计算引擎 `core/calculator.ts` 的纯函数表。

## Assumptions
- A1. 用户已有"已测算保存"的人，`gw_calc_v1_{id}`、`gw_salary_items_v1_{id}`、`gw_alt_{id}`、`gw_assess_{id}` 中至少有 `params`/`addons` 存档；缺失时按 `deriveParams` + `defaultAddons` + 默认 `DEFAULT_ALLOWANCES` 合法默认值补，仍可导出合法快照；
- A2. `idCard` 字段已在前一轮（上一次会话）加入 Person 接口但尚未落盘到仓库，**本轮实现时同步加入 data.ts 中的 Person 接口 / makePerson 函数**（否则 a 类基本信息缺身份证号）。

## Acceptance Criteria

### AC-1：导出 payload 结构正确且严格剥离输出项
- **Type**: `rule`
- **Given**: 系统中至少有一名"已测算保存、修改过档次参数/海拔/考核/职务变化"的人员，且已勾选；
- **When**: 在综合查询弹窗点击「导出」；
- **Then**: 下载的 JSON 文件满足：
  1. 顶层含 `kind === "gw-salary-persons"` 且 `version === 2`；
  2. 每人 `persons[i]` 字段中，`tYears/curType/tgLabels/tgNow/tgLow/tgEdu/history` 均为默认"待测算"占位（见 makePerson 初始化值）**或被剔除**；无论哪种，导入重算前绝不含真实推算结论；
  3. 每人存在 `inputs` 对象且包含 7 个子字段：`basic, params, positionChanges, altChanges, reviews, gradeAddons, allowances`；
  4. `persons[i].idCard` 存在（可为空字符串或 null）；
- **Pass Condition**: 对下载 JSON 执行断言时全部为真。
- **Evidence**: Node `--eval` / `jq` 读取导出文件后的断言输出。

### AC-2：工资档次参数按 steps 持久化而非金额
- **Type**: `rule`
- **Given**: 某人员在 SalaryPanel 中手动调高"高套 3 档 / 学历固定 2 档 / 县以下提高 1 档"后保存；
- **When**: 导出该人员；
- **Then**: `inputs.gradeAddons[*].steps` 精确记录用户档位，且**不包含**"金额 amount"推导字段（允许展示层保留 unit=25，这是常量）。
- **Pass Condition**: 导出 JSON 中三个 gradeAddons.steps === 3/2/1 且无 amount 字段。
- **Evidence**: 代码走查 + 导出文件字段检查。

### AC-3：往返一致性（级别档次一致）
- **Type**: `rule`
- **Given**: 一名已测算保存的完整样本人员 p0；
- **When**: 导出 JSON → 删除浏览器 localStorage（或全新浏览器） → 导入 → 不做任何手改 → 打开详情并点击"开始测算"得到 p0'；
- **Then**: `JSON.stringify({ finalLevel, finalGrade })` 在 p0 与 p0' 中完全相同。
- **Pass Condition**: 字符串相等。
- **Evidence**: 控制台打印 p0（旧存档 calc.results.finalLevel/finalGrade）和 p0' 结果后截图/命令输出。

### AC-4：往返一致性（演变明细逐行一致）
- **Type**: `rule`
- **Given/When**: 同 AC-3；
- **Then**: `evolution[]` 逐行比较 `(year, reason, duty, level, grade)` 五元组完全一致（行数相同，每行均一致）。
- **Pass Condition**: `_.isEqual(oldEvo.map(...), newEvo.map(...)) === true`。
- **Evidence**: Diff 比较数组。

### AC-5：往返一致性（应发工资四项金额按两位小数完全一致）
- **Type**: `rule`
- **Given/When**: 同 AC-3；
- **Then**: 打开"当前工资"面板，旧/新环境中比较：
  - 基本工资小计 basicSubtotal；
  - 加项金额合计 addonsTotal；
  - 津贴补贴合计 allowancesTotal；
  - 工资合计 total；
  四者按 `toFixed(2)` 后完全相同。
- **Pass Condition**: 四组字符串均相等。
- **Evidence**: 截图对比或 salary breakdown JSON 比对。

### AC-6：旧版 payload 导入兼容
- **Type**: `rule`
- **Given**: 旧版导出 JSON（`version === 1` 或 无 `inputs` 字段，仅带 `persons` 数组含完整 history/tgNow）；
- **When**: 按综合查询导入预览 → 导入；
- **Then**: 不抛错；人员成功创建或命中查重覆盖；`inputs` 字段缺失时回退到 `deriveParams`/默认档次/默认津贴（不崩溃）。
- **Pass Condition**: 导入预览显示有效行数 > 0，导入 Toast 无 `error` 级别。
- **Evidence**: 导入流程录屏或日志。

### AC-7：查重按身份证号优先
- **Type**: `rule`
- **Given**: 目标库已有"张三（身份证号 A）"；
- **When**: 导入同姓名同出生但身份证号相同的"张三"；
- **Then**: 预览行标记为"重复，将覆盖"；导入后实际执行覆盖而非新增（总人数不变）；`personKey` 指纹命中 idCard 路径。
- **Pass Condition**: 总人数 len === 原 len，且 旧张三的 inputs 被替换为新 payload 中的 inputs。
- **Evidence**: Console `personKey` 与人员数变化日志。

### AC-8：类型安全与可维护性
- **Type**: `rubric`
- **Dimension**: 类型与集中化程度
- **Scale**: 1-5
- **Anchors**:
  1 = 重复散落定义 PersonInputs 各字段，`tsc --noEmit` 报错；
  3 = 在 data.ts 定义 PersonInputs 但仍有少量 localStorage 读写散落在 UI 组件；
  5 = `PersonInputs` 集中定义 + `snapshotInputs / applyInputs` 纯函数 + 全链路严格类型，`tsc --noEmit` 0 error；
- **Pass Threshold**: >= 4
- **Evidence**: `npm run typecheck` 结果 + 代码 walkthrough。

### AC-9：空值语义正确
- **Type**: `rule`
- **Given**: 一名人员"身份证号留空 / 考核年份无记录 / 海拔只有一条 / 20年固定为 0 档"；
- **When**: 导出后再导入；
- **Then**: 空字段不会变成 `0` 或 `"0"`；未填充身份证号仍为空值；考核列表为空仍为空；档次 steps 明确为 0 的（合法输入）保持为 0 整数。
- **Pass Condition**: 对对应字段 `typeof` 检查 + 值断言。
- **Evidence**: 导入前后 inputs 对象 JSON 比对。

## Open Questions
- [ ] Q1：覆盖模式是否需要在导入预览里给用户一个"跳过/覆盖"开关（默认覆盖，按现有 UI 习惯通常跳过）？—— 暂按"默认覆盖（有指纹命中时） + 可切换跳过"在 Task 中预留；**等用户在 Approve 阶段回答**。
- [ ] Q2：要不要把 `idCard` 字段加入综合查询列（本次不要求，但用户在上一次会话中已同意默认列增加 idCard）？—— **默认加入**（与上一次会话修改一致）。
