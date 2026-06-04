(function () {
 "use strict";

 window.EC_API_ONLY_MODE = true;

 const loadingText = "Dang tai du lieu tu API...";

 function ready(fn) {
 if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
 else fn();
 }

 function setHtml(id, html) {
 const el = document.getElementById(id);
 if (el) el.innerHTML = html;
 }

 function setText(id, value) {
 const el = document.getElementById(id);
 if (el) el.textContent = value;
 }

 function emptyRow(colspan) {
 return `<tr><td colspan="${colspan || 8}" style="text-align:center;color:#64748b;padding:18px">${loadingText}</td></tr>`;
 }

 function emptyBlock() {
 return `<div style="text-align:center;color:#64748b;padding:22px">${loadingText}</div>`;
 }

 function destroyCharts() {
 if (!window.Chart || !Chart.instances) return;
 Object.keys(Chart.instances).forEach(key => {
 try { Chart.instances[key].destroy(); } catch (_) {}
 });
 }

 function clearStudentDemo() {
 [
 "lbList",
 "actLog",
 "notifList",
 "courseListWrap",
 "calSchedule",
 "hdList",
 "kq-skillBars",
 "kq-weekChart",
 "kq-speakingProgress",
 "kq-monthGoals",
 "kq-recentActivity",
 "hh-badgeGrid",
 "hh-leaderboard",
 "hh-nextBadges",
 "lh-timeline",
 "lh-upcoming",
 "spk-topicGrid",
 "spk-historyList"
 ].forEach(id => setHtml(id, emptyBlock()));

 setHtml("kq-examHistory", emptyRow(5));
 setHtml("dt-grid-official", `<div class="col-12">${emptyBlock()}</div>`);
 setHtml("dt-grid-practice", `<div class="col-12">${emptyBlock()}</div>`);
 setHtml("materialsContent", emptyBlock());
 setHtml("flashcardSets", emptyBlock());
 setHtml("examsContent", emptyBlock());
 setHtml("scheduleContent", emptyBlock());
 setHtml("qaContent", emptyBlock());

 ["statXp", "statScore", "statTime", "todayXp"].forEach(id => setText(id, "0"));
 ["xpFill", "dayXpBar", "hh-rankFill"].forEach(id => {
 const el = document.getElementById(id);
 if (el) el.style.width = "0%";
 });
 }

 function installStudentLegacyGuards() {
 window.buildChart = function () {
 const canvas = document.getElementById("progressChart");
 if (!canvas) return;
 const ctx = canvas.getContext && canvas.getContext("2d");
 if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
 };
 window.switchChart = function (btn) {
 document.querySelectorAll("#chartTabXp,#chartTabScore,#chartTabTime").forEach(item => item.classList.remove("active"));
 if (btn) btn.classList.add("active");
 window.buildChart();
 };
 window.renderLB = function () {};
 window.renderActs = function () {};
 window.dtRenderAll = function () {};
 window.dtRepaint = function () {};
 window.tlRender = function () {};
 window.hdRender = function () {};
 window.kqInit = function () {};
 window.hhInit = function () {};
 window.lhInit = function () {};
 window.spkInit = function () {};
 }

 function clearTeacherDemo() {
 try { if (Array.isArray(window.STUDENTS)) window.STUDENTS = []; } catch (_) {}
 try { if (Array.isArray(window.LECTURES)) window.LECTURES = []; } catch (_) {}
 try { if (Array.isArray(window.SCHEDULE)) window.SCHEDULE = []; } catch (_) {}

 setHtml("stBody", emptyRow(9));
 setHtml("topStudents", emptyBlock());
 setHtml("todaySessionWidget", emptyBlock());
 setHtml("lecGrid", emptyBlock());
 setHtml("deList", emptyBlock());
 setHtml("calTableBody", emptyRow(7));
 setHtml("notifList", emptyBlock());
 setHtml("reportTopStudents", emptyBlock());
 }

 function teacherSectionExists(id) {
 return !!id && !!document.getElementById(`s-${id}`);
 }

 function teacherSectionFromRoute(fallback) {
 let hash = "";
 try {
 hash = decodeURIComponent((window.location.hash || "").replace(/^#/, "")).trim();
 } catch (_) {
 hash = "";
 }
 if (teacherSectionExists(hash)) return hash;
 if (teacherSectionExists(fallback)) return fallback;
 return "dashboard";
 }

 function syncTeacherActiveNav(id) {
 document.querySelectorAll(".nav-link,.mi,.sb-item").forEach(item => {
 item.classList.remove("active");
 item.removeAttribute("aria-current");
 });
 const activeItem = Array.from(document.querySelectorAll(".nav-link,.mi,.sb-item")).find(item => {
 const navId = item.getAttribute("data-nav");
 const onclick = item.getAttribute("onclick") || "";
 return navId === id || onclick.includes(`nav('${id}'`) || onclick.includes(`nav("${id}"`);
 });
 if (activeItem) {
 activeItem.classList.add("active");
 activeItem.setAttribute("aria-current", "page");
 }
 }

 function setTeacherRouteSection(id) {
 const nextHash = `#${encodeURIComponent(id)}`;
 if (window.location.hash === nextHash) return;
 window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
 }

 function installTeacherNavigation() {
 if (typeof window.nav === "function") return;
 window.syncTeacherActiveNav = syncTeacherActiveNav;
 window.nav = function (id) {
 const targetId = teacherSectionExists(id) ? id : teacherSectionFromRoute("dashboard");
 document.querySelectorAll("[id^='s-']").forEach(section => {
 section.style.display = section.id === `s-${targetId}` ? "" : "none";
 });
 syncTeacherActiveNav(targetId);
 setTeacherRouteSection(targetId);
 window.scrollTo(0, 0);
 };
 window.addEventListener("hashchange", () => window.nav(teacherSectionFromRoute("dashboard")));
 window.nav(teacherSectionFromRoute("dashboard"));
 }

 ready(function () {
 const path = location.pathname.toLowerCase();
 destroyCharts();
 if (path.includes("dashboard_hocsinh")) {
 installStudentLegacyGuards();
 clearStudentDemo();
 }
 if (path.includes("dashboard_giaovien")) {
 installTeacherNavigation();
 clearTeacherDemo();
 }
 });
})();
