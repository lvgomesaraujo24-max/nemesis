-- NEMESIS · atualização 7: relatório mensal com Palavra do treinador e Missão
-- Rode DEPOIS da atualização 6. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.

-- uma linha por aluna e por período do relatório (chave: '2026-09', 'ficha-<id>' ou '2026-09-01_2026-09-30')
create table if not exists public.relatorio_notas (
  id          uuid primary key default gen_random_uuid(),
  aluna_id    uuid not null references public.profiles(id) on delete cascade,
  chave       text not null,
  mensagem    text,                                   -- palavra do treinador
  missao      jsonb not null default '[]'::jsonb,     -- [{"titulo":"...","alvo":"...","texto":"..."}]
  updated_at  timestamptz not null default now(),
  unique (aluna_id, chave)
);

alter table public.relatorio_notas enable row level security;
drop policy if exists relnota_ler on public.relatorio_notas;
drop policy if exists relnota_escrever on public.relatorio_notas;
-- a aluna lê o que é dela; só o treinador escreve
create policy relnota_ler      on public.relatorio_notas for select using (aluna_id = auth.uid() or public.is_coach());
create policy relnota_escrever on public.relatorio_notas for all using (public.is_coach()) with check (public.is_coach());

notify pgrst, 'reload schema';
