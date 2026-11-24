(() => {
  const scriptUrl = document.currentScript?.src;
  if (!scriptUrl) return;
  const adminRoot = new URL(".", scriptUrl);
  const current = new URL(window.location.href);
  const groups = [
    {
      title: "Minha conta",
      links: [
        ["Visão geral", "Home/Home.html", "Home.svg"],
        [
          "Sensores",
          "Sensores/Sensores.html?v=20261121-sensores-v3",
          "Alerta.svg",
        ],
        ["Registros de acesso", "Registros/Registros.html", "Dashboard.svg"],
      ],
    },
    {
      title: "Acompanhamento",
      links: [
        ["Dashboard climático", "Leituras/Leituras.html#home", "Dashboard.svg"],
        [
          "Sensores monitorados",
          "Leituras/Leituras.html#sensores",
          "Alerta.svg",
        ],
        ["Mapas", "Mapas/Mapas.html", "Maps.svg"],
        ["Frutas", "Frutas/Frutas.html", "Fruta.svg"],
        ["Resumo operacional", "Home/Home.html", "Lupa.svg"],
        ["Safra", "Previsoes/Previsoes.html", "Sol.svg"],
        [
          "Mercado",
          "Mercado/Mercado.html?v=20261121-mercado-alertas-v1",
          "Loja.svg",
        ],
        [
          "Alertas",
          "Alertas/Alertas.html?v=20261121-mercado-alertas-v1",
          "Alerta.svg",
        ],
      ],
    },
  ];
  const nav = document.createElement("nav");
  nav.className = "admin-sidebar-nav";
  nav.setAttribute("aria-label", "Navegação administrativa");
  for (const group of groups) {
    const section = document.createElement("div");
    section.className = "admin-sidebar-group";
    const heading = document.createElement("h2");
    heading.className = "admin-sidebar-heading";
    heading.textContent = group.title;
    section.append(heading);
    for (const [label, path, icon] of group.links) {
      const link = document.createElement("a");
      const target = new URL(path, adminRoot);
      link.href = target.href;
      link.className = "nav-item";
      if (icon) {
        const image = document.createElement("img");
        image.className = "nav-icon";
        image.src = new URL(`../shared/assets/${icon}`, adminRoot).href;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        link.append(image);
      }
      const labelElement = document.createElement("span");
      labelElement.textContent = label;
      link.append(labelElement);
      const pathMatches =
        target.pathname.toLowerCase() === current.pathname.toLowerCase();
      const hashMatches = target.hash && target.hash === current.hash;
      const isActive =
        pathMatches &&
        (target.hash
          ? hashMatches
          : !current.hash ||
            !group.links.some(([, siblingPath]) => {
              const sibling = new URL(siblingPath, adminRoot);
              return (
                sibling.pathname.toLowerCase() ===
                  current.pathname.toLowerCase() &&
                sibling.hash === current.hash
              );
            }));
      if (isActive) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
      section.append(link);
    }
    nav.append(section);
  }
  const sidebar = document.querySelector(".pe-sidebar, .sidebar");
  if (sidebar) {
    sidebar.replaceChildren(nav);
    sidebar.classList.add("admin-sidebar");
  }
})();

window.addEventListener("hashchange", () => {
  const links = [...document.querySelectorAll(".admin-sidebar-nav a")];
  const current = new URL(location.href);
  links.forEach((link) => {
    const target = new URL(link.href);
    const active =
      target.pathname === current.pathname && target.hash === current.hash;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
});
