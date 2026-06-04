(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const USER_KEY = "ec_current_user";
  const state = {
    user: null,
    dashboard: null,
    courses: [],
    students: [],
    enrollments: [],
    sessions: [],
    materials: [],
    exams: [],
    notifications: [],
    questions: [],
    selectedStudentIds: new Set(),
    renderedStudents: [],
    currentStudentId: "",
    aiDraft: "",
    clecExercises: [],
    clecAttachments: [],
    examQuestions: [],
    questionBank: [],
    currentSection: "dashboard",
    currentGradeId: "",
    currentAttendanceSessionId: ""
  };

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function currentUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }

  async function request(path, options) {
    const response = await fetch(path, {
      ...(options || {}),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        ...((options && options.headers) || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || "Yeu cau khong thanh cong.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function initials(name) {
    const parts = String(name || "HS").trim().split(/\s+/).filter(Boolean);
    return parts.slice(-2).map(part => part.charAt(0)).join("").toUpperCase() || "HS";
  }

  function moneyDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function timeOnly(value) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }

  function dateOnly(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function toCsv(rows) {
    return rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i += 1;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n") {
        row.push(cell.replace(/\r$/, ""));
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
    if (cell || row.length) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
    }
    return rows.filter(item => item.some(value => String(value || "").trim()));
  }

  function generatedStudentEmail(name) {
    const slug = String(name || "hocvien").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "hocvien";
    return `${slug}.${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}@example.com`;
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function currentStudentRows() {
    return state.renderedStudents && state.renderedStudents.length ? state.renderedStudents : state.students;
  }

  function notify(message, type) {
    if (typeof window.toast === "function") window.toast(message, type || "success");
  }

  function toast(message, type) {
    const wrap = document.getElementById("toastWrap");
    if (!wrap) return;
    const el = document.createElement("div");
    el.className = `toast ${type === "error" ? "error" : type === "info" ? "info" : ""}`;
    el.innerHTML = `<i class="bi ${type === "error" ? "bi-exclamation-circle-fill" : "bi-check-circle-fill"}"></i><span>${escapeHtml(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.animation = "slideOut .25s ease forwards";
      setTimeout(() => el.remove(), 260);
    }, 2600);
  }

  function clearSession() {
    if (window.EC_AUTH && typeof window.EC_AUTH.clearSession === "function") {
      window.EC_AUTH.clearSession();
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function setDashboardStatus(title, subtitle) {
    setText("#wTitle", title);
    const sub = document.querySelector("#s-dashboard .topbar-sub");
    if (sub) sub.textContent = subtitle || "";
  }

  function renderUnavailableState(message) {
    const bodyA = document.getElementById("teacherAttentionBody") || document.querySelectorAll("#s-dashboard table tbody")[0];
    const bodyB = document.getElementById("teacherPendingBody") || document.querySelectorAll("#s-dashboard table tbody")[1];
    setText("#attentionCount", "0 truong hop");
    setText("#teacherPendingCount", "0 bai");
    setText("#teacherTodoCount", "0 viec");
    if (bodyA) bodyA.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ink4);padding:20px">${escapeHtml(message)}</td></tr>`;
    if (bodyB) bodyB.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--ink4);padding:20px">${escapeHtml(message)}</td></tr>`;
    const todo = document.getElementById("teacherTodoList");
    if (todo) todo.innerHTML = `<div style="text-align:center;color:var(--ink4);padding:16px 0">${escapeHtml(message)}</div>`;
  }

  function showLoginRequired() {
    clearSession();
    state.user = null;
    setText("#sbName", "Chua dang nhap");
    setText("#sbEmail", "Vui long dang nhap lai");
    setDashboardStatus("Chua dang nhap", "Dang chuyen ve trang dang nhap de lay lai phien lam viec.");
    renderUnavailableState("Can dang nhap de xem du lieu giao vien.");
    sessionStorage.setItem("ec_after_login", "dashboard_giaovien.html");
    setTimeout(() => {
      if (location.pathname.toLowerCase().includes("dashboard_giaovien")) location.href = "dangnhap.html";
    }, 700);
  }

  function showRefreshError(error) {
    if (error && (error.status === 401 || error.status === 403)) {
      showLoginRequired();
      return;
    }
    setDashboardStatus("Khong tai duoc dashboard", error.message || "Backend chua tra du lieu thanh cong.");
    renderUnavailableState("Khong tai duoc du lieu. Vui long thu lai sau.");
    notify(error.message || "Khong tai duoc dashboard.", "error");
  }

  function studentStatus(progress, score, absences) {
    if (Number(absences || 0) >= 4) return { label: "Vang hoc", bg: "#fef3c7", color: "#d97706" };
    if (Number(score || 0) >= 8.5 || Number(progress || 0) >= 90) return { label: "Xuat sac", bg: "#ede9fe", color: "#6d28d9" };
    if (Number(score || 0) >= 7 || Number(progress || 0) >= 65) return { label: "Hoc tot", bg: "#d1fae5", color: "#059669" };
    if (Number(score || 0) < 6 || Number(progress || 0) < 45) return { label: "Can ho tro", bg: "#fee2e2", color: "#dc2626" };
    return { label: "Trung binh", bg: "#f1f5f9", color: "#64748b" };
  }

  function mapEnrollment(item, index) {
    const status = studentStatus(item.progress, item.averageScore, item.absences);
    const gradients = ["135deg,#7c3aed,#a78bfa", "135deg,#2563eb,#60a5fa", "135deg,#059669,#34d399", "135deg,#d97706,#fbbf24", "135deg,#ef4444,#f87171", "135deg,#0891b2,#22d3ee"];
    return {
      id: item.userId,
      enrollmentId: item.id,
      courseId: item.courseId,
      n: item.studentName || item.studentEmail || "Hoc sinh",
      i: initials(item.studentName || item.studentEmail),
      g: gradients[index % gradients.length],
      l: item.courseName || "Chua co lop",
      pr: Math.round(Number(item.progress || 0)),
      sc: Number(item.averageScore || 0),
      ab: Number(item.absences || 0),
      nop: Number(item.submissions || 0),
      st: status.label,
      sb: status.bg,
      st2: status.color,
      phone: item.studentPhone || item.studentEmail || "-",
      email: item.studentEmail || "",
      note: ""
    };
  }

  function setText(selector, value, root) {
    const el = (root || document).querySelector(selector);
    if (el) el.textContent = value;
  }

  function setOptions(select, rows, allLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${escapeHtml(allLabel || "Tat ca")}</option>` + rows.map(row => (
      `<option value="${escapeHtml(row.value || row.id || row.name)}">${escapeHtml(row.label || row.name)}</option>`
    )).join("");
    if (Array.from(select.options).some(option => option.value === current)) select.value = current;
  }

  function syncCourseSelects() {
    const rows = state.courses.map(course => ({ value: course.id, label: course.name }));
    setOptions(document.getElementById("newSchLop"), rows, "Chon lop hoc");
    setOptions(document.getElementById("clecClass"), rows, "Chon lop hoc");
    setOptions(document.querySelector("#s-taode .fr select"), rows, "Chon lop hoc");
    setOptions(document.getElementById("fcl"), state.courses.map(course => ({ value: course.name, label: course.name })), "Tat ca lop");
    setOptions(document.getElementById("lgFilter"), state.courses.map(course => ({ value: course.name, label: course.name })), "Tat ca lop");
    setOptions(document.getElementById("fbFilterLop"), state.courses.map(course => ({ value: course.name, label: course.name })), "Tat ca lop");
    setOptions(document.getElementById("schFilterLop"), state.courses.map(course => ({ value: course.name, label: course.name })), "Tat ca lop");
    setOptions(document.getElementById("rptChartLop"), state.courses.map(course => ({ value: course.name, label: course.name })), "Tat ca lop");

    const addStudentSelect = document.getElementById("newHsLop");
    if (addStudentSelect) {
      addStudentSelect.innerHTML = state.courses.map(course => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)}</option>`).join("");
    }

    const bulk = document.querySelector("#bulkMsgPanel div[style*='flex-wrap']");
    if (bulk) {
      bulk.innerHTML = `<div class="cls-chip sel" onclick="toggleChip(this,'all')" data-lop="all">Tat ca lop</div>` +
        state.courses.map(course => {
          const count = state.students.filter(student => student.courseId === course.id).length;
          return `<div class="cls-chip" onclick="toggleChip(this,'${escapeHtml(course.id)}')" data-lop="${escapeHtml(course.id)}">${escapeHtml(course.name)} (${count})</div>`;
        }).join("");
    }
  }

  function applyIdentity() {
    const user = state.user || currentUser() || {};
    const name = user.name || "Giao vien";
    const email = user.email || "";
    const ini = initials(name);
    setText("#sbName", name);
    setText("#sbEmail", email);
    setText("#setDisp", name);
    const nameInput = document.getElementById("setName");
    if (nameInput) nameInput.value = name;
    const emailInput = document.getElementById("setEmailUser");
    if (emailInput) emailInput.value = email.split("@")[0] || "";
    const avatar = document.getElementById("sbAva");
    const big = document.getElementById("bigAvaText");
    if (avatar && !localStorage.getItem("ec_teacher_avatar")) avatar.textContent = ini;
    if (big && !localStorage.getItem("ec_teacher_avatar")) big.textContent = ini;
    const title = document.getElementById("wTitle");
    if (title) {
      const hour = new Date().getHours();
      const greet = hour < 12 ? "Chao buoi sang" : hour < 18 ? "Chao buoi chieu" : "Chao buoi toi";
      title.textContent = `${greet}, ${name.split(/\s+/).pop() || name}!`;
    }
  }

  function renderDashboard() {
    const stats = (state.dashboard && state.dashboard.stats) || {};
    const values = document.querySelectorAll(".sg .sv");
    if (values[0]) values[0].textContent = stats.totalStudents || 0;
    if (values[1]) values[1].textContent = stats.activeCourses || 0;
    if (values[2]) values[2].textContent = stats.pendingGrading || 0;
    if (values[3]) values[3].textContent = `${Number(stats.averageRating || 0).toFixed(1)} sao`;
    const sub = document.querySelector("#s-dashboard .topbar-sub");
    if (sub) {
      const sessionsToday = (state.dashboard.todaySessions || []).length;
      sub.textContent = `Ban co ${stats.pendingGrading || 0} bai nop can cham va ${sessionsToday} buoi day hom nay.`;
    }
    renderAttentionTable();
    renderPendingSubmissions();
    renderTodaySessions();
    renderTodoList();
  }

  function renderAttentionTable() {
    const body = document.getElementById("teacherAttentionBody") || document.querySelectorAll("#s-dashboard table tbody")[0];
    if (!body) return;
    const rows = (state.dashboard.attentionStudents || []).slice(0, 6);
    setText("#attentionCount", `${rows.length} truong hop`);
    body.innerHTML = rows.length ? rows.map(item => {
      const st = studentStatus(item.progress, item.averageScore, item.absences);
      const issue = Number(item.absences || 0) >= 2
        ? `Vang ${item.absences} buoi`
        : Number(item.averageScore || 0) < 6
          ? `Diem TB ${item.averageScore}/10`
          : `Tien do ${Math.round(item.progress)}%`;
      return `<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="ava" style="background:linear-gradient(135deg,#ef4444,#f87171)">${escapeHtml(initials(item.name))}</div><span style="font-weight:600">${escapeHtml(item.name)}</span></div></td>` +
        `<td style="color:var(--ink3)">${escapeHtml(item.courseName || "")}</td><td style="color:var(--ink3)">${escapeHtml(issue)}</td>` +
        `<td style="text-align:right"><span class="tag" style="background:${st.bg};color:${st.color}">${st.label}</span></td></tr>`;
    }).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--ink4);padding:20px">Chua co hoc sinh can chu y.</td></tr>`;
  }

  function renderPendingSubmissions() {
    const body = document.getElementById("teacherPendingBody") || document.querySelectorAll("#s-dashboard table tbody")[1];
    if (!body) return;
    const rows = state.dashboard.pendingSubmissions || [];
    setText("#teacherPendingCount", `${rows.length} bai`);
    body.innerHTML = rows.length ? rows.map(item => (
      `<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="ava" style="background:linear-gradient(135deg,#2563eb,#60a5fa)">${escapeHtml(initials(item.studentName))}</div><span style="font-weight:600">${escapeHtml(item.studentName)}</span></div></td>` +
      `<td style="color:var(--ink3)">${escapeHtml(item.title)}</td><td><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(item.courseName)}</span></td>` +
      `<td style="text-align:right;color:var(--ink4)">${escapeHtml(moneyDate(item.submittedAt))}</td>` +
      `<td style="text-align:right"><button onclick="EC_TEACHER.openGrade('${escapeHtml(item.id)}')" class="btn-cham" style="background:var(--purple);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">Cham bai</button></td></tr>`
    )).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--ink4);padding:20px">Chua co bai nop dang cho cham.</td></tr>`;
  }

  function renderTodoList() {
    const box = document.getElementById("teacherTodoList");
    if (!box) return;
    const todos = [];
    const pending = state.dashboard.pendingSubmissions || [];
    const sessions = state.dashboard.todaySessions || [];
    const rejected = state.materials.filter(item => item.status === "rejected");

    if (pending.length) {
      todos.push({ title: `Cham ${pending.length} bai nop`, sub: "Bai nop dang cho cham", tone: "var(--red)", done: false });
    }
    if (sessions.length) {
      todos.push({ title: `Day ${sessions.length} buoi hom nay`, sub: sessions.map(item => item.courseName).filter(Boolean).join(", "), tone: "var(--purple)", done: false });
    }
    if (rejected.length) {
      todos.push({ title: `Chinh sua ${rejected.length} bai giang`, sub: "Admin yeu cau cap nhat noi dung", tone: "var(--amber)", done: false });
    }

    setText("#teacherTodoCount", todos.length ? `${todos.length} viec` : "0 viec");
    box.innerHTML = todos.length ? todos.map(todo => (
      `<div class="tr2"><input type="checkbox" class="tcb" ${todo.done ? "checked" : ""} disabled>` +
      `<div style="flex:1"><div style="font-size:13.5px;font-weight:600">${escapeHtml(todo.title)}</div>` +
      `<div style="font-size:12px;color:var(--ink3)">${escapeHtml(todo.sub || "Can xu ly")}</div></div>` +
      `<span style="font-size:12px;font-weight:600;color:${todo.tone}">API</span></div>`
    )).join("") : `<div style="text-align:center;color:var(--ink4);padding:16px 0">Khong co nhiem vu can lam.</div>`;
  }

  function renderSt() {
    const cl = (document.getElementById("fcl") || {}).value || "";
    const st = (document.getElementById("fst") || {}).value || "";
    const q = ((document.getElementById("fq") || {}).value || "").toLowerCase();
    const sortV = (document.getElementById("fsort") || {}).value || "name";
    const stNorm = normalizeText(st);
    let rows = state.students.filter(student =>
      (!cl || student.l === cl) &&
      (!st || normalizeText(student.st) === stNorm) &&
      (!q || student.n.toLowerCase().includes(q) || student.email.toLowerCase().includes(q))
    );
    rows = rows.slice().sort((a, b) => {
      if (sortV === "score_desc") return b.sc - a.sc;
      if (sortV === "score_asc") return a.sc - b.sc;
      if (sortV === "progress") return b.pr - a.pr;
      if (sortV === "absent") return b.ab - a.ab;
      return a.n.localeCompare(b.n, "vi");
    });
    state.renderedStudents = rows;
    setText("#stCnt", `${rows.length} hoc sinh`);
    setText("#hsSubtitle", `${state.students.length} hoc sinh trong ${state.courses.length} lop hoc`);
    const body = document.getElementById("stBody");
    if (!body) return;
    body.innerHTML = rows.length ? rows.map(student => {
      const idx = state.students.indexOf(student);
      const scoreColor = student.sc >= 8 ? "var(--green)" : student.sc >= 6.5 ? "var(--amber)" : "var(--red)";
      const absentColor = student.ab > 2 ? "var(--red)" : student.ab > 0 ? "var(--amber)" : "var(--green)";
      return `<tr><td><input type="checkbox" class="tcb-sel" data-id="${escapeHtml(student.id)}" ${state.selectedStudentIds.has(student.id) ? "checked" : ""} style="width:15px;height:15px;accent-color:var(--purple);cursor:pointer"></td>` +
        `<td><div style="display:flex;align-items:center;gap:10px"><div class="ava" style="background:linear-gradient(${student.g})">${escapeHtml(student.i)}</div><div><div style="font-weight:700;color:var(--ink)">${escapeHtml(student.n)}</div><div style="font-size:11px;color:var(--ink4)">${escapeHtml(student.phone)}</div></div></div></td>` +
        `<td><span class="tag" style="background:#f1f5f9;color:var(--ink2);font-size:11px">${escapeHtml(student.l)}</span></td>` +
        `<td style="min-width:130px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink4);margin-bottom:3px"><span>Hoan thanh</span><span>${student.pr}%</span></div><div class="pb"><div class="pf" style="width:${student.pr}%;background:var(--purple)"></div></div></td>` +
        `<td style="text-align:center"><span style="font-size:15px;font-weight:800;color:${scoreColor}">${student.sc}</span><span style="font-size:10px;color:var(--ink4)">/10</span></td>` +
        `<td style="text-align:center"><span style="font-size:13px;font-weight:700">${student.nop}</span><div style="font-size:10px;color:var(--ink4)">bai</div></td>` +
        `<td style="text-align:center"><span style="font-size:13px;font-weight:700;color:${absentColor}">${student.ab}</span><div style="font-size:10px;color:var(--ink4)">buoi</div></td>` +
        `<td style="text-align:center"><span class="tag" style="background:${student.sb};color:${student.st2}">${student.st}</span></td>` +
        `<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap"><button data-id="${escapeHtml(student.id)}" class="btn-xem-hs btn-sm sec" style="padding:4px 9px;font-size:11.5px"><i class="bi bi-person-lines-fill"></i> Ho so</button><button data-id="${escapeHtml(student.id)}" class="btn-nhank-hs btn-sm prim" style="padding:4px 9px;font-size:11.5px"><i class="bi bi-chat-dots-fill"></i> Nhan</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--ink4);padding:28px">Khong co hoc sinh phu hop.</td></tr>`;
    updateSelectionUi();
  }

  async function addNewStudent() {
    const name = (document.getElementById("newHsName").value || "").trim();
    const phone = (document.getElementById("newHsPhone").value || "").trim();
    const courseId = document.getElementById("newHsLop").value || "";
    if (!name) return notify("Vui long nhap ho ten hoc sinh.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    const email = generatedStudentEmail(name);
    const data = await request("/api/users", {
      method: "POST",
      body: JSON.stringify({ name, phone, email, role: "student", password: "student123", courseId })
    });
    notify(`Da them hoc sinh. Email: ${data.user.email} - mat khau: ${data.defaultPassword || "student123"}`);
    document.getElementById("newHsName").value = "";
    document.getElementById("newHsPhone").value = "";
    document.getElementById("addHsForm").classList.remove("show");
    await refresh();
  }

  function toggleBulkMsg() {
    const panel = document.getElementById("bulkMsgPanel");
    if (panel) panel.style.display = panel.style.display === "none" || !panel.style.display ? "block" : "none";
  }

  function toggleAddHs() {
    const form = document.getElementById("addHsForm");
    if (form) form.classList.toggle("show");
  }

  function toggleChip(el) {
    const wrap = el && el.parentElement;
    if (!wrap) return;
    wrap.querySelectorAll(".cls-chip").forEach(item => item.classList.remove("sel"));
    el.classList.add("sel");
  }

  function updateSelectionUi() {
    const count = state.selectedStudentIds.size;
    const countEl = document.getElementById("selCount");
    const deleteBtn = document.getElementById("btnDelSel");
    const selAll = document.getElementById("selAll");
    if (countEl) {
      countEl.style.display = count ? "" : "none";
      countEl.textContent = `${count} hoc sinh da chon`;
    }
    if (deleteBtn) deleteBtn.style.display = count ? "" : "none";
    if (selAll) {
      const visible = currentStudentRows();
      selAll.checked = Boolean(visible.length) && visible.every(student => state.selectedStudentIds.has(student.id));
    }
  }

  function toggleSelectAll(input) {
    const checked = Boolean(input && input.checked);
    currentStudentRows().forEach(student => {
      if (checked) state.selectedStudentIds.add(student.id);
      else state.selectedStudentIds.delete(student.id);
    });
    document.querySelectorAll("#stBody .tcb-sel").forEach(box => { box.checked = checked; });
    updateSelectionUi();
  }

  function setSortHs(sort) {
    const select = document.getElementById("fsort");
    if (select) select.value = sort || "name";
    renderSt();
  }

  function exportStudentList() {
    const rows = currentStudentRows();
    const csv = toCsv([
      ["Name", "Email", "Phone", "Course", "Progress", "Average score", "Submissions", "Absences", "Status"],
      ...rows.map(student => [student.n, student.email, student.phone, student.l, student.pr, student.sc, student.nop, student.ab, student.st])
    ]);
    downloadText(`teacher-students-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  }

  function importCSV() {
    let input = document.getElementById("teacherCsvImport");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.id = "teacherCsvImport";
      input.accept = ".csv,text/csv";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => handleStudentCsv(input).catch(error => notify(error.message, "error")));
    }
    input.value = "";
    input.click();
  }

  async function handleStudentCsv(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) return notify("File CSV khong co du lieu.", "error");
    const headers = rows[0].map(item => String(item || "").trim().toLowerCase());
    const hasHeader = headers.some(item => ["name", "ho ten", "họ tên", "phone", "email", "course", "lop", "lớp"].includes(item));
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const indexOf = names => {
      const idx = headers.findIndex(header => names.includes(header));
      return idx >= 0 ? idx : -1;
    };
    const nameIdx = hasHeader ? indexOf(["name", "ho ten", "họ tên", "ten", "tên"]) : 0;
    const phoneIdx = hasHeader ? indexOf(["phone", "sdt", "so dien thoai", "số điện thoại"]) : 1;
    const emailIdx = hasHeader ? indexOf(["email"]) : 2;
    const courseIdx = hasHeader ? indexOf(["course", "courseid", "course id", "lop", "lớp", "class"]) : 3;
    const fallbackCourseId = document.getElementById("newHsLop")?.value || state.courses[0]?.id || "";
    let created = 0;
    for (const row of dataRows) {
      const name = String(row[nameIdx] || "").trim();
      if (!name) continue;
      const courseRaw = String(row[courseIdx] || "").trim();
      const course = state.courses.find(item => item.id === courseRaw || item.name.toLowerCase() === courseRaw.toLowerCase());
      const courseId = (course && course.id) || fallbackCourseId;
      if (!courseId) throw new Error("CSV can co lop hoc hoac giao vien phai co it nhat mot lop.");
      await request("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone: phoneIdx >= 0 ? row[phoneIdx] || "" : "",
          email: emailIdx >= 0 && row[emailIdx] ? row[emailIdx] : generatedStudentEmail(name),
          role: "student",
          password: "student123",
          courseId
        })
      });
      created += 1;
    }
    notify(`Da import ${created} hoc sinh.`);
    await refresh();
  }

  function openStudentModal(studentId, focusMessage) {
    const student = state.students.find(item => item.id === studentId);
    if (!student) return;
    state.currentStudentId = student.id;
    setText("#hsName", student.n);
    setText("#hsLop", student.l);
    setText("#hsScore", `${Number(student.sc || 0).toFixed(1)}/10`);
    setText("#hsNop", `${student.nop} bai`);
    setText("#hsAbsent", `${student.ab} buoi`);
    setText("#hsPhone", student.phone || student.email || "-");
    setText("#hsProgTxt", `${student.pr}%`);
    const prog = document.getElementById("hsProg");
    if (prog) prog.style.width = `${student.pr}%`;
    const status = document.getElementById("hsStatus");
    if (status) {
      status.textContent = student.st;
      status.style.background = student.sb;
      status.style.color = student.st2;
    }
    const note = document.getElementById("hsNote");
    if (note) note.value = localStorage.getItem(`ec_teacher_note_${student.id}`) || "";
    setText("#hsMsgTarget", student.n);
    const modal = document.getElementById("hsModal");
    if (modal) modal.classList.add("show");
    if (focusMessage) setTimeout(() => document.getElementById("hsMsgTa")?.focus(), 0);
  }

  function saveHsNote() {
    if (!state.currentStudentId) return;
    localStorage.setItem(`ec_teacher_note_${state.currentStudentId}`, document.getElementById("hsNote")?.value || "");
    notify("Da luu ghi chu hoc sinh.");
  }

  function renderLectures() {
    const filter = document.getElementById("lgFilter").value || "";
    const sort = document.getElementById("lgSort").value || "date";
    let rows = state.materials.filter(item => item.type === "lesson" || item.type === "document");
    if (filter) rows = rows.filter(item => item.courseName === filter);
    if (sort === "views" || sort === "likes") rows = rows.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    const grid = document.getElementById("lgrid");
    if (!grid) return;
    const subtitle = document.querySelector("#s-baigiang .topbar-sub");
    if (subtitle) subtitle.textContent = `${rows.length} noi dung da gui duyet`;
    grid.innerHTML = rows.length ? rows.map(item => {
      const badge = materialStatus(item.status);
      return `<div class="col-lg-3 col-md-4 col-6"><div class="lc"><div class="lt" style="background:#ede9fe"><i class="bi bi-camera-video-fill" style="font-size:32px;color:var(--purple)"></i></div><div class="lb">` +
        `<div style="font-size:13.5px;font-weight:700;margin-bottom:4px;line-height:1.4">${escapeHtml(item.title)}</div>` +
        `<div style="font-size:11.5px;color:var(--ink3);margin-bottom:8px">${escapeHtml(item.courseName || "Chua gan lop")} - ${escapeHtml(moneyDate(item.createdAt))}</div>` +
        `<span class="tag" style="background:${badge.bg};color:${badge.color};font-size:11px">${badge.label}</span>` +
        `${item.videoUrl ? `<span class="tag" style="background:#dbeafe;color:#1d4ed8;font-size:11px;margin-left:5px">Video</span>` : ""}` +
        `${item.documentUrl ? `<span class="tag" style="background:#ecfdf5;color:#047857;font-size:11px;margin-left:5px">Tai lieu</span>` : ""}` +
        `${item.description ? `<div style="font-size:12px;color:var(--ink3);margin-top:8px;line-height:1.5">${escapeHtml(item.description)}</div>` : ""}` +
        `${item.adminNote ? `<div style="font-size:12px;color:var(--ink3);margin-top:8px;line-height:1.5">${escapeHtml(item.adminNote)}</div>` : ""}` +
        `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:12px"><button onclick="EC_TEACHER.previewMaterial('${escapeHtml(item.id)}')" style="flex:1;background:var(--purple);color:#fff;border:none;border-radius:6px;padding:6px;font-size:12px;font-weight:600;cursor:pointer"><i class="bi bi-eye-fill me-1"></i>Xem</button></div>` +
        `</div></div></div>`;
    }).join("") : `<div class="col-12"><div style="text-align:center;color:var(--ink4);padding:38px;background:#fff;border-radius:12px;border:1px solid var(--line)">Chua co bai giang nao. Hay tao noi dung moi de gui duyet.</div></div>`;
  }

  function materialStatus(status) {
    return {
      pending: { label: "Nhap", bg: "#f1f5f9", color: "#64748b" },
      submitted: { label: "Cho duyet", bg: "#fef3c7", color: "#d97706" },
      approved: { label: "Da duyet", bg: "#d1fae5", color: "#059669" },
      rejected: { label: "Can sua", bg: "#fee2e2", color: "#dc2626" }
    }[status] || { label: status || "Moi", bg: "#f1f5f9", color: "#64748b" };
  }

  function openCreateLec() {
    const modal = document.getElementById("createLecModal");
    if (modal) modal.classList.add("show");
  }

  function closeCreateLec() {
    const modal = document.getElementById("createLecModal");
    if (modal) modal.classList.remove("show");
  }

  function switchClecTab(btn, id) {
    document.querySelectorAll(".clec-tab").forEach(tab => {
      tab.classList.remove("active");
      tab.style.borderBottomColor = "transparent";
      tab.style.color = "var(--ink3)";
    });
    if (btn) {
      btn.classList.add("active");
      btn.style.borderBottomColor = "var(--purple)";
      btn.style.color = "var(--purple)";
    }
    ["clec-info", "clec-content", "clec-exercise", "clec-files"].forEach(tabId => {
      const panel = document.getElementById(tabId);
      if (panel) panel.style.display = tabId === id ? "" : "none";
    });
  }

  function handleClecFileSelect(input, type) {
    const file = input.files && input.files[0];
    if (!file) return;
    setClecFileName(type, file.name);
  }

  function handleClecFileDrop(event, type) {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    setClecFileName(type, file.name);
  }

  function setClecFileName(type, name) {
    if (type === "video") {
      const el = document.getElementById("clecVideoName");
      if (el) {
        el.style.display = "block";
        el.textContent = name;
      }
    } else if (type === "slide") {
      setText("#clecSlideName", name);
    } else if (type === "attach") {
      state.clecAttachments.push(name);
      renderAttachList();
    }
  }

  function handleClecAttach(input) {
    Array.from(input.files || []).forEach(file => state.clecAttachments.push(file.name));
    renderAttachList();
  }

  function renderAttachList() {
    const list = document.getElementById("attachList");
    if (!list) return;
    list.innerHTML = state.clecAttachments.length ? state.clecAttachments.map((name, index) => (
      `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff"><i class="bi bi-paperclip"></i><span style="flex:1;font-size:12.5px;font-weight:600">${escapeHtml(name)}</span><button type="button" data-index="${index}" class="btn-remove-attach" style="border:none;background:#fee2e2;color:#dc2626;border-radius:6px;padding:3px 8px;cursor:pointer">x</button></div>`
    )).join("") : "";
  }

  function addExercise(type) {
    const labels = { mc: "Trac nghiem", fill: "Dien vao cho trong", match: "Noi cap", order: "Sap xep cau", h5p: "H5P" };
    state.clecExercises.push({ type, title: labels[type] || "Bai tap" });
    renderExercises();
  }

  function renderExercises() {
    const list = document.getElementById("exerciseList");
    const badge = document.getElementById("exBadge");
    if (badge) badge.textContent = state.clecExercises.length;
    if (!list) return;
    list.innerHTML = state.clecExercises.length ? state.clecExercises.map((item, index) => (
      `<div class="q-item"><button class="q-del btn-remove-exercise" data-index="${index}" type="button">x</button><div style="font-size:13px;font-weight:800;color:var(--ink);margin-bottom:8px">${escapeHtml(item.title)}</div><input data-index="${index}" class="exercise-title" value="${escapeHtml(item.title)}" style="width:100%;border:1.5px solid var(--line);border-radius:6px;padding:8px 10px;font-size:13px;font-family:inherit" placeholder="Mo ta bai tap"></div>`
    )).join("") : `<div id="exEmpty" style="text-align:center;padding:36px;color:var(--ink4);font-size:13.5px"><i class="bi bi-puzzle" style="font-size:32px;display:block;margin-bottom:8px;opacity:.35"></i>Chua co bai tap nao.</div>`;
  }

  async function submitMaterial(status) {
    const title = (document.getElementById("clecTitle").value || "").trim();
    const courseId = document.getElementById("clecClass").value || "";
    const exercises = Array.from(document.querySelectorAll(".exercise-title")).map(input => input.value.trim()).filter(Boolean);
    const description = [
      (document.getElementById("clecDesc").value || "").trim(),
      (document.getElementById("clecGoal").value || "").trim(),
      (document.getElementById("clecNote").value || "").trim(),
      exercises.length ? `Bai tap tuong tac:\n- ${exercises.join("\n- ")}` : "",
      state.clecAttachments.length ? `File dinh kem:\n- ${state.clecAttachments.join("\n- ")}` : ""
    ].filter(Boolean).join("\n\n");
    const videoUrl = (document.getElementById("clecVideoLink").value || "").trim();
    const documentUrl = (document.getElementById("clecDocLink").value || "").trim();
    if (!title) return notify("Vui long nhap tieu de.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    if (status !== "pending" && !videoUrl && !documentUrl && !description) {
      return notify("Vui long them link video, tai lieu hoac noi dung bai hoc truoc khi gui duyet.", "error");
    }
    await request("/api/material-requests", {
      method: "POST",
      body: JSON.stringify({ title, courseId, type: "lesson", status, description, videoUrl, documentUrl })
    });
    notify(status === "pending" ? "Da luu ban nhap." : "Da gui noi dung cho quan tri vien duyet.");
    if (typeof window.closeCreateLec === "function") window.closeCreateLec();
    await refresh();
    if (typeof window.nav === "function") window.nav("baigiang");
  }

  function renderDe() {
    const list = document.getElementById("deList");
    if (!list) return;
    list.innerHTML = state.exams.length ? state.exams.map(exam => {
      const total = Number(exam.submissions || 0);
      const pending = Number(exam.pendingSubmissions || 0);
      return `<div style="padding:13px 0;border-bottom:1px solid var(--line)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="font-size:13.5px;font-weight:700">${escapeHtml(exam.title)}</span><span style="font-size:11.5px;color:var(--ink4)">${escapeHtml(moneyDate(exam.createdAt))}</span></div>` +
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(exam.courseName || "Chua gan lop")}</span><span style="font-size:12px;font-weight:600;color:var(--ink3)">${total} bai nop - ${pending} cho cham</span></div>` +
        `<div style="display:flex;gap:6px"><button onclick="window.nav && nav('dashboard')" style="background:var(--purple-lt);color:var(--purple);border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer"><i class="bi bi-bar-chart-fill me-1"></i>Xem bai nop</button></div></div>`;
    }).join("") : `<div style="text-align:center;color:var(--ink4);padding:30px">Chua co de kiem tra nao.</div>`;
  }

  function switchDeTab(btn, id) {
    document.querySelectorAll("#s-taode .tab-btn").forEach(tab => tab.classList.remove("active"));
    if (btn) btn.classList.add("active");
    ["tab-info", "tab-questions", "tab-history"].forEach(tabId => {
      const el = document.getElementById(tabId);
      if (el) el.style.display = tabId === id ? "" : "none";
    });
  }

  function questionTemplate(type, seed) {
    return {
      id: `q_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: type === "tl" ? "essay" : "multiple_choice",
      content: seed?.content || "",
      options: seed?.options || ["", "", "", ""],
      correctAnswer: seed?.correctAnswer || "A",
      explanation: seed?.explanation || ""
    };
  }

  function addQuestion(type, seed) {
    state.examQuestions.push(questionTemplate(type, seed));
    renderQuestionList();
  }

  function collectExamQuestions() {
    return Array.from(document.querySelectorAll("#questionList .q-item")).map((item, index) => {
      const type = item.dataset.type;
      const content = item.querySelector(".q-content")?.value.trim() || "";
      const explanation = item.querySelector(".q-exp")?.value.trim() || "";
      if (type === "essay") {
        return { questionNo: index + 1, type: "essay", content, options: [], correctAnswer: item.querySelector(".q-answer")?.value.trim() || "", explanation };
      }
      const options = Array.from(item.querySelectorAll(".q-opt-input")).map(input => input.value.trim());
      return { questionNo: index + 1, type: "multiple_choice", content, options, correctAnswer: item.querySelector(".q-correct")?.value || "A", explanation };
    }).filter(item => item.content);
  }

  function renderQuestionList() {
    const list = document.getElementById("questionList");
    const count = state.examQuestions.length;
    setText("#qCount", count);
    setText("#qCountBig", `${count} cau hoi`);
    if (!list) return;
    list.innerHTML = count ? state.examQuestions.map((q, index) => {
      if (q.type === "essay") {
        return `<div class="q-item" data-type="essay" data-id="${q.id}"><button type="button" class="q-del btn-del-question" data-id="${q.id}">x</button><div style="font-size:12px;font-weight:800;color:var(--purple);margin-bottom:8px">Cau ${index + 1} - Tu luan</div><textarea class="q-content" rows="3" style="width:100%;border:1.5px solid var(--line);border-radius:6px;padding:8px 10px;font-family:inherit;font-size:13px" placeholder="Noi dung cau hoi">${escapeHtml(q.content)}</textarea><input class="q-answer" value="${escapeHtml(q.correctAnswer || "")}" style="width:100%;border:1.5px solid var(--line);border-radius:6px;padding:8px 10px;margin-top:8px;font-family:inherit;font-size:13px" placeholder="Dap an goi y"><textarea class="q-exp" rows="2" style="width:100%;border:1.5px solid var(--line);border-radius:6px;padding:8px 10px;margin-top:8px;font-family:inherit;font-size:13px" placeholder="Giai thich">${escapeHtml(q.explanation || "")}</textarea></div>`;
      }
      return `<div class="q-item" data-type="multiple_choice" data-id="${q.id}"><button type="button" class="q-del btn-del-question" data-id="${q.id}">x</button><div style="font-size:12px;font-weight:800;color:var(--purple);margin-bottom:8px">Cau ${index + 1} - Trac nghiem</div><textarea class="q-content" rows="2" style="width:100%;border:1.5px solid var(--line);border-radius:6px;padding:8px 10px;font-family:inherit;font-size:13px" placeholder="Noi dung cau hoi">${escapeHtml(q.content)}</textarea>${["A", "B", "C", "D"].map((label, optIndex) => `<div class="q-opt"><span style="width:22px;font-weight:800;color:var(--ink3)">${label}</span><input class="q-opt-input" value="${escapeHtml(q.options[optIndex] || "")}" style="flex:1;border:1.5px solid var(--line);border-radius:6px;padding:7px 10px;font-size:13px;font-family:inherit" placeholder="Lua chon ${label}"></div>`).join("")}<div style="display:flex;gap:8px"><select class="q-correct" style="border:1.5px solid var(--line);border-radius:6px;padding:7px 10px;font-size:13px"><option ${q.correctAnswer === "A" ? "selected" : ""}>A</option><option ${q.correctAnswer === "B" ? "selected" : ""}>B</option><option ${q.correctAnswer === "C" ? "selected" : ""}>C</option><option ${q.correctAnswer === "D" ? "selected" : ""}>D</option></select><input class="q-exp" value="${escapeHtml(q.explanation || "")}" style="flex:1;border:1.5px solid var(--line);border-radius:6px;padding:7px 10px;font-size:13px;font-family:inherit" placeholder="Giai thich"></div></div>`;
    }).join("") : `<div style="text-align:center;padding:40px;color:var(--ink4);font-size:13.5px"><i class="bi bi-file-earmark-plus" style="font-size:32px;display:block;margin-bottom:8px;opacity:.4"></i>Chua co cau hoi nao.</div>`;
  }

  function shuffleQuestions() {
    state.examQuestions = collectExamQuestions().map((item, index) => ({ ...item, id: state.examQuestions[index]?.id || `q_${index}` })).sort(() => Math.random() - 0.5);
    renderQuestionList();
  }

  function clearQuestions() {
    state.examQuestions = [];
    renderQuestionList();
  }

  function quickTemplate(kind) {
    const title = document.getElementById("tenDe");
    const duration = document.querySelector("#s-taode input[type=number]");
    if (kind === "TN40") {
      if (title) title.value = "De 40 cau trac nghiem chuan THPTQG";
      if (duration) duration.value = 40;
      document.getElementById("deLoai").value = "Trac nghiem";
      clearQuestions();
      addQuestion("tn", { content: "Chon dap an dung.", options: ["A", "B", "C", "D"], correctAnswer: "A" });
    } else if (kind === "TL10") {
      if (title) title.value = "Kiem tra tu luan ngu phap";
      if (duration) duration.value = 5;
      document.getElementById("deLoai").value = "Tu luan";
      clearQuestions();
      addQuestion("tl", { content: "Viet lai cau sao cho nghia khong doi.", correctAnswer: "Dap an mau" });
    } else {
      if (title) title.value = "De ket hop trac nghiem va tu luan";
      document.getElementById("deLoai").value = "Ket hop";
      clearQuestions();
      addQuestion("tn", { content: "Chon dap an dung.", options: ["A", "B", "C", "D"], correctAnswer: "A" });
      addQuestion("tl", { content: "Giai thich lua chon cua em.", correctAnswer: "Giai thich hop ly" });
    }
  }

  function previewExam() {
    const questions = collectExamQuestions();
    setText("#prvExamTitle", document.getElementById("tenDe")?.value || "Xem truoc de thi");
    setText("#prvExamMeta", `${questions.length} cau hoi`);
    const body = document.getElementById("examPreviewBody");
    if (body) {
      body.innerHTML = questions.length ? questions.map((q, index) => `<div class="exam-q"><div style="font-weight:800;margin-bottom:8px">Cau ${index + 1}. ${escapeHtml(q.content)}</div>${(q.options || []).filter(Boolean).map((opt, optIndex) => `<div class="exam-opt">${String.fromCharCode(65 + optIndex)}. ${escapeHtml(opt)}</div>`).join("")}</div>`).join("") : `<div style="text-align:center;padding:30px;color:var(--ink4)">Chua co cau hoi nao de xem truoc.</div>`;
    }
    document.getElementById("examPreviewModal")?.classList.add("show");
  }

  function closeExamPreview() {
    document.getElementById("examPreviewModal")?.classList.remove("show");
  }

  function ensureQuestionBank() {
    if (state.questionBank.length) return;
    state.questionBank = [
      questionTemplate("tn", { content: "If I ___ you, I would review the lesson again.", options: ["am", "were", "was", "be"], correctAnswer: "B", explanation: "Cau dieu kien loai 2 dung were." }),
      questionTemplate("tn", { content: "Choose the word closest in meaning to important.", options: ["vital", "minor", "simple", "late"], correctAnswer: "A" }),
      questionTemplate("tl", { content: "Rewrite: Although it rained, we continued the class.", correctAnswer: "Despite the rain, we continued the class." })
    ];
  }

  function importFromBank() {
    ensureQuestionBank();
    renderBank();
    document.getElementById("bankModal")?.classList.add("show");
  }

  function renderBank() {
    ensureQuestionBank();
    const q = (document.getElementById("bankSearch")?.value || "").toLowerCase();
    const list = document.getElementById("bankList");
    if (!list) return;
    const rows = state.questionBank.filter(item => !q || item.content.toLowerCase().includes(q));
    list.innerHTML = rows.map(item => `<label class="qa" style="cursor:pointer"><input type="checkbox" class="bank-choice" value="${item.id}" style="width:16px;height:16px;accent-color:var(--purple)"><div style="flex:1"><div style="font-size:13px;font-weight:700">${escapeHtml(item.content)}</div><div style="font-size:11.5px;color:var(--ink4)">${item.type === "essay" ? "Tu luan" : "Trac nghiem"}</div></div></label>`).join("") || `<div style="text-align:center;color:var(--ink4);padding:24px">Khong co cau hoi phu hop.</div>`;
  }

  function addSelectedBank() {
    const ids = Array.from(document.querySelectorAll(".bank-choice:checked")).map(input => input.value);
    state.questionBank.filter(item => ids.includes(item.id)).forEach(item => addQuestion(item.type === "essay" ? "tl" : "tn", item));
    document.getElementById("bankModal")?.classList.remove("show");
  }

  function closeBank() {
    document.getElementById("bankModal")?.classList.remove("show");
  }

  async function createExamFromForm() {
    const title = (document.getElementById("tenDe").value || "").trim();
    const selects = document.querySelectorAll("#s-taode #tab-info .fr select");
    const courseId = selects[0]?.value || "";
    const duration = parseInt(selects[1]?.value || "60", 10) || 60;
    const type = document.getElementById("deLoai").value || "quiz";
    if (!title) return notify("Vui long nhap ten de.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    const dueAt = document.querySelector("#s-taode input[type=date]")?.value || "";
    await request("/api/exams", {
      method: "POST",
      body: JSON.stringify({ title, courseId, durationMinutes: duration, type, totalScore: 10, status: "published", dueAt: dueAt || null, questions: collectExamQuestions() })
    });
    document.getElementById("tenDe").value = "";
    state.examQuestions = [];
    if (window.QUESTIONS) window.QUESTIONS.length = 0;
    renderQuestionList();
    notify("Da tao de kiem tra.");
    await refresh();
    renderDe();
  }

  function renderCal() {
    const grid = document.getElementById("calG");
    if (!grid) return;
    const days = typeof window.getWeekDays === "function" ? window.getWeekDays(window._weekOffset || 0) : getWeekDays(0);
    grid.innerHTML = days.map(day => {
      const dayStart = new Date(day.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const sessions = state.sessions.filter(session => {
        const d = new Date(session.startAt);
        return d >= dayStart && d < dayEnd;
      });
      const items = sessions.map(session => `<div class="cal-s" style="background:#ede9fe;cursor:pointer" onclick="joinZoom('${escapeHtml(session.meetingUrl || "")}','${escapeHtml(session.courseName || "")}')"><div class="cal-sn" style="color:#6d28d9">${escapeHtml(session.courseName || "")}</div><div class="cal-st" style="color:#6d28d9">${timeOnly(session.startAt)}-${timeOnly(session.endAt)}</div><div style="font-size:9.5px;color:#6d28d9;margin-top:2px;opacity:.7">Mo phong hoc</div></div>`).join("") || `<div style="font-size:11px;color:#cbd5e1;text-align:center;padding:8px 0">Nghi</div>`;
      return `<div class="cal-d${day.isToday ? " today" : ""}"><div class="cal-dl">${escapeHtml(day.label)}</div>${items}</div>`;
    }).join("");
    renderScheduleTable();
  }

  function getWeekDays(offset) {
    const now = new Date();
    const dow = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    const names = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    return names.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { label: `${label}\n${date.getDate()}/${date.getMonth() + 1}`, date, isToday: date.toDateString() === now.toDateString() };
    });
  }

  function renderTodaySessions() {
    const wrap = document.getElementById("todaySessionWidget");
    if (!wrap) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const rows = state.sessions.filter(session => {
      const d = new Date(session.startAt);
      return d >= start && d < end;
    });
    wrap.innerHTML = rows.length ? rows.map(session => (
      `<div class="tli"><div style="flex:1"><div style="font-size:13.5px;font-weight:700">${escapeHtml(session.courseName || "")}</div><div style="font-size:12px;color:var(--ink3);margin-top:2px"><i class="bi bi-camera-video me-1"></i>${escapeHtml(session.title || "")} - ${timeOnly(session.startAt)}</div><div style="margin-top:7px;display:flex;gap:6px"><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">Hom nay</span><button onclick="joinZoom('${escapeHtml(session.meetingUrl || "")}','${escapeHtml(session.courseName || "")}')" class="btn-sm prim" style="padding:3px 10px;font-size:11px"><i class="bi bi-camera-video-fill"></i> Vao lop</button></div></div></div>`
    )).join("") : `<div style="text-align:center;padding:20px;color:var(--ink4)"><i class="bi bi-calendar-check" style="font-size:28px;display:block;margin-bottom:8px;opacity:.4"></i>Hom nay chua co buoi day.</div>`;
  }

  function renderScheduleTable() {
    const body = document.getElementById("schBody");
    if (!body) return;
    const classFilter = document.getElementById("schFilterLop").value || "";
    const statusFilter = document.getElementById("schFilterStatus").value || "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let rows = state.sessions.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    if (classFilter) rows = rows.filter(row => row.courseName === classFilter);
    if (statusFilter) rows = rows.filter(row => sessionStatus(row).key === statusFilter);
    body.innerHTML = rows.length ? rows.map(session => {
      const st = sessionStatus(session);
      return `<tr><td style="font-weight:700">Buoi ${Number(session.sessionNo || 1)}</td><td><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(session.courseName || "")}</span></td><td style="color:var(--ink2)">${dateOnly(session.startAt)}</td><td style="font-family:'DM Mono',monospace;font-size:12.5px;color:var(--ink3)">${timeOnly(session.startAt)}-${timeOnly(session.endAt)}</td><td style="text-align:center;font-weight:700">${Number(session.expectedStudents || 0)}</td><td style="text-align:center;font-weight:700;color:var(--amber)">${Number(session.absentCount || 0)}</td><td style="text-align:center"><span class="tag" data-status="${st.key}" style="background:${st.bg};color:${st.color};font-size:11px">${st.label}</span></td><td style="text-align:center"><div style="display:flex;gap:5px;justify-content:center;flex-wrap:wrap"><button onclick="EC_TEACHER.openAttendance('${escapeHtml(session.id)}')" class="btn-sm amb" style="font-size:11.5px;padding:4px 10px"><i class="bi bi-person-check-fill"></i> Diem danh</button><button onclick="joinZoom('${escapeHtml(session.meetingUrl || "")}','${escapeHtml(session.courseName || "")}')" class="btn-sm prim" style="font-size:11.5px;padding:4px 10px"><i class="bi bi-camera-video-fill"></i> Lop hoc</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="8" style="text-align:center;color:var(--ink4);padding:26px">Chua co lich day phu hop.</td></tr>`;
  }

  function sessionStatus(session) {
    if (session.status === "done") return { key: "done", label: "Da day", bg: "#d1fae5", color: "#059669" };
    if (session.status === "cancelled") return { key: "cancelled", label: "Da huy", bg: "#fee2e2", color: "#dc2626" };
    const date = new Date(session.startAt);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay ? { key: "today", label: "Hom nay", bg: "#dbeafe", color: "#2563eb" } : { key: "upcoming", label: "Sap toi", bg: "#fef3c7", color: "#d97706" };
  }

  async function saveNewSession() {
    const courseId = document.getElementById("newSchLop").value || "";
    const date = document.getElementById("newSchDate").value || "";
    const time = document.getElementById("newSchTime").value || "19:00";
    const duration = parseInt(document.getElementById("newSchDur").value || "60", 10) || 60;
    const meetingUrl = (document.getElementById("newSchZoom").value || "").trim();
    if (!courseId || !date) return notify("Vui long chon lop va ngay day.", "error");
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + duration * 60000);
    const course = state.courses.find(item => item.id === courseId);
    await request("/api/class-sessions", {
      method: "POST",
      body: JSON.stringify({
        courseId,
        title: `Buoi hoc ${course ? course.name : ""}`.trim(),
        sessionNo: state.sessions.filter(item => item.courseId === courseId).length + 1,
        startAt: start.toISOString().slice(0, 19).replace("T", " "),
        endAt: end.toISOString().slice(0, 19).replace("T", " "),
        meetingUrl,
        status: "scheduled"
      })
    });
    notify("Da them buoi day.");
    document.getElementById("addSessionModal").classList.remove("show");
    await refresh();
    renderCal();
  }

  function openAttendance(sessionId) {
    const session = state.sessions.find(item => item.id === sessionId);
    if (!session) return;
    state.currentAttendanceSessionId = sessionId;
    setText("#attTitle", `Diem danh - ${session.courseName || ""}`);
    setText("#attDate", moneyDate(session.startAt));
    const students = state.students.filter(student => student.courseId === session.courseId);
    const list = document.getElementById("attList");
    if (list) {
      list.innerHTML = students.length ? students.map(student => (
        `<div class="att-row" data-user-id="${escapeHtml(student.id)}"><div style="display:flex;align-items:center;gap:10px"><div class="ava" style="background:linear-gradient(${student.g});width:32px;height:32px;font-size:11px">${escapeHtml(student.i)}</div><div style="font-size:13.5px;font-weight:600">${escapeHtml(student.n)}</div></div><div style="display:flex;gap:6px"><button class="att-btn present att-b" data-st="present" onclick="setAtt(this)"><i class="bi bi-check-circle-fill"></i> Co mat</button><button class="att-btn att-b" data-st="late" onclick="setAtt(this)" style="background:#fff;border-color:var(--line);color:var(--ink3)"><i class="bi bi-clock-fill"></i> Muon</button><button class="att-btn att-b" data-st="absent" onclick="setAtt(this)" style="background:#fff;border-color:var(--line);color:var(--ink3)"><i class="bi bi-x-circle-fill"></i> Vang</button></div></div>`
      )).join("") : `<div style="text-align:center;color:var(--ink4);padding:22px">Lop nay chua co hoc sinh.</div>`;
    }
    document.getElementById("attModal").classList.add("show");
  }

  async function saveAttendance() {
    const sessionId = state.currentAttendanceSessionId;
    if (!sessionId) return;
    const rows = Array.from(document.querySelectorAll("#attList .att-row"));
    await Promise.all(rows.map(row => {
      const active = row.querySelector(".att-b.present, .att-b.late, .att-b.absent");
      return request("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          userId: row.dataset.userId,
          status: active ? active.dataset.st : "present",
          note: document.getElementById("sessionNote").value || ""
        })
      });
    }));
    await request(`/api/class-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" })
    });
    notify("Da luu diem danh.");
    document.getElementById("attModal").classList.remove("show");
    await refresh();
  }

  function renderNotifications() {
    const wrap = document.getElementById("notifList");
    if (!wrap) return;
    const rows = state.notifications;
    const unread = rows.filter(item => !item.isRead).length;
    const sub = document.querySelector("#s-thongbao .topbar-sub");
    if (sub) sub.textContent = `${unread} thong bao moi`;
    wrap.innerHTML = rows.length ? rows.map(item => (
      `<div class="ni" style="${!item.isRead ? "background:#fafbff;" : ""}"><div class="ni-ico" style="background:#ede9fe"><i class="bi bi-bell-fill" style="color:var(--purple)"></i></div><div style="flex:1"><div style="font-size:13.5px;font-weight:${!item.isRead ? 700 : 600};color:var(--ink);margin-bottom:3px">${!item.isRead ? '<span class="nd"></span>' : ""}${escapeHtml(item.title)}</div><div style="font-size:12.5px;color:var(--ink3);line-height:1.5;margin-bottom:4px">${escapeHtml(item.body || "")}</div><div style="font-size:11.5px;color:var(--ink4)">${escapeHtml(moneyDate(item.createdAt))}</div></div></div>`
    )).join("") : `<div style="text-align:center;color:var(--ink4);padding:30px">Chua co thong bao.</div>`;
    updateBadges();
  }

  function questionPriority(item) {
    if (item.status === "answered") return "low";
    const ageHours = item.createdAt ? (Date.now() - new Date(item.createdAt).getTime()) / 36e5 : 0;
    return ageHours >= 48 ? "high" : "med";
  }

  function renderFb() {
    const list = document.getElementById("fbList");
    if (!list) return;
    const course = document.getElementById("fbFilterLop")?.value || "";
    const status = document.getElementById("fbFilterStatus")?.value || "";
    const priority = document.getElementById("fbFilterPri")?.value || "";
    const q = (document.getElementById("fbSearch")?.value || "").toLowerCase();
    let rows = state.questions.slice();
    if (course) rows = rows.filter(item => item.courseName === course);
    if (status === "pending") rows = rows.filter(item => item.status !== "answered");
    if (status === "done") rows = rows.filter(item => item.status === "answered");
    if (priority) rows = rows.filter(item => questionPriority(item) === priority);
    if (q) rows = rows.filter(item => [item.title, item.body, item.studentName, item.courseName].some(value => String(value || "").toLowerCase().includes(q)));
    const pending = state.questions.filter(item => item.status !== "answered").length;
    setText("#fbSubTitle", `${pending} cau hoi tu hoc sinh dang cho giai dap`);
    list.innerHTML = rows.length ? rows.map(item => {
      const pri = questionPriority(item);
      const answered = item.status === "answered";
      return `<div class="fb" style="border-radius:0;margin:0;border-bottom:1px solid var(--line)"><div style="display:flex;gap:12px;align-items:flex-start"><div class="ava" style="background:linear-gradient(135deg,#6d28d9,#8b5cf6)">${escapeHtml(initials(item.studentName))}</div><div style="flex:1"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px"><span style="font-size:13.5px;font-weight:800">${escapeHtml(item.title || item.body.slice(0, 80))}</span><span class="tag ${pri === "high" ? "pri-high" : "pri-med"}">${pri === "high" ? "Uu tien cao" : "Binh thuong"}</span><span class="tag" style="background:${answered ? "#d1fae5" : "#fef3c7"};color:${answered ? "#059669" : "#d97706"}">${answered ? "Da tra loi" : "Cho phan hoi"}</span></div><div style="font-size:12px;color:var(--ink3);margin-bottom:8px">${escapeHtml(item.studentName || "")} - ${escapeHtml(item.courseName || "Chua gan lop")} - ${escapeHtml(moneyDate(item.createdAt))}</div><div style="font-size:13px;color:var(--ink2);line-height:1.6;margin-bottom:10px">${escapeHtml(item.body)}</div>${answered ? `<div style="background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px;color:var(--ink2)">${escapeHtml(item.answer || "")}</div>` : `<textarea id="fbAns_${item.id}" rows="2" style="width:100%;border:1.5px solid var(--line);border-radius:8px;padding:9px 11px;font-size:13px;font-family:inherit;resize:none" placeholder="Nhap cau tra loi..."></textarea><button onclick="answerFeedback('${escapeHtml(item.id)}')" class="btn-sm prim" style="margin-top:8px"><i class="bi bi-reply-fill"></i> Tra loi</button>`}</div></div></div>`;
    }).join("") : `<div style="text-align:center;color:var(--ink4);padding:30px">Khong co cau hoi phu hop.</div>`;
  }

  async function answerFeedback(id, fallbackAnswer) {
    const input = document.getElementById(`fbAns_${id}`);
    const answer = (fallbackAnswer || input?.value || "").trim();
    if (!answer) return notify("Vui long nhap cau tra loi.", "error");
    await request(`/api/questions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ answer })
    });
    notify("Da gui cau tra loi cho hoc sinh.");
    await refresh();
    renderFb();
  }

  async function markAllReplied() {
    const rows = state.questions.filter(item => item.status !== "answered");
    for (const item of rows) {
      await request(`/api/questions/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ answer: "Giao vien da ghi nhan cau hoi va se trao doi chi tiet trong buoi hoc tiep theo." })
      });
    }
    if (!rows.length) return notify("Khong co cau hoi dang cho phan hoi.", "info");
    notify(`Da danh dau ${rows.length} cau hoi.`);
    await refresh();
  }

  function exportFeedback() {
    const rows = state.questions;
    downloadText(`teacher-feedback-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([
      ["Student", "Course", "Title", "Question", "Status", "Answer", "Created at"],
      ...rows.map(item => [item.studentName, item.courseName, item.title, item.body, item.status, item.answer || "", item.createdAt || ""])
    ]), "text/csv;charset=utf-8");
  }

  function updateBadges() {
    const unread = state.notifications.filter(item => !item.isRead).length;
    document.querySelectorAll(".sb-item").forEach(item => {
      const attr = item.getAttribute("onclick") || "";
      if (!attr.includes("thongbao")) return;
      const badge = item.querySelector(".sb-badge");
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread ? "" : "none";
      }
    });
  }

  async function sendBulkMsg() {
    const body = (document.getElementById("bulkMsgTx").value || "").trim();
    if (!body) return notify("Vui long nhap noi dung thong bao.", "error");
    const selected = document.querySelector(".cls-chip.sel").dataset.lop || "all";
    const targets = state.students.filter(student => selected === "all" || student.courseId === selected);
    await Promise.all(targets.map(student => request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ userId: student.id, title: "Thong bao tu giao vien", body, type: "teacher" })
    })));
    document.getElementById("bulkMsgTx").value = "";
    document.getElementById("bulkMsgPanel").style.display = "none";
    notify(`Da gui thong bao toi ${targets.length} hoc sinh.`);
  }

  async function sendHsMsg() {
    const targetName = document.getElementById("hsMsgTarget").textContent || "";
    const student = state.students.find(item => item.n === targetName);
    const body = (document.getElementById("hsMsgTa").value || "").trim();
    if (!student || !body) return notify("Vui long nhap noi dung tin nhan.", "error");
    await request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({ userId: student.id, title: "Tin nhan tu giao vien", body, type: "teacher" })
    });
    document.getElementById("hsMsgTa").value = "";
    notify(`Da gui tin nhan toi ${student.n}.`);
  }

  function openGrade(resultId) {
    const item = (state.dashboard.pendingSubmissions || []).find(row => row.id === resultId);
    if (!item) return;
    state.currentGradeId = resultId;
    setText("#cbTitle", `Cham bai - ${item.studentName}`);
    setText("#cbSubtitle", `${item.title} - ${moneyDate(item.submittedAt)}`);
    setText("#cbStudent", item.studentName);
    setText("#cbClass", item.courseName);
    setText("#cbTime", moneyDate(item.submittedAt));
    setText("#cbLoai", "Cham thu cong");
    const score = document.getElementById("scoreInput");
    const comment = document.getElementById("cbComment");
    if (score) score.value = "";
    if (comment) comment.value = "";
    ["cbTNSection", "cbTLSection", "cbTNOnlySection"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    document.getElementById("chamBaiModal").classList.add("show");
  }

  async function submitGrade() {
    const score = Number(document.getElementById("scoreInput").value);
    if (!state.currentGradeId) return notify("Chua chon bai nop.", "error");
    if (!Number.isFinite(score) || score < 0 || score > 10) return notify("Diem phai nam trong khoang 0 den 10.", "error");
    await request(`/api/exam-results/${encodeURIComponent(state.currentGradeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ score, feedback: document.getElementById("cbComment").value || "" })
    });
    state.currentGradeId = "";
    document.getElementById("chamBaiModal").classList.remove("show");
    notify("Da luu diem bai nop.");
    await refresh();
  }

  function renderReports() {
    const students = state.students;
    const total = students.length || 1;
    const avg = students.reduce((sum, item) => sum + Number(item.sc || 0), 0) / total;
    const completion = students.reduce((sum, item) => sum + Number(item.pr || 0), 0) / total;
    const support = students.filter(item => item.st === "Can ho tro" || item.st === "Vang hoc").length;
    const excellent = students.filter(item => item.st === "Xuat sac").length;
    setText("#rptDiemTB", avg.toFixed(1));
    setText("#rptHoanThanh", `${Math.round(completion)}%`);
    setText("#rptCanHo", support);
    setText("#rptXuatSac", excellent);
    updateRptChart();
    renderTopStudents();
    renderCourseReportTable();
    renderSupportTable();
    renderStudentSegments();
  }

  function updateRptChart() {
    const chart = document.getElementById("rptChart");
    if (!chart) return;
    const courseName = document.getElementById("rptChartLop").value || "";
    const rows = state.courses.filter(course => !courseName || course.name === courseName);
    const max = Math.max(...rows.map(row => Number(row.averageScore || 0)), 10);
    chart.innerHTML = rows.length ? rows.map(row => {
      const value = Number(row.averageScore || 0);
      const height = Math.max(8, Math.round((value / max) * 120));
      return `<div class="bcol"><div style="font-size:11px;font-weight:700;color:var(--purple)">${value.toFixed(1)}</div><div class="bfill" style="background:linear-gradient(180deg,var(--purple),var(--purple2));height:${height}px"></div><div style="font-size:11px;color:var(--ink4);max-width:80px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(row.name)}</div></div>`;
    }).join("") : `<div style="color:var(--ink4);font-size:13px">Chua co du lieu lop hoc.</div>`;
  }

  function renderCourseReportTable() {
    const bodies = document.querySelectorAll("#s-baocao table tbody");
    const body = document.getElementById("rptCourseBody") || bodies[0];
    if (!body) return;
    body.innerHTML = state.courses.length ? state.courses.map(course => {
      const progress = Math.round(Number(course.averageProgress || 0));
      const excellent = state.students.filter(student => student.courseId === course.id && student.sc >= 8.5).length;
      return `<tr><td><span class="tag" style="background:#ede9fe;color:#6d28d9">${escapeHtml(course.name)}</span></td><td style="text-align:center;font-weight:700">${course.students || 0}</td><td style="text-align:center;font-weight:800;color:var(--green)">${Number(course.averageScore || 0).toFixed(1)}</td><td style="text-align:center;color:var(--ink3)">${progress}%</td><td style="text-align:center;font-weight:700;color:var(--amber)">${excellent}</td><td style="min-width:100px"><div class="pb"><div class="pf" style="width:${progress}%;background:var(--green)"></div></div></td></tr>`;
    }).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--ink4);padding:22px">Chua co lop hoc.</td></tr>`;
  }

  function renderSupportTable() {
    const bodies = document.querySelectorAll("#s-baocao table tbody");
    const body = document.getElementById("rptSupportBody") || bodies[1];
    if (!body) return;

    const rows = state.students
      .filter(student => student.st === "Can ho tro" || student.st === "Vang hoc" || student.sc < 6 || student.ab >= 2 || student.pr < 45)
      .sort((a, b) => {
        const scoreA = (a.sc || 0) + Math.max(0, 100 - (a.pr || 0)) / 100 + (a.ab || 0) * 0.35;
        const scoreB = (b.sc || 0) + Math.max(0, 100 - (b.pr || 0)) / 100 + (b.ab || 0) * 0.35;
        return scoreA - scoreB;
      })
      .slice(0, 8);

    body.innerHTML = rows.length ? rows.map(student => (
      `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="ava" style="background:linear-gradient(${student.g})">${escapeHtml(student.i)}</div><span style="font-weight:600">${escapeHtml(student.n)}</span></div></td>` +
      `<td><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(student.l)}</span></td>` +
      `<td style="text-align:center;font-weight:800;color:${student.sc < 6 ? "var(--red)" : "var(--amber)"}">${Number(student.sc || 0).toFixed(1)}</td>` +
      `<td style="text-align:center;font-weight:700;color:${student.ab >= 3 ? "var(--red)" : "var(--amber)"}">${student.ab}</td>` +
      `<td style="text-align:center"><button onclick="EC_TEACHER.contactStudent('${escapeHtml(student.id)}')" class="btn-sm prim" style="padding:5px 10px;font-size:12px"><i class="bi bi-chat-dots-fill"></i> Lien he</button></td></tr>`
    )).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--ink4);padding:22px">Chua co hoc sinh can ho tro.</td></tr>`;
  }

  function renderStudentSegments() {
    const segmentRows = document.querySelectorAll("#s-baocao .segr");
    if (!segmentRows.length) return;
    const total = state.students.length || 1;
    const segments = [
      { label: "Xuat sac >=8.5", count: state.students.filter(student => student.sc >= 8.5).length, bg: "#ede9fe", color: "#6d28d9" },
      { label: "Kha 7.0-8.4", count: state.students.filter(student => student.sc >= 7 && student.sc < 8.5).length, bg: "#dbeafe", color: "#2563eb" },
      { label: "TB 5.5-6.9", count: state.students.filter(student => student.sc >= 5.5 && student.sc < 7).length, bg: "#fef3c7", color: "#d97706" },
      { label: "Can ho tro", count: state.students.filter(student => student.sc < 5.5 || student.ab >= 3 || student.pr < 45).length, bg: "#fee2e2", color: "#dc2626" }
    ];

    segmentRows.forEach((row, index) => {
      const item = segments[index];
      if (!item) return;
      const tag = row.querySelector(".tag");
      const bar = row.querySelector(".segf");
      const count = row.querySelector("span[style*='width:44px']");
      if (tag) {
        tag.textContent = item.label;
        tag.style.background = item.bg;
        tag.style.color = item.color;
      }
      if (bar) {
        bar.style.width = `${Math.round(item.count / total * 100)}%`;
        bar.style.background = item.color;
      }
      if (count) {
        count.textContent = `${item.count} HS`;
        count.style.color = item.color;
      }
    });
  }

  function renderTopStudents() {
    const wrap = document.getElementById("topStudents");
    if (!wrap) return;
    const rows = state.students.slice().sort((a, b) => b.sc - a.sc).slice(0, 5);
    wrap.innerHTML = rows.length ? rows.map((student, index) => (
      `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f8fafc"><span style="font-size:14px;width:24px;text-align:center;font-weight:800;color:var(--purple)">#${index + 1}</span><div class="ava" style="background:linear-gradient(${student.g});width:30px;height:30px;font-size:11px">${escapeHtml(student.i)}</div><div style="flex:1"><div style="font-size:13px;font-weight:700">${escapeHtml(student.n)}</div><div style="font-size:11px;color:var(--ink3)">${escapeHtml(student.l)}</div></div><span style="font-size:16px;font-weight:800;color:${student.sc >= 8.5 ? "var(--green)" : "var(--amber)"}">${student.sc}</span></div>`
    )).join("") : `<div style="text-align:center;color:var(--ink4);padding:22px">Chua co hoc sinh.</div>`;
  }

  var LESSON_TEMPLATES = {
    "relative": {
      title: "Mệnh đề quan hệ — Relative Clauses",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: MỆNH ĐỀ QUAN HỆ (RELATIVE CLAUSES)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Phân biệt và sử dụng đúng who/which/that/whom/whose") + "\n\n" +
"I. MỤC TIÊU BÀI HỌC\n" + "─".repeat(44) + "\n" +
"• Kiến thức: Nắm công thức mệnh đề quan hệ xác định & không xác định\n" +
"• Kỹ năng  : Viết & điền từ đúng đại từ quan hệ who/which/that/whom/whose\n" +
"• Luyện thi: Nhận dạng bẫy rút gọn mệnh đề quan hệ trong đề THPTQG\n\n" +
"II. KIẾN THỨC TRỌNG TÂM\n" + "─".repeat(44) + "\n" +
"  WHO      → thay thế người (chủ ngữ/tân ngữ)\n" +
"  WHICH    → thay thế vật, sự vật\n" +
"  THAT     → thay người & vật (chỉ dùng trong mệnh đề xác định)\n" +
"  WHOSE    → chỉ sở hữu (người & vật)\n" +
"  WHOM     → thay người (tân ngữ, văn phong trang trọng)\n\n" +
"  Xác định   : không có dấu phẩy — The book WHICH I read is great.\n" +
"  Không xác định: có dấu phẩy  — My sister, WHO lives in HCM, is a doctor.\n\n" +
"III. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Chiếu 2 câu: \"The man who I met yesterday is kind.\" &\n" +
"     \"Ha Long Bay, which is in Quang Ninh, is beautiful.\"\n" +
"   • Hỏi: 2 câu khác nhau ở điểm nào? → dẫn vào bài\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Gọi HS điền từ: The student ___ got the highest score is Nam.\n" +
"   • Nhận xét, dẫn dắt sang bài mới\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n\n" +
"   a) Lý thuyết (20 phút)\n" +
"      • Bảng tổng hợp 5 đại từ quan hệ + chức năng\n" +
"      • Quy tắc bỏ \"that\" khi có giới từ đứng trước\n" +
"      • Phân biệt xác định / không xác định qua dấu phẩy\n\n" +
"   b) Ví dụ đề thi thực tế (" + Math.round(t.m*0.45) + " phút)\n" +
"      • 2019: The girl ___ father is a professor won the prize.\n" +
"        → Đáp án: WHOSE (sở hữu của người)\n" +
"      • 2021: This is the house in ___ Shakespeare was born.\n" +
"        → Đáp án: WHICH (giới từ + which; không dùng that)\n" +
"      • Bẫy: Rút gọn V-ing / V-ed (The man standing there = who stands)\n\n" +
"   c) Luyện tập có hướng dẫn (" + Math.round(t.m*0.3) + " phút)\n" +
"      • 8 câu điền từ — GV làm cùng, giải thích từng câu\n" +
"      • Nhấn mạnh: bẫy dấu phẩy & giới từ\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • HS làm 15 câu trắc nghiệm THPTQG (20 phút)\n" +
"   • GV chữa 5 câu sai nhiều nhất\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Sơ đồ: WHO / WHICH / THAT / WHOSE / WHOM\n" +
"   • Bài về nhà: 20 câu đề thi 2018–2023 chủ đề Relative Clauses\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Lỗi phổ biến: dùng THAT trong mệnh đề không xác định (sai)\n" +
"• Bẫy cao: \",which\" chỉ cả mệnh đề đứng trước (non-defining)\n" +
"[Giáo án AI English Center]";
      }
    },
    "conditional": {
      title: "Câu điều kiện — Conditional Sentences",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: CÂU ĐIỀU KIỆN (CONDITIONAL SENTENCES)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Phân biệt và sử dụng đúng 3 loại câu điều kiện") + "\n\n" +
"I. MỤC TIÊU BÀI HỌC\n" + "─".repeat(44) + "\n" +
"• Kiến thức: Nắm công thức Type 0, 1, 2, 3 và Mixed\n" +
"• Kỹ năng  : Chia động từ đúng trong câu điều kiện\n" +
"• Luyện thi: Nhận dạng dạng đảo ngữ câu điều kiện trong đề THPTQG\n\n" +
"II. KIẾN THỨC TRỌNG TÂM\n" + "─".repeat(44) + "\n" +
"  Type 0: If + V(s/es), ... V(s/es)       → Sự thật hiển nhiên\n" +
"  Type 1: If + V(s/es), ... will + V       → Điều kiện có thể xảy ra\n" +
"  Type 2: If + V-ed/were, ... would + V    → Giả định ở hiện tại\n" +
"  Type 3: If + had + V3, ... would have+V3 → Giả định quá khứ\n" +
"  Mixed : If + had + V3, ... would + V     → QK → hiện tại\n\n" +
"  Đảo ngữ: Were I → Had I → Should I\n\n" +
"III. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Câu hỏi: \"Nếu bạn trúng xổ số, bạn sẽ làm gì?\"\n" +
"   • HS trả lời → GV viết câu điều kiện lên bảng\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Chia động từ: If she ___(study) harder, she will pass.\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n\n" +
"   a) Lý thuyết — Bảng 4 loại + Mixed + Đảo ngữ (25 phút)\n" +
"   b) Ví dụ đề THPTQG (" + Math.round(t.m*0.45) + " phút)\n" +
"      • 2020: If I ___ you, I would study harder.\n" +
"        → Đáp án: WERE (Type 2, \"were\" dùng cho mọi ngôi)\n" +
"      • 2022: Had she arrived earlier, she ___ the train.\n" +
"        → Đáp án: WOULD HAVE CAUGHT (đảo ngữ Type 3)\n" +
"   c) Luyện tập 8 câu có hướng dẫn (" + Math.round(t.m*0.25) + " phút)\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 15 câu trắc nghiệm — ưu tiên dạng đảo ngữ & Mixed\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Sơ đồ tóm tắt 4 loại + đảo ngữ\n" +
"   • Bài về nhà: 20 câu đề 2018–2023\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Lỗi phổ biến: dùng \"would\" trong mệnh đề IF\n" +
"• Bẫy: Were it not for... / If it were not for...\n" +
"[Giáo án AI English Center]";
      }
    },
    "passive": {
      title: "Câu bị động — Passive Voice",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: CÂU BỊ ĐỘNG (PASSIVE VOICE)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Chuyển đổi chủ động ↔ bị động đúng với mọi thì") + "\n\n" +
"I. KIẾN THỨC TRỌNG TÂM\n" + "─".repeat(44) + "\n" +
"  Công thức: S + be (chia thì) + V3/ed (+ by O)\n\n" +
"  Thì                  | Chủ động          | Bị động\n" +
"  ─────────────────────|────────────────── |──────────────────────\n" +
"  Hiện tại đơn         | writes            | is written\n" +
"  Hiện tại tiếp diễn  | is writing        | is being written\n" +
"  Hiện tại HT          | has written       | has been written\n" +
"  Quá khứ đơn          | wrote             | was/were written\n" +
"  Tương lai đơn        | will write        | will be written\n" +
"  Modal                | can write         | can be written\n\n" +
"II. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Hai câu: \"People speak English worldwide\" vs \"English is spoken worldwide\"\n" +
"   • Hỏi: câu nào nhấn mạnh hành động? → dẫn vào bài\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Chuyển: \"She cleaned the room\" → bị động\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n" +
"   a) Bảng tổng hợp 6 thì + modal (20 phút)\n" +
"   b) Dạng đặc biệt (" + Math.round(t.m*0.35) + " phút)\n" +
"      • Bị động với HAVE/GET: I had my hair cut.\n" +
"      • Câu hỏi bị động: Was the letter sent?\n" +
"      • Đề THPTQG 2021: The report ___ by the manager yesterday.\n" +
"        → Đáp án: WAS WRITTEN\n" +
"   c) Luyện tập 8 câu hướng dẫn (" + Math.round(t.m*0.3) + " phút)\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 15 câu trắc nghiệm + 3 câu chuyển đổi\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Bảng tóm tắt 8 thì\n" +
"   • Bài về nhà: 20 câu đề thi liên quan\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Lỗi phổ biến: quên chia BE đúng thì / dùng V-ing thay V3\n" +
"• Bẫy: Stative verb không dùng bị động (know, have, resemble)\n" +
"[Giáo án AI English Center]";
      }
    },
    "present_perfect": {
      title: "Thì hiện tại hoàn thành — Present Perfect",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: THÌ HIỆN TẠI HOÀN THÀNH (PRESENT PERFECT)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Phân biệt Present Perfect với Simple Past") + "\n\n" +
"I. KIẾN THỨC TRỌNG TÂM\n" + "─".repeat(44) + "\n" +
"  (+) S + have/has + V3/ed\n" +
"  (-) S + have/has + not + V3/ed\n" +
"  (?) Have/Has + S + V3/ed?\n\n" +
"  Dấu hiệu nhận biết:\n" +
"  already, yet, just, ever, never, so far, recently,\n" +
"  for + khoảng thời gian, since + mốc thời gian\n\n" +
"  Phân biệt PP vs Past Simple:\n" +
"  • PP : kết quả còn liên quan hiện tại / không rõ thời điểm\n" +
"  • PS : hành động đã hoàn toàn kết thúc / có mốc thời gian cụ thể\n\n" +
"II. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • \"Have you ever eaten sushi?\" → HS trả lời → phân tích cấu trúc\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Chia: I ___(not/see) that film yet.\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n" +
"   a) Cấu trúc + dấu hiệu nhận biết (20 phút)\n" +
"   b) Ví dụ đề thi (" + Math.round(t.m*0.4) + " phút)\n" +
"      • 2020: She ___(live) here since 2010.\n" +
"        → HAS LIVED (since → present perfect)\n" +
"      • 2022: They ___(finish) the project last week.\n" +
"        → FINISHED (last week → past simple)\n" +
"   c) 8 câu luyện tập hướng dẫn (" + Math.round(t.m*0.3) + " phút)\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 15 câu trắc nghiệm\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Bảng so sánh PP / Past Simple\n" +
"   • Bài về nhà: 20 câu đề 2018–2023\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Lỗi: dùng PP với \"yesterday/ago/last\" (phải dùng Past Simple)\n" +
"• Bẫy: FOR vs SINCE (for + khoảng; since + mốc)\n" +
"[Giáo án AI English Center]";
      }
    },
    "reading": {
      title: "Đọc hiểu — Reading Comprehension",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: ĐỌC HIỂU (READING COMPREHENSION)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Kỹ năng skimming, scanning và inference trong đề THPTQG") + "\n\n" +
"I. CÁC DẠNG CÂU HỎI ĐỌC HIỂU THPTQG\n" + "─".repeat(44) + "\n" +
"  1. Main idea (ý chính đoạn văn)\n" +
"  2. True/False/Not Given\n" +
"  3. Vocabulary in context (nghĩa từ theo ngữ cảnh)\n" +
"  4. Inference (suy luận — KHÔNG có đáp án trực tiếp)\n" +
"  5. Reference (đại từ thay thế cho gì)\n" +
"  6. Title/Purpose (tiêu đề phù hợp)\n\n" +
"II. CHIẾN LƯỢC LÀM BÀI\n" + "─".repeat(44) + "\n" +
"  Bước 1: Đọc câu hỏi TRƯỚC khi đọc bài (30 giây/câu)\n" +
"  Bước 2: Skimming — đọc lướt lấy ý chính (2 phút)\n" +
"  Bước 3: Scanning — tìm từ khóa vị trí câu trả lời\n" +
"  Bước 4: Đọc kỹ đoạn chứa đáp án\n" +
"  Bước 5: Loại trừ đáp án sai\n\n" +
"III. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Mini test: 1 đoạn 150 từ + 3 câu hỏi (5 phút)\n" +
"   • Chữa → phân tích lỗi sai phổ biến\n\n" +
"2. LÝ THUYẾT CHIẾN LƯỢC (" + t.r + " phút)\n" +
"   • Hướng dẫn 5 bước làm bài\n" +
"   • Kỹ năng nhận dạng từng dạng câu hỏi\n\n" +
"3. THỰC HÀNH CÓ HƯỚNG DẪN (" + t.m + " phút)\n" +
"   • Đoạn 1 (200 từ, topic: Education) — GV làm mẫu từng bước\n" +
"   • Đoạn 2 (220 từ, topic: Environment) — HS làm, GV hỗ trợ\n" +
"   • Phân tích bẫy câu Inference & Vocabulary in context\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 1 đoạn đề thi 2022 (8 câu hỏi) — làm hoàn toàn độc lập\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Tổng kết 6 dạng câu hỏi + chiến lược\n" +
"   • Bài về nhà: 2 đoạn đề thi 2021\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Câu Inference: đáp án KHÔNG có trong bài, cần suy luận logic\n" +
"• Bẫy: đáp án đúng thường paraphrase (viết lại bằng từ khác)\n" +
"[Giáo án AI English Center]";
      }
    },
    "writing": {
      title: "Viết luận — Writing Task",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: VIẾT LUẬN (WRITING TASK — THPTQG)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Viết đoạn văn 150–200 từ đúng cấu trúc, đủ ý, đạt điểm 8+") + "\n\n" +
"I. CẤU TRÚC BÀI VIẾT CHUẨN THPTQG\n" + "─".repeat(44) + "\n" +
"  Opening   : Giới thiệu chủ đề (2–3 câu)\n" +
"  Body P1   : Luận điểm 1 + ví dụ/giải thích (3–4 câu)\n" +
"  Body P2   : Luận điểm 2 + ví dụ/giải thích (3–4 câu)\n" +
"  Conclusion: Tóm tắt + ý kiến cá nhân (2 câu)\n\n" +
"  Linking words cần có:\n" +
"  • Thêm ý  : Furthermore, Moreover, In addition\n" +
"  • Đối lập : However, On the other hand, Nevertheless\n" +
"  • Kết luận: In conclusion, To sum up, Overall\n\n" +
"II. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Cho HS xem 1 bài viết mẫu — nhận xét cấu trúc\n\n" +
"2. LÝ THUYẾT CẤU TRÚC (" + t.r + " phút)\n" +
"   • Sơ đồ 4 phần + từ nối quan trọng\n" +
"   • Tiêu chí chấm điểm: task fulfillment, coherence, vocabulary, grammar\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n" +
"   a) Phân tích đề mẫu (" + Math.round(t.m*0.3) + " phút)\n" +
"      • Đề 2022: \"Write about the advantages of learning English\"\n" +
"      • Lập outline cùng HS → viết câu mở đoạn\n" +
"   b) Viết có hướng dẫn (" + Math.round(t.m*0.4) + " phút)\n" +
"      • HS viết Body P1 — GV đi xem & nhận xét trực tiếp\n" +
"   c) Chữa lỗi thường gặp (" + Math.round(t.m*0.3) + " phút)\n" +
"      • Grammar, linking words, word choice\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • HS viết hoàn chỉnh bài 150 từ — đề mới\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Checklist tự chấm: cấu trúc, từ nối, độ dài\n" +
"   • Bài về nhà: 1 bài viết hoàn chỉnh nộp buổi sau\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Lỗi phổ biến: câu quá dài, thiếu dấu câu, lặp từ\n" +
"• Nhắc HS đếm số từ trước khi nộp bài (>= 140 từ)\n" +
"[Giáo án AI English Center]";
      }
    },
    "vocabulary": {
      title: "Từ vựng theo chủ đề — Topic Vocabulary",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: TỪ VỰNG THEO CHỦ ĐỀ (TOPIC VOCABULARY)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Mở rộng từ vựng 8 chủ đề thường gặp trong đề THPTQG") + "\n\n" +
"I. 8 CHỦ ĐỀ TỪ VỰNG TRỌNG TÂM THPTQG\n" + "─".repeat(44) + "\n" +
"  1. Education       — curriculum, scholarship, compulsory\n" +
"  2. Environment     — greenhouse, deforestation, sustainable\n" +
"  3. Technology      — artificial intelligence, digital, innovation\n" +
"  4. Health          — epidemic, vaccination, mental health\n" +
"  5. Society         — urbanization, gender equality, poverty\n" +
"  6. Economy         — inflation, unemployment, globalization\n" +
"  7. Culture         — heritage, tradition, multicultural\n" +
"  8. Science         — experiment, hypothesis, breakthrough\n\n" +
"II. PHƯƠNG PHÁP GHI NHỚ TỪ VỰNG\n" + "─".repeat(44) + "\n" +
"  • Mind map theo chủ đề\n" +
"  • Word family: educate → education → educational → educator\n" +
"  • Collocations: make a breakthrough, tackle a problem\n" +
"  • Flashcard với ví dụ câu (không học từ đơn lẻ)\n\n" +
"III. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Kahoot/wordwall: đoán nghĩa 10 từ vựng nhanh\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Điền từ: The government needs to ___ climate change.\n" +
"     (tackle/address/deal with)\n\n" +
"3. BÀI MỚI — 2 CHỦ ĐỀ (" + t.m + " phút)\n" +
"   a) Từ vựng chủ đề 1 (" + Math.round(t.m*0.5) + " phút)\n" +
"      • 12–15 từ + định nghĩa + collocations + câu ví dụ\n" +
"      • Mini drill: HS đặt câu với 3 từ mới\n" +
"   b) Từ vựng chủ đề 2 (" + Math.round(t.m*0.5) + " phút)\n" +
"      • Phân tích word family, prefix/suffix phổ biến\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 15 câu điền từ + cloze test từ đề thi thực tế\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Flashcard bộ 30 từ — ôn qua app Quizlet\n" +
"   • Bài về nhà: 20 câu đề dạng word choice 2019–2023\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Ưu tiên collocations & phrasal verbs hay gặp trong đề\n" +
"• Nhắc HS học theo ngữ cảnh, không học từng từ riêng lẻ\n" +
"[Giáo án AI English Center]";
      }
    },
    "pronunciation": {
      title: "Phát âm & Trọng âm — Pronunciation",
      body: function(level, duration, obj) {
        var mins = parseInt(duration)||90, t=_t(mins);
        return "GIÁO ÁN: PHÁT ÂM & TRỌNG ÂM (PRONUNCIATION & STRESS)\n" + "=".repeat(52) + "\n\n" +
"Trình độ  : " + level + "   |   Thời lượng: " + duration + "\n" +
"Mục tiêu  : " + (obj || "Xác định đúng trọng âm từ 2–3 âm tiết và âm /ɪ/ vs /iː/") + "\n\n" +
"I. QUY TẮC TRỌNG ÂM TRỌNG TÂM THPTQG\n" + "─".repeat(44) + "\n" +
"  Từ 2 âm tiết:\n" +
"  • Danh từ/Tính từ: trọng âm thường ở âm 1 (PREsent, TAble)\n" +
"  • Động từ        : trọng âm thường ở âm 2 (preSENT, rePLY)\n\n" +
"  Từ 3+ âm tiết:\n" +
"  • -tion/-sion/-ic/-ical/-ity: trọng âm âm NGAY TRƯỚC hậu tố\n" +
"  • -ment/-ness/-ful/-less    : giữ trọng âm của từ gốc\n\n" +
"  Âm câm & phân biệt âm:\n" +
"  • /ɪ/ ngắn: bit, sit, this   vs  /iː/ dài: beat, seat, these\n" +
"  • /æ/ : cat, bad              vs  /ʌ/     : cut, bud\n" +
"  • /θ/ : think, three          vs  /ð/     : this, there\n\n" +
"II. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(44) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n" +
"   • Nghe 5 từ — HS đánh dấu trọng âm trên bảng phiên âm\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n" +
"   • Chọn từ trọng âm khác: A.career B.canteen C.enter D.forget\n\n" +
"3. BÀI MỚI (" + t.m + " phút)\n" +
"   a) Quy tắc trọng âm + ví dụ (25 phút)\n" +
"   b) Ví dụ đề THPTQG (" + Math.round(t.m*0.4) + " phút)\n" +
"      • Dạng 1: Chọn từ có trọng âm khác vị trí\n" +
"      • Dạng 2: Chọn từ có phần gạch chân phát âm khác\n" +
"      • Đề 2023: A.finished B.watched C.looked D.needed\n" +
"        → Đáp án: D (needed: /ɪd/ còn lại: /t/ hoặc /d/)\n" +
"   c) 8 câu luyện tập hướng dẫn (" + Math.round(t.m*0.25) + " phút)\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n" +
"   • 15 câu: 8 câu trọng âm + 7 câu phân biệt âm\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n" +
"   • Bảng quy tắc trọng âm theo hậu tố\n" +
"   • Bài về nhà: 20 câu đề 2018–2023\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(44) + "\n" +
"• Dạng phát âm: đuôi -ed (/t/ /d/ /ɪd/) — hay gặp, dễ sai\n" +
"• Bẫy: compound noun thường nhấn âm đầu (BLACKboard ≠ black BOARD)\n" +
"[Giáo án AI English Center]";
      }
    }
  };

  function _t(mins) {
    var w=Math.round(mins*.1), r=Math.round(mins*.1), m=Math.round(mins*.55), p=Math.round(mins*.2);
    return { w:w, r:r, m:m, p:p, c:mins-w-r-m-p };
  }

  function generateLocalLessonPlan(topic, level, duration, objective) {
    var norm = topic.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
    var key = null;
    if (norm.includes("relative") || norm.includes("menh de quan he") || norm.includes("quan he")) key = "relative";
    else if (norm.includes("conditional") || norm.includes("dieu kien") || norm.includes("điều kiện")) key = "conditional";
    else if (norm.includes("passive") || norm.includes("bi dong") || norm.includes("bị động")) key = "passive";
    else if (norm.includes("perfect") || norm.includes("hoan thanh") || norm.includes("hoàn thành")) key = "present_perfect";
    else if (norm.includes("reading") || norm.includes("doc hieu") || norm.includes("đọc hiểu")) key = "reading";
    else if (norm.includes("writing") || norm.includes("viet luan") || norm.includes("viết")) key = "writing";
    else if (norm.includes("vocabulary") || norm.includes("tu vung") || norm.includes("từ vựng")) key = "vocabulary";
    else if (norm.includes("pronunciation") || norm.includes("phat am") || norm.includes("trong am") || norm.includes("phát âm")) key = "pronunciation";

    if (key && LESSON_TEMPLATES[key]) return LESSON_TEMPLATES[key].body(level, duration, objective);

    // Generic fallback cho chủ đề khác
    var obj = objective || "Ôn tập và thực hành " + topic;
    var mins = parseInt(duration)||90, t=_t(mins);
    return "GIÁO ÁN TIẾNG ANH\n" + "=".repeat(48) + "\n\n" +
"Chủ đề    : " + topic + "\nTrình độ  : " + level + "\nThời lượng: " + duration + "\nMục tiêu  : " + obj + "\n\n" +
"I. MỤC TIÊU BÀI HỌC\n" + "─".repeat(40) + "\n" +
"• Kiến thức: Nắm vững lý thuyết và cấu trúc " + topic + "\n" +
"• Kỹ năng  : Vận dụng trong giao tiếp và làm bài thi THPTQG\n" +
"• Thái độ  : Tích cực, chủ động luyện tập\n\n" +
"II. TIẾN TRÌNH DẠY HỌC\n" + "─".repeat(40) + "\n\n" +
"1. KHỞI ĐỘNG (" + t.w + " phút)\n   • Câu hỏi dẫn nhập liên quan đến " + topic + "\n\n" +
"2. KIỂM TRA BÀI CŨ (" + t.r + " phút)\n   • Gọi 2–3 HS trả lời, nhận xét\n\n" +
"3. BÀI MỚI — " + topic.toUpperCase() + " (" + t.m + " phút)\n" +
"   a) Lý thuyết & cấu trúc (20 phút)\n" +
"   b) Ví dụ từ đề thi THPTQG (" + Math.round(t.m*.45) + " phút)\n" +
"   c) Luyện tập có hướng dẫn (" + Math.round(t.m*.3) + " phút)\n\n" +
"4. LUYỆN TẬP ĐỘC LẬP (" + t.p + " phút)\n   • 15–20 câu trắc nghiệm\n\n" +
"5. CỦNG CỐ & GIAO BÀI (" + t.c + " phút)\n   • Bài về nhà: 20 câu đề liên quan đến " + topic + "\n\n" +
"IV. GHI CHÚ\n" + "─".repeat(40) + "\n" +
"• Lưu ý lỗi thường gặp với trình độ " + level + "\n" +
"[Giáo án AI English Center]";
  }

  function renderAiSuggestions() {
    const list = document.getElementById("qaList");
    if (!list) return;
    const sel = document.getElementById("aiCourseSelect");
    if (sel && state.courses.length) {
      sel.innerHTML = '<option value="">-- Chọn lớp để lưu --</option>' +
        state.courses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
    }
    const topics = [
      "Mệnh đề quan hệ — Relative Clauses",
      "Câu điều kiện — Conditional Sentences",
      "Thì hiện tại hoàn thành — Present Perfect",
      "Câu bị động — Passive Voice",
      "Đọc hiểu — Reading Comprehension",
      "Viết luận — Writing Task",
      "Từ vựng chủ đề — Topic Vocabulary",
      "Phát âm & Trọng âm — Pronunciation"
    ];
    list.innerHTML = topics.map(text =>
      `<button class="qa" type="button" onclick="EC_TEACHER.quickTopic('${escapeHtml(text)}')">`+
      `<i class="bi bi-stars" style="color:var(--purple)"></i>`+
      `<span style="font-size:13px;font-weight:700">${escapeHtml(text)}</span></button>`
    ).join("");
  }

  function quickTopic(text) {
    const input = document.getElementById("aiTopic");
    if (input) { input.value = text; input.focus(); }
  }

  async function genAI() {
    const topic = (document.getElementById("aiTopic")?.value || "").trim();
    const level = document.getElementById("aiLv")?.value || "Trung bình";
    const duration = document.getElementById("aiDur")?.value || "90 phút";
    const objective = (document.getElementById("aiObjective")?.value || "").trim();
    if (!topic) return notify("Vui lòng nhập chủ đề bài giảng.", "error");

    const box = document.getElementById("aiBox");
    const out = document.getElementById("aiOut");
    const genBtn = document.getElementById("aiGenBtn");
    if (box) box.style.display = "block";
    if (out) out.innerHTML = '<div style="display:flex;align-items:center;gap:10px;color:var(--purple);padding:24px 0"><span style="width:18px;height:18px;border:2.5px solid var(--purple);border-top-color:transparent;border-radius:50%;display:inline-block;animation:spin .7s linear infinite"></span><span>AI đang soạn giáo án...</span></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    if (genBtn) { genBtn.disabled = true; genBtn.textContent = "Đang tạo..."; }
    ["aiCopyBtn", "aiExportBtn", "aiSaveBtn"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "none"; });
    state.aiDraft = "";

    try {
      const res = await request("/api/ai/generate-lesson-plan", {
        method: "POST",
        body: JSON.stringify({ topic, level, duration, objective })
      });
      state.aiDraft = (res.lessonPlan || "").trim();
    } catch (_) {
      notify("AI chưa phản hồi — hiển thị mẫu giáo án chuẩn.", "warning");
    }

    if (!state.aiDraft) state.aiDraft = generateLocalLessonPlan(topic, level, duration, objective);

    if (out) out.textContent = state.aiDraft;
    if (genBtn) { genBtn.disabled = false; genBtn.innerHTML = '<i class="bi bi-robot"></i> Tạo lại'; }
    const sel = document.getElementById("aiCourseSelect");
    if (sel) sel.style.display = "";
    ["aiCopyBtn", "aiExportBtn", "aiSaveBtn"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "inline-flex"; });
  }

  async function copyAI() {
    if (!state.aiDraft) return;
    try {
      await navigator.clipboard.writeText(state.aiDraft);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = state.aiDraft;
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    notify("Đã sao chép giáo án vào clipboard.");
  }

  function exportAILesson() {
    if (!state.aiDraft) return notify("Chưa có giáo án để tải.", "error");
    const topic = (document.getElementById("aiTopic")?.value || "giao-an").trim().replace(/\s+/g, "-");
    const blob = new Blob([state.aiDraft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `giao-an-${topic}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    notify("Đã tải giáo án xuống.");
  }

  async function saveAILesson() {
    if (!state.aiDraft) return notify("Chưa có giáo án AI để lưu.", "error");
    const topic = (document.getElementById("aiTopic")?.value || "Giáo án AI").trim();
    const courseId = document.getElementById("aiCourseSelect")?.value || state.courses[0]?.id || "";
    if (!courseId) return notify("Vui lòng chọn lớp học trước khi lưu.", "error");
    const btn = document.getElementById("aiSaveBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Đang lưu...'; }
    try {
      await request("/api/material-requests", {
        method: "POST",
        body: JSON.stringify({ title: topic, courseId, type: "lesson", status: "pending", description: state.aiDraft })
      });
      notify("Đã lưu giáo án — chờ admin duyệt.", "success");
      await refresh();
    } catch (err) {
      notify(err.message || "Lưu thất bại.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-floppy-fill"></i> Lưu & Nộp duyệt'; }
    }
  }

  function setRptPeriod(el, period) {
    document.querySelectorAll("#s-baocao .rpt-s").forEach(item => item.classList.remove("active"));
    if (el) el.classList.add("active");
    const labels = { tuan: "Thong ke tuan nay", thang: "Thong ke thang nay", quy: "Thong ke quy nay" };
    setText("#rptPeriodLabel", labels[period] || "Thong ke lop hoc");
    renderReports();
  }

  function exportReport() {
    exportReportXLS();
  }

  function exportReportXLS() {
    const rows = [
      ["Course", "Students", "Average score", "Average progress"],
      ...state.courses.map(course => [course.name, course.students || 0, course.averageScore || 0, course.averageProgress || 0])
    ];
    downloadText(`teacher-report-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  function prevWeek() {
    window._weekOffset = (window._weekOffset || 0) - 1;
    renderCal();
  }

  function nextWeek() {
    window._weekOffset = (window._weekOffset || 0) + 1;
    renderCal();
  }

  function openAddSession() {
    document.getElementById("addSessionModal")?.classList.add("show");
  }

  function closeAddSession() {
    document.getElementById("addSessionModal")?.classList.remove("show");
  }

  function closeAttModal() {
    document.getElementById("attModal")?.classList.remove("show");
  }

  function setAtt(btn) {
    const row = btn.closest(".att-row");
    if (!row) return;
    row.querySelectorAll(".att-b").forEach(item => {
      item.classList.remove("present", "late", "absent");
      item.style.background = "#fff";
      item.style.borderColor = "var(--line)";
      item.style.color = "var(--ink3)";
    });
    btn.classList.add(btn.dataset.st);
    const colors = {
      present: ["var(--green-lt)", "var(--green)", "#6ee7b7"],
      late: ["var(--amber-lt)", "var(--amber)", "#fcd34d"],
      absent: ["var(--red-lt)", "var(--red)", "#fca5a5"]
    }[btn.dataset.st] || ["#fff", "var(--ink3)", "var(--line)"];
    btn.style.background = colors[0];
    btn.style.color = colors[1];
    btn.style.borderColor = colors[2];
  }

  function markAllAtt(status) {
    document.querySelectorAll(`#attList .att-b[data-st="${status}"]`).forEach(setAtt);
  }

  function joinZoom(url, label) {
    if (!url) return notify(`Lop ${label || ""} chua co link hoc truc tuyen.`, "info");
    window.open(url, "_blank", "noopener");
  }

  function closeChamBai() {
    document.getElementById("chamBaiModal")?.classList.remove("show");
  }

  function onScoreInputChange() {
    const value = document.getElementById("scoreInput")?.value || "";
    setText("#cbTotalScore", value || "—");
  }

  function addComment(btn) {
    const text = (btn.textContent || "").trim();
    const ta = document.getElementById("cbComment");
    if (!ta || !text) return;
    ta.value = [ta.value.trim(), text].filter(Boolean).join(ta.value.trim() ? ". " : "");
  }

  function closeHsModal() {
    document.getElementById("hsModal")?.classList.remove("show");
  }

  function closeLecture() {
    const modal = document.getElementById("lectureModal");
    const frame = document.getElementById("prvFrame");
    if (frame) frame.src = "";
    if (modal) modal.classList.remove("show");
  }

  function closeReview() {
    document.getElementById("reviewModal")?.classList.remove("show");
  }

  function saveSn() {
    notify("Da luu ghi chu buoi hoc.");
    document.getElementById("sessionNoteModal")?.classList.remove("show");
  }

  async function saveSt() {
    const name = (document.getElementById("setName")?.value || "").trim();
    if (!name) return notify("Vui long nhap ho ten.", "error");
    const res = await request("/api/profile", { method: "PATCH", body: JSON.stringify({ name }) });
    if (window.EC_AUTH && res.user) window.EC_AUTH.setUser(res.user);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    state.user = res.user;
    applyIdentity();
    notify("Da luu thong tin tai khoan.");
  }

  async function saveEmailPrefix() {
    const prefix = (document.getElementById("setEmailUser")?.value || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!prefix) return notify("Email khong hop le.", "error");
    notify("Giao vien can lien he quan tri vien de doi email dang nhap.", "info");
  }

  function uploadAvatar(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem("ec_teacher_avatar", reader.result);
      ["sbAva", "bigAva"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<img src="${reader.result}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
      });
      notify("Da cap nhat avatar tren trinh duyet nay.");
    };
    reader.readAsDataURL(file);
  }

  function renderGlobalSearch(results) {
    const drop = document.getElementById("gsDrop");
    if (!drop) return;
    drop.classList.add("show");
    drop.innerHTML = results.length ? results.map(item => `<div class="gs-item" data-nav="${item.nav}" data-id="${item.id || ""}"><span class="gs-lbl">${escapeHtml(item.label)}</span><span class="gs-sub">${escapeHtml(item.sub || "")}</span></div>`).join("") : `<div class="gs-empty">Khong co ket qua.</div>`;
  }

  function gsSearch() {
    const q = (document.getElementById("gsInput")?.value || "").toLowerCase();
    const base = [
      { label: "Dashboard", nav: "dashboard", sub: "Tong quan" },
      { label: "Danh sach hoc sinh", nav: "hocsinh", sub: "Quan ly lop" },
      { label: "Bai giang cua toi", nav: "baigiang", sub: "Hoc lieu" },
      { label: "Tao de kiem tra", nav: "taode", sub: "Kiem tra" },
      { label: "Nhan xet & Phan hoi", nav: "phanhoi", sub: "Hoi dap" }
    ];
    const students = state.students.map(item => ({ label: item.n, nav: "hocsinh", id: item.id, sub: item.l }));
    renderGlobalSearch([...base, ...students].filter(item => !q || item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q)).slice(0, 12));
  }

  function gsKey(event) {
    if (event.key !== "Enter") return;
    const first = document.querySelector("#gsDrop .gs-item");
    if (first) first.click();
  }

  function doLogout() {
    if (window.EC_AUTH && typeof window.EC_AUTH.logout === "function") return window.EC_AUTH.logout();
    clearSession();
    location.href = "dangnhap.html";
  }

  function renderAll() {
    applyIdentity();
    syncCourseSelects();
    renderDashboard();
    renderSt();
    renderLectures();
    renderDe();
    renderCal();
    renderNotifications();
    renderFb();
    renderReports();
    renderAiSuggestions();
    renderQuestionList();
  }

  async function refresh() {
    state.user = currentUser();
    if (!token()) {
      showLoginRequired();
      return;
    }

    try {
      const [dashboardRes, coursesRes, enrollmentsRes, sessionsRes, materialsRes, examsRes, notifRes, questionsRes] = await Promise.all([
        request("/api/dashboard/teacher"),
        request(`/api/courses${state.user && state.user.id ? `?teacherId=${encodeURIComponent(state.user.id)}` : ""}`),
        request("/api/enrollments?limit=1000"),
        request("/api/class-sessions?limit=1000"),
        request("/api/material-requests?limit=200"),
        request("/api/exams?limit=200"),
        request("/api/notifications?limit=100"),
        request("/api/questions?limit=200")
      ]);
      state.dashboard = dashboardRes.dashboard || {};
      state.courses = coursesRes.courses || [];
      state.enrollments = enrollmentsRes.enrollments || [];
      state.students = state.enrollments.map(mapEnrollment);
      state.sessions = sessionsRes.sessions || [];
      state.materials = materialsRes.requests || [];
      state.exams = examsRes.exams || [];
      state.notifications = notifRes.notifications || [];
      state.questions = questionsRes.questions || [];
      window.STUDENTS = state.students;
      renderAll();
    } catch (error) {
      showRefreshError(error);
    }
  }

  function installOverrides() {
    const oldNav = window.nav;
    window.toast = toast;
    window.nav = function(id) {
      const targetId = document.getElementById(`s-${id}`) ? id : "dashboard";
      state.currentSection = targetId;
      if (typeof oldNav === "function") oldNav(targetId);
      setTimeout(() => {
        if (targetId === "hocsinh") renderSt();
        if (targetId === "baigiang") renderLectures();
        if (targetId === "taode") renderDe();
        if (targetId === "lichdayhoc") renderCal();
        if (targetId === "thongbao") renderNotifications();
        if (targetId === "baocao") renderReports();
      }, 0);
    };
    window.renderSt = renderSt;
    window.renderLec = renderLectures;
    window.renderDe = renderDe;
    window.renderCal = renderCal;
    window.renderFb = renderFb;
    window.renderTodaySessions = renderTodaySessions;
    window.updateRptChart = updateRptChart;
    window.renderTopStudents = renderTopStudents;
    window.toggleBulkMsg = toggleBulkMsg;
    window.toggleAddHs = toggleAddHs;
    window.toggleChip = toggleChip;
    window.toggleSelectAll = toggleSelectAll;
    window.setSortHs = setSortHs;
    window.exportStudentList = exportStudentList;
    window.importCSV = importCSV;
    window.addNewStudent = () => addNewStudent().catch(error => notify(error.message, "error"));
    window.openCreateLec = openCreateLec;
    window.closeCreateLec = closeCreateLec;
    window.switchClecTab = switchClecTab;
    window.handleClecFileSelect = handleClecFileSelect;
    window.handleClecFileDrop = handleClecFileDrop;
    window.handleClecAttach = handleClecAttach;
    window.addExercise = addExercise;
    window.submitLecForReview = () => submitMaterial("submitted").catch(error => notify(error.message, "error"));
    window.saveDraftLec = () => submitMaterial("pending").catch(error => notify(error.message, "error"));
    window.switchDeTab = switchDeTab;
    window.addQuestion = addQuestion;
    window.shuffleQuestions = shuffleQuestions;
    window.clearQuestions = clearQuestions;
    window.quickTemplate = quickTemplate;
    window.previewExam = previewExam;
    window.closeExamPreview = closeExamPreview;
    window.importFromBank = importFromBank;
    window.renderBank = renderBank;
    window.addSelectedBank = addSelectedBank;
    window.closeBank = closeBank;
    window.markAllReplied = () => markAllReplied().catch(error => notify(error.message, "error"));
    window.exportFeedback = exportFeedback;
    window.answerFeedback = (id) => answerFeedback(id).catch(error => notify(error.message, "error"));
    window.genAI = () => genAI().catch(error => notify(error.message, "error"));
    window.copyAI = () => copyAI().catch(error => notify(error.message, "error"));
    window.saveAILesson = () => saveAILesson().catch(error => notify(error.message, "error"));
    window.setRptPeriod = setRptPeriod;
    window.exportReport = exportReport;
    window.exportReportXLS = exportReportXLS;
    window.prevWeek = prevWeek;
    window.nextWeek = nextWeek;
    window.openAddSession = openAddSession;
    window.closeAddSession = closeAddSession;
    window.closeAttModal = closeAttModal;
    window.markAllAtt = markAllAtt;
    window.setAtt = setAtt;
    window.joinZoom = joinZoom;
    window.saveNewSession = () => saveNewSession().catch(error => notify(error.message, "error"));
    window.saveAttModal = () => saveAttendance().catch(error => notify(error.message, "error"));
    window.filterSchTable = renderScheduleTable;
    window.sendBulkMsg = () => sendBulkMsg().catch(error => notify(error.message, "error"));
    window.sendHsMsg = () => sendHsMsg().catch(error => notify(error.message, "error"));
    window.submitCham = () => submitGrade().catch(error => notify(error.message, "error"));
    window.closeChamBai = closeChamBai;
    window.addComment = addComment;
    window.onScoreInputChange = onScoreInputChange;
    window.closeHsModal = closeHsModal;
    window.saveHsNote = saveHsNote;
    window.closeLecture = closeLecture;
    window.closeReview = closeReview;
    window.saveSn = saveSn;
    window.uploadAvatar = uploadAvatar;
    window.saveEmailPrefix = () => saveEmailPrefix().catch(error => notify(error.message, "error"));
    window.saveSt = () => saveSt().catch(error => notify(error.message, "error"));
    window.gsSearch = gsSearch;
    window.gsKey = gsKey;
    window.doLogout = doLogout;
    window.deleteStudent = () => notify("Giao vien khong xoa tai khoan hoc sinh. Vui long lien he quan tri vien.", "warn");
    window.deleteSelected = () => notify("Giao vien khong xoa tai khoan hoc sinh. Vui long lien he quan tri vien.", "warn");
    document.addEventListener("click", event => {
      const btn = event.target.closest("#btnTaoDe");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      createExamFromForm().catch(error => notify(error.message, "error"));
    }, true);
    document.addEventListener("click", event => {
      const studentBtn = event.target.closest(".btn-xem-hs,.btn-nhank-hs");
      if (studentBtn) {
        openStudentModal(studentBtn.dataset.id, studentBtn.classList.contains("btn-nhank-hs"));
        return;
      }
      const attachBtn = event.target.closest(".btn-remove-attach");
      if (attachBtn) {
        state.clecAttachments.splice(Number(attachBtn.dataset.index), 1);
        renderAttachList();
        return;
      }
      const exerciseBtn = event.target.closest(".btn-remove-exercise");
      if (exerciseBtn) {
        state.clecExercises.splice(Number(exerciseBtn.dataset.index), 1);
        renderExercises();
        return;
      }
      const questionBtn = event.target.closest(".btn-del-question");
      if (questionBtn) {
        state.examQuestions = state.examQuestions.filter(item => item.id !== questionBtn.dataset.id);
        renderQuestionList();
        return;
      }
      const aiBtn = event.target.closest("[data-ai-topic]");
      if (aiBtn) {
        const input = document.getElementById("aiTopic");
        if (input) input.value = aiBtn.dataset.aiTopic;
        genAI().catch(error => notify(error.message, "error"));
        return;
      }
      const gsItem = event.target.closest("#gsDrop .gs-item");
      if (gsItem) {
        if (typeof window.nav === "function") window.nav(gsItem.dataset.nav);
        if (gsItem.dataset.id) setTimeout(() => openStudentModal(gsItem.dataset.id, false), 0);
        document.getElementById("gsDrop")?.classList.remove("show");
      }
    });
    document.addEventListener("change", event => {
      const box = event.target.closest(".tcb-sel");
      if (!box) return;
      if (box.checked) state.selectedStudentIds.add(box.dataset.id);
      else state.selectedStudentIds.delete(box.dataset.id);
      updateSelectionUi();
    });
    document.getElementById("btnMarkRead").addEventListener("click", () => {
      request("/api/notifications/read-all", { method: "POST" })
        .then(refresh)
        .then(() => notify("Da danh dau thong bao da doc."))
        .catch(error => notify(error.message, "error"));
    }, true);
    document.getElementById("btnChangePwd")?.addEventListener("click", () => {
      const currentPassword = document.getElementById("pwd1")?.value || "";
      const newPassword = document.getElementById("pwd2")?.value || "";
      const confirm = document.getElementById("pwd3")?.value || "";
      if (newPassword !== confirm) return notify("Mat khau xac nhan khong khop.", "error");
      request("/api/profile/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) })
        .then(() => {
          ["pwd1", "pwd2", "pwd3"].forEach(id => { const input = document.getElementById(id); if (input) input.value = ""; });
          notify("Da doi mat khau.");
        })
        .catch(error => notify(error.message, "error"));
    });
  }

  ready(function() {
    if (!location.pathname.toLowerCase().includes("dashboard_giaovien")) return;
    installOverrides();
    setTimeout(refresh, 250);
  });

  window.EC_TEACHER = {
    state,
    refresh,
    openGrade,
    openAttendance,
    contactStudent(id) {
      if (typeof window.nav === "function") window.nav("hocsinh");
      setTimeout(() => openStudentModal(id, true), 0);
    },
    previewMaterial(id) {
      const item = state.materials.find(row => row.id === id);
      if (!item) return;
      const title = document.getElementById("prvTitle");
      const meta = document.getElementById("prvMeta");
      const frame = document.getElementById("prvFrame");
      if (title) title.textContent = item.title;
      if (meta) meta.textContent = `${item.courseName || "Chua gan lop"} - ${materialStatus(item.status).label}`;
      if (frame) frame.src = item.videoUrl || item.documentUrl || "";
      if (!item.videoUrl && !item.documentUrl) {
        notify(item.description || "Noi dung nay chua co link xem truoc.", "info");
      }
      document.getElementById("lectureModal").classList.add("show");
    }
  };
})();
