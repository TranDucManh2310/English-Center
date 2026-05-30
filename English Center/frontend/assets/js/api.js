(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const USER_KEY = "ec_current_user";

  async function request(path, options) {
    if (window.location.protocol === "file:") {
      throw new Error("He thong chua san sang. Vui long mo trang qua dia chi local.");
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options && options.headers ? options.headers : {})
      }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.message || "Yeu cau khong thanh cong.");
    }
    return data;
  }

  function saveSession(payload) {
    if (payload.token) {
      localStorage.setItem(TOKEN_KEY, payload.token);
    }
    if (payload.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    }
    return payload;
  }

  window.EC_API = {
    login(email, password) {
      return request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      }).then(saveSession);
    },

    register(payload) {
      return request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then(saveSession);
    },

    me() {
      return request("/api/auth/me", { method: "GET" }).then(saveSession);
    },

    contact(payload) {
      return request("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    dashboard(role, params) {
      const search = new URLSearchParams(params || {});
      const query = search.toString();
      return request(`/api/dashboard/${role}${query ? `?${query}` : ""}`, {
        method: "GET"
      });
    },

    courses(params) {
      const search = new URLSearchParams(params || {});
      const query = search.toString();
      return request(`/api/courses${query ? `?${query}` : ""}`, {
        method: "GET"
      });
    },

    users(params) {
      const search = new URLSearchParams(params || {});
      const query = search.toString();
      return request(`/api/users${query ? `?${query}` : ""}`, {
        method: "GET"
      });
    },

    createUser(payload) {
      return request("/api/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    updateUser(id, payload) {
      return request(`/api/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    },

    deleteUser(id) {
      return request(`/api/users/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
    },

    createCourse(payload) {
      return request("/api/courses", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    enrollments(params) {
      const search = new URLSearchParams(params || {});
      const query = search.toString();
      return request(`/api/enrollments${query ? `?${query}` : ""}`, {
        method: "GET"
      });
    },

    enroll(payload) {
      return request("/api/enrollments", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    saveLessonProgress(payload) {
      return request("/api/lesson-progress", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    saveExamResult(payload) {
      return request("/api/exam-results", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    logout() {
      return request("/api/auth/logout", { method: "POST" }).catch(() => ({ ok: true })).finally(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      });
    }
  };
})();
