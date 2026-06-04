(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, request, notify, escapeHtml, number, money, dateLabel, badge, progressBar } = core;

  function renderMaterials() {
    const section = document.getElementById("sec-tailieu");
    if (!section) return;
    const kpis = section.querySelectorAll(".ec-kpi-card h4");
    if (kpis.length >= 4) {
      kpis[0].textContent = state.materialRequests.length;
      kpis[1].textContent = state.materialRequests.filter(item => item.status === "approved").length;
      kpis[2].textContent = state.materialRequests.filter(item => ["pending", "submitted"].includes(item.status)).length;
      kpis[3].textContent = state.courses.length;
    }
    const firstTableBody = section.querySelector("table tbody");
    if (!firstTableBody) return;
    const rows = state.materialRequests;
    firstTableBody.innerHTML = rows.length ? rows.map(row => {
      const statusText = row.status === "approved" ? "Da duyet" : row.status === "rejected" ? "Tu choi" : row.status === "submitted" ? "Cho duyet" : "Ban nhap";
      const statusKind = row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning";
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:32px;height:32px;border-radius:8px;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="mdi mdi-file-document-outline" style="color:#3b82f6;font-size:16px;"></i></div>
            <div><div style="font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(row.title)}</div><div style="font-size:10px;color:#94a3b8;">${dateLabel(row.submittedAt || row.createdAt, true)} - ${escapeHtml(row.teacherName || "")}</div>${row.videoUrl ? `<a href="${escapeHtml(row.videoUrl)}" target="_blank" rel="noopener" style="font-size:10.5px;font-weight:700;color:#2563eb;">Video</a>` : ""}${row.documentUrl ? ` <a href="${escapeHtml(row.documentUrl)}" target="_blank" rel="noopener" style="font-size:10.5px;font-weight:700;color:#059669;">Tai lieu</a>` : ""}</div>
          </div>
        </td>
        <td>${badge(row.courseName || "Chua gan khoa", "info")}</td>
        <td><span style="font-size:11px;color:#64748b;">${escapeHtml(row.type)}</span></td>
        <td style="font-size:11px;color:#94a3b8;">He thong</td>
        <td>${badge(statusText, statusKind)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-xs btn-outline-success px-2 py-0 me-1" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','approved')" title="Duyet"><i class="mdi mdi-check"></i></button>
          <button class="btn btn-xs btn-outline-warning px-2 py-0 me-1" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','pending')" title="Tra ve"><i class="mdi mdi-reply"></i></button>
          <button class="btn btn-xs btn-outline-danger px-2 py-0" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','rejected')" title="Tu choi"><i class="mdi mdi-close"></i></button>
        </td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" class="text-center text-muted py-4">Chua co yeu cau tai lieu nao.</td></tr>`;
  }

  function renderReports() {
    const section = document.getElementById("sec-baocao");
    if (!section || !state.dashboard) return;
    renderReportKpis(section);
    renderReportCharts();
    const body = section.querySelector("table tbody");
    const rows = (state.dashboard.revenueByMonth || []).slice(-12);
    if (body && rows.length) {
      body.innerHTML = rows.map(row => {
        const monthEnrollments = state.enrollments.filter(item => {
          const date = new Date(item.enrolledAt);
          return !Number.isNaN(date.getTime()) && date.getFullYear() === row.year && date.getMonth() + 1 === row.month;
        });
        const paidCount = monthEnrollments.filter(item => item.paymentStatus === "paid").length;
        const rate = monthEnrollments.length ? Math.round(paidCount / monthEnrollments.length * 100) : 0;
        const avgCompletion = monthEnrollments.length ? Math.round(monthEnrollments.reduce((sum, item) => sum + number(item.progress), 0) / monthEnrollments.length) : 0;
        return `<tr>
          <td><b>T${row.month}/${row.year}</b></td>
          <td>${monthEnrollments.length}</td>
          <td class="text-success fw-semibold">${money(row.revenue)}</td>
          <td>${progressBar(rate)}</td>
          <td>${progressBar(avgCompletion)}</td>
          <td>${number((state.dashboard.teacherRatings || [])[0] && state.dashboard.teacherRatings[0].rating).toFixed(1)}</td>
          <td>${badge("Da cap nhat", "success")}</td>
        </tr>`;
      }).join("");
    }
  }

  function renderReportKpis(section) {
    const overview = state.dashboard.overview || {};
    const ratings = state.dashboard.teacherRatings || [];
    const values = [
      number(overview.totalStudents),
      money(overview.monthRevenue),
      `${number(overview.averageCompletion).toFixed(1)}%`,
      `${number(ratings[0] && ratings[0].rating).toFixed(1)}/5`
    ];
    const subtitles = [
      `${number(overview.newStudentsThisWeek)} hoc vien moi tuan nay`,
      "Hoc phi da thu trong thang",
      "Tien do trung binh",
      `${ratings.length} giao vien`
    ];
    section.querySelectorAll(".row.g-3.mb-3 .card-body").forEach((card, index) => {
      const value = card.querySelector("h3");
      const sub = card.querySelector("span");
      if (value && values[index] != null) value.textContent = values[index];
      if (sub && subtitles[index]) sub.textContent = subtitles[index];
    });
  }

  function mountChart(id, config) {
    if (!window.Chart) return;
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (window._ecDestroyChart) window._ecDestroyChart(id);
    const chart = new Chart(canvas, config);
    if (window._ecRegChart) window._ecRegChart(id, chart);
  }

  function renderReportCharts() {
    const revenue = (state.dashboard.revenueByMonth || []).slice(-12);
    const newStudents = (state.dashboard.newStudentTrend || []).slice(-12);
    const fee = state.dashboard.feeStatus || [];
    const statuses = state.dashboard.studentStatusByCourse || [];
    mountChart("bcRevenueChart", {
      type: "bar",
      data: {
        labels: revenue.map(row => `T${row.month}/${String(row.year).slice(-2)}`),
        datasets: [{ label: "Doanh thu", data: revenue.map(row => Math.round(number(row.revenue) / 1000000 * 10) / 10), backgroundColor: "rgba(99,102,241,.75)", borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: value => `${value}tr` } } } }
    });
    mountChart("bcNewHVChart", {
      type: "line",
      data: {
        labels: newStudents.map(row => {
          const date = row.weekStart ? new Date(row.weekStart) : null;
          return date && !Number.isNaN(date.getTime()) ? `${date.getDate()}/${date.getMonth() + 1}` : "";
        }),
        datasets: [{ label: "Hoc vien moi", data: newStudents.map(row => number(row.count)), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,.12)", fill: true, tension: .35 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    mountChart("bcCompletionChart", {
      type: "bar",
      data: {
        labels: statuses.map(row => row.name),
        datasets: [{ label: "Hoan thanh", data: statuses.map(row => {
          const total = number(row.learning) + number(row.slow) + number(row.risk) + number(row.completed);
          return total ? Math.round(number(row.completed) / total * 100) : 0;
        }), backgroundColor: "rgba(16,185,129,.78)", borderRadius: 6 }]
      },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100, ticks: { callback: value => `${value}%` } }, y: { grid: { display: false } } } }
    });
    mountChart("bcFeeStatusChart", {
      type: "doughnut",
      data: {
        labels: fee.map(row => row.status === "paid" ? "Da thu" : row.status === "overdue" ? "Qua han" : row.status === "refunded" ? "Hoan tien" : "Cho thu"),
        datasets: [{ data: fee.map(row => number(row.amount)), backgroundColor: ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"], borderWidth: 0 }]
      },
      options: { cutout: "68%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    const legend = document.getElementById("bcFeeStatusLegend");
    if (legend) {
      legend.innerHTML = fee.map((row, index) => {
        const label = row.status === "paid" ? "Da thu" : row.status === "overdue" ? "Qua han" : row.status === "refunded" ? "Hoan tien" : "Cho thu";
        const color = ["#10b981", "#f59e0b", "#ef4444", "#94a3b8"][index] || "#94a3b8";
        return `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;"><span style="display:flex;gap:5px;align-items:center;"><i style="width:9px;height:9px;border-radius:2px;background:${color};display:inline-block"></i>${label}</span><b>${money(row.amount)}</b></div>`;
      }).join("");
    }
  }

  async function updateMaterial(id, status) {
    const adminNote = status === "pending" ? "Can chinh sua theo gop y cua admin." : "";
    try {
      await request(`/api/material-requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote })
      });
      notify("Da cap nhat trang thai tai lieu.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  Object.assign(window.EC_ADMIN_OPS, { updateMaterial });
  window.EC_ADMIN_RENDERERS.materials = renderMaterials;
  window.EC_ADMIN_RENDERERS.reports = renderReports;
})();
