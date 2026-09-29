-- NEMESIS · atualização 5: prescrição completa na ficha
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
-- Cria na ficha: tipo do exercício, método, cadência, formato do descanso, RIR/RPE,
-- duração e intensidade do aeróbico. Na biblioteca: músculos principais e auxiliares.

alter table public.treino_itens add column if not exists tipo text not null default 'musculacao';
alter table public.treino_itens drop constraint if exists treino_itens_tipo_ok;
alter table public.treino_itens add constraint treino_itens_tipo_ok check (tipo in ('aquecimento','aerobico','musculacao','crossfit'));

alter table public.treino_itens add column if not exists metodo text not null default 'padrao';
alter table public.treino_itens add column if not exists cadencia_exc numeric;   -- segundos na descida
alter table public.treino_itens add column if not exists cadencia_con numeric;   -- segundos na subida

alter table public.treino_itens add column if not exists descanso_tipo text not null default 'exato';
alter table public.treino_itens drop constraint if exists treino_itens_descanso_ok;
alter table public.treino_itens add constraint treino_itens_descanso_ok check (descanso_tipo in ('exato','faixa','livre'));
alter table public.treino_itens add column if not exists descanso_max int;       -- fim da faixa (segundos)

alter table public.treino_itens add column if not exists esforco_tipo text;
alter table public.treino_itens drop constraint if exists treino_itens_esforco_ok;
alter table public.treino_itens add constraint treino_itens_esforco_ok check (esforco_tipo is null or esforco_tipo in ('rir','rpe'));
alter table public.treino_itens add column if not exists esforco_alvo numeric;

alter table public.treino_itens add column if not exists duracao int;            -- minutos (aeróbico)
alter table public.treino_itens add column if not exists intensidade text;       -- zona, FC, velocidade

-- músculos do exercício: {"primarios": [...], "secundarios": [...]}
-- vazio = o app deduz pelo nome e pelo grupo
alter table public.exercicios add column if not exists musculos jsonb;

notify pgrst, 'reload schema';
