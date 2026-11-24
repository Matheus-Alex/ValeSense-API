# Validação de segurança do painel ValeSense

## Evidências

Nunca inclua nas evidências o QR Code, segredos do autenticador, JWTs, senhas ou códigos de recuperação.

## Ambiente e verificação

Os resultados descritos abaixo são registros da validação anterior e não foram refeitos durante a reorganização. Para reproduzir o teste integrado atual, prepare uma base PostgreSQL descartável compatível com `backend/prisma/`, configure a mesma `DATABASE_URL` no ambiente da API e do teste, inicie a API e execute:

```powershell
Set-Location .\backend
$env:NODE_ENV = "test"
npm run test:integration
```

O teste cria contas e dados sintéticos e remove os cadastros ao final. Ele só deve ser executado contra uma base descartável. Para iniciar a API, use `.\scripts\iniciar.ps1` a partir da raiz depois de configurar `backend/.env`.

- OTP. O teste confirma que a senha correta retorna um desafio sem sessão, que o desafio não dá acesso à API, que códigos ausentes, inválidos, vencidos e repetidos são recusados e que o código de recuperação funciona uma vez.
- IDOR. O teste confirma que uma conta diferente recebe `404` ao acessar leituras, alterar o status ou solicitar um comando no sensor da conta dona. A conta dona pode fazer essas operações. Administradores têm acesso operacional explícito e auditado.
- Comando. O ValeSense atualiza o estado do sensor no PostgreSQL. A API atual não entrega um comando a um dispositivo físico. Se a demonstração exigir atuação física, a integração precisa ser implementada e testada com o dispositivo do PI.

Para registrar a entrega, execute o mesmo cenário na versão histórica autorizada do próprio PI e na versão protegida, em ambiente de teste. Guarde os resultados com a data, o cenário e a versão testada. Se a versão histórica já bloqueava uma operação ou não oferecia uma rota, registre isso como estava. O teste integrado cobre a versão protegida.

## Resultado da verificação local

A migração foi testada em um esquema PostgreSQL isolado, criado a partir da estrutura do ValeSense. A autenticação sem segundo fator ficou sem sessão, o desafio sozinho retornou `401` em rota protegida e o teste confirmou a expiração, a reutilização e a recuperação de uso único. A API retornou `404` nas três operações com a conta sem vínculo com o sensor e `200` para a conta dona.
