(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  async function getDashboard(role) {
    if (window.location.protocol === "file:" || !token()) return null;
    const response = await fetch(`/api/dashboard/${role}`, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) return null;
    return data.dashboard || null;
  }

  async function apiGet(path) {
    if (window.location.protocol === "file:" || !token()) return null;
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${token()}` }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) return null;
    return data;
  }

  function text(el, value) {
    if (el && value !== undefined && value !== null) el.textContent = value;
  }

  function money(value) {
    const number = Number(value || 0);
    if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace(".0", "")} tr VND`;
    return `${number.toLocaleString("vi-VN")} VND`;
  }

  function dateTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("vi-VN", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function pageLabel(value) {
    const page = String(value || "").split("?")[0].split("/").pop() || "online";
    return {
      "admin.html": "Admin",
      "index.html": "Trang chu",
      "khoahoc.html": "Khoa hoc",
      "chonkhoahoc.html": "Chon khoa",
      "dashboard_hocsinh.html": "Dashboard HS",
      "dashboard_hocsinh_new.html": "Dashboard HS",
      "dashboard_giaovien.html": "Dashboard GV",
      "baihoc.html": "Dang hoc"
    }[page] || page;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, match => (match === "Đ" ? "D" : "d"))
      .toLowerCase();
  }

  function findCardByTitle(fragment) {
    const needle = normalizeText(fragment);
    const titles = Array.from(document.querySelectorAll(".card-title, .card-title-dash, h4, h5"));
    const title = titles.find(el => normalizeText(el.textContent).includes(needle));
    return title ? title.closest(".card-body") || title.closest(".card") : null;
  }

  function destroyChart(id) {
    if (window._ecDestroyChart) {
      window._ecDestroyChart(id);
      return;
    }
    const canvas = document.getElementById(id);
    if (canvas && window.Chart && Chart.getChart) {
      const chart = Chart.getChart(canvas);
      if (chart) chart.destroy();
    }
  }

  function mountChart(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart) return null;
    destroyChart(id);
    const instance = new Chart(canvas.getContext("2d"), config);
    if (window._ecRegChart) return window._ecRegChart(id, instance);
    return instance;
  }

  function chartBase(extra) {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
        tooltip: { backgroundColor: "rgba(15,23,42,0.92)", cornerRadius: 10 }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { font: { size: 10 } } }
      }
    };
    return Object.assign(base, extra || {});
  }

  function weekLabel(item) {
    if (!item || !item.weekStart) return item && item.weekKey ? item.weekKey.slice(-2) : "";
    const d = new Date(item.weekStart);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthLabel(item) {
    return item ? `T${item.month}/${String(item.year).slice(-2)}` : "";
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function weekKey(date) {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
    return `${target.getUTCFullYear()}${String(week).padStart(2, "0")}`;
  }

  function trailingMonths(rows, count) {
    const byKey = new Map((rows || []).map(row => [`${row.year}-${String(row.month).padStart(2, "0")}`, row]));
    const end = new Date();
    end.setDate(1);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(end.getFullYear(), end.getMonth() - (count - 1 - index), 1);
      const found = byKey.get(monthKey(date)) || {};
      return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        revenue: Number(found.revenue || 0)
      };
    });
  }

  function trailingWeeks(rows, count) {
    const byKey = new Map((rows || []).map(row => [String(row.weekKey), row]));
    const end = new Date();
    const day = (end.getDay() + 6) % 7;
    end.setDate(end.getDate() - day);
    end.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_, index) => {
      const start = new Date(end);
      start.setDate(end.getDate() - (count - 1 - index) * 7);
      const key = weekKey(start);
      const found = byKey.get(key) || {};
      return {
        weekKey: key,
        weekStart: start.toISOString(),
        count: Number(found.count || 0),
        graded: Number(found.graded || 0),
        pending: Number(found.pending || 0),
        late: Number(found.late || 0),
        total: Number(found.total || 0)
      };
    });
  }

  function feeStatusRows(rows) {
    const labels = ["paid", "pending", "overdue", "refunded"];
    const byStatus = new Map((rows || []).map(row => [row.status, row]));
    return labels.map(status => ({
      status,
      amount: Number((byStatus.get(status) || {}).amount || 0),
      count: Number((byStatus.get(status) || {}).count || 0)
    }));
  }

  function hasAnyValue(values) {
    return values.some(value => Number(value || 0) > 0);
  }

  function emptyPlugin(message) {
    return {
      id: `ecEmpty${Math.random().toString(16).slice(2)}`,
      afterDraw(chart) {
        const datasets = chart.data.datasets || [];
        const values = datasets.flatMap(dataset => dataset.data || []).map(value => {
          if (value && typeof value === "object") return Number(value.y || value.r || 0);
          return Number(value || 0);
        });
        if (hasAnyValue(values)) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        ctx.save();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "600 12px Plus Jakarta Sans, Arial";
        ctx.textAlign = "center";
        ctx.fillText(message || "Chua co du lieu de hien thi", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
        ctx.restore();
      }
    };
  }

  function statusLabel(status) {
    return {
      paid: "Da thu",
      pending: "Cho thu",
      overdue: "Qua han",
      refunded: "Hoan tien",
      active: "Dang hoc",
      completed: "Hoan thanh"
    }[status] || status;
  }

  function initials(name) {
    const parts = String(name || "HS").trim().split(/\s+/).filter(Boolean);
    return parts.slice(-2).map(part => part.charAt(0)).join("").toUpperCase() || "HS";
  }

  function studentStatus(progress, score, absences) {
    if (Number(absences || 0) >= 4) return { label: "Vang hoc", bg: "#fef3c7", color: "#d97706" };
    if (Number(score || 0) >= 8.5 || Number(progress || 0) >= 90) return { label: "Xuat sac", bg: "#ede9fe", color: "#6d28d9" };
    if (Number(score || 0) >= 7 || Number(progress || 0) >= 65) return { label: "Hoc tot", bg: "#d1fae5", color: "#059669" };
    if (Number(score || 0) < 6 || Number(progress || 0) < 45) return { label: "Can ho tro", bg: "#fee2e2", color: "#dc2626" };
    return { label: "Trung binh", bg: "#f1f5f9", color: "#64748b" };
  }

  function segmentFromEnrollment(item) {
    const progress = Number(item.progress || 0);
    if (item.status === "completed" || progress >= 90) return "star";
    if (progress < 30 || Number(item.absences || 0) >= 4) return "risk";
    if (progress < 50) return "inactive";
    const enrolledAt = item.enrolledAt ? new Date(item.enrolledAt).getTime() : 0;
    if (enrolledAt && Date.now() - enrolledAt < 14 * 24 * 60 * 60 * 1000) return "new";
    return "normal";
  }

  function statusFromEnrollment(item) {
    if (item.status === "completed" || Number(item.progress || 0) >= 95) return "Hoan thanh";
    if (Number(item.progress || 0) < 30 || Number(item.absences || 0) >= 4) return "Nguy co bo hoc";
    if (Number(item.progress || 0) < 50) return "Cham tien do";
    return "Dang hoc";
  }

  function updateSelectOptions(id, labels, allLabel) {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${allLabel}</option>` +
      labels.map(label => `<option>${escapeHtml(label)}</option>`).join("");
    if (labels.includes(current)) select.value = current;
  }

  function pctChange(current, previous) {
    if (!previous && !current) return "0%";
    if (!previous) return "+100%";
    const value = ((current - previous) / previous) * 100;
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  function setSparkCard(canvasId, value, subtitle) {
    const card = document.getElementById(canvasId)?.closest(".card-body");
    if (!card) return;
    const title = card.querySelector("h3");
    const note = card.querySelector("span[style*='border-radius:20px']");
    text(title, value);
    text(note, subtitle);
    if (note) {
      const positive = !String(subtitle).startsWith("-");
      note.style.color = positive ? "#10b981" : "#ef4444";
      note.style.background = positive ? "#ecfdf5" : "#fee2e2";
    }
  }

  function renderSparkline(id, data, color) {
    mountChart(id, {
      type: "line",
      data: {
        labels: data.map((_, index) => index + 1),
        datasets: [{
          data,
          borderColor: color,
          borderWidth: 2.5,
          fill: true,
          backgroundColor: "rgba(99,102,241,0.08)",
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        animation: false
      },
      plugins: [emptyPlugin("")]
    });
  }

  function renderOverviewSparklines(dashboard, revenue, newStudents) {
    const stats = dashboard.overview || {};
    const revenueSeries = revenue.map(row => Math.round(Number(row.revenue || 0) / 1000000 * 10) / 10);
    const studentSeries = newStudents.map(row => Number(row.count || 0));
    const statusRows = dashboard.studentStatusByCourse || [];
    const completionSeries = statusRows.length
      ? statusRows.map(row => {
          const total = Number(row.learning || 0) + Number(row.slow || 0) + Number(row.risk || 0) + Number(row.completed || 0);
          return total ? Math.round(Number(row.completed || 0) / total * 100) : 0;
        })
      : [Number(stats.averageCompletion || 0)];

    renderSparkline("sparkRevenue", revenueSeries, "#6366f1");
    renderSparkline("sparkStudents", studentSeries, "#10b981");
    renderSparkline("sparkCompletion", completionSeries, "#f59e0b");

    const currentRevenue = revenueSeries[revenueSeries.length - 1] || 0;
    const previousRevenue = revenueSeries[revenueSeries.length - 2] || 0;
    const currentStudents = studentSeries[studentSeries.length - 1] || 0;
    const previousStudents = studentSeries[studentSeries.length - 2] || 0;

    setSparkCard("sparkRevenue", money(stats.monthRevenue || 0), `${pctChange(currentRevenue, previousRevenue)} so thang truoc`);
    setSparkCard("sparkStudents", `${Number(stats.newStudentsThisWeek || currentStudents || 0)} HV`, `${currentStudents - previousStudents >= 0 ? "+" : ""}${currentStudents - previousStudents} so tuan truoc`);
    setSparkCard("sparkCompletion", `${Number(stats.averageCompletion || 0).toFixed(1)}%`, "Theo tien do hoc tap");

    const revenueCard = findCardByTitle("doanh thu theo thang");
    if (revenueCard) {
      const h2 = revenueCard.querySelector("h2");
      const trend = revenueCard.querySelector(".text-success, .text-danger");
      text(h2, Number(stats.monthRevenue || 0).toLocaleString("vi-VN"));
      text(trend, pctChange(currentRevenue, previousRevenue));
      if (trend) {
        trend.classList.toggle("text-success", currentRevenue >= previousRevenue);
        trend.classList.toggle("text-danger", currentRevenue < previousRevenue);
      }
    }
  }

  function renderCourseRevenueChart(rows) {
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444"];
    const dataRows = (rows || []).filter(row => Number(row.revenue || 0) > 0);
    const chartRows = dataRows.length ? dataRows : (rows || []).slice(0, 6);
    mountChart("doughnutChart", {
      type: "doughnut",
      data: {
        labels: chartRows.map(row => row.name),
        datasets: [{ data: chartRows.map(row => row.revenue), backgroundColor: colors, borderWidth: 0, hoverOffset: 5 }]
      },
      options: chartBase({ cutout: "68%", plugins: { legend: { display: false } } }),
      plugins: [emptyPlugin("Chua co doanh thu theo khoa")]
    });
    const legend = document.getElementById("doughnutChart-legend");
    if (!legend) return;
    const total = chartRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0) || 1;
    legend.innerHTML = chartRows.length ? chartRows.map((row, index) => (
      `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;gap:8px;">` +
      `<span style="display:flex;align-items:center;gap:6px;color:#475569;min-width:0;"><i style="width:9px;height:9px;border-radius:2px;background:${colors[index % colors.length]};display:inline-block;flex-shrink:0;"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(row.name)}</span></span>` +
      `<strong style="color:#0f172a;white-space:nowrap;">${money(row.revenue)} <span style="color:#94a3b8;font-weight:400">(${Math.round(Number(row.revenue || 0) / total * 100)}%)</span></strong>` +
      `</div>`
    )).join("") : '<div class="text-muted small">Chua co doanh thu theo khoa.</div>';
  }

  function renderAdminCharts(dashboard) {
    const colors = ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444"];
    const revenue = trailingMonths(dashboard.revenueByMonth || [], 12);
    const fee = feeStatusRows(dashboard.feeStatus || []);
    const newStudents = trailingWeeks(dashboard.newStudentTrend || [], 12);
    const submissions = trailingWeeks(dashboard.submissionRate || [], 8);
    renderOverviewSparklines(dashboard, revenue, newStudents);
    renderCourseRevenueChart(dashboard.courseRevenue || []);

    mountChart("marketingOverview", {
      type: "bar",
      data: {
        labels: revenue.map(monthLabel),
        datasets: [{
          label: "Doanh thu",
          data: revenue.map(row => Math.round((row.revenue || 0) / 1000000 * 10) / 10),
          backgroundColor: "rgba(99,102,241,0.72)",
          borderRadius: 7,
          borderSkipped: false
        }]
      },
      options: chartBase({
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw} tr VND` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { callback: v => `${v}tr`, font: { size: 10 } } }
        }
      }),
      plugins: [emptyPlugin("Chua co doanh thu da thu")]
    });

    const feeTotal = fee.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
    mountChart("feeDoughnutChart", {
      type: "doughnut",
      data: {
        labels: fee.map(item => statusLabel(item.status)),
        datasets: [{ data: fee.map(item => item.amount), backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"], borderWidth: 0 }]
      },
      options: chartBase({ cutout: "70%", plugins: { legend: { display: false } } }),
      plugins: [emptyPlugin("Chua co hoc phi")]
    });
    const feeLegend = document.getElementById("feeDoughnutLegend");
    if (feeLegend) {
      feeLegend.innerHTML = fee.map((item, index) => {
        const pct = Math.round(Number(item.amount || 0) / feeTotal * 100);
        return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;">` +
          `<span style="display:flex;align-items:center;gap:6px;color:#475569;font-weight:600"><i style="width:10px;height:10px;border-radius:3px;background:${["#10b981", "#f59e0b", "#ef4444", "#94a3b8"][index]};display:inline-block"></i>${statusLabel(item.status)}</span>` +
          `<strong style="color:#0f172a">${money(item.amount)} <span style="color:#94a3b8;font-weight:500">(${pct}%)</span></strong>` +
          `</div>`;
      }).join("");
    }

    mountChart("newStudentTrendChart", {
      type: "line",
      data: {
        labels: newStudents.map(weekLabel),
        datasets: [{
          label: "Hoc vien moi",
          data: newStudents.map(row => row.count),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.12)",
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }]
      },
      options: chartBase(),
      plugins: [emptyPlugin("Chua co hoc vien moi")]
    });

    const statuses = dashboard.studentStatusByCourse || [];
    mountChart("studentStatusStackChart", {
      type: "bar",
      data: {
        labels: statuses.map(row => row.name),
        datasets: [
          { label: "Dang hoc tot", data: statuses.map(row => row.learning), backgroundColor: "rgba(16,185,129,0.82)" },
          { label: "Cham tien do", data: statuses.map(row => row.slow), backgroundColor: "rgba(245,158,11,0.82)" },
          { label: "Nguy co", data: statuses.map(row => row.risk), backgroundColor: "rgba(239,68,68,0.82)" },
          { label: "Hoan thanh", data: statuses.map(row => row.completed), backgroundColor: "rgba(99,102,241,0.75)" }
        ]
      },
      options: chartBase({
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { font: { size: 10 } } }
        }
      }),
      plugins: [emptyPlugin("Chua co dang ky khoa hoc")]
    });

    renderCourseProgressChart(dashboard.courseProgress || [], colors);

    const teachers = (dashboard.teacherRatings || []).slice(0, 8).sort((a, b) => a.rating - b.rating);
    mountChart("teacherRatingChart", {
      type: "bar",
      data: {
        labels: teachers.map(row => row.name),
        datasets: [{ label: "Diem danh gia", data: teachers.map(row => row.rating), backgroundColor: "rgba(99,102,241,0.82)", borderRadius: 6 }]
      },
      options: chartBase({
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 5, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }),
      plugins: [emptyPlugin("Chua co danh gia giao vien")]
    });

    const distribution = dashboard.courseDistribution || [];
    mountChart("polarCoursesChart", {
      type: "polarArea",
      data: {
        labels: distribution.map(row => row.name),
        datasets: [{ data: distribution.map(row => row.students), backgroundColor: colors.map(color => `${color}bf`) }]
      },
      options: chartBase({ scales: { r: { ticks: { display: false }, grid: { color: "rgba(148,163,184,0.18)" } } } }),
      plugins: [emptyPlugin("Chua co hoc vien theo khoa")]
    });

    mountChart("submissionRateChart", {
      type: "line",
      data: {
        labels: submissions.map(weekLabel),
        datasets: [
          { label: "Da cham", data: submissions.map(row => row.graded), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.12)", fill: true, tension: 0.35 },
          { label: "Cho cham", data: submissions.map(row => row.pending), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)", fill: true, tension: 0.35 },
          { label: "Nop tre", data: submissions.map(row => row.late), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", fill: true, tension: 0.35 }
        ]
      },
      options: chartBase(),
      plugins: [emptyPlugin("Chua co bai nop")]
    });

    renderSkillChart(dashboard.skillAverages || []);
    renderBubbleChart(dashboard.studentAttention || []);
    renderActivityChart(dashboard.activityHeatmap || []);
  }

  function renderCourseProgressChart(rows, colors) {
    const weeks = rows.length
      ? Array.from(new Set(rows.map(row => String(row.weekKey || "")).filter(Boolean))).sort()
      : trailingWeeks([], 8).map(row => row.weekKey);
    const courses = Array.from(new Set(rows.map(row => row.name)));
    const legend = document.getElementById("cpLegend");
    if (legend) legend.innerHTML = "";
    mountChart("courseProgressChart", {
      type: "line",
      data: {
        labels: weeks.map(key => `W${String(key).slice(-2)}`),
        datasets: (courses.length ? courses : ["Chua co diem"]).map((name, index) => {
          const color = colors[index % colors.length];
          if (legend) {
            legend.innerHTML += `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:${color}18;color:${color};font-size:12px;font-weight:700"><i style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block"></i>${escapeHtml(name)}</span>`;
          }
          return {
            label: name,
            data: courses.length ? weeks.map(week => {
              const row = rows.find(item => item.name === name && item.weekKey === week);
              return row ? row.averageScore : null;
            }) : weeks.map(() => 0),
            borderColor: color,
            backgroundColor: `${color}18`,
            fill: true,
            tension: 0.35,
            spanGaps: true
          };
        })
      },
      options: chartBase({
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, max: 10, grid: { color: "rgba(148,163,184,0.18)" }, ticks: { font: { size: 10 } } }
        }
      }),
      plugins: [emptyPlugin("Chua co diem bai kiem tra")]
    });
  }

  function renderSkillChart(skills) {
    const labels = { mock_test: "De thi", homework: "Bai tap", quiz: "Quiz", speaking: "Speaking" };
    const rows = skills && skills.length ? skills : [{ type: "score", averageScore: 0 }];
    mountChart("radarSkillChart", {
      type: "radar",
      data: {
        labels: rows.map(item => labels[item.type] || item.type),
        datasets: [{
          label: "Diem TB",
          data: rows.map(item => item.averageScore),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.16)",
          pointBackgroundColor: "#6366f1"
        }]
      },
      options: chartBase({ scales: { r: { min: 0, max: 10, ticks: { stepSize: 2 }, grid: { color: "rgba(148,163,184,0.18)" } } } }),
      plugins: [emptyPlugin("Chua co diem ky nang")]
    });
  }

  function renderBubbleChart(students) {
    const rows = students && students.length ? students : [{ name: "Chua co du lieu", progress: 0, averageScore: 0, absences: 0 }];
    mountChart("bubbleAttendanceChart", {
      type: "bubble",
      data: {
        datasets: [{
          label: "Hoc vien can chu y",
          data: rows.map(item => ({
            x: Math.max(0, 100 - Number(item.absences || 0) * 18),
            y: Number(item.averageScore || 0),
            r: students && students.length ? Math.max(5, 14 - Number(item.progress || 0) / 10) : 0,
            name: item.name
          })),
          backgroundColor: rows.map(item => Number(item.averageScore || 0) < 6 ? "rgba(239,68,68,0.62)" : "rgba(245,158,11,0.62)")
        }]
      },
      options: chartBase({
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw.name}: diem ${ctx.raw.y}, chuyen can ${ctx.raw.x}%` } }
        },
        scales: {
          x: { min: 0, max: 100, title: { display: true, text: "Chuyen can uoc tinh (%)" } },
          y: { min: 0, max: 10, title: { display: true, text: "Diem TB" } }
        }
      }),
      plugins: [emptyPlugin("Chua co hoc vien can chu y")]
    });
  }

  function renderActivityChart(heatmap) {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    heatmap.forEach(row => { totals[row.dayIndex] = (totals[row.dayIndex] || 0) + Number(row.count || 0); });
    mountChart("leaveReport", {
      type: "bar",
      data: {
        labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
        datasets: [{ label: "Hoat dong hoc", data: totals, backgroundColor: "rgba(99,102,241,0.72)", borderRadius: 6 }]
      },
      options: chartBase({ plugins: { legend: { display: false } } })
    });

    const el = document.getElementById("heatmapActivity");
    if (!el) return;
    const days = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    const hours = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21];
    const max = Math.max(1, ...heatmap.map(row => Number(row.count || 0)));
    el.innerHTML = `<div style="display:grid;grid-template-columns:34px repeat(${hours.length},1fr);gap:4px;min-width:640px">` +
      `<div></div>${hours.map(h => `<div style="font-size:10px;color:#64748b;text-align:center;font-weight:700">${h}h</div>`).join("")}` +
      days.map((day, dayIndex) => (
        `<div style="font-size:11px;color:#64748b;font-weight:800;display:flex;align-items:center">${day}</div>` +
        hours.map(hour => {
          const row = heatmap.find(item => item.dayIndex === dayIndex && item.hour === hour);
          const value = row ? Number(row.count || 0) : 0;
          const alpha = 0.08 + (value / max) * 0.72;
          return `<div title="${day} ${hour}h: ${value} hoat dong" style="height:28px;border-radius:6px;background:rgba(99,102,241,${alpha});display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:${alpha > 0.45 ? "#fff" : "#475569"}">${value || ""}</div>`;
        }).join("")
      )).join("") +
      `</div>`;
  }

  function renderAdminLists(dashboard) {
    const attentionCard = findCardByTitle("hoc vien can chu y");
    if (attentionCard) {
      const header = attentionCard.querySelector(".d-flex.justify-content-between") || attentionCard.firstElementChild;
      const list = (dashboard.studentAttention || []).slice(0, 5);
      attentionCard.innerHTML = "";
      if (header) attentionCard.appendChild(header);
      attentionCard.insertAdjacentHTML("beforeend", list.length ? list.map(item => {
        const color = Number(item.averageScore || 0) < 6 || Number(item.progress || 0) < 35 ? "#ef4444" : "#f59e0b";
        return `<div class="d-flex align-items-center justify-content-between py-2 border-bottom">` +
          `<div class="d-flex align-items-center gap-2" style="min-width:0"><span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></span>` +
          `<div style="min-width:0"><div style="font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.name)}</div><div style="font-size:11px;color:#64748b">${escapeHtml(item.courseName)} · vang ${item.absences}</div></div></div>` +
          `<div style="display:flex;align-items:center;gap:6px"><div class="progress" style="width:58px;height:5px;border-radius:99px"><div class="progress-bar" style="background:${color};width:${Math.min(100, item.progress)}%"></div></div><strong style="font-size:11px;color:${color}">${Math.round(item.progress)}%</strong></div>` +
          `</div>`;
      }).join("") : `<div class="text-muted small py-3">Khong co hoc vien can canh bao.</div>`);
    }

    const topCard = findCardByTitle("top hoc vien");
    if (topCard) {
      const header = topCard.querySelector(".d-flex.justify-content-between") || topCard.firstElementChild;
      const list = (dashboard.topStudents || []).slice(0, 5);
      topCard.innerHTML = "";
      if (header) topCard.appendChild(header);
      topCard.insertAdjacentHTML("beforeend", `<div style="display:flex;flex-direction:column;gap:10px;flex:1;justify-content:center;">${list.map((item, index) => {
        const pct = Math.max(0, Math.min(100, Number(item.averageScore || 0) * 10));
        return `<div style="display:flex;align-items:center;gap:10px;">` +
          `<div style="width:28px;height:28px;border-radius:50%;background:${index < 3 ? ["#f59e0b", "#64748b", "#ea580c"][index] : "#eef2ff"};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:${index < 3 ? "#fff" : "#6366f1"};flex-shrink:0;">${index + 1}</div>` +
          `<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.name)}</div>` +
          `<div style="display:flex;align-items:center;gap:6px;margin-top:2px"><div style="flex:1;height:5px;border-radius:99px;background:#f1f5f9;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#6366f1,#a855f7);border-radius:99px"></div></div><span style="font-size:11px;font-weight:800;color:#6366f1;flex-shrink:0">${Number(item.averageScore || 0).toFixed(1)}</span></div></div>` +
          `</div>`;
      }).join("")}</div>`);
    }

    const gamification = findCardByTitle("gamification");
    if (gamification) {
      const stats = dashboard.overview || {};
      const rows = gamification.querySelectorAll(".d-flex.justify-content-between span.fw-semibold");
      text(rows[0], `${Number(stats.totalXp || 0).toLocaleString("vi-VN")} XP`);
      text(rows[1], `+${Number(stats.activitiesToday || 0)} hoat dong`);
      text(rows[2], `${Number(stats.averageCompletion || 0).toFixed(1)}% TB`);
      text(rows[3], `${Number(stats.activitiesToday || 0)} / ${Number(stats.totalStudents || 0)}`);
    }

    const userList = document.getElementById("rtUserList");
    const count = document.getElementById("rtOnlineCount");
    const users = dashboard.recentOnlineUsers || [];
    if (userList) {
      userList.innerHTML = users.map(user => (
        `<div class="rt-user-pill"><div class="rt-user-dot" style="background:${user.role === "teacher" ? "#3b82f6" : user.role === "admin" ? "#f59e0b" : "#10b981"}"></div>` +
        `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(user.name)}</span>` +
        `<span style="font-size:9px;background:#eef2ff;color:#4338ca;border-radius:4px;padding:1px 5px;font-weight:700;flex-shrink:0;">${user.role.toUpperCase()}</span>` +
        `<span style="font-size:10px;color:#94a3b8;flex-shrink:0;white-space:nowrap;">${escapeHtml(pageLabel(user.currentPage))}</span></div>`
      )).join("");
    }
    if (count) count.textContent = `${users.length} dang online`;
  }

  function alertItem(icon, title, detail, level) {
    const palette = {
      danger: { bg: "#fee2e2", icon: "#dc2626", title: "#dc2626", text: "#7f1d1d" },
      warning: { bg: "#fef3c7", icon: "#d97706", title: "#d97706", text: "#78350f" },
      info: { bg: "#e0f2fe", icon: "#0369a1", title: "#0369a1", text: "#075985" },
      success: { bg: "#d1fae5", icon: "#059669", title: "#059669", text: "#065f46" }
    }[level || "warning"];

    return `<div style="padding:10px 16px;display:flex;align-items:flex-start;gap:10px;border-right:1px solid rgba(245,158,11,0.15);">` +
      `<div style="width:36px;height:36px;border-radius:10px;background:${palette.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">` +
      `<i class="mdi ${icon}" style="color:${palette.icon};font-size:18px;"></i></div>` +
      `<div><div style="font-weight:700;font-size:12px;color:${palette.title};">${escapeHtml(title)}</div>` +
      `<div style="font-size:12px;color:${palette.text};">${escapeHtml(detail)}</div></div></div>`;
  }

  function renderSystemAlerts(dashboard) {
    const card = document.getElementById("systemAlertsCard");
    if (!card) return;

    const alerts = dashboard.systemAlerts || {};
    const items = [];
    if (Number(alerts.overdueGrading || 0) > 0) {
      items.push(alertItem("mdi-file-clock", "Bai cham qua han", `${alerts.overdueGrading} bai nop cho cham hon 48 gio`, "danger"));
    } else if (Number(alerts.pendingGrading || 0) > 0) {
      items.push(alertItem("mdi-file-clock", "Bai cho cham", `${alerts.pendingGrading} bai dang cho giao vien cham`, "warning"));
    }
    if (Number(alerts.riskStudents || 0) > 0) {
      items.push(alertItem("mdi-account-alert", "Hoc vien can chu y", `${alerts.riskStudents} hoc vien co tien do/diem/chuyen can thap`, "danger"));
    }
    if (Number(alerts.inactiveStudents || 0) > 0) {
      items.push(alertItem("mdi-account-off", "Hoc vien it hoat dong", `${alerts.inactiveStudents} hoc vien chua online trong 7 ngay`, "warning"));
    }
    if (Number(alerts.overdueFees || 0) > 0) {
      items.push(alertItem("mdi-cash-alert", "Hoc phi qua han", `${alerts.overdueFees} khoan qua han - ${money(alerts.overdueFeeAmount)}`, "danger"));
    }
    if (Number(alerts.pendingMaterials || 0) > 0) {
      items.push(alertItem("mdi-file-document-edit", "Tai lieu cho duyet", `${alerts.pendingMaterials} yeu cau tai lieu/de thi dang cho xu ly`, "warning"));
    }
    if (Number(alerts.coursesWithoutTeacher || 0) > 0) {
      items.push(alertItem("mdi-account-tie", "Khoa hoc thieu giao vien", `${alerts.coursesWithoutTeacher} khoa dang mo chua phan cong giao vien`, "warning"));
    }
    if (Number(alerts.studentsWithoutEnrollment || 0) > 0) {
      items.push(alertItem("mdi-account-school-outline", "Hoc vien chua co khoa", `${alerts.studentsWithoutEnrollment} hoc vien chua duoc gan khoa hoc`, "info"));
    }

    const hasAlerts = items.length > 0;
    const shellStyle = hasAlerts
      ? "background:linear-gradient(135deg,#fff3cd 0%,#fff8e1 100%);border-left:5px solid #f59e0b;padding:0;"
      : "background:linear-gradient(135deg,#ecfdf5 0%,#f0fdf4 100%);border-left:5px solid #10b981;padding:0;";
    const titleColor = hasAlerts ? "#92400e" : "#065f46";
    const titleIcon = hasAlerts ? "mdi-alert-circle" : "mdi-check-circle";
    const titleText = hasAlerts ? `CANH BAO HE THONG - ${items.length} muc can xu ly` : "HE THONG ON DINH";
    const body = hasAlerts
      ? items.join("")
      : alertItem("mdi-check-circle-outline", "Khong co canh bao", "Moi hoat dong dang trong trang thai on dinh.", "success");

    card.innerHTML = `<div style="${shellStyle}">` +
      `<div style="padding:10px 16px 8px;border-bottom:1px solid rgba(16,185,129,0.18);display:flex;align-items:center;justify-content:space-between;gap:12px;">` +
      `<span style="font-weight:700;font-size:13px;color:${titleColor};letter-spacing:.3px;"><i class="mdi ${titleIcon}" style="color:${hasAlerts ? "#f59e0b" : "#10b981"};margin-right:6px;font-size:16px;vertical-align:middle;"></i>${titleText}</span>` +
      `<span style="font-size:11px;color:#64748b;font-weight:600;">Cap nhat luc ${new Date().toLocaleTimeString("vi-VN")}</span>` +
      `</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0;">${body}</div></div>`;
  }

  function applyOnlineRealtime(payload) {
    if (!payload || payload.type !== "online") return;
    const online = payload.online || {};
    text(document.getElementById("rtTotal"), online.total);
    text(document.getElementById("rtStudents"), online.students);
    text(document.getElementById("rtTeachers"), online.teachers);
    text(document.getElementById("rtLearning"), online.learning);
    text(document.getElementById("rtLastUpdate"), `WebSocket ${new Date().toLocaleTimeString("vi-VN")}`);

    const users = payload.users || [];
    const userList = document.getElementById("rtUserList");
    const count = document.getElementById("rtOnlineCount");
    if (userList) {
      userList.innerHTML = users.map(user => (
        `<div class="rt-user-pill"><div class="rt-user-dot" style="background:${user.role === "teacher" ? "#3b82f6" : user.role === "admin" ? "#f59e0b" : "#10b981"}"></div>` +
        `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(user.name)}</span>` +
        `<span style="font-size:9px;background:#eef2ff;color:#4338ca;border-radius:4px;padding:1px 5px;font-weight:700;flex-shrink:0;">${String(user.role || "").toUpperCase()}</span>` +
        `<span style="font-size:10px;color:#64748b;flex-shrink:0;white-space:nowrap;">${escapeHtml(pageLabel(user.currentPage))}</span></div>`
      )).join("");
    }
    if (count) count.textContent = `${users.length} dang online`;
  }

  function mapEnrollmentToAdminStudent(item) {
    const progress = Math.round(Number(item.progress || 0));
    return {
      ten: item.studentName || item.studentEmail || "Hoc vien",
      lop: item.studentClass || "Chua cap nhat",
      email: item.studentEmail || "",
      sdt: item.studentPhone || "-",
      khoa: item.courseName || "Chua co khoa",
      gv: item.teacherName || "Chua phan cong",
      pr: progress,
      streak: Math.max(0, Math.round(Number(item.completedLessons || 0) / 2)),
      tt: statusFromEnrollment(item),
      seg: segmentFromEnrollment(item)
    };
  }

  async function refreshAdminStudentTable() {
    if (!window.FULL_HV_DATA) return;
    const now = Date.now();
    if (window.__ecLastAdminStudentRefresh && now - window.__ecLastAdminStudentRefresh < 15000) return;
    window.__ecLastAdminStudentRefresh = now;
    const data = await apiGet("/api/enrollments?limit=1000");
    const rows = data && data.enrollments ? data.enrollments : [];
    if (!rows.length) return;

    window.FULL_HV_DATA = rows.map(mapEnrollmentToAdminStudent);
    if (typeof window.renderFullHVTable === "function") window.renderFullHVTable();
    if (typeof window.unifiedRender === "function") window.unifiedRender();
    if (typeof window.renderTDTable === "function") window.renderTDTable();
  }

  function renderReportAndCourseCharts(dashboard, sectionId) {
    const revenue = trailingMonths(dashboard.revenueByMonth || [], 12);
    const newStudents = trailingWeeks(dashboard.newStudentTrend || [], 12);
    const fee = feeStatusRows(dashboard.feeStatus || []);
    const distribution = dashboard.courseDistribution || [];
    const statuses = dashboard.studentStatusByCourse || [];

    if (!sectionId || sectionId === "sec-baocao" || document.getElementById("bcRevenueChart")) {
      mountChart("bcRevenueChart", {
        type: "bar",
        data: {
          labels: revenue.map(monthLabel),
          datasets: [{
            label: "Doanh thu",
            data: revenue.map(row => Math.round((row.revenue || 0) / 1000000 * 10) / 10),
            backgroundColor: "rgba(99,102,241,0.72)",
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: chartBase({
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} tr VND` } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { callback: v => `${v}tr`, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.18)" } }
          }
        }),
        plugins: [emptyPlugin("Chua co doanh thu da thu")]
      });

      mountChart("bcNewHVChart", {
        type: "line",
        data: {
          labels: newStudents.map(weekLabel),
          datasets: [{ label: "Hoc vien moi", data: newStudents.map(row => row.count), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.12)", fill: true, tension: 0.35 }]
        },
        options: chartBase({ plugins: { legend: { display: false } } }),
        plugins: [emptyPlugin("Chua co hoc vien moi")]
      });

      const completionLabels = statuses.map(row => row.name);
      const completionData = statuses.map(row => {
        const total = Number(row.learning || 0) + Number(row.slow || 0) + Number(row.risk || 0) + Number(row.completed || 0);
        return total ? Math.round(Number(row.completed || 0) / total * 100) : 0;
      });
      mountChart("bcCompletionChart", {
        type: "bar",
        data: { labels: completionLabels, datasets: [{ label: "Hoan thanh (%)", data: completionData, backgroundColor: "rgba(16,185,129,0.78)", borderRadius: 6 }] },
        options: chartBase({
          indexAxis: "y",
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 100, ticks: { callback: v => `${v}%`, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.18)" } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } }
          }
        }),
        plugins: [emptyPlugin("Chua co trang thai hoc vien")]
      });

      mountChart("bcFeeStatusChart", {
        type: "doughnut",
        data: {
          labels: fee.map(item => statusLabel(item.status)),
          datasets: [{ data: fee.map(item => item.amount), backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"], borderWidth: 0 }]
        },
        options: chartBase({ cutout: "68%", plugins: { legend: { display: false } } }),
        plugins: [emptyPlugin("Chua co hoc phi")]
      });
      const bcFeeLegend = document.getElementById("bcFeeStatusLegend");
      if (bcFeeLegend) {
        const total = fee.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
        bcFeeLegend.innerHTML = fee.map((item, index) => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;"><span style="display:flex;align-items:center;gap:5px;color:#475569"><i style="width:9px;height:9px;border-radius:2px;background:${["#10b981", "#f59e0b", "#ef4444", "#94a3b8"][index]};display:inline-block"></i>${statusLabel(item.status)}</span><strong>${money(item.amount)} <span style="color:#94a3b8;font-weight:400">(${Math.round(Number(item.amount || 0) / total * 100)}%)</span></strong></div>`).join("");
      }
    }

    if (!sectionId || sectionId === "sec-khstats" || document.getElementById("khCompletionChart")) {
      const labels = distribution.map(row => row.name);
      const completion = statuses.map(row => {
        const total = Number(row.learning || 0) + Number(row.slow || 0) + Number(row.risk || 0) + Number(row.completed || 0);
        return total ? Math.round(Number(row.completed || 0) / total * 100) : 0;
      });
      mountChart("khCompletionChart", {
        type: "bar",
        data: { labels, datasets: [{ label: "Hoan thanh (%)", data: completion, backgroundColor: "rgba(99,102,241,0.78)", borderRadius: 7 }] },
        options: chartBase({ plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { min: 0, max: 100, ticks: { callback: v => `${v}%`, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.18)" } } } }),
        plugins: [emptyPlugin("Chua co ty le hoan thanh")]
      });

      mountChart("khDistChart", {
        type: "doughnut",
        data: { labels, datasets: [{ data: distribution.map(row => row.students), backgroundColor: ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444"], borderWidth: 0 }] },
        options: chartBase({ cutout: "65%", plugins: { legend: { display: false } } }),
        plugins: [emptyPlugin("Chua co hoc vien theo khoa")]
      });
      const khLegend = document.getElementById("khDistLegend");
      if (khLegend) {
        const total = distribution.reduce((sum, item) => sum + Number(item.students || 0), 0) || 1;
        khLegend.innerHTML = distribution.map((item, index) => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;"><span style="display:flex;align-items:center;gap:5px;color:#475569"><i style="width:8px;height:8px;border-radius:2px;background:${["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#a855f7", "#ef4444"][index % 6]};display:inline-block"></i>${escapeHtml(item.name)}</span><strong>${item.students} <span style="color:#94a3b8;font-weight:400">(${Math.round(Number(item.students || 0) / total * 100)}%)</span></strong></div>`).join("");
      }

      mountChart("khGrowthChart", {
        type: "bar",
        data: {
          labels: newStudents.map(weekLabel),
          datasets: [{ label: "Dang ky moi", data: newStudents.map(row => row.count), backgroundColor: "rgba(99,102,241,0.72)", borderRadius: 6 }]
        },
        options: chartBase(),
        plugins: [emptyPlugin("Chua co dang ky moi")]
      });
    }
  }

  function installAdminNavHook() {
    if (window.__ecAdminNavHooked) return;
    window.__ecAdminNavHooked = true;
    const previous = window.spaNav;
    if (typeof previous !== "function") return;
    window.spaNav = function(tabKey, sectionId) {
      const result = previous.apply(this, arguments);
      setTimeout(function() {
        if (window.__ecAdminDashboard) renderReportAndCourseCharts(window.__ecAdminDashboard, sectionId || tabKey);
      }, 250);
      return result;
    };
  }

  function applyAdminDashboard(dashboard) {
    window.__ecAdminDashboard = dashboard;
    installAdminNavHook();

    const stats = dashboard.overview || {};
    const cards = document.querySelectorAll(".ec-kpi-card h3");
    text(cards[0], stats.totalStudents);
    text(cards[1], stats.totalTeachers);
    text(cards[2], stats.activeCourses);
    text(cards[3], stats.pendingGrading);
    text(cards[4], money(stats.monthRevenue));
    text(cards[5], `${Number(stats.averageCompletion || 0).toFixed(1)}%`);
    const subtitles = document.querySelectorAll("#overview .ec-kpi-card .card-body span");
    text(subtitles[0], "Hoc vien dang theo hoc");
    text(subtitles[1], "Giao vien dang hoat dong");
    text(subtitles[2], "Khoa hoc dang mo");
    text(subtitles[3], "Bai nop dang cho cham");
    text(subtitles[4], "Theo hoc phi da ghi nhan");
    text(subtitles[5], "Theo tien do hoc vien");

    const online = dashboard.online || {};
    text(document.getElementById("rtTotal"), online.total);
    text(document.getElementById("rtStudents"), online.students);
    text(document.getElementById("rtTeachers"), online.teachers);
    text(document.getElementById("rtLearning"), online.learning);
    text(document.getElementById("rtLastUpdate"), `Cap nhat luc ${new Date().toLocaleTimeString("vi-VN")}`);

    const revenueEl = document.getElementById("revenueByKhoa");
    if (revenueEl && dashboard.courseDistribution) {
      revenueEl.innerHTML = dashboard.courseDistribution.slice(0, 5).map(item => (
        `<div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:6px 0;border-bottom:1px solid #eef2f7">` +
        `<span style="font-weight:600;color:#334155">${item.name}</span>` +
        `<span style="font-weight:800;color:#6366f1">${item.students} HV</span>` +
        `</div>`
      )).join("");
    }

    renderAdminCharts(dashboard);
    renderAdminLists(dashboard);
    renderSystemAlerts(dashboard);
    renderReportAndCourseCharts(dashboard);
    refreshAdminStudentTable().catch(error => console.warn("[English Center] Khong tai duoc danh sach hoc vien:", error.message));
  }

  async function refreshAdminDashboard(showToast) {
    const dashboard = await getDashboard("admin");
    if (dashboard) {
      applyAdminDashboard(dashboard);
      if (showToast && window.adminToast) window.adminToast("Du lieu da duoc cap nhat.", "success");
    } else if (showToast && window.adminToast) {
      window.adminToast("Chua the cap nhat bang dieu khien. Vui long thu lai.", "danger");
    }
    return dashboard;
  }

  function renderStudentCourses(courses) {
    const wrap = document.getElementById("courseListWrap");
    if (!wrap || !courses || !courses.length) return;
    wrap.innerHTML = courses.map(course => (
      `<div style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center">` +
      `<div style="width:42px;height:42px;border-radius:11px;background:var(--blue-light);display:flex;align-items:center;justify-content:center;color:var(--blue);font-weight:900">${Math.round(course.progress)}%</div>` +
      `<div style="flex:1;min-width:0">` +
      `<div style="font-size:13.5px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${course.name}</div>` +
      `<div style="font-size:12px;color:var(--text-muted)">GV: ${course.teacherName || "Dang cap nhat"} · ${course.completedLessons}/${course.totalLessons} bai</div>` +
      `<div style="height:5px;background:var(--border);border-radius:99px;margin-top:8px;overflow:hidden"><div style="height:100%;width:${Math.min(100, course.progress)}%;background:var(--blue)"></div></div>` +
      `</div>` +
      `</div>`
    )).join("");
  }

  function renderStudentExams(results) {
    const wrap = document.getElementById("recentExamWrap");
    if (!wrap || !results || !results.length) return;
    wrap.innerHTML = results.slice(0, 5).map(item => (
      `<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">` +
      `<div style="min-width:0"><div style="font-size:13px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.title}</div>` +
      `<div style="font-size:11.5px;color:var(--text-muted)">${item.courseName || ""}</div></div>` +
      `<div style="font-size:18px;font-weight:900;color:var(--orange);font-family:'JetBrains Mono',monospace">${item.score == null ? "Cho cham" : item.score}</div>` +
      `</div>`
    )).join("");
  }

  function applyStudentDashboard(dashboard) {
    const stats = dashboard.stats || {};
    const values = document.querySelectorAll(".stat-grid .stat-value");
    text(values[0], stats.activeCourses);
    text(values[1], stats.completedLessons);
    text(values[2], Number(stats.averageExamScore || 0).toFixed(1));
    text(values[3], stats.totalXp);
    text(document.getElementById("statXp"), stats.totalXp);
    text(document.getElementById("statScore"), Number(stats.averageExamScore || 0).toFixed(1));
    text(document.getElementById("statLessons"), stats.completedLessons);
    text(document.getElementById("todayXp"), `+${stats.todayXp || 0} XP`);

    const slot = document.getElementById("courseSlotLabel");
    if (slot) slot.textContent = `${(dashboard.courses || []).filter(c => c.status === "active").length} / 2 khoa`;

    renderStudentCourses(dashboard.courses || []);
    renderStudentExams(dashboard.recentExamResults || []);

    const lb = document.getElementById("lbList");
    if (lb && dashboard.leaderboard) {
      lb.innerHTML = dashboard.leaderboard.slice(0, 5).map(item => (
        `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px">` +
        `<span style="font-weight:800">#${item.rank} ${item.name}</span><span style="color:var(--blue);font-weight:900">${item.xp} XP</span>` +
        `</div>`
      )).join("");
    }

    const act = document.getElementById("actLog");
    if (act && dashboard.activities) {
      act.innerHTML = dashboard.activities.slice(0, 5).map(item => (
        `<div style="font-size:12.5px;color:var(--text);display:flex;justify-content:space-between;gap:8px">` +
        `<span>${item.title}</span><strong style="color:var(--green)">+${item.xp} XP</strong>` +
        `</div>`
      )).join("");
    }
  }

  function applyTeacherDashboard(dashboard) {
    const stats = dashboard.stats || {};
    const values = document.querySelectorAll(".sg .sv");
    text(values[0], stats.totalStudents);
    text(values[1], stats.activeCourses);
    text(values[2], stats.pendingGrading);
    text(values[3], `${Number(stats.averageRating || 0).toFixed(1)} sao`);

    const today = document.getElementById("todaySessionWidget");
    if (today && dashboard.todaySessions) {
      today.innerHTML = dashboard.todaySessions.length ? dashboard.todaySessions.map(item => (
        `<div class="tr2"><div style="flex:1"><div style="font-size:13.5px;font-weight:700">${item.courseName}</div>` +
        `<div style="font-size:12px;color:var(--ink3)">${item.title} · ${dateTime(item.startAt)}</div></div>` +
        `<span style="font-size:12px;font-weight:700;color:var(--purple)">${item.expectedStudents} HS</span></div>`
      )).join("") : `<div style="font-size:13px;color:var(--ink3)">Hom nay chua co lich day.</div>`;
    }

    const students = (dashboard.students || []).map((item, index) => {
      const status = studentStatus(item.progress, item.averageScore, item.absences);
      const gradients = [
        "135deg,#7c3aed,#a78bfa",
        "135deg,#2563eb,#60a5fa",
        "135deg,#059669,#34d399",
        "135deg,#d97706,#fbbf24",
        "135deg,#ef4444,#f87171",
        "135deg,#0891b2,#22d3ee"
      ];
      return {
        n: item.name || item.email || "Hoc sinh",
        i: initials(item.name || item.email),
        g: gradients[index % gradients.length],
        l: item.courseName || "Chua co lop",
        pr: Math.round(Number(item.progress || 0)),
        sc: Number(item.averageScore || 0),
        ab: Number(item.absences || 0),
        nop: Number(item.submissions || 0),
        st: status.label,
        sb: status.bg,
        st2: status.color,
        phone: item.phone || item.email || "-",
        note: status.label === "Can ho tro" ? "Can theo doi tien do va diem so" : ""
      };
    });

    if (students.length && window.STUDENTS) {
      window.STUDENTS = students;
      if (window.selectedStudents instanceof Set) window.selectedStudents = new Set();
      updateSelectOptions("fcl", Array.from(new Set(students.map(s => s.l))).sort(), "Tat ca lop");
      updateSelectOptions("fst", ["Xuat sac", "Hoc tot", "Trung binh", "Can ho tro", "Vang hoc"], "Tat ca trang thai");
      if (typeof window.renderSt === "function") window.renderSt();
    }
  }

  ready(async function() {
    const path = window.location.pathname.toLowerCase();
    try {
      if (path.includes("admin")) {
        await refreshAdminDashboard(false);
        setInterval(async function() {
          await refreshAdminDashboard(false);
        }, 5000);
      } else if (path.includes("dashboard_giaovien")) {
        const dashboard = await getDashboard("teacher");
        if (dashboard) applyTeacherDashboard(dashboard);
      } else if (path.includes("dashboard_hocsinh")) {
        const dashboard = await getDashboard("student");
        if (dashboard) applyStudentDashboard(dashboard);
      }
    } catch (error) {
      console.warn("[English Center] Khong tai duoc du lieu bang dieu khien:", error.message);
    }
  });

  window.addEventListener("ec:online", event => applyOnlineRealtime(event.detail));

  window.EC_DASHBOARD = Object.assign(window.EC_DASHBOARD || {}, {
    refreshAdminDashboard
  });
})();
