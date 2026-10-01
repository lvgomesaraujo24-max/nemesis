# Nemesis · regras do projeto

App de consultoria de treino feminino. O treinador monta fichas, acompanha evolução, check-ins, avaliações e financeiro. A aluna treina pelo celular (PWA). Tudo em português do Brasil: código, comentários, commits e textos da tela.

Fonte única do projeto: `docs/CEREBRO-NEMESIS.md`. Antes de mudar qualquer coisa, leia a seção do assunto: status real e glossário (§0–1), arquitetura e mapa de arquivos (§3), rotas (§4), banco (§5), **regras de cálculo, que são contrato** (§6), segurança (§7), visual (§8) e convenções (§10). Decisões e o porquê delas: `docs/decisoes.md`. Não crie outro documento que repita esses assuntos: atualize o cérebro.

## Stack (não trocar sem registrar em docs/decisoes.md)
- **Front-end sem build**: HTML + JavaScript em módulos ES + [Preact + htm](lib/preact-htm.js) carregados de `lib/`. Nada de npm, bundler, TypeScript, JSX ou framework novo. O que está no repositório é exatamente o que roda.
- **Banco e login**: Supabase (Postgres + Auth + Realtime), acessado só por `js/api.js`.
- **Hospedagem**: GitHub Pages (branch `main`, pasta raiz). PWA com service worker em `sw.js`.
- **Visual**: `css/app.css` com variáveis em `:root`. Fontes locais em `lib/fontes/`.

## Comandos
- Rodar local: `python3 -m http.server 8000` na raiz e abrir http://localhost:8000
- Modo demonstração (sem banco): com `config.js` vazio o app usa `js/demo.js`. Para testar assim, esvazie os dois campos **localmente** e não faça commit disso.
- Checar antes de cada commit: `node ferramentas/checar.mjs` (sintaxe, lista do sw.js, imports, RLS, service_role)
- Publicar: merge na `main` + subir o número de `VERSAO` em `sw.js` (ex.: `nemesis-v10` → `nemesis-v11`). Sem isso os celulares continuam com a versão velha.
- Banco: rodar o `supabase/atualizacao-N.sql` novo no SQL Editor do Supabase (manual, ver skill `nemesis-banco`).

## Onde fica cada coisa
- `js/app.js` entrada, login e rotas por hash (`#/alunas/...`)
- `js/coach.js` e `js/aluna.js` telas de cada lado; `js/comum.js` o que os dois usam
- `js/util.js` datas, números, componentes base (`Modal`, `Campo`, `Abas`, `Estado`, `Vazio`, `toast`, `useCarregar`)
- `js/api.js` única porta para o banco (`api.q`, `api.ins`, `api.upd`, `api.ups`, `api.del`, `api.rpc`)
- `js/demo.js` imita a `api` com dados no navegador
- Regras de negócio: `js/util.js` (dobras), `js/musculos.js` (volume, tempo), `js/radar.js` (score), `js/relatorio.js` (Epley), `js/extras.js` (testes aeróbicos, metas), `js/motor.js` (regras dos formulários)
- `supabase/schema.sql` banco base; `supabase/atualizacao-N.sql` cada mudança posterior

## Regras obrigatórias
1. **Banco**: toda tabela nova tem RLS ligada e políticas no mesmo arquivo. Aluna só lê o que é dela (`aluna_id = auth.uid()`), treinador lê tudo (`public.is_coach()`). Toda mudança vira um `supabase/atualizacao-N.sql` novo e idempotente; nunca editar um arquivo que já foi rodado.
2. **Chaves**: só a chave `anon`/`publishable` pode existir no front (`config.js`). Nunca `service_role`, senha de banco ou token em arquivo do repositório.
3. **Acesso a dados**: telas usam `api.*`. Nunca chamar `window.supabase` direto fora de `js/api.js`.
4. **Arquivo novo em `js/` ou `css/`**: adicionar em `ARQUIVOS` no `sw.js`.
5. **Modo demonstração**: se a tela lê uma tabela nova, ela precisa funcionar (ou mostrar `Vazio`) com `DEMO` ligado.
6. **Fórmulas**: usar as da §6 do `docs/CEREBRO-NEMESIS.md`. Não inventar nem mudar fórmula, limiar, peso ou pontuação sem pedido explícito do Luiz. Se faltar uma (ex.: Petroski), perguntar e citar a referência científica.
7. **Visual**: usar as variáveis de cor e as classes existentes (`card`, `btn primario`, `pilha`, `tag`...). Nada de cor solta no código nem CSS inline para o que já tem classe. Ver skill `nemesis-visual`.
8. **Textos da tela**: português simples, falando com a aluna na 2ª pessoa, sem jargão sem explicação. Datas `dd/mm/aaaa`, números com vírgula (`num()`, `brl()`).
9. **Estilo de código**: seguir o arquivo vizinho. Nomes em português (`carregarRadar`, `salvar`, `aluna`), funções curtas, componentes com `html\`...\``, comentários só onde a regra não é óbvia.

## Proibido
- Adicionar dependência, `package.json`, build, CDN externo ou framework.
- Desligar RLS, criar política `using (true)` em dado de aluna ou usar `security definer` sem `set search_path = public`.
- Apagar ou reescrever `supabase/schema.sql` ou atualizações já publicadas.
- Commit direto na `main`. Cada funcionalidade vai numa branch e passa por `/review` (e `/security-review` se mexer em banco, login ou dados de saúde) antes do merge.
- Mudar fórmula de negócio sem atualizar a §6 do `docs/CEREBRO-NEMESIS.md` junto.
- Liberar leitura da metodologia (exercícios, formulários, perguntas, dicas) para quem não é treinador nem aluna ativa (`public.is_aluna_ativa()`).
- Rodar uma `atualizacao-N.sql` antiga depois de uma mais nova (a 2 recria funções que a 11 protege).

## Ao terminar uma mudança
1. `node ferramentas/checar.mjs` passando.
2. Testar a tela no navegador (modo demonstração e, se possível, com banco).
3. Atualizar `docs/CEREBRO-NEMESIS.md` se mudou arquitetura, rota, banco ou regra de negócio; registrar decisões novas em `docs/decisoes.md`.
4. Se for publicar: subir `VERSAO` no `sw.js` e citar no README qual `atualizacao-N.sql` rodar.
