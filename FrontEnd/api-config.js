// A API e as páginas compartilham o servidor; Live Server continua suportado.
window.VALESENSE_APP_URL = new URL("./", document.currentScript.src).href;
window.VALESENSE_API_URL = window.VALESENSE_API_URL ||
  (location.port === "3333" ? "/api" : `${location.protocol}//${location.hostname}:3333/api`);
