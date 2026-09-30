-- NEMESIS · atualização 8: Arena completa, Prova com todos os protocolos, vídeos de execução,
-- dia de revisão, combo com nutri e aulas presenciais.
-- Rode DEPOIS da atualização 7. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- Arena: cadência por tipo, grupos de método e séries detalhadas ----------
alter table public.treino_itens add column if not exists cadencia_tipo text;
alter table public.treino_itens drop constraint if exists treino_itens_cadencia_tipo_ok;
alter table public.treino_itens add constraint treino_itens_cadencia_tipo_ok check (cadencia_tipo is null or cadencia_tipo in ('padrao','americana','simplificada'));
alter table public.treino_itens add column if not exists cadencia_texto text;          -- "3-1-1-0" (americana) ou lenta/moderada/rapida/explosiva
alter table public.treino_itens add column if not exists grupo smallint;                 -- bi-set, tri-set, circuito: mesmo número = feitos juntos
alter table public.treino_itens add column if not exists series_detalhe jsonb;          -- [{"reps":"12","carga":20,"rir":2}, ...] uma meta por série

-- RIR real que a aluna registra em cada série
alter table public.series add column if not exists rir numeric;

-- ---------- vídeos de execução (a aluna grava, o treinador corrige) ----------
create table if not exists public.videos_execucao (
  id              uuid primary key default gen_random_uuid(),
  aluna_id        uuid not null references public.profiles(id) on delete cascade,
  exercicio_id    uuid references public.exercicios(id) on delete set null,
  treino_item_id  uuid references public.treino_itens(id) on delete set null,
  sessao_id       uuid references public.sessoes(id) on delete set null,
  caminho         text not null,                 -- pasta privada "arquivos": <aluna>/videos/<arquivo>
  comentario      text,
  correcao        text,
  corrigido_em    timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists videos_execucao_aluna on public.videos_execucao(aluna_id, created_at desc);
alter table public.videos_execucao enable row level security;
drop policy if exists video_ler on public.videos_execucao;
drop policy if exists video_enviar on public.videos_execucao;
drop policy if exists video_coach on public.videos_execucao;
create policy video_ler    on public.videos_execucao for select using (aluna_id = auth.uid() or public.is_coach());
create policy video_enviar on public.videos_execucao for insert with check (aluna_id = auth.uid() or public.is_coach());
create policy video_coach  on public.videos_execucao for all using (public.is_coach()) with check (public.is_coach());

-- ---------- Prova: todos os protocolos + autoavaliação feita pela aluna ----------
alter table public.avaliacoes add column if not exists autoavaliacao boolean not null default false;
alter table public.avaliacoes drop constraint if exists avaliacoes_protocolo_ok;
alter table public.avaliacoes add constraint avaliacoes_protocolo_ok check (protocolo is null or protocolo in ('jp7','jp3','weltman','tran','slaughter','perimetria'));
-- a aluna só grava a própria autoavaliação (perimetria + fotos); o resto continua com o treinador
drop policy if exists aval_auto on public.avaliacoes;
create policy aval_auto on public.avaliacoes for insert to authenticated
  with check (aluna_id = auth.uid() and autoavaliacao and protocolo = 'perimetria');

-- ---------- perfil: dia de revisão e combo com nutricionista (só o treinador altera) ----------
alter table public.profiles add column if not exists dia_revisao smallint;
alter table public.profiles drop constraint if exists profiles_dia_revisao_ok;
alter table public.profiles add constraint profiles_dia_revisao_ok check (dia_revisao is null or dia_revisao between 0 and 6);
alter table public.profiles add column if not exists combo_nutri boolean not null default false;

create or replace function public.protege_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.role  := old.role;
    new.ativo := old.ativo;
    new.treinos_semana_alvo := old.treinos_semana_alvo;
    new.alistada_em := old.alistada_em;
    new.nivel := old.nivel;
    new.dia_revisao := old.dia_revisao;
    new.combo_nutri := old.combo_nutri;
  end if;
  return new;
end $$;

-- ---------- Tesouro: aulas presenciais incluídas no plano ----------
alter table public.assinaturas add column if not exists presenciais int check (presenciais is null or presenciais >= 0);

-- ---------- Chronos: compromisso do tipo aula presencial ----------
alter table public.agenda drop constraint if exists agenda_tipo_check;
alter table public.agenda add constraint agenda_tipo_check check (tipo in ('video','avaliacao','outro','ritual','lembrete','presencial'));

notify pgrst, 'reload schema';
