(function() {
  "use strict";

  const core = window.EC_ADMIN_CORE;
  if (!core) return;
  const { state, request, notify, escapeHtml, number, money, dateLabel, badge, progressBar, courseById } = core;

  function renderFinance() {
    const select = document.getElementById("filterTT");
    if (select) {
      const current = select.value;
      select.innerHTML = `<option value="">Tat ca</option>
        <option value="paid">Da thanh toan</option>
        <option value="pending">Cho thanh toan</option>
        <option value="overdue">Qua han</option>
        <option value="refunded">Hoan tien</option>`;
      if ([...select.options].some(option => option.value === current)) select.value = current;
    }

    const filter = select ? select.value : "";
    const rows = state.enrollments.filter(row => !filter || row.paymentStatus === filter);
    const body = document.getElementById("tcBody");
    if (body) {
      body.innerHTML = rows.length ? rows.map(row => {
        const statusText = row.paymentStatus === "paid" ? "Da thanh toan" : row.paymentStatus === "overdue" ? "Qua han" : row.paymentStatus === "refunded" ? "Hoan tien" : "Cho thanh toan";
        const statusKind = row.paymentStatus === "paid" ? "success" : row.paymentStatus === "overdue" ? "danger" : row.paymentStatus === "refunded" ? "info" : "warning";
        return `<tr>
          <td><strong>${escapeHtml(row.studentName)}</strong><div style="font-size:10px;color:#94a3b8;">${escapeHtml(row.studentEmail || "")}</div></td>
          <td>${escapeHtml(row.courseName)}</td>
          <td><strong>${money(row.paidAmount)}</strong></td>
          <td>${dateLabel(row.enrolledAt, false)}</td>
          <td>He thong</td>
          <td>${badge(statusText, statusKind)}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-xs btn-outline-success py-0 px-2 me-1" title="Danh dau da thu" onclick="EC_ADMIN_OPS.markPayment('${row.id}','paid')"><i class="mdi mdi-cash-check"></i></button>
            <button class="btn btn-xs btn-outline-warning py-0 px-2 me-1" title="Nhac hoc phi" onclick="EC_ADMIN_OPS.remindFee('${row.id}')"><i class="mdi mdi-bell-ring-outline"></i></button>
            <button class="btn btn-xs btn-outline-danger py-0 px-2" title="Qua han" onclick="EC_ADMIN_OPS.markPayment('${row.id}','overdue')"><i class="mdi mdi-alert-circle-outline"></i></button>
          </td>
        </tr>`;
      }).join("") : `<tr><td colspan="7" class="text-center text-muted py-4">Khong co ban ghi hoc phi phu hop.</td></tr>`;
    }

    const paid = state.enrollments.filter(item => item.paymentStatus === "paid").reduce((sum, item) => sum + number(item.paidAmount), 0);
    const pending = state.enrollments.filter(item => item.paymentStatus === "pending").reduce((sum, item) => sum + number(item.paidAmount), 0);
    const overdue = state.enrollments.filter(item => item.paymentStatus === "overdue").reduce((sum, item) => sum + number(item.paidAmount), 0);
    renderFinanceKpis(paid, pending, overdue);
    const summary = document.getElementById("tcSummary");
    if (summary) summary.innerHTML = `<b>Tong thu:</b> ${money(paid)} - <b>Cho thu:</b> ${money(pending)} - <b>Qua han:</b> ${money(overdue)}`;
    renderRevenueByCourse();
    renderFinanceCharts(paid, pending, overdue);
  }

  function renderFinanceKpis(paid, pending, overdue) {
    const cards = document.querySelectorAll("#sec-taichinh > .row.g-3.mb-4 .card-body");
    const totalRows = state.enrollments.length;
    const paidRows = state.enrollments.filter(item => item.paymentStatus === "paid").length;
    const paidRate = totalRows ? Math.round(paidRows / totalRows * 100) : 0;
    const teacherCount = state.teachers.length;
    const activeTeacherCount = new Set(state.courses.filter(item => item.teacherId && item.status === "active").map(item => item.teacherId)).size;
    const values = [
      money(paid),
      money(paid + pending + overdue),
      `${paidRows} / ${totalRows}`,
      `${activeTeacherCount} / ${teacherCount}`
    ];
    const subtitles = [
      "Hoc phi da thu",
      "Tong hoc phi ghi nhan",
      `Ty le thanh toan ${paidRate}%`,
      "Giao vien co lop dang mo"
    ];
    cards.forEach((card, index) => {
      const value = card.querySelector("h3");
      const sub = card.querySelector("p:last-child");
      if (value && values[index] != null) value.textContent = values[index];
      if (sub && subtitles[index]) sub.textContent = subtitles[index];
      const progress = card.querySelector(".progress-bar");
      if (progress && index === 2) progress.style.width = `${paidRate}%`;
    });
    const title = document.querySelector("#sec-taichinh .d-flex.align-items-center.justify-content-between.mb-4 p");
    if (title) title.textContent = `Bao cao tai chinh - cap nhat luc ${new Date().toLocaleTimeString("vi-VN")}`;
  }

  function renderRevenueByCourse() {
    const container = document.getElementById("revenueByKhoa");
    if (!container) return;
    const rows = (state.dashboard && state.dashboard.courseRevenue || []).slice(0, 8);
    const total = rows.reduce((sum, row) => sum + number(row.revenue), 0) || 1;
    container.innerHTML = rows.length ? rows.map(row => {
      const pct = Math.round(number(row.revenue) / total * 100);
      return `<div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;color:#334155;">${escapeHtml(row.name)}</span>
          <span style="font-size:12px;font-weight:700;color:#6366f1;">${money(row.revenue)}</span>
        </div>
        <div class="progress" style="height:7px;"><div class="progress-bar" style="width:${pct}%;"></div></div>
      </div>`;
    }).join("") : `<div class="text-muted small">Chua co doanh thu de hien thi.</div>`;
  }

  function renderFinanceCharts(paid, pending, overdue) {
    if (!window.Chart) return;
    renderRevenueTrendChart();
    const chartData = [paid, pending, overdue].map(value => Math.round(value / 1000000 * 10) / 10);
    const feeCanvas = document.getElementById("tcFeeStatusChart");
    if (feeCanvas) {
      if (window._ecDestroyChart) window._ecDestroyChart("tcFeeStatusChart");
      const chart = new Chart(feeCanvas, {
        type: "doughnut",
        data: {
          labels: ["Da thu", "Cho thu", "Qua han"],
          datasets: [{ data: chartData, backgroundColor: ["#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }]
        },
        options: { cutout: "68%", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      if (window._ecRegChart) window._ecRegChart("tcFeeStatusChart", chart);
    }
    const legend = document.getElementById("tcFeeStatusLegend");
    if (legend) {
      const labels = ["Da thu", "Cho thu", "Qua han"];
      const colors = ["#10b981", "#f59e0b", "#ef4444"];
      legend.innerHTML = labels.map((label, index) => `<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;">
        <div style="display:flex;align-items:center;gap:5px;"><div style="width:9px;height:9px;border-radius:2px;background:${colors[index]};"></div><span>${label}</span></div>
        <b>${chartData[index]}tr</b>
      </div>`).join("");
    }
  }

  function renderRevenueTrendChart() {
    const canvas = document.getElementById("tcRevenueTrendChart");
    if (!canvas) return;
    const rows = (state.dashboard && state.dashboard.revenueByMonth || []).slice(-12);
    const labels = rows.map(row => `T${row.month}/${String(row.year).slice(-2)}`);
    const data = rows.map(row => Math.round(number(row.revenue) / 1000000 * 10) / 10);
    if (window._ecDestroyChart) window._ecDestroyChart("tcRevenueTrendChart");
    const chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Doanh thu",
          data,
          backgroundColor: "rgba(99,102,241,0.72)",
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} tr VND` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { beginAtZero: true, ticks: { callback: value => `${value}tr`, font: { size: 10 } }, grid: { color: "rgba(148,163,184,0.18)" } }
        }
      }
    });
    if (window._ecRegChart) window._ecRegChart("tcRevenueTrendChart", chart);
  }

  async function updateEnrollmentPayment(id, paymentStatus) {
    const row = state.enrollments.find(item => item.id === id);
    if (!row) return notify("Khong tim thay ghi danh.", "warning");
    const course = courseById(row.courseId);
    const payload = { paymentStatus };
    if (paymentStatus === "paid") payload.paidAmount = number(row.paidAmount) || number(course && course.price);
    try {
      await request(`/api/enrollments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      notify("Da cap nhat hoc phi.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  async function remindFee(id) {
    const row = state.enrollments.find(item => item.id === id);
    if (!row) return;
    try {
      await request("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          userId: row.userId,
          title: "Nhac hoc phi",
          body: `Khoa ${row.courseName}: vui long hoan tat hoc phi ${money(row.paidAmount)}.`,
          type: "fee"
        })
      });
      notify("Da tao thong bao nhac hoc phi.", "success");
      await core.loadAll(true);
    } catch (error) {
      notify(error.message, "danger");
    }
  }

  window.filterTaichinh = renderFinance;
  Object.assign(window.EC_ADMIN_OPS, {
    markPayment: updateEnrollmentPayment,
    remindFee
  });
  window.EC_ADMIN_RENDERERS.finance = renderFinance;
})();
