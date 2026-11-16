/* ============================================================
   管理端：数据总览 / 基础数据 / 流程控制 / 统筹调剂 / 待选池
   ============================================================ */

const ADMIN_VIEWS = {};

/* ---------- 数据加载 ---------- */

VIEW_LOADERS["admin:config"] = async function () {
  State.adminConfig = (await api.request("/admin/config")) || [];
};

VIEW_LOADERS["admin:dashboard"] = async function () {
  const [summary, byRoom] = await Promise.all([
    api.request("/admin/stats/summary"),
    api.request("/admin/stats/by-room"),
  ]);
  State.summary = summary;
  State.byRoom = byRoom || [];
};

VIEW_LOADERS["admin:data"] = async function () {
  const ui = State.adminUi;
  const [rooms, teacherPage, studentPage] = await Promise.all([
    api.request("/admin/rooms"),
    api.request("/admin/teachers", {
      query: { page: ui.teacher.page, size: ui.teacher.size, keyword: ui.teacher.keyword },
    }),
    api.request("/admin/students", {
      query: { page: ui.student.page, size: ui.student.size, keyword: ui.student.keyword },
    }),
  ]);
  State.adminRooms = rooms || [];
  State.teacherPage = teacherPage;
  State.studentPage = studentPage;
};

VIEW_LOADERS["admin:flow"] = async function () {
  State.flowOverview = await api.request("/admin/flow/overview");
  State.flow = State.flowOverview;
};

VIEW_LOADERS["admin:allocate"] = async function () {
  const overview = await api.request("/admin/flow/overview");
  State.flowOverview = overview;
  State.flow = overview;
  const rounds = overview.rounds || [];
  const current = overview.currentRound;
  const round = current || (rounds.length ? rounds[rounds.length - 1] : null);
  State.allocateRound = round;
  State.allocateRoundId = round ? round.id : null;
  State.adminDiversion = round
    ? (await api.request("/admin/flow/rounds/" + round.id + "/diversion/candidates")) || []
    : [];
};

VIEW_LOADERS["admin:waitpool"] = async function () {
  const [all, teachers] = await Promise.all([
    api.request("/admin/wait-pool"),
    api.request("/public/teachers"),
  ]);
  State.waitPoolAll = all || [];
  State.teachers = teachers || [];
  State.waitPoolList = State.waitPoolFilter === null
    ? State.waitPoolAll
    : (await api.request("/admin/wait-pool", { query: { status: State.waitPoolFilter } })) || [];
};

/* ---------- 辅助 ---------- */

function pageMeta(pageData) {
  const total = Number((pageData && pageData.total) || 0);
  const size = Number((pageData && pageData.size) || 1) || 1;
  const page = Number((pageData && pageData.page) || 1) || 1;
  return { total, size, page, pages: Math.max(1, Math.ceil(total / size)) };
}

function adminTabSwitch(tab) {
  State.adminUi.tab = tab;
  repaintCurrentView();
}

function adminSearch(kind) {
  const input = $("#" + kind + "Search");
  State.adminUi[kind].keyword = input ? input.value.trim() : "";
  State.adminUi[kind].page = 1;
  renderView();
}

function adminPage(kind, delta) {
  const ui = State.adminUi[kind];
  const meta = pageMeta(kind === "teacher" ? State.teacherPage : State.studentPage);
  const next = ui.page + delta;
  if (next < 1 || next > meta.pages) return;
  ui.page = next;
  renderView();
}

function adminPager(pageData, kind) {
  const meta = pageMeta(pageData);
  return '<div class="flex-between mt">' +
    '<span class="card__sub">共 ' + meta.total + " 条 · 第 " + meta.page + " / " + meta.pages + " 页</span>" +
    '<div class="flex gap-sm">' +
      '<button class="btn btn--ghost btn--sm" data-page="' + kind + '" data-delta="-1" type="button"' +
        (meta.page <= 1 ? " disabled" : "") + ">上一页</button>" +
      '<button class="btn btn--ghost btn--sm" data-page="' + kind + '" data-delta="1" type="button"' +
        (meta.page >= meta.pages ? " disabled" : "") + ">下一页</button>" +
    "</div></div>";
}

function userActions(user) {
  const enabled = Number(user.enabled) === 1;
  return '<div class="flex gap-sm">' +
    '<button class="btn btn--ghost btn--sm" data-toggle-user="' + user.userId +
      '" data-enabled="' + (enabled ? 1 : 0) + '" data-name="' + esc(user.realName) + '" type="button">' +
      (enabled ? "禁用" : "启用") + "</button>" +
    '<button class="btn btn--ghost btn--sm" data-reset-user="' + user.userId +
      '" data-name="' + esc(user.realName) + '" type="button">重置密码</button>' +
  "</div>";
}

/* ---------- 数据总览 ---------- */

ADMIN_VIEWS.dashboard = function () {
  const s = State.summary || {};
  const total = Number(s.totalStudents || 0);
  const matched = Number(s.matchedCount || 0);
  const unmatched = Number(s.unmatchedCount || 0);
  const pending = Number(s.waitPoolPending || 0);
  const rate = total ? Math.round((matched / total) * 100) : 0;
  const byRoom = State.byRoom || [];
  const sourceEntries = Object.keys(s.matchedBySource || {}).map((k) => ({
    label: k,
    value: Number(s.matchedBySource[k] || 0),
  }));

  const sourceRows = sourceEntries.map((it) =>
    '<div class="flex-between mb-sm"><span class="soft">' + esc(it.label) +
      '</span><span class="mono">' + it.value + "</span></div>"
  ).join("") || '<div class="soft">暂无匹配数据</div>';

  const roomRows = byRoom.map((r, idx) => {
    const quota = Number(r.totalQuota || 0);
    const m = Number(r.matchedCount || 0);
    const pct = quota ? Math.min(100, Math.round((m / quota) * 100)) : 0;
    const color = COLORS[idx % COLORS.length];
    return '<div class="mb">' +
      '<div class="flex-between mb-sm">' +
        '<div class="flex gap-sm" style="align-items:center">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + color + '"></span>' +
          '<span class="teacher-name">' + esc(r.roomName) + "</span>" +
          '<span class="card__sub">' + Number(r.teacherCount || 0) + " 位导师</span></div>" +
        '<span class="card__sub mono">' + m + " / " + quota + "</span></div>" +
      '<div class="progress"><div class="progress__fill" style="width:' + pct + '%"></div></div>' +
    "</div>";
  }).join("") || '<div class="soft">暂无实训室数据</div>';

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Overview</div>' +
      '<h1 class="view-head__title">数据总览</h1>' +
      '<p class="view-head__desc">实时汇总学生匹配、待选池与各实训室名额使用情况。</p>' +
    "</div>" +
    '<div class="flex" style="justify-content:flex-end;margin-bottom:14px">' +
      '<button class="btn btn--ghost btn--sm" id="exportStats" type="button">导出匹配结果 CSV</button>' +
    "</div>" +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">学生总数</div><div class="stat__value">' + total +
        '</div><div class="stat__delta">全部在册学生</div><div class="stat__ic">◈</div></div>' +
      '<div class="stat"><div class="stat__label">已匹配</div><div class="stat__value">' + matched +
        '</div><div class="stat__delta">匹配率 ' + rate + '%</div><div class="stat__ic">✓</div></div>' +
      '<div class="stat"><div class="stat__label">未匹配</div><div class="stat__value">' + unmatched +
        '</div><div class="stat__delta">含待选池学生</div><div class="stat__ic">!</div></div>' +
      '<div class="stat"><div class="stat__label">待选池待处理</div><div class="stat__value">' + pending +
        '</div><div class="stat__delta">待约谈 / 待安置</div><div class="stat__ic">◷</div></div>' +
    "</div>" +
    '<div class="grid grid-2 mb">' +
      '<div class="card"><div class="card__title mb-sm">整体匹配情况</div>' +
        '<div class="center" style="padding:6px 0 14px">' +
          '<div class="ring" style="--pct:' + rate + ';margin:0 auto"><div style="display:flex;flex-direction:column;align-items:center">' +
            '<div class="ring__val">' + rate + '%</div><div class="ring__lbl">MATCHED</div></div></div>' +
        "</div>" +
        '<div class="divider"></div>' +
        '<div class="stat__label mb-sm">匹配来源分布</div>' + sourceRows +
      "</div>" +
      '<div class="card"><div class="card__title mb-sm">实训室名额使用</div>' +
        '<div class="card__sub mb">' + byRoom.length + " 个实训室 · 合计名额 " +
          byRoom.reduce((sum, r) => sum + Number(r.totalQuota || 0), 0) + "</div>" +
        roomRows +
      "</div>" +
    "</div>" +
    '<div class="grid grid-3">' +
      '<div class="card"><div class="stat__label">当前轮次</div><div class="card__title mt-sm">' +
        esc(s.currentRound ? s.currentRound.name : "暂无进行中的轮次") + "</div>" +
        '<div class="card__sub">' + esc(s.currentStage
          ? (s.currentStage.stageText || stageText(s.currentStage.stageName)) : "流程未进行") + "</div></div>" +
      '<div class="card"><div class="stat__label">待选池</div><div class="card__title mt-sm">' +
        Number(s.waitPoolTotal || 0) + " 人</div>" +
        '<div class="card__sub">待处理 ' + pending + " 人</div></div>" +
      '<div class="card"><div class="stat__label">实训室</div><div class="card__title mt-sm">' +
        byRoom.length + " 个</div>" +
        '<div class="card__sub">配置导师 ' + byRoom.reduce((sum, r) => sum + Number(r.teacherCount || 0), 0) + " 人</div></div>" +
    "</div>"
  );
};

/* ---------- 基础数据 ---------- */

VIEW_BINDERS["admin:dashboard"] = function () {
  const btn = $("#exportStats");
  if (!btn) return;
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "导出中…";
    try {
      const token = api.getToken();
      const res = await fetch(API_BASE + "/admin/stats/export", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      if (!res.ok) throw new Error("导出失败（HTTP " + res.status + "）");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "匹配结果_" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("已导出 CSV");
    } catch (e) {
      toast(e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  };
};

ADMIN_VIEWS.data = function () {
  const ui = State.adminUi;
  const tab = ui.tab;
  const tabs = [
    { id: "teachers", label: "导师账号" },
    { id: "students", label: "学生账号" },
    { id: "rooms", label: "实训室" },
  ].map((t) => '<button class="tab' + (tab === t.id ? " is-active" : "") +
    '" data-admin-tab="' + t.id + '" type="button">' + t.label + "</button>").join("");

  let body = "";
  if (tab === "teachers") {
    const page = State.teacherPage || {};
    const rows = (page.records || []).map((t) =>
      "<tr>" +
        '<td><div class="teacher-name">' + esc(t.realName) + '</div><div class="card__sub mono">' +
          esc(t.username) + " · " + esc(t.teacherNo) + "</div></td>" +
        "<td>" + esc(t.roomName || "—") + "</td>" +
        "<td>" + esc(t.title || "—") + '<div class="card__sub">' + esc(t.researchDirection || "") + "</div></td>" +
        '<td class="mono">' + Number(t.quota || 0) + "</td>" +
        "<td>" + tag(Number(t.enabled) === 1 ? "启用" : "禁用", Number(t.enabled) === 1 ? "green" : "red") + "</td>" +
        "<td>" + userActions(t) +
          '<div class="flex gap-sm" style="margin-top:6px">' +
            '<button class="btn btn--ghost btn--sm" data-edit-teacher="' + t.id + '" type="button">编辑</button>' +
            '<button class="btn btn--ghost btn--sm" data-quota-logs="' + t.id +
              '" data-name="' + esc(t.realName) + '" type="button">名额日志</button>' +
          "</div></td>" +
      "</tr>"
    ).join("");
    const empty = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state__title">未找到导师</div>' +
      '<div class="empty-state__text">请调整关键词后重试。</div></div></td></tr>';
    body = '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">导师账号</div>' +
      '<div class="flex gap-sm"><input class="input" id="teacherSearch" style="width:220px" placeholder="姓名 / 工号 / 登录名" value="' +
        esc(ui.teacher.keyword) + '"><button class="btn btn--ghost btn--sm" id="teacherSearchBtn" type="button">搜索</button>' +
        '<button class="btn btn--primary btn--sm" data-new-teacher type="button">新建导师</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>导师</th><th>实训室</th><th>职称 / 方向</th><th>名额</th><th>状态</th><th>操作</th></tr></thead>' +
      "<tbody>" + (rows || empty) + "</tbody></table></div>" + adminPager(page, "teacher") + "</div>";
  } else if (tab === "students") {
    const page = State.studentPage || {};
    const rows = (page.records || []).map((st) =>
      "<tr>" +
        '<td><div class="teacher-name">' + esc(st.realName) + '</div><div class="card__sub mono">' +
          esc(st.studentNo) + " · " + esc(st.username) + "</div></td>" +
        "<td>" + esc(st.major || "—") + '<div class="card__sub">' + esc(st.className || "") + "</div></td>" +
        "<td>" + esc(st.grade || "—") + "</td>" +
        "<td>" + tag(Number(st.enabled) === 1 ? "启用" : "禁用", Number(st.enabled) === 1 ? "green" : "red") + "</td>" +
        "<td>" + userActions(st) +
          '<div style="margin-top:6px">' +
            '<button class="btn btn--ghost btn--sm" data-edit-student="' + st.id + '" type="button">编辑</button>' +
          "</div></td>" +
      "</tr>"
    ).join("");
    const empty = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state__title">未找到学生</div>' +
      '<div class="empty-state__text">请调整关键词后重试。</div></div></td></tr>';
    body = '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">学生账号</div>' +
      '<div class="flex gap-sm"><input class="input" id="studentSearch" style="width:220px" placeholder="姓名 / 学号 / 登录名" value="' +
        esc(ui.student.keyword) + '"><button class="btn btn--ghost btn--sm" id="studentSearchBtn" type="button">搜索</button>' +
        '<button class="btn btn--primary btn--sm" data-new-student type="button">新建学生</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>学生</th><th>专业 / 班级</th><th>年级</th><th>状态</th><th>操作</th></tr></thead>' +
      "<tbody>" + (rows || empty) + "</tbody></table></div>" + adminPager(page, "student") + "</div>";
  } else {
    const rows = (State.adminRooms || []).map((r) =>
      "<tr>" +
        "<td>" + r.id + "</td>" +
        '<td><div class="teacher-name">' + esc(r.name) + '</div><div class="card__sub mono">' + esc(r.code) + "</div></td>" +
        "<td>" + esc(r.description || "—") + "</td>" +
        "<td>" + tag(Number(r.status) === 1 ? "启用" : "停用", Number(r.status) === 1 ? "green" : "gray") + "</td>" +
        "<td>" + '<button class="btn btn--ghost btn--sm" data-edit-room="' + r.id + '" type="button">编辑</button>' + "</td>" +
      "</tr>"
    ).join("");
    body = '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">实训室</div>' +
      '<div class="flex gap-sm"><span class="card__sub">共 ' + (State.adminRooms || []).length + ' 个</span>' +
        '<button class="btn btn--primary btn--sm" data-new-room type="button">新建实训室</button></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>ID</th><th>实训室</th><th>简介</th><th>状态</th><th>操作</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></div>";
  }

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Data</div>' +
      '<h1 class="view-head__title">基础数据</h1>' +
      '<p class="view-head__desc">维护导师、学生账号与实训室信息；支持关键词搜索、分页、启停账号与重置密码。</p>' +
    "</div>" +
    '<div class="tabs">' + tabs + "</div>" + body
  );
};

VIEW_BINDERS["admin:data"] = function () {
  document.querySelectorAll("[data-admin-tab]").forEach((btn) => {
    btn.onclick = () => adminTabSwitch(btn.dataset.adminTab);
  });

  const tSearch = $("#teacherSearchBtn");
  if (tSearch) {
    tSearch.onclick = () => adminSearch("teacher");
    $("#teacherSearch").onkeydown = (e) => { if (e.key === "Enter") adminSearch("teacher"); };
  }
  const sSearch = $("#studentSearchBtn");
  if (sSearch) {
    sSearch.onclick = () => adminSearch("student");
    $("#studentSearch").onkeydown = (e) => { if (e.key === "Enter") adminSearch("student"); };
  }

  document.querySelectorAll("[data-page]").forEach((btn) => {
    btn.onclick = () => {
      if (btn.disabled) return;
      adminPage(btn.dataset.page, Number(btn.dataset.delta));
    };
  });

  document.querySelectorAll("[data-toggle-user]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      const enabled = btn.dataset.enabled === "1";
      if (enabled && !window.confirm("确认禁用「" + btn.dataset.name + "」的账号？")) return;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "处理中…";
      try {
        await api.request("/admin/users/" + btn.dataset.toggleUser + "/enabled", {
          method: "PUT",
          body: { enabled: !enabled },
        });
        toast(enabled ? "账号已禁用" : "账号已启用");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  document.querySelectorAll("[data-reset-user]").forEach((btn) => {
    btn.onclick = () => openResetPassword(btn.dataset.resetUser, btn.dataset.name);
  });

  document.querySelectorAll("[data-new-teacher]").forEach((btn) => {
    btn.onclick = () => openTeacherForm(null);
  });
  document.querySelectorAll("[data-edit-teacher]").forEach((btn) => {
    btn.onclick = () => {
      const t = ((State.teacherPage && State.teacherPage.records) || [])
        .find((x) => String(x.id) === btn.dataset.editTeacher);
      if (t) openTeacherForm(t);
    };
  });
  document.querySelectorAll("[data-quota-logs]").forEach((btn) => {
    btn.onclick = () => openQuotaLogs(btn.dataset.quotaLogs, btn.dataset.name);
  });
  document.querySelectorAll("[data-new-student]").forEach((btn) => {
    btn.onclick = () => openStudentForm(null);
  });
  document.querySelectorAll("[data-edit-student]").forEach((btn) => {
    btn.onclick = () => {
      const s = ((State.studentPage && State.studentPage.records) || [])
        .find((x) => String(x.id) === btn.dataset.editStudent);
      if (s) openStudentForm(s);
    };
  });
  document.querySelectorAll("[data-new-room]").forEach((btn) => {
    btn.onclick = () => openRoomForm(null);
  });
  document.querySelectorAll("[data-edit-room]").forEach((btn) => {
    btn.onclick = () => {
      const r = (State.adminRooms || []).find((x) => String(x.id) === btn.dataset.editRoom);
      if (r) openRoomForm(r);
    };
  });
};

function openResetPassword(userId, name) {
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">重置密码</div>' +
      '<div class="modal__sub">账号：' + esc(name || userId) + "</div>" +
      '<div class="field"><label class="field__label">新密码</label>' +
        '<input class="input" id="resetPwdInput" value="123456"></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" id="resetCancel" type="button">取消</button>' +
        '<button class="btn btn--primary" id="resetConfirm" type="button">确认重置</button>' +
      "</div>" +
    "</div>"
  );
  $("#resetCancel").onclick = closeModal;
  $("#resetConfirm").onclick = async () => {
    const input = $("#resetPwdInput");
    const pwd = input ? input.value.trim() : "";
    if (!pwd) {
      toast("请输入新密码");
      return;
    }
    const btn = $("#resetConfirm");
    btn.disabled = true;
    btn.textContent = "提交中…";
    try {
      await api.request("/admin/users/" + userId + "/reset-password", {
        method: "PUT",
        body: { newPassword: pwd },
      });
      closeModal();
      toast("密码已重置");
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "确认重置";
    }
  };
}

/* ---------- 基础数据表单 ---------- */

function formField(label, control) {
  return '<div class="field"><label class="field__label">' + label + "</label>" + control + "</div>";
}

function openRoomForm(room) {
  const isEdit = !!room;
  const v = room || {};
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">' + (isEdit ? "编辑实训室" : "新建实训室") + "</div>" +
      '<div class="modal__sub">编码建议唯一；停用后不再开放给学生填报。</div>' +
      formField("名称 *", '<input class="input" id="roomName" value="' + esc(v.name) + '">') +
      '<div class="grid grid-2">' +
        formField("编码", '<input class="input" id="roomCode" value="' + esc(v.code) + '">') +
        formField("状态", '<select class="select" id="roomStatus">' +
          '<option value="1"' + (Number(v.status) === 0 ? "" : " selected") + ">启用</option>" +
          '<option value="0"' + (Number(v.status) === 0 ? " selected" : "") + ">停用</option></select>") +
      "</div>" +
      formField("简介", '<input class="input" id="roomDesc" value="' + esc(v.description) + '">') +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn--primary" id="roomSave" type="button">保存</button>' +
      "</div></div>"
  );
  document.querySelector("[data-cancel]").onclick = closeModal;
  $("#roomSave").onclick = async () => {
    const name = $("#roomName").value.trim();
    if (!name) return toast("请输入实训室名称");
    const body = {
      name,
      code: $("#roomCode").value.trim(),
      description: $("#roomDesc").value.trim(),
      status: Number($("#roomStatus").value),
    };
    const btn = $("#roomSave");
    btn.disabled = true;
    btn.textContent = "保存中…";
    try {
      await api.request(isEdit ? "/admin/rooms/" + v.id : "/admin/rooms", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      closeModal();
      toast(isEdit ? "实训室已更新" : "实训室已创建");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "保存";
    }
  };
}

function openTeacherForm(t) {
  const isEdit = !!t;
  const v = t || {};
  const roomOptions = (State.adminRooms || []).map((r) =>
    '<option value="' + r.id + '"' + (String(r.id) === String(v.roomId) ? " selected" : "") + ">" +
      esc(r.name) + "</option>").join("");
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">' + (isEdit ? "编辑导师" : "新建导师") + "</div>" +
      '<div class="modal__sub">' + (isEdit ? "登录名不可修改；名额变化会写入变动日志。" : "登录名用于登录，初始密码默认为 123456。") + "</div>" +
      '<div class="grid grid-2">' +
        formField("登录名 *", '<input class="input" id="tUsername" value="' + esc(v.username) + '"' +
          (isEdit ? " disabled" : "") + ">") +
        (isEdit ? "" : formField("初始密码", '<input class="input" id="tPassword" value="123456">')) +
        formField("姓名 *", '<input class="input" id="tRealName" value="' + esc(v.realName) + '">') +
        formField("工号 *", '<input class="input" id="tNo" value="' + esc(v.teacherNo) + '">') +
      "</div>" +
      '<div class="grid grid-2">' +
        formField("实训室 *", '<select class="select" id="tRoom"><option value="">请选择</option>' +
          roomOptions + "</select>") +
        formField("名额", '<input class="input" id="tQuota" type="number" min="0" value="' +
          (v.quota != null ? v.quota : 8) + '">') +
        formField("职称", '<input class="input" id="tTitle" value="' + esc(v.title) + '">') +
        formField("状态", '<select class="select" id="tStatus">' +
          '<option value="1"' + (Number(v.status) === 0 ? "" : " selected") + ">参与招生</option>" +
          '<option value="0"' + (Number(v.status) === 0 ? " selected" : "") + ">暂停招生</option></select>") +
      "</div>" +
      formField("研究方向", '<input class="input" id="tDirection" value="' + esc(v.researchDirection) + '">') +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn--primary" id="teacherSave" type="button">保存</button>' +
      "</div></div>"
  );
  document.querySelector("[data-cancel]").onclick = closeModal;
  $("#teacherSave").onclick = async () => {
    const username = isEdit ? v.username : $("#tUsername").value.trim();
    const realName = $("#tRealName").value.trim();
    const teacherNo = $("#tNo").value.trim();
    const roomId = $("#tRoom").value;
    if (!username) return toast("请输入登录名");
    if (!realName) return toast("请输入姓名");
    if (!teacherNo) return toast("请输入工号");
    if (!roomId) return toast("请选择实训室");
    const body = {
      username,
      password: isEdit ? undefined : ($("#tPassword").value.trim() || "123456"),
      realName,
      teacherNo,
      roomId: Number(roomId),
      title: $("#tTitle").value.trim(),
      researchDirection: $("#tDirection").value.trim(),
      quota: Math.max(0, Number($("#tQuota").value) || 0),
      status: Number($("#tStatus").value),
    };
    const btn = $("#teacherSave");
    btn.disabled = true;
    btn.textContent = "保存中…";
    try {
      await api.request(isEdit ? "/admin/teachers/" + v.id : "/admin/teachers", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      closeModal();
      toast(isEdit ? "导师已更新" : "导师已创建");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "保存";
    }
  };
}

function openStudentForm(st) {
  const isEdit = !!st;
  const v = st || {};
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">' + (isEdit ? "编辑学生" : "新建学生") + "</div>" +
      '<div class="modal__sub">' + (isEdit ? "登录名不可修改。" : "登录名用于登录，初始密码默认为 123456。") + "</div>" +
      '<div class="grid grid-2">' +
        formField("登录名 *", '<input class="input" id="sUsername" value="' + esc(v.username) + '"' +
          (isEdit ? " disabled" : "") + ">") +
        (isEdit ? "" : formField("初始密码", '<input class="input" id="sPassword" value="123456">')) +
        formField("姓名 *", '<input class="input" id="sRealName" value="' + esc(v.realName) + '">') +
        formField("学号 *", '<input class="input" id="sNo" value="' + esc(v.studentNo) + '">') +
      "</div>" +
      '<div class="grid grid-2">' +
        formField("专业", '<input class="input" id="sMajor" value="' + esc(v.major) + '">') +
        formField("年级", '<input class="input" id="sGrade" value="' + esc(v.grade) + '">') +
      "</div>" +
      formField("班级", '<input class="input" id="sClass" value="' + esc(v.className) + '">') +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn--primary" id="studentSave" type="button">保存</button>' +
      "</div></div>"
  );
  document.querySelector("[data-cancel]").onclick = closeModal;
  $("#studentSave").onclick = async () => {
    const username = isEdit ? v.username : $("#sUsername").value.trim();
    const realName = $("#sRealName").value.trim();
    const studentNo = $("#sNo").value.trim();
    if (!username) return toast("请输入登录名");
    if (!realName) return toast("请输入姓名");
    if (!studentNo) return toast("请输入学号");
    const body = {
      username,
      password: isEdit ? undefined : ($("#sPassword").value.trim() || "123456"),
      realName,
      studentNo,
      major: $("#sMajor").value.trim(),
      grade: $("#sGrade").value.trim(),
      className: $("#sClass").value.trim(),
    };
    const btn = $("#studentSave");
    btn.disabled = true;
    btn.textContent = "保存中…";
    try {
      await api.request(isEdit ? "/admin/students/" + v.id : "/admin/students", {
        method: isEdit ? "PUT" : "POST",
        body,
      });
      closeModal();
      toast(isEdit ? "学生已更新" : "学生已创建");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "保存";
    }
  };
}

async function openQuotaLogs(teacherId, name) {
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">名额变动日志</div>' +
      '<div class="modal__sub">导师：' + esc(name || teacherId) + "</div>" +
      '<div id="quotaLogBody" class="soft">加载中…</div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-cancel type="button">关闭</button>' +
      "</div></div>"
  );
  document.querySelector("[data-cancel]").onclick = closeModal;
  try {
    const logs = (await api.request("/admin/teachers/" + teacherId + "/quota-logs")) || [];
    const rows = logs.map((l) =>
      "<tr><td>" + esc(fmtTime(l.createdAt)) + "</td>" +
        '<td class="mono">' + Number(l.quotaBefore) + "</td>" +
        '<td class="mono">' + Number(l.quotaAfter) + "</td>" +
        "<td>" + esc(l.reason || "—") + "</td></tr>").join("");
    $("#quotaLogBody").innerHTML = rows
      ? '<div class="table-wrap"><table><thead><tr><th>时间</th><th>变更前</th><th>变更后</th><th>原因</th></tr></thead><tbody>' +
        rows + "</tbody></table></div>"
      : '<div class="soft">暂无名额变动记录</div>';
  } catch (e) {
    $("#quotaLogBody").innerHTML = '<div class="soft">' + esc(e.message) + "</div>";
  }
}

/* ---------- 系统配置 ---------- */

ADMIN_VIEWS.config = function () {
  const list = State.adminConfig || [];
  const rows = list.map((c) =>
    "<tr>" +
      '<td class="mono">' + esc(c.configKey) + "</td>" +
      "<td>" + esc(c.configDesc || "—") + "</td>" +
      '<td><input class="input" id="cfg_' + esc(c.configKey) + '" value="' + esc(c.configValue) +
        '" style="width:200px"></td>' +
      '<td><button class="btn btn--ghost btn--sm" data-save-config="' + esc(c.configKey) +
        '" type="button">保存</button></td>' +
    "</tr>").join("");
  const empty = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state__title">暂无配置项</div>' +
    '<div class="empty-state__text">请检查数据库 system_config 表。</div></div></td></tr>';
  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Config</div>' +
      '<h1 class="view-head__title">系统配置</h1>' +
      '<p class="view-head__desc">调整志愿数量、默认名额、终选超时等运行参数，保存后立即生效。</p>' +
    "</div>" +
    '<div class="card"><div class="card__title mb-sm">配置项</div>' +
      '<div class="table-wrap"><table><thead><tr><th>配置键</th><th>说明</th><th>当前值</th><th>操作</th></tr></thead>' +
      "<tbody>" + (rows || empty) + "</tbody></table></div></div>"
  );
};

VIEW_BINDERS["admin:config"] = function () {
  document.querySelectorAll("[data-save-config]").forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.saveConfig;
      const input = document.getElementById("cfg_" + key);
      if (!input) return;
      const value = input.value.trim();
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "保存中…";
      try {
        await api.request("/admin/config/" + encodeURIComponent(key), {
          method: "PUT",
          body: { value },
        });
        const item = (State.adminConfig || []).find((x) => x.configKey === key);
        if (item) item.configValue = value;
        toast("配置已保存");
      } catch (e) {
        toast(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });
};

/* ---------- 流程控制 ---------- */

ADMIN_VIEWS.flow = function () {
  const overview = State.flowOverview || {};
  const rounds = overview.rounds || [];
  const currentRound = overview.currentRound;
  const currentStage = overview.currentStage;

  const roundCards = rounds.map((r) => {
    const stages = r.stages || [];
    const canStart = Number(r.roundStatus) === 0;
    const canAdvance = Number(r.roundStatus) === 1;
    return '<div class="card mb">' +
      '<div class="flex-between mb-sm">' +
        '<div><div class="card__title">' + esc(r.name) + "</div>" +
          '<div class="card__sub">第 ' + r.roundNo + " 轮 · " + esc(r.roundStatusText || "") + "</div></div>" +
        '<div class="flex gap-sm">' +
          (canStart ? '<button class="btn btn--primary btn--sm" data-start-round="' + r.id + '" type="button">开始轮次</button>' : "") +
          (canAdvance ? '<button class="btn btn--amber btn--sm" data-advance-round="' + r.id + '" type="button">推进下一阶段</button>' : "") +
          '<span class="tag tag--' + (Number(r.roundStatus) === 1 ? "cyan" : Number(r.roundStatus) === 2 ? "green" : "gray") + '">' +
            esc(r.roundStatusText || "") + "</span>" +
        "</div>" +
      "</div>" +
      '<div class="flex gap-sm" style="flex-wrap:wrap">' +
        stages.map((s) => {
          const active = currentStage && String(currentStage.id) === String(s.id);
          const color = active ? "cyan" : Number(s.stageStatus) === 2 ? "green" : Number(s.stageStatus) === 1 ? "amber" : "gray";
          return tag(s.stageText || stageText(s.stageName), color);
        }).join("") +
      "</div>" +
    "</div>";
  }).join("");

  const result = State.lastAdvance;
  const resultCard = result
    ? '<div class="card mb" style="border-color:rgba(34,211,238,0.35)">' +
      '<div class="card__title mb-sm">最近一次阶段推进结果</div>' +
      '<div class="soft mb-sm">' + esc(stageText(result.fromStage)) + " → " + esc(stageText(result.toStage)) + "</div>" +
      '<div class="grid grid-4">' +
        '<div class="stat"><div class="stat__label">自动匹配</div><div class="stat__value">' + Number(result.autoMatched || 0) + "</div></div>" +
        '<div class="stat"><div class="stat__label">超时自动分配</div><div class="stat__value">' + Number(result.autoTimeout || 0) + "</div></div>" +
        '<div class="stat"><div class="stat__label">进入待选池</div><div class="stat__value">' + Number(result.toWaitPool || 0) + "</div></div>" +
        '<div class="stat"><div class="stat__label">流转下一轮</div><div class="stat__value">' + Number(result.toNextRound || 0) + "</div></div>" +
      "</div></div>"
    : "";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Flow</div>' +
      '<h1 class="view-head__title">流程控制</h1>' +
      '<p class="view-head__desc">启动轮次、推进阶段，系统会自动执行匹配、超时分配、待选池与下一轮流转。</p>' +
    "</div>" +
    '<div class="grid grid-3 mb">' +
      '<div class="stat"><div class="stat__label">当前轮次</div><div class="stat__value" style="font-size:18px">' +
        esc(currentRound ? currentRound.name : "无进行中轮次") + "</div></div>" +
      '<div class="stat"><div class="stat__label">当前阶段</div><div class="stat__value" style="font-size:18px">' +
        esc(currentStage ? (currentStage.stageText || stageText(currentStage.stageName)) : "—") + "</div></div>" +
      '<div class="stat"><div class="stat__label">轮次总数</div><div class="stat__value">' + rounds.length + "</div>" +
        '<div class="stat__delta">含初选与补录</div></div>' +
    "</div>" + resultCard +
    '<div class="card mb" style="border-color:rgba(248,113,113,0.35)">' +
      '<div class="flex-between">' +
        '<div><div class="card__title">重置流程</div>' +
          '<div class="card__sub">清空志愿、面试、导师选人、学生终选、匹配、分流与待选池记录，并把所有轮次和阶段恢复为未开始；学生、导师、实训室等基础数据不受影响。重置后可重新开始第一轮。</div></div>' +
        '<button class="btn btn--danger btn--sm" id="resetFlowBtn" type="button">重置流程</button>' +
      "</div></div>" +
    '<div class="card__title mb-sm">全部轮次</div>' + roundCards
  );
};

function openResetFlow() {
  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">重置全部流程</div>' +
      '<div class="modal__sub">此操作不可撤销：将删除所有轮次的志愿、面试、选人、终选、匹配结果、分流记录、待选池与名额日志，并把轮次和阶段恢复为未开始。基础数据不会被删除。</div>' +
      formField("输入 RESET 确认", '<input class="input" id="resetConfirm" placeholder="RESET">') +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" data-cancel type="button">取消</button>' +
        '<button class="btn btn--danger" id="resetFlowConfirm" type="button" disabled>确认重置</button>' +
      "</div></div>"
  );
  const input = $("#resetConfirm");
  const confirmBtn = $("#resetFlowConfirm");
  document.querySelector("[data-cancel]").onclick = closeModal;
  input.focus();
  input.oninput = () => {
    confirmBtn.disabled = input.value.trim() !== "RESET";
  };
  confirmBtn.onclick = async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = "重置中…";
    try {
      const removed = await api.request("/admin/flow/reset", {
        method: "POST",
        body: { confirm: "RESET" },
      });
      const total = Object.values(removed || {}).reduce((a, b) => a + Number(b || 0), 0);
      State.lastAdvance = null;
      closeModal();
      toast("流程已重置（清理 " + total + " 条记录），可重新开始第一轮");
      await renderView();
    } catch (e) {
      toast(e.message);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "确认重置";
    }
  };
}

VIEW_BINDERS["admin:flow"] = function () {
  document.querySelectorAll("[data-start-round]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (!window.confirm("确认启动该轮次？启动后将进入志愿填报阶段。")) return;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "启动中…";
      try {
        await api.request("/admin/flow/rounds/" + btn.dataset.startRound + "/start", { method: "POST" });
        toast("轮次已启动");
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  document.querySelectorAll("[data-advance-round]").forEach((btn) => {
    btn.onclick = async () => {
      if (btn.disabled) return;
      if (!window.confirm("确认推进到下一阶段？系统将自动执行本阶段的收尾处理。")) return;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "推进中…";
      try {
        const r = await api.request("/admin/flow/rounds/" + btn.dataset.advanceRound + "/next-stage", { method: "POST" });
        State.lastAdvance = r;
        toast("已推进：" + stageText(r.fromStage) + " → " + stageText(r.toStage));
        await renderView();
      } catch (e) {
        toast(e.message);
        btn.disabled = false;
        btn.textContent = label;
      }
    };
  });

  const resetBtn = $("#resetFlowBtn");
  if (resetBtn) resetBtn.onclick = openResetFlow;
};

/* ---------- 统筹调剂 ---------- */

ADMIN_VIEWS.allocate = function () {
  const round = State.allocateRound;
  const overview = State.flowOverview || {};
  const list = State.adminDiversion || [];
  const stage = overview.currentStage;
  const canPlace = !!stage && stage.stageName === "DIVERSION" &&
    round && overview.currentRound && String(round.id) === String(overview.currentRound.id);
  const placed = list.filter((c) => Number(c.placed) === 1).length;
  const internal = list.filter((c) => Number(c.allowInternal) === 1).length;
  const cross = list.filter((c) => Number(c.allowCrossRoom) === 1).length;

  const rows = list.map((c) =>
    "<tr>" +
      '<td><div class="teacher-name">' + esc(c.studentName) + '</div><div class="card__sub mono">' +
        esc(c.studentNo) + "</div></td>" +
      "<td>" + esc(c.major || "—") + '<div class="card__sub">' + esc(c.className || "") + "</div></td>" +
      "<td>" + esc(c.scopeText || (Number(c.allowInternal) === 1 ? "实训室内" : "跨实训室")) + "</td>" +
      '<td class="mono">' + (c.avgScore != null ? Number(c.avgScore).toFixed(1) : "—") + "</td>" +
      "<td>" + tag(c.statusText || (Number(c.placed) === 1 ? "已安置" : "未安置"),
        Number(c.placed) === 1 ? "green" : "amber") + "</td>" +
    "</tr>"
  ).join("");

  const empty = '<tr><td colspan="5"><div class="empty-state">' +
    '<div class="empty-state__icon">⇄</div>' +
    '<div class="empty-state__title">该轮暂无调剂候选</div>' +
    '<div class="empty-state__text">未录取且服从调剂的学生会出现在这里。</div></div></td></tr>';

  const result = State.lastSystemPlace;
  const resultCard = result
    ? '<div class="card mb" style="border-color:rgba(52,211,153,0.35)">' +
      '<div class="card__title mb-sm">系统统筹结果</div>' +
      '<div class="grid grid-3 mb">' +
        '<div class="stat"><div class="stat__label">实训室内安置</div><div class="stat__value">' + Number(result.internalPlaced || 0) + "</div></div>" +
        '<div class="stat"><div class="stat__label">全校范围安置</div><div class="stat__value">' + Number(result.crossPlaced || 0) + "</div></div>" +
        '<div class="stat"><div class="stat__label">仍未安置</div><div class="stat__value">' +
          ((result.unplaced || []).length) + "</div></div>" +
      "</div>" +
      ((result.unplaced || []).length
        ? '<div class="soft">未安置学生：' + result.unplaced.map((u) => esc(u.studentName)).join("、") + "</div>"
        : '<div class="soft">所有候选学生均已安置。</div>') +
      "</div>"
    : "";

  const notice = canPlace
    ? '<div class="notice"><strong>调剂阶段开放中。</strong> 系统将按「实训室内 → 全校范围 → 不服从调剂者约谈」顺序统筹安置。</div>'
    : '<div class="notice notice--warn"><strong>当前不可执行系统统筹。</strong> 仅当该轮处于调剂分流阶段时才能操作。' +
      (stage ? " 当前阶段：" + esc(stage.stageText || stageText(stage.stageName)) + "。" : "") + "</div>";

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Diversion</div>' +
      '<h1 class="view-head__title">统筹调剂</h1>' +
      '<p class="view-head__desc">' +
        esc(round ? round.name : "暂无轮次") + " · 未录取且服从调剂的学生按优先级系统安置。</p>" +
    "</div>" + notice + resultCard +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">候选学生</div><div class="stat__value">' + list.length + "</div></div>" +
      '<div class="stat"><div class="stat__label">已安置</div><div class="stat__value">' + placed + "</div></div>" +
      '<div class="stat"><div class="stat__label">服从实训室内</div><div class="stat__value">' + internal + "</div></div>" +
      '<div class="stat"><div class="stat__label">服从跨实训室</div><div class="stat__value">' + cross + "</div></div>" +
    "</div>" +
    '<div class="card"><div class="flex-between mb-sm">' +
      '<div class="card__title">分流候选名单</div>' +
      '<button class="btn btn--primary btn--sm" id="runSystemPlace" type="button"' +
        (canPlace ? "" : " disabled") + ">启动系统统筹</button></div>" +
      '<div class="table-wrap"><table><thead><tr><th>学生</th><th>专业 / 班级</th><th>调剂范围</th><th>志愿均分</th><th>状态</th></tr></thead>' +
      "<tbody>" + (list.length ? rows : empty) + "</tbody></table></div>" +
    "</div>"
  );
};

VIEW_BINDERS["admin:allocate"] = function () {
  const btn = $("#runSystemPlace");
  if (!btn) return;
  btn.onclick = async () => {
    if (btn.disabled) return;
    if (!State.allocateRoundId) {
      toast("没有可操作的轮次");
      return;
    }
    if (!window.confirm("确认对该轮执行系统统筹安置？此操作会直接写入录取结果。")) return;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "统筹中…";
    try {
      const r = await api.request("/admin/flow/rounds/" + State.allocateRoundId + "/diversion/system-place", { method: "POST" });
      State.lastSystemPlace = r;
      toast("统筹完成：实训室内 " + r.internalPlaced + " 人，全校 " + r.crossPlaced + " 人");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = label;
    }
  };
};

/* ---------- 待选池 ---------- */

ADMIN_VIEWS.waitpool = function () {
  const all = State.waitPoolAll || [];
  const list = State.waitPoolList || [];
  const filter = State.waitPoolFilter;
  const pending = all.filter((w) => Number(w.status) === 0).length;
  const interviewed = all.filter((w) => Number(w.status) === 1).length;
  const settled = all.filter((w) => Number(w.status) === 2).length;
  const remaining = (State.teachers || []).reduce((sum, t) => sum + Number(t.remaining || 0), 0);

  const filters = [
    { v: null, label: "全部" },
    { v: 0, label: "待约谈" },
    { v: 1, label: "已约谈" },
    { v: 2, label: "已安置" },
  ].map((f) => '<button class="tab' + (filter === f.v ? " is-active" : "") +
    '" data-wp-filter="' + (f.v === null ? "" : f.v) + '" type="button">' + f.label +
    " (" + (f.v === null ? all.length : all.filter((w) => Number(w.status) === f.v).length) + ")</button>").join("");

  const rows = list.map((w) => {
    const status = Number(w.status);
    return "<tr>" +
      '<td><div class="teacher-name">' + esc(w.studentName) + '</div><div class="card__sub mono">' +
        esc(w.studentNo) + " · " + esc(w.major || "") + " " + esc(w.className || "") + "</div></td>" +
      "<td>第 " + esc(w.enterRound || "—") + " 轮</td>" +
      "<td>" + tag(WAITPOOL_STATUS_TEXT[status] || "—", WAITPOOL_STATUS_TAG[status] || "gray") + "</td>" +
      '<td class="mono">' + esc(fmtTime(w.interviewAt)) + "</td>" +
      "<td>" + esc(w.settleTeacherName || "—") +
        (w.settleRemark ? '<div class="card__sub">' + esc(w.settleRemark) + "</div>" : "") + "</td>" +
      '<td><div class="flex gap-sm">' +
        '<button class="btn btn--ghost btn--sm" data-wp-interview="' + w.studentId +
          '" data-name="' + esc(w.studentName) + '" type="button"' + (status === 2 ? " disabled" : "") + ">" +
          (w.interviewAt ? "修改约谈" : "标记约谈") + "</button>" +
        '<button class="btn btn--primary btn--sm" data-wp-settle="' + w.studentId +
          '" data-name="' + esc(w.studentName) + '" type="button"' + (status === 2 ? " disabled" : "") + ">人工安置</button>" +
      "</div></td>" +
    "</tr>";
  }).join("");

  const empty = '<tr><td colspan="6"><div class="empty-state">' +
    '<div class="empty-state__icon">◷</div>' +
    '<div class="empty-state__title">当前筛选下没有学生</div>' +
    '<div class="empty-state__text">待选池用于承接多轮补录后仍未录取的学生。</div></div></td></tr>';

  return (
    '<div class="view-head">' +
      '<div class="view-head__eyebrow">Admin · Wait Pool</div>' +
      '<h1 class="view-head__title">待选池</h1>' +
      '<p class="view-head__desc">记录约谈时间并人工安置学生；安置后写入正常录取结果，匹配来源记为「待选池人工安置」。</p>' +
    "</div>" +
    '<div class="grid grid-4 mb">' +
      '<div class="stat"><div class="stat__label">待选池总数</div><div class="stat__value">' + all.length + "</div></div>" +
      '<div class="stat"><div class="stat__label">待约谈</div><div class="stat__value">' + pending + "</div></div>" +
      '<div class="stat"><div class="stat__label">已约谈</div><div class="stat__value">' + interviewed + "</div></div>" +
      '<div class="stat"><div class="stat__label">已安置 / 剩余名额</div><div class="stat__value" style="font-size:22px">' +
        settled + " / " + remaining + "</div></div>" +
    "</div>" +
    '<div class="tabs">' + filters + "</div>" +
    '<div class="card"><div class="table-wrap"><table><thead><tr>' +
      "<th>学生</th><th>进入轮次</th><th>状态</th><th>约谈时间</th><th>安置情况</th><th>操作</th>" +
    "</tr></thead><tbody>" + (list.length ? rows : empty) + "</tbody></table></div></div>"
  );
};

VIEW_BINDERS["admin:waitpool"] = function () {
  document.querySelectorAll("[data-wp-filter]").forEach((btn) => {
    btn.onclick = () => {
      const raw = btn.dataset.wpFilter;
      State.waitPoolFilter = raw === "" ? null : Number(raw);
      State.waitPoolList = [];
      renderView();
    };
  });

  document.querySelectorAll("[data-wp-interview]").forEach((btn) => {
    btn.onclick = () => openWaitInterview(btn.dataset.wpInterview, btn.dataset.name);
  });

  document.querySelectorAll("[data-wp-settle]").forEach((btn) => {
    btn.onclick = () => openWaitSettle(btn.dataset.wpSettle, btn.dataset.name);
  });
};

function openWaitInterview(studentId, name) {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const value = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":00";

  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">标记约谈</div>' +
      '<div class="modal__sub">学生：' + esc(name || "") + "</div>" +
      '<div class="field"><label class="field__label">约谈时间</label>' +
        '<input class="input" type="datetime-local" id="wpTime" value="' + value + '"></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" id="wpCancel" type="button">取消</button>' +
        '<button class="btn btn--primary" id="wpConfirm" type="button">确认</button>' +
      "</div>" +
    "</div>"
  );
  $("#wpCancel").onclick = closeModal;
  $("#wpConfirm").onclick = async () => {
    const time = $("#wpTime").value;
    if (!time) {
      toast("请选择约谈时间");
      return;
    }
    const btn = $("#wpConfirm");
    btn.disabled = true;
    btn.textContent = "提交中…";
    try {
      await api.request("/admin/wait-pool/" + studentId + "/interview", {
        method: "PUT",
        body: { interviewAt: toApiDateTime(time) },
      });
      closeModal();
      toast("已标记约谈");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "确认";
    }
  };
}

function openWaitSettle(studentId, name) {
  const teachers = (State.teachers || []).filter((t) => Number(t.remaining || 0) > 0);
  const options = teachers.map((t) =>
    '<option value="' + t.id + '">' + esc(t.realName) + " · " + esc(t.roomName || "") +
      "（剩余 " + Number(t.remaining || 0) + "）</option>"
  ).join("");

  openModal(
    '<div class="modal__panel">' +
      '<div class="modal__title">人工安置</div>' +
      '<div class="modal__sub">学生：' + esc(name || "") + "。安置后将直接写入录取结果。</div>" +
      (teachers.length
        ? '<div class="field"><label class="field__label">安置导师</label>' +
          '<select class="select" id="settleTeacher">' + options + "</select></div>"
        : '<div class="notice notice--warn">当前没有剩余名额的导师，无法安置。</div>') +
      '<div class="field"><label class="field__label">安置备注</label>' +
        '<input class="input" id="settleRemark" placeholder="如：已约谈，学生同意调剂"></div>' +
      '<div class="modal__actions">' +
        '<button class="btn btn--ghost" id="settleCancel" type="button">取消</button>' +
        '<button class="btn btn--primary" id="settleConfirm" type="button"' +
          (teachers.length ? "" : " disabled") + ">确认安置</button>" +
      "</div>" +
    "</div>"
  );
  $("#settleCancel").onclick = closeModal;
  $("#settleConfirm").onclick = async () => {
    const select = $("#settleTeacher");
    if (!select || !select.value) {
      toast("请选择安置导师");
      return;
    }
    const btn = $("#settleConfirm");
    btn.disabled = true;
    btn.textContent = "提交中…";
    try {
      await api.request("/admin/wait-pool/" + studentId + "/settle", {
        method: "POST",
        body: {
          teacherId: Number(select.value),
          remark: $("#settleRemark").value.trim() || null,
        },
      });
      closeModal();
      toast("学生已安置");
      await renderView();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
      btn.textContent = "确认安置";
    }
  };
}
