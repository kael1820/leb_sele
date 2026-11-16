/* ============================================================
   纯静态展示数据（业务数据均来自后端接口）
   ============================================================ */

/* 实训室 / 导师卡片配色池，按接口返回顺序循环取色 */
const COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#f87171",
  "#60a5fa", "#fb923c", "#2dd4bf", "#fbbf24",
];

/* 流程阶段说明（展示文案，不对应实时业务数据） */
const PHASES = [
  { n: 1, title: "集中宣讲", desc: "学院组织统一宣讲，由各实训室介绍项目方向、招录名额、培养安排与考核要求", color: "#34d399" },
  { n: 2, title: "实训室开放日", desc: "学生实地走访实训室，与导师、高年级学生交流，了解项目氛围和培养方式", color: "#34d399" },
  { n: 3, title: "意向填报", desc: "学生最多填报 3 个平行导师意向，不分志愿先后；同时选择是否服从实训室内 / 全院调剂", color: "#fb923c" },
  { n: 4, title: "导师初选与面试", desc: "以实训室为单位统一组织面试，无论报名人数是否满额，所有报名学生均参加", color: "#fb923c" },
  { n: 5, title: "拟录取与学生确认", desc: "仅收到 1 个拟录取意向的自动确认；收到 2 个及以上的在规定时间内自主选择唯一去向", color: "#60a5fa" },
  { n: 6, title: "分轮补录", desc: "学院公布剩余名额，未录取学生重新填报志愿；实训室统一组织面试、双向确认与顺位递补，依次完成第二轮和第三轮补录", color: "#60a5fa" },
  { n: 7, title: "统筹调剂录取", desc: "三轮补录后剩余名额纳入全院调剂池，按优先级统筹安排：实训室内 → 全院实训室 → 约谈未服从调剂学生并作最终统筹", color: "#2dd4bf" },
  { n: 8, title: "结果公示与正式入组", desc: "学院汇总最终录取名单并公示，公示无异议后，学生正式加入实训室开展 AI+PBL 项目实训", color: "#2dd4bf" },
];

/* 阶段名 → 展示文案（后端同时返回 stageText，此处用于兜底与阶段排序） */
const STAGE_TEXT = {
  CHOICE_OPEN: "志愿填报",
  CHOICE_CLOSED: "志愿关闭",
  INTERVIEW: "面试",
  TEACHER_PICK: "老师选学生",
  STUDENT_FINAL: "学生终选",
  DIVERSION: "调剂分流",
  COMPLETED: "本轮完成",
};

const STAGE_ORDER = [
  "CHOICE_OPEN", "CHOICE_CLOSED", "INTERVIEW",
  "TEACHER_PICK", "STUDENT_FINAL", "DIVERSION", "COMPLETED",
];

/* 阶段 → 学生流程时间线序号 */
const STAGE_STEP = {
  CHOICE_OPEN: 3,
  CHOICE_CLOSED: 4,
  INTERVIEW: 4,
  TEACHER_PICK: 5,
  STUDENT_FINAL: 5,
  DIVERSION: 6,
  COMPLETED: 8,
};

const MATCH_SOURCE_TEXT = {
  1: "正常匹配",
  2: "调剂老师选择",
  3: "系统统筹",
  4: "待选池人工安置",
};

const MATCH_SOURCE_TAG = {
  1: "green",
  2: "blue",
  3: "teal",
  4: "amber",
};

const INTERVIEW_STATUS_TEXT = {
  0: "待安排",
  1: "已安排",
  2: "已完成",
  3: "已取消",
};

const INTERVIEW_STATUS_TAG = {
  0: "gray",
  1: "amber",
  2: "green",
  3: "red",
};

const WAITPOOL_STATUS_TEXT = {
  0: "待约谈",
  1: "已约谈",
  2: "已安置",
};

const WAITPOOL_STATUS_TAG = {
  0: "red",
  1: "amber",
  2: "green",
};
