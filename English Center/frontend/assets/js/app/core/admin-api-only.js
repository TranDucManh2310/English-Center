(function() {
 "use strict";

 window.EC_API_ONLY_MODE = true;
 window.__ecAdminDashboard = window.__ecAdminDashboard || { __loading: true };

 const loadingText = "Dang tai du lieu tu API...";
 const chartIds = [
 "rtSparklineChart",
 "revenueChart",
 "revenueByCourseChart",
 "courseRevenueChart",
 "completionChart",
 "teacherRatingChart",
 "polarCoursesChart",
 "radarSkillChart",
 "newStudentTrendChart",
 "studentStatusStackChart",
 "submissionRateChart",
 "bubbleAttendanceChart",
 "activityHeatmapChart",
 "bcRevenueChart",
 "bcNewHVChart",
 "bcCompletionChart",
 "bcFeeStatusChart",
 "khCompletionChart",
 "khDistChart",
 "khGrowthChart",
 "vdHistoryChart",
 "sparkRevenue",
 "sparkStudents",
 "sparkCompletion"
 ];

 const tableBodies = [
 "#fullHVBody",
 "#sec-dsgv table tbody",
 "#sec-dskh table tbody",
 "#sec-taichinh table tbody",
 "#sec-thongbao table tbody",
 "#sec-tailieu table tbody",
 "#sec-baocao table tbody",
 "#sec-dethi table tbody"
 ];

 const listTargets = [
 "rtUserList",
 "revenueByKhoa",
 "thongbaoList",
 "vdHistoryList",
 "cards-lich",
 "tab-baigiang",
 "tab-tailieu",
 "tab-khoahoc",
 "tab-hoidap",
 "courseCards",
 "financeRecentList"
 ];

 function setText(selector, value) {
 document.querySelectorAll(selector).forEach(element => {
 element.textContent = value;
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
 const title = titles.find(element => normalizeText(element.textContent).includes(needle));
 return title ? title.closest(".card-body") || title.closest(".card") : null;
 }

 function clearCardByTitle(fragment) {
 const card = findCardByTitle(fragment);
 if (!card) return;
 const header = card.querySelector(".d-flex.justify-content-between") || card.firstElementChild;
 card.innerHTML = "";
 if (header) card.appendChild(header);
 card.insertAdjacentHTML("beforeend", `<div class="text-muted small py-3">${loadingText}</div>`);
 }

 function clearTableBody(tbody) {
 if (!tbody) return;
 const table = tbody.closest("table");
 const cols = Math.max(1, table ? table.querySelectorAll("thead th").length : 1);
 tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted py-4">${loadingText}</td></tr>`;
 }

 function clearSelect(id, label) {
 const select = document.getElementById(id);
 if (!select) return;
 select.innerHTML = `<option value="">${label}</option>`;
 }

 function destroyLegacyCharts() {
 chartIds.forEach(id => {
 if (typeof window._ecDestroyChart === "function") window._ecDestroyChart(id);
 const canvas = document.getElementById(id);
 if (canvas) {
 const ctx = canvas.getContext && canvas.getContext("2d");
 if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
 }
 });
 }

 function clearDemoDom() {
 tableBodies.forEach(selector => {
 document.querySelectorAll(selector).forEach(clearTableBody);
 });

 listTargets.forEach(id => {
 const element = document.getElementById(id);
 if (element) element.innerHTML = `<div class="text-muted small py-3">${loadingText}</div>`;
 });

 const studentCards = document.getElementById("fullHVCards");
 if (studentCards) studentCards.innerHTML = `<div class="text-center text-muted py-5" style="grid-column:1/-1;">${loadingText}</div>`;

 const honorList = document.getElementById("vd2StudentList");
 if (honorList) honorList.innerHTML = '<span class="text-muted small">Chua chon hoc vien.</span>';

 clearSelect("vd2StudentPick", "-- Chon them hoc vien --");
 clearSelect("vdStudentPick", "-- Chon hoc vien --");
 clearSelect("tbTarget", "Dang tai doi tuong nhan...");

 ["vd2Title", "vd2Content", "tbTitle", "tbBody"].forEach(id => {
 const input = document.getElementById(id);
 if (input) input.value = "";
 });

 setText(".ec-kpi-card h3, .ec-kpi-card h4", "--");
 setText("#rtTotal, #rtStudents, #rtTeachers, #rtLearning", "--");
 setText("#rtOnlineCount", "Dang tai tu API");
 setText("#rtLastUpdate", "Dang dong bo API...");

 ["bcFeeStatusLegend", "khDistLegend"].forEach(id => {
 const element = document.getElementById(id);
 if (element) element.innerHTML = `<div class="text-muted small">${loadingText}</div>`;
 });

 [
 "hoc vien can chu y",
 "top hoc vien",
 "gamification",
 "doanh thu theo thang"
 ].forEach(clearCardByTitle);

 destroyLegacyCharts();
 }

 function installApiOnlyHooks() {
 const originalForceRefresh = window.rtForceRefresh;
 window.rtForceRefresh = function() {
 if (window.__ecAdminDashboard && !window.__ecAdminDashboard.__loading) return;
 if (typeof originalForceRefresh === "function") return originalForceRefresh.apply(this, arguments);
 };
 }

 if (document.readyState === "loading") {
 document.addEventListener("DOMContentLoaded", function() {
 installApiOnlyHooks();
 clearDemoDom();
 });
 } else {
 installApiOnlyHooks();
 clearDemoDom();
 }
})();
