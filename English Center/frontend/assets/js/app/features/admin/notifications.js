(function() {
 "use strict";

 const core = window.EC_ADMIN_CORE;
 if (!core) return;
 const {
 state,
 request,
 notify,
 log,
 escapeHtml,
 dateLabel,
 studentById,
 enrollmentsByStudent,
 riskStudents,
 inactiveStudents,
 newStudents
 } = core;

 function renderNotificationTargets() {
 const select = document.getElementById("tbTarget");
 if (!select) return;
 select.innerHTML = `
 <option value="all">Toan bo he thong (${state.students.length + state.teachers.length})</option>
 <option value="students">Toan bo hoc vien (${state.students.length})</option>
 <option value="teachers">Toan bo giao vien (${state.teachers.length})</option>
 <option value="risk">Hoc vien nguy co (${riskStudents().length})</option>
 <option value="inactive">Hoc vien khong hoat dong (${inactiveStudents().length})</option>
 <option value="new">Hoc vien moi (${newStudents().length})</option>`;
 }

 function recipientsForTarget(target) {
 if (target === "all") return [];
 if (target === "students") return state.students;
 if (target === "teachers") return state.teachers;
 if (target === "risk") return riskStudents();
 if (target === "inactive") return inactiveStudents();
 if (target === "new") return newStudents();
 return [];
 }

 async function sendNotification() {
 const title = ((document.getElementById("tbTitle") || {}).value || "").trim();
 const body = ((document.getElementById("tbBody") || {}).value || "").trim();
 const target = (document.getElementById("tbTarget") || {}).value || "all";
 const typeInput = document.querySelector("input[name='tbType']:checked");
 const type = typeInput ? typeInput.value : "system";
 if (!title) return notify("Tieu de thong bao la bat buoc.", "warning");
 try {
 const recipients = recipientsForTarget(target);
 if (!recipients.length && target === "all") {
 await request("/api/notifications", {
 method: "POST",
 body: JSON.stringify({ title, body, type })
 });
 } else {
 await Promise.all(recipients.map(user => request("/api/notifications", {
 method: "POST",
 body: JSON.stringify({ userId: user.id, title, body, type })
 })));
 }
 notify(`Da gui ${target === "all" ? 1 : recipients.length} thong bao.`, "success");
 log("Gui thong bao he thong", "success");
 const titleInput = document.getElementById("tbTitle");
 const bodyInput = document.getElementById("tbBody");
 if (titleInput) titleInput.value = "";
 if (bodyInput) bodyInput.value = "";
 await core.loadAll(true);
 } catch (error) {
 notify(error.message, "danger");
 }
 }

 function renderNotificationHistory() {
 renderNotificationTargets();
 const list = document.getElementById("thongbaoList");
 if (!list) return;
 const rows = state.notifications.slice(0, 12);
 list.innerHTML = rows.length ? rows.map(row => `<div style="padding:12px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;">
 <div class="d-flex justify-content-between align-items-start mb-1">
 <span style="font-size:12px;font-weight:700;color:#0f172a;">${escapeHtml(row.title)}</span>
 <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">${dateLabel(row.createdAt, true)}</span>
 </div>
 <p style="font-size:11px;color:#64748b;margin:0 0 6px;">Gui den: ${escapeHtml(row.userName || "Broadcast")} - ${escapeHtml(row.type || "system")}</p>
 <div style="font-size:11px;color:#475569;">${escapeHtml(row.body || "")}</div>
 </div>`).join("") : `<div class="text-muted small">Chua co thong bao nao.</div>`;
 }

 function renderHonorStudents() {
 const pick = document.getElementById("vd2StudentPick");
 if (pick) {
 pick.innerHTML = `<option value="">Chon hoc vien</option>` + state.students.map(student => {
 const courseNames = enrollmentsByStudent(student.id).map(row => row.courseName).slice(0, 2).join(", ");
 return `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}${courseNames ? ` - ${escapeHtml(courseNames)}` : ""}</option>`;
 }).join("");
 }
 renderHonorStudentList();
 renderHonorStats();
 renderHonorHistory();
 renderHonorChart();
 }

 function renderHonorStudentList() {
 const list = document.getElementById("vd2StudentList");
 if (!list) return;
 const students = Array.from(state.honorStudentIds).map(studentById).filter(Boolean);
 list.innerHTML = students.length ? students.map((student, index) => `<span style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;border:1px solid #fde68a;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;color:#92400e;">
 ${index + 1}. ${escapeHtml(student.name)} <span onclick="EC_ADMIN_OPS.removeHonorStudent('${student.id}')" style="cursor:pointer;margin-left:3px;color:#d97706;font-size:13px;">x</span>
 </span>`).join("") : `<span class="text-muted small">Chua chon hoc vien.</span>`;
 }

 function renderHonorStats() {
 const honorNotifications = state.notifications.filter(item => item.type === "honor");
 const headerNumbers = document.querySelectorAll("#sec-vinhdanh div[style*='text-align:center'] > div:first-child");
 if (headerNumbers.length >= 3) {
 headerNumbers[0].textContent = honorNotifications.length;
 headerNumbers[1].textContent = new Set(honorNotifications.map(item => item.userId).filter(Boolean)).size || state.honorStudentIds.size;
 headerNumbers[2].textContent = honorNotifications.length * 10;
 }
 }

 function renderHonorHistory() {
 const list = document.getElementById("vdHistoryList");
 if (!list) return;
 const rows = state.notifications.filter(item => item.type === "honor").slice(0, 6);
 list.innerHTML = rows.length ? rows.map(row => `<div style="padding:12px 14px;border-radius:10px;border:1px solid #fef3c7;background:#fffbf0;">
 <div class="d-flex justify-content-between align-items-start mb-1">
 <span style="font-size:12px;font-weight:700;color:#92400e;">${escapeHtml(row.title)}</span>
 <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">${dateLabel(row.createdAt, false)}</span>
 </div>
 <p style="font-size:11px;color:#64748b;margin:0 0 4px;">${escapeHtml(row.userName || "Nhieu hoc vien")}</p>
 ${core.badge("Da dang", "success")}
 </div>`).join("") : `<div class="text-muted small">Chua co bai vinh danh nao.</div>`;
 }

 function renderHonorChart() {
 if (!window.Chart) return;
 const canvas = document.getElementById("vdHistoryChart");
 if (!canvas) return;
 const now = new Date();
 const months = Array.from({ length: 6 }, (_, index) => {
 const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
 return { year: date.getFullYear(), month: date.getMonth(), label: `T${date.getMonth() + 1}` };
 });
 const rows = state.notifications.filter(item => item.type === "honor");
 const data = months.map(month => rows.filter(row => {
 const date = new Date(row.createdAt);
 return !Number.isNaN(date.getTime()) && date.getFullYear() === month.year && date.getMonth() === month.month;
 }).length);
 if (window._ecDestroyChart) window._ecDestroyChart("vdHistoryChart");
 const chart = new Chart(canvas, {
 type: "bar",
 data: { labels: months.map(item => item.label), datasets: [{ label: "Bai vinh danh", data, backgroundColor: "rgba(245,158,11,.75)", borderRadius: 6 }] },
 options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ticks: { stepSize: 1 } } } }
 });
 if (window._ecRegChart) window._ecRegChart("vdHistoryChart", chart);
 }

 async function submitHonorPost() {
 const title = ((document.getElementById("vd2Title") || {}).value || "").trim();
 const body = ((document.getElementById("vd2Content") || {}).value || "").trim();
 const ids = Array.from(state.honorStudentIds);
 if (!title || !ids.length) return notify("Can co tieu de va it nhat 1 hoc vien.", "warning");
 try {
 await Promise.all(ids.map(id => request("/api/notifications", {
 method: "POST",
 body: JSON.stringify({ userId: id, title, body, type: "honor" })
 })));
 notify("Da dang bai vinh danh va gui thong bao.", "success");
 log("Dang bai vinh danh hoc vien", "success");
 await core.loadAll(true);
 } catch (error) {
 notify(error.message, "danger");
 }
 }

 window.guiThongBao = sendNotification;
 window.sendThongBao = sendNotification;
 window.submitVinhDanh2 = submitHonorPost;
 window.vd2AddStudent = function() {
 const pick = document.getElementById("vd2StudentPick");
 if (!pick || !pick.value) return;
 state.honorStudentIds.add(pick.value);
 pick.value = "";
 renderHonorStudentList();
 };
 window.vd2RemoveStudent = function(element) {
 if (element && element.parentElement) element.parentElement.remove();
 };

 Object.assign(window.EC_ADMIN_OPS, {
 removeHonorStudent(id) {
 state.honorStudentIds.delete(id);
 renderHonorStudentList();
 }
 });

 window.EC_ADMIN_RENDERERS.notifications = renderNotificationHistory;
 window.EC_ADMIN_RENDERERS.honor = renderHonorStudents;
})();
