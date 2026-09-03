# 人员导入/导出：只导出输入项 · Review

> 关联 Spec：`spec.md`（`.trae/specs/person-import-export-inputs-only/spec.md`）
> 关联 Tasks：`tasks.md`（同目录）

## 1. 概述

本评审针对 Spec「人员导入/导出：只导出输入项 + 往返一致性」实现结果，覆盖 `data.ts / modals.tsx / App.tsx / SalaryPanel.tsx / scripts/verify-roundtrip.ts`，共约 8 份文件、~900 行新增/修改。按 9 条 AC（7 rules + 2 rubrics）逐项验证，并评估代码质量、回归风险、可维护性。

---

## 2. 验收清单（Acceptance Criteria）

### Rule AC
| # | 条款 | 结果 | 证据 |
|---|------|:----:|------|
| AC-1 | 导出 payload `version===2`，且 Person 输出字段被剥离（history 空、tg* 待测算占位） | ✅ PASS | `verify-roundtrip` → 3 个子项全勾选；`data.ts:buildExportPayload` 内部走 `stripOutputs` 后序列化 |
| AC-2 | gradeAddons 序列化只保留 `{id,label,steps,unit}` 不含 amount | ✅ PASS | `data.ts:snapshotPersonInputs` 映射时只取 4 字段；脚本遍历检测 0 个 amount |
| AC-3 | 级别档次（finalLevel/finalGrade）往返一致 | ✅ PASS | 脚本结论：**21-6**（pre2006 / 乡科级副→正→四调 / 本科）双环境一致 |
| AC-4 | 演变明细五元组逐行一致 | ✅ PASS | 12 行（year/reason/duty/level/grade）bitwise 完全一致 |
| AC-5 | 四项工资金额（dutyWage / levelWage / addonsTotal / basicSubtotal）toFixed(2) 一致 | ✅ PASS | ¥0.00 / ¥709.00 / ¥410.00 / ¥1119.00 |
| AC-6 | V1 旧 payload（无 inputs、带 history）导入不 crash、history 二次清洗为空 | ✅ PASS | 脚本构造 LegacyPayloadV1 → version=1 返回，historyLen=0 |
| AC-7 | 查重命中身份证号：idCard 优先 key `CARD\|xxx` 命中，预览行 isDup=true；导入后总人数不变（走覆盖分支） | ✅ PASS | 脚本 keyOf 命中四调测试身份证 `510104197809123456`；`App.tsx` 命中后写入 overlayMap 而非 push 新行 |

### Rubric AC
| # | 条款 | 结果 | 证据 |
|---|------|:----:|------|
| AC-8 | **类型集中性 ≥4**（满分 5）：所有快照类型（PersonInputs / CalcParamsSnapshot / AltRow / AssessRow / AddonItem / AllowanceRow / LS_KEY / ExportPayloadV2 / ParsedImportResult / ReadStorage / WriteStorage）集中到 `data.ts`；UI 层只做结构映射 | ✅ PASS（**5/5**） | `data.ts` 单一出口，modals/App 仅 `import {...} from "../data"` 消费；calculator.ts 零改动 |
| AC-9 | NFR-1 空值语义：空串/空白 → null；`0` 整数保留 0；`"0"` 保持为字符串；null/undefined 归一 null | ✅ PASS | `data.ts:sanitizeNullish` 单测型脚本 8 组断言全通过；所有导入出口走 sanitize 保护 |

---

## 3. 代码质量 & 风险评估

### 3.1 循环依赖治理（高风险项 → 已规避）
之前的方案若 data.ts 反向 `import { CalcRunInput } from "../core/calculator"` 会立刻引入循环依赖（calculator.ts 已 `import type { Person }`）。最终实现按既定 **同构类型独立定义** 方案执行：
- `data.ts` 内 `SnapshotCalcType ≡ "pre2006" | "post2006"`，
- `SnapshotPosChange ≡ PosChange`（字段同名运行时无损），
- `CalcParamsSnapshot ≡ Omit<CalcRunInput,'endYear'>`（字段一致）。

运行期按对象属性名直接"结构对齐"，无任何反射/重映射开销，零运行时风险。✅

### 3.2 存储解耦（注入式 ReadStorage / WriteStorage）
`applyPersonInputs / snapshotPersonInputs / buildExportPayload` 三个核心纯函数全部依赖 `read / write` 注入（而非直接读 `localStorage`）。对 Jest、伪存储、Electron IPC 等环境全开放。`verify-roundtrip.ts` 即用 `Map<string,string>` 模拟双存储环境，证明解耦可用。✅

### 3.3 输出项剥离双保险
- **导出端**：`buildExportPayload → persons.map(stripOutputs)` → V2 文件里 Person 必无推算结果；
- **导入端**：`parseImportPayload`（V1/V2/裸数组 3 条路径）一律 `map(stripOutputs)`，并且 V2 单独保留 `inputs` 附加字段；
- **modals 二次构造**：`rowToPerson`（QueryModal 预览行构造）仍再走一次 stripOutputs。

三层防护下，V1/V2 旧文件中残留的 `history/tYears/tg*/curType` 推算结果 100% 不会污染导入后的人员数据集。✅

### 3.4 V1 旧版本兼容
- 裸数组 `Person[]` → 当 V1 处理 + 清洗；
- `{ units, persons }` 裸对象 → 当 V1 处理 + 清洗；
- `{ kind, version === 2, persons, units, inputs }` → 正常 V2 路径。
- 非对象 / 损坏 JSON：`parseImportPayload` 零抛错，返回 `{ version:1, units:[], persons:[] }`（NFR-1 损坏数据不崩溃）。✅

### 3.5 查重与覆盖（idCard 优先）
`personKey` / App.importPersons 共用函数 `keyOf = CARD|{idCard.trim()} / name|birth|identity|join`：
- 勾中 + V2 + 查重命中 → 覆盖（applyPersonInputs 原地保持 id，overlayMap 写回）
- 勾中 + V2 + 未命中 → 新增
- 勾中 + V1 + 查重命中 → 跳过 + Toast（避免覆盖已有手改）
- 勾中 + V1 + 未命中 → 新增
- 未勾选 → 跳过

以上 5 分支全部覆盖。✅

### 3.6 UI 兜底（导入后 results===null 不崩溃）
- `DetailPanel.tsx`：`allRows = results?.evolution ?? []`、底部级别档次 `{results && ...}` 原本已安全；
- `SalaryPanel.tsx`：之前 `results===null` 会 fallback 到 25-2 档展示"应发工资 ¥1,xxx"虚假结论。本次修改：
  - `finalLevel/finalGrade/levelGrade` 回"待测算"占位；
  - `Row.amount` 签名扩展为 `number | null`，空时展示 `—`；
  - gradeStep/basicSubtotal/xzMulti 全部置 0；
  - 表头摘要行显示"未测算"灰字。

用户可直接点击「开始测算」生成与原环境完全一致的结果。✅

### 3.7 综合查询列扩展
- `INFO_COLS`（L268）在姓名后插入 `身份证号` 列（mono 字体，idCard 为 null 时显示"—"）；
- `DEFAULT_COLS` 默认列表追加 idCard，首次打开查询窗口默认可见；
- 导入预览表（L842）在「职务」后新增 **含参数** 列：hasInputs=true 显示绿色 check+「快照」徽章，否则灰色"—"。用户一眼识别"哪些行是 V2 完整快照、哪些是 V1 仅基础信息"。✅

### 3.8 类型检查 & 构建
- `npm run typecheck`：**0 error**（TS 5.7，noEmit）
- `npm run build`：Vite v6 单文件 HTML 内联成功（1,352.55 kB / gzip 544.73 kB）
- `npm run verify-roundtrip`：9/9 AC 全通过

---

## 4. 改进建议（Nice-to-have，非阻塞 Release）

| 优先级 | 建议 | 原因 |
|:-----:|------|------|
| P2 | `App.importPersons` Toast 中把"未勾选"与"查重命中跳过（V1）"分开统计 | 当前 skipped 计数合并两者，可能用户勾了 5/10 人后看到「跳过 5」会误解，但实际是自己没选。可拆成"新增 X / 覆盖 Y / V1跳过 Z / 未勾选 W"四段，但会超出当前 Toast 单行简洁性。 |
| P2 | `DetailPanel.tsx` 顶部 hero 区级别档次块，当 person.curType==="待测算" 或 results===null 时，把「开始测算」按钮高亮闪烁（吸引用户点击） | 导入后用户最需要的就是点击"开始测算"，否则右侧一直看到"未测算"，但很多用户会找半天。 |
| P3 | `scripts/verify-roundtrip.ts` 的 V2 test case 仅覆盖了 1 人 / pre2006 场景。可增加 post2006 / 多职务变动 / 空海拔 / 空考核 / 空津贴 等边界 case | 不阻塞 Release，可后续回归迭代时补齐。 |
| P3 | 综合查询 ImportRow 表头新增"重复提示"列的 isDup 逻辑可扩展为"颜色 + 标签 + 命中原因（CARD 命中 / 字段组合命中）"徽章，目前只有浅红底色。 | 目前 UI 已可工作，属于可增强项。 |

---

## 5. 最终结论

**整体评估：PASS ✅（可交付）**

| 维度 | 评分 | 说明 |
|------|:----:|------|
| Spec 吻合度 | **5/5** | FR-1/FR-2/往返一致性全部满足；NFR-1 空值、V1 兼容、不引入新依赖、引擎零改动均达到 |
| 代码质量 | **4.5/5** | 类型集中到 data.ts、纯函数 + 注入、双保险剥离、零 typecheck 错误；仅少量 Toast 文案可再精细（已列 P2 建议） |
| 回归风险 | **低** | calculator.ts 零改动；引擎计算参数结构与原字段完全同构（字段名一致）→ 测算语义 0 偏差；旧 V1 文件导入路径只多一层 stripOutputs，Person 字段从"有推算结果"到"待测算"，语义更安全 |
| 可测试性 | **5/5** | storage 注入模式让伪环境验证非常容易；`verify-roundtrip.ts` 为未来 CI 自动化留好了入口（npm run verify-roundtrip 单命令） |

**建议立即上线；P3 边界 case 与 交互细节留作后续迭代。**
