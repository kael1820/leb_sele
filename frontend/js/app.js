/* ============================================================
   应用入口：登录门禁、角色切换、路由与异步数据加载
   ============================================================ */

const State = {
  role: "student",
  view: "dashboard",
  user: null,
  currentUser: {
    student: { name: "—", id: "—" },
    teacher: { name: "—", id: "—" },
    admin: { name: "—", id: "—" },
  },

  /* 公共流程 */
  flow: null,

  /* 学生端 */
  status: null,
  student: null,
  stage: null,
  roundInfo: null,
  rooms: [],
  teachers: [],
  choices: [],
  volunteers: [],
  wish: { allowInternal: 0, allowCrossRoom: 0 },
  pickLocked: false,
  pickLockReason: "",
  interviews: [],
  pickers: [],
  needFinal: false,
  finalChoice: null,
  finalSelection: null,
  result: null,
  matched: null,
  waitPool: null,

  /* 教师端 */
  profile: null,
  candidates: [],
  picks: [],
  teacherInterviews: [],
  diversionCandidates: [],
  diversionStageOk: false,
  diversionError: "",
  admitted: [],

  /* 管理端 */
  summary: null,
  byRoom: [],
  adminRooms: [],
  teacherPage: null,
  studentPage: null,
  adminUi: {
    tab: "teachers",
    teacher: { page: 1, size: 8, keyword: "" },
    student: { page: 1, size: 8, keyword: "" },
  },
  flowOverview: null,
  lastAdvance: null,
  allocateRoundId: null,
  allocateRound: null,
  adminDiversion: [],
  lastSystemPlace: null,
  adminConfig: [],
  waitPoolAll: [],
  waitPoolList: [],
  waitPoolFilter: null,
};

const NAV = {
  student: [
    { group: "我的选择", items: [
      { id: "dashboard", label: "概览" },
      { id: "pick", label: "志愿填报" },
      { id: "interview", label: "面试安排" },
      { id: "final", label: "导师确认" },
      { id: "result", label: "录取结果" },
    ] },
  ],
  teacher: [
    { group: "导师工作台", items: [
      { id: "dashboard", label: "概览" },
      { id: "candidates", label: "候选人管理" },
      { id: "adjustment", label: "调剂选人" },
      { id: "admitted", label: "录取名单" },
    ] },
  ],
  admin: [
    { group: "运营管理", items: [
      { id: "dashboard", label: "数据总览" },
      { id: "data", label: "基础数据" },
      { id: "flow", label: "流程控制" },
      { id: "allocate", label: "统筹调剂" },
      { id: "waitpool", label: "待选池" },
      { id: "config", label: "系统配置" },
    ] },
  ],
};

const VIEW_LOADERS = {};
const VIEW_BINDERS = {};

/* ---------- 基础工具 ---------- */

const $ = (sel) => document.querySelector(sel);

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tag(text, color) {
  return '<span class="tag tag--' + (color || "gray") + '">' + esc(text) + "</span>";
}

function fmtTime(v) {
  if (!v) return "—";
  return String(v).replace("T", " ").slice(0, 16);
}

function toApiDateTime(v) {
  if (!v) return "";
  let s = String(v).replace("T", " ");
  if (s.length === 16) s += ":00";
  return s;
}

function stageText(name) {
  if (!name) return "流程未进行";
  return STAGE_TEXT[name] || name;
}

function findTeacher(id) {
  return (State.teachers || []).find((t) => String(t.id) === String(id)) || null;
}

function roomColorByRoomId(roomId) {
  const idx = (State.rooms || []).findIndex((r) => String(r.id) === String(roomId));
  return COLORS[(idx >= 0 ? idx : 0) % COLORS.length];
}

function matchSourceLabel(code) {
  return MATCH_SOURCE_TEXT[code] || "未知来源";
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("is-show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove("is-show"), 3000);
}

function openModal(html) {
  const modal = $("#modal");
  modal.innerHTML = html;
  modal.classList.add("is-open");
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

function closeModal() {
  const modal = $("#modal");
  modal.classList.remove("is-open");
  modal.innerHTML = "";
}

/* ---------- 登录状态 ---------- */

function roleKey(role) {
  return Number(role) === 2 ? "teacher" : Number(role) === 3 ? "admin" : "student";
}

function applyUser(user) {
  State.user = user;
  const role = roleKey(user.role);
  const id = user.studentNo || user.teacherNo || user.username || "—";
  State.currentUser[role] = { name: user.realName || user.username || "—", id };
  updateUserChip();
}

function updateUserChip() {
  const user = State.user;
  if (!user) {
    $("#userAvatar").textContent = "—";
    $("#userName").textContent = "未登录";
    $("#userId").textContent = "—";
    return;
  }
  const role = roleKey(user.role);
  $("#userAvatar").textContent = (user.realName || user.username || "?").slice(0, 1);
  $("#userName").textContent = user.realName || user.username;
  $("#userId").textContent = State.currentUser[role].id + " · " +
    (role === "student" ? "学生" : role === "teacher" ? "教师" : "管理员");
}

function updateRoundChip() {
  const chip = $("#roundValue");
  if (!chip) return;
  const flow = State.flow;
  const status = State.status;
  const round = (flow && flow.currentRound) || (status && status.round) || null;
  const stage = (flow && flow.currentStage) || (status && status.stage) || null;
  if (round && stage) {
    chip.textContent = "第 " + round.roundNo + " 轮 · " + (stage.stageText || stageText(stage.stageName));
  } else if (round) {
    chip.textContent = round.name + " · " + (round.roundStatusText || "进行中");
  } else if (status && status.status) {
    chip.textContent = status.status.text || "流程已结束";
  } else {
    chip.textContent = "流程未进行";
  }
}

function showLoginGate(message) {
  const gate = $("#loginGate");
  if (!gate) return;
  gate.classList.remove("is-hidden");
  $("#loginError").textContent = message || "";
  setTimeout(() => {
    const input = $("#loginUsername");
    if (input) input.focus();
  }, 60);
}

function hideLoginGate() {
  const gate = $("#loginGate");
  if (gate) gate.classList.add("is-hidden");
  $("#loginError").textContent = "";
}

let unauthorizedLock = false;
let loggingOut = false;
function handleUnauthorized() {
  if (unauthorizedLock || loggingOut) return;
  unauthorizedLock = true;
  api.clearSession();
  State.user = null;
  updateUserChip();
  showLoginGate("登录已失效，请重新登录");
  setTimeout(() => { unauthorizedLock = false; }, 600);
}

function resetDataState() {
  State.flow = null;
  State.status = null;
  State.student = null;
  State.stage = null;
  State.roundInfo = null;
  State.rooms = [];
  State.teachers = [];
  State.choices = [];
  State.volunteers = [];
  State.wish = { allowInternal: 0, allowCrossRoom: 0 };
  State.pickLocked = false;
  State.pickLockReason = "";
  State.interviews = [];
  State.pickers = [];
  State.needFinal = false;
  State.finalChoice = null;
  State.finalSelection = null;
  State.result = null;
  State.matched = null;
  State.waitPool = null;
  State.profile = null;
  State.candidates = [];
  State.picks = [];
  State.teacherInterviews = [];
  State.diversionCandidates = [];
  State.diversionStageOk = false;
  State.diversionError = "";
  State.admitted = [];
  State.summary = null;
  State.byRoom = [];
  State.adminRooms = [];
  State.teacherPage = null;
  State.studentPage = null;
  State.flowOverview = null;
  State.lastAdvance = null;
  State.allocateRoundId = null;
  State.allocateRound = null;
  State.adminDiversion = [];
  State.lastSystemPlace = null;
  State.waitPoolAll = [];
  State.waitPoolList = [];
  State.waitPoolFilter = null;
  State.adminConfig = [];
  State.adminUi = {
    tab: "teachers",
    teacher: { page: 1, size: 8, keyword: "" },
    student: { page: 1, size: 8, keyword: "" },
  };
}

async function refreshFlow() {
  try {
    State.flow = await api.request("/public/flow");
  } catch (e) {
    State.flow = null;
  }
}

async function bootstrapSession() {
  if (!api.getToken()) {
    showLoginGate();
    return;
  }
  try {
    const user = await api.me();
    applyUser(user);
    resetDataState();
    await refreshFlow();
    hideLoginGate();
    const role = roleKey(user.role);
    switchRoleView(role);
  } catch (e) {
    api.clearSession();
    State.user = null;
    updateUserChip();
    showLoginGate(e.code === 401 ? "登录已失效，请重新登录" : e.message);
  }
}

let loginBusy = false;

async function doLogin(username, password, btn) {
  if (loginBusy) return;
  const uname = String(username || "").trim();
  if (!uname || !password) {
    $("#loginError").textContent = "请输入用户名和密码";
    return;
  }
  loginBusy = true;
  const button = btn || $("#loginBtn");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "登录中…";
  $("#loginError").textContent = "";
  try {
    const user = await api.login(uname, password);
    applyUser(user);
    resetDataState();
    await refreshFlow();
    hideLoginGate();
    switchRoleView(roleKey(user.role));
    toast("欢迎回来，" + (user.realName || user.username));
  } catch (e) {
    $("#loginError").textContent = e.message;
    toast(e.message);
  } finally {
    loginBusy = false;
    button.disabled = false;
    button.textContent = label;
  }
}

const DEMO_ACCOUNTS = { student: "S-A01", teacher: "T-SD01", admin: "admin" };

async function switchDemoRole(role, btn) {
  if (loginBusy) return;
  const username = DEMO_ACCOUNTS[role];
  if (!username) return;
  loginBusy = true;
  if (btn) btn.disabled = true;
  try {
    const user = await api.login(username, "123456");
    applyUser(user);
    resetDataState();
    await refreshFlow();
    hideLoginGate();
    switchRoleView(roleKey(user.role));
    toast("已切换演示账号：" + username + " · " + (user.realName || ""));
  } catch (e) {
    toast(e.message);
    if (!api.getToken()) showLoginGate(e.message);
  } finally {
    loginBusy = false;
    if (btn) btn.disabled = false;
  }
}

async function doLogout() {
  loggingOut = true;
  renderSeq++;
  await api.logout();
  State.user = null;
  resetDataState();
  updateUserChip();
  State.role = "student";
  State.view = "dashboard";
  syncRoleSwitch("student");
  renderSidebar();
  showLoginGate();
  toast("已退出登录");
  setTimeout(() => { loggingOut = false; }, 800);
}

/* ---------- 路由渲染 ---------- */

function switchRoleView(role) {
  State.role = role;
  State.view = "dashboard";
  syncRoleSwitch(role);
  updateUserChip();
  renderSidebar();
  renderView();
}

/** 登录后只显示当前角色入口，其余角色隐藏且不可切换；退出登录后恢复 */
function syncRoleSwitch(activeRole) {
  const loggedIn = !!State.user;
  document.querySelectorAll(".role-btn").forEach((b) => {
    const active = b.dataset.role === activeRole;
    b.classList.toggle("is-active", active);
    b.classList.toggle("is-locked", loggedIn);
    b.style.display = loggedIn && !active ? "none" : "";
  });
}

function renderSidebar() {
  const groups = NAV[State.role] || [];
  const html = groups.map((group) =>
    '<div class="sidebar__group">' +
      '<div class="sidebar__label">' + esc(group.group) + "</div>" +
      group.items.map((item) =>
        '<button class="nav-item' + (State.view === item.id ? " is-active" : "") +
        '" data-view="' + item.id + '">' +
          '<span class="nav-item__dot"></span>' + esc(item.label) +
        "</button>"
      ).join("") +
    "</div>"
  ).join("");
  $("#sidebar").innerHTML = html;
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.onclick = () => {
      if (State.view === b.dataset.view) return;
      State.view = b.dataset.view;
      renderSidebar();
      renderView();
    };
  });
}

function skeletonHTML() {
  return (
    '<div class="view-head"><div class="skeleton skeleton--title"></div>' +
      '<div class="skeleton skeleton--sub mt-sm"></div></div>' +
    '<div class="grid grid-4 mb">' +
      [0, 1, 2, 3].map(() =>
        '<div class="card card--pad"><div class="skeleton skeleton--line" style="width:45%"></div>' +
        '<div class="skeleton skeleton--num"></div>' +
        '<div class="skeleton skeleton--line" style="width:70%"></div></div>'
      ).join("") +
    "</div>" +
    '<div class="card card--pad"><div class="skeleton skeleton--line" style="width:30%"></div>' +
      '<div class="skeleton skeleton--block"></div></div>'
  );
}

function errorHTML(message) {
  return (
    '<div class="view-head"><div class="view-head__eyebrow">加载失败</div>' +
      '<h1 class="view-head__title">暂时无法获取数据</h1>' +
      '<p class="view-head__desc">' + esc(message) + "</p></div>" +
    '<div class="card card--pad empty-state">' +
      '<div class="empty-state__icon">!</div>' +
      '<div class="empty-state__title">接口请求未成功</div>' +
      '<div class="empty-state__text">请确认后端服务已启动，或稍后重试。</div>' +
      '<button class="btn btn--ghost mt" id="retryView">重新加载</button></div>'
  );
}

let renderSeq = 0;

/** 仅重绘当前视图（不重新请求接口），用于本地选中态 */
function repaintCurrentView() {
  const main = $("#main");
  const views = State.role === "student" ? STUDENT_VIEWS
    : State.role === "teacher" ? TEACHER_VIEWS : ADMIN_VIEWS;
  const fn = views ? views[State.view] : null;
  if (!fn) return;
  main.innerHTML = fn();
  updateUserChip();
  updateRoundChip();
  const key = State.role + ":" + State.view;
  if (typeof VIEW_BINDERS[key] === "function") VIEW_BINDERS[key]();
}

async function renderView() {
  const main = $("#main");
  const seq = ++renderSeq;
  main.innerHTML = skeletonHTML();
  const key = State.role + ":" + State.view;
  const loader = VIEW_LOADERS[key];
  try {
    if (loader) await loader();
    if (seq !== renderSeq) return;
    const views = State.role === "student" ? STUDENT_VIEWS
      : State.role === "teacher" ? TEACHER_VIEWS : ADMIN_VIEWS;
    const fn = views ? views[State.view] : null;
    main.innerHTML = fn ? fn() : '<div class="empty-state">页面建设中</div>';
    updateUserChip();
    updateRoundChip();
    if (typeof VIEW_BINDERS[key] === "function") VIEW_BINDERS[key]();
  } catch (e) {
    if (seq !== renderSeq) return;
    main.innerHTML = errorHTML(e.message || "加载失败");
    updateRoundChip();
    const retry = $("#retryView");
    if (retry) retry.onclick = () => renderView();
    toast(e.message || "加载失败");
  }
}

/* ---------- 初始化 ---------- */

function init() {
  api.onUnauthorized = handleUnauthorized;

  document.querySelectorAll(".role-btn").forEach((btn) => {
    btn.onclick = () => {
      if (State.user) return; // 已登录时禁止切换角色
      switchDemoRole(btn.dataset.role, btn);
    };
  });
  document.querySelectorAll(".demo-login").forEach((btn) => {
    btn.onclick = () => doLogin(btn.dataset.username, "123456", btn);
  });

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    doLogin($("#loginUsername").value, $("#loginPassword").value, $("#loginBtn"));
  });
  $("#logoutBtn").onclick = doLogout;

  bootstrapSession();
}

document.addEventListener("DOMContentLoaded", init);
