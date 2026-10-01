-- NEMESIS · atualização 9: ficha da aluna completa (modelos com objetivo, prazo nos formulários,
-- pose das fotos de evolução e convite com link único).
-- Rode DEPOIS da atualização 8. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- Modelos: objetivo, frequência e duração ----------
alter table public.modelos add column if not exists objetivo text;
alter table public.modelos add column if not exists frequencia_semanal smallint check (frequencia_semanal is null or frequencia_semanal between 1 and 14);
alter table public.modelos add column if not exists duracao_semanas smallint check (duracao_semanas is null or duracao_semanas between 1 and 104);

-- ---------- Formulários: prazo para responder (depois dele fica "atrasado") ----------
alter table public.atribuicoes add column if not exists prazo date;

-- ---------- Arquivos: pose da foto de evolução (frente, lado, costas) para o antes e depois ----------
alter table public.arquivos_aluna add column if not exists pose text;
alter table public.arquivos_aluna drop constraint if exists arquivos_aluna_pose_ok;
alter table public.arquivos_aluna add constraint arquivos_aluna_pose_ok check (pose is null or pose in ('frente','lado','costas'));

-- ---------- Convite com link único ----------
create table if not exists public.convites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique check (length(token) >= 24),
  nome        text,
  email       text,
  telefone    text,
  objetivo    text,
  expira_em   timestamptz not null default now() + interval '7 days',
  usado_em    timestamptz,
  aluna_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.convites enable row level security;
drop policy if exists convite_coach on public.convites;
create policy convite_coach on public.convites for all using (public.is_coach()) with check (public.is_coach());

-- a tela de entrada (ainda sem login) só consegue ver o nome e o e-mail do convite, e só com o token
create or replace function public.ver_convite(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('nome', nome, 'email', email, 'usado', usado_em is not null, 'valido', usado_em is null and expira_em > now())
  from convites where token = p_token;
$$;
revoke all on function public.ver_convite(text) from public;
grant execute on function public.ver_convite(text) to anon, authenticated;

-- o cadastro feito pelo link do convite já nasce com nome, WhatsApp e objetivo, e marca o convite como usado
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := 'student';
  v_conv public.convites%rowtype;
begin
  if not exists (select 1 from public.profiles where role = 'coach') then
    v_role := 'coach';
  end if;
  if v_role = 'student' and (new.raw_user_meta_data->>'convite') is not null then
    select * into v_conv from public.convites
      where token = new.raw_user_meta_data->>'convite' and usado_em is null and expira_em > now()
      for update;
  end if;
  insert into public.profiles (id, email, nome, role, telefone, objetivo)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'nome', ''), v_conv.nome, ''), v_role, v_conv.telefone, v_conv.objetivo)
  on conflict (id) do nothing;
  -- o perfil precisa existir antes de o convite apontar para ele
  if v_conv.id is not null then
    update public.convites set usado_em = now(), aluna_id = new.id where id = v_conv.id;
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
