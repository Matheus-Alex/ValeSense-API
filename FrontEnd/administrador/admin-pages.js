(() => {
  const update = () => {
    if (document.body.dataset.page !== "readings") return;
    const hash = location.hash;
    const title = document.querySelector(".page-title");
    title.textContent =
      hash === "#home"
        ? "Dashboard climático"
        : hash === "#sensores"
          ? "Sensores monitorados"
          : hash === "#registrar"
            ? "Registrar leitura"
            : "Histórico de leituras";
    document.querySelectorAll("#content > section").forEach((section) => {
      const label = section.querySelector("h2")?.textContent || "";
      section.hidden =
        hash === "#sensores"
          ? label !== "Sensores"
          : hash === "#registrar"
            ? label !== "Registrar leitura"
            : !hash
              ? label !== "Leituras dos últimos 7 dias"
              : false;
    });
  };
  new MutationObserver(update).observe(
    document.querySelector("#content") || document.createElement("div"),
    { childList: true },
  );
  window.addEventListener("hashchange", update);
  document
    .getElementById("scrollTopBtn")
    ?.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  update();
})();
