document.querySelector("#resetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.target.querySelector("button");
  button.disabled = true;
  try {
    const result = await ValeSenseApi.request("auth/reset-password", {
      method: "POST", auth: false,
      body: JSON.stringify({ token: new URLSearchParams(location.search).get("token"), password: event.target.password.value }),
    });
    document.querySelector("#message").textContent = result.message;
    event.target.hidden = true;
  } catch (error) { document.querySelector("#message").textContent = error.message; }
  finally { button.disabled = false; }
});
