/* ============================================================
   后端接口封装 — 统一鉴权、响应解析与错误处理
   ============================================================ */

const API_BASE = "http://localhost:8080/api";
const TOKEN_KEY = "pbl_token";
const USER_KEY = "pbl_user";

function apiError(message, code) {
  const err = new Error(message || "请求失败");
  err.code = code;
  return err;
}

function buildQuery(query) {
  if (!query) return "";
  const parts = [];
  Object.keys(query).forEach((k) => {
    const v = query[k];
    if (v === undefined || v === null || v === "") return;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

const api = {
  /** 未经授权时的回调，由 app.js 注入 */
  onUnauthorized: null,

  getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (e) {
      return null;
    }
  },

  setSession(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * 统一请求：自动携带 token，解析 {code,message,data}
   * code !== 0 时抛出带 code 的 Error
   */
  async request(path, options) {
    const opts = options || {};
    const method = opts.method || "GET";
    const headers = {};
    const token = this.getToken();
    if (token) headers.Authorization = "Bearer " + token;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(API_BASE + path + buildQuery(opts.query), {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
    } catch (e) {
      throw apiError("网络请求失败，请确认后端服务（http://localhost:8080）已启动", 0);
    }

    let payload = null;
    try {
      payload = await res.json();
    } catch (e) {
      payload = null;
    }

    const isLogin = path === "/auth/login";
    if (res.status === 401 || (payload && payload.code === 401)) {
      if (!isLogin) {
        this.clearSession();
        if (typeof this.onUnauthorized === "function") this.onUnauthorized();
      }
      throw apiError((payload && payload.message) || "登录已失效，请重新登录", 401);
    }

    if (!res.ok) {
      throw apiError((payload && payload.message) || "请求失败（HTTP " + res.status + "）",
        payload && payload.code != null ? payload.code : res.status);
    }
    if (!payload) {
      throw apiError("响应解析失败", 500);
    }
    if (payload.code !== 0) {
      throw apiError(payload.message || "请求失败", payload.code);
    }
    return payload.data;
  },

  async login(username, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    this.setSession(data.token, data.user);
    return data.user;
  },

  async me() {
    const user = await this.request("/auth/me");
    this.setSession(this.getToken(), user);
    return user;
  },

  async logout() {
    this.clearSession();
  },
};
