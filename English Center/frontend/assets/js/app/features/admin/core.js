(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const state = {
    loaded: false,
    loading: false,
    courses: [],
    teachers: [],
    students: [],
    enrollments: [],
    sessions: [],
    notifications: [],
    materialRequests: [],
    questions: [],
    dashboard: null,
    khFilter: "all",
    honorStudentIds: new Set()
  };

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function request(path, options) {
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
      .toLowerCase()
      .trim();
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function money(value) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(number(value))) + " VND";
  }

  function dateLabel(value, withTime) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
    });
  }

  function isoLocal(date) {
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function badge(text, kind) {
    const map = {
      success: "ec-badge-success",
      warning: "ec-badge-warning",
      danger: "ec-badge-danger",
      info: "ec-badge-info",
      purple: "ec-badge-purple"
    };
    return `<span class="ec-badge ${map[kind] || "ec-badge-info"}" style="font-size:10px;">${escapeHtml(text)}</span>`;
  }

  function progressBar(value) {
    const pct = Math.max(0, Math.min(100, number(value)));
    const cls = pct >= 75 ? "bg-success" : pct >= 45 ? "bg-warning" : "bg-danger";
    return `<div style="display:flex;align-items:center;gap:7px;min-width:120px;">
      <div class="progress flex-grow-1" style="height:6px;"><div class="progress-bar ${cls}" style="width:${pct}%"></div></div>
      <span style="font-size:12px;font-weight:700;color:#0f172a;min-width:34px;">${pct.toFixed(0)}%</span>
    </div>`;
  }

  function studentById(id) {
    return state.students.find(item => item.id === id) || null;
  }

  function courseById(id) {
    return state.courses.find(item => item.id === id) || null;
  }

  function enrollmentsByStudent(id) {
    return state.enrollments.filter(item => item.userId === id);
  }

  function riskStudents() {
    const ids = new Set();
    state.enrollments.forEach(row => {
      if (number(row.progress) < 45 || number(row.absences) >= 2 || (number(row.averageScore) > 0 && number(row.averageScore) < 6)) {
        ids.add(row.userId);
      }
    });
    return state.students.filter(item => ids.has(item.id));
  }

  function inactiveStudents() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return state.students.filter(item => {
      if (!item.lastActiveAt) return true;
      const last = new Date(item.lastActiveAt);
      return Number.isNaN(last.getTime()) || Date.now() - last.getTime() > sevenDays;
    });
  }

  function newStudents() {
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    return state.students.filter(item => {
      const created = new Date(item.createdAt || 0);
      return !Number.isNaN(created.getTime()) && Date.now() - created.getTime() <= fourteenDays;
    });
  }

  function renderAll() {
    const renderers = window.EC_ADMIN_RENDERERS || {};
    ["overview", "courses", "finance", "approvals", "notifications", "honor", "schedule", "materials", "reports"].forEach(key => {
      if (typeof renderers[key] === "function") renderers[key]();
    });
  }

  function renderActive(sectionId) {
    if (!state.loaded) return;
    const renderers = window.EC_ADMIN_RENDERERS || {};
    const map = {
      "sec-dskh": ["courses"],
      "overview": ["overview"],
      "sec-khstats": ["courses"],
      "sec-taichinh": ["finance"],
      "sec-thongbao": ["notifications"],
      "sec-vinhdanh": ["honor"],
      "sec-duyet-lich": ["approvals"],
      "sec-hoidap": ["approvals"],
      "sec-dethi": ["schedule"],
      "sec-tailieu": ["materials"],
      "sec-baocao": ["reports"]
    };
    (map[sectionId] || []).forEach(key => {
      if (typeof renderers[key] === "function") renderers[key]();
    });
    if (sectionId === "sec-dshv" || sectionId === "sec-dsgv") {
      if (window.EC_ADMIN_MGMT && typeof window.EC_ADMIN_MGMT.refresh === "function") {
        window.EC_ADMIN_MGMT.refresh();
      }
    }
  }

  async function loadAll(silent) {
    if (state.loading) return;
    state.loading = true;
    try {
      const [courses, teachers, students, enrollments, sessions, notifications, materials, questions, dashboard] = await Promise.all([
        request("/api/courses"),
        request("/api/users?role=teacher&limit=500"),
        request("/api/users?role=student&limit=500"),
        request("/api/enrollments?limit=1000"),
        request("/api/class-sessions?limit=1000"),
        request("/api/notifications?limit=100"),
        request("/api/material-requests?limit=300"),
        request("/api/questions?limit=300"),
        request("/api/dashboard/admin")
      ]);
      state.courses = courses.courses || [];
      state.teachers = teachers.users || [];
      state.students = students.users || [];
      state.enrollments = enrollments.enrollments || [];
      state.sessions = sessions.sessions || [];
      state.notifications = notifications.notifications || [];
      state.materialRequests = materials.requests || [];
      state.questions = questions.questions || [];
      state.dashboard = dashboard.dashboard || null;
      state.loaded = true;
      renderAll();
      if (!silent) notify("Du lieu da duoc cap nhat.", "success");
    } catch (error) {
      if (!silent) notify(error.message, "danger");
      console.error(error);
    } finally {
      state.loading = false;
    }
  }

  window.EC_ADMIN_RENDERERS = window.EC_ADMIN_RENDERERS || {};
  window.EC_ADMIN_OPS = window.EC_ADMIN_OPS || {};
  window.EC_ADMIN_CORE = {
    state,
    ready,
    request,
    notify,
    log,
    escapeHtml,
    normalize,
    number,
    money,
    dateLabel,
    isoLocal,
    badge,
    progressBar,
    studentById,
    courseById,
    enrollmentsByStudent,
    riskStudents,
    inactiveStudents,
    newStudents,
    renderAll,
    renderActive,
    loadAll
  };
})();
