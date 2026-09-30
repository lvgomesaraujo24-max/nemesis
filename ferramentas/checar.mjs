// Checagem rápida do Nemesis. Rode antes de cada commit:  node ferramentas/checar.mjs
// 1. sintaxe de todo o JavaScript do app
// 2. todo arquivo de js/ e css/ está na lista do service worker (sw.js)
// 3. todo import relativo aponta para um arquivo que existe
// 4. toda tabela criada em supabase/*.sql tem RLS ligada
// 5. nenhuma chave service_role no código do front-end
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
const listar = (d, ext) => readdirSync(join(raiz, d)).filter((f) => f.endsWith(ext)).map((f) => `${d}/${f}`);
const erros = [];

const js = [...listar('js', '.js'), 'sw.js', 'config.js', 'ferramentas/checar.mjs'];
for (const f of js) {
  try { execFileSync(process.execPath, ['--check', join(raiz, f)], { stdio: 'pipe' }); }
  catch (e) { erros.push(`sintaxe: ${f}\n${String(e.stderr).trim()}`); }
}

const sw = ler('sw.js');
for (const f of [...listar('js', '.js'), ...listar('css', '.css')]) {
  if (!sw.includes(`'./${f}'`)) erros.push(`sw.js: falta './${f}' na lista ARQUIVOS (o app não abre offline sem ele)`);
}

for (const f of listar('js', '.js')) {
  for (const [, alvo] of ler(f).matchAll(/from\s+'(\.{1,2}\/[^']+)'/g)) {
    if (!existsSync(join(raiz, dirname(f), alvo))) erros.push(`import quebrado em ${f}: '${alvo}'`);
  }
}

const sql = listar('supabase', '.sql').map(ler).join('\n');
const criadas = [...sql.matchAll(/create table if not exists public\.(\w+)/gi)].map((m) => m[1]);
const comRls = new Set([...sql.matchAll(/alter table public\.(\w+)\s+enable row level security/gi)].map((m) => m[1]));
for (const t of criadas) if (!comRls.has(t)) erros.push(`RLS: a tabela public.${t} não tem "enable row level security"`);

for (const f of [...js, 'index.html', 'form.html']) {
  const txt = ler(f);
  if (/service_role/i.test(txt) && f !== 'ferramentas/checar.mjs') erros.push(`segurança: ${f} menciona service_role`);
  for (const [jwt] of txt.matchAll(/eyJ[\w-]+\.(eyJ[\w-]+)\.[\w-]+/g)) {
    try { if (/service_role/.test(Buffer.from(jwt.split('.')[1], 'base64url').toString())) erros.push(`segurança: ${f} tem uma chave service_role`); } catch { /* não é JWT */ }
  }
}

if (erros.length) { console.error(erros.map((e) => '✗ ' + e).join('\n')); process.exit(1); }
console.log(`✓ tudo certo (${js.length} arquivos JS, ${criadas.length} tabelas com RLS)`);
