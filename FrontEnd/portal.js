(() => {
const main = document.querySelector("main");
const message = document.querySelector("#message");
const content = document.querySelector("#content");
const api = window.ValeSenseApi;
const page = document.body.dataset.page;
let user;
const node = (tag, text) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
function table(title, columns, rows) {
  const section = node("section"); section.append(node("h2", title));
  if (!rows.length) section.append(node("p", "Nenhum registro encontrado."));
  else {
    const t = node("table"), head = node("tr");
    columns.forEach(([label]) => head.append(node("th", label)));
    t.append(head);
    rows.forEach(item => { const tr = node("tr"); columns.forEach(([, value]) => tr.append(node("td", value(item) ?? "—"))); t.append(tr); });
    section.append(t);
  }
  content.append(section);
}
function form(title, fields, save, values = {}) {
  const section = node("section"), f = node("form");
  section.append(node("h2", title)); section.append(f);
  for (const [name, label, type = "text", options] of fields) {
    const l = node("label", label);
    const input = node(options ? "select" : "input"); input.name = name;
    if (options) options.forEach(([value, text]) => input.add(new Option(text, value)));
    else { input.type = type; if (type === "number") input.step = "any"; }
    input.required = !label.includes("(opcional)");
    if (type === "password") input.minLength = 8;
    if (values[name] !== undefined) input.value = values[name];
    l.append(input); f.append(l);
  }
  const button = node("button", "Salvar"); button.type = "submit"; f.append(button);
  f.addEventListener("submit", async event => {
    event.preventDefault(); button.disabled = true; message.textContent = "";
    const input = Object.fromEntries(new FormData(f));
    fields.forEach(([name,, type]) => { if (type === "number") input[name] = Number(input[name]); });
    try { await save(input); message.textContent = "Salvo com sucesso."; await load(); }
    catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  content.append(section); return f;
}
const date = value => value ? new Date(value).toLocaleString("pt-BR") : "—";
async function load() {
  content.replaceChildren();
  if (page === "register") {
    form("Criar conta de analista", [["name","Nome"],["email","E-mail","email"],["document","CPF (opcional)"],["password","Senha","password"]], async input => {
      if (!input.document) delete input.document;
      await api.request("auth/register", { method:"POST", auth:false, body:JSON.stringify(input) });
      location.href = new URL("analista-de-dados/Login/Login.html", window.VALESENSE_APP_URL || location.origin).href;
    }); return;
  }
  if (page === "settings") {
    const { data } = await api.request("users/me/configuration");
    form("Perfil", [["name","Nome"],["document","CPF (opcional)"]], async input => {
      const result = await api.request("users/me", { method:"PATCH", body:JSON.stringify(input) });
      user = result.user; sessionStorage.setItem("valesense_user", JSON.stringify(user));
    }, user);
    form("Alterar senha", [["currentPassword","Senha atual","password"],["newPassword","Nova senha","password"]], input => api.request("users/me/password", {method:"PATCH",body:JSON.stringify(input)}));
    form("Preferências", [["unidadeTemp","Temperatura","text",[["c","Celsius"],["f","Fahrenheit"]]],["formatoExport","Exportação","text",[["csv","CSV"],["xlsx","XLSX"]]],["frequenciaAtualizacao","Atualização em segundos","number"]],
      input => api.request("users/me/configuration",{method:"PUT",body:JSON.stringify(input)}), {frequenciaAtualizacao:60,...data});
    return;
  }
  if (page === "properties") {
    const {data} = await api.request("properties");
    table("Propriedades",[["Nome",r=>r.nome],["Localização",r=>r.localizacao],["Área",r=>r.areaTotal+" "+r.unidadeArea],["Talhões",r=>r.talhoes.map(t=>t.nome).join(", ")]],data);
    if (user.role !== "ANALISTA") {
      const fields = [["nome","Nome"],["localizacao","Localização"],["areaTotal","Área em hectares","number"]];
      if (user.role === "ADMIN") {
        const {data:users} = await api.request("users");
        fields.push(["usuarioId","Proprietário","text",users.map(u=>[u.id,u.name+" ("+u.email+")"])]);
      }
      form("Cadastrar propriedade",fields,input=>api.request("properties",{method:"POST",body:JSON.stringify(input)}));
      if (data.length) form("Cadastrar talhão",[["propriedadeId","Propriedade","text",data.map(p=>[p.id,p.nome])],["nome","Nome"],["area","Área em hectares","number"]],
        ({propriedadeId,...input})=>api.request("properties/"+propriedadeId+"/plots",{method:"POST",body:JSON.stringify(input)}));
    } return;
  }
  if (page === "market") {
    const {data} = await api.request("market-data?dias=365");
    table("Mercado",[["Produto",r=>r.produto],["Data",r=>r.data],["Preço",r=>r.preco.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})],["Unidade",r=>r.unidadePreco],["Demanda",r=>r.demanda]],data);
    if (user.role !== "PRODUTOR_EXPORTADOR") form("Cadastrar preço",[["produto","Produto"],["preco","Preço","number"],["unidadePreco","Unidade (opcional)"],["demanda","Demanda (opcional)"],["dataReferencia","Data","datetime-local"]],
      input=>api.request("market-data",{method:"POST",body:JSON.stringify({...input,dataReferencia:new Date(input.dataReferencia).toISOString()})}));
    return;
  }
  if (page === "alerts") {
    const [{data:alerts},{data:notifications}] = await Promise.all([api.request("forecasts/alerts"),api.request("users/me/notifications")]);
    table("Alertas",[["Tipo",r=>r.tipo],["Mensagem",r=>r.mensagem],["Nível",r=>r.nivel],["Talhão",r=>r.previsao.talhao.nome]],alerts);
    table("Notificações",[["Título",r=>r.titulo],["Mensagem",r=>r.mensagem],["Data",r=>date(r.criadaEm)],["Lida",r=>r.lida?"Sim":"Não"]],notifications);
    const unread = notifications.filter(n=>!n.lida);
    if (unread.length) {
      const button = node("button","Marcar notificações como lidas");
      button.onclick = async () => {
        button.disabled = true;
        try { await Promise.all(unread.map(n=>api.request("users/me/notifications/"+n.id+"/read",{method:"PATCH"}))); await load(); }
        catch(error) { message.textContent=error.message; button.disabled=false; }
      };
      content.append(button);
    }
    if (user.role !== "PRODUTOR_EXPORTADOR") {
      const {data:forecasts} = await api.request("forecasts");
      if (forecasts.length) form("Criar alerta",[["previsaoId","Previsão","text",forecasts.map(f=>[f.id,f.tipo+" · "+f.talhao.nome])],["tipo","Tipo"],["mensagem","Mensagem"],["nivel","Nível","text",[["BAIXO","Baixo"],["MEDIO","Médio"],["ALTO","Alto"],["CRITICO","Crítico"]]]],
        input=>api.request("forecasts/alerts",{method:"POST",body:JSON.stringify(input)}));
    }
    return;
  }
  if (page === "users") {
    const {data} = await api.request("users");
    table("Usuários",[["Nome",r=>r.name],["E-mail",r=>r.email],["Perfil",r=>r.role],["Status",r=>r.status]],data);
    return;
  }
  if (page === "forecasts") {
    const {data} = await api.request("forecasts");
    table("Previsões",[["Tipo",r=>r.tipo],["Talhão",r=>r.talhao.nome],["Início",r=>date(r.dataInicio)],["Fim",r=>date(r.dataFim)],["Confiança",r=>r.confianca]],data);
    if (user.role !== "PRODUTOR_EXPORTADOR") {
      const {data:plots} = await api.request("sensors/plots");
      if (plots.length) form("Cadastrar previsão",[["talhaoId","Talhão","text",plots.map(t=>[t.id,t.nome])],["tipo","Tipo","text",[["COLHEITA","Colheita"],["EXPORTACAO","Exportação"]]],["dataInicio","Início","datetime-local"],["dataFim","Fim","datetime-local"],["confianca","Confiança (%)","number"]],
        input=>api.request("forecasts",{method:"POST",body:JSON.stringify({...input,dataInicio:new Date(input.dataInicio).toISOString(),dataFim:new Date(input.dataFim).toISOString()})}));
      else content.append(node("p","Cadastre uma propriedade e um talhão antes de criar previsões."));
    } return;
  }
  const [{data:sensors},{data:readings}] = await Promise.all([api.request("sensors"),api.request("weather-data?dias=7")]);
  table("Sensores",[["Identificador",r=>r.identificador],["Talhão",r=>r.talhao.nome],["Status",r=>r.status],["Temperatura",r=>r.ultimaLeitura?.temperatura],["Umidade",r=>r.ultimaLeitura?.umidade]],sensors);
  table("Leituras dos últimos 7 dias",[["Data",r=>date(r.timestamp)],["Sensor",r=>r.sensor.identificador],["Temperatura (°C)",r=>r.temperatura],["Umidade (%)",r=>r.umidade]],readings);
  if (user.role === "ADMIN" && sensors.length) form("Registrar leitura",[["sensorId","Sensor","text",sensors.map(s=>[s.id,s.identificador])],["temperatura","Temperatura (°C)","number"],["umidade","Umidade (%)","number"]],
    input=>api.request("weather-data",{method:"POST",body:JSON.stringify(input)}));
}
async function init() {
  if (page !== "register") {
    user = await window.ValeSenseSession.requireRole();
    if (!user) return;
    const area = user.role==="ADMIN"?"administrador":user.role==="ANALISTA"?"analista-de-dados":"produtor-exportador";
    const home = user.role==="ANALISTA"?"Dashboard/Dashboard.html":"Home/Home.html";
    const nav = (document.body.hasAttribute("data-admin-page") || document.body.hasAttribute("data-producer-page") || document.body.hasAttribute("data-analyst-settings")) ? document.createElement("nav") : document.querySelector("nav");
    [["Início",home],["Propriedades","Propriedades/Propriedades.html"],["Leituras","Leituras/Leituras.html"],["Mercado","Mercado/Mercado.html"],["Previsões","Previsoes/Previsoes.html"],["Alertas","Alertas/Alertas.html"],["Configurações","Configuracoes/Configuracoes.html"]].forEach(([label,path])=>{
      const a=node("a",label); a.href=new URL(area+"/"+path, window.ValeSenseSession.appRoot).href; nav.append(a);
    });
    const account = document.querySelector("#account"); if (account) account.textContent = user.name;
  }
  try { await load(); } catch(error) { message.textContent=error.message; }
}
init();
})();
