-- NEMESIS · atualização 16: cardio com monitoramento completo (contínuo e intervalado/HIIT)
--  1. Zonas de FC com histórico (zonas_fc): cada recálculo vira uma linha.
--  2. Testes aeróbicos ganham campos estruturados (pico, limiares, teste válido, vídeo).
--  3. Prescrição de cardio aceita intervalado: tiros, duração, pausa, alvos em bpm/%FCmáx/PSE, dias e progressão.
--  4. Registro de cardio ganha FC pico, PSE do último tiro, tiros feitos, fonte, print e carga interna (sRPE).
--  5. Registro por tiro (cardio_estimulos).
--  6. Duas views de leitura para análise (respeitam a RLS de quem consulta).
-- Rode DEPOIS da atualização 15. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
-- Não apaga nem renomeia nenhuma coluna existente.

-- ---------- 1. zonas de FC ----------
create table if not exists public.zonas_fc (
  id            uuid primary key default gen_random_uuid(),
  aluna_id      uuid not null references public.profiles(id) on delete cascade,
  vigente_desde date not null default current_date,
  fc_repouso    integer not null check (fc_repouso between 30 and 120),
  fc_max        integer not null check (fc_max between 120 and 230),
  fc_max_fonte  text not null default 'shargal' check (fc_max_fonte in ('shargal','tanaka','teste','observada')),
  metodo        text not null default 'karvonen' check (metodo in ('karvonen','pct_fcmax','limiares')),
  teste_id      uuid,
  z1_min integer, z1_max integer,
  z2_min integer, z2_max integer,
  z3_min integer, z3_max integer,
  z4_min integer, z4_max integer,
  z5_min integer, z5_max integer,
  obs           text,
  created_at    timestamptz not null default now()
);
create index if not exists zonas_fc_aluna_idx on public.zonas_fc (aluna_id, vigente_desde desc);

alter table public.zonas_fc enable row level security;
drop policy if exists zonas_ler on public.zonas_fc;
drop policy if exists zonas_escrever on public.zonas_fc;
create policy zonas_ler      on public.zonas_fc for select using (aluna_id = auth.uid() or public.is_coach());
create policy zonas_escrever on public.zonas_fc for all    using (public.is_coach()) with check (public.is_coach());

-- ---------- 2. testes aeróbicos ----------
alter table public.testes_aerobicos
  add column if not exists modalidade text,
  add column if not exists fc_pico    integer,
  add column if not exists carga_pico numeric,     -- watts ou velocidade
  add column if not exists nivel_pico text,        -- bike sem watts: nível ou posição da manopla
  add column if not exists duracao_s  integer,
  add column if not exists pse_final  integer check (pse_final between 0 and 10),
  add column if not exists fc_lv1     integer,     -- 1º limiar (talk test "não sei" ou deflexão)
  add column if not exists fc_lv2     integer,     -- 2º limiar
  add column if not exists carga_lv1  numeric,
  add column if not exists carga_lv2  numeric,
  add column if not exists valido     boolean,     -- atingiu critério de teste máximo
  add column if not exists video_url  text;

alter table public.zonas_fc drop constraint if exists zonas_fc_teste_fk;
alter table public.zonas_fc add constraint zonas_fc_teste_fk foreign key (teste_id) references public.testes_aerobicos(id) on delete set null;

-- ---------- 3. prescrição ----------
alter table public.cardio_prescricoes drop constraint if exists cardio_prescricoes_modalidade_check;
alter table public.cardio_prescricoes drop constraint if exists cardio_prescricoes_modo_check;
alter table public.cardio_prescricoes add constraint cardio_prescricoes_modalidade_check
  check (modalidade = any (array['esteira','bike','eliptico','escada','remo','rua','corda','peso_corporal','natacao','outro']));
alter table public.cardio_prescricoes add constraint cardio_prescricoes_modo_check
  check (modo is null or modo = any (array['caminhada','corrida','pedalada','remada','livre']));

alter table public.cardio_prescricoes
  add column if not exists tipo text not null default 'continuo'
      check (tipo in ('continuo','intervalado_longo','hiit_curto','sit','fartlek','livre')),
  add column if not exists mesociclo_id       uuid references public.mesociclos(id) on delete set null,
  add column if not exists zona_alvo          text,
  add column if not exists estimulos          integer check (estimulos between 1 and 60),
  add column if not exists estimulo_s         integer check (estimulo_s between 5 and 1800),
  add column if not exists pausa_s            integer check (pausa_s between 0 and 1800),
  add column if not exists pausa_tipo         text check (pausa_tipo in ('ativa','passiva')),
  add column if not exists blocos             integer default 1,
  add column if not exists pausa_bloco_s      integer,
  add column if not exists alvo_bpm_min       integer,
  add column if not exists alvo_bpm_max       integer,
  add column if not exists alvo_pct_fcmax_min numeric,
  add column if not exists alvo_pct_fcmax_max numeric,
  add column if not exists pse_alvo_min       integer check (pse_alvo_min between 0 and 10),
  add column if not exists pse_alvo_max       integer check (pse_alvo_max between 0 and 10),
  add column if not exists controle           text default 'fc' check (controle in ('fc','pse','carga','fala')),
  add column if not exists aquecimento_min    integer,
  add column if not exists volta_calma_min    integer,
  add column if not exists dias_semana        smallint[],   -- 0 = domingo ... 6 = sábado
  add column if not exists regra_dia          text,         -- ex.: "nunca no dia antes do treino de perna"
  add column if not exists progressao         jsonb,        -- [{"semana":1,"estimulos":6,"pausa_s":60}, ...]
  add column if not exists vigente_de         date,
  add column if not exists vigente_ate        date;

-- ---------- 4. registro da sessão ----------
alter table public.cardio_registros
  add column if not exists tipo             text,
  add column if not exists estimulos_feitos integer,
  add column if not exists fc_pico          integer,
  add column if not exists fc_repouso_dia   integer,
  add column if not exists pse_ultimo       integer check (pse_ultimo between 0 and 10),
  add column if not exists cadencia_media   integer,
  add column if not exists tempo_zonas_s    jsonb,          -- {"z1":600,"z2":300,...}
  add column if not exists tempo_acima_90_s integer,
  add column if not exists fonte            text default 'manual'
      check (fonte in ('manual','apple_watch','garmin','polar','planilha','coach')),
  add column if not exists print_url        text,
  add column if not exists sensacao         text,
  -- carga interna da sessão (Foster): PSE da sessão × minutos
  add column if not exists carga_srpe       numeric generated always as (percepcao * duracao_min) stored;
create index if not exists cardio_registros_aluna_data_idx on public.cardio_registros (aluna_id, data desc);

-- ---------- 5. um registro por tiro ----------
create table if not exists public.cardio_estimulos (
  id             uuid primary key default gen_random_uuid(),
  registro_id    uuid not null references public.cardio_registros(id) on delete cascade,
  aluna_id       uuid not null references public.profiles(id) on delete cascade,
  ordem          integer not null check (ordem between 1 and 60),
  duracao_s      integer,
  fc_pico        integer,
  fc_fim_pausa   integer,
  pse            integer check (pse between 0 and 10),
  nivel          text,
  watts          numeric,
  velocidade_kmh numeric,
  cadencia       integer,
  created_at     timestamptz not null default now(),
  unique (registro_id, ordem)
);
-- quem já tinha a tabela sem aluna_id (aplicada antes desta versão do arquivo)
alter table public.cardio_estimulos add column if not exists aluna_id uuid references public.profiles(id) on delete cascade;
update public.cardio_estimulos e set aluna_id = r.aluna_id from public.cardio_registros r where r.id = e.registro_id and e.aluna_id is null;
alter table public.cardio_estimulos alter column aluna_id set not null;
create index if not exists cardio_estimulos_aluna_idx on public.cardio_estimulos (aluna_id);

alter table public.cardio_estimulos enable row level security;
drop policy if exists estimulos_tudo on public.cardio_estimulos;
create policy estimulos_tudo on public.cardio_estimulos for all
  using (aluna_id = auth.uid() or public.is_coach())
  with check ((aluna_id = auth.uid() or public.is_coach())
    and exists (select 1 from public.cardio_registros r where r.id = registro_id and r.aluna_id = cardio_estimulos.aluna_id));

-- ---------- 6. views de análise (security_invoker: cada um só vê o que a RLS deixa) ----------
drop view if exists public.cardio_semana;
drop view if exists public.cardio_estimulos_analise;

create view public.cardio_estimulos_analise with (security_invoker = true) as
select
  e.*,
  r.data, r.prescricao_id,
  p.alvo_bpm_min, p.alvo_bpm_max, p.pse_alvo_min, p.pse_alvo_max,
  z.fc_max,
  round(e.fc_pico::numeric / nullif(z.fc_max, 0), 3) as pct_fcmax,
  e.fc_pico - e.fc_fim_pausa as recuperacao_bpm,
  case when e.fc_pico is null or p.alvo_bpm_min is null then null
       when e.fc_pico < p.alvo_bpm_min then 'abaixo'
       when p.alvo_bpm_max is not null and e.fc_pico > p.alvo_bpm_max then 'acima'
       else 'no_alvo' end as status_fc,
  case when e.pse is null or p.pse_alvo_min is null then null
       when e.pse < p.pse_alvo_min then 'abaixo'
       when p.pse_alvo_max is not null and e.pse > p.pse_alvo_max then 'acima'
       else 'no_alvo' end as status_pse,
  (e.fc_pico > z.fc_max) as fc_acima_fcmax
from public.cardio_estimulos e
join public.cardio_registros r on r.id = e.registro_id
left join public.cardio_prescricoes p on p.id = r.prescricao_id
left join lateral (
  select zz.fc_max from public.zonas_fc zz
  where zz.aluna_id = e.aluna_id and zz.vigente_desde <= r.data
  order by zz.vigente_desde desc limit 1
) z on true;

create view public.cardio_semana with (security_invoker = true) as
with reg as (
  select r.*, date_trunc('week', r.data)::date as semana from public.cardio_registros r
), est as (
  select registro_id,
         count(*)                                       as n_est,
         count(*) filter (where status_fc  = 'no_alvo') as n_fc_alvo,
         count(*) filter (where status_pse = 'no_alvo') as n_pse_alvo,
         avg(recuperacao_bpm)                           as rec_media,
         bool_or(fc_acima_fcmax)                        as passou_fcmax
  from public.cardio_estimulos_analise group by registro_id
)
select
  reg.aluna_id, reg.semana,
  count(*)                    as sessoes,
  sum(reg.duracao_min)        as minutos,
  sum(reg.carga_srpe)         as carga_srpe,
  round(avg(reg.percepcao),1) as pse_media,
  round(avg(reg.fc_pico))     as fc_pico_media,
  sum(reg.estimulos_feitos)   as estimulos,
  round(sum(est.n_fc_alvo)::numeric  / nullif(sum(est.n_est), 0), 3) as pct_estimulos_alvo_fc,
  round(sum(est.n_pse_alvo)::numeric / nullif(sum(est.n_est), 0), 3) as pct_estimulos_alvo_pse,
  round(avg(est.rec_media), 1) as recuperacao_media_bpm,
  coalesce(bool_or(est.passou_fcmax), false) as alerta_fcmax
from reg left join est on est.registro_id = reg.id
group by reg.aluna_id, reg.semana;
