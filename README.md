# ValeSense-API

Sistema de monitoramento agrícola com API REST, PostgreSQL e três áreas web. A API usa Node.js, Express, TypeScript e Prisma; o frontend é HTML, CSS e JavaScript estáticos.

## Arquitetura

```text
ValeSense/
├── backend/                 # API TypeScript/Express, Prisma e testes
│   ├── prisma/              # Schema e migrações oficiais
│   ├── src/
│   └── tests/
│       └── security/        # Verificações HTTP/IDOR/OTP manuais
├── frontend/                # Apenas páginas e recursos client-side
│   ├── administrador/
│   ├── analista-de-dados/
│   ├── produtor-exportador/
│   └── shared/              # Ícones e scripts comuns
├── scripts/                 # Inicialização, servidor estático e verificações
├── tests/verification/      # Scripts e snapshots de QA preservados
└── docs/
    ├── security/            # Auditorias, inventário e modelo de ameaças
    └── README_MUDANCAS_E_BANCO.md
```

O schema e a migração de referência são os de `backend/prisma/`. A antiga cópia de `frontend/prisma/` usava tipos PostgreSQL incompatíveis com essa migração (`UUID`/`Decimal` em vez de `TEXT`/`DOUBLE PRECISION`); ela foi retirada, sem executar alterações no banco. Antes de migrar um banco existente, confirme que ele corresponde ao schema oficial e faça backup.

## Requisitos

- Node.js 20 LTS ou superior e npm.
- PostgreSQL acessível pela máquina.

## Configuração e execução

### Backend

No PowerShell:

```powershell
Set-Location .\backend
npm ci
Copy-Item .env.example .env
```

Edite `backend/.env` e configure `DATABASE_URL` com o banco correto. Em seguida, para um banco novo:

```powershell
npm run db:generate
npm run db:migrate:deploy
npm run local
```

`npm run local` gera segredos de desenvolvimento vazios, compila e inicia a API. Para usar `npm run dev`, preencha `JWT_SECRET` e `OTP_ENCRYPTION_KEY` manualmente em `backend/.env`. Para um banco existente, revise o histórico de migrações antes de aplicar qualquer comando; não marque nem aplique migrações sem conferir o estado real do banco. A inicialização não executa `db push` nem migrações automaticamente.

Alternativamente, na raiz, `.\scripts\iniciar.ps1` instala dependências se necessário, gera segredos locais quando estão vazios, compila e inicia a API. Ele não configura credenciais do PostgreSQL nem aplica migrações.

### Frontend

Em outro terminal, na raiz:

```powershell
node .\scripts\serve-frontend.mjs
```

Abra <http://localhost:5500>. O servidor estático serve somente `frontend/`; a API roda em <http://localhost:3333>. O CORS padrão permite `localhost:5500`, `127.0.0.1:5500` e `localhost:5173`. Ajuste `CORS_ORIGIN` em `backend/.env` ao usar outras origens.

Rotas de entrada:

- Analista: `/analista-de-dados/Login/Login.html`
- Administrador: `/administrador/Login/Login.html`
- Cadastro do analista: `/analista-de-dados/Cadastre-se/Cadastre-se.html`
- Produtor/exportador: encaminhado pelo login conforme o perfil

## Variáveis de ambiente

O modelo completo está em [backend/.env.example](backend/.env.example). Variáveis principais:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL; mantenha credenciais privadas. |
| `JWT_SECRET` | Segredo de sessão, com pelo menos 16 caracteres. |
| `OTP_ENCRYPTION_KEY` | Chave Base64 de 32 bytes para cifrar segredos OTP; preserve-a entre reinicializações em produção. |
| `OTP_STORE` | `prisma` para persistência; `memory` somente em desenvolvimento/testes. |
| `CORS_ORIGIN` | Origens web permitidas, separadas por vírgula. |
| `PORT`, `NODE_ENV`, `TRUST_PROXY` | Porta, ambiente e configuração de proxy confiável. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opcionalmente criam o administrador inicial quando as três estão configuradas. |
| `THINGSPEAK_CHANNEL_ID`, `THINGSPEAK_POLL_SECONDS` | Canal público opcional e intervalo de consulta. O ID do canal não é uma chave secreta. |

`npm run local` cria `backend/.env` se não existir e, fora de produção, gera `JWT_SECRET` e `OTP_ENCRYPTION_KEY` quando vazios. Em produção, configure ambos os segredos explicitamente e preserve `OTP_ENCRYPTION_KEY` entre reinicializações. Não coloque segredos no frontend. `frontend/google-maps-config.js` não contém chave; uma chave de mapas fornecida pelo navegador deve ter restrição por referrer e não é um segredo de servidor.

## Banco de dados e autenticação

O schema oficial está em `backend/prisma/schema.prisma`. Em banco novo, `npm run db:migrate:deploy` aplica as migrações versionadas. A aplicação usa PostgreSQL e não sincroniza schemas automaticamente.

O login exige verificação em duas etapas: no primeiro acesso, configure TOTP e guarde os códigos de recuperação; nos seguintes, use o código atual ou um código de recuperação de uso único. Segredos OTP são cifrados e códigos de recuperação são armazenados como hashes. A configuração requer `OTP_ENCRYPTION_KEY`.

O controle de propriedade limita o produtor/exportador aos próprios dados; o analista tem leitura global auditada, sem permissão para alterar recursos de terceiros; ações globais do administrador são registradas. Documentação técnica e auditorias estão em [docs/security/](docs/security/).

## Testes e verificações

```powershell
Set-Location .\backend
npm test
npm run check
npm run build
npm run db:validate
Set-Location ..
node .\scripts\check-links.mjs
node .\scripts\verify-http.mjs  # com frontend e API já iniciados
```

Os testes automatizados de propriedade e OTP não exigem banco. Os roteiros de integração em `backend/tests/security/` precisam de uma API e banco de teste; leia [COMO_RODAR.md](docs/security/testing/COMO_RODAR.md) antes de executá-los. Os scripts e snapshots de QA foram preservados em `tests/verification/`, incluindo `producer-before/` como referência anterior, não como fonte em produção.

## Integrações e limitações

- ThingSpeak lê feeds públicos; canais privados precisam de uma integração própria com credenciais no backend.
- Mapas incorporados e dados do Open-Meteo dependem de internet.
- O link de recuperação de senha é impresso no terminal apenas em desenvolvimento quando `DEV_LOG_RESET_LINK=true`; envio de e-mail não está configurado.
- O comando de sensor altera o status registrado no ValeSense, não comanda um dispositivo físico.
