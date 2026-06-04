(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, ready, request, notify, money, dateLabel, number, escapeHtml } = core;

  const activityLog = [];
  const firstSection = {
    overview: "overview",
    hocvien: "sec-dshv",
    crm: "sec-crm-embed",
    giaovien: "sec-dsgv",
    khoahoc: "sec-dskh",
    taichinh: "sec-taichinh",
    duyet: "sec-duyet-lich",
    tienich: "sec-baocao"
  };
  const sectionPage = {
    overview: "overview",
    "sec-dshv": "hocvien",
    "sec-nguycobohoc": "hocvien",
    "sec-tiendo": "hocvien",
    "sec-bxh": "hocvien",
    "sec-huyhieu": "hocvien",
    "sec-crm-embed": "hocvien",
    "sec-dsgv": "giaovien",
    "sec-khstats": "khoahoc",
    "sec-dskh": "khoahoc",
    "sec-dethi": "khoahoc",
    "sec-tailieu": "khoahoc",
    "sec-taichinh": "taichinh",
    "sec-coupon": "taichinh",
    "sec-duyet-lich": "duyet",
    "sec-hoidap": "duyet",
    "sec-baocao": "tienich",
    "sec-thongbao": "tienich",
    "sec-vinhdanh": "tienich"
  };
  const pageDiv = {
    overview: "overview",
    hocvien: "audiences",
    giaovien: "demographics",
    khoahoc: "demographics",
    taichinh: "more",
    duyet: "duyet-page",
    tienich: "tienich-page"
  };
  const titles = {
    overview: "Tong quan",
    "sec-dshv": "Hoc Vien",
    "sec-nguycobohoc": "Nguy Co Bo Hoc",
    "sec-tiendo": "Theo Doi Tien Do",
    "sec-bxh": "Bang Xep Hang",
    "sec-huyhieu": "Huy Hieu",
    "sec-crm-embed": "Phan Khuc CRM",
    "sec-dsgv": "Giao Vien",
    "sec-khstats": "Khoa Hoc",
    "sec-dskh": "Danh Sach Khoa Hoc",
    "sec-dethi": "Lich & Ca Hoc",
    "sec-tailieu": "Tai Lieu",
    "sec-taichinh": "Tai Chinh",
    "sec-coupon": "Ma Giam Gia",
    "sec-duyet-lich": "Duyet Noi Dung",
    "sec-hoidap": "Kiem Duyet Hoi Dap",
    "sec-baocao": "Bao Cao & Thong Ke",
    "sec-thongbao": "Thong Bao He Thong",
    "sec-vinhdanh": "Vinh Danh Hoc Vien"
  };
  const routeSection = {
    dashboard: "overview",
    overview: "overview",
    students: "sec-dshv",
    teachers: "sec-dsgv",
    courses: "sec-dskh",
    "approval-schedule": "sec-duyet-lich",
    approvals: "sec-duyet-lich",
    qa: "sec-hoidap",
    finance: "sec-taichinh",
    reports: "sec-baocao",
    notifications: "sec-thongbao",
    honor: "sec-vinhdanh"
  };
  const sectionRoute = {
    overview: "dashboard",
    "sec-dshv": "students",
    "sec-dsgv": "teachers",
    "sec-dskh": "courses",
    "sec-duyet-lich": "approval-schedule",
    "sec-hoidap": "qa",
    "sec-taichinh": "finance",
    "sec-baocao": "reports",
    "sec-thongbao": "notifications",
    "sec-vinhdanh": "honor"
  };

  function allSections() {
    return Object.keys(sectionPage).filter(id => id !== "overview");
  }

  function sectionExists(id) {
    return id === "overview" || !!document.getElementById(id);
  }

  function sectionFromRoute(fallback) {
    let hash = "";
    try {
      hash = decodeURIComponent((window.location.hash || "").replace(/^#/, "")).trim();
    } catch (_) {
      hash = "";
    }
    if (routeSection[hash]) return routeSection[hash];
    if (sectionExists(hash)) return hash;
    if (sectionExists(fallback)) return fallback;
    return "overview";
  }

  function routeForSection(sectionId) {
    const route = sectionRoute[sectionId] || sectionId || "overview";
    const nextHash = `#${encodeURIComponent(route)}`;
    if (window.location.hash === nextHash) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
  }

  function setSidebarActiveBySection(sectionId) {
    const pageKey = sectionPage[sectionId] || sectionId;
    const target = sectionId === "overview" ? "overview" : sectionId;
    const route = `#${sectionRoute[sectionId] || sectionId}`;
    let exact = null;
    let fallback = null;
    document.querySelectorAll(".sidebar .nav-link").forEach(link => {
      link.classList.remove("active");
      link.removeAttribute("aria-current");
      const onclick = link.getAttribute("onclick") || "";
      const href = link.getAttribute("href") || "";
      if (!exact && href === route) exact = link;
      if (!exact && onclick.includes(`'${target}'`)) exact = link;
      if (!fallback && onclick.includes(`'${pageKey}'`)) fallback = link;
    });
    const active = exact || fallback;
    if (active) {
      active.classList.add("active");
      active.setAttribute("aria-current", "page");
    }
  }

  function showSubTabs(pageKey, sectionId) {
    const khTabs = document.getElementById("khoahocSubTabs");
    const gvTabs = document.getElementById("giaovienSubTabs");
    if (khTabs) khTabs.style.display = pageKey === "khoahoc" ? "block" : "none";
    if (gvTabs) gvTabs.style.display = pageKey === "giaovien" ? "block" : "none";
    const tabMap = {
      "sec-khstats": "khtab-stats",
      "sec-dskh": "khtab-dskh",
      "sec-dethi": "khtab-dethi",
      "sec-tailieu": "khtab-tailieu",
      "sec-dsgv": "gvtab-dsgv"
    };
    ["khtab-stats", "khtab-dskh", "khtab-dethi", "khtab-tailieu", "gvtab-dsgv"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const isActive = tabMap[sectionId] === id;
      btn.style.color = isActive ? "#6366f1" : "#64748b";
      btn.style.borderBottom = isActive ? "3px solid #6366f1" : "3px solid transparent";
      btn.style.fontWeight = isActive ? "700" : "600";
    });
  }

  function setTabTitle(sectionId) {
    const tab = document.getElementById("home-tab");
    if (!tab) return;
    tab.innerHTML = `<i class="mdi mdi-view-dashboard me-1"></i>${escapeHtml(titles[sectionId] || "Tong quan")}`;
    tab.classList.toggle("active", sectionId === "overview");
  }

  function adminNavigate(tabKey, sectionId, options) {
    const target = sectionExists(sectionId) ? sectionId : sectionExists(tabKey) ? tabKey : firstSection[tabKey] || sectionFromRoute("overview");
    const pageKey = sectionPage[target] || tabKey || "overview";
    document.querySelectorAll(".spa-page").forEach(page => {
      page.style.display = "none";
    });
    allSections().forEach(id => {
      const section = document.getElementById(id);
      if (section) section.style.display = "none";
    });
    const container = document.getElementById(pageDiv[pageKey] || "overview");
    if (container) container.style.display = "block";
    const actualTarget = target === "sec-hoidap" ? "sec-duyet-lich" : target;
    const section = document.getElementById(actualTarget);
    if (section) section.style.display = "block";
    setSidebarActiveBySection(target);
    showSubTabs(pageKey, target);
    setTabTitle(target);
    routeForSection(target);
    if (!options || options.scroll !== false) window.scrollTo(0, 0);
    if (target === "sec-hoidap" && typeof window.switchDuyetTab === "function") window.switchDuyetTab("hoidap");
    else if (target === "sec-duyet-lich" && typeof window.switchDuyetTab === "function") window.switchDuyetTab("lich");
    core.renderActive(target);
  }

  function installNavigation() {
    window.setSidebarActive = function() {
      setSidebarActiveBySection(sectionFromRoute("overview"));
    };
    window.spaNav = function(tabKey, sectionId) {
      adminNavigate(tabKey, sectionId);
      return false;
    };
    document.querySelectorAll(".sidebar .nav-link[href^='#']").forEach(link => {
      link.addEventListener("click", event => {
        const href = link.getAttribute("href") || "";
        const token = decodeURIComponent(href.slice(1));
        const sectionId = routeSection[token] || (sectionExists(token) ? token : "");
        if (!sectionId) return;
        event.preventDefault();
        adminNavigate(sectionPage[sectionId] || sectionId, sectionId);
      });
    });
    window.addEventListener("hashchange", () => {
      const sectionId = sectionFromRoute("overview");
      adminNavigate(sectionPage[sectionId] || sectionId, sectionId, { scroll: false });
    });
    adminNavigate(sectionPage[sectionFromRoute("overview")] || "overview", sectionFromRoute("overview"), { scroll: false });
  }

  function ensureToast() {
    if (typeof window.adminToast === "function") return;
    window.adminToast = function(message, type) {
      const wrapId = "ecAdminToastWrap";
      let wrap = document.getElementById(wrapId);
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = wrapId;
        wrap.style.cssText = "position:fixed;right:18px;top:78px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:360px;";
        document.body.appendChild(wrap);
      }
      const colors = { success: "#10b981", danger: "#ef4444", error: "#ef4444", warning: "#f59e0b", info: "#3b82f6" };
      const item = document.createElement("div");
      item.className = "ec-toast";
      item.style.cssText = `background:#fff;border-left:4px solid ${colors[type] || colors.info};box-shadow:0 12px 30px rgba(15,23,42,.16);border-radius:10px;padding:11px 14px;font-size:13px;font-weight:600;color:#0f172a;`;
      item.textContent = message;
      wrap.appendChild(item);
      setTimeout(() => item.remove(), 3200);
    };
  }

  function csvEscape(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function reportRows(type) {
    const dashboard = state.dashboard || {};
    if (type === "students") {
      return [["Name", "Email", "Phone", "Class", "Created at"], ...state.students.map(row => [row.name, row.email, row.phone, row.education, row.createdAt])];
    }
    if (type === "teachers") {
      return [["Name", "Email", "Phone", "Experience", "Last active"], ...state.teachers.map(row => [row.name, row.email, row.phone, row.experience, row.lastActiveAt])];
    }
    if (type === "revenue") {
      return [["Year", "Month", "Revenue"], ...((dashboard.revenueByMonth || []).map(row => [row.year, row.month, row.revenue]))];
    }
    if (type === "progress") {
      return [["Student", "Course", "Progress", "Score", "Absences", "Payment"], ...state.enrollments.map(row => [row.studentName, row.courseName, row.progress, row.averageScore, row.absences, row.paymentStatus])];
    }
    if (type === "risk") {
      const ids = new Set((dashboard.studentAttention || []).map(row => row.id));
      return [["Student", "Email", "Course", "Progress", "Average score", "Absences"], ...(dashboard.studentAttention || []).map(row => [row.name, row.email, row.courseName, row.progress, row.averageScore, row.absences]), ...state.enrollments.filter(row => !ids.has(row.userId) && (number(row.progress) < 45 || number(row.absences) >= 2)).map(row => [row.studentName, row.studentEmail, row.courseName, row.progress, row.averageScore, row.absences])];
    }
    return [
      ["Metric", "Value"],
      ["Students", state.students.length],
      ["Teachers", state.teachers.length],
      ["Courses", state.courses.length],
      ["Enrollments", state.enrollments.length],
      ["Paid tuition", state.enrollments.filter(row => row.paymentStatus === "paid").reduce((sum, row) => sum + number(row.paidAmount), 0)],
      ["Pending materials", state.materialRequests.filter(row => ["pending", "submitted"].includes(row.status)).length],
      ["Open questions", state.questions.filter(row => row.status === "open").length]
    ];
  }

  function installExports() {
    window.exportHocPhi = function() {
      downloadCsv("hoc_phi_admin.csv", [["Student", "Email", "Course", "Paid amount", "Status", "Enrolled at"], ...state.enrollments.map(row => [row.studentName, row.studentEmail, row.courseName, row.paidAmount, row.paymentStatus, row.enrolledAt])]);
      notify("Da xuat CSV hoc phi.", "success");
    };
    window.exportAdminReport = function(type) {
      const key = type || "summary";
      downloadCsv(`admin_${key}_${new Date().toISOString().slice(0, 10)}.csv`, reportRows(key));
      notify("Da xuat bao cao tu du lieu he thong.", "success");
    };
    window.printAdminReport = function() {
      window.print();
    };
  }

  function installActivityLog() {
    window.logActivity = function(message, type) {
      activityLog.unshift({ time: new Date().toLocaleString("vi-VN"), message, type: type || "info" });
      if (activityLog.length > 100) activityLog.pop();
    };
    window.showActivityLog = function() {
      const list = document.getElementById("activityLogList");
      const count = document.getElementById("activityLogCount");
      if (list) {
        const rows = activityLog.length ? activityLog : state.notifications.slice(0, 20).map(row => ({
          time: dateLabel(row.createdAt, true),
          message: `${row.title}${row.userName ? ` - ${row.userName}` : ""}`,
          type: row.type || "info"
        }));
        list.innerHTML = rows.length ? rows.map(row => `<div class="ec-activity-item"><div class="ec-activity-dot" style="background:#6366f1"></div><div><div style="font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(row.message)}</div><div style="font-size:11px;color:#94a3b8;">${escapeHtml(row.time)} - ${escapeHtml(row.type)}</div></div></div>`).join("") : `<p class="text-muted text-center py-3 small">Chua co hoat dong nao.</p>`;
      }
      if (count) count.textContent = `Tong: ${activityLog.length || state.notifications.length} su kien`;
      const modal = document.getElementById("modalActivityLog");
      if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
    };
    window.clearActivityLog = function() {
      activityLog.length = 0;
      const list = document.getElementById("activityLogList");
      const count = document.getElementById("activityLogCount");
      if (list) list.innerHTML = `<p class="text-muted text-center py-3 small">Log da duoc xoa.</p>`;
      if (count) count.textContent = "Tong: 0 su kien";
    };
  }

  function installLegacyFunctionFallbacks() {
    window.setView = function(view) {
      const table = document.getElementById("viewTableContainer");
      const cards = document.getElementById("viewCardContainer");
      const tableBtn = document.getElementById("viewTable");
      const cardBtn = document.getElementById("viewCard");
      const tableMode = view !== "card";
      if (table) table.style.display = tableMode ? "" : "none";
      if (cards) cards.style.display = tableMode ? "none" : "";
      if (tableBtn) {
        tableBtn.style.background = tableMode ? "#6366f1" : "#fff";
        tableBtn.style.color = tableMode ? "#fff" : "#64748b";
      }
      if (cardBtn) {
        cardBtn.style.background = tableMode ? "#fff" : "#6366f1";
        cardBtn.style.color = tableMode ? "#64748b" : "#fff";
      }
      if (typeof window.unifiedRender === "function") window.unifiedRender();
    };
    window.resetFilters = function() {
      ["hvSearch", "hvFilterKhoa", "hvFilterTT", "hvFilterSeg", "hvFilterRisk"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      if (typeof window.unifiedRender === "function") window.unifiedRender();
    };
    window.rtForceRefresh = function() {
      core.loadAll(false);
    };
  }

  async function sendBulkInactiveReminder() {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const recipients = state.students.filter(student => {
      if (!student.lastActiveAt) return true;
      const last = new Date(student.lastActiveAt);
      return Number.isNaN(last.getTime()) || Date.now() - last.getTime() > sevenDays;
    });
    if (!recipients.length) return notify("Khong co hoc vien khong hoat dong can nhac.", "info");
    await Promise.all(recipients.map(student => request("/api/notifications", {
      method: "POST",
      body: JSON.stringify({
        userId: student.id,
        title: "Nhac nho hoc tap",
        body: "Hay dang nhap dashboard de tiep tuc tien do hoc tap cua ban.",
        type: "study"
      })
    })));
    notify(`Da gui nhac nho den ${recipients.length} hoc vien.`, "success");
    await core.loadAll(true);
  }

  function mountChart(id, config) {
    if (!window.Chart) return;
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (window._ecDestroyChart) window._ecDestroyChart(id);
    const chart = new Chart(canvas, config);
    if (window._ecRegChart) window._ecRegChart(id, chart);
  }

  function renderOverviewCharts() {
    const dashboard = state.dashboard || {};
    const revenue = (dashboard.revenueByMonth || []).slice(-12);
    const newStudents = (dashboard.newStudentTrend || []).slice(-12);
    const statuses = dashboard.studentStatusByCourse || [];
    const ratings = (dashboard.teacherRatings || []).slice(0, 8);
    const distribution = (dashboard.courseDistribution || []).slice(0, 8);
    const submissions = (dashboard.submissionRate || []).slice(-8);
    const progress = dashboard.courseProgress || [];
    const skills = dashboard.skillAverages || [];
    mountChart("marketingOverview", {
      type: "bar",
      data: { labels: revenue.map(row => `T${row.month}`), datasets: [{ label: "Doanh thu", data: revenue.map(row => Math.round(number(row.revenue) / 1000000 * 10) / 10), backgroundColor: "rgba(99,102,241,.72)", borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: value => `${value}tr` } }, x: { grid: { display: false } } } }
    });
    mountChart("newStudentTrendChart", {
      type: "line",
      data: { labels: newStudents.map(row => dateLabel(row.weekStart, false)), datasets: [{ label: "Hoc vien moi", data: newStudents.map(row => number(row.count)), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,.12)", fill: true, tension: .35 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    mountChart("studentStatusStackChart", {
      type: "bar",
      data: { labels: statuses.map(row => row.name), datasets: [
        { label: "Dang hoc", data: statuses.map(row => number(row.learning)), backgroundColor: "#6366f1" },
        { label: "Cham", data: statuses.map(row => number(row.slow)), backgroundColor: "#f59e0b" },
        { label: "Nguy co", data: statuses.map(row => number(row.risk)), backgroundColor: "#ef4444" },
        { label: "Hoan thanh", data: statuses.map(row => number(row.completed)), backgroundColor: "#10b981" }
      ] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } }
    });
    mountChart("submissionRateChart", {
      type: "bar",
      data: { labels: submissions.map(row => dateLabel(row.weekStart, false)), datasets: [
        { label: "Da cham", data: submissions.map(row => number(row.graded)), backgroundColor: "#10b981" },
        { label: "Cho cham", data: submissions.map(row => number(row.pending)), backgroundColor: "#f59e0b" },
        { label: "Tre", data: submissions.map(row => number(row.late)), backgroundColor: "#ef4444" }
      ] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
    mountChart("teacherRatingChart", {
      type: "bar",
      data: { labels: ratings.map(row => row.name), datasets: [{ label: "Danh gia", data: ratings.map(row => number(row.rating)), backgroundColor: "#8b5cf6", borderRadius: 6 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 5 } } }
    });
    mountChart("polarCoursesChart", {
      type: "polarArea",
      data: { labels: distribution.map(row => row.name), datasets: [{ data: distribution.map(row => number(row.students)), backgroundColor: ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    mountChart("radarSkillChart", {
      type: "radar",
      data: { labels: skills.map(row => row.type || "skill"), datasets: [{ label: "Diem TB", data: skills.map(row => number(row.averageScore)), borderColor: "#6366f1", backgroundColor: "rgba(99,102,241,.15)" }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 10 } } }
    });
    const grouped = progress.reduce((map, row) => {
      if (!map[row.name]) map[row.name] = [];
      map[row.name].push(row);
      return map;
    }, {});
    mountChart("courseProgressChart", {
      type: "line",
      data: { labels: Array.from(new Set(progress.map(row => dateLabel(row.weekStart, false)))).slice(-8), datasets: Object.entries(grouped).slice(0, 5).map(([name, rows], index) => ({ label: name, data: rows.slice(-8).map(row => number(row.averageScore)), borderColor: ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"][index], tension: .35 })) },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 10 } } }
    });
  }

  function set(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderOverview() {
    if (!state.dashboard) return;
    const overview = state.dashboard.overview || {};
    const cards = document.querySelectorAll("#overview .ec-kpi-card .card-body");
    const values = [
      number(overview.totalStudents),
      number(overview.totalTeachers),
      number(overview.activeCourses),
      number(overview.pendingGrading),
      money(overview.monthRevenue),
      `${number(overview.averageCompletion).toFixed(1)}%`
    ];
    const subtitles = [
      `${number(overview.newStudentsThisWeek)} hoc vien moi tuan nay`,
      `${number(overview.newTeachersThisMonth)} giao vien moi thang nay`,
      "Khoa hoc dang mo",
      "Bai nop cho cham",
      "Doanh thu thang hien tai",
      "Tien do trung binh"
    ];
    cards.forEach((card, index) => {
      const value = card.querySelector("h3");
      const sub = card.querySelector("span");
      if (value && values[index] != null) value.textContent = values[index];
      if (sub && subtitles[index]) sub.textContent = subtitles[index];
    });

    // Mini KPI sparkline row
    const monthRevenue = number(overview.monthRevenue);
    const newStudentsThisWeek = number(overview.newStudentsThisWeek);
    const avgCompletion = number(overview.averageCompletion);
    const revenueRows = state.dashboard.revenueByMonth || [];
    const prevMonthRevenue = revenueRows.length >= 2 ? number(revenueRows[revenueRows.length - 2].revenue) : 0;
    const revChangePct = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue * 100).toFixed(1) : null;
    set("miniRevenueVal", monthRevenue >= 1000000
      ? `${(monthRevenue / 1000000).toFixed(1)} tr ₫`
      : new Intl.NumberFormat("vi-VN").format(monthRevenue) + " ₫");
    const miniRevSub = document.getElementById("miniRevenueSub");
    if (miniRevSub) miniRevSub.innerHTML = `<i class="mdi mdi-trending-${revChangePct !== null && revChangePct >= 0 ? "up" : "down"}" style="font-size:13px;"></i>${revChangePct !== null ? (revChangePct >= 0 ? "+" : "") + revChangePct + "% so tháng trước" : "Cập nhật từ DB"}`;
    set("miniStudentsVal", `${newStudentsThisWeek} HV`);
    const miniStudSub = document.getElementById("miniStudentsSub");
    if (miniStudSub) miniStudSub.innerHTML = `<i class="mdi mdi-account-plus" style="font-size:13px;"></i>Học viên đăng ký mới tuần này`;
    set("miniCompletionVal", `${avgCompletion.toFixed(1)}%`);
    const miniCompSub = document.getElementById("miniCompletionSub");
    if (miniCompSub) miniCompSub.innerHTML = `<i class="mdi mdi-check-circle-outline" style="font-size:13px;"></i>Tỷ lệ hoàn thành trung bình`;
    // Main revenue display
    set("mainRevenueVal", new Intl.NumberFormat("vi-VN").format(monthRevenue));
    const mainRevSub = document.getElementById("mainRevenueSub");
    if (mainRevSub) mainRevSub.textContent = revChangePct !== null ? `${revChangePct >= 0 ? "↑ +" : "↓ "}${revChangePct}% so tháng trước` : "";

    // Online stats
    const online = state.dashboard.online || {};
    set("rtTotal", number(online.total));
    set("rtStudents", number(online.students));
    set("rtTeachers", number(online.teachers));
    set("rtLearning", number(online.learning));
    set("rtOnlineCount", `${number(online.total)} online`);
    set("rtLastUpdate", `Cap nhat ${new Date().toLocaleTimeString("vi-VN")}`);
    const list = document.getElementById("rtUserList");
    if (list) {
      const users = state.dashboard.recentOnlineUsers || [];
      list.innerHTML = users.length ? users.map(user => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;"><strong>${escapeHtml(user.name)}</strong><span class="text-muted">${escapeHtml(user.role)}</span></div>`).join("") : `<div class="text-muted small">Chua co nguoi dung online.</div>`;
    }

    // Student attention list
    const attentionList = document.getElementById("studentAttentionList");
    if (attentionList) {
      const rows = (state.dashboard.studentAttention || []).slice(0, 5);
      if (rows.length) {
        attentionList.innerHTML = rows.map((row, idx) => {
          const pct = Math.max(0, Math.min(100, number(row.progress)));
          const color = pct < 30 ? "#ef4444" : pct < 60 ? "#f59e0b" : "#10b981";
          const barClass = pct < 30 ? "bg-danger" : pct < 60 ? "bg-warning" : "bg-success";
          const border = idx < rows.length - 1 ? "border-bottom" : "";
          return `<div class="d-flex align-items-center justify-content-between py-2 ${border}">
            <div class="d-flex align-items-center gap-2">
              <div style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0;"></div>
              <span style="font-size:12px;font-weight:600;">${escapeHtml(row.name)}</span>
            </div>
            <div class="d-flex align-items-center gap-1">
              <div class="progress" style="width:60px;height:5px;border-radius:99px;"><div class="progress-bar ${barClass}" style="width:${pct}%"></div></div>
              <span style="font-size:11px;color:${color};font-weight:700;">${pct}%</span>
            </div>
          </div>`;
        }).join("");
      } else {
        attentionList.innerHTML = `<div class="text-muted small text-center py-3">Khong co hoc vien can chu y.</div>`;
      }
    }

    // Fee doughnut chart in overview
    const feeStatus = state.dashboard.feeStatus || [];
    if (window.Chart && document.getElementById("feeDoughnutChart")) {
      if (window._ecDestroyChart) window._ecDestroyChart("feeDoughnutChart");
      const feeLabels = feeStatus.map(r => r.status === "paid" ? "Da thu" : r.status === "overdue" ? "Qua han" : r.status === "refunded" ? "Hoan tien" : "Cho thu");
      const feeData = feeStatus.map(r => number(r.amount));
      const feeColors = feeStatus.map(r => r.status === "paid" ? "#10b981" : r.status === "overdue" ? "#ef4444" : r.status === "refunded" ? "#94a3b8" : "#f59e0b");
      const feeChart = new Chart(document.getElementById("feeDoughnutChart"), {
        type: "doughnut",
        data: { labels: feeLabels, datasets: [{ data: feeData, backgroundColor: feeColors, borderWidth: 0 }] },
        options: { cutout: "68%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      if (window._ecRegChart) window._ecRegChart("feeDoughnutChart", feeChart);
      const legend = document.getElementById("feeDoughnutLegend");
      if (legend) {
        legend.innerHTML = feeStatus.map((r, i) => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-bottom:3px;"><span style="display:flex;gap:5px;align-items:center;"><span style="width:9px;height:9px;border-radius:2px;background:${feeColors[i]};display:inline-block;"></span>${feeLabels[i]}</span><b>${money(r.amount)}</b></div>`).join("");
      }
    }

    // System alerts from real data
    const pendingGrading = number(overview.pendingGrading);
    const inactiveCount = state.students.filter(s => {
      if (!s.lastActiveAt) return true;
      const d = new Date(s.lastActiveAt);
      return Number.isNaN(d.getTime()) || Date.now() - d.getTime() > 7 * 24 * 60 * 60 * 1000;
    }).length;
    const openQA = state.questions.filter(q => q.status === "open").length;
    const pendingMaterials = state.materialRequests.filter(r => ["pending", "submitted"].includes(r.status)).length;
    set("sysAlertPending", `${pendingGrading} bài chưa chấm`);
    set("sysAlertInactive", `${inactiveCount} học viên không đăng nhập > 7 ngày`);
    set("sysAlertQA", `${openQA} câu hỏi chờ xử lý`);
    set("sysAlertMaterials", `${pendingMaterials} tài liệu đang chờ phê duyệt`);

    // Notification count in navbar
    const unreadCount = state.notifications.filter(n => !n.isRead).length;
    set("navNotifCount", unreadCount > 0 ? unreadCount : "");
    set("navNotifText", unreadCount);
    const countEl = document.getElementById("navNotifCount");
    if (countEl) countEl.style.display = unreadCount > 0 ? "" : "none";

    // Admin greeting name
    const user = window.EC_AUTH ? window.EC_AUTH.getUser() : null;
    if (user && user.name) {
      set("adminGreetName", user.name);
      const dropNames = document.querySelectorAll(".navbar .dropdown-header p");
      if (dropNames[0]) dropNames[0].textContent = user.name;
      if (dropNames[1]) dropNames[1].textContent = user.email || "";
    }

    renderOverviewCharts();
  }

  function hookExistingButtons() {
    const topExport = Array.from(document.querySelectorAll("button")).find(button => button.querySelector(".icon-download") || (button.textContent || "").includes("Xuat bao cao") || (button.textContent || "").includes("Xuất báo cáo"));
    if (topExport) topExport.onclick = () => window.exportAdminReport("summary");
    document.querySelectorAll("#sec-baocao button").forEach(button => {
      const text = button.textContent || "";
      if (button.querySelector(".mdi-microsoft-excel") || button.querySelector(".mdi-file-pdf-box") || text.includes("Excel") || text.includes("PDF")) button.onclick = () => window.exportAdminReport("summary");
      else if (button.querySelector(".mdi-account-group") || text.includes("Hoc vien") || text.includes("Học viên")) button.onclick = () => window.exportAdminReport("students");
      else if (button.querySelector(".mdi-currency-usd") || text.includes("Doanh thu")) button.onclick = () => window.exportAdminReport("revenue");
      else if (button.querySelector(".mdi-account-tie") || text.includes("Giao vien") || text.includes("Giáo viên") || text.includes("GV")) button.onclick = () => window.exportAdminReport("teachers");
      else if (button.querySelector(".mdi-chart-line") || text.includes("Tien do") || text.includes("Tiến độ")) button.onclick = () => window.exportAdminReport("progress");
      else if (button.querySelector(".mdi-alert-circle") || text.includes("Nguy") || text.includes("Nguy cơ")) button.onclick = () => window.exportAdminReport("risk");
    });
    document.querySelectorAll("#overview .ec-quick-actions button").forEach(button => {
      if (button.querySelector(".mdi-email-send")) button.onclick = () => sendBulkInactiveReminder().catch(error => notify(error.message, "danger"));
      if (button.querySelector(".mdi-file-chart")) button.onclick = () => window.exportAdminReport("summary");
      if (button.querySelector(".mdi-refresh")) button.onclick = () => core.loadAll(false);
    });
  }

  Object.assign(window.EC_ADMIN_OPS, {
    refresh: () => core.loadAll(false),
    exportReport: type => window.exportAdminReport(type)
  });
  window.EC_ADMIN_RENDERERS.overview = renderOverview;

  ready(() => {
    ensureToast();
    installExports();
    installActivityLog();
    installLegacyFunctionFallbacks();
    installNavigation();
    hookExistingButtons();
    core.loadAll(true);
    window.logActivity("Admin dashboard loaded from API", "success");
    setInterval(() => core.loadAll(true), 60000);
  });
})();
