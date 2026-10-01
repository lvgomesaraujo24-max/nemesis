-- NEMESIS · atualização 12: LGPD (consentimento, direitos da aluna e exclusão de dados)
--  1. Consentimentos registrados sem edição (prova do aceite: LGPD art. 8º, §2º).
--  2. Pedidos da aluna (acesso, correção, exclusão, revogação) com status.
--  3. Exclusão completa da aluna pelo treinador, mantendo o financeiro sem o vínculo (obrigação fiscal).
--  4. Foto e vídeo enviados pela aluna exigem o consentimento de imagem; a aluna pode apagar os próprios arquivos.
-- Rode DEPOIS da atualização 11. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- ---------- 1. consentimentos: só se acrescenta, nunca se edita ----------
create table if not exists public.consentimentos (
  id                     uuid primary key default gen_random_uuid(),
  aluna_id               uuid not null references public.profiles(id) on delete cascade,
  versao                 text not null,                       -- versão dos textos aceitos (ex.: 2026-10-01)
  termos                 boolean not null default false,      -- Termos de Uso e ciência da Política de Privacidade
  saude                  boolean not null default false,      -- dados de saúde (LGPD art. 11, I)
  imagem                 boolean not null default false,      -- fotos de avaliação e vídeos de execução (opcional)
  menor                  boolean not null default false,      -- menor de 18: consentimento do responsável (art. 14, §1º)
  responsavel_nome       text,
  responsavel_parentesco text,
  responsavel_contato    text,
  criado_em              timestamptz not null default now(),
  constraint consentimento_menor_ok check (not menor or (length(trim(coalesce(responsavel_nome, ''))) >= 3 and length(trim(coalesce(responsavel_contato, ''))) >= 5))
);
create index if not exists consentimentos_aluna on public.consentimentos(aluna_id, criado_em desc);
alter table public.consentimentos enable row level security;
drop policy if exists consent_ler on public.consentimentos;
drop policy if exists consent_dar on public.consentimentos;
create policy consent_ler on public.consentimentos for select using (aluna_id = auth.uid() or public.is_coach());
-- só a própria aluna registra o próprio consentimento (o treinador não consente por ela)
create policy consent_dar on public.consentimentos for insert with check (aluna_id = auth.uid());
revoke update, delete on public.consentimentos from anon, authenticated;

-- carimbo do servidor: a data do aceite não vem do aparelho
create or replace function public.consentimento_carimba()
returns trigger language plpgsql set search_path = public as $$
begin
  new.criado_em := clock_timestamp();   -- relógio real: dois aceites seguidos nunca empatam
  return new;
end $$;
drop trigger if exists consentimento_carimba on public.consentimentos;
create trigger consentimento_carimba before insert on public.consentimentos for each row execute function public.consentimento_carimba();

-- último consentimento de imagem da aluna (usado nas regras de envio de foto e vídeo)
-- só responde sobre a própria aluna (ou para o treinador); para qualquer outra pessoa devolve falso
create or replace function public.consentiu_imagem(p_aluna uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select imagem from public.consentimentos
                   where aluna_id = p_aluna and (p_aluna = auth.uid() or public.is_coach())
                   order by criado_em desc, id limit 1), false);
$$;
revoke execute on function public.consentiu_imagem(uuid) from public, anon;
grant execute on function public.consentiu_imagem(uuid) to authenticated;

-- ---------- 2. pedidos da aluna sobre os próprios dados (art. 18) ----------
create table if not exists public.solicitacoes_privacidade (
  id           uuid primary key default gen_random_uuid(),
  aluna_id     uuid references public.profiles(id) on delete set null,   -- o registro do atendimento fica, sem a aluna
  tipo         text not null check (tipo in ('acesso','correcao','exclusao','revogacao','portabilidade','outro')),
  detalhe      text check (length(detalhe) <= 2000),
  status       text not null default 'aberta' check (status in ('aberta','atendida','recusada')),
  resposta     text check (length(resposta) <= 2000),
  criada_em    timestamptz not null default now(),
  atendida_em  timestamptz
);
create or replace function public.solicitacao_carimba()
returns trigger language plpgsql set search_path = public as $$
begin
  new.criada_em := clock_timestamp();
  return new;
end $$;
drop trigger if exists solicitacao_carimba on public.solicitacoes_privacidade;
create trigger solicitacao_carimba before insert on public.solicitacoes_privacidade for each row execute function public.solicitacao_carimba();
create index if not exists solicitacoes_abertas on public.solicitacoes_privacidade(status, criada_em);
alter table public.solicitacoes_privacidade enable row level security;
drop policy if exists sol_ler on public.solicitacoes_privacidade;
drop policy if exists sol_criar on public.solicitacoes_privacidade;
drop policy if exists sol_coach on public.solicitacoes_privacidade;
create policy sol_ler   on public.solicitacoes_privacidade for select using (aluna_id = auth.uid() or public.is_coach());
create policy sol_criar on public.solicitacoes_privacidade for insert with check (aluna_id = auth.uid() and status = 'aberta' and resposta is null and atendida_em is null);
create policy sol_coach on public.solicitacoes_privacidade for update using (public.is_coach()) with check (public.is_coach());

-- registro das exclusões feitas (sem nenhum dado da aluna): prova de que o pedido foi cumprido (art. 37)
create table if not exists public.registro_eliminacoes (
  id                          uuid primary key default gen_random_uuid(),
  eliminada_em                timestamptz not null default now(),
  motivo                      text check (motivo in ('pedido','guarda_vencida','outro')),
  conta_autenticacao_apagada  boolean not null default false
);
alter table public.registro_eliminacoes enable row level security;
drop policy if exists elim_ler on public.registro_eliminacoes;
create policy elim_ler on public.registro_eliminacoes for select using (public.is_coach());
revoke insert, update, delete on public.registro_eliminacoes from anon, authenticated;

-- ---------- 3. exclusão completa da aluna ----------
-- Apaga o perfil e tudo o que depende dele (treinos, check-ins, avaliações, Oráculo, dor, ciclo, Dossiê,
-- arquivos, vídeos, consentimentos...). Os lançamentos financeiros ficam, sem o vínculo com a aluna,
-- pelo prazo da legislação tributária (LGPD art. 16, I). Os arquivos do Storage são apagados pelo app antes.
create or replace function public.eliminar_aluna(p_aluna uuid, p_motivo text default 'pedido')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_auth boolean := false; v_perfil public.profiles%rowtype; v_tel text;
begin
  if not public.is_coach() then raise exception 'Somente o treinador'; end if;
  select * into v_perfil from public.profiles where id = p_aluna and role = 'student';
  if v_perfil.id is null then raise exception 'Aluna não encontrada'; end if;
  -- financeiro: ficam valores e datas, sem o vínculo e sem o nome
  update public.lancamentos
     set aluna_id = null, assinatura_id = null,
         descricao = case when length(trim(coalesce(v_perfil.nome, ''))) > 0 then replace(descricao, v_perfil.nome, 'aluna excluída') else descricao end
   where aluna_id = p_aluna or assinatura_id in (select id from public.assinaturas where aluna_id = p_aluna);
  -- convites e inscrição da bio da mesma pessoa
  delete from public.convites where aluna_id = p_aluna or (v_perfil.email is not null and lower(email) = lower(v_perfil.email));
  v_tel := regexp_replace(coalesce(v_perfil.telefone, ''), '\D', '', 'g');
  if length(v_tel) >= 10 then
    delete from public.leads where right(regexp_replace(whatsapp, '\D', '', 'g'), 10) = right(v_tel, 10);
  end if;
  update public.solicitacoes_privacidade set status = 'atendida', atendida_em = coalesce(atendida_em, now()), detalhe = null
    where aluna_id = p_aluna and status = 'aberta';
  update public.solicitacoes_privacidade set detalhe = null where aluna_id = p_aluna;
  delete from public.profiles where id = p_aluna;
  -- a conta de login também (se o banco permitir; senão, apagar em Authentication > Users)
  begin
    delete from auth.users where id = p_aluna;
    v_auth := true;
  exception when others then
    v_auth := false;
  end;
  insert into public.registro_eliminacoes (motivo, conta_autenticacao_apagada)
    values (case when p_motivo in ('pedido','guarda_vencida') then p_motivo else 'outro' end, v_auth);
  return jsonb_build_object('conta_autenticacao_apagada', v_auth);
end $$;
revoke execute on function public.eliminar_aluna(uuid, text) from public, anon;
grant execute on function public.eliminar_aluna(uuid, text) to authenticated;

-- ---------- 4. arquivos e vídeos ----------
-- a aluna pode apagar os próprios arquivos e vídeos
-- a aluna apaga o que ela mesma enviou (exame mandado pelo treinador ela pede por Privacidade)
drop policy if exists arq_apagar on public.arquivos_aluna;
create policy arq_apagar on public.arquivos_aluna for delete using (public.is_coach() or (aluna_id = auth.uid() and enviado_por = auth.uid()));
drop policy if exists video_apagar on public.videos_execucao;
create policy video_apagar on public.videos_execucao for delete using (aluna_id = auth.uid());
drop policy if exists "nemesis arquivos aluna apagar" on storage.objects;
create policy "nemesis arquivos aluna apagar" on storage.objects for delete
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);

-- foto (arquivo da categoria foto) e vídeo enviados pela aluna só com o consentimento de imagem
drop policy if exists arq_enviar on public.arquivos_aluna;
create policy arq_enviar on public.arquivos_aluna for insert with check (
  public.is_coach() or (aluna_id = auth.uid() and (public.consentiu_imagem(auth.uid())
    or (categoria is distinct from 'foto' and coalesce(tipo, '') not like 'image/%' and coalesce(tipo, '') not like 'video/%'))));
-- no Storage: fotos ficam em <aluna>/fotos/ e vídeos em <aluna>/videos/; a aluna só envia nessas pastas com o consentimento de imagem
drop policy if exists "nemesis arquivos aluna enviar" on storage.objects;
create policy "nemesis arquivos aluna enviar" on storage.objects for insert
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text
              and (coalesce((storage.foldername(name))[2], '') not in ('fotos', 'videos') or public.consentiu_imagem(auth.uid())));
drop policy if exists video_enviar on public.videos_execucao;
create policy video_enviar on public.videos_execucao for insert with check (
  public.is_coach() or (aluna_id = auth.uid() and public.consentiu_imagem(auth.uid())));

notify pgrst, 'reload schema';
