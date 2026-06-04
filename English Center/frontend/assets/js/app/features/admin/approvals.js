(function() {
 "use strict";

 const core = window.EC_ADMIN_CORE;
 if (!core) return;
 const { state, request, notify, escapeHtml, number, dateLabel, badge } = core;

 let activeTab = "lich";

 function setText(id, value) {
 const el = document.getElementById(id);
 if (el) el.textContent = value;
 }

 function hideDebugButtons() {
 ["debugSendToGV", "debugClearGV"].forEach(name => {
 document.querySelectorAll(`button[onclick^="${name}"]`).forEach(button => {
 button.style.display = "none";
 });
 });
 }

 function statusKind(status) {
 if (status === "approved" || status === "done" || status === "active") return "success";
 if (status === "rejected" || status === "cancelled" || status === "archived") return "danger";
 return "warning";
 }

 function scheduleRows() {
 return state.sessions.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
 }

 function lessonRequests() {
 return state.materialRequests.filter(item =>
 (item.type === "lesson" || item.type === "exam") && ["pending", "submitted"].includes(item.status)
 );
 }

 function documentRequests() {
 return state.materialRequests.filter(item =>
 item.type === "document" && ["pending", "submitted"].includes(item.status)
 );
 }

 function draftCourses() {
 return state.courses.filter(item => item.status === "draft");
 }

 function pendingCount() {
 return scheduleRows().filter(item => item.status === "scheduled").length
 + state.materialRequests.filter(item => ["pending", "submitted"].includes(item.status)).length
 + draftCourses().length
 + state.questions.filter(item => item.status === "open").length;
 }

 function updateBadges() {
 const counts = {
 lich: scheduleRows().filter(item => item.status === "scheduled").length,
 baigiang: lessonRequests().length,
 hoidap: state.questions.filter(item => item.status === "open").length,
 khoahoc: draftCourses().length,
 tailieu: documentRequests().length
 };
 setText("dpc-num", pendingCount());
 Object.entries(counts).forEach(([key, value]) => {
 const badgeEl = document.getElementById(`badge-${key}`);
 if (badgeEl) badgeEl.textContent = value;
 });
 }

 function switchTab(type) {
 activeTab = type || "lich";
 ["lich", "baigiang", "hoidap", "khoahoc", "tailieu"].forEach(tab => {
 const panel = document.getElementById(`tab-${tab}`);
 const button = document.getElementById(`tab-btn-${tab}`);
 const badgeEl = document.getElementById(`badge-${tab}`);
 if (panel) panel.style.display = tab === activeTab ? "" : "none";
 if (button) {
 button.style.color = tab === activeTab ? "#6366f1" : "#64748b";
 button.style.borderBottom = tab === activeTab ? "3px solid #6366f1" : "3px solid transparent";
 }
 if (badgeEl) badgeEl.style.background = tab === activeTab ? "#6366f1" : "#94a3b8";
 });
 }

 function cardShell(color, inner) {
 return `<div class="col-12 col-md-6 col-xl-4 duyet-card">
 <div class="card card-rounded h-100" style="border:1.5px solid #e8ecf4!important;overflow:hidden;">
 <div style="height:5px;background:${color};"></div>
 <div class="card-body" style="padding:18px 20px!important;">${inner}</div>
 </div>
 </div>`;
 }

 function renderScheduleCards() {
 const container = document.getElementById("cards-lich");
 const empty = document.getElementById("empty-lich");
 if (!container) return;
 const rows = scheduleRows();
 if (empty) empty.style.display = rows.length ? "none" : "";
 container.innerHTML = rows.length ? rows.map(row => {
 const text = row.status === "done" ? "Da hoan thanh" : row.status === "cancelled" ? "Da huy" : "Da len lich";
 return cardShell("linear-gradient(90deg,#6366f1,#818cf8)", `
 <div class="d-flex align-items-center justify-content-between mb-2">
 ${badge(text, statusKind(row.status))}
 <span style="font-size:11px;color:#94a3b8;font-weight:700;">Buoi ${number(row.sessionNo)}</span>
 </div>
 <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(row.title)}</h5>
 <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
 <div><i class="mdi mdi-book-open-page-variant me-1"></i>${escapeHtml(row.courseName)}</div>
 <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(row.teacherName || "Chua phan cong")}</div>
 <div><i class="mdi mdi-calendar-clock me-1"></i>${dateLabel(row.startAt, true)} - ${dateLabel(row.endAt, true)}</div>
 <div><i class="mdi mdi-account-group me-1"></i>${number(row.expectedStudents)} hoc vien dang hoc</div>
 </div>
 <div class="d-flex gap-2">
 <button class="btn btn-sm btn-outline-success flex-fill" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','done')"><i class="mdi mdi-check me-1"></i>Hoan thanh</button>
 <button class="btn btn-sm btn-outline-warning flex-fill" onclick="EC_ADMIN_OPS.updateSessionStatus('${row.id}','cancelled')"><i class="mdi mdi-close me-1"></i>Huy</button>
 </div>`);
 }).join("") : "";
 }

 function renderMaterialCards(containerId, rows, emptyMessage) {
 const panel = document.getElementById(containerId);
 if (!panel) return;
 panel.innerHTML = rows.length ? `<div class="row g-3">${rows.map(row => {
 const text = row.status === "approved" ? "Da duyet" : row.status === "rejected" ? "Tu choi" : "Cho xu ly";
 return cardShell("linear-gradient(90deg,#10b981,#34d399)", `
 <div class="d-flex align-items-center justify-content-between mb-2">
 ${badge(text, statusKind(row.status))}
 <span style="font-size:11px;color:#94a3b8;font-weight:700;">${escapeHtml(row.type)}</span>
 </div>
 <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(row.title)}</h5>
 <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
 <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(row.teacherName || "Giao vien")}</div>
 <div><i class="mdi mdi-book-open-page-variant me-1"></i>${escapeHtml(row.courseName || "Chua gan khoa")}</div>
 <div><i class="mdi mdi-clock-outline me-1"></i>${dateLabel(row.submittedAt || row.createdAt, true)}</div>
 ${row.videoUrl ? `<div><i class="mdi mdi-video-outline me-1"></i><a href="${escapeHtml(row.videoUrl)}" target="_blank" rel="noopener">Xem video</a></div>` : ""}
 ${row.documentUrl ? `<div><i class="mdi mdi-file-document-outline me-1"></i><a href="${escapeHtml(row.documentUrl)}" target="_blank" rel="noopener">Mo tai lieu</a></div>` : ""}
 </div>
 ${row.description ? `<div style="font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:12px;line-height:1.55">${escapeHtml(row.description).replace(/\n/g, "<br>")}</div>` : ""}
 <div class="d-flex gap-2 mb-2">
 <button class="btn btn-sm btn-outline-success flex-fill" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','approved')"><i class="mdi mdi-check me-1"></i>Duyệt</button>
 <button class="btn btn-sm btn-outline-danger flex-fill" onclick="EC_ADMIN_OPS.updateMaterial('${row.id}','rejected')"><i class="mdi mdi-close me-1"></i>Từ chối</button>
 </div>
 <button class="btn btn-sm w-100" style="background:#eef2ff;color:#4f46e5;font-weight:700;border:1.5px solid #c7d2fe;border-radius:8px;" onclick="EC_ADMIN_OPS.aiReviewMaterial('${row.id}')">
 🤖 AI phân tích nội dung
 </button>`);
 }).join("")}</div>` : `<div class="text-center text-muted py-5">${emptyMessage}</div>`;
 }

 function renderCourseApprovals() {
 const panel = document.getElementById("tab-khoahoc");
 if (!panel) return;
 const rows = draftCourses();
 panel.innerHTML = rows.length ? `<div class="row g-3">${rows.map(course => cardShell("linear-gradient(90deg,#3b82f6,#60a5fa)", `
 <div class="d-flex align-items-center justify-content-between mb-2">
 ${badge("Cho mo khoa", "warning")}
 <span style="font-size:11px;color:#94a3b8;font-weight:700;">${number(course.durationWeeks)} tuan</span>
 </div>
 <h5 style="font-size:15px;font-weight:800;color:#0f172a;margin:0 0 8px;">${escapeHtml(course.name)}</h5>
 <div style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:12px;">
 <div><i class="mdi mdi-account-tie me-1"></i>${escapeHtml(course.teacherName || "Chua phan cong")}</div>
 <div><i class="mdi mdi-cash me-1"></i>${core.money(course.price)}</div>
 <div><i class="mdi mdi-account-group me-1"></i>Toi da ${number(course.capacity)} hoc vien</div>
 </div>
 <button class="btn btn-sm btn-outline-success w-100" onclick="EC_ADMIN_OPS.publishCourse('${course.id}')"><i class="mdi mdi-check me-1"></i>Mo khoa hoc</button>`)).join("")}</div>` : `<div class="text-center text-muted py-5">Khong co khoa hoc cho xu ly.</div>`;
 }

 function renderQuestionApprovals() {
 const panel = document.getElementById("tab-hoidap");
 if (!panel) return;
 const body = document.getElementById("hdBody");
 const rows = state.questions.slice().sort((a, b) => {
 const rank = { open: 0, answered: 1 };
 return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
 });
 const html = rows.length ? rows.map(row => {
 const answered = row.status === "answered";
 return `<tr>
 <td style="white-space:nowrap;"><strong>${escapeHtml(row.studentName || "Hoc vien")}</strong></td>
 <td style="min-width:220px;"><span style="font-size:12px;">${escapeHtml(row.title || row.body || "")}</span>${row.body && row.title ? `<div class="text-muted" style="font-size:11px;">${escapeHtml(row.body)}</div>` : ""}${row.answer ? `<div style="font-size:11px;color:#047857;background:#ecfdf5;border-radius:6px;padding:6px 8px;margin-top:6px;">${escapeHtml(row.answer)}</div>` : ""}</td>
 <td style="white-space:nowrap;">${escapeHtml(row.teacherName || "Chua gan")}</td>
 <td style="font-size:12px;white-space:nowrap;">${escapeHtml(row.courseName || "Tu do")}</td>
 <td style="white-space:nowrap;"><span style="font-size:11px;background:${answered ? "#d1fae5" : "#e0e7ff"};color:${answered ? "#065f46" : "#4338ca"};border-radius:5px;padding:2px 8px;font-weight:600;">${answered ? "Da tra loi" : "HS -> Admin"}</span></td>
 <td style="white-space:nowrap;">${badge(answered ? "Da xu ly" : "Cho xu ly", answered ? "success" : "warning")}</td>
 <td style="white-space:nowrap;">${answered ? '<span class="text-muted small">-</span>' : `<button class="btn btn-success btn-xs py-0 px-2" style="font-size:11px;" onclick="EC_ADMIN_OPS.answerQuestion('${row.id}')"><i class="mdi mdi-check"></i> Tra loi</button><button class="btn btn-outline-primary btn-xs py-0 px-2 ms-1" style="font-size:11px;" onclick="EC_ADMIN_OPS.forwardQuestion('${row.id}')"><i class="mdi mdi-send"></i> Gui GV</button>`}</td>
 </tr>`;
 }).join("") : `<tr><td colspan="7" class="text-center text-muted py-5">Khong co cau hoi nao dang cho duyet.</td></tr>`;
 if (body) {
 body.innerHTML = html;
 } else {
 panel.innerHTML = `<div class="table-responsive"><table class="table table-sm mt-2 align-middle" style="min-width:860px;"><thead style="background:#f8fafc;"><tr><th>Hoc vien</th><th>Cau hoi</th><th>Giao vien</th><th>Khoa hoc</th><th>Giai doan</th><th>Trang thai</th><th>Thao tac</th></tr></thead><tbody>${html}</tbody></table></div>`;
 }
 }

 function renderApprovals() {
 const section = document.getElementById("sec-duyet-lich");
 if (!section) return;
 hideDebugButtons();
 updateBadges();
 renderScheduleCards();
 renderMaterialCards("tab-baigiang", lessonRequests(), "Khong co bai giang nao cho xu ly.");
 renderMaterialCards("tab-tailieu", documentRequests(), "Khong co tai lieu nao cho xu ly.");
 renderCourseApprovals();
 renderQuestionApprovals();
 switchTab(activeTab);
 }

 async function publishCourse(id) {
 try {
 await request(`/api/courses/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: JSON.stringify({ status: "active" })
 });
 notify("Da mo khoa hoc.", "success");
 await core.loadAll(true);
 } catch (error) {
 notify(error.message, "danger");
 }
 }

 async function answerQuestion(id) {
 const question = state.questions.find(item => item.id === id);
 if (!question) return notify("Khong tim thay cau hoi.", "warning");
 const answer = prompt("Noi dung tra loi/gui duyet cho hoc vien:", question.answer || "");
 if (answer === null) return;
 if (!answer.trim()) return notify("Can nhap noi dung tra loi.", "warning");
 try {
 await request(`/api/questions/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body: JSON.stringify({ answer: answer.trim() })
 });
 notify("Da cap nhat cau tra loi hoi dap.", "success");
 await core.loadAll(true);
 } catch (error) {
 notify(error.message, "danger");
 }
 }

 async function forwardQuestion(id) {
 const question = state.questions.find(item => item.id === id);
 if (!question) return notify("Khong tim thay cau hoi.", "warning");
 if (!question.teacherId) return notify("Cau hoi chua gan giao vien phu trach.", "warning");
 try {
 await request("/api/notifications", {
 method: "POST",
 body: JSON.stringify({
 userId: question.teacherId,
 title: "Can phan hoi cau hoi hoc vien",
 body: question.title || question.body || "Hoc vien dang can giao vien phan hoi.",
 type: "qa"
 })
 });
 notify("Da gui cau hoi cho giao vien phu trach.", "success");
 await core.loadAll(true);
 } catch (error) {
 notify(error.message, "danger");
 }
 }

 window.switchDuyetTab = function(type) {
 switchTab(type);
 renderApprovals();
 };

 // ── AI Review Modal ──────────────────────────────────────────

 function ensureAIReviewModal() {
  if (document.getElementById("ecAIReviewModal")) return;
  const el = document.createElement("div");
  el.innerHTML = `<div class="modal fade" id="ecAIReviewModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" style="max-width:500px;">
   <div class="modal-content" style="border-radius:16px;overflow:hidden;border:none;box-shadow:0 20px 60px rgba(15,23,42,.22);">
    <div class="modal-header" style="background:linear-gradient(135deg,#6366f1,#818cf8);border:none;padding:16px 20px;">
     <div class="d-flex align-items-center gap-2 flex-grow-1">
      <span style="font-size:24px;line-height:1;">🤖</span>
      <div>
       <div style="color:#fff;font-weight:800;font-size:15px;">AI Phân tích nội dung</div>
       <div style="color:rgba(255,255,255,.75);font-size:11px;" id="ecAIReviewSubtitle">Đang tải...</div>
      </div>
     </div>
     <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
    </div>
    <div class="modal-body" id="ecAIReviewBody" style="padding:20px;"></div>
    <div class="modal-footer" id="ecAIReviewFooter" style="border:none;padding:12px 20px;gap:8px;"></div>
   </div>
  </div>
 </div>`;
  document.body.appendChild(el.firstElementChild);
 }

 function showAIReviewLoading(title) {
  ensureAIReviewModal();
  const subtitle = document.getElementById("ecAIReviewSubtitle");
  const body = document.getElementById("ecAIReviewBody");
  const footer = document.getElementById("ecAIReviewFooter");
  if (subtitle) subtitle.textContent = escapeHtml(title);
  if (body) body.innerHTML = `<div class="text-center py-5">
   <div class="spinner-border mb-3" style="color:#6366f1;width:36px;height:36px;border-width:3px;"></div>
   <div class="text-muted" style="font-size:13px;">AI đang phân tích bài giảng...</div>
  </div>`;
  if (footer) footer.innerHTML = `<button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Đóng</button>`;
  const modal = new bootstrap.Modal(document.getElementById("ecAIReviewModal"));
  modal.show();
 }

 function renderAIReviewResult(materialId, review) {
  const body = document.getElementById("ecAIReviewBody");
  const footer = document.getElementById("ecAIReviewFooter");
  if (!body || !footer) return;

  const rec = review.recommendation || "review";
  const conf = review.confidence || "low";
  const score = Math.min(10, Math.max(1, Number(review.qualityScore) || 5));
  const recMap = {
   approve:  { label: "✅ Khuyến nghị: Duyệt",    bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
   reject:   { label: "❌ Khuyến nghị: Từ chối",  bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
   review:   { label: "⚠️ Cần xem xét thêm",      bg: "#fef9c3", color: "#854d0e", border: "#fde68a" }
  };
  const r = recMap[rec] || recMap.review;
  const confLabel = { high: "Độ tin cậy cao", medium: "Độ tin cậy trung bình", low: "Độ tin cậy thấp" }[conf] || conf;
  const scoreColor = score >= 7 ? "#10b981" : score >= 5 ? "#f59e0b" : "#ef4444";

  body.innerHTML = `
   <div style="background:${r.bg};border:1.5px solid ${r.border};border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:14px;font-weight:800;color:${r.color};">${r.label}</span>
    <span style="font-size:11px;color:${r.color};opacity:.8;">${confLabel}</span>
   </div>
   <div class="d-flex align-items-center gap-2 mb-3">
    <span style="font-size:12px;font-weight:700;color:#64748b;white-space:nowrap;">Điểm chất lượng:</span>
    <div class="progress flex-grow-1" style="height:8px;border-radius:99px;">
     <div class="progress-bar" style="width:${score * 10}%;background:${scoreColor};"></div>
    </div>
    <strong style="color:${scoreColor};font-size:13px;min-width:30px;">${score}/10</strong>
   </div>
   <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:12px;">
    <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:5px;">TÓM TẮT</div>
    <div style="font-size:13px;color:#334155;line-height:1.6;">${escapeHtml(review.summary || "—")}</div>
   </div>
   <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
    <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:5px;">LÝ DO</div>
    <div style="font-size:13px;color:#334155;line-height:1.6;">${escapeHtml(review.reason || "—")}</div>
   </div>
   <div>
    <div style="font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.06em;margin-bottom:6px;">GHI CHÚ GỬI GIÁO VIÊN <span style="font-weight:400;color:#94a3b8;">(có thể chỉnh sửa)</span></div>
    <textarea id="ecAIAdminNote" class="form-control form-control-sm" rows="2" style="font-size:13px;resize:none;">${escapeHtml(review.adminNote || "")}</textarea>
   </div>`;

  footer.innerHTML = `
   <button class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Đóng</button>
   <button class="btn btn-danger btn-sm" style="min-width:100px;" onclick="EC_ADMIN_OPS.applyAIReview('${materialId}','rejected')"><i class="mdi mdi-close me-1"></i>Từ chối</button>
   <button class="btn btn-success btn-sm" style="min-width:100px;" onclick="EC_ADMIN_OPS.applyAIReview('${materialId}','approved')"><i class="mdi mdi-check me-1"></i>Duyệt</button>`;
 }

 async function aiReviewMaterial(id) {
  const material = state.materialRequests.find(m => m.id === id);
  if (!material) return notify("Không tìm thấy bài giảng.", "warning");
  showAIReviewLoading(material.title);
  try {
   const data = await request("/api/ai/review-material", {
    method: "POST",
    body: JSON.stringify({ materialId: id })
   });
   if (data.ok && data.review) {
    const subtitle = document.getElementById("ecAIReviewSubtitle");
    if (subtitle) subtitle.textContent = escapeHtml(material.title);
    renderAIReviewResult(id, data.review);
   } else {
    notify("AI không trả về kết quả.", "warning");
   }
  } catch (err) {
   notify(err.message, "danger");
   const modal = bootstrap.Modal.getInstance(document.getElementById("ecAIReviewModal"));
   if (modal) modal.hide();
  }
 }

 async function applyAIReview(id, status) {
  const noteEl = document.getElementById("ecAIAdminNote");
  const adminNote = noteEl ? noteEl.value.trim() : "";
  const modalEl = document.getElementById("ecAIReviewModal");
  if (modalEl && window.bootstrap) {
   const modal = bootstrap.Modal.getInstance(modalEl);
   if (modal) modal.hide();
  }
  try {
   await request(`/api/material-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, adminNote })
   });
   notify(status === "approved" ? "Đã duyệt bài giảng." : "Đã từ chối bài giảng.", "success");
   await core.loadAll(true);
  } catch (err) {
   notify(err.message, "danger");
  }
 }

 Object.assign(window.EC_ADMIN_OPS, { publishCourse, answerQuestion, forwardQuestion, aiReviewMaterial, applyAIReview });
 window.EC_ADMIN_RENDERERS.approvals = renderApprovals;
})();
