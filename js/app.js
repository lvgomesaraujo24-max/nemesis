import { html, render, useState, useEffect } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { AppCoach } from './coach.js';
import { AppAluna } from './aluna.js';
import { Toasts, Campo, Modal, toast } from './util.js';

const lerRota = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
const ir = (r) => { location.hash = '#/' + r; window.scrollTo(0, 0); };

function App() {
  const [usuario, setUsuario] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState(null);
  const [rota, setRota] = useState(lerRota());
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    const f = () => { setRota(lerRota()); };
    addEventListener('hashchange', f);
    api.sessao().then(setUsuario).catch(() => setUsuario(null));
    api.aoMudarSessao((u, ev) => { setUsuario(u); if (ev === 'PASSWORD_RECOVERY') setRecuperando(true); });
    return () => removeEventListener('hashchange', f);
  }, []);

  const carregarPerfil = async (tentativa = 0) => {
    if (!usuario) { setPerfil(null); return; }
    try {
      const p = await api.um('profiles', { id: usuario.id });
      if (!p && tentativa < 3) { setTimeout(() => carregarPerfil(tentativa + 1), 800); return; }
      if (!p) throw new Error('Não achei o seu perfil. Confira se o arquivo schema.sql foi rodado no Supabase.');
      setPerfil(p); setErro(null);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setPerfil(null); carregarPerfil(); if (usuario === null && location.hash.length > 2) location.hash = '#/'; }, [usuario && usuario.id]);

  let tela;
  if (usuario === undefined) tela = html`<div class="carregando cheio"><span class="spin"></span></div>`;
  else if (!usuario) tela = html`<${Entrada}/>`;
  else if (erro) tela = html`<div class="entrada"><div class="card vazio"><p>${erro}</p><button class="btn" onClick=${() => carregarPerfil()}>Tentar de novo</button><button class="btn-texto" onClick=${() => api.sair()}>Sair</button></div></div>`;
  else if (!perfil) tela = html`<div class="carregando cheio"><span class="spin"></span></div>`;
  else if (perfil.role === 'coach') tela = html`<${AppCoach} perfil=${perfil} rota=${rota} ir=${ir}/>`;
  else if (!perfil.ativo) tela = html`<div class="entrada"><div class="card vazio"><h3>Acesso pausado</h3><p>Seu acesso está pausado no momento. Fale com o seu treinador para reativar.</p><button class="btn" onClick=${() => api.sair()}>Sair</button></div></div>`;
  else tela = html`<${AppAluna} perfil=${perfil} rota=${rota} ir=${ir} recarregarPerfil=${() => carregarPerfil()}/>`;

  return html`${DEMO && html`<div class="faixa-demo">Modo demonstração · dados de exemplo${usuario ? html` · <button class="btn-texto" onClick=${() => { api.reiniciar(); location.reload(); }}>restaurar dados</button>` : null}</div>`}
    ${tela}${recuperando && html`<${NovaSenha} onFeito=${() => setRecuperando(false)}/>`}<${Toasts}/>`;
}

function NovaSenha({ onFeito }) {
  const [s, setS] = useState('');
  const salvar = async (ev) => { ev.preventDefault(); try { await api.novaSenha(s); toast('Senha alterada', 'ok'); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo="Criar senha nova" onFechar=${onFeito}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Nova senha" dica="Mínimo de 6 caracteres"><input class="input" type="password" autocomplete="new-password" minlength="6" required value=${s} onInput=${(ev) => setS(ev.target.value)}/><//>
    <button class="btn primario grande">Salvar senha</button></form><//>`;
}

function Entrada() {
  const [modo, setModo] = useState('entrar');
  const [f, setF] = useState({ nome: '', email: '', senha: '' });
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState(null);
  const enviar = async (ev) => {
    ev.preventDefault(); setOcupado(true); setMsg(null);
    try {
      if (modo === 'entrar') await api.entrar(f.email.trim(), f.senha);
      else if (modo === 'criar') {
        if (!f.nome.trim()) throw new Error('Digite o seu nome.');
        const r = await api.cadastrar(f.email.trim(), f.senha, f.nome.trim());
        if (r.precisaConfirmar) setMsg('Conta criada. Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.');
      } else { await api.recuperar(f.email.trim()); setMsg('Se esse e-mail tiver conta, chega um link para criar uma senha nova.'); }
    } catch (e) { toast(e.message, 'erro'); } finally { setOcupado(false); }
  };
  return html`<div class="entrada">
    <div class="entrada-marca"><h1 class="logo">NEMESIS</h1><p>Treino, evolução e acompanhamento no mesmo lugar.</p></div>
    ${DEMO ? html`<div class="card pilha">
        <p class="suave">O banco de dados ainda não foi ligado. Explore o app com dados de exemplo:</p>
        <button class="btn primario grande" onClick=${() => api.entrarComo('coach-demo')}>Entrar como treinador</button>
        <button class="btn grande" onClick=${() => api.entrarComo('aluna-ana')}>Entrar como aluna (Ana)</button>
        <button class="btn-texto" onClick=${() => api.entrarComo('aluna-bia')}>Entrar como aluna nova (Beatriz)</button>
      </div>`
    : html`<form class="card pilha" onSubmit=${enviar}>
        <div class="abas">${[['entrar', 'Entrar'], ['criar', 'Criar conta']].map(([k, r]) => html`<button type="button" class=${modo === k ? 'on' : ''} onClick=${() => { setModo(k); setMsg(null); }}>${r}</button>`)}</div>
        ${modo === 'criar' && html`<${Campo} rotulo="Nome completo"><input class="input" autocomplete="name" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>`}
        <${Campo} rotulo="E-mail"><input class="input" type="email" autocomplete="email" required value=${f.email} onInput=${(ev) => setF({ ...f, email: ev.target.value })}/><//>
        ${modo !== 'recuperar' && html`<${Campo} rotulo="Senha" dica=${modo === 'criar' ? 'Mínimo de 6 caracteres' : ''}><input class="input" type="password" autocomplete=${modo === 'criar' ? 'new-password' : 'current-password'} required minlength="6" value=${f.senha} onInput=${(ev) => setF({ ...f, senha: ev.target.value })}/><//>`}
        ${msg && html`<p class="nota">${msg}</p>`}
        <button class="btn primario grande" disabled=${ocupado}>${ocupado ? 'Aguarde...' : modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}</button>
        ${modo === 'entrar' && html`<button type="button" class="btn-texto" onClick=${() => setModo('recuperar')}>Esqueci a senha</button>`}
        ${modo === 'recuperar' && html`<button type="button" class="btn-texto" onClick=${() => setModo('entrar')}>Voltar</button>`}
      </form>`}
  </div>`;
}

render(html`<${App}/>`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
