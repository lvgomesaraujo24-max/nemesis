# Decisões do projeto

Cada decisão com o porquê. Para mudar uma delas, escreva uma entrada nova no fim (não apague a antiga) dizendo o que mudou e por quê.

Modelo:
```
## AAAA-MM-DD · Título
**Decisão**: ...
**Por quê**: ...
**Alternativas descartadas**: X (motivo), Y (motivo)
**Consequências**: o que fica mais fácil, o que fica mais difícil
```

---

## 2026-09 · Front-end sem build (Preact + htm em módulos ES)
**Decisão**: o app é HTML + JavaScript puro em módulos, com Preact e htm guardados em `lib/`. Sem npm, sem bundler.
**Por quê**: o treinador mantém o app sozinho e está aprendendo. Sem build, o que está no GitHub é o que roda: nada quebra por versão de pacote, e publicar é só subir arquivo. Preact dá componentes e estado em um arquivo de ~13 KB.
**Alternativas descartadas**: Next.js (exige build, servidor ou export estático e muita dependência para o tamanho do app); React Native e Flutter (loja de aplicativos, duas bases de código, curva de aprendizado maior); JavaScript sem framework (as telas ficariam difíceis de manter).
**Consequências**: não há TypeScript nem JSX; templates são `html\`...\``. Qualquer biblioteca nova precisa ser um arquivo único copiado para `lib/`.

## 2026-09 · Supabase como banco, login e regras de acesso
**Decisão**: Supabase (Postgres) com RLS em todas as tabelas; o front usa só a chave pública.
**Por quê**: não precisa de servidor próprio; a segurança fica no banco, onde não dá para burlar pelo navegador. Região São Paulo.
**Alternativas descartadas**: Firebase (regras de acesso menos expressivas para "aluna vê o dela, treinador vê tudo" e consultas de relatório); backend próprio (custo e manutenção).
**Consequências**: toda regra de acesso é SQL. Tabela sem RLS é vazamento de dado de saúde.

## 2026-09 · Mudanças de banco em `supabase/atualizacao-N.sql`, rodadas à mão
**Decisão**: cada mudança vira um arquivo numerado e idempotente, rodado no SQL Editor.
**Por quê**: não exige instalar a CLI do Supabase nem Docker; funciona direto do navegador. Idempotência deixa rodar de novo sem medo.
**Alternativas descartadas**: `supabase/migrations` com a CLI (mais robusto e com histórico automático, mas exige terminal, Docker e login da CLI).
**Consequências**: ninguém registra automaticamente o que já foi rodado; o README diz qual rodar. Se o projeto crescer, migrar para a CLI.

## 2026-09 · PWA no GitHub Pages
**Decisão**: app instalável pelo navegador, hospedado no GitHub Pages, com service worker de rede primeiro.
**Por quê**: sem loja, sem custo, atualização imediata. Funciona offline na academia.
**Consequências**: a cada publicação é preciso subir `VERSAO` no `sw.js`; arquivo fora de `ARQUIVOS` não abre offline.

## 2026-09 · Modo demonstração
**Decisão**: com `config.js` vazio, `js/demo.js` imita a `api` com dados no navegador.
**Por quê**: testar telas sem mexer no banco real e mostrar o app para interessadas.
**Consequências**: tela nova precisa funcionar (ou mostrar `Vazio`) no modo demonstração.

## 2026-09 · Regras dos formulários rodam no aparelho e no banco
**Decisão**: `js/motor.js` e `public.avaliar_regra` implementam o mesmo formato de regra.
**Por quê**: dica condicional aparece na hora, sem custo de servidor; o banco confere de novo ao gravar.
**Consequências**: mudar um operador exige mudar os dois lados.
