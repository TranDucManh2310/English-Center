(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, request, notify, escapeHtml, number, dateLabel, isoLocal, badge, courseById } = core;

  function ensureSchedulePanel() {
    const section = document.getElementById("sec-dethi");
    if (!section || document.getElementById("realSchedulePanel")) return;
    const panel = document.createElement("div");
    panel.id = "realSchedulePanel";
    panel.className = "card card-rounded mb-3";
    panel.innerHTML = `<div class="card-body">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 class="card-title-dash mb-0">Lich hoc trung tam</h4>
          <p class="card-subtitle-dash mt-1">Tao, cap nhat va theo doi cac buoi hoc.</p>
        </div>
        <button class="btn btn-sm btn-outline-primary" onclick="EC_ADMIN_OPS.refresh()"><i class="mdi mdi-refresh me-1"></i>Lam moi</button>
      </div>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-md-4"><label class="form-label small fw-semibold">Khoa hoc</label><select id="opsScheduleCourse" class="form-select form-select-sm"></select></div>
        <div class="col-md-3"><label class="form-label small fw-semibold">Bat dau</label><input id="opsScheduleStart" type="datetime-local" class="form-control form-control-sm"></div>
        <div class="col-md-3"><label class="form-label small fw-semibold">Tieu de</label><input id="opsScheduleTitle" class="form-control form-control-sm" placeholder="Buoi hoc moi"></div>
        <div class="col-md-2"><button class="btn btn-primary btn-sm text-white w-100" onclick="EC_ADMIN_OPS.createSession()"><i class="mdi mdi-calendar-plus me-1"></i>Tao lich</button></div>
      </div>
      <div class="table-responsive"><table class="table table-sm align-middle mb-0">
        <thead><tr><th>Thoi gian</th><th>Khoa hoc</th><th>Giao vien</th><th>Buoi</th><th>Si so</th><th>Trang thai</th><th></th></tr></thead>
        <tbody id="realScheduleBody"></tbody>
      </table></div>
    </div>`;
    section.prepend(panel);
  }

  function renderSchedule() {
    ensureSchedulePanel();
    const select = document.getElementById("opsScheduleCourse");
    if (select) {
      select.innerHTML = state.courses.map(course => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)}</option>`).join("");
    }
    const start = document.getElementById("opsScheduleStart");
    if (start && !start.value) start.value = isoLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const body = document.getElementById("realScheduleBody");
    if (!body) return;
    const rows = state.sessions.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt)).slice(0, 30);
    body.innerHTML = rows.length ? rows.map(row => {
      const statusText = row.status === "done" ? "Da hoc" : row.status === "cancelled" ? "Da huy" : "Sap hoc";
      const statusKind = row.status === "done" ? "success" : row.status === "cancelled" ? "danger" : "warning";
      return `<tr>
        <td><strong>${dateLabel(row.startAt, true)}</strong><div style="font-size:10px;color:#94a3b8;">${dateLabel(row.endAt, true)}</div></td>
        <td>${escapeHtml(row.courseName)}</td>
        <td>${escapeHtml(row.teacherName || "Chua gan")}</td>
        <td>${escapeHtml(row.title)}<div style="font-size:10px;color:#94a3b8;">Buoi ${number(row.sessionNo)}</div></td>
        <td>${number(row.presentCount)}/${number(row.expectedStudents)}<div style="font-size:10px;color:#ef4444;">vang ${number(row.absentCount)}</div></td>
        <td>${badge(statusText, statusKind)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-outline-success py-0 px-2 me-1" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','done')" title="Hoan thanh"><i class="mdi mdi-check"></i></button>
          <button class="btn btn-xs btn-outline-warning py-0 px-2 me-1" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','cancelled')" title="Huy"><i class="mdi mdi-close"></i></button>
          <button class="btn btn-xs btn-outline-danger py-0 px-2" onclick="EC_ADMIN_OPS.deleteSession('${row.id}')" title="Xoa"><i class="mdi mdi-delete-outline"></i></button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="7" class="text-center text-muted py-4">Chua co lich hoc nao.</td></tr>`;

    const kpis = document.querySelectorAll("#sec-dethi .ec-kpi-card h4");
    if (kpis.length) {
      const today = new Date().toISOString().slice(0, 10);
      kpis[0].textContent = state.sessions.filter(item => String(item.startAt || "").slice(0, 10) === today).length;
      if (kpis[1]) kpis[1].textContent = state.sessions.filter(item => item.status === "done").length;
      if (kpis[2]) kpis[2].textContent = state.sessions.reduce((sum, item) => sum + number(item.absentCount), 0);
      if (kpis[3]) kpis[3].textContent = state.materialRequests.filter(item => ["pending", "submitted"].includes(item.status)).length;
    }
  }

  async function createSession() {
    const courseId = (document.getElementById("opsScheduleCourse") || {}).value;
    const course = courseById(courseId);
    const startAt = (document.getElementById("opsScheduleStart") || {}).value;
    const title = ((document.getElementById("opsScheduleTitle") || {}).value || "Buoi hoc moi").trim();
    if (!courseId || !startAt) return notify("Can chon khoa hoc va thoi gian bat dau.", "warning");
    const start = new Date(startAt);
    const end = new Date(start.getTime() + 90 * 60 * 1000);
    try {
      await request("/api/class-sessions", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          teacherId: course ? course.teacherId : null,
          title,
          sessionNo: state.sessions.filter(item => item.courseId === courseId).length + 1,
          startAt: startAt.replace("T", " "),
          endAt: isoLocal(end).replace("T", " "),
          status: "scheduled"
        })
      });
      notify("Da tao lich hoc moi.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function updateSessionStatus(id, status) {
    try {
      await request(`/api/class-sessions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      notify("Da cap nhat lich hoc.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function deleteSession(id) {
    if (!confirm("Xoa lich hoc nay")) return;
    try {
      await request(`/api/class-sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify("Da xoa lich hoc.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  Object.assign(window.EC_ADMIN_OPS, {
    createSession,
    updateSessionStatus,
    deleteSession
  });
  window.EC_ADMIN_RENDERERS.schedule = renderSchedule;
})();
