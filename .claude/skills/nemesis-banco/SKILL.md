---
name: nemesis-banco
description: Use ao criar ou alterar tabelas, colunas, políticas RLS, funções SQL ou gatilhos no Supabase do Nemesis, ou ao escrever código que lê ou grava dados (js/api.js, api.q, api.ins, api.rpc). Também ao investigar erro de permissão ou "coluna não existe".
---

# Banco do Nemesis (Supabase)

São dados de saúde de alunas (dor, ciclo menstrual, anamnese, peso, fotos). Erro de RLS é vazamento. Leia a §5 (banco) e a §7 (segurança) do `docs/CEREBRO-NEMESIS.md` antes de começar.

## Padrões de política (copie o que se encaixa)
```sql
-- aluna lê o que é dela, só o treinador escreve (ficha, avaliação, metas)
create policy x_ler      on public.x for select using (aluna_id = auth.uid() or public.is_coach());
create policy x_escrever on public.x for all    using (public.is_coach()) with check (public.is_coach());
-- aluna lê e escreve o que é dela (sessões, séries, check-ins)
create policy x_tudo on public.x for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());
-- só o treinador (financeiro, Dossiê, agenda, inscrições, convites)
create policy x_coach on public.x for all using (public.is_coach()) with check (public.is_coach());
-- metodologia (biblioteca, formulários): treinador e aluna ATIVA (conta aguardando aprovação não lê)
create policy x_ler on public.x for select using (public.is_coach() or public.is_aluna_ativa());
-- público só envia (formulário da bio), com limites no gatilho leads_limites
create policy lead_enviar on public.leads for insert to anon, authenticated with check (status = 'novo');
```

## Onde a mudança vai
- Nunca editar `supabase/schema.sql` nem uma `atualizacao-N.sql` que já existe (elas já foram rodadas no banco real).
- Criar `supabase/atualizacao-N.sql` com o próximo número. Cabeçalho no padrão dos existentes:
  ```sql
  -- NEMESIS · atualização N: <o que faz, em uma linha>
  -- Rode DEPOIS da atualização N-1. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
  ```
- Idempotente sempre: `create table if not exists`, `add column if not exists`, `drop policy if exists` antes de `create policy`, `drop constraint if exists` antes de `add constraint`, `create or replace function`, `on conflict do nothing` em dados iniciais.
- Atualizar o README (seção "Atualizações do banco") e a tabela de atualizações da §5 do `docs/CEREBRO-NEMESIS.md`.
- Testar antes de publicar: rodar `schema.sql` e todas as atualizações **duas vezes seguidas** num Postgres local com papéis `anon`/`authenticated` e um esquema `auth` simulado (é assim que o bug do convite da atualização 9 foi achado).

## Tabela nova: checklist
1. `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`.
2. Dado de aluna tem `aluna_id uuid not null references public.profiles(id) on delete cascade` e índice em `aluna_id`.
3. `alter table public.<t> enable row level security;` no mesmo arquivo.
4. Políticas escolhidas entre os padrões do topo desta skill:
   - aluna lê, treinador escreve: `using (aluna_id = auth.uid() or public.is_coach())` para select; `public.is_coach()` para all.
   - aluna lê e escreve o dela: `for all using (...) with check (aluna_id = auth.uid() or public.is_coach())`.
   - só treinador: financeiro, Dossiê, agenda, inscrições, alertas.
5. Nunca `using (true)` em dado de aluna. Nunca política sem `with check` em `insert`/`update`/`all`.
6. Checks nos valores (`check (x between 1 and 5)`, `check (tipo in (...))`) espelhando o que a tela aceita.

## Funções
- `security definer` só com `set search_path = public` e verificação de quem chama (`if not public.is_coach() then raise exception 'Somente o treinador'; end if;` ou filtrar por `auth.uid()`).
- Funções auxiliares internas: `revoke execute ... from anon, authenticated`.
- `montar_formulario` é um invólucro que exige treinador ou aluna ativa; a lógica fica em `montar_formulario_base` (execução revogada). Se mudar a lógica, mude a base.
- `handle_new_user`: o perfil é criado **antes** de o convite apontar para ele (chave estrangeira).
- Se mudar `avaliar_regra`, mudar `js/motor.js` igual (e vice-versa).

## No JavaScript
- Só pela `api` de `js/api.js`: `api.q(tabela, { eq, gte, lte, order, asc, limit })`, `api.um`, `api.ins`, `api.upd`, `api.ups`, `api.del`, `api.rpc`, `api.aoInserir`.
- Nunca `service_role` no front. `config.js` só com a chave `anon`/`publishable`.
- Coluna nova usada na tela: adicionar também em `js/demo.js` (semente) se a tela depender dela, e atualizar a mensagem de `traduzErro` em `js/api.js` com o número da nova atualização.

## Antes de terminar
- `node ferramentas/checar.mjs` (confere RLS de toda tabela criada).
- Reler as políticas pensando: "uma aluna logada consegue ler ou mudar dado de outra aluna?" e "o formulário anônimo consegue ler algo?".
- Sugerir `/security-review` no pull request.
