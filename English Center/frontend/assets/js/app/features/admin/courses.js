(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, request, notify, log, escapeHtml, normalize, number, money, progressBar, courseById } = core;

  function populateCourseTeacherSelect() {
    const select = document.getElementById("khGiaovien");
    if (!select) return;
    select.innerHTML = `<option value="">Chua gan giao vien</option>` + state.teachers.map(teacher => (
      `<option value="${escapeHtml(teacher.id)}">${escapeHtml(teacher.name)}</option>`
    )).join("");
  }

  function renderCourses() {
    populateCourseTeacherSelect();
    const body = document.getElementById("khTableBody");
    if (!body) return;
    const query = normalize((document.getElementById("khSearchInput") || {}).value || "");
    const rows = state.courses.filter(course => {
      const text = normalize(`${course.name} ${course.teacherName || ""} ${course.level || ""}`);
      const price = number(course.price);
      const filterOk = state.khFilter === "all"
        || (state.khFilter === "dangmo" && course.status === "active")
        || (state.khFilter === "mienhi" && price <= 0)
        || (state.khFilter === "sapkhai" && course.status === "draft");
      return filterOk && (!query || text.includes(query));
    });

    body.innerHTML = rows.length ? rows.map(course => {
      const filter = course.status === "active" ? "dangmo" : course.status === "draft" ? "sapkhai" : "all";
      const statusText = course.status === "active" ? "Dang mo" : course.status === "draft" ? "Ban nhap" : course.status === "completed" ? "Da ket thuc" : "Da an";
      const statusKind = course.status === "active" ? "success" : course.status === "draft" ? "warning" : course.status === "completed" ? "info" : "danger";
      const rating = ((state.dashboard && state.dashboard.teacherRatings) || []).find(item => item.id === course.teacherId);
      return `<tr data-filter="${filter}" data-search="${escapeHtml(normalize(course.name))}">
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#3b82f6,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;"><i class="mdi mdi-book-open-page-variant"></i></div>
            <div>
              <div style="font-weight:700;font-size:13px;color:#0f172a;">${escapeHtml(course.name)}</div>
              <div style="font-size:11px;color:#94a3b8;">${escapeHtml(course.level || "Chua gan cap do")} - ${number(course.durationWeeks)} tuan - SL ${number(course.capacity)}</div>
            </div>
          </div>
        </td>
        <td><div style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(course.teacherName || "Chua gan")}</div><div style="font-size:11px;color:#94a3b8;">GV phu trach</div></td>
        <td><strong style="font-size:14px;color:#6366f1;">${number(course.enrolledCount)}</strong><div style="font-size:10px;color:#94a3b8;">dang ghi danh</div></td>
        <td>${progressBar(course.averageProgress)}</td>
        <td><span style="font-size:13px;"><strong>${number(rating && rating.rating).toFixed(1)}</strong></span><div style="font-size:10px;color:#94a3b8;">danh gia GV</div></td>
        <td><span style="font-size:12px;font-weight:700;color:#0f172a;">${money(course.price)}</span></td>
        <td>${core.badge(statusText, statusKind)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-outline-primary py-0 px-2 me-1" title="Xem chi tiet" onclick="EC_ADMIN_OPS.viewCourse('${course.id}')"><i class="mdi mdi-eye"></i></button>
          <button class="btn btn-xs btn-outline-secondary py-0 px-2 me-1" title="Chinh sua" onclick="EC_ADMIN_OPS.editCourse('${course.id}')"><i class="mdi mdi-pencil"></i></button>
          <button class="btn btn-xs btn-outline-danger py-0 px-2" title="An khoa hoc" onclick="EC_ADMIN_OPS.archiveCourse('${course.id}')"><i class="mdi mdi-eye-off"></i></button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="8" class="text-center text-muted py-4">Khong co khoa hoc phu hop.</td></tr>`;

    const counts = {
      all: state.courses.length,
      dangmo: state.courses.filter(item => item.status === "active").length,
      mienhi: state.courses.filter(item => number(item.price) <= 0).length,
      sapkhai: state.courses.filter(item => item.status === "draft").length
    };
    document.querySelectorAll("#khFilterChips .kh-chip").forEach(chip => {
      const filter = chip.dataset.filter;
      const label = filter === "all" ? "Tat ca" : filter === "dangmo" ? "Dang mo" : filter === "mienhi" ? "Mien phi" : "Sap khai giang";
      chip.textContent = `${label} (${counts[filter] || 0})`;
      const active = filter === state.khFilter;
      chip.classList.toggle("active", active);
      chip.style.background = active ? "#6366f1" : "#f1f5f9";
      chip.style.color = active ? "#fff" : "#475569";
      chip.style.border = active ? "none" : "1px solid #e2e8f0";
    });
  }

  async function saveCourse() {
    const name = (document.getElementById("khName") || {}).value || "";
    if (!name.trim()) return notify("Ten khoa hoc la bat buoc.", "warning");
    const lessons = number((document.getElementById("khSobuoi") || {}).value || 16);
    try {
      await request("/api/courses", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          level: (document.getElementById("khCapdo") || {}).value || "",
          price: number((document.getElementById("khHocphi") || {}).value),
          durationWeeks: Math.max(1, Math.ceil(lessons / 2)),
          capacity: 40,
          teacherId: (document.getElementById("khGiaovien") || {}).value || null,
          description: (document.getElementById("khMota") || {}).value || "",
          status: "active"
        })
      });
      ["khName", "khHocphi", "khSobuoi", "khMota"].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });
      const modal = document.getElementById("modalThemKH");
      if (window.bootstrap && modal) {
        const instance = window.bootstrap.Modal.getInstance(modal);
        if (instance) instance.hide();
      }
      notify("Da tao khoa hoc moi.", "success");
      log("Them khoa hoc moi", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function patchCourse(id, payload, successMessage) {
    await request(`/api/courses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    notify(successMessage, "success");
    await core.loadAll(true);
  }

  window.filterKhoaHoc = renderCourses;
  window.setKhFilter = function(button, filter) {
    state.khFilter = filter || "all";
    renderCourses();
  };
  window.saveKhoaHoc = saveCourse;

  Object.assign(window.EC_ADMIN_OPS, {
    viewCourse(id) {
      const course = courseById(id);
      if (course) notify(`${course.name}: ${number(course.enrolledCount)} hoc vien, hoc phi ${money(course.price)}.`, "info");
    },
    async editCourse(id) {
      const course = courseById(id);
      if (!course) return;
      const name = prompt("Ten khoa hoc", course.name);
      if (name === null) return;
      const price = prompt("Hoc phi", String(number(course.price)));
      if (price === null) return;
      try {
        await patchCourse(id, { name: name.trim() || course.name, price: number(price) }, "Da cap nhat khoa hoc.");
      } catch (error) {
        notify(error.message, "danger");
      }
    },
    async archiveCourse(id) {
      if (!confirm("An khoa hoc nay")) return;
      try {
        await patchCourse(id, { status: "archived" }, "Da an khoa hoc.");
      } catch (error) {
        notify(error.message, "danger");
      }
    }
  });

  window.EC_ADMIN_RENDERERS.courses = renderCourses;
})();
