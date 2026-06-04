(function() {
  "use strict";

  const imagePool = [
    "assets/img/education/courses-3.webp",
    "assets/img/education/courses-7.webp",
    "assets/img/education/courses-12.webp",
    "assets/img/education/courses-5.webp",
    "assets/img/education/courses-9.webp",
    "assets/img/education/courses-14.webp"
  ];

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

  function money(value) {
    const amount = Number(value || 0);
    return amount > 0 ? `${amount.toLocaleString("vi-VN")}d` : "Mien phi";
  }

  async function getJson(path) {
    const response = await fetch(path);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || "Khong tai duoc du lieu.");
    return data;
  }

  function normalize(course, index) {
    const price = Number(course.price || 0);
    const students = Number(course.enrolledCount || 0);
    const weeks = Number(course.durationWeeks || 0);
    return {
      id: course.id,
      slug: course.slug || course.id,
      title: course.name || "Khoa hoc",
      description: course.description || "Noi dung khoa hoc dang duoc cap nhat.",
      level: course.level || "Dang cap nhat",
      status: course.status || "active",
      teacher: course.teacherName || "Dang cap nhat",
      price,
      free: price <= 0,
      students,
      hours: Math.max(1, weeks * 3 || 1),
      duration: weeks ? `${weeks} tuan` : "Dang cap nhat",
      rating: Number((4.5 + (students % 5) / 10).toFixed(1)),
      img: imagePool[index % imagePool.length]
    };
  }

  function stars(rating) {
    let html = "";
    for (let index = 1; index <= 5; index += 1) {
      html += `<i class="bi bi-${rating >= index ? "star-fill" : rating >= index - 0.5 ? "star-half" : "star"}"></i>`;
    }
    return html;
  }

  function renderCourses() {
    const row = document.querySelector(".courses-grid .row");
    if (!row) return;
    if (!courses.length) {
      row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Chua co khoa hoc active trong database.</div></div>';
      const count = document.querySelector(".courses-header h2");
      if (count) count.textContent = "0 khoa hoc";
      return;
    }

    row.innerHTML = courses.map((course, index) => {
      const category = escapeHtml(course.level || "Khoa hoc");
      const title = escapeHtml(course.title);
      const description = escapeHtml(course.description);
      const teacher = escapeHtml(course.teacher);
      return `
        <div class="col-lg-6 col-md-6 course-col"
             data-course-id="${escapeHtml(course.id)}"
             data-category="${escapeHtml(course.slug)}"
             data-level="${escapeHtml(course.level.toLowerCase())}"
             data-hours="${course.hours}"
             data-price="${course.price}"
             data-free="${course.free ? "1" : "0"}"
             data-rating="${course.rating}"
             data-students="${course.students}"
             data-title="${title.toLowerCase()}">
          <div class="course-card" onclick="khOpen(${index})">
            <div class="course-image">
              <img src="${course.img}" alt="" class="img-fluid">
              ${course.free ? '<div class="course-badge badge-free">Mien phi</div>' : ""}
              <div class="course-price">${money(course.price)}</div>
            </div>
            <div class="course-content">
              <div class="course-meta"><span class="category">${category}</span><span class="level">${escapeHtml(course.status)}</span></div>
              <h3>${title}</h3>
              <p>${description}</p>
              <div class="course-stats">
                <div class="stat"><i class="bi bi-clock"></i><span>${course.hours} gio</span></div>
                <div class="stat"><i class="bi bi-people"></i><span>${course.students} hoc vien</span></div>
                <div class="rating">${stars(course.rating)}<span>${course.rating}</span></div>
              </div>
              <div class="instructor-info">
                <span class="instructor-name">${teacher}</span>
              </div>
              <a href="chonkhoahoc.html?course=${encodeURIComponent(course.slug)}" class="btn-course" onclick="event.stopPropagation()">Dang ky</a>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function textKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function checkedLabels(group) {
    if (!group) return { all: true, labels: [] };
    const labels = Array.from(group.querySelectorAll(".filter-checkbox"));
    const checked = labels.filter(label => label.querySelector("input").checked);
    if (!checked.length || checked.includes(labels[0])) return { all: true, labels: [] };
    return {
      all: false,
      labels: checked.map(label => textKey(label.textContent))
    };
  }

  function matchesTextFilter(filter, value) {
    if (filter.all) return true;
    const normalized = textKey(value);
    return filter.labels.some(label => normalized.includes(label) || label.includes(normalized));
  }

  function sortCourses() {
    const row = document.querySelector(".courses-grid .row");
    if (!row) return;
    const value = document.getElementById("sortSelect").value || "popular";
    const cards = Array.from(row.querySelectorAll(".course-col"));
    cards.sort((a, b) => {
      if (value === "price-asc") return Number(a.dataset.price || 0) - Number(b.dataset.price || 0);
      if (value === "price-desc") return Number(b.dataset.price || 0) - Number(a.dataset.price || 0);
      if (value === "duration-asc") return Number(a.dataset.hours || 0) - Number(b.dataset.hours || 0);
      if (value === "newest") return String(b.dataset.courseId || "").localeCompare(String(a.dataset.courseId || ""));
      return Number(b.dataset.students || 0) - Number(a.dataset.students || 0);
    });
    cards.forEach(card => row.appendChild(card));
    const empty = document.getElementById("no-result-msg");
    if (empty) row.appendChild(empty);
  }

  window.filterCourses = function() {
    const query = textKey(document.getElementById("searchInput").value || "");
    const groups = Array.from(document.querySelectorAll(".filter-group"));
    const category = checkedLabels(groups[0]);
    const level = checkedLabels(groups[1]);
    const duration = checkedLabels(groups[2]);
    const fee = checkedLabels(groups[3]);
    let visible = 0;

    document.querySelectorAll(".course-col").forEach(card => {
      const haystack = `${card.dataset.title || ""} ${card.dataset.category || ""} ${card.dataset.level || ""}`;
      const hours = Number(card.dataset.hours || 0);
      const isFree = card.dataset.free === "1";
      const durationOk = duration.all || duration.labels.some(label => {
        if (label.includes("duoi")) return hours < 5;
        if (label.includes("5 20")) return hours >= 5 && hours <= 20;
        if (label.includes("tren")) return hours > 20;
        return true;
      });
      const feeOk = fee.all || fee.labels.some(label => {
        if (label.includes("mien phi")) return isFree;
        if (label.includes("co phi")) return !isFree;
        return true;
      });
      const show = (!query || textKey(haystack).includes(query))
        && matchesTextFilter(category, haystack)
        && matchesTextFilter(level, haystack)
        && durationOk
        && feeOk;
      card.style.display = show ? "" : "none";
      if (show) visible += 1;
    });

    const row = document.querySelector(".courses-grid .row");
    if (row) {
      let empty = document.getElementById("no-result-msg");
      if (!empty) {
        empty = document.createElement("div");
        empty.id = "no-result-msg";
        empty.className = "col-12";
        empty.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-search" style="font-size:32px;display:block;margin-bottom:10px;color:#ccc"></i>Khong tim thay khoa hoc phu hop.</div>';
        row.appendChild(empty);
      }
      empty.style.display = visible === 0 ? "" : "none";
    }
    sortCourses();
  };

  function bindControls() {
    document.getElementById("searchInput").addEventListener("input", window.filterCourses);
    document.getElementById("sortSelect").addEventListener("change", window.filterCourses);
    document.querySelectorAll(".filter-checkbox input").forEach(input => {
      input.addEventListener("change", function() {
        const group = input.closest(".filter-group");
        const labels = Array.from(group.querySelectorAll(".filter-checkbox input") || []);
        const all = labels[0];
        if (input === all && input.checked) labels.slice(1).forEach(item => { item.checked = false; });
        if (input !== all && input.checked && all) all.checked = false;
        if (input !== all && labels.slice(1).every(item => !item.checked) && all) all.checked = true;
        window.filterCourses();
      });
    });
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value;
  }

  window.khOpen = function(index) {
    const course = courses[index];
    if (!course) return;
    const image = document.getElementById("kh-img");
    if (image) image.src = course.img;
    setText("kh-cat", course.level);
    setText("kh-lvl", course.status);
    setText("kh-title", course.title);
    setText("kh-short", course.description);
    setText("kh-inst-name", course.teacher);
    setHtml("kh-stars-sm", stars(course.rating));
    setText("kh-rating-sm", course.rating);
    setText("kh-rcount-sm", `(${course.students} hoc vien)`);
    setText("kh-desc", course.description);
    setHtml("kh-skills", '<div class="text-muted">Noi dung chi tiet duoc cap nhat boi quan tri vien trong database.</div>');
    setHtml("kh-reqs", '<li>Dang nhap tai khoan hoc vien</li>');
    setHtml("kh-curr", '<div class="text-muted">Lo trinh bai hoc se hien thi sau khi giao vien upload va admin duyet.</div>');
    setHtml("kh-revs", '<div class="text-muted">Chua co danh gia.</div>');
    const modal = document.getElementById("khModal");
    if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
  };

  ready(async function() {
    const row = document.querySelector(".courses-grid .row");
    if (row) row.innerHTML = '<div class="col-12"><div class="text-center py-5 text-muted">Dang tai khoa hoc...</div></div>';
    try {
      const data = await getJson("/api/public/courses?status=active");
      courses = (data.courses || []).map(normalize);
      window.khData = courses;
      renderCourses();
      bindControls();
      window.filterCourses();
    } catch (error) {
      if (row) row.innerHTML = `<div class="col-12"><div class="text-center py-5 text-muted">${escapeHtml(error.message)}</div></div>`;
    }
  });
})();
