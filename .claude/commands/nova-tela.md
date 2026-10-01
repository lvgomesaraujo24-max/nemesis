---
description: Planeja e cria uma tela nova do Nemesis seguindo a arquitetura do projeto
argument-hint: <o que a tela faz e para quem (treinador ou aluna)>
---

Quero uma tela nova no Nemesis: $ARGUMENTS

Siga esta ordem e pare no passo 2 para eu aprovar:

1. Leia `CLAUDE.md`, as §3 e §4 do `docs/CEREBRO-NEMESIS.md` e as skills `nemesis-visual` (sempre), `nemesis-banco` (se precisar de dado novo) e `nemesis-regras` (se tiver conta).
2. Me mostre um plano curto:
   - em qual arquivo a tela fica (arquivo existente ou novo em `js/`) e a rota (`#/...`);
   - quais componentes de `js/util.js` e classes de `css/app.css` vai reusar;
   - quais tabelas lê e grava; se precisar de coluna ou tabela nova, qual `supabase/atualizacao-N.sql`;
   - como fica no modo demonstração;
   - o nome que aparece no menu (vocabulário do app).
3. Depois do meu ok, implemente. Arquivo novo em `js/` entra em `ARQUIVOS` no `sw.js`.
4. Rode `node ferramentas/checar.mjs`, abra a tela no navegador (celular e computador) e me diga o que testou.
5. Atualize `docs/CEREBRO-NEMESIS.md` (rotas, arquivos, banco ou regra) se mudou algo.
