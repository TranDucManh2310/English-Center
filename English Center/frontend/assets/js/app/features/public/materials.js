(function() {
  "use strict";

  let materials = [];
  let currentTab = "all";

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

  function isVideo(item) {
    return item.type === "lesson" || Boolean(item.videoUrl);
  }

  function isDocument(item) {
    return item.type === "document" || item.type === "exam" || Boolean(item.documentUrl);
  }

  function textKey(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function filteredMaterials() {
    if (currentTab === "all") return materials;
    return materials.filter(item => {
      const haystack = textKey(`${item.courseName || ""} ${item.title || ""} ${item.description || ""}`);
      return haystack.includes(textKey(currentTab));
    });
  }

  function renderDocuments(items) {
    const docs = items.filter(isDocument);
    if (!docs.length) {
      return '<div class="section-label"><i class="bi bi-file-earmark-pdf"></i>Tai lieu</div><div class="text-muted mb-5">Chua co tai lieu duoc duyet.</div>';
    }
    const rows = docs.map(item => {
      const url = item.documentUrl || "#";
      const title = escapeHtml(item.title);
      return `
        <div class="col-lg-6 pdf-item" data-title="${title.toLowerCase()}" data-type="pdf">
          <div class="pdf-card" style="display:flex;align-items:center;padding:15px;border:1px solid #ddd;border-radius:10px;margin-bottom:15px;position:relative;">
            <div class="pdf-icon" style="font-size:2rem;color:#e84444;margin-right:15px;"><i class="bi bi-file-earmark-pdf-fill"></i></div>
            <div class="pdf-info" style="flex-grow:1;">
              <h6 style="margin-bottom:0;font-size:0.9rem;font-weight:bold;">${title}</h6>
              <small class="text-muted">${escapeHtml(item.courseName || "Khong gan khoa hoc")} &middot; <span class="pdf-badge badge-free">Da duyet</span></small>
            </div>
            <div class="pdf-actions">
              <a href="${escapeHtml(url)}" class="btn-dl btn btn-sm btn-danger" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Mo</a>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return `<div class="section-label"><i class="bi bi-file-earmark-pdf"></i>Tai lieu</div><div class="row g-3 mb-5" id="pdf-grid">${rows}</div>`;
  }

  function renderVideos(items) {
    const videos = items.filter(isVideo);
    if (!videos.length) {
      return '<div class="section-label"><i class="bi bi-play-circle"></i>Video bai giang</div><div class="text-muted mb-5">Chua co video duoc duyet.</div>';
    }
    const cards = videos.map(item => {
      const title = escapeHtml(item.title);
      const url = escapeHtml(item.videoUrl || "");
      return `
        <div class="col-md-4 video-item" data-title="${title.toLowerCase()}" data-type="video">
          <div class="video-card">
            <div class="video-thumb" onclick="openVideo('${title.replace(/'/g, "\\'")}','${url.replace(/'/g, "\\'")}')">
              <div class="play-btn"><i class="bi bi-play-fill"></i></div>
              <span class="video-duration">Da duyet</span>
            </div>
            <div class="video-body">
              <h6>${title}</h6>
              <div class="video-teacher"><i class="bi bi-person-fill"></i>${escapeHtml(item.teacherName || "Giao vien")}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");
    return `<div class="section-label"><i class="bi bi-play-circle"></i>Video bai giang<span class="cbadge">${videos.length} video</span></div><div class="row g-3 mb-5">${cards}</div>`;
  }

  function renderFlashcards() {
    return '<div class="section-label"><i class="bi bi-layers"></i>Flashcard</div><div class="text-muted mb-5">Flashcard se hien thi khi co API va du lieu trong database.</div>';
  }

  function render() {
    const target = document.getElementById("tab-content-area");
    if (!target) return;
    const items = filteredMaterials();
    target.innerHTML = renderDocuments(items) + renderVideos(items) + renderFlashcards();
  }

  window.switchTab = function(tab, btn) {
    currentTab = tab || "all";
    document.querySelectorAll(".topic-tabs .nav-link").forEach(button => button.classList.remove("active"));
    if (btn) btn.classList.add("active");
    render();
  };

  window.handleSearch = function() {
    const query = (document.getElementById("searchInput").value || "").toLowerCase().trim();
    const type = document.getElementById("filterType").value || "all";
    let shown = 0;
    document.querySelectorAll(".pdf-item, .video-item").forEach(item => {
      const matchesQuery = !query || (item.getAttribute("data-title") || "").includes(query);
      const matchesType = type === "all" || item.getAttribute("data-type") === type;
      const show = matchesQuery && matchesType;
      item.style.display = show ? "" : "none";
      if (show) shown += 1;
    });
    const notice = document.getElementById("searchNotice");
    const text = document.getElementById("searchNoticeText");
    if (notice && text) {
      notice.style.display = query || type !== "all" ? "block" : "none";
      text.textContent = `Tim thay ${shown} ket qua`;
    }
  };

  window.resetSearch = function() {
    const search = document.getElementById("searchInput");
    const type = document.getElementById("filterType");
    const level = document.getElementById("filterLevel");
    if (search) search.value = "";
    if (type) type.value = "all";
    if (level) level.value = "all";
    const notice = document.getElementById("searchNotice");
    if (notice) notice.style.display = "none";
    document.querySelectorAll(".pdf-item, .video-item").forEach(item => { item.style.display = ""; });
  };

  window.openPreview = function(file, title) {
    const viewer = document.getElementById("pdfViewer");
    const previewTitle = document.getElementById("previewTitle");
    const fileName = document.getElementById("previewFileName");
    const download = document.getElementById("previewDownload");
    if (previewTitle) previewTitle.textContent = `Xem truoc: ${title}`;
    if (fileName) fileName.textContent = title;
    if (viewer) viewer.src = file;
    if (download) download.href = file;
    const modal = document.getElementById("previewModal");
    if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
  };

  window.openVideo = function(title, url) {
    const titleElement = document.getElementById("videoModalTitle");
    const body = document.getElementById("videoModalBody");
    if (titleElement) titleElement.textContent = title;
    if (body) {
      if (url) {
        body.innerHTML = url.includes("youtube.com") || url.includes("youtu.be")
          ? `<iframe src="${url}?autoplay=1&rel=0" width="100%" height="100%" style="aspect-ratio:16/9;display:block;" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen></iframe>`
          : `<video controls autoplay style="width:100%;aspect-ratio:16/9;display:block;background:#000;"><source src="${url}" type="video/mp4">Trinh duyet khong ho tro video.</video>`;
      } else {
        body.innerHTML = '<div class="video-placeholder py-5"><i class="bi bi-play-circle"></i><p style="font-size:.88rem;color:#ccc;margin:.5rem 0 .8rem;">Video chua co duong dan.</p></div>';
      }
    }
    const modal = document.getElementById("videoModal");
    if (modal && window.bootstrap) new bootstrap.Modal(modal).show();
  };

  ready(async function() {
    const target = document.getElementById("tab-content-area");
    if (target) target.innerHTML = '<div class="text-center py-5 text-muted">Dang tai tai lieu...</div>';
    try {
      const data = await getJson("/api/public/materialslimit=200");
      materials = data.materials || [];
      render();
      const statItems = document.querySelectorAll(".stat-item .num");
      if (statItems[0]) statItems[0].textContent = String(materials.filter(isVideo).length);
      if (statItems[1]) statItems[1].textContent = String(materials.filter(isDocument).length);
      if (statItems[2]) statItems[2].textContent = "0";
    } catch (error) {
      if (target) target.innerHTML = `<div class="text-center py-5 text-muted">${escapeHtml(error.message)}</div>`;
    }

    const videoModal = document.getElementById("videoModal");
    if (videoModal) {
      videoModal.addEventListener("hide.bs.modal", function() {
        const body = document.getElementById("videoModalBody");
        if (body) body.innerHTML = '<div class="video-placeholder"><i class="bi bi-play-circle"></i></div>';
      });
    }
  });
})();
