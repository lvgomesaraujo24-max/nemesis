---
description: Checklist para publicar uma versão nova do Nemesis
---

Prepare a publicação da branch atual:

1. `git status` e `git diff main...HEAD --stat`: liste o que muda para as alunas e para o treinador.
2. Rode `node ferramentas/checar.mjs`. Se falhar, pare e corrija.
3. Suba o número de `VERSAO` no `sw.js` (ex.: `nemesis-v6` → `nemesis-v7`), se ainda não subiu nesta branch.
4. Se existe `supabase/atualizacao-N.sql` nova nesta branch, confira se o README explica quando rodar.
5. Rode o subagente `revisor` sobre a diferença para a `main`. Se mexeu em banco, login ou dados de saúde, sugira também `/security-review`.
6. Faça commit e push da branch e me passe o resumo para o pull request. Não faça merge na `main`: eu faço depois de ler o review.
7. Me lembre do que fazer depois do merge: rodar o SQL novo no Supabase (se houver) antes de avisar as alunas.
