(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, request, notify, escapeHtml, number, dateLabel, badge } = core;

  let activeTab = "lich";

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function hideDebugButtons() {
    ["debugSendToGV", "debugClearGV"].forEach(name => {
      document.querySelectorAll(`button[onclick^="${name}"]`).forEach(button => {
        button.style.display = "none";
      });
    });
  }

  function statusKind(status) {
    if (status === "approved" || status === "done" || status === "active") return "success";
    if (status === "rejected" || status === "cancelled" || status === "archived") return "danger";
    return "warning";
  }

  function scheduleRows() {
    return state.sessions.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }

  function lessonRequests() {
    return state.materialRequests.filter(item => item.type === "lesson" || item.type === "exam");
  }

  function documentRequests() {
    return state.materialRequests.filter(item => item.type === "document");
  }

  function draftCourses() {
    return state.courses.filter(item => item.status === "draft");
  }

  function pendingCount() {
    return scheduleRows().filter(item => item.status === "scheduled").length
      + state.materialRequests.filter(item => ["pending", "submitted"].includes(item.status)).length
      + draftCourses().length;
  }

  function updateBadges() {
    const counts = {
      lich: scheduleRows().filter(item => item.status === "scheduled").length,
      baigiang: lessonRequests().filter(item => ["pending", "submitted"].includes(item.status)).length,
      hoidap: 0,
      khoahoc: draftCourses().length,
      tailieu: documentRequests().filter(item => ["pending", "submitted"].includes(item.status)).length
    };
    setText("dpc-num", pendingCount());
    Object.entries(counts).forEach(([key, value]) => {
      const badgeEl = document.getElementById(`badge-${key}`);
      if (badgeEl) badgeEl.textContent = value;
    });
  }

  function switchTab(type) {
    activeTab = type || "lich";
    ["lich", "baigiang", "hoidap", "khoahoc", "tailieu"].forEach(tab => {
      const panel = document.getElementById(`tab-${tab}`);
      const button = document.getElementById(`tab-btn-${tab}`);
      const badgeEl = document.getElementById(`badge-${tab}`);
      if (panel) panel.style.display = tab === activeTab ? "" : "none";
      if (button) {
        button.style.color = tab === activeTab ? "#6366f1" : "#64748b";
        button.style.borderBottom = tab === activeTab ? "3px solid #6366f1" : "3px solid transparent";
      }
      if (badgeEl) badgeEl.style.background = tab === activeTab ? "#6366f1" : "#94a3b8";
    });
  }

  function cardShell(color, inner) {
    return `<div class="col-12 col-md-6 col-xl-4 duyet-card">
      <div class="card card-rounded h-100" style="border:1.5px solid #e8ecf4!important;overflow:hidden;">
        <div style="height:5px;background:${color};"></div>
        <div class="card-body" style="padding:18px 20px!important;">${inner}</div>
      </div>
    </div>`;
  }

  function renderScheduleCards() {
    const container = document.getElementById("cards-lich");
    const empty = document.getElementById("empty-lich");
    if (!container) return;
    const rows = scheduleRows();
    if (empty) empty.style.display = rows.length ? "none" : "";
    container.innerHTML = rows.length ? rows.map(row => {
      const text = row.status === "done" ? "Da hoan thanh" : row.status === "cancelled" ? "Da huy" : "Da len lich";
      return cardShell("linear-gradient(90deg,#6366f1,#818cf8)", `
        <div class="d-flex align-items-center justify-content-between mb-2">
          ${badge(text, statusKind(row.status))}
          <span style="font-size:11px;color:#94a3b8;font-weight:700;">Buoi ${number(row.sessionNo)}</span>
        </div>
        <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(row.title)}</h5>
        <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
          <div><i class="mdi mdi-book-open-page-variant me-1"></i>${escapeHtml(row.courseName)}</div>
          <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(row.teacherName || "Chua phan cong")}</div>
          <div><i class="mdi mdi-calendar-clock me-1"></i>${dateLabel(row.startAt, true)} - ${dateLabel(row.endAt, true)}</div>
          <div><i class="mdi mdi-account-group me-1"></i>${number(row.expectedStudents)} hoc vien dang hoc</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-success flex-fill" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','done')"><i class="mdi mdi-check me-1"></i>Hoan thanh</button>
          <button class="btn btn-sm btn-outline-warning flex-fill" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','cancelled')"><i class="mdi mdi-close me-1"></i>Huy</button>
        </div>`);
    }).join("") : "";
  }

  function renderMaterialCards(containerId, rows, emptyMessage) {
    const panel = document.getElementById(containerId);
    if (!panel) return;
    panel.innerHTML = rows.length ? `<div class="row g-3">${rows.map(row => {
      const text = row.status === "approved" ? "Da duyet" : row.status === "rejected" ? "Tu choi" : "Cho xu ly";
      return cardShell("linear-gradient(90deg,#10b981,#34d399)", `
        <div class="d-flex align-items-center justify-content-between mb-2">
          ${badge(text, statusKind(row.status))}
          <span style="font-size:11px;color:#94a3b8;font-weight:700;">${escapeHtml(row.type)}</span>
        </div>
        <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(row.title)}</h5>
        <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
          <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(row.teacherName || "Giao vien")}</div>
          <div><i class="mdi mdi-book-open-page-variant me-1"></i>${escapeHtml(row.courseName || "Chua gan khoa")}</div>
          <div><i class="mdi mdi-clock-outline me-1"></i>${dateLabel(row.submittedAt || row.createdAt, true)}</div>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-sm btn-outline-success flex-fill" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','approved')"><i class="mdi mdi-check me-1"></i>Duyet</button>
          <button class="btn btn-sm btn-outline-danger flex-fill" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','rejected')"><i class="mdi mdi-close me-1"></i>Tu choi</button>
        </div>`);
    }).join("")}</div>` : `<div class="text-center text-muted py-5">${emptyMessage}</div>`;
  }

  function renderCourseApprovals() {
    const panel = document.getElementById("tab-khoahoc");
    if (!panel) return;
    const rows = draftCourses();
    panel.innerHTML = rows.length ? `<div class="row g-3">${rows.map(course => cardShell("linear-gradient(90deg,#3b82f6,#60a5fa)", `
      <div class="d-flex align-items-center justify-content-between mb-2">
        ${badge("Cho mo khoa", "warning")}
        <span style="font-size:11px;color:#94a3b8;font-weight:700;">${number(course.durationWeeks)} tuan</span>
      </div>
      <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(course.name)}</h5>
      <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
        <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(course.teacherName || "Chua phan cong")}</div>
        <div><i class="mdi mdi-cash me-1"></i>${core.money(course.price)}</div>
        <div><i class="mdi mdi-account-group me-1"></i>Toi da ${number(course.capacity)} hoc vien</div>
      </div>
      <button class="btn btn-sm btn-outline-success w-100" onclick="EC_ADMIN_OPS.publishCourse('${course.id}')"><i class="mdi mdi-check me-1"></i>Mo khoa hoc</button>`)).join("")}</div>` : `<div class="text-center text-muted py-5">Khong co khoa hoc cho xu ly.</div>`;
  }

  function renderQuestionApprovals() {
    const panel = document.getElementById("tab-hoidap");
    if (!panel) return;
    panel.innerHTML = `<div class="text-center text-muted py-5">
      <i class="mdi mdi-chat-check-outline" style="font-size:42px;color:#c7d2fe;display:block;margin-bottom:10px;"></i>
      Khong co cau hoi nao dang cho duyet.
    </div>`;
  }

  function renderApprovals() {
    const section = document.getElementById("sec-duyet-lich");
    if (!section) return;
    hideDebugButtons();
    updateBadges();
    renderScheduleCards();
    renderMaterialCards("tab-baigiang", lessonRequests(), "Khong co bai giang nao cho xu ly.");
    renderMaterialCards("tab-tailieu", documentRequests(), "Khong co tai lieu nao cho xu ly.");
    renderCourseApprovals();
    renderQuestionApprovals();
    switchTab(activeTab);
  }

  async function publishCourse(id) {
    try {
      await request(`/api/courses/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" })
      });
      notify("Da mo khoa hoc.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  window.switchDuyetTab = function(type) {
    switchTab(type);
    renderApprovals();
  };

  Object.assign(window.EC_ADMIN_OPS, { publishCourse });
  window.EC_ADMIN_RENDERERS.approvals = renderApprovals;
})();
