-- NEMESIS · atualização 15: metas da semana no Oráculo
-- No fim do Oráculo a aluna escreve as metas da próxima semana. No Oráculo seguinte, o próprio formulário
-- lembra o que ela se propôs ("Na semana passada você se propôs: ...") e pergunta como foi.
-- Só acrescenta perguntas ao Oráculo vivo que já existe (tipo 'oraculo'); não mexe nas respostas antigas.
-- Se você tirar essas perguntas em Formulários, não rode este arquivo de novo: elas voltariam.
-- Rode DEPOIS da atualização 14. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

do $$
declare f record; v_novas int;
begin
  for f in select id from public.formularios where tipo = 'oraculo' loop
    -- o comentário livre continua sendo a última pergunta
    update public.perguntas set ordem = 30 where formulario_id = f.id and chave = 'comentario' and ordem < 30;

    insert into public.perguntas (formulario_id, chave, ordem, tipo, titulo, titulo_variantes, ajuda, opcoes, obrigatoria, mostrar_se)
    values
      (f.id, 'metas_cumpridas', 20, 'multipla', 'Como foram as suas metas da semana passada?',
       '[{"quando": {"op": "respondida", "campo": "ctx.anterior.metas_semana"}, "titulo": "Na semana passada você se propôs: {{ctx.anterior.metas_semana}}. Como foi?"}]'::jsonb,
       null,
       '[{"valor": "todas", "rotulo": "Cumpri todas"}, {"valor": "parte", "rotulo": "Cumpri parte"}, {"valor": "nenhuma", "rotulo": "Não consegui cumprir"}]'::jsonb,
       true, '{"op": "respondida", "campo": "ctx.anterior.metas_semana"}'::jsonb),
      (f.id, 'metas_semana', 21, 'texto_longo', 'Quais são as suas metas para a próxima semana?',
       '[]'::jsonb,
       'Até 3 metas simples, que dependam só de você. Ex.: treinar 4 vezes, dormir 7 h por noite, beber 2,5 L de água por dia.',
       '[]'::jsonb, false, null)
    on conflict (formulario_id, chave) do nothing;
    get diagnostics v_novas = row_count;

    -- versão nova do formulário só quando as perguntas entraram agora
    if v_novas > 0 then
      update public.formularios set versao = coalesce(versao, 1) + 1 where id = f.id;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
