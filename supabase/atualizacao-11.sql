-- NEMESIS · atualização 11: correções da auditoria técnica
--  1. Cadastro sem convite fica AGUARDANDO APROVAÇÃO do treinador (conta pausada, sem ver nada).
--  2. Biblioteca de exercícios, formulários, perguntas, aberturas e dicas: só treinador e aluna ativa leem.
--  3. Formulário público de inscrição com limites contra robôs.
-- Rode DEPOIS da atualização 10. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- 1. aluna ativa e cadastro aguardando aprovação ----------
alter table public.profiles add column if not exists aguardando boolean not null default false;

create or replace function public.is_aluna_ativa()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'student' and ativo);
$$;

-- conta nova: primeira = treinador; com convite válido = aluna ativa com os dados do convite;
-- sem convite = aluna pausada aguardando o treinador aprovar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := 'student';
  v_conv public.convites%rowtype;
  v_com_convite boolean := false;
begin
  if not exists (select 1 from public.profiles where role = 'coach') then
    v_role := 'coach';
  end if;
  if v_role = 'student' and (new.raw_user_meta_data->>'convite') is not null then
    select * into v_conv from public.convites
      where token = new.raw_user_meta_data->>'convite' and usado_em is null and expira_em > now()
      for update;
    v_com_convite := v_conv.id is not null;
  end if;
  insert into public.profiles (id, email, nome, role, telefone, objetivo, ativo, aguardando)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'nome', ''), v_conv.nome, ''), v_role, v_conv.telefone, v_conv.objetivo,
          v_role = 'coach' or v_com_convite, v_role = 'student' and not v_com_convite)
  on conflict (id) do nothing;
  -- o perfil precisa existir antes de o convite apontar para ele
  if v_com_convite then
    update public.convites set usado_em = now(), aluna_id = new.id where id = v_conv.id;
  end if;
  return new;
end $$;

-- a aluna não altera os campos que são do treinador (inclui o "aguardando")
create or replace function public.protege_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    new.role  := old.role;
    new.ativo := old.ativo;
    new.aguardando := old.aguardando;
    new.treinos_semana_alvo := old.treinos_semana_alvo;
    new.alistada_em := old.alistada_em;
    new.nivel := old.nivel;
    new.dia_revisao := old.dia_revisao;
    new.combo_nutri := old.combo_nutri;
  end if;
  return new;
end $$;

-- ---------- 2. leitura da metodologia só por treinador e aluna ativa ----------
drop policy if exists ex_ler on public.exercicios;
create policy ex_ler on public.exercicios for select using (public.is_coach() or public.is_aluna_ativa());
drop policy if exists form_ler on public.formularios;
create policy form_ler on public.formularios for select using (public.is_coach() or public.is_aluna_ativa());
drop policy if exists perg_ler on public.perguntas;
create policy perg_ler on public.perguntas for select using (public.is_coach() or public.is_aluna_ativa());
drop policy if exists abertura_ler on public.mensagens_abertura;
create policy abertura_ler on public.mensagens_abertura for select using (public.is_coach() or public.is_aluna_ativa());
drop policy if exists dica_ler on public.dicas_condicionais;
create policy dica_ler on public.dicas_condicionais for select using (public.is_coach() or (publico = 'aluna' and public.is_aluna_ativa()));

-- o pacote do formulário vivo (security definer) também passa a exigir treinador ou aluna ativa.
-- a função original vira "montar_formulario_base", fechada para chamada direta.
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'montar_formulario_base' and pronamespace = 'public'::regnamespace) then
    alter function public.montar_formulario(uuid, uuid) rename to montar_formulario_base;
  end if;
end $$;
revoke execute on function public.montar_formulario_base(uuid, uuid) from public, anon, authenticated;

create or replace function public.montar_formulario(p_formulario uuid, p_aluna uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_coach() or public.is_aluna_ativa()) then
    raise exception 'Seu acesso ainda não foi liberado pelo treinador.';
  end if;
  return public.montar_formulario_base(p_formulario, p_aluna);
end $$;

-- ---------- 3. formulário público de inscrição: limites contra robôs ----------
create or replace function public.leads_limites()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_digitos text := regexp_replace(coalesce(new.whatsapp, ''), '\D', '', 'g');
begin
  if public.is_coach() then return new; end if;
  if length(coalesce(new.nome, '')) not between 2 and 120 then raise exception 'Confira o seu nome.'; end if;
  if length(v_digitos) not between 10 and 15 then raise exception 'Confira o WhatsApp com DDD.'; end if;
  if length(coalesce(new.mensagem, '')) > 2000 or length(coalesce(new.instagram, '')) > 60 then raise exception 'Texto longo demais.'; end if;
  -- mesmo WhatsApp: até 3 inscrições por hora
  if (select count(*) from leads where regexp_replace(whatsapp, '\D', '', 'g') = v_digitos and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Recebemos a sua inscrição. Aguarde o contato pelo WhatsApp.';
  end if;
  -- todas as origens: até 20 inscrições a cada 10 minutos
  if (select count(*) from leads where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Muitas inscrições agora. Tente de novo em alguns minutos.';
  end if;
  return new;
end $$;
drop trigger if exists leads_limites on public.leads;
create trigger leads_limites before insert on public.leads for each row execute function public.leads_limites();

notify pgrst, 'reload schema';
