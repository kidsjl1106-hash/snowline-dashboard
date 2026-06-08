(function () {
  const config = window.SNOWLINE_AUTH_CONFIG || {};
  const apiUrl = String(config.apiUrl || "").trim();
  const sessionKey = config.sessionKey || "snowline_dashboard_session";
  const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
  let session = null;

  window.SnowlineAuth = {
    required: true,
    getSession: () => session,
    request: authenticatedRequest,
    invalidate: invalidateSession,
    logout,
  };

  init();

  function init() {
    renderAuthShell();

    const saved = readSession();
    if (saved?.token && apiUrl) {
      verify(saved.token);
      return;
    }

    showLogin();
  }

  function renderAuthShell() {
    if (document.querySelector("#auth-screen")) return;

    const screen = document.createElement("section");
    screen.id = "auth-screen";
    screen.className = "auth-screen";
    screen.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <img src="./assets/logo.png?v=2026060701" alt="SNOWLINE" />
          <div>
            <strong>SNOWLINE</strong>
            <span>Sales Dashboard</span>
          </div>
        </div>
        <h1>계정 로그인</h1>
        <p>회원가입 후 임성진 관리자 승인이 완료된 계정만 대시보드에 접근할 수 있습니다.</p>
        <div class="auth-tabs">
          <button id="auth-login-tab" class="active" type="button">로그인</button>
          <button id="auth-signup-tab" type="button">회원가입</button>
        </div>
        <div id="auth-form-slot"></div>
      </div>
    `;
    document.body.prepend(screen);

    document.querySelector("#auth-login-tab").addEventListener("click", showLogin);
    document.querySelector("#auth-signup-tab").addEventListener("click", showSignup);
  }

  function showLogin() {
    setActiveTab("login");
    const slot = document.querySelector("#auth-form-slot");
    slot.innerHTML = `
      <form class="auth-form" id="auth-login-form">
        <label>
          계정 이름
          <input name="userId" autocomplete="username" required />
        </label>
        <label>
          비밀번호
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <div class="auth-message" id="auth-message"></div>
        <button type="submit">로그인</button>
      </form>
    `;
    document.querySelector("#auth-login-form").addEventListener("submit", handleLogin);
  }

  function showSignup() {
    setActiveTab("signup");
    const slot = document.querySelector("#auth-form-slot");
    slot.innerHTML = `
      <form class="auth-form" id="auth-signup-form">
        <label>
          계정 이름
          <input name="userId" autocomplete="username" required />
        </label>
        <label>
          본인 이름
          <input name="displayName" autocomplete="name" required />
        </label>
        <label>
          비밀번호
          <input name="password" type="password" autocomplete="new-password" minlength="10" required />
        </label>
        <label>
          비밀번호 확인
          <input name="confirmPassword" type="password" autocomplete="new-password" minlength="10" required />
        </label>
        <div class="auth-message" id="auth-message"></div>
        <button type="submit">회원가입 요청</button>
      </form>
    `;
    document.querySelector("#auth-signup-form").addEventListener("submit", handleSignup);
  }

  function setActiveTab(mode) {
    document.querySelector("#auth-login-tab")?.classList.toggle("active", mode === "login");
    document.querySelector("#auth-signup-tab")?.classList.toggle("active", mode === "signup");
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector("#auth-message");
    setMessage(message, "로그인 확인 중입니다.");

    try {
      const result = await callApi({
        action: "login",
        userId: form.get("userId"),
        password: form.get("password"),
      });
      saveAndUnlock(result);
    } catch (error) {
      setMessage(message, error.message || "로그인에 실패했습니다.");
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.querySelector("#auth-message");
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setMessage(message, "비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setMessage(message, "회원가입 요청 중입니다.");

    try {
      await callApi({
        action: "signup",
        userId: form.get("userId"),
        displayName: form.get("displayName"),
        password,
      });
      setMessage(message, "가입 요청이 접수되었습니다. 임성진 관리자 승인 후 로그인할 수 있습니다.", "success");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(message, error.message || "회원가입 요청에 실패했습니다.");
    }
  }

  async function verify(token) {
    try {
      const result = await callApi({ action: "me", token });
      saveAndUnlock({ token, user: result.user });
    } catch (error) {
      invalidateSession(error.message || "세션이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  async function authenticatedRequest(payload) {
    if (!session?.token) throw new Error("로그인이 필요합니다.");
    return callApi({ ...payload, token: session.token });
  }

  async function callApi(payload) {
    if (!apiUrl) {
      throw new Error("로그인 서버 주소가 아직 설정되지 않았습니다. auth-config.js의 apiUrl을 입력해주세요.");
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (error) {
      throw new Error("로그인 서버 응답을 읽을 수 없습니다.");
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "요청을 처리하지 못했습니다.");
    }

    return result;
  }

  function saveAndUnlock(result) {
    session = {
      token: result.token,
      user: result.user,
      expiresAt: getSessionExpiresAt(result.token),
    };
    writeSession(session);
    document.body.classList.remove("auth-locked");
    document.body.classList.add("auth-ready");
    document.body.classList.toggle("auth-admin", session?.user?.role === "admin");
    document.querySelector("#auth-screen")?.remove();
    renderUserBar();
    window.dispatchEvent(new CustomEvent("snowline:authenticated", { detail: session.user }));
  }

  function renderUserBar() {
    document.querySelector("#auth-user-bar")?.remove();
    const bar = document.createElement("div");
    bar.id = "auth-user-bar";
    bar.className = "auth-user-bar";

    const name = document.createElement("span");
    name.textContent = session?.user?.displayName || session?.user?.userId || "사용자";
    bar.appendChild(name);

    const logoutButton = document.createElement("button");
    logoutButton.className = "auth-logout-button";
    logoutButton.type = "button";
    logoutButton.textContent = "로그아웃";
    logoutButton.addEventListener("click", logout);
    bar.appendChild(logoutButton);
    document.body.appendChild(bar);
  }

  function logout() {
    session = null;
    removeStoredSession();
    window.location.reload();
  }

  function invalidateSession(message = "세션이 만료되었습니다. 다시 로그인해주세요.") {
    session = null;
    removeStoredSession();
    document.body.classList.add("auth-locked");
    document.body.classList.remove("auth-ready", "auth-admin");
    document.querySelector("#auth-user-bar")?.remove();
    renderAuthShell();
    showLogin();
    setMessage(document.querySelector("#auth-message"), message);
  }

  function readSession() {
    try {
      const saved = JSON.parse(localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey) || "null");
      if (!saved?.token) return null;
      if (isStoredSessionExpired(saved)) {
        removeStoredSession();
        return null;
      }
      return saved;
    } catch (error) {
      return null;
    }
  }

  function writeSession(value) {
    const serialized = JSON.stringify(value);
    try {
      localStorage.setItem(sessionKey, serialized);
      sessionStorage.removeItem(sessionKey);
    } catch (error) {
      sessionStorage.setItem(sessionKey, serialized);
    }
  }

  function removeStoredSession() {
    localStorage.removeItem(sessionKey);
    sessionStorage.removeItem(sessionKey);
  }

  function isStoredSessionExpired(value) {
    return value.expiresAt && Date.now() > Number(value.expiresAt);
  }

  function getSessionExpiresAt(token) {
    const fallback = Date.now() + sessionDurationMs;
    try {
      const encoded = String(token || "").split(".")[0];
      const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
      const payload = JSON.parse(atob(padded));
      return payload.exp ? Math.min(Number(payload.exp), fallback) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function setMessage(target, message, type = "error") {
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("success", type === "success");
  }
})();
