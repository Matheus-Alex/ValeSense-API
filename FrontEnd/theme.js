(function () {
  function atualizarBotoesTema() {
    const dark = document.documentElement.classList.contains('dark-theme');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-pressed', String(dark));
      const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro';
      button.setAttribute('aria-label', label);
      button.title = label;
      const icon = button.querySelector('[data-theme-icon]');
      if (icon) {
        icon.src = icon.src.replace(/(?:Lua|Sol)\.svg$/, dark ? 'Sol.svg' : 'Lua.svg');
        icon.dataset.themeReady = 'true';
      }
    });
    document.querySelectorAll('.logout-action').forEach((button) => {
      button.style.color = dark ? '#e59189' : '#a3433d';
    });
  }

  function adicionarBotaoChatbot() {
    const sidebars = document.querySelectorAll('.pe-sidebar, .layout > .sidebar');
    sidebars.forEach((sidebar) => {
      if (sidebar.classList.contains('admin-sidebar') ||
          sidebar.querySelector('.admin-nav, .admin-sidebar-nav') ||
          sidebar.querySelector('.chatbot-button')) {
        return;
      }

      const button = document.createElement('button');
      button.className = 'chatbot-button';
      button.type = 'button';
      button.disabled = true;
      button.title = 'Disponível em breve';
      button.setAttribute('aria-label', 'Chatbot, disponível em breve');
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg><span>Chatbot</span>';
      sidebar.append(button);
    });
  }

  const dark = localStorage.getItem('valesense_theme') === 'dark';
  document.documentElement.classList.toggle('dark-theme', dark);
  atualizarBotoesTema();
  document.addEventListener('DOMContentLoaded', () => {
    atualizarBotoesTema();
    adicionarBotaoChatbot();
  });

  window.applyTheme = function (enabled) {
    document.documentElement.classList.toggle('dark-theme', enabled);
    localStorage.setItem('valesense_theme', enabled ? 'dark' : 'light');
    atualizarBotoesTema();
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-theme-toggle]');
    if (button) window.applyTheme(!document.documentElement.classList.contains('dark-theme'));
  });
  document.addEventListener('click', (event) => {
    const logoutButton = event.target.closest('[data-logout]');
    if (!logoutButton) return;
    event.preventDefault();
    if (window.ValeSenseSession) { window.ValeSenseSession.logout(); return; }
    sessionStorage.removeItem('valesense_token');
    sessionStorage.removeItem('valesense_user');
    localStorage.removeItem('valesense_token');
    localStorage.removeItem('valesense_user');
    window.location.href = document.body.dataset.loginPath || '../Login/Login.html';
  });

})();
