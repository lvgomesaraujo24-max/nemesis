// Camada de dados do Nemesis.
// Com SUPABASE_URL preenchido em config.js, fala com o Supabase.
// Sem ele, roda em MODO DEMONSTRAÇÃO (dados de exemplo guardados no navegador).
import { criarDemo } from './demo.js';

const cfg = window.NEMESIS_CONFIG || {};
export const DEMO = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY;

function criarSupabase() {
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  const erro = (r) => { if (r.error) throw new Error(traduzErro(r.error.message)); return r.data; };
  return {
    async sessao() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
    async entrar(email, senha) { erro(await sb.auth.signInWithPassword({ email, password: senha })); },
    async cadastrar(email, senha, nome) {
      const d = erro(await sb.auth.signUp({ email, password: senha, options: { data: { nome } } }));
      return { precisaConfirmar: !d.session };
    },
    async recuperar(email) { erro(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    async sair() { await sb.auth.signOut(); },
    aoMudarSessao(fn) { sb.auth.onAuthStateChange((ev, s) => fn(s ? s.user : null, ev)); },
    async novaSenha(senha) { erro(await sb.auth.updateUser({ password: senha })); },
    async q(tabela, { eq = {}, order, asc = true, gte, lte, limit } = {}) {
      let r = sb.from(tabela).select('*');
      for (const [k, v] of Object.entries(eq)) r = v === null ? r.is(k, null) : r.eq(k, v);
      if (gte) for (const [k, v] of Object.entries(gte)) r = r.gte(k, v);
      if (lte) for (const [k, v] of Object.entries(lte)) r = r.lte(k, v);
      if (order) r = r.order(order, { ascending: asc });
      if (limit) r = r.limit(limit);
      return erro(await r) || [];
    },
    async um(tabela, eq) { const l = await this.q(tabela, { eq, limit: 1 }); return l[0] || null; },
    async ins(tabela, linha) { return erro(await sb.from(tabela).insert(linha).select()); },
    async enviar(tabela, linha) { erro(await sb.from(tabela).insert(linha)); }, // sem ler de volta (formulário público)
    async upd(tabela, id, patch, chave = 'id') { return erro(await sb.from(tabela).update(patch).eq(chave, id).select()); },
    async ups(tabela, linha, conflito) { return erro(await sb.from(tabela).upsert(linha, { onConflict: conflito }).select()); },
    async del(tabela, id) { erro(await sb.from(tabela).delete().eq('id', id)); },
  };
}

function traduzErro(m) {
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que chegou na sua caixa de entrada.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Confira sua internet.';
  return m;
}

export const api = DEMO ? criarDemo() : criarSupabase();
