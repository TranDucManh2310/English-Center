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
 if (preselect && EC_COURSES[preselect] && Array.isArray(window.selected) && !window.selected.includes(preselect)) {
 window.selected.push(preselect);
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
