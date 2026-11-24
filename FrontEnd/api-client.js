(() => {
  const appRoot = new URL("./", document.currentScript.src);
  const apiUrl = (window.VALESENSE_API_URL || "/api").replace(/\/+$/, "");
  const destinations = {
    ADMIN: "administrador/Home/Home.html",
    ANALISTA: "analista-de-dados/Dashboard/Dashboard.html",
    PRODUTOR_EXPORTADOR: "produtor-exportador/Home/Home.html",
  };
  const currentArea = () => location.pathname.slice(appRoot.pathname.length).split("/")[0];
  const loginUrl = () => new URL(currentArea() === "administrador"
    ? "administrador/Login/Login.html" : "analista-de-dados/Login/Login.html", appRoot).href;
  const homeUrl = role => new URL(destinations[role] || "analista-de-dados/Login/Login.html", appRoot).href;
  function clear() {
    for (const storage of [sessionStorage, localStorage]) {
      storage.removeItem("valesense_token");
      storage.removeItem("valesense_user");
    }
  }
  function save(user, token) {
    if (!destinations[user?.role] || !token) throw new Error("A API não retornou uma sessão válida.");
    clear();
    sessionStorage.setItem("valesense_token", token);
    sessionStorage.setItem("valesense_user", JSON.stringify(user));
  }
  function logout() { clear(); location.replace(loginUrl()); }
  async function request(path, options = {}) {
    const { auth = true, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers);
    if (requestOptions.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = auth && sessionStorage.getItem("valesense_token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let response;
    try {
      response = await fetch(`${apiUrl}/${path.replace(/^\/+/, "")}`, {...requestOptions, headers});
    } catch { throw new Error("Não foi possível conectar à API ValeSense."); }
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.message || body?.error || "Não foi possível concluir a solicitação.");
      error.status = response.status;
      if (response.status === 401 && auth) logout();
      throw error;
    }
    return body;
  }
  async function requireRole() {
    if (!sessionStorage.getItem("valesense_token")) { logout(); return null; }
    try {
      const {user} = await request("auth/me");
      if (!user || !destinations[user.role]) { logout(); return null; }
      sessionStorage.setItem("valesense_user", JSON.stringify(user));
      const area = currentArea();
      const permitted = user.role === "ADMIN" ||
        (user.role === "ANALISTA" && area === "analista-de-dados") ||
        (user.role === "PRODUTOR_EXPORTADOR" && area === "produtor-exportador");
      if (!permitted) { location.replace(homeUrl(user.role)); return null; }
      return user;
    } catch(error) {
      if (error.status !== 401) {
        let notice = document.querySelector("[data-session-error]");
        if (!notice) {
          notice = document.createElement("p");
          notice.dataset.sessionError = "";
          notice.setAttribute("role", "alert");
          (document.querySelector("main") || document.body).prepend(notice);
        }
        notice.textContent = error.message;
      }
      return null;
    }
  }
  window.VALESENSE_APP_URL = appRoot.href;
  window.ValeSenseApi = {request};
  window.ValeSenseSession = {appRoot: appRoot.href, loginUrl, homeUrl, save, clear, logout, requireRole};
})();
