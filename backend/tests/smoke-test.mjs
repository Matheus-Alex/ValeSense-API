import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generate } from "otplib";
import client from "../generated/index.js";
assert.equal(process.env.NODE_ENV, "test", "Use NODE_ENV=test e a conexão de teste do ValeSense.");
const prisma = new client.PrismaClient();
const base = "http://127.0.0.1:" + (process.env.PORT || 3333);
const suffix = randomUUID();
const emails = ["analyst","producer","other","admin"].map(role => role+"-"+suffix+"@example.test");
const password = "Integration-" + suffix;
let marketId;
async function request(route, {token, method="GET", body, status=200} = {}) {
  const response = await fetch(base+route, {
    method, headers: {"Content-Type":"application/json", ...(token && {Authorization:"Bearer "+token})},
    ...(body && {body:JSON.stringify(body)}),
  });
  const result = await response.json().catch(()=>null);
  assert.equal(response.status,status,method+" "+route);
  return result;
}
const post = (route, body, status = 200) => request("/api/auth/" + route, {method:"POST", body, status});
async function enroll(email, verifyOtp = false) {
  const challenge = await post("login", {email, password}, 202);
  assert.equal(challenge.token, undefined);
  assert.equal(challenge.enrollmentRequired, true);
  const {challengeToken} = challenge;
  await request("/api/auth/me", {token:challengeToken, status:401});
  const {otpauthUrl, qrCode} = await post("otp/setup", {challengeToken});
  assert(qrCode.startsWith("data:image/png;base64,"));
  const secret = new URL(otpauthUrl).searchParams.get("secret");
  const epoch = Math.floor(Date.now() / 1000);
  const code = await generate({secret, epoch});
  const session = await post("otp/activate", {challengeToken, code});
  if (verifyOtp) {
    const login = await post("login", {email, password}, 202);
    assert.equal(login.enrollmentRequired, false);
    const input = {challengeToken: login.challengeToken};
    await post("login/otp", input, 401);
    const nextCode = await generate({secret, epoch:epoch + 30});
    const expired = await generate({secret, epoch:epoch - 120});
    const wrong = [code, nextCode, expired].includes("000000") ? "111111" : "000000";
    await post("login/otp", {...input, code:wrong}, 401);
    await post("login/otp", {...input, code:expired}, 401);
    assert((await post("login/otp", {...input, code:nextCode})).token);
    await post("login/otp", {...input, code:nextCode}, 401);
    const recovery = {...input, recoveryCode:session.recoveryCodes[0]};
    assert((await post("login/otp", recovery)).token);
    await post("login/otp", recovery, 401);
    console.log("OTP: senha sem sessão, código inválido, vencido e reutilizado bloqueados. Código válido e recuperação de uso único confirmados.");
  }
  return session.token;
}
try {
  const {parseFeed} = await import("../dist/modules/sensors/thingspeak.js");
  assert.equal(parseFeed({field1:"",field2:"50",created_at:new Date().toISOString()}),null);
  assert.equal(parseFeed({field1:"25",field2:"101",created_at:new Date().toISOString()}),null);
  assert.equal(parseFeed({field1:"25",field2:"50",created_at:"invalid"}),null);
  assert.equal(parseFeed({field1:"0",field2:"0",created_at:new Date().toISOString()}).temperatura,0);
  assert.equal((await request("/health")).database,"connected");
  for (const route of ["/.env","/src/server.ts","/package.json","/generated/index.js","/api/missing"]) {
    assert.equal((await fetch(base+route)).status,404);
  }
  await request("/api/sensors",{status:401});
  const {userRepository} = await import("../dist/modules/auth/user.repository.js");
  await userRepository.create({name:"Integration admin",email:emails[3],password,role:"ADMIN"});
  const admin = await enroll(emails[3]);
  await post("login",{email:emails[3],password:"wrong"},401);
  await request("/api/auth/register",{method:"POST",body:{name:"Integration analyst",email:emails[0],password},status:201});
  const {user:producer} = await request("/api/users",{token:admin,method:"POST",body:{name:"Integration producer",email:emails[1],password,role:"PRODUTOR_EXPORTADOR"},status:201});
  const {user:other} = await request("/api/auth/register",{method:"POST",body:{name:"Integration other",email:emails[2],password},status:201});
  await request("/api/users/"+other.id+"/role",{token:admin,method:"PATCH",body:{role:"PRODUTOR_EXPORTADOR"}});
  const otherToken = await enroll(emails[2]);
  const analyst = await enroll(emails[0]);
  const owner = await enroll(emails[1], true);
  await request("/api/users",{token:analyst,status:403});
  await request("/api/properties",{token:analyst,method:"POST",body:{},status:403});
  const {data:property} = await request("/api/properties",{token:owner,method:"POST",body:{nome:"Integration "+suffix,areaTotal:10,localizacao:"Teste"},status:201});
  assert.equal(property.usuarioId,producer.id);
  const {data:plot} = await request("/api/properties/"+property.id+"/plots",{token:owner,method:"POST",body:{nome:"Integration plot",area:5},status:201});
  const {sensor} = await request("/api/sensors",{token:admin,method:"POST",body:{talhaoId:plot.id,identificador:"test-"+suffix},status:201});
  await request("/api/weather-data",{token:admin,method:"POST",body:{sensorId:sensor.id,temperatura:27,umidade:62},status:201});
  const readings = await request("/api/weather-data?horas=24&sensorId="+sensor.id,{token:owner});
  assert.equal(readings.data.length,1); assert.equal(readings.data[0].temperatura,27);
  assert.equal(readings.data[0].sensor.status,"ATIVO");
  await request("/api/weather-data?horas=24&sensorId="+sensor.id,{token:otherToken,status:404});
  const statusRoute = "/api/sensors/"+sensor.id+"/status";
  const commandRoute = "/api/sensors/"+sensor.id+"/comandos";
  await request(statusRoute,{token:otherToken,method:"PATCH",body:{status:"MANUTENCAO"},status:404});
  await request(commandRoute,{token:otherToken,method:"POST",body:{comando:"DESLIGAR"},status:404});
  assert.equal((await request(statusRoute,{token:owner,method:"PATCH",body:{status:"MANUTENCAO"}})).sensor.status,"MANUTENCAO");
  assert.equal((await request(commandRoute,{token:owner,method:"POST",body:{comando:"LIGAR"}})).sensor.status,"ATIVO");
  console.log("IDOR: leitura, alteração de status e comando bloqueados para outra conta e permitidos para o dono.");
  assert(!(await request("/api/properties",{token:otherToken})).data.some(p=>p.id===property.id));
  assert(!(await request("/api/sensors",{token:otherToken})).data.some(s=>s.id===sensor.id));
  await request("/api/weather-data?horas=bad",{token:owner,status:400});
  await request("/api/users/me/configuration",{token:owner,method:"PUT",body:{unidadeTemp:"c",frequenciaAtualizacao:60}});
  assert.equal((await request("/api/users/me/configuration",{token:owner})).data.frequenciaAtualizacao,60);
  const {data:market} = await request("/api/market-data",{token:analyst,method:"POST",body:{produto:"Integration "+suffix,preco:12,dataReferencia:new Date().toISOString()},status:201});
  marketId=market.id;
  assert((await request("/api/market-data",{token:owner})).data.some(r=>r.id===marketId));
  const {data:forecast} = await request("/api/forecasts",{token:analyst,method:"POST",body:{talhaoId:plot.id,tipo:"COLHEITA",dataInicio:new Date().toISOString(),dataFim:new Date(Date.now()+86400000).toISOString(),confianca:90},status:201});
  assert((await request("/api/forecasts",{token:owner})).data.some(r=>r.talhaoId===plot.id));
  await request("/api/forecasts/alerts",{token:owner});
  await request("/api/forecasts/alerts",{token:analyst,method:"POST",body:{previsaoId:forecast.id,tipo:"TESTE",mensagem:"Integration test",nivel:"BAIXO"},status:201});
  const {data:notifications} = await request("/api/users/me/notifications",{token:owner});
  const notification = notifications.find(n=>n.alerta.previsao.talhao.id===plot.id);
  assert(notification);
  await request("/api/users/me/notifications/"+notification.id+"/read",{token:otherToken,method:"PATCH",status:404});
  await request("/api/users/me/notifications/"+notification.id+"/read",{token:owner,method:"PATCH"});
  assert((await request("/api/users/me/notifications",{token:owner})).data.find(n=>n.id===notification.id).lida);
  const {requestPasswordReset,resetPassword} = await import("../dist/modules/auth/password-reset.service.js");
  const reset = await requestPasswordReset(emails[0]);
  assert(reset);
  assert(await resetPassword(reset.token,password+"new"));
  assert.equal(await resetPassword(reset.token,password+"again"),false);
  await post("login",{email:emails[0],password:password+"new"},202);
  await request("/api/users/"+producer.id+"/status",{token:admin,method:"PATCH",body:{status:"INACTIVE"}});
  await request("/api/auth/me",{token:owner,status:401});
  console.log("PASS: saúde, arquivos privados, cadastro sem CPF, login, permissões, propriedades, talhões, sensores, leituras, preferências, mercado, previsões e recuperação de senha.");
} finally {
  if (marketId) await prisma.dadoMercado.deleteMany({where:{id:marketId}});
  await prisma.usuario.deleteMany({where:{email:{in:emails}}});
  await prisma.$disconnect();
}

