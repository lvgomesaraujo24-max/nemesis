# Banco de dados (Supabase)

## Como as mudanças chegam ao banco
1. `supabase/schema.sql`: instalação do zero. Idempotente.
2. `supabase/atualizacao-N.sql`: cada mudança depois disso, em ordem. Também idempotente (`if not exists`, `drop policy if exists`, `create or replace`).
3. Rodar no Supabase: **SQL Editor > New query > colar > Run**. Não usamos a CLI do Supabase (ver `docs/decisoes.md`).

| Arquivo | O que trouxe |
|---|---|
| `schema.sql` | perfis, exercícios, treinos, sessões, séries, check-ins, anamnese, avaliações, inscrições, planos, assinaturas, lançamentos |
| `atualizacao-2.sql` | testes aeróbicos, metas, Dossiê, cardio, formulários vivos (Oráculo e Alistamento), dor, ciclo, alertas |
| `atualizacao-3.sql` | Acrópole: mesociclos, agenda, `visoes_estado`, `centro_de_comando()` |
| `atualizacao-4.sql` | treinador marca envio como lido; estresse do Oráculo de 0 a 10 |
| `atualizacao-5.sql` | prescrição completa na ficha; músculos na biblioteca |
| `atualizacao-6.sql` | modelos, presets, progressão do mesociclo, substituição, pacote de entregas, tipos da agenda |

## Tabelas por assunto
- **Pessoas**: `profiles` (role `coach`/`student`, nascimento, sexo, nível, meta de treinos por semana)
- **Treino**: `exercicios`, `treinos`, `treino_itens`, `mesociclos`, `modelos`, `presets_linha`, `sessoes`, `series`
- **Cardio**: `cardio_prescricoes`, `cardio_registros`, `testes_aerobicos`
- **Acompanhamento**: `checkins`, `anamneses`, `avaliacoes`, `metas`, `dor_relatos`, `ciclo_registros`
- **Formulários vivos**: `formularios`, `perguntas`, `dicas_condicionais`, `mensagens_abertura`, `atribuicoes`, `envios`, `respostas`, `dica_exibicoes`
- **Treinador**: `dossie`, `dossie_versoes`, `alertas_coach`, `agenda`, `visoes_estado`
- **Comercial**: `leads`, `planos`, `assinaturas`, `lancamentos`

Colunas exatas: ler o `create table` no arquivo SQL correspondente e os `alter table ... add column` das atualizações seguintes.

## Segurança (RLS)
Funções de apoio: `public.is_coach()` (security definer, evita loop com a RLS) e `auth.uid()`.

Padrões em uso, copie o que se encaixa:
```sql
-- aluna lê o que é dela, só o treinador escreve (ficha, avaliação, metas)
create policy x_ler      on public.x for select using (aluna_id = auth.uid() or public.is_coach());
create policy x_escrever on public.x for all    using (public.is_coach()) with check (public.is_coach());

-- aluna lê e escreve o que é dela (sessões, séries, check-ins)
create policy x_tudo on public.x for all
  using (aluna_id = auth.uid() or public.is_coach())
  with check (aluna_id = auth.uid() or public.is_coach());

-- só o treinador (financeiro, Dossiê, agenda, inscrições)
create policy x_coach on public.x for all using (public.is_coach()) with check (public.is_coach());

-- público só envia (formulário da bio)
create policy lead_enviar on public.leads for insert to anon, authenticated with check (status = 'novo');
```
Dados sensíveis (dor, ciclo, anamnese, Dossiê) são dados de saúde: nunca liberar leitura além da própria aluna e do treinador.

## Funções (rpc)
- `montar_formulario`, `enviar_formulario`: montam e gravam formulários vivos, avaliando as regras com `avaliar_regra` (espelho de `js/motor.js`).
- `centro_de_comando(dia)`: tudo que a Acrópole mostra. Começa com `if not is_coach() then raise exception`.
- `cc_*`: pedaços do centro de comando. `execute` revogado de `anon` e `authenticated`; só são chamadas por dentro.
- `fase_ciclo(aluna, dia)`: estimativa da fase do ciclo menstrual.

Toda função `security definer` tem `set search_path = public` e confere quem chama (`is_coach()` ou `auth.uid()`), porque ela passa por cima da RLS.
