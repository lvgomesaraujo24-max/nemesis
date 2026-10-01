-- NEMESIS · atualização 14: Arena nova e água
--  1. Séries preparatórias na ficha (entre o aquecimento e as séries válidas).
--  2. Observações da aluna por exercício na sessão de treino.
--  3. Controle de água do dia, com meta.
-- Rode DEPOIS da atualização 13. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- 1. séries preparatórias ----------
-- Preparatória = série de aproximação com carga perto da de trabalho, poucas reps, longe da falha.
-- Na tabela series ela é gravada com aquecimento = true e preparatoria = true: assim fica fora de volume,
-- recordes e tonelagem do mesmo jeito que o aquecimento (CEREBRO §6).
alter table public.treino_itens add column if not exists preparatorias smallint not null default 0;
alter table public.treino_itens drop constraint if exists treino_itens_preparatorias_ok;
alter table public.treino_itens add constraint treino_itens_preparatorias_ok check (preparatorias between 0 and 5);
alter table public.series add column if not exists preparatoria boolean not null default false;

-- ---------- 2. observações da aluna por exercício ----------
alter table public.sessoes add column if not exists notas jsonb;   -- { "<treino_item_id>": "texto" }

-- ---------- 3. água ----------
alter table public.profiles add column if not exists agua_meta_ml integer;
alter table public.profiles drop constraint if exists profiles_agua_meta_ok;
alter table public.profiles add constraint profiles_agua_meta_ok check (agua_meta_ml is null or agua_meta_ml between 500 and 8000);

create table if not exists public.agua_registros (
  id          uuid primary key default gen_random_uuid(),
  aluna_id    uuid not null references public.profiles(id) on delete cascade,
  dia         date not null default current_date,
  ml          integer not null default 0 check (ml between 0 and 10000),
  updated_at  timestamptz not null default now(),
  unique (aluna_id, dia)
);
alter table public.agua_registros enable row level security;
drop policy if exists agua_ler on public.agua_registros;
drop policy if exists agua_gravar on public.agua_registros;
drop policy if exists agua_mudar on public.agua_registros;
drop policy if exists agua_apagar on public.agua_registros;
create policy agua_ler    on public.agua_registros for select using (aluna_id = auth.uid() or public.is_coach());
create policy agua_gravar on public.agua_registros for insert with check (aluna_id = auth.uid());
create policy agua_mudar  on public.agua_registros for update using (aluna_id = auth.uid()) with check (aluna_id = auth.uid());
create policy agua_apagar on public.agua_registros for delete using (aluna_id = auth.uid() or public.is_coach());

notify pgrst, 'reload schema';
