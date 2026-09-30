-- NEMESIS · atualização 7: ficha 360 da aluna
-- Rode DEPOIS da atualização 6. SQL Editor > New query > cole tudo > Run. Pode rodar mais de uma vez.
-- Cria: protocolo e diâmetros ósseos na avaliação, arquivos da aluna (tabela + pasta privada no Storage).

-- ---------- avaliação: Pollock 3 ou 7 e diâmetros ósseos ----------
alter table public.avaliacoes add column if not exists protocolo text;
alter table public.avaliacoes drop constraint if exists avaliacoes_protocolo_ok;
alter table public.avaliacoes add constraint avaliacoes_protocolo_ok check (protocolo is null or protocolo in ('jp7','jp3'));
alter table public.avaliacoes add column if not exists diametros jsonb;   -- cm: punho, umero, femur

-- ---------- arquivos da aluna ----------
create table if not exists public.arquivos_aluna (
  id          uuid primary key default gen_random_uuid(),
  aluna_id    uuid not null references public.profiles(id) on delete cascade,
  nome        text not null,
  caminho     text not null unique,        -- <id da aluna>/<arquivo> no bucket "arquivos"
  tipo        text,                        -- image/jpeg, application/pdf...
  categoria   text not null default 'outro' check (categoria in ('foto','exame','documento','outro')),
  tamanho     bigint,
  enviado_por uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists arquivos_aluna_idx on public.arquivos_aluna(aluna_id, created_at desc);
alter table public.arquivos_aluna enable row level security;
drop policy if exists arq_ler on public.arquivos_aluna;
drop policy if exists arq_enviar on public.arquivos_aluna;
drop policy if exists arq_apagar on public.arquivos_aluna;
create policy arq_ler    on public.arquivos_aluna for select using (aluna_id = auth.uid() or public.is_coach());
create policy arq_enviar on public.arquivos_aluna for insert with check (aluna_id = auth.uid() or public.is_coach());
create policy arq_apagar on public.arquivos_aluna for delete using (public.is_coach());

-- pasta privada no Storage: cada aluna só enxerga a própria pasta; o treinador enxerga todas
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "nemesis arquivos coach" on storage.objects;
drop policy if exists "nemesis arquivos aluna ler" on storage.objects;
drop policy if exists "nemesis arquivos aluna enviar" on storage.objects;
create policy "nemesis arquivos coach" on storage.objects for all
  using (bucket_id = 'arquivos' and public.is_coach()) with check (bucket_id = 'arquivos' and public.is_coach());
create policy "nemesis arquivos aluna ler" on storage.objects for select
  using (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "nemesis arquivos aluna enviar" on storage.objects for insert
  with check (bucket_id = 'arquivos' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
