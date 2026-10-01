// Lado do TREINADOR
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Acropole } from './comando.js';
import { Selo, DossieAluna } from './dossie.js';
import { Formularios, ModalEnvio } from './formularios.js';
import { CardioAluna, TestesAluna, MetasAluna } from './extras.js';
import { Agenda } from './chronos.js';
import { Evolucao, Anamnese, Avaliacoes, MetasEnvio } from './comum.js';
import { ResumoCheckin } from './aluna.js';
import { Relatorio } from './relatorio.js';
import { Icone } from './icones.js';
import { Ficha } from './ficha.js';
import { Modelos } from './modelos.js';
import { Exercicios } from './biblioteca.js';
import { Financeiro, FinanceiroAluna } from './tesouro.js';
import { Radar, Score, carregarRadar, saudeDa } from './radar.js';
import { FormulariosAluna, ArquivosAluna, AtividadesAluna, VideosAluna } from './aluna360.js';
import { PrivacidadeCoach } from './legal.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Abas, Barras, toast, num, brl, dataBR, hoje, segundaDe, somaDias,
  somaMeses, diasEntre, lerNum, relativo, linkWhats, copiar, mesNome, idadeDe } from './util.js';

// menu lateral em grupos, como no painel: principal, ferramentas
const NAV = [
  [['', 'Acrópole', 'inicio'], ['alunas', 'Alunas', 'alunas'], ['agenda', 'Chronos', 'agenda'], ['financeiro', 'Tesouro', 'financeiro']],
  [['checkins', 'Oráculo', 'oraculo'], ['modelos', 'Modelos', 'forja'], ['exercicios', 'Exercícios', 'exercicios'], ['formularios', 'Formulários', 'formularios'], ['leads', 'Inscrições', 'inscricoes']],
];
const NAV_BAIXO = ['', 'alunas', 'checkins', 'agenda', 'financeiro'];
const CHAVE_MENU = 'nemesis-menu-recolhido';

export function AppCoach({ perfil, rota, ir }) {
  const [base, id, sub] = rota;
  let tela;
  if (base === 'aluna' && id) tela = html`<${AlunaDetalhe} id=${id} aba=${sub || 'geral'} ir=${ir} coachNome=${perfil.nome} onAluna=${(a) => setAlunaAtual(a)}/>`;
  else if (base === 'alunas') tela = html`<${Alunas} ir=${ir}/>`;
  else if (base === 'checkins') tela = html`<${CheckinsCoach} ir=${ir}/>`;
  else if (base === 'leads') tela = html`<${Leads}/>`;
  else if (base === 'financeiro') tela = html`<${Financeiro} ir=${ir}/>`;
  else if (base === 'exercicios') tela = html`<${Exercicios}/>`;
  else if (base === 'modelos') tela = html`<${Modelos} id=${id} ir=${ir}/>`;
  else if (base === 'agenda') tela = html`<${Agenda} ir=${ir}/>`;
  else if (base === 'formularios') tela = html`<${Formularios} id=${id} aba=${sub} ir=${ir}/>`;
  else if (base === 'painel') tela = html`<${Painel} perfil=${perfil} ir=${ir}/>`;
  else tela = html`<${Acropole} perfil=${perfil} ir=${ir}/>`;
  const aba = base === 'aluna' ? 'alunas' : base || '';
  const [alunaAtual, setAlunaAtual] = useState(null);
  const [recolhido, setRecolhido] = useState(() => { try { return localStorage.getItem(CHAVE_MENU) === '1'; } catch (e) { return false; } });
  const [gaveta, setGaveta] = useState(false);
  useEffect(() => { if (base !== 'aluna') setAlunaAtual(null); }, [base]);
  useEffect(() => { setGaveta(false); }, [rota.join('/')]);
  const alternarMenu = () => {
    if (matchMedia('(min-width: 900px)').matches) {
      const v = !recolhido; setRecolhido(v);
      try { localStorage.setItem(CHAVE_MENU, v ? '1' : '0'); } catch (e) { /* sem storage */ }
    } else setGaveta(!gaveta);
  };
  const nome = perfil.nome || perfil.email || 'Treinador';
  return html`<div class=${'tela com-nav coach casca' + (recolhido ? ' recolhido' : '') + (gaveta ? ' gaveta' : '')}>
    <aside class="lateral" aria-label="Menu lateral">
      <div class="lateral-topo"><span class="marca">NEMESIS</span></div>
      <nav class="lateral-nav">${NAV.map((grupo) => html`<div class="lateral-grupo">${grupo.map(([k, r, i]) => html`<a href=${'#/' + k} class=${aba === k ? 'on' : ''} title=${r}><${Icone} nome=${i}/><span>${r}</span></a>`)}</div>`)}</nav>
      <button class="lateral-sair" title="Sair" onClick=${() => api.sair()}><${Icone} nome="sair"/><span>Sair</span></button>
    </aside>
    <div class="lateral-fundo" onClick=${() => setGaveta(false)}></div>
    <div class="casca-corpo">
      <header class="topo">
        <button class="icone" aria-label="Menu" onClick=${alternarMenu}><${Icone} nome="menu" tam=${22}/></button>
        <span class="marca">NEMESIS</span>
        <details class="usuario"><summary><span class="avatar mini">${nome.slice(0, 1)}</span><b>${nome.toUpperCase()}</b><${Icone} nome="abaixo" tam=${16}/></summary>
          <div><a href="#/alunas">Alunas</a><a href="#/financeiro">Financeiro</a><button onClick=${() => api.sair()}>Sair</button></div></details>
      </header>
      <main class=${'conteudo largo' + (aba === '' || aba === 'modelos' || aba === 'agenda' || aba === 'financeiro' || (base === 'aluna' && (sub || 'ficha') === 'ficha') ? ' acropole' : '')}>${tela}</main>
    </div>
    <${Selo} alunaAtual=${alunaAtual}/>
    <nav class="nav-baixo">${NAV.flat().filter(([k]) => NAV_BAIXO.includes(k)).map(([k, r, i]) => html`<a href=${'#/' + k} class=${aba === k ? 'on' : ''}><${Icone} nome=${i} tam=${21}/>${r}</a>`)}</nav>
  </div>`;
}

const alunasAtivas = () => api.q('profiles', { eq: { role: 'student' }, order: 'nome' });

// ============================================================
// PAINEL
// ============================================================
function Painel({ perfil, ir }) {
  const e = useCarregar(async () => {
    const [alunas, sessoes, checkins, leads, assinaturas, lanc] = await Promise.all([
      alunasAtivas(), api.q('sessoes', { gte: { data: somaDias(hoje(), -60) } }), api.q('checkins', { eq: { resposta: null } }),
      api.q('leads', { eq: { status: 'novo' } }), api.q('assinaturas', {}), api.q('lancamentos', { eq: { tipo: 'receita' } }),
    ]);
    return { alunas: alunas.filter((a) => a.ativo), sessoes, checkins, leads, assinaturas, lanc };
  }, []);
  return html`<div class="pilha">
    <div class="ola"><p class="sobre">Painel</p><h1>Olá, ${(perfil.nome || 'treinador').split(' ')[0]}</h1></div>
    <${Estado} e=${e}>${({ alunas, sessoes, checkins, leads, assinaturas, lanc }) => {
      const semana = segundaDe(); const mes = hoje().slice(0, 7);
      const treinaramSemana = new Set(sessoes.filter((s) => s.data >= semana).map((s) => s.aluna_id)).size;
      const recebidoMes = lanc.filter((l) => l.pago_em && l.pago_em.slice(0, 7) === mes).reduce((t, l) => t + Number(l.valor), 0);
      const atrasadas = lanc.filter((l) => !l.pago_em && l.vencimento < hoje());
      const sumidas = alunas.filter((a) => { const u = sessoes.filter((s) => s.aluna_id === a.id).map((s) => s.data).sort().pop(); return !u || diasEntre(u, hoje()) >= 7; });
      const vencendo = alunas.map((a) => ({ a, s: assinaturas.filter((x) => x.aluna_id === a.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0] }))
        .filter(({ s }) => s && diasEntre(hoje(), s.fim) <= 10);
      const nome = (id) => (alunas.find((a) => a.id === id) || {}).nome || 'Aluna';
      return html`
        <div class="stats">
          <div class="stat"><b>${alunas.length}</b><span>alunas ativas</span></div>
          <div class="stat"><b>${treinaramSemana}</b><span>treinaram esta semana</span></div>
          <div class="stat"><b>${checkins.length}</b><span>check-ins para responder</span></div>
          <div class="stat"><b>${brl(recebidoMes).replace(',00', '')}</b><span>recebido em ${mesNome(mes)}</span></div>
        </div>
        <h2 class="secao">Precisa de atenção</h2>
        ${!checkins.length && !sumidas.length && !vencendo.length && !leads.length && !atrasadas.length ? html`<${Vazio} titulo="Tudo em dia" texto="Nenhuma pendência agora."/>` : null}
        ${checkins.length > 0 && html`<a class="card pendencia" href="#/checkins"><b>${checkins.length} check-in(s) esperando resposta</b><span>${checkins.slice(0, 3).map((c) => nome(c.aluna_id)).join(', ')}</span></a>`}
        ${leads.length > 0 && html`<a class="card pendencia" href="#/leads"><b>${leads.length} inscrição(ões) nova(s) no formulário</b><span>${leads.slice(0, 3).map((l) => l.nome).join(', ')}</span></a>`}
        ${vencendo.map(({ a, s }) => { const d = diasEntre(hoje(), s.fim); return html`<a class="card pendencia" href=${`#/aluna/${a.id}/financeiro`}><b>Plano de ${a.nome} ${d < 0 ? `venceu há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dia(s)`}</b><span>${s.plano_nome} · até ${dataBR(s.fim)}</span></a>`; })}
        ${atrasadas.length > 0 && html`<a class="card pendencia" href="#/financeiro"><b>${atrasadas.length} parcela(s) em atraso</b><span>${brl(atrasadas.reduce((t, l) => t + Number(l.valor), 0))}</span></a>`}
        ${sumidas.length > 0 && html`<section class="card"><h3>Sem treinar há 7 dias ou mais</h3><ul class="lista">${sumidas.map((a) => { const u = sessoes.filter((s) => s.aluna_id === a.id).map((s) => s.data).sort().pop();
          return html`<li class="linha"><a href=${`#/aluna/${a.id}/evolucao`}><b>${a.nome}</b><small>último treino: ${relativo(u)}</small></a>
          ${a.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(a.telefone, `Oi, ${a.nome.split(' ')[0]}! Senti sua falta nos treinos essa semana. Tá tudo bem? Se a rotina apertou, me fala que eu ajusto a ficha pra caber.`)}>WhatsApp</a>`}</li>`; })}</ul></section>`}
        <h2 class="secao">Atalhos</h2>
        <div class="atalhos">
          <a class="card" href="#/exercicios"><b>Biblioteca de exercícios</b><span class="suave">Vídeos e instruções</span></a>
          <a class="card" href="form.html" target="_blank" rel="noopener"><b>Formulário de inscrição</b><span class="suave">O link da bio</span></a>
        </div>
      `;
    }}<//>
  </div>`;
}

// ============================================================
// ALUNAS
// ============================================================
const ORDENS = [['nome', 'Nome (A–Z)'], ['engajamento', 'Menor engajamento'], ['progressao', 'Menor progressão'], ['risco', 'Maior risco de evasão']];
function Alunas({ ir }) {
  const e = useCarregar(async () => {
    const [alunas, radar] = await Promise.all([alunasAtivas(), carregarRadar()]);
    return { alunas, radar };
  }, []);
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState(() => { try { return localStorage.getItem('nemesis-ordem-alunas') || 'nome'; } catch (err) { return 'nome'; } });
  const [inativas, setInativas] = useState(false);
  const [convite, setConvite] = useState(false);
  const mudaOrdem = (v) => { setOrdem(v); try { localStorage.setItem('nemesis-ordem-alunas', v); } catch (err) { /* */ } };
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Alunas</h1><button class="btn primario" onClick=${() => setConvite(true)}>+ Convidar aluna</button></div>
    <${Estado} e=${e}>${({ alunas, radar }) => {
      const ativas = alunas.filter((a) => a.ativo);
      const saude = Object.fromEntries(alunas.map((a) => [a.id, saudeDa(a, radar)]));
      const aguardando = alunas.filter((a) => !a.ativo && a.aguardando);
      const lista = alunas.filter((a) => a.ativo !== inativas && !(inativas && a.aguardando) && (a.nome || '').toLowerCase().includes(busca.toLowerCase()));
      const chave = { engajamento: (a) => (saude[a.id].engajamento == null ? 999 : saude[a.id].engajamento), progressao: (a) => (saude[a.id].progIndice == null ? 999 : saude[a.id].progIndice), risco: (a) => -saude[a.id].risco };
      if (chave[ordem]) lista.sort((x, y) => chave[ordem](x) - chave[ordem](y));
      const nInat = alunas.filter((a) => !a.ativo && !a.aguardando).length;
      // guarda vencida: 12 meses depois do fim do último plano (ou do cadastro, se nunca teve plano), sem plano vigente
      const guardaVencida = (a) => { if (a.aguardando) return false; const fim = (saude[a.id].plano || {}).fim || String(a.created_at || '').slice(0, 10); return !!fim && fim < somaDias(hoje(), -365); };
      return html`${aguardando.length > 0 && html`<${Aguardando} lista=${aguardando} onFeito=${e.recarregar}/>`}
        ${ativas.length > 0 && !inativas && html`<${Radar} alunas=${ativas} saude=${saude} ir=${ir}/>`}
        <div class="alunas-filtro"><input class="input" type="search" placeholder="Buscar pelo nome" value=${busca} onInput=${(ev) => setBusca(ev.target.value)}/>
          <select class="input" aria-label="Ordenar" onChange=${(ev) => mudaOrdem(ev.target.value)}>${ORDENS.map(([k, r]) => html`<option value=${k} selected=${ordem === k}>${r}</option>`)}</select></div>
        ${!lista.length ? html`<${Vazio} titulo=${alunas.length ? 'Ninguém encontrado' : 'Nenhuma aluna ainda'} texto=${alunas.length ? '' : 'Mande o link do app para a aluna criar a conta. Ela aparece aqui na hora.'}/>` : null}
        ${lista.map((a) => { const sd = saude[a.id]; const s = sd.plano; const d = sd.planoDias;
          return html`<button class="card aluna" onClick=${() => ir('aluna/' + a.id)}>
            <span class="avatar">${(a.nome || '?').slice(0, 1)}</span>
            <div class="aluna-info"><b>${a.nome || a.email}</b><small>Último treino: ${relativo(sd.ultimo)}${a.objetivo ? ' · ' + a.objetivo : ''}</small></div>
            <${Score} s=${sd} compacto=${true}/>
            <div class="treino-tags">${guardaVencida(a) ? html`<span class="tag perigo" title="Mais de 12 meses desde o fim do último plano: pela Política de Privacidade, os dados devem ser excluídos (aba Dados)">guarda vencida</span>` : null}
              ${!a.anamnese_ok ? html`<span class="tag atencao">sem anamnese</span>` : null}
              ${s ? html`<span class=${'tag' + (d < 0 ? ' perigo' : d <= 10 ? ' atencao' : '')}>${s.plano_nome} · ${d < 0 ? 'vencido' : d + 'd'}</span>` : html`<span class="tag">sem plano</span>`}<span class="seta">›</span></div>
          </button>`; })}
        ${nInat > 0 && html`<button class="btn-texto" onClick=${() => setInativas(!inativas)}>${inativas ? 'Ver ativas' : `Ver inativas (${nInat})`}</button>`}`;
    }}<//>
    ${convite && html`<${Convite} onFechar=${() => setConvite(false)}/>`}
  </div>`;
}

// convite com link único (#/convite/<token>), válido por 7 dias: a conta criada por ele já nasce ligada aos dados do convite
const novoToken = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
const linkConvite = (token) => `${location.origin + location.pathname}#/convite/${token}`;
const msgConvite = (c) => `Oi${c.nome ? ', ' + c.nome.split(' ')[0] : ''}! Seja bem-vinda ao time 💜\n\nSeu app de treino é o Nemesis. É por ele que você vai ver sua ficha, registrar as cargas e mandar o check-in da semana.\n\n1. Abra este link (vale por 7 dias): ${linkConvite(c.token)}\n2. Crie a sua senha\n3. Preencha o Alistamento (leva uns 5 minutos)\n\nNo celular, toque em "Adicionar à tela de início" para ele virar um app. Qualquer dúvida, me chama aqui.`;
// cadastro feito sem convite: fica pausado até o treinador aprovar (atualização 11)
function Aguardando({ lista, onFeito }) {
  const decidir = async (a, aprovar) => {
    if (!aprovar && !confirm(`Recusar o cadastro de ${a.nome || a.email}? A conta continua pausada e vai para as inativas.`)) return;
    try { await api.upd('profiles', a.id, aprovar ? { ativo: true, aguardando: false, alistada_em: hoje() } : { aguardando: false }); toast(aprovar ? 'Acesso liberado' : 'Cadastro recusado', 'ok'); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<section class="card aguardando"><div class="card-topo"><div><h3>Aguardando aprovação</h3><small>Contas criadas sem convite. Só entram depois que você liberar.</small></div><span class="tag atencao">${lista.length}</span></div>
    <ul class="lista">${lista.map((a) => html`<li class="linha"><div><b>${a.nome || 'Sem nome'}</b><small>${a.email || ''} · cadastro ${relativo(a.created_at)}</small></div>
      <div class="mini-acoes"><button class="btn mini" onClick=${() => decidir(a, true)}>Liberar</button><button class="btn-texto perigo" onClick=${() => decidir(a, false)}>Recusar</button></div></li>`)}</ul></section>`;
}

function Convite({ onFechar }) {
  const e = useCarregar(() => api.q('convites', { order: 'created_at', asc: false }).catch(() => null), []);
  const [f, setF] = useState({ nome: '', email: '', telefone: '', objetivo: '' });
  const [gerado, setGerado] = useState(null);
  const gerar = async (ev) => {
    ev.preventDefault();
    if (!f.nome.trim()) { toast('Digite o nome da aluna.', 'erro'); return; }
    try {
      const [c] = await api.ins('convites', { token: novoToken(), nome: f.nome.trim(), email: f.email.trim().toLowerCase() || null, telefone: f.telefone || null, objetivo: f.objetivo || null,
        expira_em: new Date(Date.now() + 7 * 86400000).toISOString() });
      setGerado(c); e.recarregar();
    } catch (err) { toast(err.message, 'erro'); }
  };
  const cancelar = async (c) => { if (!confirm(`Cancelar o convite de ${c.nome}? O link para de funcionar.`)) return; try { await api.del('convites', c.id); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } };
  const pendentes = (e.dados || []).filter((c) => !c.usado_em);
  return html`<${Modal} titulo="Convidar aluna" onFechar=${onFechar}>
    ${e.dados === null ? html`<p class="nota">Os convites com link precisam da atualização 9 do banco (pasta supabase). Enquanto isso, mande o link do app: ${location.origin + location.pathname}</p>`
    : gerado ? html`<div class="pilha">
        <p class="suave">Link criado para <b>${gerado.nome}</b>. Vale até ${dataBR(String(gerado.expira_em).slice(0, 10))} e só pode ser usado uma vez.</p>
        <textarea class="input" rows="9" readonly value=${msgConvite(gerado)}></textarea>
        <div class="acoes"><button class="btn" onClick=${() => copiar(msgConvite(gerado))}>Copiar mensagem</button><button class="btn" onClick=${() => copiar(linkConvite(gerado.token))}>Copiar só o link</button>
          ${gerado.telefone && html`<a class="btn primario" target="_blank" rel="noopener" href=${linkWhats(gerado.telefone, msgConvite(gerado))}>Mandar no WhatsApp</a>`}</div>
        <button class="btn-texto" onClick=${() => { setGerado(null); setF({ nome: '', email: '', telefone: '', objetivo: '' }); }}>Convidar outra</button></div>`
    : html`<form class="pilha" onSubmit=${gerar}>
        <p class="suave">Cada aluna recebe um link único, válido por 7 dias. Quando ela cria a senha, a conta já entra com o nome, o WhatsApp e o objetivo que você preencheu.</p>
        <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
        <div class="grade2"><${Campo} rotulo="E-mail (opcional)"><input class="input" type="email" value=${f.email} onInput=${(ev) => setF({ ...f, email: ev.target.value })}/><//>
          <${Campo} rotulo="WhatsApp (opcional)"><input class="input" inputmode="tel" placeholder="(11) 99999-9999" value=${f.telefone} onInput=${(ev) => setF({ ...f, telefone: ev.target.value })}/><//></div>
        <${Campo} rotulo="Objetivo (opcional)"><input class="input" placeholder="Ex.: glúteo e definição" value=${f.objetivo} onInput=${(ev) => setF({ ...f, objetivo: ev.target.value })}/><//>
        <button class="btn primario grande">Gerar link de convite</button>
      </form>`}
    ${pendentes.length > 0 && !gerado && html`<section class="pilha-curta"><span class="rotulo">Convites em aberto</span>
      <ul class="lista">${pendentes.map((c) => { const vencido = new Date(c.expira_em) < new Date();
        return html`<li class="linha"><div><b>${c.nome}</b><small>${vencido ? 'venceu em ' : 'vale até '}${dataBR(String(c.expira_em).slice(0, 10))}</small></div>
          <div class="mini-acoes">${!vencido && html`<button class="btn-texto" onClick=${() => setGerado(c)}>Ver link</button>`}<button class="btn-texto perigo" onClick=${() => cancelar(c)}>${vencido ? 'Apagar' : 'Cancelar'}</button></div></li>`; })}</ul></section>`}
  <//>`;
}

// ============================================================
// DETALHE DA ALUNA
// ============================================================
const ABAS_ALUNA = [['geral', 'Visão geral'], ['ficha', 'Ficha'], ['evolucao', 'Evolução'], ['relatorio', 'Relatório'], ['avaliacoes', 'Avaliações'], ['checkins', 'Oráculo'], ['formularios', 'Formulários'],
  ['atividades', 'Crônica'], ['videos', 'Vídeos'], ['dossie', 'Dossiê'], ['arquivos', 'Arquivos'], ['metas', 'Metas'], ['cardio', 'Cardio'], ['testes', 'Testes'],
  ['anamnese', 'Alistamento'], ['financeiro', 'Financeiro'], ['dados', 'Dados']];
// mensagem com o link de acesso da aluna ao app
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesAno = (d) => (d ? `${MESES_CURTOS[+d.slice(5, 7) - 1]}/${d.slice(0, 4)}` : '·');
const linkAcesso = (a) => `Oi, ${(a.nome || '').split(' ')[0]}! Este é o seu acesso ao Nemesis: ${location.origin + location.pathname}\n\nEntre com o e-mail ${a.email || 'que você cadastrou'}. Se esquecer a senha, toque em "Esqueci a senha" na tela de entrada. No celular, use "Adicionar à tela de início" para ele virar um app.`;
function AlunaDetalhe({ id, aba, ir, onAluna, coachNome }) {
  const e = useCarregar(async () => { const a = await api.um('profiles', { id }); if (a && onAluna) onAluna({ id: a.id, nome: a.nome }); return a; }, [id]);
  const r = useCarregar(() => carregarRadar(id), [id]);
  return html`<${Estado} e=${e}>${(a) => (!a ? html`<${Vazio} titulo="Aluna não encontrada"/>` : html`<div class="pilha">
    <button class="btn-texto" onClick=${() => ir('alunas')}>‹ Alunas</button>
    <div class="aluna-cab"><span class="avatar grande">${(a.nome || '?').slice(0, 1)}</span>
      <div><h1>${a.nome || a.email}</h1><p class="suave">${[idadeDe(a.nascimento) && idadeDe(a.nascimento) + ' anos', a.objetivo].filter(Boolean).join(' · ') || a.email}</p>
        <p class="aluna-meta"><span class=${'tag ' + (a.ativo ? 'ok' : '')}>${a.ativo ? 'Ativa' : 'Pausada'}</span><small>Guerreira desde ${mesAno(a.alistada_em || String(a.created_at || '').slice(0, 10))}</small>
          ${r.dados && (() => { const sn = saudeDa(a, r.dados).sinal; return html`<small class="sinal-cab" title="Soma do último check-in: (6 − sono) + (6 − energia) + estresse + dor">${sn ? html`<span class=${'ponto-sinal ' + sn.cor}></span>Último check-in: ${sn.cor}` : 'Sem check-in com sinal'}</small>`; })()}</p></div>
      <div class="acoes"><button class="btn" onClick=${() => copiar(linkAcesso(a))}><${Icone} nome="copiar" tam=${16}/>Copiar link</button>
        ${a.telefone && html`<a class="btn" target="_blank" rel="noopener" href=${linkWhats(a.telefone)}>WhatsApp</a>`}</div></div>
    ${r.dados && html`<${Score} s=${saudeDa(a, r.dados)}/>`}
    <${Abas} abas=${ABAS_ALUNA} atual=${aba} onMuda=${(k) => ir(`aluna/${id}/${k}`)}/>
    ${aba === 'geral' && html`<div class="visao-geral"><section><h2 class="bloco">Dossiê</h2><${DossieAluna} aluna=${a}/></section>
      <section><h2 class="bloco">Estrada</h2><${AtividadesAluna} aluna=${a}/></section></div>`}
    ${aba === 'ficha' && html`<${Ficha} aluna=${a}/>`}
    ${aba === 'evolucao' && html`<${Evolucao} alunaId=${a.id}/>`}
    ${aba === 'relatorio' && html`<${Relatorio} aluna=${a} coachNome=${coachNome} podeEditar=${true}/>`}
    ${aba === 'checkins' && html`<${CheckinsDaAluna} aluna=${a}/>`}
    ${aba === 'dossie' && html`<${DossieAluna} aluna=${a}/>`}
    ${aba === 'formularios' && html`<${FormulariosAluna} aluna=${a}/>`}
    ${aba === 'atividades' && html`<${AtividadesAluna} aluna=${a}/>`}
    ${aba === 'arquivos' && html`<${ArquivosAluna} aluna=${a}/>`}
    ${aba === 'videos' && html`<${VideosAluna} aluna=${a}/>`}
    ${aba === 'metas' && html`<${MetasAluna} aluna=${a}/>`}
    ${aba === 'cardio' && html`<${CardioAluna} aluna=${a}/>`}
    ${aba === 'testes' && html`<${TestesAluna} aluna=${a}/>`}
    ${aba === 'avaliacoes' && html`<${Avaliacoes} aluna=${a} podeEditar=${true}/>`}
    ${aba === 'anamnese' && html`<${Anamnese} alunaId=${a.id} leitura=${true}/>`}
    ${aba === 'financeiro' && html`<${FinanceiroAluna} aluna=${a}/>`}
    ${aba === 'dados' && html`<${DadosAluna} aluna=${a} onSalvo=${e.recarregar}/><${PrivacidadeCoach} aluna=${a} ir=${ir}/>`}
  </div>`)}<//>`;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
function DadosAluna({ aluna, onSalvo }) {
  const [f, setF] = useState({ nome: aluna.nome || '', telefone: aluna.telefone || '', nascimento: aluna.nascimento || '', sexo: aluna.sexo || 'F', objetivo: aluna.objetivo || '', ativo: aluna.ativo,
    alistada_em: aluna.alistada_em || String(aluna.created_at || '').slice(0, 10), treinos_semana_alvo: aluna.treinos_semana_alvo || '' });
  // campos da atualização 8: só vão no salvar se mudaram (quem ainda não rodou o SQL continua salvando o resto)
  const [n, setN] = useState({ dia_revisao: aluna.dia_revisao != null ? aluna.dia_revisao : null, combo_nutri: !!aluna.combo_nutri });
  const [enviandoSenha, setEnviandoSenha] = useState(false);
  const salvar = async (ev) => {
    ev.preventDefault();
    const alvo = lerNum(f.treinos_semana_alvo);
    const novos = {};
    if (n.dia_revisao !== (aluna.dia_revisao != null ? aluna.dia_revisao : null)) novos.dia_revisao = n.dia_revisao;
    if (n.combo_nutri !== !!aluna.combo_nutri) novos.combo_nutri = n.combo_nutri;
    try { await api.upd('profiles', aluna.id, { ...f, ...novos, telefone: f.telefone || null, nascimento: f.nascimento || null, alistada_em: f.alistada_em || null, treinos_semana_alvo: alvo ? Math.min(7, Math.max(1, Math.round(alvo))) : null }); toast('Dados salvos', 'ok'); onSalvo(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  const novaSenha = async () => {
    if (!aluna.email || !confirm(`Enviar para ${aluna.email} um link para criar uma senha nova?`)) return;
    setEnviandoSenha(true);
    try { await api.recuperar(aluna.email); toast('Link enviado para o e-mail da aluna', 'ok'); } catch (err) { toast(err.message, 'erro'); } finally { setEnviandoSenha(false); }
  };
  return html`<form class="card pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
    <div class="grade2">
      <${Campo} rotulo="WhatsApp"><input class="input" inputmode="tel" value=${f.telefone} onInput=${(ev) => setF({ ...f, telefone: ev.target.value })}/><//>
      <${Campo} rotulo="Nascimento"><input class="input" type="date" value=${f.nascimento} onInput=${(ev) => setF({ ...f, nascimento: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Sexo (usado na fórmula de % de gordura)"><div class="chips">${[['F', 'Feminino'], ['M', 'Masculino']].map(([k, r]) => html`<button type="button" class=${f.sexo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, sexo: k })}>${r}</button>`)}</div><//>
    <${Campo} rotulo="Objetivo"><input class="input" value=${f.objetivo} onInput=${(ev) => setF({ ...f, objetivo: ev.target.value })}/><//>
    <div class="grade2">
      <${Campo} rotulo="Alistada em" dica="Dia zero da jornada"><input class="input" type="date" value=${f.alistada_em} onInput=${(ev) => setF({ ...f, alistada_em: ev.target.value })}/><//>
      <${Campo} rotulo="Treinos por semana (meta)" dica="Vazio = treinos obrigatórios da ficha"><input class="input" inputmode="numeric" value=${f.treinos_semana_alvo} onInput=${(ev) => setF({ ...f, treinos_semana_alvo: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Dia de revisão" dica="Dia fixo em que você olha o Oráculo dela e ajusta a ficha. Entra na Fila do dia e no Chronos."><div class="chips">
      ${[[null, 'Nenhum'], ...DIAS_SEMANA.map((r, i) => [i, r])].map(([k, r]) => html`<button type="button" class=${n.dia_revisao === k ? 'chip on' : 'chip'} onClick=${() => setN({ ...n, dia_revisao: k })}>${r}</button>`)}</div><//>
    <label class="toggle"><input type="checkbox" checked=${n.combo_nutri} onChange=${(ev) => setN({ ...n, combo_nutri: ev.target.checked })}/> Combo com nutricionista (treino + dieta)</label>
    <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Aluna ativa</label>
    <div class="linha-acao"><p class="suave">E-mail de acesso: ${aluna.email}</p>
      ${aluna.email && html`<button type="button" class="btn-texto" disabled=${enviandoSenha} onClick=${novaSenha}>${enviandoSenha ? 'Enviando…' : 'Enviar e-mail de nova senha'}</button>`}</div>
    <button class="btn primario">Salvar</button>
  </form>`;
}

// ============================================================
// CHECK-INS
// ============================================================
function CartaoResposta({ c, aluna, envio, onFeito }) {
  const [verEnvio, setVerEnvio] = useState(false);
  const [txt, setTxt] = useState(c.resposta || '');
  const [editando, setEditando] = useState(!c.resposta);
  const salvar = async () => {
    if (!txt.trim()) return;
    try { await api.upd('checkins', c.id, { resposta: txt.trim(), respondido_em: new Date().toISOString() }); toast('Resposta enviada', 'ok'); setEditando(false); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<section class="card">
    <div class="card-topo"><div>${aluna && html`<a href=${`#/aluna/${aluna.id}/checkins`}><h3>${aluna.nome}</h3></a>`}<small class="suave">Semana de ${dataBR(c.semana)} · enviado ${relativo(c.created_at)}</small></div>
      ${c.resposta ? html`<span class="tag roxo">respondido</span>` : html`<span class="tag atencao">aguardando</span>`}</div>
    <${ResumoCheckin} c=${c} sinal/>
    ${envio && html`<${MetasEnvio} envio=${envio}/>`}
    ${envio && html`<button class="btn-texto" onClick=${() => setVerEnvio(true)}>Ver o Oráculo completo (dores, ciclo, RIR)</button>`}
    ${verEnvio && html`<${ModalEnvio} envio=${envio} nome=${aluna ? aluna.nome : 'Oráculo'} onFechar=${() => setVerEnvio(false)}/>`}
    ${editando ? html`<textarea class="input" rows="3" placeholder="Sua resposta (a aluna vê no app)" value=${txt} onInput=${(ev) => setTxt(ev.target.value)}></textarea>
      <div class="acoes"><button class="btn primario" onClick=${salvar}>Responder</button>
      ${aluna && aluna.telefone && html`<a class="btn" target="_blank" rel="noopener" href=${linkWhats(aluna.telefone, txt ? `Oi, ${aluna.nome.split(' ')[0]}! Sobre o seu check-in:\n\n${txt}` : '')}>Mandar no WhatsApp</a>`}</div>`
      : html`<div class="resposta"><b>Sua resposta</b><p>${c.resposta}</p><button class="btn-texto" onClick=${() => setEditando(true)}>Editar</button></div>`}
  </section>`;
}

// envio do Oráculo que gerou o check-in daquela semana (quando veio pelo formulário vivo)
async function enviosOraculo(filtro = {}) {
  try {
    const [forms, envios] = await Promise.all([api.q('formularios', {}), api.q('envios', { ...filtro, order: 'enviado_em', asc: false, limit: 300 })]);
    return { forms, envios };
  } catch (e) { return { forms: [], envios: [] }; }
}
const envioDoCheckin = (c, { forms, envios }) => {
  const ora = new Set(forms.filter((f) => f.tipo === 'oraculo').map((f) => f.id));
  return envios.find((x) => x.aluna_id === c.aluna_id && ora.has(x.formulario_id) && segundaDe(new Date(x.enviado_em)) === c.semana) || null;
};

function CheckinsCoach() {
  const e = useCarregar(async () => {
    const [alunas, pend, semana, ev] = await Promise.all([alunasAtivas(), api.q('checkins', { eq: { resposta: null }, order: 'created_at' }), api.q('checkins', { eq: { semana: segundaDe() } }), enviosOraculo()]);
    return { alunas: alunas.filter((a) => a.ativo), pend, semana, ev };
  }, []);
  const [aberto, setAberto] = useState(null);
  return html`<div class="pilha"><h1 class="titulo">Oráculo</h1>
    <${Estado} e=${e}>${({ alunas, pend, semana, ev }) => {
      const faltam = alunas.filter((a) => !semana.some((c) => c.aluna_id === a.id));
      const outros = new Set(ev.forms.filter((f) => f.tipo !== 'oraculo').map((f) => f.id));
      const naoLidos = ev.envios.filter((x) => outros.has(x.formulario_id) && !x.lido_em);
      const nome = (id) => (alunas.find((a) => a.id === id) || {}).nome || 'Aluna';
      return html`
        ${naoLidos.length > 0 && html`<section class="card"><h3>Formulários para ler</h3><ul class="lista">${naoLidos.map((x) => html`<li class="linha"><button class="linha-botao" onClick=${() => setAberto(x)}>
          <div><b>${nome(x.aluna_id)}</b><small>${(ev.forms.find((f) => f.id === x.formulario_id) || {}).titulo} · ${relativo(x.enviado_em)}</small></div><span class="seta">›</span></button></li>`)}</ul></section>`}
        ${aberto && html`<${ModalEnvio} envio=${aberto} nome=${nome(aberto.aluna_id)} onFechar=${() => { setAberto(null); e.recarregar(); }}/>`}
        ${pend.length ? pend.map((c) => html`<${CartaoResposta} key=${c.id} c=${c} envio=${envioDoCheckin(c, ev)} aluna=${alunas.find((a) => a.id === c.aluna_id)} onFeito=${e.recarregar}/>`)
          : html`<${Vazio} titulo="Nenhum Oráculo esperando resposta" texto="Todos respondidos."/>`}
        ${faltam.length > 0 && html`<section class="card"><h3>Ainda não mandaram o desta semana</h3><ul class="lista">${faltam.map((a) => html`<li class="linha"><b>${a.nome}</b>
          ${a.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(a.telefone, `Oi, ${a.nome.split(' ')[0]}! Passando pra lembrar do check-in da semana no app. Leva 1 minutinho e é com ele que eu ajusto o seu treino 💜`)}>Lembrar no WhatsApp</a>`}</li>`)}</ul></section>`}`;
    }}<//></div>`;
}

function CheckinsDaAluna({ aluna }) {
  const e = useCarregar(async () => { const [l, ev] = await Promise.all([api.q('checkins', { eq: { aluna_id: aluna.id }, order: 'semana', asc: false }), enviosOraculo({ eq: { aluna_id: aluna.id } })]); return { l, ev }; }, [aluna.id]);
  return html`<${Estado} e=${e}>${({ l, ev }) => (l.length ? html`<div class="pilha">${l.map((c) => html`<${CartaoResposta} key=${c.id} c=${c} envio=${envioDoCheckin(c, ev)} aluna=${null} onFeito=${e.recarregar}/>`)}</div>`
    : html`<${Vazio} titulo="Nenhum check-in ainda"/>`)}<//>`;
}

// ============================================================
// LEADS (formulário de inscrição)
// ============================================================
const STATUS = [['novo', 'Novos'], ['contatado', 'Contatados'], ['fechado', 'Fechados'], ['perdido', 'Perdidos']];
function Leads() {
  const e = useCarregar(() => api.q('leads', { order: 'created_at', asc: false }), []);
  const [filtro, setFiltro] = useState('novo');
  const linkForm = location.origin + location.pathname.replace(/index\.html$/, '').replace(/\/?$/, '/') + 'form.html';
  const muda = async (l, status) => { try { await api.upd('leads', l.id, { status }); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } };
  const apagar = async (l) => { if (!confirm(`Apagar a inscrição de ${l.nome}?`)) return; await api.del('leads', l.id); e.recarregar(); };
  // Política de Privacidade: inscrição que não virou matrícula é apagada em até 6 meses
  const antigas = (leads) => leads.filter((l) => l.status !== 'fechado' && String(l.created_at).slice(0, 10) < somaDias(hoje(), -180));
  const limpar = async (l) => { if (!confirm(`Apagar ${l.length} inscrição(ões) com mais de 6 meses que não viraram matrícula? A Política de Privacidade promete isso às inscritas.`)) return;
    try { for (const x of l) await api.del('leads', x.id); toast('Inscrições antigas apagadas', 'ok'); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } };
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Inscrições</h1><button class="btn" onClick=${() => copiar(linkForm)}>Copiar link do formulário</button></div>
    <p class="suave">Link para colocar na bio: <a href=${linkForm} target="_blank" rel="noopener">${linkForm.replace(/^https?:\/\//, '')}</a></p>
    <${Estado} e=${e}>${(leads) => html`
      ${antigas(leads).length > 0 && html`<p class="nota atencao">${antigas(leads).length} inscrição(ões) com mais de 6 meses que não viraram matrícula. <button class="btn-texto" onClick=${() => limpar(antigas(leads))}>Apagar agora</button></p>`}
      <div class="chips">${STATUS.map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r} (${leads.filter((l) => l.status === k).length})</button>`)}</div>
      ${leads.filter((l) => l.status === filtro).map((l) => html`<section class="card lead">
        <div class="card-topo"><div><h3>${l.nome}${l.idade ? `, ${l.idade}` : ''}</h3><small class="suave">${relativo(l.created_at)}${l.instagram ? ' · ' + l.instagram : ''}</small></div>
          ${l.plano_interesse && html`<span class="tag roxo">${l.plano_interesse}</span>`}</div>
        <dl class="respostas compacta">
          ${[['Objetivo', l.objetivo], ['Experiência', l.experiencia], ['Dias por semana', l.dias_semana], ['Onde treina', l.local_treino]].filter(([, v]) => v).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}
        </dl>
        ${l.mensagem && html`<p class="nota">"${l.mensagem}"</p>`}
        <div class="acoes">
          <a class="btn primario" target="_blank" rel="noopener" onClick=${() => l.status === 'novo' && muda(l, 'contatado')} href=${linkWhats(l.whatsapp, `Oi, ${l.nome.split(' ')[0]}! Aqui é o Luiz, recebi sua inscrição pra consultoria. Vi que seu objetivo é ${(l.objetivo || 'melhorar seus resultados').toLowerCase()}. Posso te fazer umas perguntas rápidas pra entender sua rotina?`)}>WhatsApp</a>
          <select class="input curto" value=${l.status} onChange=${(ev) => muda(l, ev.target.value)} aria-label="Status">${STATUS.map(([k, r]) => html`<option value=${k}>${r.slice(0, -1)}</option>`)}</select>
          <button class="btn-texto perigo" onClick=${() => apagar(l)}>Apagar</button>
        </div></section>`)}
      ${!leads.filter((l) => l.status === filtro).length && html`<${Vazio} titulo="Nada aqui" texto=${filtro === 'novo' ? 'Quando alguém preencher o formulário, aparece aqui.' : ''}/>`}`}<//>
  </div>`;
}
