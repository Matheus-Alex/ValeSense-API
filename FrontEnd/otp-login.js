(() => {
  function post(endpoint, input) {
    return window.ValeSenseApi.request(`auth/${endpoint}`, {
      method: "POST",
      auth: false,
      body: JSON.stringify(input),
    });
  }

  window.ValeSenseOtpLogin = async (email, password) => {
    const { challengeToken, enrollmentRequired } = await post("login", { email, password });
    if (!challengeToken) throw new Error("A API não iniciou a verificação em duas etapas.");
    const setup = enrollmentRequired ? await post("otp/setup", { challengeToken }) : null;
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <form>
        <h2 id="otp-dialog-title">Verificação em duas etapas</h2>
        <p class="otp-setup" hidden>Escaneie o QR Code no aplicativo autenticador.</p>
        <img class="otp-qr" alt="QR Code do autenticador" width="200" height="200" hidden>
        <p><label>Código <input name="code" inputmode="numeric" autocomplete="one-time-code" required autofocus></label></p>
        <p class="otp-recovery"><label><input name="useRecovery" type="checkbox"> Usar código de recuperação</label></p>
        <p role="alert"></p>
        <button type="submit">Confirmar</button>
        <button type="button">Cancelar</button>
      </form>`;
    if (setup) {
      const qr = dialog.querySelector(".otp-qr");
      qr.src = setup.qrCode;
      qr.hidden = false;
      dialog.querySelector(".otp-setup").hidden = false;
      dialog.querySelector(".otp-recovery").hidden = true;
    }

    dialog.setAttribute("aria-labelledby", "otp-dialog-title");
    document.body.append(dialog);
    dialog.showModal();
    const form = dialog.querySelector("form");
    const submit = form.querySelector('button[type="submit"]');
    const cancel = form.querySelector('button[type="button"]');
    const message = form.querySelector('[role="alert"]');
    form.elements.useRecovery.onchange = () => {
      form.elements.code.inputMode = form.elements.useRecovery.checked ? "text" : "numeric";
    };
    return new Promise((resolve, reject) => {
      let session;
      cancel.onclick = () => dialog.close();
      dialog.oncancel = (event) => {
        if (submit.disabled) event.preventDefault();
      };
      dialog.onclose = () => {
        dialog.remove();
        if (session) resolve(session);
        else reject(new Error("Verificação cancelada. Entre novamente para continuar."));
      };
      form.onsubmit = async (event) => {
        event.preventDefault();
        const code = form.elements.code.value.trim();
        const useRecovery = form.elements.useRecovery.checked;
        submit.disabled = true;
        cancel.disabled = true;
        message.textContent = "";
        try {
          const result = setup
            ? await post("otp/activate", { challengeToken, code })
            : await post("login/otp", { challengeToken, [useRecovery ? "recoveryCode" : "code"]: code });
          session = result;
          if (!setup) {
            dialog.close();
            return;
          }
          const title = document.createElement("h2");
          title.id = "otp-dialog-title";
          title.textContent = "Guarde seus códigos de recuperação";
          const codes = document.createElement("pre");
          codes.textContent = result.recoveryCodes.join("\n");
          const done = document.createElement("button");
          done.textContent = "Continuar";
          done.onclick = () => dialog.close();
          dialog.replaceChildren(title, codes, done);
          done.focus();
        } catch (error) {
          message.textContent = error.message;
          submit.disabled = false;
          cancel.disabled = false;
          form.elements.code.select();
        }
      };
    });
  };
})();
