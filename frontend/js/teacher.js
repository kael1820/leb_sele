/* ============================================================
   教师端：概览 / 候选人管理 / 调剂选人 / 录取名单
   ============================================================ */

const TEACHER_VIEWS = {};

/* ---------- 数据加载 ---------- */

VIEW_LOADERS["teacher:dashboard"] = async function () {
  const [profile, flow, candidates, picks] = await Promise.all([
    api.request("/teacher/profile"),
    api.request("/public/flow"),
    api.request("/teacher/candidates"),
    api.request("/teacher/picks"),
  ]);
  State.profile = profile;
  State.flow = flow;
  State.candidates = candidates || [];
  State.picks = picks || [];
};

VIEW_LOADERS["teacher:candidates"] = async function () {
  const [profile, candidates, interviews, picks, flow] = await Promise.all([
    api.request("/teacher/profile"),
    api.request("/teacher/candidates"),
    api.request("/teacher/interviews"),
    api.request("/teacher/picks"),
    api.request("/public/flow"),
  ]);
  State.profile = profile;
  State.candidates = candidates || [];
  State.teacherInterviews = interviews || [];
  State.picks = flow.currentRound
    ? (picks || []).filter((p) => String(p.roundId) === String(flow.currentRound.id))
    : (picks || []);
  State.flow = flow;

  const map = {};
  State.teacherInterviews.forEach((it) => {
    const key = String(it.studentId);
    if (!map[key] || Number(it.id) > Number(map[key].id)) map[key] = it;
  });
  State.interviewMap = map;
  State.pickedIds = State.picks.map((p) => String(p.studentId));
};

VIEW_LOADERS["teacher:adjustment"] = async function () {
  const [profile, picks] = await Promise.all([
    api.request("/teacher/profile"),
    api.request("/teacher/picks"),
  ]);
  State.profile = profile;
  State.picks = picks || [];
  try {
    State.diversionCandidates = await api.request("/teacher/diversion/candidates");
    State.diversionStageOk = true;
    State.diversionError = "";
  } catch (e) {
    if (e.code !== 409) throw e;
    State.diversionCandidates = [];
    State.diversionStageOk = false;
    State.diversionError = e.message;
  }
};

VIEW_LOADERS["teacher:admitted"] = async function () {
  const [students, profile] = await Promise.all([
    api.request("/teacher/students"),
    api.request("/teacher/profile"),
  ]);
  State.admitted = students || [];
  State.profile = profile;
};

/* ---------- 辅助 ---------- */

function currentStage() {
  return (State.flow && State.flow.currentStage) || null;
}

function stageNameText() {
  const s = currentStage();
  return s ? (s.stageText || stageText(s.stageName)) : "流程未进行";
}

function currentRoundOfFlow() {
  const flow = State.flow;
  if (!flow) return null;
  return flow.currentRound || null;
}

function stageStatusTag(status, text) {
  const color = Number(status) === 1 ? "cyan" : Number(status) === 2 ? "green" : "gray";
  return tag(text || (Number(status) === 1 ? "进行中" : Number(status) === 2 ? "已结束" : "未开始"), color);
}

/* ---------- 概览 ---------- */

TEACHER_VIEWS.dashboard = function () {
  const p = State.profile || {};
  const quota = Number(p.quota || 0);
  const used = Number(p.used || 0);
  const remaining = Number(p.remaining || 0);
  const candidates = State.candidates || [];
  const picks = State.picks || [];
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const round = currentRoundOfFlow();
  const stages = (round && round.stages) || [];
  const stage = currentStage();

  const stats =
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">名额上限</div><div class="stat__value">' + quota +
        '</div><div class="stat__delta">导师招生名额</div><div class="stat__ic">◎</div></div>' +
      '<div class="stat"><div class="stat__label">已录取</div><div class="stat__value">' + used +
        '</div><div class="stat__delta">已确认匹配学生</div><div class="stat__ic">✓</div></div>' +
      '<div class="stat"><div class="stat__label">剩余名额</div><div class="stat__value">' + remaining +
        '</div><div class="stat__delta">' + (remaining <= 0 ? "名额已满" : "可继续选择") + '</div><div class="stat__ic">◇</div></div>' +
      '<div class="stat"><div class="stat__label">本轮候选生</div><div class="stat__value">' + candidates.length +
        '</div><div class="stat__delta">选你为志愿的学生</div><div class="stat__ic">◈</div></div>' +
    "</div>";

  const stageRows = stages.length
    ? stages.map((s) =>
        '<div class="phase-row"><div class="phase-row__num">' + s.stageOrder + "</div>" +
          '<div style="flex:1"><div class="teacher-name">' + esc(s.stageText || stageText(s.stageName)) + "</div>" +
            '<div class="card__sub">' + esc(s.remark || "") + "</div></div>" +
          stageStatusTag(s.stageStatus, s.stageStatusText) +
        "</div>"
      ).join("")
    : '<div class="empty-state"><div class="empty-state__title">暂无轮次数据</div></div>';

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Teacher · Overview</div>' +
      '<h1 class="view-head__title">' + esc(p.realName || "老师") + " 的工作台</h1>" +
      '<p class="view-head__desc">' + esc(p.roomName || "") + " · " + esc(p.researchDirection || "") + "</p>" +
    "</div>" + stats +
    '<div class="grid grid-2">' +
      '<div class="card">' +
        '<div class="flex-between mb-sm"><div class="card__title">选拔进度</div>' +
          '<span class="tag tag--cyan">' + esc(stage ? (stage.stageText || stageText(stage.stageName)) : "流程未进行") + "</span></div>" +
        '<div class="card__sub mb">' + esc(round ? round.name : "暂无进行中的轮次") +
          (round ? " · " + esc(round.roundStatusText || "") : "") + "</div>" +
        '<div class="progress mb-sm"><div class="progress__fill" style="width:' + pct + '%"></div></div>' +
        '<div class="flex-between card__sub mb"><span>已录取 ' + used + " / " + quota + "</span><span>" + pct + "%</span></div>" +
        '<div class="divider"></div>' +
        '<div class="flex-between mb-sm"><span class="soft">本轮候选人</span><span class="mono">' + candidates.length + "</span></div>" +
        '<div class="flex-between mb-sm"><span class="soft">已选学生（全部轮次）</span><span class="mono">' + picks.length + "</span></div>" +
        '<div class="flex-between"><span class="soft">剩余名额</span><span class="mono">' + remaining + "</span></div>" +
      "</div>" +
      '<div class="card">' +
        '<div class="card__title mb-sm">当前轮次阶段</div>' +
        '<div class="card__sub mb">' + esc(round ? round.name : "暂无进行中的轮次") + "</div>" +
        stageRows +
      "</div>" +
    "</div>" +
    '<div class="card mt">' +
      '<div class="card__title mb-sm">导师档案</div>' +
      '<div class="grid grid-3 mt-sm">' +
        '<div><div class="stat__label">职称</div><div class="soft">' + esc(p.title || "—") + "</div></div>" +
        '<div><div class="stat__label">实训室</div><div class="soft">' + esc(p.roomName || "—") + "</div></div>" +
        '<div><div class="stat__label">研究方向</div><div class="soft">' + esc(p.researchDirection || "—") + "</div></div>" +
      "</div>" +
      (p.bio ? '<div class="card__sub mt">' + esc(p.bio) + "</div>" : "") +
    "</div>"
  );
};

/* ---------- 候选人管理 ---------- */

TEACHER_VIEWS.candidates = function () {
  const p = State.profile || {};
  const candidates = State.candidates || [];
  const interviewed = Object.keys(State.interviewMap || {}).length;
  const stage = currentStage();
  const canPick = !!stage && stage.stageName === "TEACHER_PICK";

  const rows = candidates.map((c) => {
    const iv = (State.interviewMap || {})[String(c.studentId)] || null;
    const picked = (State.pickedIds || []).indexOf(String(c.studentId)) >= 0;
    const avg = c.avgScore != null ? Number(c.avgScore).toFixed(1) : "—";
    return "<tr>" +
      '<td><div class="teacher-name">' + esc(c.studentName) + "</div>" +
        '<div class="card__sub mono">' + esc(c.studentNo) + "</div></td>" +
      "<td>" + esc(c.major || "—") + '<div class="card__sub">' + esc(c.className || "") + "</div></td>" +
      '<td class="mono">' + avg + "</td>" +
      "<td>" + (iv
        ? tag("面试 " + (iv.score != null ? Number(iv.score).toFixed(1) : "未评分"),
            iv.score != null ? "blue" : "amber") +
          '<div class="card__sub">' + esc(fmtTime(iv.interviewTime)) + "</div>"
        : tag("未安排", "gray")) + "</td>" +
      "<td>" + (iv
        ? '<div class="flex gap-sm"><input class="input" style="width:76px" id="score-' + c.studentId +
            '" type="number" min="0" max="100" step="0.5" value="' + (iv.score != null ? iv.score : "") +
            '" placeholder="0-100"><button class="btn btn--ghost btn--sm" data-save-score="' + iv.id +
            '" data-student-id="' + c.studentId + '" type="button">保存</button></div>'
        : '<button class="btn btn--ghost btn--sm" data-schedule="' + c.studentId +
            '" data-name="' + esc(c.studentName) + '" type="button">安排面试</button>') + "</td>" +
      "<td>" + (picked
        ? '<button class="btn btn--danger btn--sm" data-unpick="' + c.studentId +
            '" type="button" ' + (canPick ? "" : "disabled") + ">撤销暂选</button>"
        : '<button class="btn btn--primary btn--sm" data-pick="' + c.studentId +
            '" type="button" ' + (canPick ? "" : "disabled") + ">选择学生</button>") + "</td>" +
    "</tr>";
  }).join("");

  const empty = '<tr><td colspan="6"><div class="empty-state">' +
    '<div class="empty-state__icon">◇</div>' +
    '<div class="empty-state__title">当前轮次暂无候选生</div>' +
    '<div class="empty-state__text">' +
      esc(stage ? "当前阶段为「" + stageNameText() + "」，学生志愿提交后会显示在这里。"
        : "当前没有进行中的轮次，暂无候选学生。") +
    "</div></div></td></tr>";

  const notice = '<div class="notice' + (canPick ? "" : " notice--warn") + '">' +
    "<strong>当前阶段：" + esc(stageNameText()) + "。</strong> " +
    (canPick ? "可选学生或撤销暂选；评分与面试安排不受阶段限制。"
      : "仅「老师选学生」阶段可以执行选择/撤销操作。") + "</div>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Teacher · Candidates</div>' +
      '<h1 class="view-head__title">候选人管理</h1>' +
      '<p class="view-head__desc">仅显示本轮选择你作为志愿的学生；面试成绩与导师评分会实时写回系统。</p>' +
    "</div>" + notice +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">候选人数</div><div class="stat__value">' + candidates.length + "</div></div>" +
      '<div class="stat"><div class="stat__label">已安排面试</div><div class="stat__value">' + interviewed + "</div></div>" +
      '<div class="stat"><div class="stat__label">已选学生</div><div class="stat__value">' + (State.picks || []).length + "</div></div>" +
      '<div class="stat"><div class="stat__label">剩余名额</div><div class="stat__value">' + Number(p.remaining || 0) + "</div></div>" +
    "</div>" +
    '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">候选学生名单</div>' +
      '<span class="card__sub">' + esc(p.roomName || "") + " · 名额 " + Number(p.quota || 0) + "</span></div>" +
      '<div class="table-wrap"><table><thead><tr>' +
        "<th>学生</th><th>专业 / 班级</th><th>志愿均分</th><th>面试安排</th><th>导师评分</th><th>操作</th>" +
      "</tr></thead><tbody>" + (candidates.length ? rows : empty) + "</tbody></table></div>" +
    "</div>"
  );
};

VIEW_BINDERS["teacher:candidates"] = function () {
  const stage = currentStage();
  const canPick = !!stage && stage.stageName === "TEACHER_PICK";

  document.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (!canPick) {
        toast("当前阶段为「" + stageNameText() + "」，仅老师选学生阶段可选");
        return;
      }
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "选择中…";
      try {
        await api.request("/teacher/picks", {
          method: "POST",
          body: { studentId: Number(btn.dataset.pick) },
        });
        toast("已选择该学生");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  document.querySelectorAll("[data-unpick]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (!canPick) {
        toast("当前阶段为「" + stageNameText() + "」，仅老师选学生阶段可操作");
        return;
      }
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "撤销中…";
      try {
        await api.request("/teacher/picks/" + btn.dataset.unpick, { method: "DELETE" });
        toast("已撤销暂选");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  document.querySelectorAll("[data-save-score]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      const input = $("#score-" + btn.dataset.studentId);
      const val = input ? input.value.trim() : "";
      if (val === "") {
        toast("请填写面试成绩");
        return;
      }
      const score = Number(val);
      if (!isFinite(score) || score < 0 || score > 100) {
        toast("面试成绩应在 0~100 之间");
        return;
      }
      const iv = (State.teacherInterviews || []).find((it) => String(it.id) === String(btn.dataset.saveScore));
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "保存中…";
      try {
        await api.request("/teacher/interviews/" + btn.dataset.saveScore, {
          method: "PUT",
          body: { score: score, feedback: iv ? iv.feedback : null },
        });
        toast("评分已保存");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  document.querySelectorAll("[data-schedule]").forEach((btn) => {
    btn.onclick = () => openScheduleModal(btn.dataset.schedule, btn.dataset.name);
  });
};

function openScheduleModal(studentId, name) {
  const p = State.profile || {};
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":00";

  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">安排面试</div>' +
      '<div class="modal__sub">学生：' + esc(name || "") + "</div>" +
      '<div class="field"><label class="field__label">面试时间</label>' +
        '<input class="input" type="datetime-local" id="ivTime" value="' + value + '"></div>' +
      '<div class="field"><label class="field__label">面试地点</label>' +
        '<input class="input" id="ivLocation" placeholder="如 SD 实训室 A301" value="' +
          esc(p.roomName ? p.roomName + " 面试室" : "") + '"></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" id="ivCancel" type="button">取消</button>' +
        '<button class="btn btn--primary" id="ivConfirm" type="button">确认安排</button>' +
      "</div>" +
    "</div>"
  );

  $("#ivCancel").onclick = closeModal;
  $("#ivConfirm").onclick = async () => {
    const time = $("#ivTime").value;
    const location = $("#ivLocation").value.trim();
    if (!time) {
      toast("请选择面试时间");
      return;
    }
    const btn = $("#ivConfirm");
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "提交中…";
    try {
      await api.request("/teacher/interviews", {
        method: "POST",
        body: {
          studentId: Number(studentId),
          interviewTime: toApiDateTime(time),
          location: location || null,
        },
      });
      closeModal();
      toast("面试已安排");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = label;
    }
  };
}

/* ---------- 调剂选人 ---------- */

TEACHER_VIEWS.adjustment = function () {
  const p = State.profile || {};
  const list = State.diversionCandidates || [];
  const picks = State.picks || [];
  const internal = list.filter((c) => Number(c.allowInternal) === 1).length;
  const cross = list.filter((c) => Number(c.allowCrossRoom) === 1).length;
  const pickedDiversion = picks.filter((x) => Number(x.pickSource) === 2).length;

  const notice = State.diversionStageOk
    ? '<div class="notice"><strong>调剂阶段开放中。</strong> 点击学生卡片将立即录取该学生，请确认名额后再操作。</div>'
    : '<div class="notice notice--warn"><strong>当前不可调剂选人。</strong> ' +
      esc(State.diversionError || "仅调剂分流阶段可以操作") + "</div>";

  const cards = list.map((c) => {
    const scope = [Number(c.allowInternal) === 1 ? "实训室内" : "",
      Number(c.allowCrossRoom) === 1 ? "跨实训室" : ""].filter(Boolean).join(" · ") || "未服从调剂";
    return '<div class="card card--hover mb-sm" data-diversion="' + c.studentId + '">' +
      '<div class="flex-between">' +
        '<div><div class="teacher-name">' + esc(c.studentName) + "</div>" +
          '<div class="card__sub mono">' + esc(c.studentNo) + " · " + esc(c.major || "") + " " + esc(c.className || "") + "</div></div>" +
        '<div style="text-align:right">' + tag(scope, Number(c.allowCrossRoom) === 1 ? "purple" : "blue") +
          '<div class="card__sub mt-sm">志愿均分 ' + (c.avgScore != null ? Number(c.avgScore).toFixed(1) : "—") + "</div></div>" +
      "</div>" +
      (c.statusText ? '<div class="card__sub mt-sm">状态：' + esc(c.statusText) + "</div>" : "") +
    "</div>";
  }).join("");

  const empty = '<div class="card empty-state">' +
    '<div class="empty-state__icon">⇄</div>' +
    '<div class="empty-state__title">暂无调剂候选学生</div>' +
    '<div class="empty-state__text">' + esc(State.diversionStageOk
      ? "当前没有符合你实训室调剂范围且服从调剂的学生。"
      : "进入调剂分流阶段后，这里会列出可接收的学生。") + "</div></div>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Teacher · Diversion</div>' +
      '<h1 class="view-head__title">调剂选人</h1>' +
      '<p class="view-head__desc">调剂阶段可接收未录取且服从调剂的学生，选择后立即占用名额并完成录取。</p>' +
    "</div>" + notice +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">剩余名额</div><div class="stat__value">' + Number(p.remaining || 0) + "</div></div>" +
      '<div class="stat"><div class="stat__label">可选调剂生</div><div class="stat__value">' + list.length + "</div></div>" +
      '<div class="stat"><div class="stat__label">实训室内</div><div class="stat__value">' + internal + "</div></div>" +
      '<div class="stat"><div class="stat__label">跨实训室</div><div class="stat__value">' + cross + "</div></div>" +
    "</div>" +
    '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">调剂候选人</div>' +
      '<span class="card__sub">已接收调剂 ' + pickedDiversion + " 人</span></div>" +
      (list.length ? cards : "") +
      (list.length ? "" : empty) +
    "</div>"
  );
};

VIEW_BINDERS["teacher:adjustment"] = function () {
  document.querySelectorAll("[data-diversion]").forEach((card) => {
    card.onclick = async () => {
      if (!State.diversionStageOk) {
        toast(State.diversionError || "当前阶段不可调剂选人");
        return;
      }
      if (card.dataset.busy === "1") return;
      card.dataset.busy = "1";
      card.style.pointerEvents = "none";
      try {
        await api.request("/teacher/diversion/picks", {
          method: "POST",
          body: { studentId: Number(card.dataset.diversion) },
        });
        toast("已录取该调剂学生");
        await renderView();
      } catch (e) {
        toast(e.message);
        delete card.dataset.busy;
        card.style.pointerEvents = "";
      }
    };
  });
};

/* ---------- 录取名单 ---------- */

TEACHER_VIEWS.admitted = function () {
  const list = State.admitted || [];
  const p = State.profile || {};
  const bySource = { 1: 0, 2: 0, 3: 0, 4: 0 };
  list.forEach((m) => { bySource[Number(m.matchSource)] = (bySource[Number(m.matchSource)] || 0) + 1; });

  const rows = list.map((m) =>
    "<tr>" +
      '<td><div class="teacher-name">' + esc(m.studentName) + "</div>" +
        '<div class="card__sub mono">' + esc(m.studentNo) + "</div></td>" +
      "<td>" + esc(m.major || "—") + '<div class="card__sub">' + esc(m.className || "") + "</div></td>" +
      "<td>" + esc(m.roundName || "—") + "</td>" +
      "<td>" + tag(matchSourceLabel(m.matchSource), MATCH_SOURCE_TAG[m.matchSource] || "gray") + "</td>" +
      '<td class="mono">' + esc(fmtTime(m.createdAt)) + "</td>" +
    "</tr>"
  ).join("");

  const empty = '<tr><td colspan="5"><div class="empty-state">' +
    '<div class="empty-state__icon">◇</div>' +
    '<div class="empty-state__title">暂无录取学生</div>' +
    '<div class="empty-state__text">完成匹配或调剂录取后，学生名单会显示在这里。</div>' +
    "</div></td></tr>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Teacher · Admitted</div>' +
      '<h1 class="view-head__title">录取名单</h1>' +
      '<p class="view-head__desc">' + esc(p.realName || "") + " · " + esc(p.roomName || "") +
        "，名单包含正常匹配、调剂与统筹安置的学生。</p>" +
    "</div>" +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">录取总数</div><div class="stat__value">' + list.length + "</div></div>" +
      '<div class="stat"><div class="stat__label">正常匹配</div><div class="stat__value">' + (bySource[1] || 0) + "</div></div>" +
      '<div class="stat"><div class="stat__label">调剂选择</div><div class="stat__value">' + (bySource[2] || 0) + "</div></div>" +
      '<div class="stat"><div class="stat__label">统筹 / 人工安置</div><div class="stat__value">' +
        ((bySource[3] || 0) + (bySource[4] || 0)) + "</div></div>" +
    "</div>" +
    '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">我的学生</div>' +
      '<div class="flex gap-sm"><span class="card__sub">名额 ' + Number(p.quota || 0) +
        " · 已用 " + Number(p.used || 0) + '</span><button class="btn btn--ghost btn--sm" id="exportAdmitted" type="button"' +
        (list.length ? "" : " disabled") + ">导出 CSV</button></div></div>" +
      '<div class="table-wrap"><table><thead><tr>' +
        "<th>学生</th><th>专业 / 班级</th><th>录取轮次</th><th>匹配来源</th><th>匹配时间</th>" +
      "</tr></thead><tbody>" + (list.length ? rows : empty) + "</tbody></table></div>" +
    "</div>"
  );
};

VIEW_BINDERS["teacher:admitted"] = function () {
  const btn = $("#exportAdmitted");
  if (!btn) return;
  btn.onclick = () => {
    const list = State.admitted || [];
    if (!list.length) return;
    const lines = [["姓名", "学号", "专业", "班级", "录取轮次", "匹配来源", "匹配时间"].join(",")];
    list.forEach((m) => {
      lines.push([
        m.studentName, m.studentNo, m.major, m.className, m.roundName,
        matchSourceLabel(m.matchSource), m.createdAt,
      ].map((v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "录取名单.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
};
