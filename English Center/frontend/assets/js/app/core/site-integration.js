(function() {
 "use strict";

 const TOKEN_KEY = "ec_auth_token";
 const USER_KEY = "ec_current_user";
 const COURSE_KEY_BY_SLUG = {
 "ngu-phap-thptqg": "nguphap",
 "luyen-de-thptqg": "luyen-de",
 "cap-toc-4-tuan": "on-thi-cap-toc",
 "tu-vung-theo-chu-de": "tu-vung",
 "phat-am-ai": "phat-am",
 "tieng-anh-nang-cao": "nang-cao"
 };
 const COURSE_ORDER = ["nguphap", "tu-vung", "luyen-de", "nang-cao", "phat-am", "on-thi-cap-toc"];

 function ready(fn) {
 if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
 else fn();
 }

 function token() {
 return localStorage.getItem(TOKEN_KEY) || "";
 }

 function getUser() {
 try {
 return JSON.parse(localStorage.getItem(USER_KEY) || "null");
 } catch {
 return null;
 }
 }

 function setUser(user) {
 if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
 }

 async function api(path, options) {
 if (window.location.protocol === "file:") throw new Error("He thong chua san sang.");
 const headers = {
 "Content-Type": "application/json",
 ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
 ...((options && options.headers) || {})
 };
 const response = await fetch(path, { ...(options || {}), headers });
 const data = await response.json().catch(() => ({}));
 if (!response.ok || data.ok === false) throw new Error(data.message || "Yeu cau khong thanh cong.");
 return data;
 }

 function money(value) {
 return `${Number(value || 0).toLocaleString("vi-VN")}d`;
 }

 function escapeHtml(value) {
 return String(value ?? "").replace(/[&<>"']/g, function(ch) {
 return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
 });
 }

 function courseKey(course) {
 return COURSE_KEY_BY_SLUG[course.slug] || course.slug || course.id;
 }

 function normalizeCourse(course) {
 const key = courseKey(course);
 const free = Number(course.price || 0) <= 0;
 return {
 id: course.id,
 key,
 slug: course.slug,
 name: course.name,
 teacher: course.teacherName || "Dang cap nhat",
 free,
 price: Number(course.price || 0),
 price_sale: Number(course.price || 0),
 hours: Math.max(1, Number(course.durationWeeks || 1) * 3),
 rating: 4.6 + (Number(course.enrolledCount || 0) % 5) / 10,
 students: Number(course.enrolledCount || 0),
 level: course.level || "",
 description: course.description || "",
 durationWeeks: Number(course.durationWeeks || 0),
 capacity: Number(course.capacity || 0),
 tags: [free ? "Mien phi" : (course.level || "Khoa hoc")],
 tag_color: free ? "#d1fae5" : "#dbeafe",
 tag_text: free ? "#065f46" : "#1e40af"
 };
 }

 let coursePromise = null;
 async function loadCourses() {
 if (!coursePromise) {
 coursePromise = api("/api/public/courses?status=active").then(data => {
 const courses = (data.courses || []).map(normalizeCourse);
 courses.sort((a, b) => {
 const ar = COURSE_ORDER.includes(a.key) ? COURSE_ORDER.indexOf(a.key) : COURSE_ORDER.length;
 const br = COURSE_ORDER.includes(b.key) ? COURSE_ORDER.indexOf(b.key) : COURSE_ORDER.length;
 return ar - br || a.name.localeCompare(b.name);
 });
 window.EC_REAL_COURSES = courses;
 window.EC_COURSE_ID_BY_KEY = courses.reduce((map, course) => {
 map[course.key] = course.id;
 return map;
 }, {});
 return courses;
 });
 }
 return coursePromise;
 }

 function syncCoursePicker(courses) {
 if (typeof EC_COURSES === "undefined" || !window.renderCourses) return;
 Object.keys(EC_COURSES).forEach(key => delete EC_COURSES[key]);
 courses.forEach(course => {
  EC_COURSES[course.key] = {
  _courseId: course.id,
  id: course.id,
  slug: course.slug,
  key: course.key,
  name: course.name,
  teacher: course.teacher,
  free: course.free,
 price: course.price,
 price_sale: course.price_sale,
 hours: course.hours,
 rating: Number(course.rating.toFixed(1)),
 students: course.students,
 level: course.level,
 tags: course.tags,
 tag_color: course.tag_color,
 tag_text: course.tag_text
 };
 });

 const preselect = new URLSearchParams(window.location.search).get("course");
 const preselectKey = preselect && Object.keys(EC_COURSES).find(key => {
 const course = EC_COURSES[key];
 return key === preselect || course.slug === preselect || course.id === preselect || course._courseId === preselect;
 });
 if (preselectKey && Array.isArray(window.selected) && !window.selected.includes(preselectKey)) {
 window.selected.push(preselectKey);
 }
 if (window.preselectEnrollmentCourse) {
 window.preselectEnrollmentCourse();
 }
 window.renderCourses();
 if (window.renderPlans) window.renderPlans();
 if (window.updateSummary) window.updateSummary();
 }

 function syncCourseModalData(courses) {
 if (!Array.isArray(window.khData)) return;
 courses.forEach((course, index) => {
 if (!window.khData[index]) return;
 const item = window.khData[index];
 item._courseId = course.id;
 item._courseKey = course.key;
 item.title = course.name;
 item.cat = (course.level || "KHOA HOC").toUpperCase();
 item.lvl = course.level || item.lvl;
 item.price = course.free ? "MIEN PHI" : money(course.price);
 item.enrolled = `${course.students} hoc vien dang hoc`;
 item.instName = course.teacher;
 item.dur = `${course.durationWeeks} tuan`;
 item.short = course.description || item.short;
 item.desc = course.description || item.desc;
 });
 }

 function syncPublicCourseCards(courses) {
 const cards = Array.from(document.querySelectorAll(".course-col"));
 if (!cards.length) return;
 cards.forEach((card, index) => {
 const course = courses[index];
 if (!course) return;
 card.dataset.courseId = course.id;
 card.dataset.courseKey = course.key;
 card.dataset.price = String(course.price);
 card.dataset.free = course.free ? "1" : "0";
 card.dataset.title = course.name;
 const title = card.querySelector("h3");
 const desc = card.querySelector("p");
 const price = card.querySelector(".course-price");
 const category = card.querySelector(".category");
 const level = card.querySelector(".level");
 const stats = card.querySelectorAll(".course-stats .stat span");
 const teacher = card.querySelector(".instructor-name");
 const enroll = card.querySelector(".btn-course");
 if (title) title.textContent = course.name;
 if (desc && course.description) desc.textContent = course.description;
 if (price) price.textContent = course.free ? "MIEN PHI" : money(course.price);
 if (category) category.textContent = (course.level || "KHOA HOC").toUpperCase();
 if (level) level.textContent = course.level || "";
 if (stats[0]) stats[0].textContent = `${course.hours} gio`;
 if (stats[1]) stats[1].textContent = `${course.students} hoc vien`;
 if (teacher) teacher.textContent = course.teacher;
 if (enroll) enroll.href = `chonkhoahoc.html?course=${encodeURIComponent(course.key)}`;
 });
 }

 function connectContactForms() {
 document.querySelectorAll("form.php-email-form").forEach(form => {
 if (form.dataset.ecConnected === "1") return;
 form.dataset.ecConnected = "1";
 form.addEventListener("submit", async function(event) {
 event.preventDefault();
 event.stopImmediatePropagation();
 const loading = form.querySelector(".loading");
 const errors = form.querySelectorAll(".error-message");
 const sent = form.querySelector(".sent-message");
 if (loading) loading.style.display = "block";
 errors.forEach(el => { el.style.display = "none"; });
 if (sent) sent.style.display = "none";

 const payload = Object.fromEntries(new FormData(form).entries());
 try {
 await api("/api/contact", {
 method: "POST",
 body: JSON.stringify({ type: "contact", ...payload })
 });
 form.reset();
 if (sent) sent.style.display = "block";
 } catch (error) {
 const errorBox = errors[0];
 if (errorBox) {
 errorBox.textContent = error.message || "Gui thong tin that bai.";
 errorBox.style.display = "block";
 }
 } finally {
 if (loading) loading.style.display = "none";
 }
 }, true);
 });
 }

 async function enrollSelectedCourses(selectedKeys, meta) {
 const user = getUser();
 if (!user || !token()) {
 sessionStorage.setItem("ec_after_login", window.location.href);
 window.location.href = "dangnhap.html";
 return false;
 }

 const courses = await loadCourses();
 const byKey = courses.reduce((map, course) => {
 map[course.key] = course;
 return map;
 }, {});
 const selectedCourses = (selectedKeys || []).map(key => byKey[key]).filter(Boolean);
 if (!selectedCourses.length) return false;

 for (const course of selectedCourses) {
 await api("/api/enrollments", {
 method: "POST",
 body: JSON.stringify({
 courseId: course.id,
 status: "active",
 progress: 0,
 completedLessons: 0,
 xp: 0,
 paidAmount: course.free ? 0 : course.price,
 paymentStatus: course.free ? "paid" : ((meta && meta.paymentStatus) || "paid")
 })
 });
 }

 const enrolled = Array.from(new Set([...(user.enrolled || []), ...selectedCourses.map(course => course.id)]));
 setUser({ ...user, enrolled });
 await api("/api/contact", {
 method: "POST",
 body: JSON.stringify({
 type: "enrollment_checkout",
 userId: user.id,
 email: user.email,
 courses: selectedCourses.map(course => ({ id: course.id, name: course.name, price: course.price })),
 meta: meta || {}
 })
 }).catch(() => {});
 return true;
 }

 function connectRegisterRedirect() {
 const saved = sessionStorage.getItem("ec_after_login");
 if (saved && getUser() && window.location.pathname.toLowerCase().includes("dangnhap.html")) {
 sessionStorage.removeItem("ec_after_login");
 window.location.href = saved;
 }
 }

 window.EC_SITE = {
 loadCourses,
 enrollSelectedCourses
 };

 ready(async function() {
 connectContactForms();
 connectRegisterRedirect();
 try {
 const courses = await loadCourses();
 syncCoursePicker(courses);
 syncCourseModalData(courses);
 syncPublicCourseCards(courses);
 } catch (error) {
 console.warn("[English Center] Khong dong bo duoc du lieu public:", error.message);
 }
 });
})();

/* ── AI Chatbot Widget ── */
(function() {
 if (document.getElementById("ec-chatbot-wrap")) return;

 var css = document.createElement("style");
 css.textContent = [
  "#ec-chatbot-wrap{position:fixed;bottom:24px;right:24px;z-index:999998;display:flex;flex-direction:column;align-items:flex-end;gap:0;pointer-events:none}",
  "#ec-cb-btn{width:56px;height:56px;border-radius:50%;background:#6366f1;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,.45);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s;position:relative;flex-shrink:0;pointer-events:all}",
  "#ec-cb-btn:hover{transform:scale(1.09);box-shadow:0 6px 28px rgba(99,102,241,.6)}",
  "#ec-cb-badge{position:absolute;top:-3px;right:-3px;background:#ef4444;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;line-height:1}",
  "#ec-cb-panel{width:360px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(15,23,42,.18);display:flex;flex-direction:column;overflow:hidden;margin-bottom:12px;transition:opacity .22s,transform .22s;transform-origin:bottom right;pointer-events:all}",
  "#ec-cb-panel.ec-cb-hide{opacity:0;transform:scale(.94) translateY(10px);pointer-events:none}",
  ".ec-cb-head{background:linear-gradient(135deg,#6366f1,#818cf8);padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}",
  ".ec-cb-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px}",
  ".ec-cb-head-info{flex:1;min-width:0}",
  ".ec-cb-head-name{color:#fff;font-weight:700;font-size:14px;line-height:1.2}",
  ".ec-cb-head-sub{color:rgba(255,255,255,.75);font-size:11px;margin-top:1px}",
  ".ec-cb-head-close{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.8);font-size:22px;line-height:1;padding:0 2px;transition:color .15s;flex-shrink:0}",
  ".ec-cb-head-close:hover{color:#fff}",
  "#ec-cb-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;min-height:220px;max-height:320px;scroll-behavior:smooth}",
  ".ec-cb-row{display:flex;align-items:flex-end;gap:6px;max-width:88%}",
  ".ec-cb-row.ec-cb-bot{align-self:flex-start}",
  ".ec-cb-row.ec-cb-user{align-self:flex-end;flex-direction:row-reverse}",
  ".ec-cb-ico{width:26px;height:26px;border-radius:50%;background:#e0e7ff;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1}",
  ".ec-cb-bubble{padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.55;word-break:break-word;max-width:100%}",
  ".ec-cb-bot .ec-cb-bubble{background:#fff;color:#0f172a;border-radius:4px 14px 14px 14px;box-shadow:0 1px 4px rgba(0,0,0,.07)}",
  ".ec-cb-user .ec-cb-bubble{background:#6366f1;color:#fff;border-radius:14px 4px 14px 14px}",
  ".ec-cb-typing-dots span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#94a3b8;margin:0 1.5px;animation:ecDot .9s infinite ease-in-out}",
  ".ec-cb-typing-dots span:nth-child(2){animation-delay:.18s}",
  ".ec-cb-typing-dots span:nth-child(3){animation-delay:.36s}",
  "@keyframes ecDot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}",
  ".ec-cb-foot{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;border-top:1px solid #e2e8f0;background:#fff;flex-shrink:0}",
  "#ec-cb-input{flex:1;resize:none;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 11px;font-size:13px;line-height:1.45;outline:none;max-height:80px;overflow-y:auto;font-family:inherit;background:#f8fafc;transition:border-color .15s,background .15s}",
  "#ec-cb-input:focus{border-color:#6366f1;background:#fff}",
  "#ec-cb-send{width:36px;height:36px;border-radius:50%;background:#6366f1;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .15s}",
  "#ec-cb-send:hover:not(:disabled){background:#4f46e5;transform:scale(1.08)}",
  "#ec-cb-send:disabled{background:#c7d2fe;cursor:not-allowed}",
  "@media(max-width:480px){#ec-cb-panel{width:calc(100vw - 32px);right:0}#ec-chatbot-wrap{right:16px;bottom:16px}}"
 ].join("");
 document.head.appendChild(css);

 var wrap = document.createElement("div");
 wrap.id = "ec-chatbot-wrap";
 wrap.innerHTML = '<div id="ec-cb-panel" class="ec-cb-hide">' +
  '<div class="ec-cb-head">' +
   '<div class="ec-cb-avatar">🤖</div>' +
   '<div class="ec-cb-head-info">' +
    '<div class="ec-cb-head-name">Trợ lý AI English Center</div>' +
    '<div class="ec-cb-head-sub">Hỏi về khóa học, đăng ký, lịch học...</div>' +
   '</div>' +
   '<button class="ec-cb-head-close" id="ec-cb-close" aria-label="Đóng">×</button>' +
  '</div>' +
  '<div id="ec-cb-msgs"></div>' +
  '<div class="ec-cb-foot">' +
   '<textarea id="ec-cb-input" placeholder="Nhập câu hỏi..." rows="1"></textarea>' +
   '<button id="ec-cb-send" aria-label="Gửi" disabled>' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
   '</button>' +
  '</div>' +
 '</div>' +
 '<button id="ec-cb-btn" aria-label="Mở trợ lý AI">' +
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
  '<span id="ec-cb-badge">1</span>' +
 '</button>';
 document.body.appendChild(wrap);

 var panel = document.getElementById("ec-cb-panel");
 var btn = document.getElementById("ec-cb-btn");
 var closeBtn = document.getElementById("ec-cb-close");
 var msgsEl = document.getElementById("ec-cb-msgs");
 var inputEl = document.getElementById("ec-cb-input");
 var sendBtn = document.getElementById("ec-cb-send");
 var badge = document.getElementById("ec-cb-badge");
 var history = [];
 var loading = false;
 var opened = false;

 function escHtml(t) {
  return String(t || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
 }

 function appendMsg(role, text) {
  var isUser = role === "user";
  var row = document.createElement("div");
  row.className = "ec-cb-row " + (isUser ? "ec-cb-user" : "ec-cb-bot");
  row.innerHTML = (isUser ? "" : '<div class="ec-cb-ico">🤖</div>') +
   '<div class="ec-cb-bubble">' + escHtml(text) + '</div>' +
   (isUser ? '<div class="ec-cb-ico" style="background:#e0e7ff;">😊</div>' : "");
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return row;
 }

 function showTyping() {
  var row = document.createElement("div");
  row.className = "ec-cb-row ec-cb-bot";
  row.id = "ec-cb-typing";
  row.innerHTML = '<div class="ec-cb-ico">🤖</div><div class="ec-cb-bubble"><span class="ec-cb-typing-dots"><span></span><span></span><span></span></span></div>';
  msgsEl.appendChild(row);
  msgsEl.scrollTop = msgsEl.scrollHeight;
 }

 function hideTyping() {
  var el = document.getElementById("ec-cb-typing");
  if (el) el.remove();
 }

 function togglePanel(open) {
  var show = open !== undefined ? open : panel.classList.contains("ec-cb-hide");
  panel.classList.toggle("ec-cb-hide", !show);
  if (show) {
   badge.style.display = "none";
   opened = true;
   setTimeout(function() { inputEl.focus(); }, 60);
  }
 }

 function updateSend() {
  sendBtn.disabled = !inputEl.value.trim() || loading;
 }

 async function doSend() {
  var text = inputEl.value.trim();
  if (!text || loading) return;
  inputEl.value = "";
  inputEl.style.height = "auto";
  loading = true;
  updateSend();
  appendMsg("user", text);
  history.push({ role: "user", content: text });
  if (history.length > 20) history.splice(0, 2);
  showTyping();
  try {
   var res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: history.slice() })
   });
   var data = await res.json();
   hideTyping();
   var reply = (data.content && data.content[0] && data.content[0].text) || "Xin lỗi, tôi chưa hiểu. Bạn thử hỏi lại nhé!";
   appendMsg("bot", reply);
   history.push({ role: "assistant", content: reply });
  } catch (_) {
   hideTyping();
   appendMsg("bot", "Có lỗi kết nối. Vui lòng thử lại sau!");
  }
  loading = false;
  updateSend();
 }

 btn.addEventListener("click", function() { togglePanel(); });
 closeBtn.addEventListener("click", function() { togglePanel(false); });
 sendBtn.addEventListener("click", doSend);
 inputEl.addEventListener("input", function() {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 80) + "px";
  updateSend();
 });
 inputEl.addEventListener("keydown", function(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
 });

 // Greeting
 appendMsg("bot", "Xin chào! 👋 Tôi là trợ lý AI của English Center. Bạn cần tư vấn về khóa học, lịch học hay đăng ký không?");
})();
