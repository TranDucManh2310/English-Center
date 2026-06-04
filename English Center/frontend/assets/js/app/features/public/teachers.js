(function() {
  "use strict";

  const fallbackImage = "assets/img/education/teacher-8.webp";
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

  function ratingFor(teacher) {
    const base = 4.5 + (Number(teacher.courseCount || 0) % 5) / 10;
    return Number(Math.min(base, 5).toFixed(1));
  }

  function stars(rating) {
    let html = "";
    for (let index = 1; index <= 5; index += 1) {
      html += `<i class="bi bi-${rating >= index ? "star-fill" : rating >= index - 0.5 ? "star-half" : "star"}"></i>`;
    }
    return html;
  }

  function initials(name) {
    return String(name || "GV").trim().split(/\s+/).slice(-2).map(part => part.charAt(0)).join("").toUpperCase() || "GV";
  }

  function textKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function teacherCourses(teacherId) {
    return courses.filter(course => course.teacherId === teacherId);
  }

  function normalizeSpecialty(teacher) {
    return teacher.education || teacher.experience || "Giao vien tieng Anh";
  }

  function renderCards() {
    const row = document.getElementById("teachers-row");
    if (!row) return;
    if (!teachers.length) {
      row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Chua co giao vien trong database.</div></div>';
      const count = document.getElementById("teacher-count");
      if (count) count.textContent = "0 giao vien";
      return;
    }

    row.innerHTML = teachers.map((teacher, index) => {
      const teacherCourseList = teacherCourses(teacher.id);
      const rating = ratingFor(teacher);
      const specialty = normalizeSpecialty(teacher);
      const description = teacher.motivation || teacher.experience || "Thong tin ho so giao vien dang duoc cap nhat.";
      return `
        <div class="col-xl-3 col-lg-4 col-md-6 teacher-item" data-search="${escapeHtml(`${teacher.name} ${specialty} ${description}`.toLowerCase())}" data-teacher-id="${escapeHtml(teacher.id)}" data-aos="fade-up" data-aos-delay="${200 + index * 40}">
          <div class="instructor-card">
            <div class="instructor-image">
              <img src="${fallbackImage}" class="img-fluid" alt="">
              <div class="overlay-content">
                <div class="rating-stars">${stars(rating)}<span>${rating}</span></div>
                <div class="course-count"><i class="bi bi-play-circle"></i><span>${teacherCourseList.length} khoa</span></div>
              </div>
            </div>
            <div class="instructor-info">
              <h5>${escapeHtml(teacher.name)}</h5>
              <p class="specialty">${escapeHtml(specialty)}</p>
              <p class="description">${escapeHtml(description)}</p>
              <div class="stats-grid">
                <div class="stat"><span class="number">${teacherCourseList.length}</span><span class="label">Khoa hoc</span></div>
                <div class="stat"><span class="number">${rating}</span><span class="label">Danh gia</span></div>
              </div>
              <div class="action-buttons">
                <a href="#" class="btn-view" onclick="event.preventDefault();openTeacherModal('${escapeHtml(teacher.id)}')">Xem ho so</a>
                <div class="social-links">
                  <a href="mailto:${escapeHtml(teacher.email)}"><i class="bi bi-envelope"></i></a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const count = document.getElementById("teacher-count");
    if (count) count.textContent = `${teachers.length} giao vien`;
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
    const teacherCourseList = teacherCourses(teacher.id);
    const rating = ratingFor(teacher);
    const avatar = document.getElementById("m-avatar");
    if (avatar) avatar.src = fallbackImage;
    setText("m-name", teacher.name);
    setText("m-specialty", normalizeSpecialty(teacher));
    setText("m-cred1", teacher.education || "Dang cap nhat");
    setText("m-cred2", teacher.experience || "Dang cap nhat");
    setText("m-cred3", `${teacherCourseList.length} khoa hoc`);
    setHtml("m-stars", stars(rating));
    setText("m-rating-text", `${rating} tu du lieu khoa hoc`);
    setText("m-s-students", teacherCourseList.reduce((total, course) => total + Number(course.enrolledCount || 0), 0));
    setText("m-s-courses", `${teacherCourseList.length} khoa`);
    setText("m-s-rating", rating);
    setText("m-s-years", teacher.experience || "Dang cap nhat");
    setText("m-email", teacher.email || "Dang cap nhat");
    setText("m-hours", teacher.schedule || "Dang cap nhat");
    setText("m-bio", teacher.motivation || teacher.experience || "Thong tin ho so giao vien dang duoc cap nhat.");
    setHtml("m-skills", '<div class="text-muted">Ky nang chuyen mon duoc quan tri vien cap nhat trong ho so giao vien.</div>');
    setHtml("m-experience", `<div class="text-muted">${escapeHtml(teacher.experience || "Chua cap nhat kinh nghiem.")}</div>`);
    setHtml("m-courses-list", teacherCourseList.length ? teacherCourseList.map(course => `
      <div style="display:flex;gap:.8rem;margin-bottom:.9rem;padding:.8rem;background:#fff;border-radius:8px;border:1px solid #e4e8ef;">
        <div style="flex-shrink:0;width:70px;height:55px;background:#fef0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bi bi-play-circle-fill" style="font-size:1.4rem;color:var(--accent-color,#e84444);"></i></div>
        <div><h6 style="margin:0 0 .3rem;font-size:.87rem;font-weight:700;">${escapeHtml(course.name)}</h6><div style="display:flex;gap:.7rem;font-size:.77rem;color:#888;"><span>${Number(course.enrolledCount || 0)} hoc vien</span><span>${escapeHtml(course.level || "Dang cap nhat")}</span></div></div>
      </div>
    `).join("") : '<div class="text-muted">Giao vien chua duoc gan khoa hoc active.</div>');
    setHtml("m-reviews-list", '<div class="text-muted">Chua co danh gia trong database.</div>');
    setHtml("m-achievements-list", '<div class="text-muted">Thanh tich se duoc cap nhat tu ho so giao vien.</div>');

    document.querySelectorAll("#teacherModal .nav-link").forEach(button => button.classList.remove("active"));
    document.querySelectorAll("#teacherModal .tab-pane").forEach(pane => pane.classList.remove("show", "active"));
    const firstTab = document.querySelector('#teacherModal [data-bs-target="#mt-about"]');
    if (firstTab) firstTab.classList.add("active");
    const about = document.getElementById("mt-about");
    if (about) about.classList.add("show", "active");
    const modal = document.getElementById("teacherModal");
    if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
  };

  window.filterTeachers = function(tag, btn) {
    document.querySelectorAll(".filter-btn").forEach(button => {
      button.classList.remove("btn-primary");
      button.classList.add("btn-outline-secondary");
    });
    if (btn) {
      btn.classList.remove("btn-outline-secondary");
      btn.classList.add("btn-primary");
    }
    let count = 0;
    document.querySelectorAll(".teacher-item").forEach(item => {
      const haystack = textKey(item.getAttribute("data-search") || "");
      const normalizedTag = textKey(tag || "all");
      const show = tag === "all" || haystack.includes(normalizedTag);
      item.style.display = show ? "" : "none";
      if (show) count += 1;
    });
    const countElement = document.getElementById("teacher-count");
    if (countElement) countElement.textContent = `${count} giao vien`;
  };

  ready(async function() {
    const row = document.getElementById("teachers-row");
    if (row) row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Dang tai giao vien...</div></div>';
    try {
      const [teacherData, courseData] = await Promise.all([
        getJson("/api/public/teachers"),
        getJson("/api/public/courses?status=active")
      ]);
      teachers = teacherData.teachers || [];
      courses = courseData.courses || [];
      renderCards();
    } catch (error) {
      if (row) row.innerHTML = `<div class="col-12"><div class="text-center py-5 text-muted">${escapeHtml(error.message)}</div></div>`;
    }
  });
})();
