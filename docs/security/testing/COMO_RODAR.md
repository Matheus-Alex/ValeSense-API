# Como rodar os testes de segurança

Os testes automatizados de propriedade e OTP usam repositórios em memória e não conectam ao banco. Na raiz:

```powershell
Set-Location .\backend
npm ci
npm test
```

O arquivo `backend/tests/security/dados-exemplo.mjs` imprime fixtures sintéticas e não grava no banco:

```powershell
node .\backend\tests\security\dados-exemplo.mjs
```

## Testes HTTP de IDOR

Os testes HTTP usam uma base descartável de teste já preparada com contas e recursos sintéticos. Nunca use dados reais. Configure os valores de teste apenas na sessão do PowerShell:

```powershell
$env:BASE_URL = "http://localhost:3333"
$env:TOKEN_PRODUTOR_A = "<token de teste>"
$env:SENSOR_A_ID = "<id do sensor A>"
$env:SENSOR_B_ID = "<id do sensor B>"
$env:TALHAO_B_ID = "<id do talhão B>"
```

`idor-antes.mjs` documenta o comportamento da versão-base; `idor-depois.mjs` verifica a política atual. O teste pós-correção confirma que o dono acessa seus recursos e que IDs de terceiros retornam 404, inclusive em `sensorId` e `talhaoId`. Os scripts alteram dados da base de teste, portanto use somente uma base descartável.

```powershell
node .\backend\tests\security\idor-antes.mjs
node .\backend\tests\security\idor-depois.mjs
```

## Testes HTTP de OTP

Use uma conta descartável sem OTP e configure credenciais somente no terminal:

```powershell
$env:BASE_URL = "http://localhost:3333"
$env:OTP_TEST_EMAIL = "<email fictício>"
$env:OTP_TEST_PASSWORD = "<senha da conta de teste>"
$env:OTP_TEST_WINDOW = "1"
node .\backend\tests\security\otp-antes.mjs
node .\backend\tests\security\otp-depois.mjs
```

O teste `depois` ativa OTP na conta e não o desativa; use uma conta descartável nova a cada execução. Os scripts não devem imprimir nem registrar segredos, tokens, códigos ou senhas.

## Configuração da API

Configure `backend/.env` a partir de [backend/.env.example](../../../backend/.env.example), com um `DATABASE_URL` PostgreSQL de teste. A migração inicial oficial está em [backend/prisma/migrations/](../../../backend/prisma/migrations/). Confira o schema e o histórico antes de qualquer migração; não use `db push` em produção.
