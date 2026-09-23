-- ============================================================
--  NEMESIS · Banco de dados completo
--  Como usar: Supabase > SQL Editor > New query > cole TUDO > Run.
--  Pode rodar de novo sem medo (idempotente).
--
--  Regra de ouro: a PRIMEIRA conta criada no app vira TREINADOR.
--  Todas as outras viram ALUNA. Então crie a sua conta antes de
--  mandar o link para qualquer aluna.
-- ============================================================

-- gen_random_uuid() já vem no Postgres do Supabase

-- ------------------------------------------------------------
-- 1. PERFIS (treinador e alunas)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'student' check (role in ('coach','student')),
  nome         text not null default '',
  email        text,
  telefone     text,
  nascimento   date,
  sexo         text not null default 'F' check (sexo in ('F','M')),
  objetivo     text,
  ativo        boolean not null default true,
  anamnese_ok  boolean not null default false,
  created_at   timestamptz not null default now()
);

-- quem é o treinador? (security definer para não entrar em loop com a RLS)
create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := 'student';
begin
  if not exists (select 1 from public.profiles where role = 'coach') then
    v_role := 'coach';
  end if;
  insert into public.profiles (id, email, nome, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', ''), v_role)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- aluna não pode se promover a treinadora nem mexer em "ativo"
create or replace function public.protege_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.role  := old.role;
    new.ativo := old.ativo;
  end if;
  return new;
end $$;

drop trigger if exists protege_perfil on public.profiles;
create trigger protege_perfil before update on public.profiles
  for each row execute function public.protege_perfil();

-- ------------------------------------------------------------
-- 2. BIBLIOTECA DE EXERCÍCIOS
-- ------------------------------------------------------------
create table if not exists public.exercicios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  grupo       text,
  video_url   text,
  instrucoes  text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. FICHA DE TREINO
-- ------------------------------------------------------------
create table if not exists public.treinos (
  id           uuid primary key default gen_random_uuid(),
  aluna_id     uuid not null references public.profiles(id) on delete cascade,
  nome         text not null,
  ordem        int  not null default 0,
  opcional     boolean not null default false,
  observacoes  text,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists treinos_aluna on public.treinos(aluna_id);

create table if not exists public.treino_itens (
  id            uuid primary key default gen_random_uuid(),
  treino_id     uuid not null references public.treinos(id) on delete cascade,
  aluna_id      uuid not null references public.profiles(id) on delete cascade,
  exercicio_id  uuid references public.exercicios(id) on delete set null,
  ordem         int  not null default 0,
  aquecimento   int  not null default 0,   -- séries de aproximação
  series        int  not null default 3,
  reps          text not null default '8-12',
  descanso      int  not null default 90,  -- segundos
  tecnica       text,                      -- bi-set, drop-set, rest-pause...
  obs           text
);
create index if not exists itens_treino on public.treino_itens(treino_id);

-- ------------------------------------------------------------
-- 4. EXECUÇÃO (sessões e séries registradas)
-- ------------------------------------------------------------
create table if not exists public.sessoes (
  id            uuid primary key default gen_random_uuid(),
  aluna_id      uuid not null references public.profiles(id) on delete cascade,
  treino_id     uuid references public.treinos(id) on delete set null,
  treino_nome   text,
  data          date not null default current_date,
  iniciada_em   timestamptz not null default now(),
  concluida_em  timestamptz,
  esforco       int check (esforco between 1 and 10),
  comentario    text
);
create index if not exists sessoes_aluna on public.sessoes(aluna_id, data);

create table if not exists public.series (
  id              uuid primary key default gen_random_uuid(),
  sessao_id       uuid not null references public.sessoes(id) on delete cascade,
  aluna_id        uuid not null references public.profiles(id) on delete cascade,
  treino_item_id  uuid references public.treino_itens(id) on delete set null,
  exercicio_id    uuid references public.exercicios(id) on delete set null,
  numero          int  not null,
  carga           numeric,       -- em branco = sem carga (elástico, peso do corpo)
  reps            int,
  aquecimento     boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists series_aluna_ex on public.series(aluna_id, exercicio_id);

-- ------------------------------------------------------------
-- 5. CHECK-IN SEMANAL
-- ------------------------------------------------------------
create table if not exists public.checkins (
  id              uuid primary key default gen_random_uuid(),
  aluna_id        uuid not null references public.profiles(id) on delete cascade,
  semana          date not null,               -- segunda-feira da semana
  peso            numeric,
  sono            int check (sono between 1 and 5),
  energia         int check (energia between 1 and 5),
  estresse        int check (estresse between 1 and 5),
  fome            int check (fome between 1 and 5),
  dor             int check (dor between 1 and 5),
  dieta           int check (dieta between 1 and 5),
  treinos_feitos  int,
  comentario      text,
  resposta        text,
  respondido_em   timestamptz,
  created_at      timestamptz not null default now(),
  unique (aluna_id, semana)
);

-- ------------------------------------------------------------
-- 6. ANAMNESE E AVALIAÇÃO FÍSICA
-- ------------------------------------------------------------
create table if not exists public.anamneses (
  aluna_id    uuid primary key references public.profiles(id) on delete cascade,
  respostas   jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.avaliacoes (
  id                  uuid primary key default gen_random_uuid(),
  aluna_id            uuid not null references public.profiles(id) on delete cascade,
  data                date not null default current_date,
  idade               int,
  peso                numeric,
  altura              numeric,   -- cm
  dobras              jsonb not null default '{}'::jsonb,  -- mm
  medidas             jsonb not null default '{}'::jsonb,  -- cm
  percentual_gordura  numeric,
  obs                 text,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. FORMULÁRIO DE INSCRIÇÃO (leads)
-- ------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  whatsapp         text not null,
  instagram        text,
  idade            int,
  objetivo         text,
  experiencia      text,
  dias_semana      text,
  local_treino     text,
  plano_interesse  text,
  mensagem         text,
  status           text not null default 'novo' check (status in ('novo','contatado','fechado','perdido')),
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. FINANCEIRO
-- ------------------------------------------------------------
create table if not exists public.planos (
  id      uuid primary key default gen_random_uuid(),
  nome    text not null unique,
  meses   int  not null,
  valor   numeric not null,
  ativo   boolean not null default true
);

insert into public.planos (nome, meses, valor) values
  ('Ágora', 1, 247), ('Delfos', 3, 647), ('Ítaca', 6, 1197), ('Olimpo', 12, 1997)
on conflict (nome) do nothing;

create table if not exists public.assinaturas (
  id               uuid primary key default gen_random_uuid(),
  aluna_id         uuid not null references public.profiles(id) on delete cascade,
  plano_id         uuid references public.planos(id) on delete set null,
  plano_nome       text,
  inicio           date not null default current_date,
  fim              date not null,
  valor            numeric not null,
  forma_pagamento  text,
  obs              text,
  created_at       timestamptz not null default now()
);

create table if not exists public.lancamentos (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('receita','despesa')),
  descricao      text not null,
  categoria      text,
  valor          numeric not null,
  vencimento     date not null default current_date,
  pago_em        date,
  aluna_id       uuid references public.profiles(id) on delete set null,
  assinatura_id  uuid references public.assinaturas(id) on delete cascade,
  created_at     timestamptz not null default now()
);
create index if not exists lanc_venc on public.lancamentos(vencimento);

-- ------------------------------------------------------------
-- 9. SEGURANÇA (RLS): cada aluna só vê o que é dela,
--    o treinador vê tudo. Financeiro e leads: só o treinador.
-- ------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.exercicios   enable row level security;
alter table public.treinos      enable row level security;
alter table public.treino_itens enable row level security;
alter table public.sessoes      enable row level security;
alter table public.series       enable row level security;
alter table public.checkins     enable row level security;
alter table public.anamneses    enable row level security;
alter table public.avaliacoes   enable row level security;
alter table public.leads        enable row level security;
alter table public.planos       enable row level security;
alter table public.assinaturas  enable row level security;
alter table public.lancamentos  enable row level security;

-- apaga políticas antigas para poder rodar de novo
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('profiles','exercicios','treinos','treino_itens','sessoes','series',
                             'checkins','anamneses','avaliacoes','leads','planos','assinaturas','lancamentos')
  loop execute format('drop policy %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- perfis
create policy perfil_ler    on public.profiles for select using (id = auth.uid() or public.is_coach());
create policy perfil_editar on public.profiles for update using (id = auth.uid() or public.is_coach());
create policy perfil_apagar on public.profiles for delete using (public.is_coach());

-- exercícios: todo mundo logado lê, só o treinador escreve
create policy ex_ler     on public.exercicios for select using (auth.role() = 'authenticated');
create policy ex_escrever on public.exercicios for all using (public.is_coach()) with check (public.is_coach());

-- ficha: aluna lê a própria, treinador escreve
create policy treino_ler      on public.treinos for select using (aluna_id = auth.uid() or public.is_coach());
create policy treino_escrever on public.treinos for all using (public.is_coach()) with check (public.is_coach());
create policy item_ler        on public.treino_itens for select using (aluna_id = auth.uid() or public.is_coach());
create policy item_escrever   on public.treino_itens for all using (public.is_coach()) with check (public.is_coach());

-- execução, check-in e anamnese: a aluna escreve os próprios
create policy sessao_tudo on public.sessoes   for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());
create policy serie_tudo  on public.series    for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());
create policy check_tudo  on public.checkins  for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());
create policy anam_tudo   on public.anamneses for all using (aluna_id = auth.uid() or public.is_coach()) with check (aluna_id = auth.uid() or public.is_coach());

-- avaliação: aluna só lê
create policy aval_ler      on public.avaliacoes for select using (aluna_id = auth.uid() or public.is_coach());
create policy aval_escrever on public.avaliacoes for all using (public.is_coach()) with check (public.is_coach());

-- leads: qualquer pessoa ENVIA o formulário, só o treinador lê
create policy lead_enviar on public.leads for insert to anon, authenticated with check (status = 'novo');
create policy lead_ler    on public.leads for select using (public.is_coach());
create policy lead_editar on public.leads for update using (public.is_coach());
create policy lead_apagar on public.leads for delete using (public.is_coach());

-- planos: público (aparece no formulário), só o treinador edita
create policy plano_ler      on public.planos for select using (true);
create policy plano_escrever on public.planos for all using (public.is_coach()) with check (public.is_coach());

-- assinatura: aluna vê a própria (vencimento), treinador tudo
create policy ass_ler      on public.assinaturas for select using (aluna_id = auth.uid() or public.is_coach());
create policy ass_escrever on public.assinaturas for all using (public.is_coach()) with check (public.is_coach());

-- lançamentos: só o treinador
create policy lanc_tudo on public.lancamentos for all using (public.is_coach()) with check (public.is_coach());

-- ------------------------------------------------------------
-- 10. BIBLIOTECA INICIAL DE EXERCÍCIOS (edite à vontade no app)
-- ------------------------------------------------------------
insert into public.exercicios (nome, grupo) values
  ('Agachamento livre', 'Quadríceps'), ('Agachamento no Smith', 'Quadríceps'),
  ('Agachamento búlgaro no Smith', 'Quadríceps'), ('Agachamento sumô na máquina', 'Adutores'),
  ('Leg press 45°', 'Quadríceps'), ('Hack machine', 'Quadríceps'), ('Cadeira extensora', 'Quadríceps'),
  ('Afundo com halteres', 'Quadríceps'), ('Elevação pélvica na máquina', 'Glúteos'),
  ('Elevação pélvica com barra', 'Glúteos'), ('Cadeira abdutora', 'Glúteos'),
  ('Cadeira abdutora 45°', 'Glúteos'), ('Glúteo na polia (coice)', 'Glúteos'),
  ('Abdução de quadril com elástico', 'Glúteos'), ('Stiff com barra', 'Posteriores'),
  ('Stiff com halteres', 'Posteriores'), ('Mesa flexora', 'Posteriores'), ('Cadeira flexora', 'Posteriores'),
  ('Cadeira adutora', 'Adutores'), ('Panturrilha em pé', 'Panturrilha'), ('Panturrilha sentada', 'Panturrilha'),
  ('Puxada frontal', 'Costas'), ('Puxada barra anatômica', 'Costas'), ('Pulley articulado', 'Costas'),
  ('Remada baixa', 'Costas'), ('Remada curvada com barra', 'Costas'), ('Remada unilateral com halter', 'Costas'),
  ('Remada barra anatômica', 'Costas'), ('Banco lombar', 'Lombar'),
  ('Supino reto com halteres', 'Peito'), ('Supino inclinado com halteres', 'Peito'), ('Crucifixo na máquina', 'Peito'),
  ('Desenvolvimento com halteres', 'Ombros'), ('Elevação lateral com halteres', 'Ombros'),
  ('Elevação lateral na polia', 'Ombros'), ('Crucifixo inverso', 'Ombros'),
  ('Rosca direta', 'Bíceps'), ('Rosca martelo', 'Bíceps'), ('Rosca na polia baixa', 'Bíceps'),
  ('Tríceps na polia (corda)', 'Tríceps'), ('Tríceps testa na polia', 'Tríceps'), ('Tríceps francês', 'Tríceps'),
  ('Prancha', 'Core'), ('Abdominal cross', 'Core'), ('Abdominal infra', 'Core'),
  ('Esteira (caminhada inclinada)', 'Cardio'), ('Bicicleta ergométrica', 'Cardio'), ('Escada', 'Cardio')
on conflict (nome) do nothing;
