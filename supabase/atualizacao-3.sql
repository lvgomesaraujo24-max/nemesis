-- ============================================================
-- NEMESIS · ATUALIZAÇÃO 3: ACRÓPOLE (Centro de Comando do coach)
-- Rode DEPOIS da atualização 2. Pode rodar mais de uma vez.
-- Cria: mesociclos (ficha com validade), agenda, visoes_estado,
-- envios.lido_em, índices e a RPC centro_de_comando(p_dia).
-- Toda a inteligência é SQL: custo zero, nenhuma API externa.
-- ============================================================

-- ---------- tabelas ----------
create table if not exists public.mesociclos (
  id uuid primary key default gen_random_uuid(),
  aluna_id uuid not null references public.profiles(id) on delete cascade,
  nome text,
  inicio date not null,
  fim date not null check (fim >= inicio),
  status text not null default 'ativo' check (status in ('planejado','ativo','encerrado')),
  created_at timestamptz not null default now()
);
create index if not exists mesociclos_fim on public.mesociclos (status, fim);
create index if not exists mesociclos_aluna on public.mesociclos (aluna_id, inicio);

create table if not exists public.agenda (
  id uuid primary key default gen_random_uuid(),
  aluna_id uuid references public.profiles(id) on delete cascade,   -- vazio = compromisso do coach
  titulo text not null,
  tipo text not null default 'outro' check (tipo in ('video','avaliacao','outro')),
  inicio timestamptz not null,
  fim timestamptz,
  link text,
  feito boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agenda_inicio on public.agenda (inicio);

create table if not exists public.visoes_estado (
  chave text primary key,                 -- ex.: 'dor|<envio>|joelho|D'
  status text not null check (status in ('visto','resolvido','adiado','feito')),
  ate timestamptz,                        -- só para 'adiado'
  updated_at timestamptz not null default now()
);

alter table public.envios add column if not exists lido_em timestamptz;

create index if not exists envios_enviado_em  on public.envios (enviado_em desc);
create index if not exists dor_relatos_janela on public.dor_relatos (aluna_id, regiao, lado, created_at);
create index if not exists checkins_pendentes on public.checkins (semana) where resposta is null;
create index if not exists series_sessao      on public.series (sessao_id);

-- ---------- segurança ----------
alter table public.mesociclos    enable row level security;
alter table public.agenda        enable row level security;
alter table public.visoes_estado enable row level security;
drop policy if exists meso_ler on public.mesociclos;
drop policy if exists meso_escrever on public.mesociclos;
drop policy if exists agenda_coach on public.agenda;
drop policy if exists visoes_coach on public.visoes_estado;
create policy meso_ler      on public.mesociclos for select using (aluna_id = auth.uid() or public.is_coach());
create policy meso_escrever on public.mesociclos for all using (public.is_coach()) with check (public.is_coach());
create policy agenda_coach  on public.agenda for all using (public.is_coach()) with check (public.is_coach());
create policy visoes_coach  on public.visoes_estado for all using (public.is_coach()) with check (public.is_coach());

-- fichas atuais ganham validade: 6 semanas a partir do treino ativo mais recente
insert into public.mesociclos (aluna_id, nome, inicio, fim)
select p.id, 'Ficha atual', t.inicio, t.inicio + 42
from public.profiles p
join lateral (select max(created_at)::date as inicio from public.treinos where aluna_id = p.id and ativo) t on t.inicio is not null
where p.role = 'student'
  and not exists (select 1 from public.mesociclos m where m.aluna_id = p.id);

-- ---------- 1. fichas que vencem em D+7 (dias negativo = vencida) ----------
create or replace function public.cc_fichas(p_dia date)
returns table (aluna_id uuid, nome text, telefone text, mesociclo_id uuid, fim date, dias int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.telefone, m.id, m.fim, (m.fim - p_dia)
  from profiles p
  join lateral (
    select * from mesociclos m
    where m.aluna_id = p.id and m.status = 'ativo'
    order by m.fim desc limit 1
  ) m on true
  where p.role = 'student' and p.ativo
    and m.fim <= p_dia + 7
    and not exists (select 1 from mesociclos n where n.aluna_id = p.id and n.inicio > m.inicio)
  order by m.fim;
$$;

-- ---------- 2. sinais clínicos (Oráculos de 7 dias) cruzados com o ciclo ----------
create or replace function public.cc_sinais_clinicos(p_dia date)
returns table (chave text, envio_id uuid, aluna_id uuid, nome text, telefone text, tipo text, nivel text,
               dados jsonb, ciclo jsonb, quando timestamptz)
language sql stable security definer set search_path = public as $$
  with recentes as (
    select e.id as envio_id, e.aluna_id, e.enviado_em
    from envios e join formularios f on f.id = e.formulario_id and f.tipo = 'oraculo'
    where e.enviado_em >= p_dia - 7
  ),
  dor as (
    select d.*, lag(d.intensidade) over (
             partition by d.aluna_id, d.regiao, coalesce(d.lado, 'centro') order by d.created_at) as anterior
    from dor_relatos d
    where d.created_at >= p_dia - 60
  ),
  resp as (
    select r.envio_id, r.aluna_id, r.enviado_em,
      (select (x.valor #>> '{}')::numeric from respostas x where x.envio_id = r.envio_id and x.chave = 'estresse')   as estresse,
      (select (x.valor #>> '{}')::numeric from respostas x where x.envio_id = r.envio_id and x.chave = 'sono')       as sono,
      (select (x.valor #>> '{}')::numeric from respostas x where x.envio_id = r.envio_id and x.chave = 'sono_horas') as horas
    from recentes r
  ),
  sinais as (
    select 'dor|' || d.envio_id || '|' || d.regiao || '|' || coalesce(d.lado, 'centro') as chave, d.envio_id,
           d.aluna_id, 'dor' as tipo,
           case when d.intensidade >= 7 or d.intensidade > d.anterior then 'critico'
                when d.intensidade >= 4 or (d.intensidade >= 3 and d.anterior >= 3) then 'atencao' end as nivel,
           jsonb_build_object('regiao', nome_regiao(d.regiao, d.lado), 'i', d.intensidade, 'antes', d.anterior) as dados,
           d.created_at as quando
    from dor d join recentes r on r.envio_id = d.envio_id
    union all
    select 'recuperacao|' || x.envio_id, x.envio_id, x.aluna_id, 'recuperacao',
           case when x.estresse >= 5 and x.sono <= 2 then 'critico'
                when x.horas < 5 and x.estresse >= 4 then 'atencao' end,
           jsonb_build_object('estresse', x.estresse, 'sono', x.sono, 'horas', x.horas),
           x.enviado_em
    from resp x
  )
  select s.chave, s.envio_id, s.aluna_id, p.nome, p.telefone, s.tipo, s.nivel, s.dados,
         fase_ciclo(s.aluna_id, s.quando::date), s.quando
  from sinais s join profiles p on p.id = s.aluna_id and p.ativo
  where s.nivel is not null
    and not exists (select 1 from visoes_estado v
                    where v.chave = s.chave and (v.status in ('resolvido','visto','feito') or v.ate > now()))
  order by (s.nivel = 'critico') desc, s.quando desc
  limit 50;
$$;

-- ---------- 3. adesão: base por aluna e semana (8 fechadas + a atual) ----------
create or replace function public.cc_adesao_base(p_dia date)
returns table (semana date, aluna_id uuid, alvo int, n int, pausa boolean)
language sql stable security definer set search_path = public as $$
  with seg as (select date_trunc('week', p_dia)::date as atual),
  alunas as (
    select p.id,
      coalesce(p.treinos_semana_alvo::int,
               nullif((select count(*) from treinos t where t.aluna_id = p.id and t.ativo and not t.opcional), 0)::int,
               3) as alvo
    from profiles p
    where p.role = 'student' and p.ativo
      and coalesce(p.alistada_em, p.created_at::date) <= p_dia - 7
  ),
  semanas as (
    select generate_series((select atual from seg) - 56, (select atual from seg), interval '7 days')::date as semana
  ),
  feitos as (
    select s.aluna_id, date_trunc('week', s.data)::date as semana, count(*)::int as n
    from sessoes s
    where s.data >= (select atual from seg) - 56
      and (s.concluida_em is not null or exists (select 1 from series x where x.sessao_id = s.id and not x.aquecimento))
    group by 1, 2
  )
  select w.semana, a.id, a.alvo, coalesce(f.n, 0),
         exists (select 1 from dossie d
                 where d.aluna_id = a.id and d.tag = 'pausa' and d.arquivada_em is null
                   and d.pausa_inicio <= w.semana + 6 and coalesce(d.pausa_fim, p_dia) >= w.semana)
  from semanas w cross join alunas a
  left join feitos f on f.aluna_id = a.id and f.semana = w.semana;
$$;

-- média das alunas por semana; a última linha é a semana em curso (esperado_pct = ritmo)
create or replace function public.cc_adesao(p_dia date)
returns table (semana date, pct numeric, esperado_pct numeric, alunas int)
language sql stable security definer set search_path = public as $$
  select b.semana,
         round(avg(least(b.n, b.alvo)::numeric / b.alvo) * 100, 1),
         case when b.semana = date_trunc('week', p_dia)::date then
           round(avg(least(b.n::numeric / greatest(b.alvo * ((p_dia - b.semana + 1) / 7.0), 0.5), 1)) * 100, 1) end,
         count(*)::int
  from cc_adesao_base(p_dia) b
  where not b.pausa
  group by b.semana order by b.semana;
$$;

-- por aluna: média das 4 últimas semanas fechadas, última semana, semanas seguidas abaixo de 60%
create or replace function public.cc_adesao_alunas(p_dia date)
returns table (aluna_id uuid, nome text, telefone text, media4 numeric, ultima numeric, abaixo60 int, ultimo_treino date, sequencia int)
language sql stable security definer set search_path = public as $$
  with seg as (select date_trunc('week', p_dia)::date as atual),
  b as (
    select semana, aluna_id, round(least(n, alvo)::numeric / alvo * 100, 1) as pct
    from cc_adesao_base(p_dia) where not pausa and semana < (select atual from seg)
  )
  select p.id, p.nome, p.telefone,
    round(avg(b.pct) filter (where b.semana >= (select atual from seg) - 28), 1),
    max(b.pct) filter (where b.semana = (select atual from seg) - 7),
    (count(*) filter (where b.semana > coalesce(
        (select max(b2.semana) from b b2 where b2.aluna_id = p.id and b2.pct >= 60), date '1900-01-01')))::int,
    (select max(s.data) from sessoes s where s.aluna_id = p.id
       and (s.concluida_em is not null or exists (select 1 from series x where x.sessao_id = s.id and not x.aquecimento))),
    (count(*) filter (where b.semana > coalesce(
        (select max(b3.semana) from b b3 where b3.aluna_id = p.id and b3.pct < 100), date '1900-01-01')))::int
  from b join profiles p on p.id = b.aluna_id
  group by p.id, p.nome, p.telefone;
$$;

-- ---------- 4. marcos automáticos de hoje e amanhã ----------
create or replace function public.cc_marcos(p_dia date)
returns table (chave text, aluna_id uuid, nome text, telefone text, tipo text, n numeric, estado text, dia date, extra jsonb)
language sql stable security definer set search_path = public as $$
  with ativas as (select * from profiles where role = 'student' and ativo),
  cont as (
    select s.aluna_id, count(*)::int as n, max(s.data) as ultima
    from sessoes s where s.concluida_em is not null group by 1
  ),
  ton as (
    select s.aluna_id,
      sum(x.carga * x.reps) filter (where s.data <= p_dia) as agora,
      sum(x.carga * x.reps) filter (where s.data <= p_dia - 2) as antes
    from sessoes s join series x on x.sessao_id = s.id
    where s.data >= date_trunc('month', p_dia)::date and not x.aquecimento and x.carga is not null and x.reps is not null
    group by 1
  ),
  ult_aval as (
    select aluna_id, max(data) as data from (
      select aluna_id, data from avaliacoes union all select aluna_id, data from testes_aerobicos) u
    group by 1
  ),
  todos as (
    -- treino redondo
    select 'treino|' || c.aluna_id || '|' || m.marco as chave, c.aluna_id, 'treino_redondo' as tipo, m.marco::numeric as n,
           case when c.n = m.marco then 'completou' else 'falta_1' end as estado,
           case when c.n = m.marco then c.ultima else p_dia end as dia, '{}'::jsonb as extra
    from cont c cross join unnest(array[10, 25, 50, 100, 150, 200, 300, 400, 500]) as m(marco)
    where c.n = m.marco - 1 or (c.n = m.marco and c.ultima >= p_dia - 1)
    union all
    -- tonelagem do mês
    select 'volume|' || t.aluna_id || '|' || to_char(p_dia, 'YYYY-MM') || '|' || l, t.aluna_id, 'volume_mes', l, 'completou', p_dia,
           jsonb_build_object('kg', round(t.agora))
    from ton t cross join unnest(array[25, 50, 75, 100]) as l
    where coalesce(t.antes, 0) < l * 1000 and t.agora >= l * 1000
    union all
    -- aniversário de Alistamento (3, 6, 12, 24 meses)
    select 'alistamento|' || a.id || '|' || k, a.id, 'alistamento', k, 'data', (a.alistada_em + make_interval(months => k))::date, '{}'::jsonb
    from ativas a cross join unnest(array[3, 6, 12, 24]) as k
    where a.alistada_em is not null and (a.alistada_em + make_interval(months => k))::date between p_dia and p_dia + 1
    union all
    -- aniversário da aluna
    select 'aniver|' || a.id || '|' || extract(year from p_dia), a.id, 'aniversario', null, 'data', d.dia, '{}'::jsonb
    from ativas a cross join (values (p_dia), (p_dia + 1)) as d(dia)
    where a.nascimento is not null and to_char(a.nascimento, 'MM-DD') = to_char(d.dia, 'MM-DD')
    union all
    -- reavaliação: 8 semanas desde a última avaliação física ou teste aeróbico
    select 'reaval|' || u.aluna_id || '|' || u.data, u.aluna_id, 'reavaliacao', (p_dia - u.data)::numeric, 'data', greatest(u.data + 56, p_dia), '{}'::jsonb
    from ult_aval u
    where u.data + 56 <= p_dia + 1
    union all
    -- prazo de meta
    select 'meta|' || m.id, m.aluna_id, 'meta_prazo', null, 'data', m.prazo, jsonb_build_object('titulo', coalesce(m.titulo, m.tipo))
    from metas m
    where m.status = 'ativa' and m.concluida_em is null and m.prazo between p_dia and p_dia + 1
    union all
    -- ficha termina
    select 'fichafim|' || ms.id, ms.aluna_id, 'ficha_termina', null, 'data', ms.fim, '{}'::jsonb
    from mesociclos ms
    where ms.status = 'ativo' and ms.fim between p_dia and p_dia + 1
    union all
    -- plano vence em até 3 dias (aparece no dia de hoje)
    select 'plano|' || s.id, s.aluna_id, 'plano_vence', (s.fim - p_dia)::numeric, 'data', p_dia, jsonb_build_object('plano', s.plano_nome, 'fim', s.fim)
    from assinaturas s
    where s.fim between p_dia and p_dia + 3
      and not exists (select 1 from assinaturas s2 where s2.aluna_id = s.aluna_id and s2.fim > s.fim)
  )
  select t.chave, t.aluna_id, p.nome, p.telefone, t.tipo, t.n, t.estado, t.dia, t.extra
  from todos t join ativas p on p.id = t.aluna_id
  where not exists (select 1 from visoes_estado v
                    where v.chave = t.chave and (v.status in ('feito','resolvido') or v.ate > now()))
  order by t.dia, t.tipo;
$$;

-- ---------- 5. a RPC do painel: uma chamada, um JSON ----------
create or replace function public.centro_de_comando(p_dia date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not is_coach() then raise exception 'Somente o treinador'; end if;
  select jsonb_build_object(
    'dia', p_dia,
    'fichas', coalesce((select jsonb_agg(f) from cc_fichas(p_dia) f), '[]'),
    'sem_ficha', (select count(*) from profiles p where p.role = 'student' and p.ativo
                    and not exists (select 1 from mesociclos m where m.aluna_id = p.id and m.status = 'ativo')),
    'sinais', coalesce((select jsonb_agg(s) from cc_sinais_clinicos(p_dia) s), '[]'),
    'alertas', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select a.id, a.envio_id, a.aluna_id, p.nome, p.telefone, a.titulo, a.texto, a.severidade, a.created_at
        from alertas_coach a join profiles p on p.id = a.aluna_id
        where a.visto_em is null and a.created_at >= p_dia - 14 limit 30) x), '[]'),
    'adesao', coalesce((select jsonb_agg(a) from cc_adesao(p_dia) a), '[]'),
    'adesao_alunas', coalesce((select jsonb_agg(a) from cc_adesao_alunas(p_dia) a), '[]'),
    'marcos', coalesce((select jsonb_agg(m) from cc_marcos(p_dia) m), '[]'),
    'agenda', coalesce((select jsonb_agg(g order by g.inicio) from (
        select g.*, p.nome, p.telefone from agenda g left join profiles p on p.id = g.aluna_id
        where g.inicio >= (p_dia::timestamp at time zone 'America/Sao_Paulo')
          and g.inicio < ((p_dia + 2)::timestamp at time zone 'America/Sao_Paulo')) g), '[]'),
    'oraculos', coalesce((select jsonb_agg(o order by o.desde) from (
        select 'checkin' as tipo, c.id, c.aluna_id, p.nome, c.semana, c.created_at as desde, null::text as titulo
        from checkins c join profiles p on p.id = c.aluna_id and p.ativo
        where c.resposta is null and c.semana >= p_dia - 14
        union all
        select 'envio', e.id, e.aluna_id, p.nome, null, e.enviado_em, f.titulo
        from envios e join formularios f on f.id = e.formulario_id join profiles p on p.id = e.aluna_id
        where f.tipo <> 'oraculo' and e.lido_em is null and e.enviado_em >= p_dia - 14) o), '[]'),
    'metas', coalesce((select jsonb_agg(x) from (
        select m.id, m.aluna_id, p.nome, coalesce(m.titulo, m.tipo) as titulo, m.prazo
        from metas m join profiles p on p.id = m.aluna_id and p.ativo
        where m.analisada_em is null and m.concluida_em is null and m.status not in ('batida','cancelada')
          and (m.status = 'nao_batida' or m.prazo < p_dia)) x), '[]'),
    'atrasadas', (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor), 0))
                  from lancamentos where tipo = 'receita' and pago_em is null and vencimento < p_dia),
    'estados', coalesce((select jsonb_agg(ve) from visoes_estado ve where ve.updated_at >= now() - interval '60 days'), '[]')
  ) into v_out;
  return v_out;
end $$;

-- as funções auxiliares não podem ser chamadas direto pela API (só pela RPC do coach)
revoke execute on function public.cc_fichas(date), public.cc_sinais_clinicos(date), public.cc_adesao_base(date),
  public.cc_adesao(date), public.cc_adesao_alunas(date), public.cc_marcos(date) from public;
do $$ begin
  revoke execute on function public.cc_fichas(date), public.cc_sinais_clinicos(date), public.cc_adesao_base(date),
    public.cc_adesao(date), public.cc_adesao_alunas(date), public.cc_marcos(date) from anon, authenticated;
exception when undefined_object then null; end $$;
grant execute on function public.centro_de_comando(date) to authenticated;

-- tempo real: o painel recarrega sozinho quando chega Oráculo ou alerta (plano gratuito do Supabase)
do $$ begin alter publication supabase_realtime add table public.alertas_coach; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.envios; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.checkins; exception when others then null; end $$;
