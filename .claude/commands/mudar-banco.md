---
description: Cria a próxima supabase/atualizacao-N.sql (tabela, coluna, política ou função) com RLS
argument-hint: <o que precisa mudar no banco>
---

Mudança no banco do Nemesis: $ARGUMENTS

1. Use a skill `nemesis-banco` e leia `docs/banco.md`.
2. Descubra o próximo número olhando `supabase/atualizacao-*.sql`. Não edite arquivos existentes.
3. Escreva o SQL idempotente, com RLS e políticas para toda tabela nova e verificação de quem chama em toda função `security definer`.
4. Ajuste `js/api.js` (mensagem de `traduzErro`) e `js/demo.js` se a tela depender do dado novo.
5. Atualize `README.md` (Atualizações do banco) e `docs/banco.md`.
6. Rode `node ferramentas/checar.mjs`.
7. Termine me dizendo, em passos simples, o que rodar no SQL Editor do Supabase e em que ordem, e responda: "uma aluna consegue ver dado de outra com essa mudança?".
