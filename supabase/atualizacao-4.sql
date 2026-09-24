-- ============================================================
-- NEMESIS · atualização 4
--  1. Treinador pode marcar formulários como lidos (faltava a regra de edição em envios).
--  2. Estresse do Oráculo passa de 1 a 5 para 0 a 10 (crítico = 9 ou mais).
--     O resumo semanal (checkins.estresse, de 1 a 5) continua existindo, com a nota
--     convertida; a nota original de 0 a 10 fica em checkins.estresse10.
-- Pode rodar de novo sem medo. Rode DEPOIS das atualizações 2 e 3.
-- ============================================================

-- 1. marcar como lido
drop policy if exists envio_marcar_lido on public.envios;
create policy envio_marcar_lido on public.envios for update using (public.is_coach()) with check (public.is_coach());

-- 2. estresse de 0 a 10
alter table public.checkins add column if not exists estresse10 smallint check (estresse10 between 0 and 10);

-- pergunta do Oráculo: escala de 0 a 10 (sobe a versão do formulário só se mudou algo)
with alterada as (
  update public.perguntas p
     set config = coalesce(p.config, '{}'::jsonb) || '{"min":0,"max":10,"ancoras":["tranquila","muito estressada"]}'::jsonb
    from public.formularios f
   where f.id = p.formulario_id and f.tipo = 'oraculo' and p.chave = 'estresse'
     and coalesce((p.config->>'max')::int, 5) <> 10
  returning p.formulario_id
)
update public.formularios set versao = versao + 1 where id in (select formulario_id from alterada);

-- dicas padrão que usavam "estresse 4 ou mais" (de 5) passam a 7 ou mais (de 10)
update public.dicas_condicionais
   set regra = '{"todas":[{"campo":"resp.sono","op":"<=","valor":2},{"campo":"resp.estresse","op":">=","valor":7}]}'::jsonb,
       texto = 'Sono ruim e estresse alto juntos pesam na recuperação. Nesta semana, termine as séries com 2 repetições de reserva.'
 where id = '0ac1e000-0000-4000-8000-000000000202';
update public.dicas_condicionais
   set regra = '{"todas":[{"campo":"resp.sono_horas","op":"<","valor":5},{"campo":"resp.estresse","op":">=","valor":7}]}'::jsonb
 where id = '0ac1e000-0000-4000-8000-000000000211';

-- envio do Oráculo: grava a nota de 0 a 10 e a convertida para o resumo
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
    insert into checkins (aluna_id, semana, peso, sono, energia, estresse, estresse10, fome, dieta, dor_muscular, dor_articular, dor_local, insonia, treinos_feitos, comentario)
    values (v_aluna, date_trunc('week', current_date)::date,
      (p_respostas->>'peso')::numeric, (p_respostas->>'sono')::int, (p_respostas->>'energia')::int,
      -- estresse agora vem de 0 a 10; o resumo antigo (1 a 5) recebe a conversão
      case when p_respostas ? 'estresse' then greatest(1, least(5, round((p_respostas->>'estresse')::numeric / 2)))::int end,
      (p_respostas->>'estresse')::numeric::smallint,
      (p_respostas->>'fome')::int, (p_respostas->>'dieta')::int, (p_respostas->>'dor_muscular')::int,
      case when v_max is not null then greatest(1, least(5, ceil((v_max->>'intensidade')::numeric / 2)))::int when p_respostas->>'tem_dor' = 'false' then 1 end,
      case when v_max is not null then public.nome_regiao(v_max->>'regiao', v_max->>'lado') end,
      case when p_respostas ? 'sono_horas' then (p_respostas->>'sono_horas')::numeric < 5 end,
      (p_respostas->>'treinos_feitos')::int, nullif(p_respostas->>'comentario', ''))
    on conflict (aluna_id, semana) do update set peso = excluded.peso, sono = excluded.sono, energia = excluded.energia, estresse = excluded.estresse, estresse10 = excluded.estresse10,
      fome = excluded.fome, dieta = excluded.dieta, dor_muscular = excluded.dor_muscular, dor_articular = excluded.dor_articular, dor_local = excluded.dor_local,
      insonia = excluded.insonia, treinos_feitos = excluded.treinos_feitos, comentario = excluded.comentario;
  end if;
  return v_envio;
end $$;

-- Acrópole: sinais de recuperação na escala nova (crítico: estresse 9+ com sono até 2; atenção: menos de 5 h e estresse 7+)
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
           case when x.estresse >= 9 and x.sono <= 2 then 'critico'
                when x.horas < 5 and x.estresse >= 7 then 'atencao' end,
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
