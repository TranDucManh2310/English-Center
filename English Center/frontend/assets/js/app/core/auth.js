(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const USER_KEY = "ec_current_user";
  const DASHBOARDS = {
    admin: "admin.html",
    teacher: "dashboard_giaovien.html",
    student: "dashboard_hocsinh_new.html"
  };

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function getToken() {
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

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function roleHome(role) {
    return DASHBOARDS[role] || DASHBOARDS.student;
  }

  function currentPage() {
    const path = window.location.pathname.split("/").pop().toLowerCase();
    return path || "index.html";
  }

  function requiredRoleForPage() {
    const page = currentPage();
    if (page === "admin.html") return ["admin"];
    if (page === "dashboard_giaovien.html") return ["teacher", "admin"];
    if (page === "dashboard_hocsinh_new.html") return ["student", "admin"];
    return null;
  }

  function fallbackRoleLabel(role) {
    return { admin: "Admin", teacher: "Giao vien", student: "Hoc sinh" }[role] || "Tai khoan";
  }

  function renderHeader(user) {
    const actions = document.querySelectorAll(".header-actions");
    if (!actions.length) return;

    actions.forEach(container => {
      if (user && user.role) {
        container.innerHTML = [
          '<span class="ec-auth-user" style="display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(16,110,234,.16);border-radius:6px;background:#fff;color:#2c3e50;font-size:13px;font-weight:700;white-space:nowrap;">',
            '<i class="bi bi-person-check"></i>',
            '<span style="max-width:150px;overflow:hidden;text-overflow:ellipsis;">', escapeHtml(user.name || user.email || fallbackRoleLabel(user.role)), '</span>',
            '<small style="color:#106eea;font-weight:800;text-transform:uppercase;font-size:10px;">', escapeHtml(fallbackRoleLabel(user.role)), '</small>',
          '</span>',
          '<a class="btn-dangnhap" href="', roleHome(user.role), '"><i class="bi bi-speedometer2 me-1"></i>Dashboard</a>',
          '<button type="button" class="btn-getstarted ec-auth-logout"><i class="bi bi-box-arrow-right me-1"></i>Dang xuat</button>'
        ].join("");
        const logout = container.querySelector(".ec-auth-logout");
        if (logout) logout.addEventListener("click", signOut);
      } else {
        const hasLogin = container.querySelector('a[href*="dangnhap.html"]');
        const hasRegister = container.querySelector('a[href*="dangky.html"]');
        if (!hasLogin || !hasRegister) {
          container.innerHTML = [
            '<a class="btn-dangnhap" href="dangnhap.html"><i class="bi bi-person me-1"></i>Dang Nhap</a>',
            '<a class="btn-getstarted" href="dangky.html"><i class="bi bi-pencil-square me-1"></i>Dang Ky</a>'
          ].join("");
        }
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  async function refreshUser() {
    if (window.location.protocol === "file:" || !getToken()) return getUser();

    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false || !data.user) throw new Error(data.message || "Unauthorized");
      setUser(data.user);
      return data.user;
    } catch (error) {
      clearSession();
      return null;
    }
  }

  async function signOut() {
    const token = getToken();
    clearSession();
    renderHeader(null);

    if (window.location.protocol !== "file:" && token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }

    const protectedRoles = requiredRoleForPage();
    if (protectedRoles) window.location.href = "dangnhap.html";
  }

  function goDashboard() {
    const user = getUser();
    window.location.href = roleHome(user && user.role);
  }

  function enforceRole(user) {
    const roles = requiredRoleForPage();
    if (!roles) return;
    if (!user || !roles.includes(user.role)) {
      window.location.href = user && user.role ? roleHome(user.role) : "dangnhap.html";
    }
  }

  window.EC_AUTH = {
    getToken,
    getUser,
    setUser,
    clearSession,
    roleHome,
    goDashboard,
    logout: signOut,
    refreshUser
  };

  function startPresenceSocket() {
    if (window.location.protocol === "file:" || !getToken() || window.__ecPresenceSocket) return;
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const page = `${window.location.pathname}${window.location.search}`;
    const ws = new WebSocket(`${scheme}://${window.location.host}/ws/online?token=${encodeURIComponent(getToken())}&page=${encodeURIComponent(page)}`);
    window.__ecPresenceSocket = ws;

    function sendPresence() {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "presence",
          page: `${window.location.pathname}${window.location.search}`,
          visible: document.visibilityState
        }));
      }
    }

    ws.addEventListener("open", sendPresence);
    ws.addEventListener("message", event => {
      try {
        const data = JSON.parse(event.data || "{}");
        window.dispatchEvent(new CustomEvent("ec:online", { detail: data }));
      } catch {}
    });
    ws.addEventListener("close", () => {
      window.__ecPresenceSocket = null;
      setTimeout(startPresenceSocket, 3000);
    });

    setInterval(sendPresence, 25000);
    document.addEventListener("visibilitychange", sendPresence);
  }

  ready(async function() {
    renderHeader(getUser());
    const user = await refreshUser();
    renderHeader(user);
    enforceRole(user);
    startPresenceSocket();
  });
})();
