-- NEMESIS · atualização 6: Forja, Modelos, Tesouro, Chronos e Radar
-- Rode DEPOIS da atualização 5. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- Forja: formato das repetições ----------
alter table public.treino_itens add column if not exists reps_tipo text;
alter table public.treino_itens drop constraint if exists treino_itens_reps_tipo_ok;
alter table public.treino_itens add constraint treino_itens_reps_tipo_ok check (reps_tipo is null or reps_tipo in
  ('faixa','exata','reserva','maxima','falha','isometrica','pir_cresc','pir_decresc'));

-- nível da aluna (faixas de volume da barra ao vivo)
alter table public.profiles add column if not exists nivel text;
alter table public.profiles drop constraint if exists profiles_nivel_ok;
alter table public.profiles add constraint profiles_nivel_ok check (nivel is null or nivel in ('iniciante','intermediaria','avancada'));

create or replace function public.protege_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.role  := old.role;
    new.ativo := old.ativo;
    new.treinos_semana_alvo := old.treinos_semana_alvo;
    new.alistada_em := old.alistada_em;
    new.nivel := old.nivel;
  end if;
  return new;
end $$;

-- presets de linha ("Glúteo força: 4x6-8, RIR 2, 2s excêntrica, 120s")
create table if not exists public.presets_linha (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  dados       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
alter table public.presets_linha enable row level security;
drop policy if exists preset_coach on public.presets_linha;
create policy preset_coach on public.presets_linha for all using (public.is_coach()) with check (public.is_coach());
insert into public.presets_linha (nome, dados) values
  ('Glúteo força', '{"series":4,"reps":"6-8","reps_tipo":"faixa","esforco_tipo":"rir","esforco_alvo":2,"cadencia_exc":2,"cadencia_con":0,"descanso":120,"descanso_tipo":"exato","metodo":"padrao","aquecimento":1}'),
  ('Hipertrofia padrão', '{"series":3,"reps":"8-12","reps_tipo":"faixa","esforco_tipo":"rir","esforco_alvo":2,"cadencia_exc":2,"cadencia_con":0,"descanso":90,"descanso_tipo":"exato","metodo":"padrao","aquecimento":0}'),
  ('Metabólico', '{"series":3,"reps":"15-20","reps_tipo":"faixa","esforco_tipo":"rir","esforco_alvo":1,"cadencia_exc":1,"cadencia_con":0,"descanso":45,"descanso_tipo":"exato","metodo":"padrao","aquecimento":0}')
on conflict (nome) do nothing;

-- ---------- Modelos: treinos que pertencem a um modelo em vez de uma aluna ----------
create table if not exists public.modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  nivel       text check (nivel is null or nivel in ('iniciante','intermediaria','avancada')),
  descricao   text,
  created_at  timestamptz not null default now()
);
alter table public.modelos enable row level security;
drop policy if exists modelo_coach on public.modelos;
create policy modelo_coach on public.modelos for all using (public.is_coach()) with check (public.is_coach());

alter table public.treinos alter column aluna_id drop not null;
alter table public.treinos add column if not exists modelo_id uuid references public.modelos(id) on delete cascade;
alter table public.treinos drop constraint if exists treinos_dono_ok;
alter table public.treinos add constraint treinos_dono_ok check (aluna_id is not null or modelo_id is not null);
create index if not exists treinos_modelo on public.treinos(modelo_id);

alter table public.treino_itens alter column aluna_id drop not null;
alter table public.treino_itens add column if not exists modelo_id uuid references public.modelos(id) on delete cascade;
alter table public.treino_itens drop constraint if exists itens_dono_ok;
alter table public.treino_itens add constraint itens_dono_ok check (aluna_id is not null or modelo_id is not null);
create index if not exists itens_modelo on public.treino_itens(modelo_id);

-- mesociclo com progressão semanal: [{"rir":3},{"rir":2},{"rir":1},{"deload":true}]
alter table public.mesociclos add column if not exists progressao jsonb;

-- ---------- Biblioteca: etiquetas, perfil de resistência e grupo de substituição ----------
alter table public.exercicios add column if not exists equipamento text;
alter table public.exercicios add column if not exists articulacao text;
alter table public.exercicios add column if not exists perfil_resistencia text;
alter table public.exercicios add column if not exists substitutos uuid[] not null default '{}';

-- a aluna avisa o treinador quando troca um exercício (aparelho ocupado)
drop policy if exists alerta_troca on public.alertas_coach;
create policy alerta_troca on public.alertas_coach for insert to authenticated
  with check (aluna_id = auth.uid() and severidade = 'info');

-- ---------- Tesouro: plano como pacote de entregas ----------
alter table public.planos add column if not exists entregas jsonb;
update public.planos set entregas = '{"checkin_semanal":true,"lembrete_renovacao_dias":7}' where entregas is null and nome = 'Ágora';
update public.planos set entregas = '{"checkin_semanal":true,"call_mensal":true,"avaliacao_semanas":8,"lembrete_renovacao_dias":7}' where entregas is null and nome = 'Delfos';
update public.planos set entregas = '{"checkin_semanal":true,"call_mensal":true,"avaliacao_semanas":8,"relatorio_mensal":true,"lembrete_renovacao_dias":10}' where entregas is null and nome in ('Ítaca','Olimpo');

-- ---------- Chronos: tipos de compromisso ----------
alter table public.agenda drop constraint if exists agenda_tipo_check;
alter table public.agenda add constraint agenda_tipo_check check (tipo in ('video','avaliacao','outro','ritual','lembrete'));

notify pgrst, 'reload schema';
