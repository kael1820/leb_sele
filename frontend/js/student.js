/* ============================================================
   学生端：概览 / 志愿填报 / 面试安排 / 导师确认 / 录取结果
   ============================================================ */

const STUDENT_VIEWS = {};

/* ---------- 数据加载 ---------- */

VIEW_LOADERS["student:dashboard"] = async function () {
  const [status, flow, choices] = await Promise.all([
    api.request("/student/status"),
    api.request("/public/flow"),
    api.request("/student/choices"),
  ]);
  State.status = status;
  State.student = status.student;
  State.stage = status.stage;
  State.roundInfo = status.round;
  State.choices = choices || [];
  State.wish = (status.currentRound && status.currentRound.wish) ||
    { allowInternal: 0, allowCrossRoom: 0 };
  State.matched = status.matched || null;
  State.waitPool = status.waitPool || null;
  State.flow = flow;
};

VIEW_LOADERS["student:pick"] = async function () {
  const [rooms, teachers, choices, status] = await Promise.all([
    api.request("/public/rooms"),
    api.request("/public/teachers"),
    api.request("/student/choices"),
    api.request("/student/status"),
  ]);
  State.rooms = rooms || [];
  State.teachers = teachers || [];
  State.choices = choices || [];
  State.status = status;
  State.stage = status.stage;
  State.roundInfo = status.round;
  State.matched = status.matched || null;
  State.wish = (status.currentRound && status.currentRound.wish) ||
    { allowInternal: 0, allowCrossRoom: 0 };
  State.volunteers = State.choices.map((c) => String(c.teacherId));

  if (!status.stage) {
    State.pickLocked = true;
    State.pickLockReason = status.status && status.status.code === "MATCHED"
      ? "你已完成匹配，志愿填报功能已关闭"
      : "当前没有进行中的轮次，志愿填报已关闭";
  } else if (status.stage.stageName !== "CHOICE_OPEN") {
    State.pickLocked = true;
    State.pickLockReason = "当前阶段为「" + (status.stage.stageText || stageText(status.stage.stageName)) +
      "」，志愿填报已关闭";
  } else {
    State.pickLocked = false;
    State.pickLockReason = "";
  }
};

VIEW_LOADERS["student:interview"] = async function () {
  const [interviews, choices, status] = await Promise.all([
    api.request("/student/interviews"),
    api.request("/student/choices"),
    api.request("/student/status"),
  ]);
  State.interviews = interviews || [];
  State.choices = choices || [];
  State.status = status;
  State.stage = status.stage;
};

VIEW_LOADERS["student:final"] = async function () {
  const [data, teachers, status] = await Promise.all([
    api.request("/student/pickers"),
    api.request("/public/teachers"),
    api.request("/student/status"),
  ]);
  State.pickers = data.pickers || [];
  State.finalChoice = data.finalChoice || null;
  State.finalSelection = State.finalChoice ? State.finalChoice.teacherId : null;
  State.needFinal = !!data.needFinal;
  State.teachers = teachers || [];
  State.status = status;
  State.stage = status.stage;
};

VIEW_LOADERS["student:result"] = async function () {
  const [result, status, teachers] = await Promise.all([
    api.request("/student/result"),
    api.request("/student/status"),
    api.request("/public/teachers"),
  ]);
  State.result = result;
  State.status = status;
  State.student = status.student || null;
  State.matched = (result && result.matched) || status.matched || null;
  State.waitPool = status.waitPool || null;
  State.teachers = teachers || [];
};

/* ---------- 辅助 ---------- */

function studentActiveStep() {
  if (State.status && State.status.stage && STAGE_STEP[State.status.stage.stageName]) {
    return STAGE_STEP[State.status.stage.stageName];
  }
  if (State.matched || State.waitPool) return 8;
  return 2;
}

function choiceOfTeacher(tid) {
  return (State.choices || []).find((c) => String(c.teacherId) === String(tid)) || null;
}

function teacherInfo(tid) {
  const t = findTeacher(tid);
  if (t) {
    return {
      id: t.id,
      name: t.realName,
      title: t.title,
      roomId: t.roomId,
      roomName: t.roomName,
      researchDirection: t.researchDirection,
      remaining: t.remaining,
      quota: t.quota,
      bio: t.bio,
    };
  }
  const c = choiceOfTeacher(tid);
  if (c) {
    return {
      id: c.teacherId,
      name: c.teacherName,
      title: c.title,
      roomName: c.roomName,
      researchDirection: c.researchDirection,
      remaining: null,
      quota: null,
      bio: "",
    };
  }
  return null;
}

function admissionLine() {
  if (State.matched) {
    return State.matched.teacherName + " · " + State.matched.roomName;
  }
  if (State.waitPool) {
    return "待选池 · " + (WAITPOOL_STATUS_TEXT[State.waitPool.status] || "");
  }
  return "选拔进行中";
}

/* ---------- 概览 ---------- */

STUDENT_VIEWS.dashboard = function () {
  const status = State.status || {};
  const stage = State.stage;
  const round = State.roundInfo;
  const statusInfo = status.status || {};
  const choices = State.choices || [];
  const currentChoices = (status.currentRound && status.currentRound.choices) || null;
  const shownChoices = currentChoices || choices;
  const wish = State.wish || {};
  const active = studentActiveStep();
  const stageLabel = stage ? (stage.stageText || stageText(stage.stageName))
    : (statusInfo.text || "流程未进行");

  const stats =
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">当前阶段</div>' +
        '<div class="stat__value" style="font-size:21px">' + esc(stageLabel) + "</div>" +
        '<div class="stat__delta">' + esc(round ? round.name : (statusInfo.text || "暂无进行中的轮次")) + "</div>" +
        '<div class="stat__ic">◷</div></div>' +
      '<div class="stat"><div class="stat__label">已填志愿</div>' +
        '<div class="stat__value">' + shownChoices.length +
          (currentChoices ? ' <span class="soft" style="font-size:15px">/ 3</span>' : "") + "</div>" +
        '<div class="stat__delta">' + esc(round ? "第 " + round.roundNo + " 轮志愿" : "历史轮次合计") + "</div>" +
        '<div class="stat__ic">◈</div></div>' +
      '<div class="stat"><div class="stat__label">调剂意愿</div>' +
        '<div class="stat__value" style="font-size:19px">' +
          (wish.allowInternal ? "实训室内" : "不服从") +
          (wish.allowInternal && wish.allowCrossRoom ? " · 校内" : "") +
        "</div>" +
        '<div class="stat__delta">' + (wish.allowCrossRoom ? "同时接受跨实训室调剂" : "未开启跨实训室调剂") + "</div>" +
        '<div class="stat__ic">⇄</div></div>' +
      '<div class="stat"><div class="stat__label">录取状态</div>' +
        '<div class="stat__value" style="font-size:19px">' + esc(statusInfo.text || "—") + "</div>" +
        '<div class="stat__delta">' + esc(admissionLine()) + "</div>" +
        '<div class="stat__ic">✓</div></div>' +
    "</div>";

  const timeline = PHASES.map((p) => {
    const cls = p.n < active ? "is-done" : p.n === active ? "is-active" : "is-locked";
    const dot = p.n < active ? "#34d399" : p.n === active ? "#22d3ee" : "#3a4557";
    return '<div class="tl-item ' + cls + '">' +
      '<div class="tl-item__badge" style="background:' + (p.n <= active ? p.color : "#2a3342") + '">' + p.n + "</div>" +
      '<div class="tl-item__body">' +
        '<div class="tl-item__head">' +
          '<div class="tl-item__title"><span class="tl-status-dot" style="background:' + dot + '"></span>' + esc(p.title) + "</div>" +
        "</div>" +
        '<div class="tl-item__desc">' + esc(p.desc) + "</div>" +
      "</div></div>";
  }).join("");

  const choiceRows = choices.length
    ? choices.map((c) =>
        '<div class="vol-slot is-filled mb-sm">' +
          '<div class="vol-slot__num">' + c.choiceRank + "</div>" +
          '<div style="flex:1;min-width:0">' +
            '<div class="teacher-name">' + esc(c.teacherName) + "</div>" +
            '<div class="teacher-lab">' + esc(c.roomName || "") + (c.title ? " · " + esc(c.title) : "") + "</div>" +
          "</div></div>"
      ).join("")
    : '<div class="center soft" style="padding:18px 0">本轮暂未填报志愿</div>';

  const wishText = wish.allowInternal
    ? (wish.allowCrossRoom ? "服从实训室内调剂 + 跨实训室调剂" : "服从实训室内调剂")
    : "不服从调剂";

  const warn = State.waitPool && !State.matched
    ? '<div class="notice notice--warn"><strong>你已进入待选池。</strong> ' +
      esc((WAITPOOL_STATUS_TEXT[State.waitPool.status] || "") +
        (State.waitPool.interviewAt ? " · 约谈时间 " + fmtTime(State.waitPool.interviewAt) : "")) +
      "</div>"
    : "";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Student · Overview</div>' +
      '<h1 class="view-head__title">你好，' + esc(status.student ? status.student.realName : "同学") + "</h1>" +
      '<p class="view-head__desc">这里汇总你的志愿填报、面试、终选与录取进度，数据实时取自学院选拔系统。</p>' +
    "</div>" + warn + stats +
    '<div class="grid grid-2">' +
      '<div class="card"><div class="card__title">我的选拔进度</div>' +
        '<div class="card__sub mb">' + esc(round ? round.name : "全部轮次已结束") +
          (stage ? " · " + esc(stage.stageText || stageText(stage.stageName)) : "") + "</div>" +
        '<div class="timeline"><div class="timeline__line"></div>' + timeline + "</div>" +
      "</div>" +
      '<div class="card"><div class="card__title">我的选择摘要</div>' +
        '<div class="card__sub mb">' + (currentChoices
          ? "志愿与调剂意愿来自当前轮次"
          : "暂无进行中轮次，展示历史已保存志愿") + "</div>" +
        '<div class="divider"></div>' +
        '<div class="stat__label mb-sm">平行志愿</div>' + choiceRows +
        '<div class="divider"></div>' +
        '<div class="stat__label mb-sm">调剂意愿</div>' +
        '<div class="soft" style="font-size:13px">' + esc(wishText) + "</div>" +
        '<div class="divider"></div>' +
        '<div class="stat__label mb-sm">录取进展</div>' +
        '<div class="soft" style="font-size:13px">' + esc(admissionLine()) + "</div>" +
      "</div>" +
    "</div>"
  );
};

/* ---------- 志愿填报 ---------- */

STUDENT_VIEWS.pick = function () {
  const locked = State.pickLocked;
  const byRoom = State.rooms.map((room, idx) => {
    const list = (State.teachers || []).filter((t) => String(t.roomId) === String(room.id));
    return { room, color: COLORS[idx % COLORS.length], teachers: list };
  });

  const notice = locked
    ? '<div class="notice notice--warn"><strong>当前不可编辑。</strong> ' + esc(State.pickLockReason) + "</div>"
    : '<div class="notice"><strong>填报提示。</strong> 最多 3 个平行志愿，不分先后；点击导师卡片即可选中或取消。</div>';

  const roomsHtml = byRoom.map(({ room, color, teachers }) => {
    const remain = teachers.reduce((sum, t) => sum + Number(t.remaining || 0), 0);
    const cards = teachers.length ? teachers.map((t) => {
      const remaining = Number(t.remaining || 0);
      const quota = Number(t.quota || 0);
      const selected = State.volunteers.indexOf(String(t.id)) >= 0;
      const lowCls = remaining <= 0 ? "is-full" : remaining <= 3 ? "is-low" : "";
      return '<div class="teacher-card ' + (selected ? "is-selected " : "") + (locked ? "is-locked" : "") +
        '" style="--accent:' + color + '" data-tid="' + t.id + '">' +
        '<div class="teacher-card__head">' +
          '<div class="teacher-avatar">' + esc((t.realName || "?").slice(0, 1)) + "</div>" +
          "<div>" +
            '<div class="teacher-name">' + esc(t.realName) + "</div>" +
            '<div class="teacher-lab">' + esc(t.title || "") + " · " + esc(t.roomName || "") + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="teacher-card__research">' + esc(t.researchDirection || "暂无研究方向") + "</div>" +
        '<div class="teacher-card__meta">' +
          '<span class="quota">剩余 <span class="quota__remain ' + lowCls + '">' + remaining + "</span> / " + quota + "</span>" +
          (remaining <= 0 ? tag("名额已满", "red") : remaining <= 3 ? tag("名额紧张", "amber") : "") +
        "</div>" +
      "</div>";
    }).join("") : '<div class="center soft" style="padding:14px">该实训室暂无可选导师</div>';

    return '<div class="card mb">' +
      '<div class="flex-between mb-sm">' +
        '<div class="flex gap-sm" style="align-items:center">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + color + '"></span>' +
          '<span class="lab-card__name">' + esc(room.name) + "</span>" +
          '<span class="card__sub">' + (teachers.length || room.teacherCount || 0) + " 位导师</span>" +
        "</div>" +
        '<span class="card__sub">剩余 ' + remain + " 个名额</span>" +
      "</div>" +
      '<div class="teacher-grid">' + cards + "</div>" +
    "</div>";
  }).join("");

  const slots = [0, 1, 2].map((i) => {
    const tid = State.volunteers[i];
    const info = tid ? teacherInfo(tid) : null;
    return '<div class="vol-slot ' + (tid ? "is-filled" : "") + ' mb-sm">' +
      '<div class="vol-slot__num">' + (i + 1) + "</div>" +
      '<div style="flex:1;min-width:0">' +
        '<div class="teacher-name">' + esc(info ? info.name : "待选择导师") + "</div>" +
        '<div class="teacher-lab">' + esc(info ? (info.roomName || "") + (info.title ? " · " + info.title : "")
          : "点击左侧导师卡片加入") + "</div>" +
      "</div>" +
      (tid ? '<button class="btn btn--ghost btn--sm" data-remove="' + esc(tid) + '" type="button">移除</button>' : "") +
    "</div>";
  }).join("");

  const wish = State.wish || {};
  const wishHtml =
    '<label class="checkbox ' + (locked ? "is-disabled" : "") + ' mb-sm">' +
      '<input type="checkbox" id="wishInternal" ' + (wish.allowInternal ? "checked" : "") +
        (locked ? " disabled" : "") + ">" +
      '<span class="checkbox__box"></span>' +
      '<span>服从实训室内调剂</span>' +
    "</label>" +
    '<label class="checkbox ' + (locked ? "is-disabled" : "") + '">' +
      '<input type="checkbox" id="wishCross" ' + (wish.allowCrossRoom ? "checked" : "") +
        (locked ? " disabled" : "") + ">" +
      '<span class="checkbox__box"></span>' +
      '<span>服从跨实训室调剂</span>' +
    "</label>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Student · Preference</div>' +
      '<h1 class="view-head__title">志愿填报</h1>' +
      '<p class="view-head__desc">按实训室浏览导师，最多选择 3 位导师。提交后将覆盖本轮已保存的志愿。</p>' +
    "</div>" + notice +
    '<div class="pick-layout">' +
      '<div>' + roomsHtml + "</div>" +
      '<aside class="pick-aside">' +
        '<div class="card mb">' +
          '<div class="flex-between mb-sm"><div class="card__title">我的志愿</div>' +
            '<span class="tag tag--' + (State.volunteers.length ? "cyan" : "gray") + '">' +
              State.volunteers.length + " / 3</span></div>" +
          slots +
          '<div class="divider"></div>' +
          '<div class="stat__label mb-sm">调剂意愿</div>' + wishHtml +
          '<button class="btn btn--primary btn--block mt" id="submitChoices" type="button"' +
            (locked ? " disabled" : "") + ">提交志愿</button>" +
          '<div class="card__sub center mt-sm">' +
            (locked ? esc(State.pickLockReason) : "提交后仍可在填报截止前再次修改") + "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="card__title">已保存志愿</div>' +
          '<div class="card__sub mt-sm">当前轮次：' +
            esc(State.roundInfo ? State.roundInfo.name : "无进行中轮次") + "</div>" +
          '<div class="card__sub mt-sm">' +
            (State.choices.length
              ? "系统记录 " + State.choices.length + " 个志愿：" +
                State.choices.map((c) => esc(c.teacherName)).join("、")
              : "系统暂无已保存志愿") +
          "</div>" +
        "</div>" +
      "</aside>" +
    "</div>"
  );
};

VIEW_BINDERS["student:pick"] = function () {
  function refresh() {
    repaintCurrentView();
  }

  document.querySelectorAll(".teacher-card[data-tid]").forEach((card) => {
    card.onclick = () => {
      if (State.pickLocked) {
        toast(State.pickLockReason);
        return;
      }
      const tid = String(card.dataset.tid);
      const idx = State.volunteers.indexOf(tid);
      if (idx >= 0) {
        State.volunteers.splice(idx, 1);
      } else {
        if (State.volunteers.length >= 3) {
          toast("最多只能选择 3 位导师");
          return;
        }
        State.volunteers.push(tid);
      }
      refresh();
    };
  });

  document.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (State.pickLocked) {
        toast(State.pickLockReason);
        return;
      }
      const tid = String(btn.dataset.remove);
      State.volunteers = State.volunteers.filter((id) => id !== tid);
      refresh();
    };
  });

  const internal = $("#wishInternal");
  if (internal) {
    internal.onchange = () => {
      if (State.pickLocked) return;
      State.wish.allowInternal = internal.checked ? 1 : 0;
    };
  }
  const cross = $("#wishCross");
  if (cross) {
    cross.onchange = () => {
      if (State.pickLocked) return;
      State.wish.allowCrossRoom = cross.checked ? 1 : 0;
    };
  }

  const submit = $("#submitChoices");
  if (submit) {
    submit.onclick = async () => {
      if (State.pickLocked) {
        toast(State.pickLockReason);
        return;
      }
      if (submit.disabled) return;
      submit.disabled = true;
      const label = submit.textContent;
      submit.textContent = "提交中…";
      try {
        await api.request("/student/choices", {
          method: "POST",
          body: {
            teacherIds: State.volunteers.map((id) => Number(id)),
            allowInternal: !!State.wish.allowInternal,
            allowCrossRoom: !!State.wish.allowCrossRoom,
          },
        });
        toast("志愿已提交");
        await renderView();
      } catch (e) {
        toast(e.message);
        submit.disabled = false;
        submit.textContent = label;
      }
    };
  }
};

/* ---------- 面试安排 ---------- */

STUDENT_VIEWS.interview = function () {
  const interviews = State.interviews || [];
  const done = interviews.filter((i) => Number(i.status) === 2);
  const scored = interviews.filter((i) => i.score != null);
  const avg = scored.length
    ? (scored.reduce((s, i) => s + Number(i.score), 0) / scored.length).toFixed(1)
    : "—";

  const rows = interviews.map((it) => {
    const choiceIdx = State.choices.findIndex((c) => String(c.teacherId) === String(it.teacherId));
    const choice = choiceIdx >= 0 ? State.choices[choiceIdx] : null;
    return "<tr>" +
      "<td>" + (choiceIdx >= 0 ? "第 " + (choiceIdx + 1) + " 志愿" : "—") + "</td>" +
      '<td><span class="teacher-name">' + esc(it.teacherName) + "</span></td>" +
      "<td>" + esc(choice && choice.roomName ? choice.roomName : "—") + "</td>" +
      '<td class="mono">' + esc(fmtTime(it.interviewTime)) + "</td>" +
      "<td>" + esc(it.location || "—") + "</td>" +
      "<td>" + tag(INTERVIEW_STATUS_TEXT[it.status] || "未知", INTERVIEW_STATUS_TAG[it.status] || "gray") +
        (it.score != null ? '<div class="card__sub mt-sm">成绩 ' + Number(it.score).toFixed(1) + "</div>" : "") +
        (it.feedback ? '<div class="card__sub">' + esc(it.feedback) + "</div>" : "") +
      "</td>" +
    "</tr>";
  }).join("");

  const empty = '<tr><td colspan="6"><div class="empty-state">' +
    '<div class="empty-state__icon">◷</div>' +
    '<div class="empty-state__title">暂无面试安排</div>' +
    '<div class="empty-state__text">导师安排面试后会在这里显示时间、地点与成绩。</div>' +
    "</div></td></tr>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Student · Interview</div>' +
      '<h1 class="view-head__title">面试安排</h1>' +
      '<p class="view-head__desc">' + esc(State.status && State.status.round
        ? State.status.round.name : "全部轮次") + "的面试记录，按导师面试安排实时更新。</p>" +
    "</div>" +
    '<div class="grid grid-3 mb">' +
      '<div class="stat"><div class="stat__label">面试场次</div><div class="stat__value">' +
        interviews.length + '</div><div class="stat__delta">全部轮次记录</div></div>' +
      '<div class="stat"><div class="stat__label">已完成</div><div class="stat__value">' +
        done.length + '</div><div class="stat__delta">含成绩与评语</div></div>' +
      '<div class="stat"><div class="stat__label">平均面试成绩</div><div class="stat__value">' +
        avg + '</div><div class="stat__delta">按已评分记录计算</div></div>' +
    "</div>" +
    '<div class="card"><div class="card__title mb-sm">我的面试记录</div>' +
      '<div class="table-wrap"><table><thead><tr>' +
        "<th>志愿</th><th>导师</th><th>所属实训室</th><th>面试时间</th><th>地点</th><th>状态 / 成绩</th>" +
      "</tr></thead><tbody>" + (interviews.length ? rows : empty) + "</tbody></table></div>" +
    "</div>"
  );
};

/* ---------- 导师确认 ---------- */

STUDENT_VIEWS.final = function () {
  const pickers = State.pickers || [];
  const submitted = State.finalChoice || null;
  const stageOk = State.stage && State.stage.stageName === "STUDENT_FINAL";
  const canPick = State.needFinal && stageOk && !submitted;

  const notice = submitted
    ? '<div class="notice"><strong>终选已提交。</strong> 你已选择 ' + esc(submitted.teacherName || "") + "，如需调整请联系学院管理员。</div>"
    : !State.needFinal && pickers.length === 1
      ? '<div class="notice"><strong>无需终选。</strong> 仅 1 位导师向你发出拟录取，系统将直接确认匹配。</div>'
      : !stageOk
        ? '<div class="notice notice--warn"><strong>当前不可终选。</strong> 当前阶段为「' +
          esc(State.stage ? (State.stage.stageText || stageText(State.stage.stageName)) : "流程未进行") + "」。</div>"
        : '<div class="notice"><strong>请在规定时间内完成终选。</strong> 收到 2 个及以上拟录取时，需要选择唯一去向。</div>';

  const cards = pickers.map((p) => {
    const info = teacherInfo(p.teacherId);
    const selected = String(State.finalSelection) === String(p.teacherId);
    return '<div class="teacher-card ' + (selected ? "is-selected " : "") + (canPick ? "" : "is-locked") +
      '" data-final-tid="' + p.teacherId + '">' +
      '<div class="teacher-card__head">' +
        '<div class="teacher-avatar">' + esc((p.teacherName || "?").slice(0, 1)) + "</div>" +
        "<div>" +
          '<div class="teacher-name">' + esc(p.teacherName) + "</div>" +
          '<div class="teacher-lab">' + esc(info && info.title ? info.title + " · " : "") +
            esc(p.roomName || "") + "</div>" +
        "</div>" +
      "</div>" +
      '<div class="teacher-card__research">' +
        esc(info && info.researchDirection ? info.researchDirection : "已向你发出拟录取意向") + "</div>" +
      '<div class="teacher-card__meta">' + tag("拟录取", "green") +
        '<span class="quota">剩余 <span class="quota__remain">' +
          esc(info && info.remaining != null ? info.remaining : "—") + "</span> / " +
          esc(info && info.quota != null ? info.quota : "—") + "</span></div>" +
    "</div>";
  }).join("");

  const empty = '<div class="card empty-state">' +
    '<div class="empty-state__icon">◇</div>' +
    '<div class="empty-state__title">暂无拟录取意向</div>' +
    '<div class="empty-state__text">导师完成选拔并选中你后，这里会展示可确认的导师列表。</div>' +
    "</div>";

  const bar = '<div class="card mt">' +
    '<div class="flex-between">' +
      '<div><div class="stat__label">当前选择</div>' +
        '<div class="card__title">' +
          (State.finalSelection
            ? esc((pickers.find((p) => String(p.teacherId) === String(State.finalSelection)) || {}).teacherName || "—")
            : "尚未选择") +
        "</div></div>" +
      '<button class="btn btn--primary" id="confirmFinal" type="button"' +
        (canPick && State.finalSelection ? "" : " disabled") + ">" +
        (submitted ? "已提交终选" : "确认提交终选") + "</button>" +
    "</div></div>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Student · Final Choice</div>' +
      '<h1 class="view-head__title">导师确认</h1>' +
      '<p class="view-head__desc">' + esc(State.status && State.status.round
        ? State.status.round.name : "全部轮次") + " · 仅在收到 2 个及以上拟录取时需要终选。</p>" +
    "</div>" + notice +
    (pickers.length
      ? '<div class="grid grid-auto">' + cards + "</div>" + bar
      : empty)
  );
};

VIEW_BINDERS["student:final"] = function () {
  const stageOk = State.stage && State.stage.stageName === "STUDENT_FINAL";
  const canPick = State.needFinal && stageOk && !State.finalChoice;

  document.querySelectorAll("[data-final-tid]").forEach((card) => {
    card.onclick = () => {
      if (!canPick) {
        if (State.finalChoice) toast("终选已提交，无法修改");
        else if (!State.needFinal) toast("当前无需终选");
        else toast("当前阶段不可终选");
        return;
      }
      State.finalSelection = Number(card.dataset.finalTid);
      repaintCurrentView();
    };
  });

  const btn = $("#confirmFinal");
  if (btn) {
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (!State.finalSelection) {
        toast("请先选择一位导师");
        return;
      }
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "提交中…";
      try {
        await api.request("/student/final-choice", {
          method: "POST",
          body: { teacherId: Number(State.finalSelection) },
        });
        toast("终选已提交");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  }
};

/* ---------- 录取结果 ---------- */

STUDENT_VIEWS.result = function () {
  const result = State.result || {};
  const matched = State.matched;
  const wp = State.waitPool;
  const history = result.diversionHistory || [];

  let hero;
  if (matched) {
    const info = teacherInfo(matched.teacherId);
    hero = '<div class="result-hero mb">' +
      '<div class="result-hero__seal">✓</div>' +
      '<div class="view-head__eyebrow">MATCHED</div>' +
      '<h2 style="font-family:var(--font-display);font-size:26px;margin:6px 0">已录取 · ' +
        esc(matched.teacherName) + "</h2>" +
      '<p class="soft">' + esc(matched.roomName) + " · " + esc(matched.roundName || "") + "</p>" +
      '<div class="grid grid-4 mt-lg">' +
        '<div class="stat"><div class="stat__label">导师</div><div class="stat__value" style="font-size:18px">' +
          esc(matched.teacherName) + "</div></div>" +
        '<div class="stat"><div class="stat__label">实训室</div><div class="stat__value" style="font-size:15px">' +
          esc(matched.roomName) + "</div></div>" +
        '<div class="stat"><div class="stat__label">匹配方式</div><div class="stat__value" style="font-size:16px">' +
          esc(matchSourceLabel(matched.matchSource)) + "</div></div>" +
        '<div class="stat"><div class="stat__label">录取轮次</div><div class="stat__value" style="font-size:16px">' +
          esc(matched.roundName || "—") + "</div></div>" +
      "</div>" +
      (info && info.researchDirection
        ? '<div class="soft mt">研究方向：' + esc(info.researchDirection) + "</div>" : "") +
      '<button class="btn btn--primary mt-lg" id="downloadNotice" type="button">下载入组通知</button>' +
    "</div>";
  } else if (wp) {
    hero = '<div class="result-hero mb" style="background:linear-gradient(135deg,rgba(251,191,36,0.1),rgba(251,146,60,0.08));border-color:rgba(251,191,36,0.3)">' +
      '<div class="result-hero__seal" style="background:linear-gradient(135deg,var(--amber),var(--orange))">◷</div>' +
      '<div class="view-head__eyebrow" style="color:var(--amber)">WAIT POOL</div>' +
      '<h2 style="font-family:var(--font-display);font-size:26px;margin:6px 0">已进入待选池</h2>' +
      '<p class="soft">' + esc(WAITPOOL_STATUS_TEXT[wp.status] || wp.statusText || "等待统筹安置") + "</p>" +
      '<div class="grid grid-3 mt-lg">' +
        '<div class="stat"><div class="stat__label">进入轮次</div><div class="stat__value" style="font-size:18px">第 ' +
          esc(wp.enterRound || "—") + " 轮</div></div>" +
        '<div class="stat"><div class="stat__label">约谈时间</div><div class="stat__value" style="font-size:15px">' +
          esc(fmtTime(wp.interviewAt)) + "</div></div>" +
        '<div class="stat"><div class="stat__label">安置导师</div><div class="stat__value" style="font-size:16px">' +
          esc(wp.settleTeacherName || "待安置") + "</div></div>" +
      "</div>" +
      (wp.settleRemark ? '<div class="soft mt">安置备注：' + esc(wp.settleRemark) + "</div>" : "") +
    "</div>";
  } else {
    hero = '<div class="result-hero mb" style="background:linear-gradient(135deg,rgba(96,165,250,0.08),rgba(167,139,250,0.06));border-color:var(--border-strong)">' +
      '<div class="result-hero__seal" style="background:linear-gradient(135deg,var(--blue),var(--purple))">◇</div>' +
      '<div class="view-head__eyebrow" style="color:var(--blue)">IN PROGRESS</div>' +
      '<h2 style="font-family:var(--font-display);font-size:26px;margin:6px 0">暂未录取，选拔进行中</h2>' +
      '<p class="soft">当前状态：' + esc(State.status && State.status.status
        ? State.status.status.text : "等待后续轮次") + "</p>" +
      '<p class="card__sub mt-sm">未进入待选池，请关注后续补录轮次与志愿填报通知。</p>' +
    "</div>";
  }

  const historyCard = history.length
    ? '<div class="card mt"><div class="card__title mb-sm">待选池 / 调剂记录</div>' +
      '<div class="table-wrap"><table><thead><tr><th>进入轮次</th><th>进入时间</th><th>约谈时间</th>' +
      "<th>状态</th><th>安置导师</th><th>备注</th></tr></thead><tbody>" +
      history.map((h) => "<tr><td>第 " + esc(h.enterRound || "—") + " 轮</td>" +
        '<td class="mono">' + esc(fmtTime(h.enterAt)) + "</td>" +
        '<td class="mono">' + esc(fmtTime(h.interviewAt)) + "</td>" +
        "<td>" + tag(WAITPOOL_STATUS_TEXT[h.status] || "—", WAITPOOL_STATUS_TAG[h.status] || "gray") + "</td>" +
        "<td>" + esc(h.settleTeacherName || "—") + "</td>" +
        "<td>" + esc(h.settleRemark || "—") + "</td></tr>").join("") +
      "</tbody></table></div></div>"
    : "";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Student · Result</div>' +
      '<h1 class="view-head__title">录取结果</h1>' +
      '<p class="view-head__desc">结果由学院选拔系统实时生成，最终以学院公示名单为准。</p>' +
    "</div>" + hero + historyCard
  );
};

VIEW_BINDERS["student:result"] = function () {
  const btn = $("#downloadNotice");
  if (!btn) return;
  btn.onclick = () => {
    const m = State.matched;
    if (!m) return;
    const text = [
      "AI+PBL 双向选择入组通知",
      "学生：" + (State.student ? State.student.realName : m.studentName),
      "学号：" + (m.studentNo || (State.student && State.student.studentNo) || ""),
      "导师：" + m.teacherName,
      "实训室：" + m.roomName,
      "录取轮次：" + (m.roundName || ""),
      "匹配方式：" + matchSourceLabel(m.matchSource),
      "生成时间：" + new Date().toLocaleString(),
    ].join("\n");
    const blob = new Blob(["\ufeff" + text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "入组通知_" + (m.studentNo || "student") + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };
};
