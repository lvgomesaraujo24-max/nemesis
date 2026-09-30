---
name: nemesis-banco
description: Use ao criar ou alterar tabelas, colunas, políticas RLS, funções SQL ou gatilhos no Supabase do Nemesis, ou ao escrever código que lê ou grava dados (js/api.js, api.q, api.ins, api.rpc). Também ao investigar erro de permissão ou "coluna não existe".
---

# Banco do Nemesis (Supabase)

São dados de saúde de alunas (dor, ciclo menstrual, anamnese, peso). Erro de RLS é vazamento. Leia `docs/banco.md` antes de começar.

## Onde a mudança vai
- Nunca editar `supabase/schema.sql` nem uma `atualizacao-N.sql` que já existe (elas já foram rodadas no banco real).
- Criar `supabase/atualizacao-N.sql` com o próximo número. Cabeçalho no padrão dos existentes:
  ```sql
  -- NEMESIS · atualização N: <o que faz, em uma linha>
  -- Rode DEPOIS da atualização N-1. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
  ```
- Idempotente sempre: `create table if not exists`, `add column if not exists`, `drop policy if exists` antes de `create policy`, `drop constraint if exists` antes de `add constraint`, `create or replace function`, `on conflict do nothing` em dados iniciais.
- Atualizar o README (seção "Atualizações do banco") e a tabela de arquivos em `docs/banco.md`.

## Tabela nova: checklist
1. `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`.
2. Dado de aluna tem `aluna_id uuid not null references public.profiles(id) on delete cascade` e índice em `aluna_id`.
3. `alter table public.<t> enable row level security;` no mesmo arquivo.
4. Políticas escolhidas entre os padrões de `docs/banco.md`:
   - aluna lê, treinador escreve: `using (aluna_id = auth.uid() or public.is_coach())` para select; `public.is_coach()` para all.
   - aluna lê e escreve o dela: `for all using (...) with check (aluna_id = auth.uid() or public.is_coach())`.
   - só treinador: financeiro, Dossiê, agenda, inscrições, alertas.
5. Nunca `using (true)` em dado de aluna. Nunca política sem `with check` em `insert`/`update`/`all`.
6. Checks nos valores (`check (x between 1 and 5)`, `check (tipo in (...))`) espelhando o que a tela aceita.

## Funções
- `security definer` só com `set search_path = public` e verificação de quem chama (`if not public.is_coach() then raise exception 'Somente o treinador'; end if;` ou filtrar por `auth.uid()`).
- Funções auxiliares internas: `revoke execute ... from anon, authenticated`.
- Se mudar `avaliar_regra`, mudar `js/motor.js` igual (e vice-versa).

## No JavaScript
- Só pela `api` de `js/api.js`: `api.q(tabela, { eq, gte, lte, order, asc, limit })`, `api.um`, `api.ins`, `api.upd`, `api.ups`, `api.del`, `api.rpc`, `api.aoInserir`.
- Nunca `service_role` no front. `config.js` só com a chave `anon`/`publishable`.
- Coluna nova usada na tela: adicionar também em `js/demo.js` (semente) se a tela depender dela, e atualizar a mensagem de `traduzErro` em `js/api.js` com o número da nova atualização.

## Antes de terminar
- `node ferramentas/checar.mjs` (confere RLS de toda tabela criada).
- Reler as políticas pensando: "uma aluna logada consegue ler ou mudar dado de outra aluna?" e "o formulário anônimo consegue ler algo?".
- Sugerir `/security-review` no pull request.
