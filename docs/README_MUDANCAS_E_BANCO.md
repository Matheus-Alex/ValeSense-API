# Mudanças recentes e dados do ValeSense

Este documento complementa o [README principal](../README.md). Ele resume as mudanças de interface pedidas durante os ajustes e indica quais áreas já têm suporte de banco de dados e quais poderiam ser ampliadas.

## Mudanças realizadas

- **Autenticação:** os guards das áreas Administrador, Analista e Produtor foram mantidos, e o login do Administrador e do Analista segue o fluxo de duas etapas (OTP).
- **Administrador:** a navegação e os cards foram ajustados; Sensores mantém seus arquivos de estilo e lógica próprios; Mercado e Alertas usam estilos isolados para evitar herdar versões antigas; os títulos dos cards ganharam mais contraste.
- **Analista:** os gráficos de máxima e mínima preservam a série de leituras; o Dashboard ganhou um resumo circular de umidade com ícone de nuvem e tratamento de ausência/atraso de dados; títulos de cards e ícones receberam destaque.
- **Produtor:** os títulos dos cards ganharam destaque; “Início” passou a “Home”, com ícone; Propriedades e talhões, Safra, Mercado e Alertas receberam ícones nos títulos. Os links dessas telas foram atualizados para evitar abrir conteúdo em cache.
- **Documentação:** o README principal foi organizado; este arquivo separado reúne o histórico da interface e um mapa das oportunidades de persistência.

## O que já pode ser armazenado

O projeto já tem PostgreSQL, Prisma e modelos para os dados abaixo. A persistência depende de configurar e executar a API com um banco disponível; mudar a interface, por si só, não grava dados.

| Área | Modelos existentes | Uso previsto |
| --- | --- | --- |
| Contas e acesso | `Usuario`, `TokenRecuperacao`, `LogAcesso`, `CodigoRecuperacao` | Contas, recuperação de senha, eventos de acesso e segundo fator (segredo OTP cifrado e códigos de recuperação com hash). |
| Preferências | `Configuracao` | Preferências por usuário, como tema ou ajustes que sejam ligados à API. |
| Propriedades e sensores | `Propriedade`, `Talhao`, `Sensor` | Propriedades, talhões e sensores associados. |
| Leituras | `LeituraClimatica` | Temperatura, umidade, sensor e data/hora; alimenta consultas históricas e gráficos. |
| Mercado | `DadoMercado` | Produto, preço, demanda, unidade e data de referência. |
| Safra e alertas | `Previsao`, `Alerta`, `Notificacao` | Períodos previstos, alertas relacionados e notificações por usuário. |

As rotas da API já incluem operações para usuários, propriedades, sensores, leituras climáticas, dados de mercado, previsões e alertas. Os painéis podem apresentar informações reais quando essas rotas estiverem conectadas a uma base configurada e populada.

## O que poderia ser acrescentado ao banco

Esses itens exigem ampliar o schema e criar ou ajustar rotas da API antes de a interface poder salvá-los:

- **Mapas:** latitude e longitude para propriedades e talhões. Hoje `Propriedade.localizacao` é texto; não substitui coordenadas geográficas.
- **Clima ampliado:** campos de velocidade/direção do vento e precipitação nas leituras, caso os sensores forneçam esses valores.
- **Histórico de previsões externas:** guardar previsões do Open-Meteo, horário da consulta, local e origem, em vez de somente exibi-las enquanto a página está aberta.
- **Produção e colheita:** produto cultivado, volume previsto e volume efetivamente colhido por talhão e safra. O modelo atual `Previsao` registra tipo, período e confiança, mas não volume.
- **Exportações realizadas:** registros de embarques, quantidades, destino, datas e situação. O schema atual não tem histórico de exportações.

Antes de incluir esses dados, defina quais campos são necessários, revise as relações e prepare uma migração com backup. Não aplique `prisma db push` em produção sem revisão.

## Configuração do banco

Para configurar PostgreSQL, variáveis de ambiente e inicializar a API, siga as instruções de [configuração e execução no README principal](../README.md#configuração-e-execução). O schema e as migrações oficiais estão em [backend/prisma/](../backend/prisma/).

Durante a consolidação, foi encontrada uma divergência incompatível entre as cópias do schema: `backend/prisma/schema.prisma` usa IDs `String` e valores `Float`, alinhados à migração inicial com colunas `TEXT` e `DOUBLE PRECISION`; a cópia removida de `backend/prisma/schema.prisma` usava `@db.Uuid`, `Decimal` e um cliente gerado em outro diretório. A migração OTP daquela cópia também declara uma chave estrangeira `UUID`, incompatível com a migração inicial oficial. Por isso, foi mantida a estrutura do backend e nenhuma migração foi executada durante a reorganização. Bancos existentes devem ser verificados e respaldados antes de qualquer migração.

As mudanças de interface listadas neste documento não criam nem alteram tabelas. A exibição de dados reais depende da API, de `DATABASE_URL` válido e, para leituras vindas de sensores, da configuração do ThingSpeak quando aplicável.
