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
    if (!response.ok || data.ok === false) throw new Error(data.message || "Yeu cau khong thanh cong.");
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

  function notify(message, type) {
    if (typeof window.toast === "function") window.toast(message, type || "success");
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
  }

  function renderAttentionTable() {
    const body = document.querySelectorAll("#s-dashboard table tbody")[0];
    if (!body) return;
    const rows = (state.dashboard.attentionStudents || []).slice(0, 6);
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
    const body = document.querySelectorAll("#s-dashboard table tbody")[1];
    if (!body) return;
    const rows = state.dashboard.pendingSubmissions || [];
    body.innerHTML = rows.length ? rows.map(item => (
      `<tr><td><div style="display:flex;align-items:center;gap:9px"><div class="ava" style="background:linear-gradient(135deg,#2563eb,#60a5fa)">${escapeHtml(initials(item.studentName))}</div><span style="font-weight:600">${escapeHtml(item.studentName)}</span></div></td>` +
      `<td style="color:var(--ink3)">${escapeHtml(item.title)}</td><td><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(item.courseName)}</span></td>` +
      `<td style="text-align:right;color:var(--ink4)">${escapeHtml(moneyDate(item.submittedAt))}</td>` +
      `<td style="text-align:right"><button onclick="EC_TEACHER.openGrade('${escapeHtml(item.id)}')" class="btn-cham" style="background:var(--purple);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer">Cham bai</button></td></tr>`
    )).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--ink4);padding:20px">Chua co bai nop dang cho cham.</td></tr>`;
  }

  function renderSt() {
    const cl = (document.getElementById("fcl") || {}).value || "";
    const st = (document.getElementById("fst") || {}).value || "";
    const q = ((document.getElementById("fq") || {}).value || "").toLowerCase();
    const sortV = (document.getElementById("fsort") || {}).value || "name";
    let rows = state.students.filter(student =>
      (!cl || student.l === cl) &&
      (!st || student.st === st) &&
      (!q || student.n.toLowerCase().includes(q) || student.email.toLowerCase().includes(q))
    );
    rows = rows.slice().sort((a, b) => {
      if (sortV === "score_desc") return b.sc - a.sc;
      if (sortV === "score_asc") return a.sc - b.sc;
      if (sortV === "progress") return b.pr - a.pr;
      if (sortV === "absent") return b.ab - a.ab;
      return a.n.localeCompare(b.n, "vi");
    });
    setText("#stCnt", `${rows.length} hoc sinh`);
    setText("#hsSubtitle", `${state.students.length} hoc sinh trong ${state.courses.length} lop hoc`);
    const body = document.getElementById("stBody");
    if (!body) return;
    body.innerHTML = rows.length ? rows.map(student => {
      const idx = state.students.indexOf(student);
      const scoreColor = student.sc >= 8 ? "var(--green)" : student.sc >= 6.5 ? "var(--amber)" : "var(--red)";
      const absentColor = student.ab > 2 ? "var(--red)" : student.ab > 0 ? "var(--amber)" : "var(--green)";
      return `<tr><td><input type="checkbox" class="tcb-sel" data-idx="${idx}" style="width:15px;height:15px;accent-color:var(--purple);cursor:pointer"></td>` +
        `<td><div style="display:flex;align-items:center;gap:10px"><div class="ava" style="background:linear-gradient(${student.g})">${escapeHtml(student.i)}</div><div><div style="font-weight:700;color:var(--ink)">${escapeHtml(student.n)}</div><div style="font-size:11px;color:var(--ink4)">${escapeHtml(student.phone)}</div></div></div></td>` +
        `<td><span class="tag" style="background:#f1f5f9;color:var(--ink2);font-size:11px">${escapeHtml(student.l)}</span></td>` +
        `<td style="min-width:130px"><div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink4);margin-bottom:3px"><span>Hoan thanh</span><span>${student.pr}%</span></div><div class="pb"><div class="pf" style="width:${student.pr}%;background:var(--purple)"></div></div></td>` +
        `<td style="text-align:center"><span style="font-size:15px;font-weight:800;color:${scoreColor}">${student.sc}</span><span style="font-size:10px;color:var(--ink4)">/10</span></td>` +
        `<td style="text-align:center"><span style="font-size:13px;font-weight:700">${student.nop}</span><div style="font-size:10px;color:var(--ink4)">bai</div></td>` +
        `<td style="text-align:center"><span style="font-size:13px;font-weight:700;color:${absentColor}">${student.ab}</span><div style="font-size:10px;color:var(--ink4)">buoi</div></td>` +
        `<td style="text-align:center"><span class="tag" style="background:${student.sb};color:${student.st2}">${student.st}</span></td>` +
        `<td style="text-align:center"><div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap"><button data-idx="${idx}" class="btn-xem-hs btn-sm sec" style="padding:4px 9px;font-size:11.5px"><i class="bi bi-person-lines-fill"></i> Ho so</button><button data-idx="${idx}" class="btn-nhank-hs btn-sm prim" style="padding:4px 9px;font-size:11.5px"><i class="bi bi-chat-dots-fill"></i> Nhan</button></div></td></tr>`;
    }).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--ink4);padding:28px">Khong co hoc sinh phu hop.</td></tr>`;
  }

  async function addNewStudent() {
    const name = (document.getElementById("newHsName")?.value || "").trim();
    const phone = (document.getElementById("newHsPhone")?.value || "").trim();
    const courseId = document.getElementById("newHsLop")?.value || "";
    if (!name) return notify("Vui long nhap ho ten hoc sinh.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "hocvien";
    const email = `${slug}.${Date.now().toString().slice(-6)}@example.com`;
    const data = await request("/api/users", {
      method: "POST",
      body: JSON.stringify({ name, phone, email, role: "student", password: "student123", courseId })
    });
    notify(`Da them hoc sinh. Email: ${data.user.email} - mat khau: ${data.defaultPassword || "student123"}`);
    document.getElementById("newHsName").value = "";
    document.getElementById("newHsPhone").value = "";
    document.getElementById("addHsForm")?.classList.remove("show");
    await refresh();
  }

  function renderLectures() {
    const filter = document.getElementById("lgFilter")?.value || "";
    const sort = document.getElementById("lgSort")?.value || "date";
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

  async function submitMaterial(status) {
    const title = (document.getElementById("clecTitle")?.value || "").trim();
    const courseId = document.getElementById("clecClass")?.value || "";
    if (!title) return notify("Vui long nhap tieu de.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    await request("/api/material-requests", {
      method: "POST",
      body: JSON.stringify({ title, courseId, type: "lesson", status })
    });
    notify(status === "pending" ? "Da luu ban nhap." : "Da gui noi dung cho quan tri vien duyet.");
    if (typeof window.closeCreateLec === "function") window.closeCreateLec();
    await refresh();
    window.nav?.("baigiang", document.querySelector("[onclick*=baigiang]"));
  }

  function renderDe() {
    const list = document.getElementById("deList");
    if (!list) return;
    list.innerHTML = state.exams.length ? state.exams.map(exam => {
      const total = Number(exam.submissions || 0);
      const pending = Number(exam.pendingSubmissions || 0);
      return `<div style="padding:13px 0;border-bottom:1px solid var(--line)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="font-size:13.5px;font-weight:700">${escapeHtml(exam.title)}</span><span style="font-size:11.5px;color:var(--ink4)">${escapeHtml(moneyDate(exam.createdAt))}</span></div>` +
        `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><span class="tag" style="background:#ede9fe;color:#6d28d9;font-size:11px">${escapeHtml(exam.courseName || "Chua gan lop")}</span><span style="font-size:12px;font-weight:600;color:var(--ink3)">${total} bai nop - ${pending} cho cham</span></div>` +
        `<div style="display:flex;gap:6px"><button onclick="window.nav && nav('dashboard',document.querySelector('[onclick*=dashboard]'))" style="background:var(--purple-lt);color:var(--purple);border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer"><i class="bi bi-bar-chart-fill me-1"></i>Xem bai nop</button></div></div>`;
    }).join("") : `<div style="text-align:center;color:var(--ink4);padding:30px">Chua co de kiem tra nao.</div>`;
  }

  async function createExamFromForm() {
    const title = (document.getElementById("tenDe")?.value || "").trim();
    const courseId = document.querySelector("#s-taode .fr select")?.value || "";
    const duration = Number(document.querySelector("#s-taode input[type=number]")?.value || 60);
    const type = document.getElementById("deLoai")?.value || "quiz";
    if (!title) return notify("Vui long nhap ten de.", "error");
    if (!courseId) return notify("Vui long chon lop hoc.", "error");
    await request("/api/exams", {
      method: "POST",
      body: JSON.stringify({ title, courseId, durationMinutes: duration, type, totalScore: 10, status: "published" })
    });
    document.getElementById("tenDe").value = "";
    if (window.QUESTIONS) window.QUESTIONS.length = 0;
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
    const classFilter = document.getElementById("schFilterLop")?.value || "";
    const statusFilter = document.getElementById("schFilterStatus")?.value || "";
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
    const courseId = document.getElementById("newSchLop")?.value || "";
    const date = document.getElementById("newSchDate")?.value || "";
    const time = document.getElementById("newSchTime")?.value || "19:00";
    const duration = parseInt(document.getElementById("newSchDur")?.value || "60", 10) || 60;
    const meetingUrl = (document.getElementById("newSchZoom")?.value || "").trim();
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
    document.getElementById("addSessionModal")?.classList.remove("show");
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
    document.getElementById("attModal")?.classList.add("show");
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
          note: document.getElementById("sessionNote")?.value || ""
        })
      });
    }));
    await request(`/api/class-sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "done" })
    });
    notify("Da luu diem danh.");
    document.getElementById("attModal")?.classList.remove("show");
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
    const body = (document.getElementById("bulkMsgTx")?.value || "").trim();
    if (!body) return notify("Vui long nhap noi dung thong bao.", "error");
    const selected = document.querySelector(".cls-chip.sel")?.dataset.lop || "all";
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
    const targetName = document.getElementById("hsMsgTarget")?.textContent || "";
    const student = state.students.find(item => item.n === targetName);
    const body = (document.getElementById("hsMsgTa")?.value || "").trim();
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
    document.getElementById("chamBaiModal")?.classList.add("show");
  }

  async function submitGrade() {
    const score = Number(document.getElementById("scoreInput")?.value);
    if (!state.currentGradeId) return notify("Chua chon bai nop.", "error");
    if (!Number.isFinite(score) || score < 0 || score > 10) return notify("Diem phai nam trong khoang 0 den 10.", "error");
    await request(`/api/exam-results/${encodeURIComponent(state.currentGradeId)}`, {
      method: "PATCH",
      body: JSON.stringify({ score, feedback: document.getElementById("cbComment")?.value || "" })
    });
    state.currentGradeId = "";
    document.getElementById("chamBaiModal")?.classList.remove("show");
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
    const courseName = document.getElementById("rptChartLop")?.value || "";
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
    const body = bodies[0];
    if (!body) return;
    body.innerHTML = state.courses.length ? state.courses.map(course => {
      const progress = Math.round(Number(course.averageProgress || 0));
      const excellent = state.students.filter(student => student.courseId === course.id && student.sc >= 8.5).length;
      return `<tr><td><span class="tag" style="background:#ede9fe;color:#6d28d9">${escapeHtml(course.name)}</span></td><td style="text-align:center;font-weight:700">${course.students || 0}</td><td style="text-align:center;font-weight:800;color:var(--green)">${Number(course.averageScore || 0).toFixed(1)}</td><td style="text-align:center;color:var(--ink3)">${progress}%</td><td style="text-align:center;font-weight:700;color:var(--amber)">${excellent}</td><td style="min-width:100px"><div class="pb"><div class="pf" style="width:${progress}%;background:var(--green)"></div></div></td></tr>`;
    }).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--ink4);padding:22px">Chua co lop hoc.</td></tr>`;
  }

  function renderSupportTable() {
    const bodies = document.querySelectorAll("#s-baocao table tbody");
    const body = bodies[1];
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

  function renderAll() {
    applyIdentity();
    syncCourseSelects();
    renderDashboard();
    renderSt();
    renderLectures();
    renderDe();
    renderCal();
    renderNotifications();
    renderReports();
  }

  async function refresh() {
    state.user = currentUser();
    if (!token()) return;
    const [dashboardRes, coursesRes, enrollmentsRes, sessionsRes, materialsRes, examsRes, notifRes] = await Promise.all([
      request("/api/dashboard/teacher"),
      request(`/api/courses${state.user && state.user.id ? `?teacherId=${encodeURIComponent(state.user.id)}` : ""}`),
      request("/api/enrollments?limit=1000"),
      request("/api/class-sessions?limit=1000"),
      request("/api/material-requests?limit=200"),
      request("/api/exams?limit=200"),
      request("/api/notifications?limit=100")
    ]);
    state.dashboard = dashboardRes.dashboard || {};
    state.courses = coursesRes.courses || [];
    state.enrollments = enrollmentsRes.enrollments || [];
    state.students = state.enrollments.map(mapEnrollment);
    state.sessions = sessionsRes.sessions || [];
    state.materials = materialsRes.requests || [];
    state.exams = examsRes.exams || [];
    state.notifications = notifRes.notifications || [];
    window.STUDENTS = state.students;
    renderAll();
  }

  function installOverrides() {
    const oldNav = window.nav;
    window.nav = function(id, el) {
      state.currentSection = id;
      if (typeof oldNav === "function") oldNav(id, el);
      setTimeout(() => {
        if (id === "hocsinh") renderSt();
        if (id === "baigiang") renderLectures();
        if (id === "taode") renderDe();
        if (id === "lichdayhoc") renderCal();
        if (id === "thongbao") renderNotifications();
        if (id === "baocao") renderReports();
      }, 0);
    };
    window.renderSt = renderSt;
    window.renderLec = renderLectures;
    window.renderDe = renderDe;
    window.renderCal = renderCal;
    window.renderTodaySessions = renderTodaySessions;
    window.updateRptChart = updateRptChart;
    window.renderTopStudents = renderTopStudents;
    window.addNewStudent = () => addNewStudent().catch(error => notify(error.message, "error"));
    window.submitLecForReview = () => submitMaterial("submitted").catch(error => notify(error.message, "error"));
    window.saveDraftLec = () => submitMaterial("pending").catch(error => notify(error.message, "error"));
    window.saveNewSession = () => saveNewSession().catch(error => notify(error.message, "error"));
    window.saveAttModal = () => saveAttendance().catch(error => notify(error.message, "error"));
    window.filterSchTable = renderScheduleTable;
    window.sendBulkMsg = () => sendBulkMsg().catch(error => notify(error.message, "error"));
    window.sendHsMsg = () => sendHsMsg().catch(error => notify(error.message, "error"));
    window.submitCham = () => submitGrade().catch(error => notify(error.message, "error"));
    window.deleteStudent = () => notify("Giao vien khong xoa tai khoan hoc sinh. Vui long lien he quan tri vien.", "warn");
    window.deleteSelected = () => notify("Giao vien khong xoa tai khoan hoc sinh. Vui long lien he quan tri vien.", "warn");
    window.importCSV = () => notify("Chuc nang import se duoc xu ly qua quan tri vien de tranh trung tai khoan.", "info");
    document.addEventListener("click", event => {
      const btn = event.target.closest("#btnTaoDe");
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      createExamFromForm().catch(error => notify(error.message, "error"));
    }, true);
    document.getElementById("btnMarkRead")?.addEventListener("click", () => {
      state.notifications.forEach(item => { item.isRead = true; });
      renderNotifications();
      notify("Da danh dau thong bao da doc.");
    }, true);
  }

  ready(function() {
    if (!location.pathname.toLowerCase().includes("dashboard_giaovien")) return;
    installOverrides();
    setTimeout(() => refresh().catch(error => notify(error.message, "error")), 250);
  });

  window.EC_TEACHER = {
    state,
    refresh,
    openGrade,
    openAttendance,
    previewMaterial(id) {
      const item = state.materials.find(row => row.id === id);
      if (!item) return;
      const title = document.getElementById("prvTitle");
      const meta = document.getElementById("prvMeta");
      const frame = document.getElementById("prvFrame");
      if (title) title.textContent = item.title;
      if (meta) meta.textContent = `${item.courseName || "Chua gan lop"} - ${materialStatus(item.status).label}`;
      if (frame) frame.src = "";
      document.getElementById("lectureModal")?.classList.add("show");
    }
  };
})();
