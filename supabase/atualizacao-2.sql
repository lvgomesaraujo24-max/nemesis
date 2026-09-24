-- ============================================================
--  NEMESIS · atualização 2: Crônica da Guerreira, testes aeróbicos, metas, Dossiê, cardio e formulários vivos
--  Para quem JÁ rodou o schema.sql: cole isto no SQL Editor e Run.
--  Pode rodar de novo sem medo. (Instalação nova: só o schema.sql basta.)
-- ============================================================

create table if not exists public.testes_aerobicos (
  id           uuid primary key default gen_random_uuid(),
  aluna_id     uuid not null references public.profiles(id) on delete cascade,
  data         date not null default current_date,
  protocolo    text not null,                          -- cooper, rockport, astrand...
  dados        jsonb not null default '{}'::jsonb,     -- o que foi digitado no teste
  vo2max       numeric,                                -- ml/kg/min (vazio no TC6)
  resultado    numeric,                                -- valor principal (VO2 ou distância)
  unidade      text not null default 'ml/kg/min',
  fc_repouso   int,
  fc_max       int,
  obs          text,
  created_at   timestamptz not null default now()
);
create index if not exists testes_aluna on public.testes_aerobicos(aluna_id, data);

create table if not exists public.metas (
  id             uuid primary key default gen_random_uuid(),
  aluna_id       uuid not null references public.profiles(id) on delete cascade,
  tipo           text not null check (tipo in ('carga','peso','gordura','medida','vo2','livre')),
  titulo         text,
  exercicio_id   uuid references public.exercicios(id) on delete set null,
  medida         text,                                 -- cintura, quadril... (tipo medida)
  valor_inicial  numeric,
  valor_alvo     numeric,
  prazo          date,
  concluida_em   date,
  created_at     timestamptz not null default now()
);
create index if not exists metas_aluna on public.metas(aluna_id);


alter table public.testes_aerobicos enable row level security;
alter table public.metas            enable row level security;

drop policy if exists teste_ler on public.testes_aerobicos;
drop policy if exists teste_escrever on public.testes_aerobicos;
drop policy if exists meta_ler on public.metas;
drop policy if exists meta_escrever on public.metas;

-- testes aeróbicos e metas: aluna só lê os dela, treinador escreve
create policy teste_ler      on public.testes_aerobicos for select using (aluna_id = auth.uid() or public.is_coach());
create policy teste_escrever on public.testes_aerobicos for all using (public.is_coach()) with check (public.is_coach());
create policy meta_ler       on public.metas for select using (aluna_id = auth.uid() or public.is_coach());
create policy meta_escrever  on public.metas for all using (public.is_coach()) with check (public.is_coach());

-- ------------------------------------------------------------
-- CRÔNICA DA GUERREIRA: dossiê auditado, check-in, metas, adesão
-- ------------------------------------------------------------

-- perfil: dia do alistamento e treinos planejados por semana (adesão)
alter table public.profiles add column if not exists alistada_em date;
alter table public.profiles add column if not exists treinos_semana_alvo smallint check (treinos_semana_alvo between 1 and 7);

create or replace function public.protege_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.role  := old.role;
    new.ativo := old.ativo;
    new.treinos_semana_alvo := old.treinos_semana_alvo;
    new.alistada_em := old.alistada_em;
  end if;
  return new;
end $$;

-- check-in: dor muscular e articular separadas, e insônia
alter table public.checkins add column if not exists dor_muscular int check (dor_muscular between 1 and 5);
alter table public.checkins add column if not exists dor_articular int check (dor_articular between 1 and 5);
alter table public.checkins add column if not exists dor_local text;
alter table public.checkins add column if not exists insonia boolean;

-- metas: status e análise de causa raiz obrigatória quando não batida
alter table public.metas add column if not exists status text not null default 'ativa';
alter table public.metas add column if not exists causa_categoria text;
alter table public.metas add column if not exists causa_descricao text;
alter table public.metas add column if not exists acao_corretiva text;
alter table public.metas add column if not exists analisada_em date;
alter table public.metas drop constraint if exists metas_status_ok;
alter table public.metas add constraint metas_status_ok check (status in ('ativa','batida','nao_batida','cancelada'));
alter table public.metas drop constraint if exists causa_raiz_completa;
alter table public.metas add constraint causa_raiz_completa check (
  analisada_em is null or (causa_categoria is not null and length(coalesce(causa_descricao,'')) >= 20 and acao_corretiva is not null));

-- DOSSIÊ DO COACH: só o treinador vê; ninguém apaga; toda edição vira versão
create table if not exists public.dossie (
  id             uuid primary key default gen_random_uuid(),
  aluna_id       uuid not null references public.profiles(id) on delete cascade,
  autor_id       uuid references public.profiles(id) on delete set null,
  registrado_em  timestamptz not null default now(),   -- carimbo do servidor, imutável
  capturado_em   timestamptz,                          -- hora no aparelho (registro sem sinal)
  ocorrido_em    timestamptz,
  tag            text not null check (tag in ('lesao','pausa','psicologia','ajuste_rota')),
  texto          text not null,
  regiao         text,
  lado           text check (lado in ('E','D','bilateral')),
  dor_eva        smallint check (dor_eva between 0 and 10),
  mecanismo      text,
  situacao       text check (situacao in ('ativa','monitorando','resolvida')),
  pausa_inicio   date,
  pausa_fim      date,
  motivo_pausa   text,
  marcadores     text[] not null default '{}',
  exercicio_id   uuid references public.exercicios(id) on delete set null,
  sessao_id      uuid references public.sessoes(id) on delete set null,
  checkin_id     uuid references public.checkins(id) on delete set null,
  versao         int not null default 1,
  arquivada_em   timestamptz
);
create index if not exists dossie_aluna on public.dossie(aluna_id, registrado_em desc);
create index if not exists dossie_tag on public.dossie(aluna_id, tag);

create table if not exists public.dossie_versoes (
  id              bigint generated always as identity primary key,
  nota_id         uuid not null references public.dossie(id) on delete cascade,
  versao          int not null,
  conteudo        jsonb not null,
  substituida_em  timestamptz not null default now()
);

create or replace function public.dossie_carimba()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.registrado_em := now();
  new.autor_id := auth.uid();
  new.versao := 1;
  return new;
end $$;
drop trigger if exists dossie_carimba on public.dossie;
create trigger dossie_carimba before insert on public.dossie for each row execute function public.dossie_carimba();

create or replace function public.dossie_audita()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.registrado_em is distinct from old.registrado_em
     or new.autor_id is distinct from old.autor_id
     or new.aluna_id is distinct from old.aluna_id
     or new.capturado_em is distinct from old.capturado_em then
    raise exception 'Carimbo, autor e aluna do dossiê não podem mudar';
  end if;
  insert into public.dossie_versoes (nota_id, versao, conteudo) values (old.id, old.versao, to_jsonb(old));
  new.versao := old.versao + 1;
  return new;
end $$;
drop trigger if exists dossie_audita on public.dossie;
create trigger dossie_audita before update on public.dossie for each row execute function public.dossie_audita();

alter table public.dossie enable row level security;
alter table public.dossie_versoes enable row level security;
drop policy if exists dossie_ler on public.dossie;
drop policy if exists dossie_criar on public.dossie;
drop policy if exists dossie_editar on public.dossie;
drop policy if exists versoes_ler on public.dossie_versoes;
create policy dossie_ler    on public.dossie for select using (public.is_coach());
create policy dossie_criar  on public.dossie for insert with check (public.is_coach());
create policy dossie_editar on public.dossie for update using (public.is_coach()) with check (public.is_coach());
create policy versoes_ler   on public.dossie_versoes for select using (public.is_coach());
-- sem política de delete: ninguém apaga pelo app
revoke delete on public.dossie from anon, authenticated;
revoke insert, update, delete on public.dossie_versoes from anon, authenticated;

-- ------------------------------------------------------------
-- CARDIO SIMPLIFICADO: prescrição semanal e registros da aluna
-- ------------------------------------------------------------
create table if not exists public.cardio_prescricoes (
  id              uuid primary key default gen_random_uuid(),
  aluna_id        uuid not null references public.profiles(id) on delete cascade,
  modalidade      text not null check (modalidade in ('esteira','bike','eliptico','escada','remo','rua')),
  modo            text check (modo in ('caminhada','corrida')),
  velocidade_kmh  numeric,
  inclinacao_pct  numeric,
  watts           numeric,
  nivel           text,
  mets_manual     numeric,
  mets            numeric,                 -- calculado na hora de salvar
  duracao_min     int not null,
  vezes_semana    int not null default 1 check (vezes_semana between 1 and 14),
  momento         text,                    -- pos_treino, dia_separado, qualquer
  obs             text,
  ordem           int not null default 0,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists cardio_presc_aluna on public.cardio_prescricoes(aluna_id);

create table if not exists public.cardio_registros (
  id               uuid primary key default gen_random_uuid(),
  aluna_id         uuid not null references public.profiles(id) on delete cascade,
  prescricao_id    uuid references public.cardio_prescricoes(id) on delete set null,
  data             date not null default current_date,
  modalidade       text not null,
  modo             text,
  velocidade_kmh   numeric,
  inclinacao_pct   numeric,
  watts            numeric,
  nivel            text,
  duracao_min      numeric not null,
  distancia_km     numeric,
  fc_media         int,
  percepcao        int check (percepcao between 1 and 10),
  mets             numeric,
  kcal             numeric,
  obs              text,
  created_at       timestamptz not null default now()
);
create index if not exists cardio_reg_aluna on public.cardio_registros(aluna_id, data);

alter table public.cardio_prescricoes enable row level security;
alter table public.cardio_registros enable row level security;
drop policy if exists cardio_presc_ler on public.cardio_prescricoes;
drop policy if exists cardio_presc_escrever on public.cardio_prescricoes;
drop policy if exists cardio_reg_tudo on public.cardio_registros;
create policy cardio_presc_ler on public.cardio_prescricoes for select using (aluna_id = auth.uid() or public.is_coach());
create policy cardio_presc_escrever on public.cardio_prescricoes for all using (public.is_coach()) with check (public.is_coach());
create policy cardio_reg_tudo on public.cardio_registros for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());

-- ------------------------------------------------------------
-- FORMULÁRIOS VIVOS: Oráculo e Alistamento com regras, memória e ciclo
-- Custo zero: regras rodam no aparelho e em PL/pgSQL; nenhuma API paga.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists ciclo_rastrear boolean not null default false;
alter table public.profiles add column if not exists ciclo_duracao_media smallint;
alter table public.profiles add column if not exists contracepcao text;

create table if not exists public.formularios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('alistamento','oraculo','livre')),
  titulo text not null,
  descricao text,
  versao int not null default 1,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.perguntas (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references public.formularios(id) on delete cascade,
  chave text not null,
  ordem int not null default 0,
  tipo text not null check (tipo in ('texto_curto','texto_longo','numero','multipla','caixas','escala','data','sim_nao','mapa_corporal','rir','ciclo')),
  titulo text not null,
  titulo_variantes jsonb not null default '[]',
  ajuda text,
  opcoes jsonb not null default '[]',
  config jsonb not null default '{}',
  obrigatoria boolean not null default true,
  mostrar_se jsonb,
  unique (formulario_id, chave)
);
create table if not exists public.dicas_condicionais (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid references public.formularios(id) on delete cascade,
  pergunta_chave text,
  regra jsonb not null,
  titulo text not null,
  texto text not null,
  fonte text,
  severidade text not null default 'info' check (severidade in ('info','atencao','alerta')),
  publico text not null default 'aluna' check (publico in ('aluna','coach')),
  prioridade int not null default 50,
  cooldown_dias int not null default 0,
  ativo boolean not null default true
);
create table if not exists public.mensagens_abertura (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid references public.formularios(id) on delete cascade,
  regra jsonb,
  texto text not null,
  prioridade int not null default 50
);
create table if not exists public.atribuicoes (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references public.formularios(id) on delete cascade,
  aluna_id uuid references public.profiles(id) on delete cascade,      -- vazio = todas
  entrega text not null default 'manual' check (entrega in ('manual','fim_treino')),
  quando text not null default 'agora' check (quando in ('agora','programado','recorrente')),
  agendado_para timestamptz,
  recorrencia jsonb,                                                    -- { "dias_semana": [5] } (0 = domingo)
  bloqueia_app boolean not null default false,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  formulario_id uuid not null references public.formularios(id) on delete cascade,
  versao int not null default 1,
  aluna_id uuid references public.profiles(id) on delete cascade,
  atribuicao_id uuid references public.atribuicoes(id) on delete set null,
  contexto jsonb not null default '{}',
  enviado_em timestamptz not null default now()
);
create index if not exists envios_aluna on public.envios(aluna_id, enviado_em desc);
create table if not exists public.respostas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.envios(id) on delete cascade,
  chave text not null,
  valor jsonb not null,
  unique (envio_id, chave)
);
create table if not exists public.dor_relatos (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references public.envios(id) on delete cascade,
  aluna_id uuid not null references public.profiles(id) on delete cascade,
  regiao text not null,
  lado text check (lado in ('E','D','centro')),
  intensidade smallint not null check (intensidade between 0 and 10),
  quando text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists dor_relatos_aluna on public.dor_relatos(aluna_id, regiao, lado, created_at desc);
create table if not exists public.ciclo_registros (
  id uuid primary key default gen_random_uuid(),
  aluna_id uuid not null references public.profiles(id) on delete cascade,
  inicio date not null,
  dias_sangramento smallint,
  unique (aluna_id, inicio)
);
create table if not exists public.dica_exibicoes (
  envio_id uuid not null references public.envios(id) on delete cascade,
  dica_id uuid not null references public.dicas_condicionais(id) on delete cascade,
  primary key (envio_id, dica_id)
);
create table if not exists public.alertas_coach (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references public.envios(id) on delete cascade,
  aluna_id uuid references public.profiles(id) on delete cascade,
  dica_id uuid references public.dicas_condicionais(id) on delete set null,
  titulo text, texto text, severidade text,
  visto_em timestamptz,
  created_at timestamptz not null default now()
);

-- nome legível da região do mapa corporal (espelho de nomeRegiao no motor.js)
create or replace function public.nome_regiao(p_regiao text, p_lado text)
returns text language sql immutable as $$
  select (case p_regiao when 'cervical' then 'coluna cervical' when 'toracica' then 'coluna torácica'
            when 'coxa_anterior' then 'coxa' when 'coxa_posterior' then 'coxa' else p_regiao end)
    || case when p_lado is null or p_lado = 'centro' then ''
            when p_regiao in ('coxa_anterior','coxa_posterior','panturrilha') then case p_lado when 'D' then ' direita' else ' esquerda' end
            else case p_lado when 'D' then ' direito' else ' esquerdo' end end
    || case p_regiao when 'coxa_anterior' then ' (frente)' when 'coxa_posterior' then ' (trás)' else '' end
$$;
create or replace function public.fase_ciclo(p_aluna uuid, p_dia date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_perfil record; v_inicio date; v_sang int; v_dur numeric; v_n int; v_desvio numeric;
  v_dia int; v_ov int; v_fase text;
begin
  select ciclo_rastrear, ciclo_duracao_media, contracepcao into v_perfil from profiles where id = p_aluna;
  if not coalesce(v_perfil.ciclo_rastrear, false) then return jsonb_build_object('status', 'desativado'); end if;
  if v_perfil.contracepcao in ('pilula_combinada', 'diu_hormonal', 'implante', 'injetavel', 'anel') then
    return jsonb_build_object('status', 'hormonal');   -- sem ciclo ovariano natural para estimar
  end if;

  select inicio, dias_sangramento into v_inicio, v_sang from ciclo_registros
    where aluna_id = p_aluna and inicio <= p_dia order by inicio desc limit 1;
  if v_inicio is null then return jsonb_build_object('status', 'sem_registro'); end if;

  -- duração: mediana dos últimos 6 intervalos válidos (21 a 45 dias); senão a informada; senão 28
  with regs as (select inicio, lead(inicio) over (order by inicio) - inicio as intervalo
                from ciclo_registros where aluna_id = p_aluna and inicio <= p_dia order by inicio desc limit 7)
  select percentile_cont(0.5) within group (order by intervalo), count(intervalo), stddev_samp(intervalo)
    into v_dur, v_n, v_desvio from regs where intervalo between 21 and 45;
  if v_n < 2 then v_dur := coalesce(v_perfil.ciclo_duracao_media, 28); end if;
  v_dur := round(v_dur); v_sang := coalesce(v_sang, 5);

  v_dia := (p_dia - v_inicio) + 1;
  if v_dia > v_dur + 7 then
    return jsonb_build_object('status', 'atrasado', 'dia_ciclo', v_dia, 'duracao', v_dur);
  end if;
  v_ov := v_dur - 14;                    -- fase lútea relativamente constante (cerca de 14 dias)

  v_fase := case
    when v_dia <= v_sang then 'menstrual'
    when v_dia < v_ov - 1 then 'folicular'
    when v_dia <= v_ov + 1 then 'ovulatoria'
    when v_dia <= v_dur - 5 then 'lutea'
    else 'lutea_tardia' end;

  return jsonb_build_object('status', 'ok', 'fase', v_fase, 'dia_ciclo', v_dia, 'duracao', v_dur,
    'ovulacao_estimada', v_inicio + v_ov - 1, 'proxima_menstruacao', v_inicio + v_dur::int,
    'confianca', case when v_n >= 3 and coalesce(v_desvio, 99) <= 3 then 'media' else 'baixa' end);
end $$;

create or replace function public.avaliar_regra(p_regra jsonb, p_fonte jsonb)
returns boolean language plpgsql immutable as $$
declare v_a jsonb; v_b jsonb; v_op text; r jsonb;
begin
  if p_regra is null then return true; end if;
  if p_regra ? 'todas' then
    for r in select * from jsonb_array_elements(p_regra->'todas') loop if not avaliar_regra(r, p_fonte) then return false; end if; end loop; return true;
  elsif p_regra ? 'alguma' then
    for r in select * from jsonb_array_elements(p_regra->'alguma') loop if avaliar_regra(r, p_fonte) then return true; end if; end loop; return false;
  elsif p_regra ? 'nao' then return not avaliar_regra(p_regra->'nao', p_fonte);
  end if;
  v_op := p_regra->>'op';
  v_a := p_fonte #> string_to_array(p_regra->>'campo', '.');
  v_b := p_regra->'valor';
  if jsonb_typeof(v_b) = 'string' and (v_b #>> '{}') ~ '^(ctx|resp|aluna)\.' then v_b := p_fonte #> string_to_array(v_b #>> '{}', '.'); end if;
  if v_op = 'respondida' then return v_a is not null and v_a <> 'null' and v_a <> '""' and v_a <> '[]'; end if;
  if v_op = 'vazia' then return not avaliar_regra(jsonb_build_object('campo', p_regra->>'campo', 'op', 'respondida'), p_fonte); end if;
  if v_a is null or v_a = 'null' then return false; end if;
  return case v_op
    when '=' then v_a = v_b
    when '!=' then v_a <> v_b
    when '<' then (v_a #>> '{}')::numeric < (v_b #>> '{}')::numeric
    when '<=' then (v_a #>> '{}')::numeric <= (v_b #>> '{}')::numeric
    when '>' then (v_a #>> '{}')::numeric > (v_b #>> '{}')::numeric
    when '>=' then (v_a #>> '{}')::numeric >= (v_b #>> '{}')::numeric
    when 'subiu' then v_b is not null and (v_a #>> '{}')::numeric > (v_b #>> '{}')::numeric
    when 'caiu' then v_b is not null and (v_a #>> '{}')::numeric < (v_b #>> '{}')::numeric
    when 'entre' then (v_a #>> '{}')::numeric between (v_b->>0)::numeric and (v_b->>1)::numeric
    when 'em' then v_b @> jsonb_build_array(v_a)
    when 'contem' then jsonb_typeof(v_a) = 'array' and (v_a @> jsonb_build_array(v_b))
    else false end;
exception when others then return false;   -- regra mal escrita nunca derruba o envio
end $$;


-- MEMÓRIA RELACIONAL: o pacote que o celular recebe ao abrir o formulário.
-- A aluna só monta o próprio; o treinador pode passar p_aluna para a prévia.
create or replace function public.montar_formulario(p_formulario uuid, p_aluna uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_aluna uuid; v_tipo text; v_ctx jsonb; v_seg date := date_trunc('week', current_date)::date;
begin
  v_aluna := case when p_aluna is not null and public.is_coach() then p_aluna else auth.uid() end;
  if v_aluna is null then raise exception 'Sem sessão'; end if;
  select tipo into v_tipo from formularios where id = p_formulario and (ativo or public.is_coach());
  if v_tipo is null then raise exception 'Formulário indisponível'; end if;

  with ultimo as (
    select e.id, e.enviado_em from envios e join formularios f on f.id = e.formulario_id
    where e.aluna_id = v_aluna and f.tipo = v_tipo order by e.enviado_em desc limit 1
  ), anterior as (
    select coalesce(jsonb_object_agg(r.chave, r.valor), '{}') j from respostas r join ultimo u on u.id = r.envio_id
  ), dores as (
    select distinct on (regiao, lado) regiao, lado, intensidade, quando, created_at
    from dor_relatos where aluna_id = v_aluna and created_at > now() - interval '21 days'
    order by regiao, lado, created_at desc
  ), dores_ativas as (
    select jsonb_agg(jsonb_build_object('regiao', regiao, 'lado', lado, 'intensidade', intensidade, 'quando', quando,
      'nome', public.nome_regiao(regiao, lado), 'ha_dias', current_date - created_at::date) order by intensidade desc, created_at desc) j
    from dores where intensidade >= 1
  ), metas_ctx as (
    select jsonb_agg(jsonb_build_object('titulo', coalesce(titulo, tipo), 'status', status, 'prazo', prazo, 'acao', acao_corretiva) order by prazo) j
    from metas where aluna_id = v_aluna
      and ((status = 'ativa' and prazo between current_date and current_date + 14) or (status = 'nao_batida' and analisada_em is not null))
  ), cooldown as (
    select coalesce(jsonb_agg(distinct x.dica_id), '[]') j
    from dica_exibicoes x join envios e on e.id = x.envio_id join dicas_condicionais d on d.id = x.dica_id
    where e.aluna_id = v_aluna and d.cooldown_dias > 0 and e.enviado_em > now() - make_interval(days => d.cooldown_dias)
  )
  select jsonb_build_object(
    'anterior', (select j from anterior), 'anterior_em', (select enviado_em from ultimo),
    'dores', coalesce((select j from dores_ativas), '[]'), 'ultima_dor', (select j -> 0 from dores_ativas),
    'metas', coalesce((select j from metas_ctx), '[]'),
    'semana_passada', jsonb_build_object('treinos', (select count(*) from sessoes where aluna_id = v_aluna and concluida_em is not null and data >= v_seg - 7 and data < v_seg)),
    'semana_atual', jsonb_build_object('treinos', (select count(*) from sessoes where aluna_id = v_aluna and concluida_em is not null and data >= v_seg and data < v_seg + 7)),
    'alvo_semana', coalesce((select treinos_semana_alvo from profiles where id = v_aluna),
                            nullif((select count(*) from treinos where aluna_id = v_aluna and ativo and not opcional), 0), 3),
    'ciclo', public.fase_ciclo(v_aluna, current_date),
    'dicas_em_cooldown', (select j from cooldown)) into v_ctx;

  return jsonb_build_object(
    'formulario', (select to_jsonb(f) from formularios f where id = p_formulario),
    'perguntas', (select coalesce(jsonb_agg(to_jsonb(p) order by ordem), '[]') from perguntas p where formulario_id = p_formulario),
    'dicas', (select coalesce(jsonb_agg(to_jsonb(d)), '[]') from dicas_condicionais d
              where ativo and publico = 'aluna' and (formulario_id is null or formulario_id = p_formulario)),
    'aberturas', (select coalesce(jsonb_agg(to_jsonb(m)), '[]') from mensagens_abertura m where formulario_id is null or formulario_id = p_formulario),
    'aluna', (select jsonb_build_object('primeiro_nome', split_part(nome, ' ', 1), 'objetivo', objetivo) from profiles where id = v_aluna),
    'ctx', v_ctx);
end $$;

-- ENVIO: grava numa transação, alimenta o check-in semanal, o ciclo e os alertas do treinador
create or replace function public.enviar_formulario(p_formulario uuid, p_versao int, p_atribuicao uuid, p_respostas jsonb, p_dicas uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare v_aluna uuid := auth.uid(); v_envio uuid; v_pacote jsonb; v_fonte jsonb; v_tipo text; d record; item jsonb; k text; v_max jsonb;
begin
  if v_aluna is null then raise exception 'Sem sessão'; end if;
  v_pacote := public.montar_formulario(p_formulario);
  select tipo into v_tipo from formularios where id = p_formulario;
  insert into envios (formulario_id, versao, aluna_id, atribuicao_id, contexto)
    values (p_formulario, coalesce(p_versao, 1), v_aluna, p_atribuicao, v_pacote->'ctx') returning id into v_envio;

  for k in select jsonb_object_keys(p_respostas) loop
    insert into respostas (envio_id, chave, valor) values (v_envio, k, p_respostas->k);
    if (select tipo from perguntas where formulario_id = p_formulario and chave = k) = 'mapa_corporal' and jsonb_typeof(p_respostas->k) = 'array' then
      for item in select * from jsonb_array_elements(p_respostas->k) loop
        insert into dor_relatos (envio_id, aluna_id, regiao, lado, intensidade, quando)
        values (v_envio, v_aluna, item->>'regiao', nullif(item->>'lado', ''), (item->>'intensidade')::smallint,
                coalesce(array(select jsonb_array_elements_text(coalesce(item->'quando', '[]'))), '{}'));
      end loop;
    end if;
    if (select tipo from perguntas where formulario_id = p_formulario and chave = k) = 'ciclo'
       and (p_respostas->k->>'menstruou') = 'true' and (p_respostas->k->>'inicio') is not null then
      insert into ciclo_registros (aluna_id, inicio) values (v_aluna, (p_respostas->k->>'inicio')::date) on conflict do nothing;
    end if;
  end loop;

  insert into dica_exibicoes (envio_id, dica_id)
    select v_envio, x from unnest(coalesce(p_dicas, '{}')) x where exists (select 1 from dicas_condicionais where id = x)
    on conflict do nothing;

  v_fonte := jsonb_build_object('resp', p_respostas, 'ctx', v_pacote->'ctx', 'aluna', v_pacote->'aluna');
  for d in select * from dicas_condicionais where ativo and publico = 'coach' and (formulario_id is null or formulario_id = p_formulario) loop
    if public.avaliar_regra(d.regra, v_fonte) then
      insert into alertas_coach (envio_id, aluna_id, dica_id, titulo, texto, severidade) values (v_envio, v_aluna, d.id, d.titulo, d.texto, d.severidade);
    end if;
  end loop;

  -- o Oráculo continua alimentando a tabela checkins (Crônica, Painel, alertas antigos)
  if v_tipo = 'oraculo' then
    select x into v_max from jsonb_array_elements(case when p_respostas->>'tem_dor' = 'true' and jsonb_typeof(p_respostas->'dores') = 'array' then p_respostas->'dores' else '[]' end) x
      order by (x->>'intensidade')::int desc limit 1;
    insert into checkins (aluna_id, semana, peso, sono, energia, estresse, fome, dieta, dor_muscular, dor_articular, dor_local, insonia, treinos_feitos, comentario)
    values (v_aluna, date_trunc('week', current_date)::date,
      (p_respostas->>'peso')::numeric, (p_respostas->>'sono')::int, (p_respostas->>'energia')::int, (p_respostas->>'estresse')::int,
      (p_respostas->>'fome')::int, (p_respostas->>'dieta')::int, (p_respostas->>'dor_muscular')::int,
      case when v_max is not null then greatest(1, least(5, ceil((v_max->>'intensidade')::numeric / 2)))::int when p_respostas->>'tem_dor' = 'false' then 1 end,
      case when v_max is not null then public.nome_regiao(v_max->>'regiao', v_max->>'lado') end,
      case when p_respostas ? 'sono_horas' then (p_respostas->>'sono_horas')::numeric < 5 end,
      (p_respostas->>'treinos_feitos')::int, nullif(p_respostas->>'comentario', ''))
    on conflict (aluna_id, semana) do update set peso = excluded.peso, sono = excluded.sono, energia = excluded.energia, estresse = excluded.estresse,
      fome = excluded.fome, dieta = excluded.dieta, dor_muscular = excluded.dor_muscular, dor_articular = excluded.dor_articular, dor_local = excluded.dor_local,
      insonia = excluded.insonia, treinos_feitos = excluded.treinos_feitos, comentario = excluded.comentario;
  end if;
  return v_envio;
end $$;

-- SEGURANÇA
alter table public.formularios enable row level security;
alter table public.perguntas enable row level security;
alter table public.dicas_condicionais enable row level security;
alter table public.mensagens_abertura enable row level security;
alter table public.atribuicoes enable row level security;
alter table public.envios enable row level security;
alter table public.respostas enable row level security;
alter table public.dor_relatos enable row level security;
alter table public.ciclo_registros enable row level security;
alter table public.dica_exibicoes enable row level security;
alter table public.alertas_coach enable row level security;
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('formularios','perguntas','dicas_condicionais','mensagens_abertura','atribuicoes','envios','respostas','dor_relatos','ciclo_registros','dica_exibicoes','alertas_coach')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;
create policy form_ler on public.formularios for select using (auth.role() = 'authenticated');
create policy form_escrever on public.formularios for all using (public.is_coach()) with check (public.is_coach());
create policy perg_ler on public.perguntas for select using (auth.role() = 'authenticated');
create policy perg_escrever on public.perguntas for all using (public.is_coach()) with check (public.is_coach());
create policy dica_ler on public.dicas_condicionais for select using (publico = 'aluna' or public.is_coach());
create policy dica_escrever on public.dicas_condicionais for all using (public.is_coach()) with check (public.is_coach());
create policy abertura_ler on public.mensagens_abertura for select using (auth.role() = 'authenticated');
create policy abertura_escrever on public.mensagens_abertura for all using (public.is_coach()) with check (public.is_coach());
create policy atrib_ler on public.atribuicoes for select using (aluna_id is null or aluna_id = auth.uid() or public.is_coach());
create policy atrib_escrever on public.atribuicoes for all using (public.is_coach()) with check (public.is_coach());
create policy envio_ler on public.envios for select using (aluna_id = auth.uid() or public.is_coach());
create policy envio_apagar on public.envios for delete using (public.is_coach());
create policy resp_ler on public.respostas for select using (exists (select 1 from public.envios e where e.id = envio_id and (e.aluna_id = auth.uid() or public.is_coach())));
create policy dor_ler on public.dor_relatos for select using (aluna_id = auth.uid() or public.is_coach());
create policy ciclo_tudo on public.ciclo_registros for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());
create policy exib_ler on public.dica_exibicoes for select using (public.is_coach());
create policy alerta_ler on public.alertas_coach for select using (public.is_coach());
create policy alerta_editar on public.alertas_coach for update using (public.is_coach()) with check (public.is_coach());

-- Oráculo padrão (gerado a partir de js/motor.js; ids fixos, não sobrescreve suas edições)
insert into public.formularios (id, tipo, titulo, descricao, versao, ativo) values ($t$0ac1e000-0000-4000-8000-000000000001$t$, $t$oraculo$t$, $t$Oráculo da semana$t$, $t$Check-in semanal. Leva uns 2 minutos.$t$, 1, true) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000101$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$peso$t$, 1, $t$numero$t$, $t$Peso em jejum (kg)$t$, $j$[{"quando":{"campo":"ctx.anterior.peso","op":"respondida"},"titulo":"Peso em jejum (kg). Na semana passada: {{ctx.anterior.peso}} kg"}]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":30,"max":250,"passo":0.1}$j$::jsonb, false, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000102$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$treinos_feitos$t$, 2, $t$numero$t$, $t$Quantos treinos você fez nesta semana?$t$, $j$[{"quando":{"campo":"ctx.semana_atual.treinos","op":">","valor":0},"titulo":"O app registrou {{ctx.semana_atual.treinos}} treino(s) nesta semana. Confere?"}]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":0,"max":14,"padrao":"ctx.semana_atual.treinos"}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000103$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$sono_horas$t$, 3, $t$multipla$t$, $t$Quantas horas você dormiu por noite, em média?$t$, $j$[{"quando":{"campo":"ctx.anterior.sono_horas","op":"<","valor":6},"titulo":"Na semana passada você dormiu menos de 6 h por noite. E nesta?"}]$j$::jsonb, null, $j$[{"valor":"lt5","rotulo":"Menos de 5 h","num":4.5},{"valor":"5a6","rotulo":"5 a 6 h","num":5.5},{"valor":"6a7","rotulo":"6 a 7 h","num":6.5},{"valor":"7a8","rotulo":"7 a 8 h","num":7.5},{"valor":"gt8","rotulo":"Mais de 8 h","num":8.5}]$j$::jsonb, $j${}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000104$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$sono$t$, 4, $t$escala$t$, $t$Qualidade do sono$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["péssimo","ótimo"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000105$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$energia$t$, 5, $t$escala$t$, $t$Energia no dia a dia$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["sem energia","muita energia"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000106$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$estresse$t$, 6, $t$escala$t$, $t$Estresse$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["tranquila","muito estressada"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000107$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$fome$t$, 7, $t$escala$t$, $t$Fome$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["pouca","muita"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000108$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dieta$t$, 8, $t$escala$t$, $t$Alimentação da semana$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["saiu do plano","no plano"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000109$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dor_muscular$t$, 9, $t$escala$t$, $t$Dor muscular pós-treino$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":1,"max":5,"ancoras":["nenhuma","muita"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000110$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dor_evolucao$t$, 10, $t$escala$t$, $t$Como está a região que doía?$t$, $j$[{"quando":{"campo":"ctx.ultima_dor.intensidade","op":">=","valor":1},"titulo":"No último relato, você marcou dor {{ctx.ultima_dor.intensidade}} de 10 em {{ctx.ultima_dor.nome}}. Como está essa região hoje?"}]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":0,"max":10,"ancoras":["sem dor","pior dor que já senti"]}$j$::jsonb, true, $j${"campo":"ctx.ultima_dor","op":"respondida"}$j$::jsonb) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000111$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$tem_dor$t$, 11, $t$sim_nao$t$, $t$Sentiu dor nas articulações ou algum desconforto nesta semana?$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000112$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dores$t$, 12, $t$mapa_corporal$t$, $t$Toque na estátua onde doeu$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${}$j$::jsonb, true, $j${"campo":"resp.tem_dor","op":"=","valor":true}$j$::jsonb) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000113$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$esforco_semana$t$, 13, $t$escala$t$, $t$Quão pesados foram os treinos da semana?$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${"min":0,"max":10,"ancoras":["muito leve","máximo"]}$j$::jsonb, true, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000114$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$rir_principal$t$, 14, $t$rir$t$, $t$Na última série do exercício principal, quantas repetições ainda caberiam?$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${}$j$::jsonb, false, null) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000115$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$ciclo$t$, 15, $t$ciclo$t$, $t$Sua menstruação começou desde o último Oráculo?$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${}$j$::jsonb, true, $j${"campo":"ctx.ciclo.status","op":"em","valor":["ok","atrasado","sem_registro"]}$j$::jsonb) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000116$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$sintomas$t$, 16, $t$caixas$t$, $t$Algum sintoma do ciclo nesta semana?$t$, $j$[]$j$::jsonb, null, $j$[{"valor":"colica","rotulo":"Cólica"},{"valor":"inchaco","rotulo":"Inchaço"},{"valor":"dor_cabeca","rotulo":"Dor de cabeça"},{"valor":"sono_pior","rotulo":"Sono pior"},{"valor":"mais_fome","rotulo":"Mais fome"},{"valor":"nenhum","rotulo":"Nenhum"}]$j$::jsonb, $j${}$j$::jsonb, false, $j${"alguma":[{"campo":"ctx.ciclo.fase","op":"em","valor":["lutea_tardia","menstrual"]},{"campo":"resp.ciclo.menstruou","op":"=","valor":true}]}$j$::jsonb) on conflict (id) do nothing;
insert into public.perguntas (id, formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, config, obrigatoria, mostrar_se) values ($t$0ac1e000-0000-4000-8000-000000000117$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$comentario$t$, 17, $t$texto_longo$t$, $t$Como foi a semana? Algo para me contar?$t$, $j$[]$j$::jsonb, null, $j$[]$j$::jsonb, $j${}$j$::jsonb, false, null) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000201$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$sono_horas$t$, $j${"campo":"resp.sono_horas","op":"<","valor":5}$j$::jsonb, $t$Noite curta$t$, $t$Dormir pouco atrapalha a recuperação muscular. Nos próximos treinos, faça os exercícios base com 2 ou 3 repetições de reserva, sem buscar a falha.$t$, $t$https://doi.org/10.14814/phy2.14660$t$, $t$atencao$t$, $t$aluna$t$, 80, 3, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000202$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$estresse$t$, $j${"todas":[{"campo":"resp.sono","op":"<=","valor":2},{"campo":"resp.estresse","op":">=","valor":4}]}$j$::jsonb, $t$Semana puxada$t$, $t$Sono ruim e estresse alto juntos pesam na recuperação. Nesta semana, termine as séries com 2 repetições de reserva.$t$, null, $t$atencao$t$, $t$aluna$t$, 70, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000203$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dores$t$, $j${"campo":"resp.dores_max","op":">=","valor":7}$j$::jsonb, $t$Dor forte$t$, $t$Dor acima de 7 merece avaliação de um profissional de saúde. Até lá, não treine a região que dói; eu vou te procurar para ajustar a ficha.$t$, null, $t$alerta$t$, $t$aluna$t$, 95, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000204$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dor_evolucao$t$, $j${"campo":"resp.dor_evolucao","op":"subiu","valor":"ctx.ultima_dor.intensidade"}$j$::jsonb, $t$A dor aumentou$t$, $t$Obrigado por avisar. Evite os exercícios que provocam essa dor até eu revisar a sua ficha.$t$, null, $t$alerta$t$, $t$aluna$t$, 90, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000205$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$dor_evolucao$t$, $j${"campo":"resp.dor_evolucao","op":"caiu","valor":"ctx.ultima_dor.intensidade"}$j$::jsonb, $t$Está melhorando$t$, $t$A dor diminuiu desde o último relato. Siga com cuidado e sem pular etapas.$t$, null, $t$info$t$, $t$aluna$t$, 40, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000206$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$rir_principal$t$, $j${"campo":"resp.rir_principal","op":">=","valor":9.5}$j$::jsonb, $t$Na falha toda semana?$t$, $t$Chegar à falha de vez em quando tudo bem; toda semana cansa mais do que ajuda. Tente parar com 1 ou 2 repetições de reserva no exercício principal.$t$, null, $t$info$t$, $t$aluna$t$, 50, 14, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000207$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$sintomas$t$, $j${"campo":"resp.sintomas","op":"contem","valor":"colica"}$j$::jsonb, $t$Cólica$t$, $t$Se a cólica estiver forte, pode trocar o treino do dia por um mais leve ou por uma caminhada. Respeite o seu corpo e me conte como foi.$t$, null, $t$info$t$, $t$aluna$t$, 60, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000208$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $t$treinos_feitos$t$, $j${"campo":"resp.treinos_feitos","op":"<","valor":"ctx.alvo_semana"}$j$::jsonb, $t$Semana abaixo do planejado$t$, $t$Tudo bem. Me conta no final o que atrapalhou: a gente ajusta o plano à sua rotina, não o contrário.$t$, null, $t$info$t$, $t$aluna$t$, 30, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000209$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, null, $j${"todas":[{"campo":"ctx.ultima_dor.intensidade","op":">=","valor":3},{"campo":"resp.dor_evolucao","op":">=","valor":3}]}$j$::jsonb, $t$Dor persistente$t$, $t$A dor relatada no último Oráculo continua em 3 ou mais. Vale revisar a ficha e registrar no Dossiê.$t$, null, $t$alerta$t$, $t$coach$t$, 90, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000210$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, null, $j${"campo":"resp.dores_max","op":">=","valor":7}$j$::jsonb, $t$Dor forte relatada$t$, $t$Dor de 7 ou mais no mapa corporal. Entrar em contato e orientar avaliação profissional.$t$, null, $t$alerta$t$, $t$coach$t$, 95, 0, true) on conflict (id) do nothing;
insert into public.dicas_condicionais (id, formulario_id, pergunta_chave, regra, titulo, texto, fonte, severidade, publico, prioridade, cooldown_dias, ativo) values ($t$0ac1e000-0000-4000-8000-000000000211$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, null, $j${"todas":[{"campo":"resp.sono_horas","op":"<","valor":5},{"campo":"resp.estresse","op":">=","valor":4}]}$j$::jsonb, $t$Recuperação comprometida$t$, $t$Menos de 5 h de sono com estresse alto. Considere reduzir volume ou intensidade nesta semana.$t$, null, $t$atencao$t$, $t$coach$t$, 70, 0, true) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000301$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $j${"campo":"ctx.ciclo.fase","op":"=","valor":"menstrual"}$j$::jsonb, $t${{aluna.primeiro_nome}}, dias de menstruação pedem escuta. Se houver cólica ou cansaço, me conta aqui: a gente ajusta pelo que você sente, não pelo calendário.$t$, 60) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000302$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $j${"campo":"ctx.ciclo.fase","op":"em","valor":["folicular","ovulatoria"]}$j$::jsonb, $t${{aluna.primeiro_nome}}, como foi sua semana? Conta com detalhes: é com isso que eu calibro o próximo passo.$t$, 60) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000303$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $j${"campo":"ctx.ciclo.fase","op":"=","valor":"lutea"}$j$::jsonb, $t${{aluna.primeiro_nome}}, se o corpo pedir mais descanso ou o sono piorar nesses dias, é comum. Registra aqui que eu levo em conta na carga.$t$, 60) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000304$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $j${"campo":"ctx.ciclo.fase","op":"=","valor":"lutea_tardia"}$j$::jsonb, $t${{aluna.primeiro_nome}}, reta final do ciclo. Inchaço, fome maior e treino mais pesado de sentir acontecem com muitas mulheres. Sem culpa: responde com sinceridade e a gente ajusta.$t$, 60) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000305$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, $j${"campo":"ctx.ciclo.status","op":"=","valor":"atrasado"}$j$::jsonb, $t$Sua última menstruação registrada foi há {{ctx.ciclo.dia_ciclo}} dias. Se quiser, atualiza a data na pergunta do ciclo.$t$, 70) on conflict (id) do nothing;
insert into public.mensagens_abertura (id, formulario_id, regra, texto, prioridade) values ($t$0ac1e000-0000-4000-8000-000000000306$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, null, $t${{aluna.primeiro_nome}}, hora do Oráculo. Leva uns 2 minutos.$t$, 0) on conflict (id) do nothing;
insert into public.atribuicoes (id, formulario_id, aluna_id, entrega, quando, agendado_para, recorrencia, bloqueia_app, ativa, created_at) values ($t$0ac1e000-0000-4000-8000-000000000401$t$, $t$0ac1e000-0000-4000-8000-000000000001$t$, null, $t$manual$t$, $t$recorrente$t$, null, $j${"dias_semana":[5]}$j$::jsonb, false, true, $t$2026-01-01T00:00:00Z$t$) on conflict (id) do nothing;
