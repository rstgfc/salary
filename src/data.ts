/* ------------------------------------------------------------------ */
/*  公务员工资测算系统 · 数据层                                          */
/*  后续接入微信小程序后台时，仅需将本文件替换为 src/core 计算模块的输出    */
/* ------------------------------------------------------------------ */

export type Employ = "在职" | "退休" | "止薪";

export interface SalaryRecord {
  seq: number;
  start: string;      // 起薪时间
  reason: string;     // 原因
  position: string;   // 职务层次
  level: string;      // 级别（级.档）
  pw: number;         // 职务工资
  lw: number;         // 级别工资
  promo: string;      // 晋级档起（级别考核起算,档次考核起算）
  exam: string;       // 考年份
  incr: string;       // 增资额
  note: string;       // 备注
}

export interface TaogaiRow {
  result: string;
  note: string;
}

export interface Person {
  id: number;
  name: string;
  idCard?: string | null;     // 身份证号（非必填，往返一致性/查重的关键输入项）
  gender: "男" | "女";
  identity: string;
  leader: string;
  birth: string;
  edu: string;
  studyYears: number;
  tag: string;            // 人员状态：普通工改 / 低职套1 ...
  employ: Employ;
  unitId: string;
  position: string;       // 现任职务层次
  join: string;           // 参工时间
  gap: number;            // 工龄间断
  unq: string;            // 不称职年说明
  tYears: number;         // 套改年限
  curType: string;        // 当前套改类型
  tgLabels: [string, string, string];
  tgNow: TaogaiRow;
  tgLow: TaogaiRow;
  tgEdu: TaogaiRow;
  history: SalaryRecord[];
}

/* ---------------- 工资类区 ---------------- */
export type WageZone = "二类区" | "三类区" | "四类区";
export const WAGE_ZONES: WageZone[] = ["二类区", "三类区", "四类区"];

export interface Unit { id: string; name: string; zone: WageZone; }

/* ---------------- 单位 ---------------- */

export const INITIAL_UNITS: Unit[] = [{ id: "0001", name: "测试单位1", zone: "二类区" }];

/* ---------------- 状态标签配色 ---------------- */

export const TAG_META: Record<string, { cls: string; dot: string }> = {
  普通工改: { cls: "bg-[rgba(10,132,255,.13)] text-[#6db1ff] border-[rgba(10,132,255,.38)]", dot: "#0a84ff" },
  低职套1: { cls: "bg-[rgba(94,92,230,.15)] text-[#a9a7f6] border-[rgba(94,92,230,.42)]", dot: "#5e5ce6" },
  低职套2: { cls: "bg-[rgba(125,122,240,.15)] text-[#bcbbfa] border-[rgba(125,122,240,.42)]", dot: "#7d7af0" },
  学历套: { cls: "bg-[rgba(48,209,88,.13)] text-[#7ede99] border-[rgba(48,209,88,.38)]", dot: "#30d158" },
  工人: { cls: "bg-[rgba(255,159,10,.13)] text-[#ffbe69] border-[rgba(255,159,10,.38)]", dot: "#ff9f0a" },
  新考录: { cls: "bg-[rgba(90,200,250,.13)] text-[#93d9fb] border-[rgba(90,200,250,.38)]", dot: "#5ac8fa" },
  管理: { cls: "bg-[rgba(191,90,242,.13)] text-[#dcaef7] border-[rgba(191,90,242,.4)]", dot: "#bf5af2" },
  技术: { cls: "bg-[rgba(255,214,10,.12)] text-[#ffe36e] border-[rgba(255,214,10,.36)]", dot: "#ffd60a" },
};

export const EMPLOY_META: Record<Employ, { dot: string; cls: string }> = {
  在职: { dot: "#30d158", cls: "text-[#7ede99] bg-[rgba(48,209,88,.12)] border-[rgba(48,209,88,.35)]" },
  退休: { dot: "#ff9f0a", cls: "text-[#ffbe69] bg-[rgba(255,159,10,.12)] border-[rgba(255,159,10,.35)]" },
  止薪: { dot: "#ff453a", cls: "text-[#ff8b84] bg-[rgba(255,69,58,.12)] border-[rgba(255,69,58,.38)]" },
};

/* ---------------- 工资演变记录构造器 ---------------- */

let SEQ = 0;
const R = (
  start: string, reason: string, position: string, level: string,
  pw: number, lw: number, promo: string, exam: string,
  incr: string = "", note = ""
): SalaryRecord => ({
  seq: ++SEQ, start, reason, position, level, pw, lw,
  promo, exam, incr, note,
});

/* ---------------- 人员数据 ---------------- */

export const PEOPLE: Person[] = [
  {
    id: 1, name: "钱广才", gender: "男", identity: "公务员", leader: "",
    birth: "1952年9月", edu: "大学本科毕业", studyYears: 0,
    tag: "普通工改", employ: "在职", unitId: "0001", position: "乡科级正职（非领导）",
    join: "1972年9月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 35,
    curType: "按现职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "18.7 工资 976", note: "时任职务：乡科级正职，时间2002年，间断0年，任职年限5年，退休费提高比例0%" },
    tgLow: { result: "19.8 工资 945", note: "低一职务：乡科级副职，时间1995年，间断0年，任职年限12年" },
    tgEdu: { result: "25.2 工资 380", note: "—" },
    history: [
      R("2006/7/1", "工资套改", "乡科级正职（非领导）", "18.7", 480, 976, "2006,2006", "0"),
      R("2008/1/1", "正常晋升档次", "乡科级正职（非领导）", "18.8", 480, 1029, "2006,2008", "", "53"),
      R("2009/1/1", "滚动级别", "乡科级正职（非领导）", "17.7", 480, 1061, "2009,2008", "", "32"),
      R("2010/1/1", "正常晋升档次", "乡科级正职（非领导）", "17.8", 480, 1118, "2009,2010", "", "57"),
      R("2012/1/1", "正常晋升档次", "乡科级正职（非领导）", "17.9", 480, 1175, "2009,2012", "", "57"),
      R("2014/1/1", "正常晋升级别", "乡科级正职（非领导）", "16.8", 480, 1213, "2014,2012", "", "38"),
      R("2014/1/1", "正常晋升档次", "乡科级正职（非领导）", "16.9", 480, 1274, "2014,2014", "", "61"),
      R("2014/10/1", "调整工资标准", "乡科级正职（非领导）", "16.9", 820, 2826, "2014,2014", "", "1892"),
      R("2016/1/1", "正常晋升档次", "乡科级正职（非领导）", "16.10", 820, 2962, "2014,2016", "", "136"),
    ],
  },
  {
    id: 2, name: "李卫东", gender: "男", identity: "公务员", leader: "",
    birth: "1955年3月", edu: "大专毕业", studyYears: 0,
    tag: "低职套1", employ: "在职", unitId: "0001", position: "乡科级正职（非领导）",
    join: "1975年8月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 31,
    curType: "按低职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "19.6 工资 862", note: "时任职务：乡科级正职，时间2000年，间断0年，任职年限6年，退休费提高比例0%" },
    tgLow: { result: "17.9 工资 1035", note: "低一职务：乡科级副职，时间1992年，间断0年，任职年限14年" },
    tgEdu: { result: "24.6 工资 410", note: "—" },
    history: [
      R("2006/7/1", "工资套改", "乡科级正职（非领导）", "17.9", 430, 1035, "2006,2006", "0", "", "低职套改结果"),
      R("2008/1/1", "正常晋升档次", "乡科级正职（非领导）", "17.10", 430, 1092, "2006,2008", "", "57"),
      R("2009/1/1", "滚动级别", "乡科级正职（非领导）", "16.10", 430, 1130, "2009,2008", "", "38"),
      R("2010/1/1", "正常晋升档次", "乡科级正职（非领导）", "16.11", 430, 1190, "2009,2010", "", "60"),
      R("2012/1/1", "正常晋升档次", "乡科级正职（非领导）", "16.12", 430, 1251, "2009,2012", "", "61"),
      R("2014/1/1", "正常晋升级别", "乡科级正职（非领导）", "15.12", 430, 1296, "2014,2012", "", "45"),
      R("2014/10/1", "调整工资标准", "乡科级正职（非领导）", "15.12", 780, 2610, "2014,2014", "", "1664"),
      R("2016/1/1", "正常晋升档次", "乡科级正职（非领导）", "15.13", 780, 2752, "2014,2016", "", "142"),
    ],
  },
  {
    id: 3, name: "王秀英", gender: "女", identity: "公务员", leader: "",
    birth: "1958年11月", edu: "大学本科毕业", studyYears: 0,
    tag: "低职套2", employ: "在职", unitId: "0001", position: "乡科级正职（非领导）",
    join: "1978年7月", gap: 1, unq: "1993-2006年期间不称职0年", tYears: 28,
    curType: "按低职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "20.5 工资 790", note: "时任职务：乡科级正职，时间2003年，间断0年，任职年限3年，退休费提高比例0%" },
    tgLow: { result: "18.8 工资 952", note: "低一职务：乡科级副职，时间1994年，间断1年，任职年限11年" },
    tgEdu: { result: "24.4 工资 425", note: "—" },
    history: [
      R("2006/7/1", "工资套改", "乡科级正职（非领导）", "18.8", 400, 952, "2006,2006", "0", "", "低职套改结果"),
      R("2007/1/1", "正常晋升档次", "乡科级正职（非领导）", "18.9", 400, 1002, "2006,2007", "", "50"),
      R("2009/1/1", "正常晋升档次", "乡科级正职（非领导）", "18.10", 400, 1056, "2006,2009", "", "54"),
      R("2011/1/1", "正常晋升档次", "乡科级正职（非领导）", "18.11", 400, 1112, "2006,2011", "", "56"),
      R("2013/1/1", "正常晋升级别", "乡科级正职（非领导）", "17.11", 400, 1150, "2013,2011", "", "38"),
      R("2014/1/1", "正常晋升档次", "乡科级正职（非领导）", "17.12", 400, 1208, "2013,2014", "", "58"),
      R("2014/10/1", "调整工资标准", "乡科级正职（非领导）", "17.12", 760, 2480, "2013,2014", "", "1632"),
      R("2016/1/1", "正常晋升档次", "乡科级正职（非领导）", "17.13", 760, 2615, "2013,2016", "", "135"),
    ],
  },
  {
    id: 4, name: "刘志远", gender: "男", identity: "公务员", leader: "",
    birth: "1962年6月", edu: "硕士研究生毕业", studyYears: 3,
    tag: "学历套", employ: "在职", unitId: "0001", position: "乡科级副职（非领导）",
    join: "1985年7月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 21,
    curType: "按学历套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "21.4 工资 645", note: "时任职务：乡科级副职，时间2001年，间断0年，任职年限5年，退休费提高比例0%" },
    tgLow: { result: "22.3 工资 590", note: "低一职务：科员，时间1996年，间断0年，任职年限10年" },
    tgEdu: { result: "19.5 工资 730", note: "学历：硕士研究生毕业，未计工龄学习3年，套改年限21年" },
    history: [
      R("2006/7/1", "工资套改", "乡科级副职（非领导）", "19.5", 360, 730, "2006,2006", "0", "", "学历套改结果"),
      R("2008/1/1", "正常晋升档次", "乡科级副职（非领导）", "19.6", 360, 772, "2006,2008", "", "42"),
      R("2010/1/1", "正常晋升档次", "乡科级副职（非领导）", "19.7", 360, 816, "2006,2010", "", "44"),
      R("2011/1/1", "滚动级别", "乡科级副职（非领导）", "18.7", 360, 848, "2011,2010", "", "32"),
      R("2012/1/1", "正常晋升档次", "乡科级副职（非领导）", "18.8", 360, 896, "2011,2012", "", "48"),
      R("2014/1/1", "正常晋升级别", "乡科级副职（非领导）", "17.8", 360, 930, "2014,2012", "", "34"),
      R("2014/10/1", "调整工资标准", "乡科级副职（非领导）", "17.8", 690, 2240, "2014,2014", "", "1640"),
      R("2016/1/1", "正常晋升档次", "乡科级副职（非领导）", "17.9", 690, 2365, "2014,2016", "", "125"),
    ],
  },
  {
    id: 5, name: "赵长顺", gender: "男", identity: "机关技术工人", leader: "",
    birth: "1960年2月", edu: "高中毕业", studyYears: 0,
    tag: "工人", employ: "在职", unitId: "0001", position: "高级工",
    join: "1978年12月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 28,
    curType: "按技术等级套改",
    tgLabels: ["按岗位套", "按等级套", "按学历套"],
    tgNow: { result: "高级工 工资 812", note: "现岗位：高级工，时间1998年，间断0年，任职年限8年" },
    tgLow: { result: "中级工 工资 745", note: "低一等级：中级工，时间1990年，间断0年，任职年限16年" },
    tgEdu: { result: "—", note: "高中及以下学历不参与学历套改" },
    history: [
      R("2006/7/1", "工资套改", "高级工", "高级工·五档", 540, 812, "2006,2006", "0"),
      R("2008/1/1", "正常晋升档次", "高级工", "高级工·六档", 540, 858, "2006,2008", "", "46"),
      R("2010/1/1", "正常晋升档次", "高级工", "高级工·七档", 540, 905, "2006,2010", "", "47"),
      R("2012/1/1", "正常晋升档次", "高级工", "高级工·八档", 540, 953, "2006,2012", "", "48"),
      R("2014/1/1", "晋升技术等级", "技师", "技师·二档", 620, 1085, "2014,2012", "", "132", "取得技师资格"),
      R("2014/10/1", "调整工资标准", "技师", "技师·二档", 880, 2150, "2014,2014", "", "1325"),
      R("2016/1/1", "正常晋升档次", "技师", "技师·三档", 880, 2268, "2014,2016", "", "118"),
    ],
  },
  {
    id: 6, name: "周晓芸", gender: "女", identity: "公务员", leader: "",
    birth: "1992年4月", edu: "大学本科毕业", studyYears: 0,
    tag: "新考录", employ: "在职", unitId: "0001", position: "科员",
    join: "2015年8月", gap: 0, unq: "无考核记录", tYears: 1,
    curType: "按现职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "25.2 工资 380", note: "时任职务：科员，时间2016年，试用期1年，任职年限0年" },
    tgLow: { result: "—", note: "无低一职务" },
    tgEdu: { result: "24.3 工资 410", note: "学历：大学本科毕业" },
    history: [
      R("2016/8/1", "转正定级", "科员", "25.2", 380, 380, "2016,2016", "0", "", "新录用人员试用期满"),
      R("2018/8/1", "正常晋升档次", "科员", "25.3", 380, 404, "2016,2018", "", "24"),
      R("2020/8/1", "正常晋升档次", "科员", "25.4", 380, 429, "2016,2020", "", "25"),
      R("2021/10/1", "调整工资标准", "科员", "25.4", 640, 915, "2016,2020", "", "746"),
      R("2022/8/1", "正常晋升档次", "科员", "25.5", 640, 962, "2016,2022", "", "47"),
      R("2024/8/1", "正常晋升档次", "科员", "25.6", 640, 1010, "2016,2024", "", "48"),
    ],
  },
  {
    id: 7, name: "孙立群", gender: "男", identity: "参公管理人员", leader: "是",
    birth: "1968年10月", edu: "大专毕业", studyYears: 0,
    tag: "管理", employ: "在职", unitId: "0001", position: "乡科级正职（领导）",
    join: "1988年7月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 18,
    curType: "按现职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "19.7 工资 830", note: "时任职务：乡科级正职，时间2004年，间断0年，任职年限2年，退休费提高比例0%" },
    tgLow: { result: "20.6 工资 768", note: "低一职务：乡科级副职，时间1998年，间断0年，任职年限8年" },
    tgEdu: { result: "24.6 工资 410", note: "—" },
    history: [
      R("2006/7/1", "工资套改", "乡科级正职（领导）", "19.7", 430, 830, "2006,2006", "0"),
      R("2008/1/1", "正常晋升档次", "乡科级正职（领导）", "19.8", 430, 878, "2006,2008", "", "48"),
      R("2010/1/1", "正常晋升档次", "乡科级正职（领导）", "19.9", 430, 927, "2006,2010", "", "49"),
      R("2012/1/1", "正常晋升档次", "乡科级正职（领导）", "19.10", 430, 977, "2006,2012", "", "50"),
      R("2014/1/1", "正常晋升级别", "乡科级正职（领导）", "18.10", 430, 1012, "2014,2012", "", "35"),
      R("2014/10/1", "调整工资标准", "乡科级正职（领导）", "18.10", 790, 2380, "2014,2014", "", "1728"),
      R("2016/1/1", "正常晋升档次", "乡科级正职（领导）", "18.11", 790, 2510, "2014,2016", "", "130"),
    ],
  },
  {
    id: 8, name: "吴海燕", gender: "女", identity: "参公专业技术人员", leader: "",
    birth: "1972年5月", edu: "大学本科毕业", studyYears: 0,
    tag: "技术", employ: "在职", unitId: "0001", position: "专业技术十级",
    join: "1994年7月", gap: 0, unq: "1993-2006年期间不称职0年", tYears: 12,
    curType: "按现职级套改",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "20.6 工资 745", note: "现任岗位：专业技术十级，时间2003年，间断0年，任职年限3年" },
    tgLow: { result: "21.5 工资 690", note: "低一岗位：专业技术十一级，时间1999年，间断0年，任职年限7年" },
    tgEdu: { result: "23.4 工资 465", note: "—" },
    history: [
      R("2006/7/1", "工资套改", "专业技术十级", "20.6", 400, 745, "2006,2006", "0"),
      R("2008/1/1", "正常晋升档次", "专业技术十级", "20.7", 400, 790, "2006,2008", "", "45"),
      R("2009/1/1", "滚动级别", "专业技术十级", "19.7", 400, 823, "2009,2008", "", "33"),
      R("2010/1/1", "正常晋升档次", "专业技术十级", "19.8", 400, 871, "2009,2010", "", "48"),
      R("2012/1/1", "正常晋升档次", "专业技术十级", "19.9", 400, 920, "2009,2012", "", "49"),
      R("2014/1/1", "正常晋升级别", "专业技术十级", "18.9", 400, 955, "2014,2012", "", "35"),
      R("2014/1/1", "正常晋升档次", "专业技术十级", "18.10", 400, 1008, "2014,2014", "", "53"),
      R("2014/10/1", "调整工资标准", "专业技术十级", "18.10", 770, 2310, "2014,2014", "", "1672"),
      R("2016/1/1", "正常晋升档次", "专业技术十级", "18.11", 770, 2438, "2014,2016", "", "128"),
    ],
  },
];

/* ---------------- 目录数据（静态参考表） ---------------- */

/* 级别工资 / 职务工资参考表已统一由 src/core（calculator.js 引擎表 + salarydata.js 2015 标准）提供，
   此处不再保留静态副本，避免双表口径漂移。 */

export const POSITION_LEVELS: { rank: string; levels: string }[] = [
  { rank: "国家级正职", levels: "一级" },
  { rank: "国家级副职", levels: "四级至二级" },
  { rank: "省部级正职", levels: "八级至四级" },
  { rank: "省部级副职", levels: "十级至六级" },
  { rank: "厅局级正职", levels: "十三级至八级" },
  { rank: "厅局级副职", levels: "十五级至十级" },
  { rank: "县处级正职", levels: "十八级至十二级" },
  { rank: "县处级副职", levels: "二十级至十四级" },
  { rank: "乡科级正职", levels: "二十二级至十六级" },
  { rank: "乡科级副职", levels: "二十四级至十七级" },
  { rank: "科员", levels: "二十六级至十八级" },
  { rank: "办事员", levels: "二十七级至十九级" },
];

/* ---------------- 津贴默认方案 ---------------- */

export interface AllowanceItem { id: string; name: string; base: string; std: number; }

export function defaultAllowances(p: Person): AllowanceItem[] {
  const tier =
    p.tag === "工人" ? "w"
      : p.position.includes("县处") ? "c"
      : p.position.includes("正") ? "a"
      : p.position.includes("副") ? "b" : "k";
  const T: Record<string, { gx: number; sh: number; tx: number }> = {
    w: { gx: 460, sh: 380, tx: 150 },
    c: { gx: 720, sh: 560, tx: 400 },
    a: { gx: 580, sh: 470, tx: 300 },
    b: { gx: 520, sh: 430, tx: 240 },
    k: { gx: 430, sh: 360, tx: 180 },
  };
  const t = T[tier];
  return [
    { id: "gx", name: "工作性津贴", base: "职务层次", std: t.gx },
    { id: "sh", name: "生活性补贴", base: "职务层次", std: t.sh },
    { id: "zf", name: "住房补贴", base: "套改年限", std: Math.round(220 + p.tYears * 8) },
    { id: "wy", name: "物业服务补贴", base: "定额", std: 80 },
    { id: "tx", name: "通讯补贴", base: "职务层次", std: t.tx },
    { id: "jn", name: "年终一次性奖金(月均)", base: "基本工资÷12", std: Math.round((lastOf(p).pw + lastOf(p).lw) / 12) },
  ];
}

export function lastOf(p: Person): SalaryRecord {
  return p.history[p.history.length - 1];
}

export const fmt = (n: number | string) =>
  n === "" || n === null || n === undefined ? "" : Number(n).toLocaleString("zh-CN");

export function yearOf(dateStr: string): number {
  return parseInt(dateStr, 10) || 0;
}

/** 级别显示格式：18.7 → 18-7（需求3，统一以连字符展示） */
export const fmtLevel = (s: string) => (s ? s.replace(/^(\d+)\.(\d+)/, "$1-$2") : s);

/** 由「人员增加」弹窗创建的人员对象（需求4：不填职务，由职务变化情况取最新值）；导入兜底时允许仅传 id/name/unitId，其余走默认值 */
export function makePerson(p: {
  id: number; name: string; idCard?: string | null;
  gender?: "男" | "女"; identity?: string;
  unitId: string; birth?: string; join?: string;
  startYear?: number; isPre2006?: boolean;
  edu?: string; tag?: string; employ?: Employ; position?: string;
  gap?: number; unq?: string;
}): Person {
  return {
    id: p.id, name: p.name, idCard: p.idCard ?? null,
    gender: p.gender ?? "男", identity: p.identity ?? "", leader: "",
    birth: p.birth ?? "", edu: p.edu ?? "大学本科毕业", studyYears: 0,
    tag: p.tag ?? (p.isPre2006 ? "普通工改" : "新考录"),
    employ: p.employ ?? "在职", unitId: p.unitId,
    position: p.position ?? "", // 职务由测算时的职务变化情况最新值确定
    join: p.join ?? "", gap: p.gap ?? 0, unq: p.unq ?? "无考核记录", tYears: 0,
    curType: "待测算",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "—", note: "待测算" },
    tgLow: { result: "—", note: "待测算" },
    tgEdu: { result: "—", note: "待测算" },
    history: [],
  };
}

/* ========================================================================== */
/*  【Spec: person-import-export-inputs-only】                                 */
/*  输入项集中类型定义 + 纯函数：采集/回写 PersonInputs 快照（FR-1/FR-2/NFR-4）  */
/* ========================================================================== */

/** 测算类型（与 calculator.ts 保持同构，避免循环引用） */
export type SnapshotCalcType = "pre2006" | "post2006";

/** 职务变化快照（与 calculator.ts PosChange 保持同构） */
export interface SnapshotPosChange {
  year: number;
  dutyIndex: number;
  reason: string;
  isInitial?: boolean;
}

/** 测算参数快照（ ≡ Omit<CalcRunInput,'endYear'> ） — 独立定义避免 data.ts↔calculator.ts 循环依赖 */
export interface CalcParamsSnapshot {
  type: SnapshotCalcType;
  startYear: number;
  educationIndex: number;
  deductYears: number;
  currentDutyIndex: number;
  currentDutyYear: number;
  lowerDutyIndex: number;
  lowerDutyYear: number;
  positionChanges: SnapshotPosChange[];
}

/** 海拔变动行（原先定义在 DetailPanel.tsx） */
export interface AltRow {
  ym: string;                    // 开始年月 "YYYY-MM"
  tier: number;                  // 海拔档次 0-3（ALT_TIERS 下标）
  type?: "month" | "year";       // 保留扩展
}

/** 考核行（原先定义在 DetailPanel.tsx） */
export interface AssessRow {
  year: number;
  result: string;                // "优秀|称职|基本称职|不称职|不定等次"
}

/** 档次参数（高套/学历浮动/…；原先定义在 SalaryPanel.tsx / modals.tsx 同名） */
export interface AddonItem {
  id: string;                    // "gaoTao" / "xueLiFloat" / "fiveYear" / "xueLiFixed" / "nian20" / "xianXiang" / 自定义
  label: string;                 // 中文展示名
  steps: number;                 // 用户档位（核心输入；金额由 steps * unit 推导，不在快照中持久化）
  unit: number;                  // 常量：25 元/档，允许后续政策调档时不改变 inputs
}

/** 津贴补贴行（原先定义在 SalaryPanel.tsx / modals.tsx 同名） */
export interface AllowanceRow {
  id: string;                    // 内置："xzMulti" / "xzAbs" / "zheSuan" / "zhuFang"；自定义：custom_xxx
  label: string;                 // 中文名称
  detail: string;                // 备注/公式描述（如"140%"）
  amount: number;                // 用户确认的金额（核心输入）
}

/** FR-1：全部 7 类用户填写数据的统一快照容器 */
export interface PersonInputs {
  /** a. 人员基本信息（从 Person 字段提炼，不含输出项） */
  basic: {
    name: string;
    idCard: string | null;
    gender: "男" | "女";
    identity: string;
    leader: string;
    birth: string;
    edu: string;
    studyYears: number;
    tag: string;
    employ: Employ;
    unitId: string;
    position: string;
    join: string;
    gap: number;
    unq: string;
  };
  /** b. 测算参数（从 gw_calc_v1_{id} 的 params 抓，故意不带 results）；若从未保存过为 null */
  params: CalcParamsSnapshot | null;
  /** c. 职务变化完整列表（已经包含在 params.positionChanges 中，这里冗余一份作为显式快照字段，便于外部直接读） */
  positionChanges: SnapshotPosChange[];
  /** d. 海拔变动完整列表（从 gw_alt_{id}） */
  altChanges: AltRow[];
  /** e. 考核情况完整列表（从 gw_assess_{id}） */
  reviews: AssessRow[];
  /** f. 档次参数（从 gw_salary_items_v1_{id}.addons；故意仅保留 id+label+steps+unit，不持久化 amount 推导值） */
  gradeAddons: AddonItem[];
  /** g. 津贴补贴（从 gw_salary_items_v1_{id}.allowances） */
  allowances: AllowanceRow[];
}

/** localStorage 读接口（UI 层注入，便于 data.ts 纯函数不直接操作 DOM/storage） */
export type ReadStorage = (key: string) => string | null;
/** localStorage 写接口 */
export type WriteStorage = (key: string, value: string) => void;

/* -------- 本地存储 key 命名（与 UI 层保持一致，集中定义避免魔法字符串） -------- */
export const LS_KEY = {
  calc: (id: number) => `gw_calc_v1_${id}`,
  items: (id: number) => `gw_salary_items_v1_${id}`,
  alt: (id: number) => `gw_alt_${id}`,
  assess: (id: number) => `gw_assess_${id}`,
} as const;

/* -------- NFR-1：空值归一（'' 或全空白 → null；0 与合法空数组保持原样） -------- */
export function sanitizeNullish<T>(v: T | "" | null | undefined): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v as T;
}
export function sanitizeArray<T>(arr: T[] | null | undefined): T[] {
  return Array.isArray(arr) ? arr : [];
}

/* -------- FR-2：剥离 Person 中所有"输出项"并回写为"待测算"占位 -------- */
export function stripOutputs(p: Person): Person {
  return {
    ...p,
    tYears: 0,
    curType: "待测算",
    tgLabels: ["按现职套", "按低职套", "按学历套"],
    tgNow: { result: "—", note: "待测算" },
    tgLow: { result: "—", note: "待测算" },
    tgEdu: { result: "—", note: "待测算" },
    history: [],
  };
}

/* -------- 构造 PersonInputs.basic 子字段 -------- */
function snapshotBasic(p: Person): PersonInputs["basic"] {
  return {
    name: p.name ?? "",
    idCard: sanitizeNullish(p.idCard),
    gender: p.gender,
    identity: p.identity ?? "",
    leader: p.leader ?? "",
    birth: p.birth ?? "",
    edu: p.edu ?? "",
    studyYears: Number.isFinite(p.studyYears) ? p.studyYears : 0,
    tag: p.tag ?? "普通工改",
    employ: p.employ ?? "在职",
    unitId: p.unitId ?? "",
    position: p.position ?? "",
    join: p.join ?? "",
    gap: Number.isFinite(p.gap) ? p.gap : 0,
    unq: p.unq ?? "无考核记录",
  };
}

/* -------- 安全 JSON 解析（NFR-1：损坏数据不抛错） -------- */
function safeParse<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/**
 * snapshotPersonInputs
 * 从 Person + 本地 storage 快照采集 FR-1 的 a-g 七类输入项（纯函数，无副作用）
 *
 * 对 UI 层传入 read: (k)=>localStorage.getItem(k)；测试时可传 Map 读写。
 */
export function snapshotPersonInputs(p: Person, read: ReadStorage): PersonInputs {
  // b. 测算参数快照：仅取 params（不含 results）
  const calcSave = safeParse<{ params?: Partial<CalcParamsSnapshot> | null }>(read(LS_KEY.calc(p.id)), {});
  const rawParams = calcSave.params ?? null;
  let params: CalcParamsSnapshot | null = null;
  if (rawParams && typeof rawParams === "object") {
    const rp = rawParams as Partial<CalcParamsSnapshot> & Record<string, unknown>;
    const pc = Array.isArray(rp.positionChanges)
      ? rp.positionChanges.map((c) => ({ year: Number(c.year) || 0, dutyIndex: Number(c.dutyIndex) || 0, reason: String(c.reason ?? ""), isInitial: !!c.isInitial }))
      : [];
    params = {
      type: rp.type === "pre2006" || rp.type === "post2006" ? rp.type : "pre2006",
      startYear: Number(rp.startYear) || 1990,
      educationIndex: Number(rp.educationIndex) || 0,
      deductYears: Math.max(0, Number(rp.deductYears) || 0),
      currentDutyIndex: Number(rp.currentDutyIndex) || 0,
      currentDutyYear: Number(rp.currentDutyYear) || 2000,
      lowerDutyIndex: Number(rp.lowerDutyIndex) || 0,
      lowerDutyYear: Number(rp.lowerDutyYear) || 1999,
      positionChanges: pc,
    };
  }

  // f/g：档次参数 + 津贴（剥离 v2 元字段；档次参数只保留 id/label/steps/unit）
  const itemsSave = safeParse<{ addons?: unknown[] | null; allowances?: unknown[] | null }>(read(LS_KEY.items(p.id)), {});
  const gradeAddons: AddonItem[] = sanitizeArray(itemsSave.addons).map((a: unknown) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? `addon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      label: String(o.label ?? "加项"),
      steps: Math.max(0, Math.round(Number(o.steps) || 0)),
      unit: Number(o.unit) > 0 ? Number(o.unit) : 25,
    };
  });
  const allowances: AllowanceRow[] = sanitizeArray(itemsSave.allowances).map((a: unknown) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      label: String(o.label ?? "津贴项"),
      detail: String(o.detail ?? ""),
      amount: Number.isFinite(o.amount) ? Number(o.amount) : 0,
    };
  });

  // d. 海拔变动
  const altRaw = sanitizeArray(safeParse<unknown[] | null>(read(LS_KEY.alt(p.id)), null));
  const altChanges: AltRow[] = altRaw
    .filter((r) => !!r && typeof (r as Record<string, unknown>).ym === "string" && Number.isFinite((r as Record<string, unknown>).tier))
    .map((r) => {
      const o = r as Record<string, unknown>;
      return { ym: String(o.ym), tier: Number(o.tier), type: (o.type === "year" || o.type === "month") ? o.type : undefined };
    });

  // e. 考核情况
  const assessRaw = sanitizeArray(safeParse<unknown[] | null>(read(LS_KEY.assess(p.id)), null));
  const reviews: AssessRow[] = assessRaw
    .filter((r) => !!r && Number.isFinite((r as Record<string, unknown>).year))
    .map((r) => {
      const o = r as Record<string, unknown>;
      return { year: Number(o.year), result: String(o.result ?? "称职") };
    });

  // c. 职务变化：直接复用 params.positionChanges 冗余一份作为显式字段（若 params===null，填空数组）
  const positionChanges: SnapshotPosChange[] = params ? params.positionChanges.map((c) => ({ ...c })) : [];

  return {
    basic: snapshotBasic(p),
    params,
    positionChanges,
    altChanges,
    reviews,
    gradeAddons,
    allowances,
  };
}

/**
 * applyPersonInputs
 * 1) 返回一个 "Person 基本字段来自 inputs.basic + 输出项已剥离" 的新 Person（id 保持不变）
 * 2) 写入 4 个 localStorage key（由 write 接口注入）：
 *    - gw_calc_v1_{id}：只写 { params }（故意不写 results，下次打开 UI 显示"待测算"）
 *    - gw_salary_items_v1_{id}：{ addons, allowances, v2: true }
 *    - gw_alt_{id}：altChanges
 *    - gw_assess_{id}：reviews
 *
 * 说明：本函数不写 history/tgNow 等结论字段（由 UI 点击"开始测算"再次 generate）。
 */
export function applyPersonInputs(p: Person, inputs: PersonInputs, write: WriteStorage): Person {
  const b = inputs.basic ?? ({} as Partial<PersonInputs["basic"]>);
  // 新 Person：id 必须保持原 id 不变；所有非输出字段取 basic；输出字段强制 stripOutputs
  const nextPerson = stripOutputs({
    ...p,
    name: b.name ?? p.name,
    idCard: sanitizeNullish(b.idCard),
    gender: b.gender ?? p.gender,
    identity: b.identity ?? p.identity,
    leader: b.leader ?? p.leader,
    birth: b.birth ?? p.birth,
    edu: b.edu ?? p.edu,
    studyYears: Number.isFinite(b.studyYears) ? b.studyYears : p.studyYears,
    tag: b.tag ?? p.tag,
    employ: (b.employ as Employ) ?? p.employ,
    unitId: b.unitId ?? p.unitId,
    position: b.position ?? p.position,
    join: b.join ?? p.join,
    gap: Number.isFinite(b.gap) ? b.gap : p.gap,
    unq: b.unq ?? p.unq,
  });

  // 测算参数（只写 params，不写 results）
  if (inputs.params) {
    write(LS_KEY.calc(p.id), JSON.stringify({ params: inputs.params }));
  } else {
    // 如果快照没有 params，则保留 calc 存档为空即可（下次 deriveParams 回退默认）
    // 为避免旧 results 污染，清空 calc key
    try { write(LS_KEY.calc(p.id), ""); } catch { /* ignore */ }
  }

  // 工资档次 + 津贴
  const addonsPayload = {
    addons: (inputs.gradeAddons ?? []).map((a) => ({ id: a.id, label: a.label, steps: a.steps, unit: a.unit })),
    allowances: (inputs.allowances ?? []).map((a) => ({ id: a.id, label: a.label, detail: a.detail, amount: a.amount })),
    v2: true as const,
  };
  write(LS_KEY.items(p.id), JSON.stringify(addonsPayload));
  write(LS_KEY.alt(p.id), JSON.stringify(inputs.altChanges ?? []));
  write(LS_KEY.assess(p.id), JSON.stringify(inputs.reviews ?? []));

  return nextPerson;
}

/* ========================================================================== */
/*  V2 导出/导入 payload 类型 & 工具函数（Task 2）                              */
/* ========================================================================== */

export interface ExportPayloadV2 {
  kind: "gw-salary-persons";
  version: 2;
  exportedAt: string;
  units: Unit[];
  persons: Array<Person & { inputs?: PersonInputs }>;
}

/** 旧版 V1 payload（向后兼容） */
export interface LegacyPayloadV1 {
  kind?: "gw-salary-persons";
  version?: 1;
  exportedAt?: string;
  units?: Unit[];
  persons?: Person[];
}

export type ParsedImportResult =
  | { version: 2; units: Unit[]; persons: Array<Person & { inputs?: PersonInputs }>; }
  | { version: 1; units: Unit[]; persons: Person[]; };

/**
 * buildExportPayload — 构造 V2 导出 payload（核心：stripOutputs + snapshotPersonInputs）
 */
export function buildExportPayload(
  selected: Person[],
  unitsAll: Unit[],
  read: ReadStorage
): ExportPayloadV2 {
  const usedUnitIds = new Set(selected.map((p) => p.unitId).filter(Boolean));
  const units = unitsAll.filter((u) => usedUnitIds.has(u.id));
  const persons = selected.map((p) => {
    const stripped = stripOutputs(p);
    const inputs = snapshotPersonInputs(p, read);
    return { ...stripped, inputs } as Person & { inputs: PersonInputs };
  });
  return {
    kind: "gw-salary-persons",
    version: 2,
    exportedAt: new Date().toLocaleString("zh-CN"),
    units,
    persons,
  };
}

/**
 * parseImportPayload — 识别 V1/V2 并归一（NFR-1：损坏数据不抛错）
 */
export function parseImportPayload(raw: unknown): ParsedImportResult {
  // 兜底：raw 不是对象
  if (!raw || typeof raw !== "object") {
    if (Array.isArray(raw)) {
      return { version: 1, units: [], persons: (raw as Person[]).filter(Boolean).map(stripOutputs) };
    }
    return { version: 1, units: [], persons: [] };
  }
  const obj = raw as LegacyPayloadV2OrArray;
  // case 1：直接 Person[]（最原始格式）
  if (Array.isArray(obj)) {
    return { version: 1, units: [], persons: obj.filter(Boolean).map(stripOutputs) as Person[] };
  }
  const version = obj.version === 2 ? 2 : 1;
  const units = Array.isArray(obj.units) ? obj.units : [];
  const persons = Array.isArray(obj.persons) ? obj.persons : [];
  if (version === 2) {
    // V2：基本 Person 字段 stripOutputs（避免旧 V2 残留的推算结果污染），但保留 inputs 附加字段
    const cleaned = persons.map((p) => {
      const base = stripOutputs(p as Person) as Person & { inputs?: PersonInputs };
      if ((p as { inputs?: PersonInputs }).inputs) base.inputs = (p as { inputs?: PersonInputs }).inputs;
      return base as Person & { inputs?: PersonInputs };
    });
    return { version: 2, units, persons: cleaned };
  }
  // V1 旧文件二次清洗：history/tYears/tg*/curType 全部回写为"待测算"占位，避免旧推算结果被当真
  return { version: 1, units, persons: persons.map((p) => stripOutputs(p as Person)) as Person[] };
}
type LegacyPayloadV2OrArray =
  | (Omit<LegacyPayloadV1, "version"> & { version?: 1 | 2; persons?: Array<Person & { inputs?: PersonInputs }>; })
  | Person[];

