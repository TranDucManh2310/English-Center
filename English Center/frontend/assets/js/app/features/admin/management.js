(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const state = {
    students: [],
    teachers: [],
    courses: [],
    enrollments: [],
    teacherDashboards: new Map(),
    editingStudentId: "",
    editingTeacherId: ""
  };

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function request(path, options) {
    if (window.location.protocol === "file:") {
      throw new Error("Hay mo trang qua http://localhost:3000 de su dung day du chuc nang.");
    }
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...((options && options.headers) || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || "Yeu cau khong thanh cong.");
    }
    return data;
  }

  function notify(message, type) {
    if (typeof window.adminToast === "function") window.adminToast(message, type || "info");
    else console.log(message);
  }

  function log(message, type) {
    if (typeof window.logActivity === "function") window.logActivity(message, type || "info");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, match => (match === "Đ" ? "D" : "d"))
      .toLowerCase()
      .trim();
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || "").slice(0, 2)).toUpperCase();
  }

  function avatar(name, size) {
    const px = size || 34;
    return `<div style="width:${px}px;height:${px}px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#10b981);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${Math.max(10, px / 2.7)}px;flex-shrink:0;">${escapeHtml(initials(name))}</div>`;
  }

  function dateLabel(value) {
    if (!value) return "Chua dang nhap";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chua dang nhap";
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function isOnline(value) {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 90000;
  }

  function courseByName(name) {
    const wanted = normalize(name);
    return state.courses.find(course => normalize(course.name) === wanted)
      || state.courses.find(course => normalize(course.name).includes(wanted) || wanted.includes(normalize(course.name)))
      || null;
  }

  function statusLabel(status, progress) {
    if (status === "completed" || progress >= 100) return "Hoan thanh";
    if (status === "paused") return "Cham tien do";
    if (status === "cancelled") return "Nguy co bo hoc";
    if (progress > 0 && progress < 35) return "Cham tien do";
    return "Dang hoc";
  }

  function segmentLabel(row) {
    const progress = Number(row.pr || row.progress || 0);
    if (row.status === "cancelled" || progress < 20) return "inactive";
    if (row.absences >= 2 || progress < 45 || (row.averageScore > 0 && row.averageScore < 6)) return "risk";
    if (progress >= 85 || row.averageScore >= 8.5) return "star";
    if (row.isNew) return "new";
    return "normal";
  }

  function riskLevel(row) {
    if (row.tt === "Nguy co bo hoc" || row.seg === "inactive" || row.pr < 20) return "high";
    if (row.tt === "Cham tien do" || row.seg === "risk" || row.absences >= 2) return "medium";
    return "low";
  }

  function riskBadge(risk) {
    if (risk === "high") return '<span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Cao</span>';
    if (risk === "medium") return '<span style="background:#fef3c7;color:#d97706;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Can chu y</span>';
    return '<span style="background:#d1fae5;color:#059669;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">On dinh</span>';
  }

  function segBadge(seg) {
    const map = {
      star: '<span style="background:#d1fae5;color:#059669;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Ngoi sao</span>',
      risk: '<span style="background:#fef3c7;color:#d97706;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Co nguy co</span>',
      new: '<span style="background:#e0f2fe;color:#0369a1;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Moi</span>',
      inactive: '<span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">It hoat dong</span>',
      normal: '<span style="background:#f1f5f9;color:#64748b;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;">Binh thuong</span>'
    };
    return map[seg] || map.normal;
  }

  function progressClass(progress) {
    if (progress >= 80) return "bg-success";
    if (progress >= 50) return "bg-warning";
    return "bg-danger";
  }

  function buildStudentRows() {
    const byStudent = new Map();
    state.enrollments.forEach(enrollment => {
      if (!byStudent.has(enrollment.userId)) byStudent.set(enrollment.userId, []);
      byStudent.get(enrollment.userId).push(enrollment);
    });

    const rows = [];
    state.students.forEach(student => {
      const studentEnrollments = byStudent.get(student.id) || [];
      if (!studentEnrollments.length) {
        rows.push({
          userId: student.id,
          enrollmentId: "",
          ten: student.name || student.email,
          lop: student.education || "-",
          email: student.email,
          sdt: student.phone || "-",
          khoa: "Chua dang ky",
          gv: "Chua phan cong",
          pr: 0,
          streak: 0,
          tt: "Chua dang ky",
          seg: "new",
          absences: 0,
          submissions: 0,
          averageScore: 0,
          status: "new",
          paymentStatus: "",
          enrolledAt: student.createdAt || null
        });
        return;
      }

      const sorted = [...studentEnrollments].sort((a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0));
      const primary = sorted[0] || {};
      const courseNames = Array.from(new Set(studentEnrollments.map(item => item.courseName).filter(Boolean)));
      const teacherNames = Array.from(new Set(studentEnrollments.map(item => item.teacherName).filter(Boolean)));
      const totalProgress = studentEnrollments.reduce((sum, item) => sum + number(item.progress), 0);
      const scoreRows = studentEnrollments.filter(item => number(item.averageScore) > 0);
      const progress = Math.round(totalProgress / Math.max(studentEnrollments.length, 1));
      const averageScore = scoreRows.length ?
         Math.round(scoreRows.reduce((sum, item) => sum + number(item.averageScore), 0) / scoreRows.length * 10) / 10
        : 0;
      const statuses = studentEnrollments.map(item => item.status || "active");
      const enrolledAt = primary.enrolledAt ? new Date(primary.enrolledAt) : null;
      const days = enrolledAt && !Number.isNaN(enrolledAt.getTime()) ?
         Math.max(0, Math.floor((Date.now() - enrolledAt.getTime()) / 86400000))
        : 0;
      const allCompleted = statuses.length > 0 && statuses.every(status => status === "completed");
      const anyCancelled = statuses.includes("cancelled");
      const anyPaused = statuses.includes("paused");
      const row = {
        userId: student.id,
        enrollmentId: primary.id || "",
        courseId: primary.courseId || "",
        ten: student.name || primary.studentName || student.email,
        lop: student.education || primary.studentClass || "-",
        email: student.email || primary.studentEmail,
        sdt: student.phone || primary.studentPhone || "-",
        khoa: courseNames.length <= 1 ? (courseNames[0] || "Chua dang ky") : `${courseNames[0]} +${courseNames.length - 1} khoa`,
        courseNames,
        courseSummary: courseNames.join(", "),
        primaryCourseName: primary.courseName || courseNames[0] || "",
        gv: teacherNames.length <= 1 ? (teacherNames[0] || "Chua phan cong") : `${teacherNames[0]} +${teacherNames.length - 1} GV`,
        teacherNames,
        pr: progress,
        streak: Math.max(0, studentEnrollments.reduce((sum, item) => sum + number(item.completedLessons), 0)),
        tt: allCompleted ? "Hoan thanh" : anyCancelled ? "Nguy co bo hoc" : anyPaused || progress < 35 ? "Cham tien do" : "Dang hoc",
        absences: studentEnrollments.reduce((sum, item) => sum + number(item.absences), 0),
        submissions: studentEnrollments.reduce((sum, item) => sum + number(item.submissions), 0),
        averageScore,
        status: anyCancelled ? "cancelled" : allCompleted ? "completed" : anyPaused ? "paused" : "active",
        paymentStatus: primary.paymentStatus || "",
        paidAmount: studentEnrollments.reduce((sum, item) => sum + number(item.paidAmount), 0),
        enrolledAt: primary.enrolledAt || null,
        enrollmentCount: studentEnrollments.length,
        isNew: days <= 14
      };
      row.seg = segmentLabel(row);
      rows.push(row);
    });
    return rows;
  }

  function matchesStudentFilters(row) {
    const search = (document.getElementById("hvSearch") || {}).value || "";
    const course = (document.getElementById("hvFilterKhoa") || {}).value || "";
    const status = (document.getElementById("hvFilterTT") || {}).value || "";
    const segment = (document.getElementById("hvFilterSeg") || {}).value || "";
    const risk = (document.getElementById("hvFilterRisk") || {}).value || "";

    if (search) {
      const haystack = normalize(`${row.ten} ${row.email} ${row.sdt} ${row.lop}`);
      if (!haystack.includes(normalize(search))) return false;
    }
    if (course) {
      const courseNames = row.courseNames && row.courseNames.length ? row.courseNames : [row.khoa];
      if (!courseNames.some(name => normalize(name) === normalize(course))) return false;
    }
    if (status && normalize(row.tt) !== normalize(status)) return false;
    if (segment && row.seg !== segment) return false;
    if (risk && riskLevel(row) !== risk) return false;
    return true;
  }

  function renderStudentTable(rows) {
    const tbody = document.getElementById("fullHVBody");
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-5">Khong co hoc vien phu hop voi bo loc.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row, index) => {
      const risk = riskLevel(row);
      const statusStyle = {
        "Dang hoc": "background:#d1fae5;color:#059669",
        "Cham tien do": "background:#fef3c7;color:#d97706",
        "Nguy co bo hoc": "background:#fee2e2;color:#dc2626",
        "Hoan thanh": "background:#e0e7ff;color:#4338ca",
        "Chua dang ky": "background:#f1f5f9;color:#64748b"
      }[row.tt] || "background:#f1f5f9;color:#64748b";

      return `<tr>
        <td><input type="checkbox" class="hvChk"></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            ${avatar(row.ten)}
            <div><strong style="font-size:13px;">${escapeHtml(row.ten)}</strong><br><span style="font-size:11px;color:#94a3b8;">Lop ${escapeHtml(row.lop)}</span></div>
          </div>
        </td>
        <td style="font-size:11px;color:#64748b;">${escapeHtml(row.email)}<br>${escapeHtml(row.sdt)}</td>
        <td style="font-size:12px;">${escapeHtml(row.khoa)}</td>
        <td style="font-size:12px;">${escapeHtml(row.gv)}</td>
        <td style="min-width:95px">
          <div class="progress progress-md mb-1"><div class="progress-bar ${progressClass(row.pr)}" style="width:${Math.min(row.pr, 100)}%"></div></div>
          <span style="font-size:11px;font-weight:700;">${row.pr}%</span>
        </td>
        <td style="font-size:12px;">${row.streak ? `${row.streak} bai` : '<span class="text-muted">-</span>'}</td>
        <td>${segBadge(row.seg)}</td>
        <td><span style="border-radius:20px;padding:2px 9px;font-size:11px;font-weight:600;${statusStyle}">${escapeHtml(row.tt)}</span></td>
        <td>${riskBadge(risk)}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-xs btn-outline-primary py-0 px-2 me-1" style="font-size:11px" onclick="EC_ADMIN_MGMT.showStudent(${index})" title="Xem chi tiet"><i class="mdi mdi-account"></i></button>
          <button class="btn btn-xs btn-outline-secondary py-0 px-2 me-1" style="font-size:11px" onclick="EC_ADMIN_MGMT.editStudent('${escapeHtml(row.userId)}')" title="Sua"><i class="mdi mdi-pencil"></i></button>
          <button class="btn btn-xs btn-outline-danger py-0 px-2" style="font-size:11px" onclick="EC_ADMIN_MGMT.deleteUser('${escapeHtml(row.userId)}','${escapeHtml(row.ten)}')" title="Xoa"><i class="mdi mdi-delete"></i></button>
        </td>
      </tr>`;
    }).join("");
  }

  function renderStudentCards(rows) {
    const container = document.getElementById("fullHVCards");
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = '<div class="text-center text-muted py-5" style="grid-column:1/-1;">Khong co hoc vien phu hop voi bo loc.</div>';
      return;
    }
    container.innerHTML = rows.map((row, index) => {
      const risk = riskLevel(row);
      const border = risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#10b981";
      return `<div style="background:#fff;border-radius:10px;border:1px solid #f1f5f9;border-top:3px solid ${border};padding:16px;box-shadow:0 2px 8px rgba(15,23,42,.05);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          ${avatar(row.ten, 40)}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.ten)}</div>
            <div style="font-size:11px;color:#94a3b8;">Lop ${escapeHtml(row.lop)} - ${escapeHtml(row.gv)}</div>
          </div>
          ${riskBadge(risk)}
        </div>
        <div style="font-size:11px;color:#64748b;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.khoa)}</div>
        <div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="font-size:11px;color:#64748b;">Tien do</span><span style="font-size:11px;font-weight:800;">${row.pr}%</span></div>
          <div class="progress progress-md"><div class="progress-bar ${progressClass(row.pr)}" style="width:${Math.min(row.pr, 100)}%"></div></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div>${segBadge(row.seg)}</div>
          <span style="font-size:12px;color:#64748b;">${escapeHtml(row.tt)}</span>
        </div>
        <div style="display:flex;gap:5px;margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;">
          <button class="btn btn-xs btn-outline-primary flex-grow-1 py-1" style="font-size:11px;" onclick="EC_ADMIN_MGMT.showStudent(${index})"><i class="mdi mdi-account me-1"></i>Chi tiet</button>
          <button class="btn btn-xs btn-outline-secondary flex-grow-1 py-1" style="font-size:11px;" onclick="EC_ADMIN_MGMT.editStudent('${escapeHtml(row.userId)}')"><i class="mdi mdi-pencil me-1"></i>Sua</button>
        </div>
      </div>`;
    }).join("");
  }

  function renderStudentSummary(rows, filtered) {
    const count = document.getElementById("hvTableCount");
    if (count) count.textContent = `Hien thi ${filtered.length} / ${rows.length} hoc vien`;

    const footer = document.getElementById("hvTableFooter");
    if (footer) {
      const highRisk = filtered.filter(row => riskLevel(row) === "high").length;
      footer.innerHTML = `<span style="font-size:12px;color:#64748b;">Hien thi <strong>${filtered.length}</strong> / ${rows.length} hoc vien${highRisk ? ` - <span style="color:#ef4444;font-weight:700;">${highRisk} nguy co cao</span>` : ""}</span>`;
    }

    const cards = Array.from(document.querySelectorAll("#segmentCards .seg-card"));
    const totals = rows.reduce((acc, row) => {
      acc[row.seg] = (acc[row.seg] || 0) + 1;
      return acc;
    }, {});
    cards.forEach(card => {
      const seg = card.getAttribute("data-seg");
      const value = card.querySelector("h4");
      const pct = card.querySelector("span");
      const total = totals[seg] || 0;
      if (value) value.textContent = total;
      if (pct) pct.textContent = rows.length ? `${Math.round(total / rows.length * 100)}%` : "0%";
    });
  }

  function renderStudents() {
    const rows = buildStudentRows();
    window.FULL_HV_DATA = rows;
    state.studentRows = rows;

    const filtered = rows.filter(matchesStudentFilters);
    state.filteredStudentRows = filtered;
    const tableVisible = (document.getElementById("viewCardContainer") || {}).style.display === "none";
    if (tableVisible) renderStudentTable(filtered);
    else renderStudentCards(filtered);
    renderStudentSummary(rows, filtered);
  }

  function fillCourseSelects() {
    ["hvKhoa", "hvFilterKhoa"].forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;
      const current = select.value;
      const first = id === "hvFilterKhoa" ? '<option value="">Tat ca khoa hoc</option>' : "";
      select.innerHTML = first + state.courses.map(course => `<option value="${escapeHtml(course.name)}">${escapeHtml(course.name)}</option>`).join("");
      if (current && Array.from(select.options).some(option => option.value === current)) select.value = current;
    });
  }

  function studentPayloadFromModal() {
    const name = (document.getElementById("hvName") || {}).value.trim() || "";
    const email = (document.getElementById("hvEmail") || {}).value.trim() || "";
    const phone = (document.getElementById("hvPhone") || {}).value.trim() || "";
    const education = (document.getElementById("hvLop") || {}).value || "";
    const courseName = (document.getElementById("hvKhoa") || {}).value || "";
    return { name, email, phone, education, courseName };
  }

  async function saveStudent() {
    const payload = studentPayloadFromModal();
    if (!payload.name) return notify("Vui long nhap ho ten hoc vien.", "error");
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return notify("Email khong hop le.", "error");
    const course = courseByName(payload.courseName);

    if (state.editingStudentId) {
      await request(`/api/users/${encodeURIComponent(state.editingStudentId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          education: payload.education
        })
      });
      if (course) {
        await request("/api/enrollments", {
          method: "POST",
          body: JSON.stringify({
            userId: state.editingStudentId,
            courseId: course.id,
            status: "active",
            paymentStatus: "pending"
          })
        });
      }
      notify("Da cap nhat thong tin hoc vien.", "success");
      log(`Cap nhat hoc vien ${payload.name}`, "info");
    } else {
      const created = await request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          role: "student",
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          education: payload.education,
          password: "student123"
        })
      });
      if (course) {
        await request("/api/enrollments", {
          method: "POST",
          body: JSON.stringify({
            userId: created.user.id,
            courseId: course.id,
            status: "active",
            paymentStatus: "pending"
          })
        });
      }
      notify(`Da them hoc vien. Mat khau mac dinh: ${created.defaultPassword || "student123"}`, "success");
      log(`Them hoc vien ${payload.name}`, "success");
    }

    closeModal("modalThemHV");
    resetStudentModal();
    await loadAdminManagementData();
  }

  function resetStudentModal() {
    state.editingStudentId = "";
    const title = document.querySelector("#modalThemHV .modal-title");
    if (title) title.textContent = "Them Hoc Vien Moi";
    ["hvName", "hvEmail", "hvPhone"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  function openStudentEditor(userId) {
    const row = (state.studentRows || buildStudentRows()).find(item => item.userId === userId);
    if (!row) return notify("Khong tim thay hoc vien.", "error");
    state.editingStudentId = userId;
    const title = document.querySelector("#modalThemHV .modal-title");
    if (title) title.textContent = "Sua Thong Tin Hoc Vien";
    setValue("hvName", row.ten);
    setValue("hvEmail", row.email);
    setValue("hvPhone", row.sdt === "-" ? "" : row.sdt);
    setValue("hvLop", row.lop);
    setValue("hvKhoa", row.primaryCourseName || row.khoa);
    showModal("modalThemHV");
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  }

  function showStudent(index) {
    const row = (state.filteredStudentRows || [])[index] || (state.studentRows || [])[index];
    if (!row) return;
    const body = document.getElementById("chiTietHVBody");
    if (body) {
      body.innerHTML = `<div class="d-flex align-items-center gap-3 mb-4 p-3 rounded" style="background:#f8fafc;">
        ${avatar(row.ten, 60)}
        <div>
          <h4 class="mb-0 fw-bold">${escapeHtml(row.ten)}</h4>
          <p class="text-muted mb-0 small">Lop <strong>${escapeHtml(row.lop)}</strong> - ${escapeHtml(row.tt)}</p>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-6"><div class="p-3 rounded" style="background:#f8fafc;border:1px solid #e2e8f0;"><p class="text-muted small fw-semibold mb-2">LIEN HE</p><p class="mb-1 small">${escapeHtml(row.email)}</p><p class="mb-0 small">${escapeHtml(row.sdt)}</p></div></div>
        <div class="col-md-6"><div class="p-3 rounded" style="background:#f8fafc;border:1px solid #e2e8f0;"><p class="text-muted small fw-semibold mb-2">KHOA HOC</p><p class="mb-1 small">${escapeHtml(row.courseSummary || row.khoa)}</p><p class="mb-0 small">GV: ${escapeHtml((row.teacherNames || []).join(", ") || row.gv)}</p></div></div>
        <div class="col-12"><div class="p-3 rounded" style="background:#f8fafc;border:1px solid #e2e8f0;"><div class="d-flex justify-content-between"><strong>Tien do</strong><strong>${row.pr}%</strong></div><div class="progress mt-2" style="height:10px;"><div class="progress-bar ${progressClass(row.pr)}" style="width:${Math.min(row.pr, 100)}%;"></div></div><div class="small text-muted mt-2">Diem TB: ${row.averageScore || "-"} - Vang: ${row.absences} - Bai da nop: ${row.submissions}</div></div></div>
      </div>`;
    }
    const edit = document.getElementById("btnSuaHV");
    if (edit) edit.onclick = () => openStudentEditor(row.userId);
    const remind = document.getElementById("btnNhacNhoHV");
    if (remind) {
      remind.onclick = () => sendStudentReminder(row)
        .catch(error => notify(error.message, "error"));
    }
    const del = document.getElementById("btnXoaHV");
    if (del) del.onclick = () => deleteUser(row.userId, row.ten);
    showModal("modalChiTietHV");
  }

  function teacherPayloadFromModal() {
    return {
      name: (document.getElementById("gvName") || {}).value.trim() || "",
      email: (document.getElementById("gvEmail") || {}).value.trim() || "",
      phone: (document.getElementById("gvPhone") || {}).value.trim() || "",
      experience: (document.getElementById("gvChuyenmon") || {}).value || "",
      motivation: (document.getElementById("gvNote") || {}).value.trim() || ""
    };
  }

  async function saveTeacher() {
    const payload = teacherPayloadFromModal();
    if (!payload.name) return notify("Vui long nhap ho ten giao vien.", "error");
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) return notify("Email khong hop le.", "error");

    if (state.editingTeacherId) {
      await request(`/api/users/${encodeURIComponent(state.editingTeacherId)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      notify("Da cap nhat thong tin giao vien.", "success");
      log(`Cap nhat giao vien ${payload.name}`, "info");
    } else {
      const created = await request("/api/users", {
        method: "POST",
        body: JSON.stringify({ ...payload, role: "teacher", password: "teacher123" })
      });
      notify(`Da them giao vien. Mat khau mac dinh: ${created.defaultPassword || "teacher123"}`, "success");
      log(`Them giao vien ${payload.name}`, "success");
    }

    closeModal("modalThemGV");
    resetTeacherModal();
    await loadAdminManagementData();
  }

  async function quickCreateTeacher() {
    const name = (document.getElementById("tkHoTen") || {}).value.trim() || "";
    const email = (document.getElementById("tkEmail") || {}).value.trim() || "";
    if (!name) return notify("Vui long nhap ho ten giao vien.", "error");
    if (!/^\S+@\S+\.\S+$/.test(email)) return notify("Email khong hop le.", "error");
    const created = await request("/api/users", {
      method: "POST",
      body: JSON.stringify({ role: "teacher", name, email, password: "teacher123" })
    });
    setValue("tkHoTen", "");
    setValue("tkEmail", "");
    notify(`Da cap tai khoan giao vien. Mat khau mac dinh: ${created.defaultPassword || "teacher123"}`, "success");
    log(`Cap tai khoan giao vien ${name}`, "success");
    await loadAdminManagementData();
  }

  function resetTeacherModal() {
    state.editingTeacherId = "";
    const title = document.querySelector("#modalThemGV .modal-title");
    if (title) title.textContent = "Them Giao Vien Moi";
    ["gvName", "gvEmail", "gvPhone", "gvNote"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  function openTeacherEditor(userId) {
    const teacher = state.teachers.find(item => item.id === userId);
    if (!teacher) return notify("Khong tim thay giao vien.", "error");
    state.editingTeacherId = userId;
    const title = document.querySelector("#modalThemGV .modal-title");
    if (title) title.textContent = "Sua Thong Tin Giao Vien";
    setValue("gvName", teacher.name);
    setValue("gvEmail", teacher.email);
    setValue("gvPhone", teacher.phone);
    setValue("gvChuyenmon", teacher.experience);
    setValue("gvNote", teacher.motivation);
    showModal("modalThemGV");
  }

  async function deleteUser(userId, name) {
    if (!confirm(`Xoa ${name} Cac du lieu lien quan se duoc cap nhat theo quy dinh he thong.`)) return;
    await request(`/api/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
    notify(`Da xoa ${name}.`, "warning");
    log(`Xoa nguoi dung ${name}`, "danger");
    closeModal("modalChiTietHV");
    await loadAdminManagementData();
  }

  async function sendStudentReminder(row) {
    await request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        userId: row.userId,
        title: "Nhac nho hoc tap",
        body: `Hay tiep tuc cap nhat tien do khoa hoc ${row.primaryCourseName || row.khoa || ""}.`,
        type: "study"
      })
    });
    notify(`Da gui nhac nho cho ${row.ten}.`, "success");
    log(`Gui nhac nho hoc tap cho ${row.ten}`, "info");
  }

  async function notifyTeacher(teacherId) {
    const teacher = state.teachers.find(item => item.id === teacherId);
    if (!teacher) return notify("Khong tim thay giao vien.", "error");
    const message = prompt(`Noi dung thong bao gui ${teacher.name || teacher.email}:`, "Vui long cap nhat tien do lop hoc trong dashboard.");
    if (message === null) return;
    const body = message.trim();
    if (!body) return notify("Noi dung thong bao la bat buoc.", "warning");
    await request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        userId: teacher.id,
        title: "Thong bao tu quan tri vien",
        body,
        type: "admin"
      })
    });
    notify(`Da gui thong bao cho ${teacher.name || teacher.email}.`, "success");
    log(`Gui thong bao cho giao vien ${teacher.name || teacher.email}`, "info");
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el || !window.bootstrap) return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide();
  }

  function showModal(id) {
    const el = document.getElementById(id);
    if (!el || !window.bootstrap) return;
    new bootstrap.Modal(el).show();
  }

  function teacherDashboard(teacherId) {
    return state.teacherDashboards.get(teacherId) || { stats: {}, courses: [], todaySessions: [], pendingSubmissions: [] };
  }

  function coursesForTeacher(teacherId) {
    return state.courses.filter(course => course.teacherId === teacherId);
  }

  function renderTeacherManagement() {
    const section = document.getElementById("sec-dsgv");
    if (!section) return;
    const bodies = section.querySelectorAll("table tbody");
    renderTeacherKpis(section);
    if (bodies[0]) renderTeacherMainTable(bodies[0]);
    if (bodies[1]) renderTeacherAccountTable(bodies[1]);
    if (bodies[2]) renderTeacherPermissionTable(bodies[2]);
  }

  function renderTeacherKpis(section) {
    const cards = section.querySelectorAll(".ec-kpi-card");
    const total = state.teachers.length;
    const dashboards = state.teachers.map(teacher => teacherDashboard(teacher.id));
    const pending = dashboards.reduce((sum, item) => sum + number(item.stats && item.stats.pendingGrading), 0);
    const ratings = dashboards.map(item => number(item.stats && item.stats.averageRating)).filter(Boolean);
    const avgRating = ratings.length ? (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1) : "0.0";
    const activeCourses = state.courses.filter(course => course.status === "active" && course.teacherId).length;
    const values = [
      { value: total, sub: "Tai khoan giao vien dang quan ly" },
      { value: avgRating, sub: `Tren ${activeCourses} khoa dang mo` },
      { value: pending, sub: "Bai nop trang thai submitted" },
      { value: "0 VND", sub: "Chua co du lieu thuong" }
    ];
    cards.forEach((card, index) => {
      const h4 = card.querySelector("h4");
      const span = card.querySelector("span");
      if (h4) h4.textContent = values[index].value;
      if (span) span.textContent = values[index].sub;
    });
  }

  function renderTeacherMainTable(tbody) {
    if (!state.teachers.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Chua co giao vien nao.</td></tr>';
      return;
    }
    tbody.innerHTML = state.teachers.map(teacher => {
      const dashboard = teacherDashboard(teacher.id);
      const courses = coursesForTeacher(teacher.id);
      const pending = number(dashboard.stats && dashboard.stats.pendingGrading);
      const rating = number(dashboard.stats && dashboard.stats.averageRating);
      const todaySessions = (dashboard.todaySessions || []).length;
      return `<tr>
        <td><div class="d-flex align-items-center gap-2">${avatar(teacher.name, 32)}<div><strong style="font-size:13px;">${escapeHtml(teacher.name || teacher.email)}</strong><br><span class="text-muted" style="font-size:11px;">${escapeHtml(teacher.experience || teacher.email)}</span></div></div></td>
        <td style="font-size:12px;">${escapeHtml(courses.map(course => course.name).join(", ") || "Chua phan cong")}</td>
        <td><span class="badge badge-opacity-success">${todaySessions} buoi hom nay</span></td>
        <td><span class="${pending ? "text-warning" : "text-success"} fw-bold">${pending} bai</span></td>
        <td>${rating ? rating.toFixed(1) : "0.0"}</td>
        <td class="text-muted fw-bold">0 VND</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-outline-primary py-0 px-2 me-1" style="font-size:11px" onclick="EC_ADMIN_MGMT.editTeacher('${escapeHtml(teacher.id)}')" title="Sua"><i class="mdi mdi-pencil"></i></button>
          <button class="btn btn-xs btn-outline-secondary py-0 px-2 me-1" style="font-size:11px" onclick="EC_ADMIN_MGMT.notifyTeacher('${escapeHtml(teacher.id)}')" title="Thong bao"><i class="mdi mdi-email"></i></button>
          <button class="btn btn-xs btn-outline-danger py-0 px-2" style="font-size:11px" onclick="EC_ADMIN_MGMT.deleteUser('${escapeHtml(teacher.id)}','${escapeHtml(teacher.name || teacher.email)}')" title="Xoa"><i class="mdi mdi-delete"></i></button>
        </td>
      </tr>`;
    }).join("");
  }

  function renderTeacherAccountTable(tbody) {
    if (!state.teachers.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Chua co tai khoan giao vien.</td></tr>';
      return;
    }
    tbody.innerHTML = state.teachers.map(teacher => {
      const online = isOnline(teacher.lastActiveAt);
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;">${avatar(teacher.name, 28)}<strong style="font-size:13px;">${escapeHtml(teacher.name || teacher.email)}</strong></div></td>
        <td><code style="background:#f1f5f9;color:#374151;padding:2px 7px;border-radius:5px;font-size:12px;">${escapeHtml(teacher.email)}</code></td>
        <td style="font-size:12px;color:#64748b;">${dateLabel(teacher.lastActiveAt)}</td>
        <td><span style="background:${online ? "#d1fae5" : "#f1f5f9"};color:${online ? "#059669" : "#64748b"};border-radius:20px;padding:2px 9px;font-size:11px;font-weight:700;">${online ? "Dang online" : "Offline"}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-outline-primary py-0 px-2 me-1" style="font-size:11px" onclick="EC_ADMIN_MGMT.editTeacher('${escapeHtml(teacher.id)}')" title="Sua"><i class="mdi mdi-pencil"></i></button>
          <button class="btn btn-xs btn-outline-danger py-0 px-2" style="font-size:11px" onclick="EC_ADMIN_MGMT.deleteUser('${escapeHtml(teacher.id)}','${escapeHtml(teacher.name || teacher.email)}')" title="Xoa"><i class="mdi mdi-delete"></i></button>
        </td>
      </tr>`;
    }).join("");
  }

  function renderTeacherPermissionTable(tbody) {
    const rows = state.courses.filter(course => course.teacherId);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Chua co khoa hoc nao duoc phan cong giao vien.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(course => {
      const teacher = state.teachers.find(item => item.id === course.teacherId);
      const teacherName = teacher ? teacher.name : course.teacherName || "Khong ro";
      const check = '<i class="mdi mdi-check-circle" style="color:#10b981;font-size:16px;"></i>';
      return `<tr>
        <td><div style="display:flex;align-items:center;gap:8px;">${avatar(teacherName, 32)}<div><div style="font-size:13px;font-weight:700;">${escapeHtml(teacherName)}</div><div style="font-size:10px;color:#94a3b8;">${escapeHtml(teacher ? teacher.email : "")}</div></div></div></td>
        <td><span class="ec-badge ec-badge-purple" style="font-size:10px;">${escapeHtml(course.name)}</span></td>
        <td><span class="ec-badge ec-badge-purple">Chu nhiem</span></td>
        <td>${check}</td>
        <td>${check}</td>
        <td>${check}</td>
        <td>${check}</td>
        <td><button class="btn btn-xs btn-outline-primary py-0 px-2" onclick="EC_ADMIN_MGMT.editTeacher('${escapeHtml(course.teacherId)}')"><i class="mdi mdi-pencil"></i></button></td>
      </tr>`;
    }).join("");
  }

  function exportStudents() {
    const rows = state.studentRows || buildStudentRows();
    const csv = "Ho ten,Lop,Email,SDT,Khoa hoc,Giao vien,Tien do,Trang thai\n"
      + rows.map(row => [row.ten, row.lop, row.email, row.sdt, row.khoa, row.gv, `${row.pr}%`, row.tt].map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "danh_sach_hoc_vien_mysql.csv";
    link.click();
    URL.revokeObjectURL(url);
    notify(`Da xuat ${rows.length} hoc vien.`, "success");
  }

  async function loadTeacherDashboards() {
    state.teacherDashboards.clear();
    const results = await Promise.allSettled(state.teachers.map(teacher =>
      request(`/api/dashboard/teacher?teacherId=${encodeURIComponent(teacher.id)}`, { method: "GET" })
        .then(data => [teacher.id, data.dashboard])
    ));
    results.forEach(result => {
      if (result.status === "fulfilled") state.teacherDashboards.set(result.value[0], result.value[1]);
    });
  }

  async function loadAdminManagementData() {
    if (!token()) return;
    try {
      const [studentData, teacherData, courseData, enrollmentData] = await Promise.all([
        request("/api/users?role=student&limit=500", { method: "GET" }),
        request("/api/users?role=teacher&limit=500", { method: "GET" }),
        request("/api/courses", { method: "GET" }),
        request("/api/enrollments?limit=1000", { method: "GET" })
      ]);
      state.students = studentData.users || [];
      state.teachers = teacherData.users || [];
      state.courses = courseData.courses || [];
      state.enrollments = enrollmentData.enrollments || [];
      fillCourseSelects();
      await loadTeacherDashboards();
      renderStudents();
      renderTeacherManagement();
    } catch (error) {
      notify(error.message || "Khong tai duoc du lieu quan ly.", "error");
    }
  }

  function hookModalReset() {
    document.querySelectorAll('[data-bs-target="#modalThemHV"]').forEach(button => {
      button.addEventListener("click", resetStudentModal);
    });
    document.querySelectorAll('[data-bs-target="#modalThemGV"]').forEach(button => {
      button.addEventListener("click", resetTeacherModal);
    });
  }

  function installOverrides() {
    window.unifiedRender = renderStudents;
    window.renderFullHVTable = renderStudents;
    window.exportDanhSachHV = exportStudents;
    window.saveHocVien = function() { saveStudent().catch(error => notify(error.message, "error")); };
    window.saveGiaoVien = function() { saveTeacher().catch(error => notify(error.message, "error")); };
    window.capTaiKhoan = function() { quickCreateTeacher().catch(error => notify(error.message, "error")); };
    window.EC_ADMIN_MGMT = {
      refresh: loadAdminManagementData,
      showStudent,
      editStudent: openStudentEditor,
      editTeacher: openTeacherEditor,
      deleteUser: (userId, name) => deleteUser(userId, name).catch(error => notify(error.message, "error")),
      notifyTeacher: teacherId => notifyTeacher(teacherId).catch(error => notify(error.message, "error"))
    };
  }

  ready(() => {
    installOverrides();
    hookModalReset();
    setTimeout(loadAdminManagementData, 250);
  });
})();
