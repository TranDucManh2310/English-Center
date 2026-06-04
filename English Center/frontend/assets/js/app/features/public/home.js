(function() {
  "use strict";

  const courseImages = [
    "assets/img/education/luyen-de-tieng-anh.jpg",
    "assets/img/education/courses-7.webp",
    "assets/img/education/courses-12.webp",
    "assets/img/education/courses-5.webp",
    "assets/img/education/courses-9.webp",
    "assets/img/education/courses-14.webp"
  ];
  const teacherImage = "assets/img/education/teacher-8.webp";
  let teachers = [];
  let courses = [];

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  async function getJson(path) {
    const response = await fetch(path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || "Khong tai duoc du lieu.");
    return data;
  }

  function money(value) {
    const amount = Number(value || 0);
    return amount > 0 ? `${amount.toLocaleString("vi-VN")}d` : "Mien phi";
  }

  function rating(seed) {
    return Number((4.5 + (Number(seed || 0) % 5) / 10).toFixed(1));
  }

  function stars(value) {
    let html = "";
    for (let index = 1; index <= 5; index += 1) {
      html += `<i class="bi bi-${value >= index ? "star-fill" : value >= index - 0.5 ? "star-half" : "star"}"></i>`;
    }
    return html;
  }

  function coursesForTeacher(teacherId) {
    return courses.filter(course => course.teacherId === teacherId);
  }

  function renderCourses() {
    const row = document.querySelector("#featured-courses .row.gy-4");
    if (!row) return;
    const items = courses.slice(0, 6);
    if (!items.length) {
      row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Chua co khoa hoc active trong database.</div></div>';
      return;
    }
    row.innerHTML = items.map((course, index) => {
      const rate = rating(course.enrolledCount);
      const image = courseImages[index % courseImages.length];
      return `
        <div class="col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="${200 + index * 80}">
          <div class="course-card">
            <div class="course-image">
              <img src="${image}" alt="" class="img-fluid">
              ${index === 0 ? '<div class="badge featured">Noi bat</div>' : ""}
              <div class="price-badge">${money(course.price)}</div>
            </div>
            <div class="course-content">
              <div class="course-meta">
                <span class="level">${escapeHtml(course.level || "Dang cap nhat")}</span>
                <span class="duration">${Number(course.durationWeeks || 0) || 0} tuan</span>
              </div>
              <h3><a href="khoahoc.html">${escapeHtml(course.name)}</a></h3>
              <p>${escapeHtml(course.description || "Noi dung khoa hoc dang duoc cap nhat.")}</p>
              <div class="instructor">
                <div class="instructor-info">
                  <h6>${escapeHtml(course.teacherName || "Dang cap nhat")}</h6>
                  <span>Giao vien phu trach</span>
                </div>
              </div>
              <div class="course-stats">
                <div class="rating">${stars(rate)}<span>(${rate})</span></div>
                <div class="students"><i class="bi bi-people-fill"></i><span>${Number(course.enrolledCount || 0)} hoc vien</span></div>
              </div>
              <a href="chonkhoahoc.html?course=${encodeURIComponent(course.slug || course.id)}" class="btn-course">Dang ky</a>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderTeachers() {
    const row = document.querySelector("#featured-instructors .row.gy-4");
    if (!row) return;
    const items = teachers.slice(0, 4);
    if (!items.length) {
      row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Chua co giao vien trong database.</div></div>';
      return;
    }
    row.innerHTML = items.map((teacher, index) => {
      const teacherCourses = coursesForTeacher(teacher.id);
      const rate = rating(teacherCourses.length);
      return `
        <div class="col-xl-3 col-lg-4 col-md-6" data-aos="fade-up" data-aos-delay="${200 + index * 70}">
          <div class="instructor-card">
            <div class="instructor-image">
              <img src="${teacherImage}" class="img-fluid" alt="">
              <div class="overlay-content">
                <div class="rating-stars">${stars(rate)}<span>${rate}</span></div>
                <div class="course-count"><i class="bi bi-play-circle"></i><span>${teacherCourses.length} khoa hoc</span></div>
              </div>
            </div>
            <div class="instructor-info">
              <h5>${escapeHtml(teacher.name)}</h5>
              <p class="specialty">${escapeHtml(teacher.education || teacher.experience || "Giao vien tieng Anh")}</p>
              <p class="description">${escapeHtml(teacher.motivation || teacher.experience || "Ho so giao vien dang duoc cap nhat.")}</p>
              <div class="stats-grid">
                <div class="stat"><span class="number">${teacherCourses.length}</span><span class="label">khoa hoc</span></div>
                <div class="stat"><span class="number">${rate}</span><span class="label">danh gia</span></div>
              </div>
              <div class="action-buttons">
                <a href="#" class="btn-view" onclick="event.preventDefault();openTeacherModal('${escapeHtml(teacher.id)}')">Xem ho so</a>
                <div class="social-links"><a href="mailto:${escapeHtml(teacher.email)}"><i class="bi bi-envelope"></i></a></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value;
  }

  window.openTeacherModal = function(id) {
    const teacher = teachers.find(item => item.id === id);
    if (!teacher) return;
    const teacherCourses = coursesForTeacher(teacher.id);
    const rate = rating(teacherCourses.length);
    const avatar = document.getElementById("m-avatar");
    if (avatar) avatar.src = teacherImage;
    setText("m-name", teacher.name);
    setText("m-specialty", teacher.education || teacher.experience || "Giao vien tieng Anh");
    setText("m-cred1", teacher.education || "Dang cap nhat");
    setText("m-cred2", teacher.experience || "Dang cap nhat");
    setText("m-cred3", `${teacherCourses.length} khoa hoc`);
    setHtml("m-stars", stars(rate));
    setText("m-rating-text", `${rate} tu du lieu khoa hoc`);
    setText("m-s-students", teacherCourses.reduce((total, course) => total + Number(course.enrolledCount || 0), 0));
    setText("m-s-courses", `${teacherCourses.length} khoa`);
    setText("m-s-rating", rate);
    setText("m-s-years", teacher.experience || "Dang cap nhat");
    setText("m-email", teacher.email || "Dang cap nhat");
    setText("m-hours", teacher.schedule || "Dang cap nhat");
    setText("m-bio", teacher.motivation || teacher.experience || "Ho so giao vien dang duoc cap nhat.");
    setHtml("m-skills", '<div class="text-muted">Ky nang chuyen mon duoc cap nhat trong ho so giao vien.</div>');
    setHtml("m-experience", `<div class="text-muted">${escapeHtml(teacher.experience || "Chua cap nhat kinh nghiem.")}</div>`);
    setHtml("m-courses-list", teacherCourses.length ? teacherCourses.map(course => `
      <div style="display:flex;gap:.8rem;margin-bottom:.9rem;padding:.8rem;background:#fff;border-radius:8px;border:1px solid #e4e8ef;">
        <div style="flex-shrink:0;width:70px;height:55px;background:#fef0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bi bi-play-circle-fill" style="font-size:1.4rem;color:var(--accent-color,#e84444);"></i></div>
        <div><h6 style="margin:0 0 .3rem;font-size:.87rem;font-weight:700;">${escapeHtml(course.name)}</h6><div style="display:flex;gap:.7rem;font-size:.77rem;color:#888;"><span>${Number(course.enrolledCount || 0)} hoc vien</span><span>${escapeHtml(course.level || "Dang cap nhat")}</span></div></div>
      </div>
    `).join("") : '<div class="text-muted">Giao vien chua duoc gan khoa hoc active.</div>');
    setHtml("m-reviews-list", '<div class="text-muted">Chua co danh gia trong database.</div>');
    setHtml("m-achievements-list", '<div class="text-muted">Thanh tich se duoc cap nhat tu ho so giao vien.</div>');
    document.querySelectorAll("#teacherModal .nav-link").forEach(button => button.classList.remove("active"));
    document.querySelectorAll("#teacherModal .tab-pane").forEach(pane => pane.classList.remove("show", "active"));
    document.querySelector('#teacherModal [data-bs-target="#mt-about"]').classList.add("active");
    document.getElementById("mt-about").classList.add("show", "active");
    const modal = document.getElementById("teacherModal");
    if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
  };

  ready(async function() {
    const courseRow = document.querySelector("#featured-courses .row.gy-4");
    const teacherRow = document.querySelector("#featured-instructors .row.gy-4");
    if (courseRow) courseRow.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Dang tai khoa hoc...</div></div>';
    if (teacherRow) teacherRow.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Dang tai giao vien...</div></div>';
    try {
      const [courseData, teacherData] = await Promise.all([
        getJson("/api/public/courses?status=active"),
        getJson("/api/public/teachers")
      ]);
      courses = courseData.courses || [];
      teachers = teacherData.teachers || [];
      renderCourses();
      renderTeachers();
    } catch (error) {
      const message = escapeHtml(error.message);
      if (courseRow) courseRow.innerHTML = `<div class="col-12"><div class="text-center py-5 text-muted">${message}</div></div>`;
      if (teacherRow) teacherRow.innerHTML = `<div class="col-12"><div class="text-center py-5 text-muted">${message}</div></div>`;
    }
  });
})();
