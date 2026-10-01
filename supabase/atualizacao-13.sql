-- NEMESIS · atualização 13: fase do ciclo só para a própria aluna e o treinador
-- A função fase_ciclo (atualização 2) respondia para qualquer um, até sem login, sobre qualquer aluna:
-- fase do ciclo e uso de anticoncepcional hormonal (dado de saúde, LGPD art. 11).
-- Agora ela só responde para a própria aluna ou para o treinador. O app não chama a função direto
-- (ela é usada por dentro dos formulários vivos e do Centro de Comando), então nada muda nas telas.
-- Rode DEPOIS da atualização 12. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- a função original vira "fase_ciclo_base", fechada para chamada direta (mesmo padrão da atualização 11)
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'fase_ciclo_base' and pronamespace = 'public'::regnamespace) then
    alter function public.fase_ciclo(uuid, date) rename to fase_ciclo_base;
  end if;
end $$;
revoke execute on function public.fase_ciclo_base(uuid, date) from public, anon, authenticated;

create or replace function public.fase_ciclo(p_aluna uuid, p_dia date default current_date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_aluna is distinct from auth.uid() and not public.is_coach() then
    return jsonb_build_object('status', 'sem_acesso');
  end if;
  return public.fase_ciclo_base(p_aluna, p_dia);
end $$;
revoke execute on function public.fase_ciclo(uuid, date) from public, anon;
grant execute on function public.fase_ciclo(uuid, date) to authenticated;

-- funções auxiliares sem caminho de busca fixo (aviso do verificador do Supabase)
alter function public.nome_regiao(text, text) set search_path = public;
alter function public.avaliar_regra(jsonb, jsonb) set search_path = public;

notify pgrst, 'reload schema';
