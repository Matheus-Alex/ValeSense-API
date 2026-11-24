# Segurança ValeSense

Esta pasta reúne a documentação técnica e os registros de auditoria existentes. O código atual da API está em `backend/src/`; schema e migrações em `backend/prisma/`. Os scripts executáveis de teste foram organizados em `backend/tests/security/`, com instruções em [testing/COMO_RODAR.md](testing/COMO_RODAR.md).

## Controles atuais

- Login com TOTP, segredos cifrados e códigos de recuperação armazenados como hashes.
- Limites de tentativas por IP e por usuário nos fluxos de autenticação.
- Controle de propriedade com resposta uniforme 404 para recursos ausentes ou pertencentes a terceiros.
- Leitura global auditada para o perfil Analista; alterações a recursos de terceiros permanecem negadas.
- Registro de acesso administrativo e de tentativas bloqueadas.

## Banco e ambientes

O schema oficial está em [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma). A cópia antiga de schema/migração localizada no frontend tinha tipos PostgreSQL incompatíveis e foi removida após a comparação; veja o [resumo no README principal](../../README.md#arquitetura). Nenhuma migração foi executada durante a reorganização. Confirme e faça backup de bancos existentes antes de aplicar qualquer migração.

`OTP_STORE=prisma` requer o schema compatível e uma chave estável `OTP_ENCRYPTION_KEY`; `OTP_STORE=memory` é somente para desenvolvimento e testes. Nunca inclua segredos, QR Codes, tokens ou códigos OTP em relatórios ou evidências.

As validações automatizadas de código e os comandos atuais estão no [README principal](../../README.md#testes-e-verificações). Os relatórios e inventários desta pasta podem conter observações históricas da auditoria; resultados de execução não foram refeitos como parte da reorganização.
