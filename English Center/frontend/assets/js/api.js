(function() {
  "use strict";

  const TOKEN_KEY = "ec_auth_token";
  const USER_KEY = "ec_current_user";

  async function request(path, options) {
    if (window.location.protocol === "file:") {
      throw new Error("Backend is not running. Open the site through npm start.");
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

    contact(payload) {
      return request("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    },

    logout() {
      return request("/api/auth/logout", { method: "POST" }).finally(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      });
    }
  };
})();
