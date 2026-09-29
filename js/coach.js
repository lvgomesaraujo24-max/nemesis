// Lado do TREINADOR
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Acropole } from './comando.js';
import { Selo, DossieAluna } from './dossie.js';
import { Formularios, ModalEnvio } from './formularios.js';
import { Agenda, CardioAluna, TestesAluna, MetasAluna } from './extras.js';
import { Evolucao, Anamnese, Avaliacoes } from './comum.js';
import { ResumoCheckin } from './aluna.js';
import { Relatorio } from './relatorio.js';
import { Icone } from './icones.js';
import { Ficha } from './ficha.js';
import { MUSCULOS, GRUPOS_MUSC, musculosDe } from './musculos.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Abas, Barras, toast, num, brl, dataBR, hoje, segundaDe, somaDias,
  somaMeses, diasEntre, lerNum, relativo, linkWhats, copiar, mesNome, idadeDe } from './util.js';

// menu lateral em grupos, como no painel: principal, ferramentas
const NAV = [
  [['', 'Acrópole', 'inicio'], ['alunas', 'Alunas', 'alunas'], ['agenda', 'Agenda', 'agenda'], ['financeiro', 'Financeiro', 'financeiro']],
  [['checkins', 'Oráculo', 'oraculo'], ['formularios', 'Formulários', 'formularios'], ['leads', 'Inscrições', 'inscricoes'], ['exercicios', 'Exercícios', 'exercicios']],
];
const NAV_BAIXO = ['', 'alunas', 'checkins', 'agenda', 'financeiro'];
const CHAVE_MENU = 'nemesis-menu-recolhido';

export function AppCoach({ perfil, rota, ir }) {
  const [base, id, sub] = rota;
  let tela;
  if (base === 'aluna' && id) tela = html`<${AlunaDetalhe} id=${id} aba=${sub || 'ficha'} ir=${ir} coachNome=${perfil.nome} onAluna=${(a) => setAlunaAtual(a)}/>`;
  else if (base === 'alunas') tela = html`<${Alunas} ir=${ir}/>`;
  else if (base === 'checkins') tela = html`<${CheckinsCoach} ir=${ir}/>`;
  else if (base === 'leads') tela = html`<${Leads}/>`;
  else if (base === 'financeiro') tela = html`<${Financeiro} ir=${ir}/>`;
  else if (base === 'exercicios') tela = html`<${Exercicios}/>`;
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
      <main class=${'conteudo largo' + (aba === '' || (base === 'aluna' && (sub || 'ficha') === 'ficha') ? ' acropole' : '')}>${tela}</main>
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
function Alunas({ ir }) {
  const e = useCarregar(async () => {
    const [alunas, sessoes, assinaturas] = await Promise.all([alunasAtivas(), api.q('sessoes', {}), api.q('assinaturas', {})]);
    return { alunas, sessoes, assinaturas };
  }, []);
  const [busca, setBusca] = useState('');
  const [inativas, setInativas] = useState(false);
  const [convite, setConvite] = useState(false);
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Alunas</h1><button class="btn primario" onClick=${() => setConvite(true)}>+ Convidar aluna</button></div>
    <input class="input" type="search" placeholder="Buscar pelo nome" value=${busca} onInput=${(ev) => setBusca(ev.target.value)}/>
    <${Estado} e=${e}>${({ alunas, sessoes, assinaturas }) => {
      const lista = alunas.filter((a) => a.ativo !== inativas && a.nome.toLowerCase().includes(busca.toLowerCase()));
      const nInat = alunas.filter((a) => !a.ativo).length;
      return html`${!lista.length ? html`<${Vazio} titulo=${alunas.length ? 'Ninguém encontrado' : 'Nenhuma aluna ainda'} texto=${alunas.length ? '' : 'Mande o link do app para a aluna criar a conta. Ela aparece aqui na hora.'}/>` : null}
        ${lista.map((a) => {
          const u = sessoes.filter((s) => s.aluna_id === a.id).map((s) => s.data).sort().pop();
          const s = assinaturas.filter((x) => x.aluna_id === a.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0];
          const d = s ? diasEntre(hoje(), s.fim) : null;
          return html`<button class="card aluna" onClick=${() => ir('aluna/' + a.id)}>
            <span class="avatar">${(a.nome || '?').slice(0, 1)}</span>
            <div class="aluna-info"><b>${a.nome || a.email}</b><small>Último treino: ${relativo(u)}${a.objetivo ? ' · ' + a.objetivo : ''}</small></div>
            <div class="treino-tags">${!a.anamnese_ok ? html`<span class="tag atencao">sem anamnese</span>` : null}
              ${s ? html`<span class=${'tag' + (d < 0 ? ' perigo' : d <= 10 ? ' atencao' : '')}>${s.plano_nome} · ${d < 0 ? 'vencido' : d + 'd'}</span>` : html`<span class="tag">sem plano</span>`}<span class="seta">›</span></div>
          </button>`;
        })}
        ${nInat > 0 && html`<button class="btn-texto" onClick=${() => setInativas(!inativas)}>${inativas ? 'Ver ativas' : `Ver inativas (${nInat})`}</button>`}`;
    }}<//>
    ${convite && html`<${Convite} onFechar=${() => setConvite(false)}/>`}
  </div>`;
}

function Convite({ onFechar }) {
  const link = location.origin + location.pathname;
  const msg = `Oi! Seja bem-vinda ao time 💜\n\nSeu app de treino é o Nemesis. É por ele que você vai ver sua ficha, registrar as cargas e mandar o check-in da semana.\n\n1. Abra este link: ${link}\n2. Toque em "Criar conta" e use o seu e-mail\n3. Preencha a anamnese (leva uns 5 minutos)\n\nNo celular, toque em "Adicionar à tela de início" para ele virar um app. Qualquer dúvida, me chama aqui.`;
  const [tel, setTel] = useState('');
  return html`<${Modal} titulo="Convidar aluna" onFechar=${onFechar}>
    <div class="pilha">
      <p class="suave">A aluna cria a conta pelo link e aparece na sua lista. Depois é só montar a ficha e registrar o plano.</p>
      <textarea class="input" rows="9" readonly value=${msg}></textarea>
      <button class="btn" onClick=${() => copiar(msg)}>Copiar mensagem</button>
      <${Campo} rotulo="Ou mande direto no WhatsApp"><input class="input" inputmode="tel" placeholder="(11) 99999-9999" value=${tel} onInput=${(ev) => setTel(ev.target.value)}/><//>
      <a class="btn primario" target="_blank" rel="noopener" href=${linkWhats(tel, msg)}>Abrir no WhatsApp</a>
    </div><//>`;
}

// ============================================================
// DETALHE DA ALUNA
// ============================================================
const ABAS_ALUNA = [['ficha', 'Ficha'], ['evolucao', 'Evolução'], ['relatorio', 'Relatório'], ['checkins', 'Oráculo'], ['dossie', 'Dossiê'], ['metas', 'Metas'], ['cardio', 'Cardio'], ['testes', 'Testes'],
  ['avaliacoes', 'Avaliações'], ['anamnese', 'Alistamento'], ['financeiro', 'Financeiro'], ['dados', 'Dados']];
function AlunaDetalhe({ id, aba, ir, onAluna, coachNome }) {
  const e = useCarregar(async () => { const a = await api.um('profiles', { id }); if (a && onAluna) onAluna({ id: a.id, nome: a.nome }); return a; }, [id]);
  return html`<${Estado} e=${e}>${(a) => (!a ? html`<${Vazio} titulo="Aluna não encontrada"/>` : html`<div class="pilha">
    <button class="btn-texto" onClick=${() => ir('alunas')}>‹ Alunas</button>
    <div class="aluna-cab"><span class="avatar grande">${(a.nome || '?').slice(0, 1)}</span>
      <div><h1>${a.nome || a.email}</h1><p class="suave">${[idadeDe(a.nascimento) && idadeDe(a.nascimento) + ' anos', a.objetivo].filter(Boolean).join(' · ') || a.email}</p></div>
      ${a.telefone && html`<a class="btn" target="_blank" rel="noopener" href=${linkWhats(a.telefone)}>WhatsApp</a>`}</div>
    <${Abas} abas=${ABAS_ALUNA} atual=${aba} onMuda=${(k) => ir(`aluna/${id}/${k}`)}/>
    ${aba === 'ficha' && html`<${Ficha} aluna=${a}/>`}
    ${aba === 'evolucao' && html`<${Evolucao} alunaId=${a.id}/>`}
    ${aba === 'relatorio' && html`<${Relatorio} aluna=${a} coachNome=${coachNome} podeEditar=${true}/>`}
    ${aba === 'checkins' && html`<${CheckinsDaAluna} aluna=${a}/>`}
    ${aba === 'dossie' && html`<${DossieAluna} aluna=${a}/>`}
    ${aba === 'metas' && html`<${MetasAluna} aluna=${a}/>`}
    ${aba === 'cardio' && html`<${CardioAluna} aluna=${a}/>`}
    ${aba === 'testes' && html`<${TestesAluna} aluna=${a}/>`}
    ${aba === 'avaliacoes' && html`<${Avaliacoes} aluna=${a} podeEditar=${true}/>`}
    ${aba === 'anamnese' && html`<${Anamnese} alunaId=${a.id} leitura=${true}/>`}
    ${aba === 'financeiro' && html`<${FinanceiroAluna} aluna=${a}/>`}
    ${aba === 'dados' && html`<${DadosAluna} aluna=${a} onSalvo=${e.recarregar}/>`}
  </div>`)}<//>`;
}

function DadosAluna({ aluna, onSalvo }) {
  const [f, setF] = useState({ nome: aluna.nome || '', telefone: aluna.telefone || '', nascimento: aluna.nascimento || '', sexo: aluna.sexo || 'F', objetivo: aluna.objetivo || '', ativo: aluna.ativo,
    alistada_em: aluna.alistada_em || String(aluna.created_at || '').slice(0, 10), treinos_semana_alvo: aluna.treinos_semana_alvo || '' });
  const salvar = async (ev) => {
    ev.preventDefault();
    const alvo = lerNum(f.treinos_semana_alvo);
    try { await api.upd('profiles', aluna.id, { ...f, telefone: f.telefone || null, nascimento: f.nascimento || null, alistada_em: f.alistada_em || null, treinos_semana_alvo: alvo ? Math.min(7, Math.max(1, Math.round(alvo))) : null }); toast('Dados salvos', 'ok'); onSalvo(); }
    catch (err) { toast(err.message, 'erro'); }
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
    <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Aluna ativa</label>
    <p class="suave">E-mail de acesso: ${aluna.email}</p>
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
    <${ResumoCheckin} c=${c}/>
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
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Inscrições</h1><button class="btn" onClick=${() => copiar(linkForm)}>Copiar link do formulário</button></div>
    <p class="suave">Link para colocar na bio: <a href=${linkForm} target="_blank" rel="noopener">${linkForm.replace(/^https?:\/\//, '')}</a></p>
    <${Estado} e=${e}>${(leads) => html`
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

// ============================================================
// FINANCEIRO
// ============================================================
function Financeiro({ ir }) {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [modal, setModal] = useState(null);
  const e = useCarregar(async () => {
    const [lanc, alunas, assinaturas, planos] = await Promise.all([api.q('lancamentos', { order: 'vencimento' }), alunasAtivas(), api.q('assinaturas', {}), api.q('planos', { order: 'meses' })]);
    return { lanc, alunas, assinaturas, planos };
  }, []);
  const navMes = (d) => setMes(somaMeses(mes + '-15', d).slice(0, 7));
  const pagar = async (l) => { try { await api.upd('lancamentos', l.id, { pago_em: l.pago_em ? null : hoje() }); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } };
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Financeiro</h1><button class="btn primario" onClick=${() => setModal({ tipo: 'lanc' })}>+ Lançamento</button></div>
    <${Estado} e=${e}>${({ lanc, alunas, assinaturas, planos }) => {
      const doMes = lanc.filter((l) => l.vencimento.slice(0, 7) === mes);
      const soma = (l) => l.reduce((t, x) => t + Number(x.valor), 0);
      const recebido = soma(lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.pago_em.slice(0, 7) === mes));
      const aReceber = soma(doMes.filter((l) => l.tipo === 'receita' && !l.pago_em));
      const despesas = soma(lanc.filter((l) => l.tipo === 'despesa' && (l.pago_em || l.vencimento).slice(0, 7) === mes));
      const atrasadas = lanc.filter((l) => l.tipo === 'receita' && !l.pago_em && l.vencimento < hoje());
      const seis = [...Array(6)].map((_, i) => somaMeses(mes + '-15', i - 5).slice(0, 7)).map((m) => ({ x: mesNome(m).split(' ')[0], v: soma(lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.pago_em.slice(0, 7) === m)) }));
      const ativas = alunas.filter((a) => a.ativo);
      const vencendo = ativas.map((a) => ({ a, s: assinaturas.filter((x) => x.aluna_id === a.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0] })).filter(({ s }) => !s || diasEntre(hoje(), s.fim) <= 15)
        .sort((x, y) => ((x.s ? x.s.fim : '') < (y.s ? y.s.fim : '') ? -1 : 1));
      return html`
        <div class="mes-nav"><button class="icone" aria-label="Mês anterior" onClick=${() => navMes(-1)}>‹</button><b>${mesNome(mes)}</b><button class="icone" aria-label="Próximo mês" onClick=${() => navMes(1)}>›</button></div>
        <div class="stats">
          <div class="stat"><b>${brl(recebido)}</b><span>recebido</span></div>
          <div class="stat"><b>${brl(aReceber)}</b><span>a receber no mês</span></div>
          <div class="stat"><b>${brl(despesas)}</b><span>despesas</span></div>
          <div class=${'stat' + (recebido - despesas < 0 ? ' neg' : '')}><b>${brl(recebido - despesas)}</b><span>saldo do mês</span></div>
        </div>
        <section class="card"><h3>Recebido nos últimos 6 meses</h3><${Barras} dados=${seis}/></section>
        ${atrasadas.length > 0 && html`<section class="card alerta"><h3>Em atraso · ${brl(soma(atrasadas))}</h3><ul class="lista">${atrasadas.map((l) => html`<li class="linha"><div><b>${l.descricao}</b><small>venceu ${dataBR(l.vencimento)}</small></div>
          <div class="mini-acoes"><span class="valor">${brl(l.valor)}</span><button class="btn-texto" onClick=${() => pagar(l)}>Recebido</button></div></li>`)}</ul></section>`}
        ${vencendo.length > 0 && html`<section class="card"><h3>Renovações</h3><ul class="lista">${vencendo.map(({ a, s }) => { const d = s ? diasEntre(hoje(), s.fim) : null;
          return html`<li class="linha"><div><b>${a.nome}</b><small>${s ? `${s.plano_nome} · ${d < 0 ? `venceu há ${-d} dias` : `vence em ${d} dias`}` : 'sem plano registrado'}</small></div>
            <button class="btn-texto" onClick=${() => setModal({ tipo: 'plano', aluna: a })}>${s ? 'Renovar' : 'Registrar plano'}</button></li>`; })}</ul></section>`}
        <section class="card"><div class="card-topo"><h3>Lançamentos de ${mesNome(mes)}</h3></div>
          ${doMes.length ? html`<ul class="lista">${doMes.map((l) => html`<li class=${'linha lanc ' + l.tipo}>
            <button class=${'check' + (l.pago_em ? ' on' : '')} aria-label=${l.pago_em ? 'Marcar como não pago' : 'Marcar como pago'} onClick=${() => pagar(l)}>✓</button>
            <div class="lanc-info"><b>${l.descricao}</b><small>${l.categoria || (l.tipo === 'receita' ? 'Receita' : 'Despesa')} · vence ${dataBR(l.vencimento)}${l.pago_em ? ' · pago ' + dataBR(l.pago_em) : ''}</small></div>
            <span class="valor">${l.tipo === 'despesa' ? '−' : ''}${brl(l.valor)}</span>
            <button class="icone" aria-label="Editar" onClick=${() => setModal({ tipo: 'lanc', lanc: l })}>✎</button></li>`)}</ul>`
            : html`<p class="suave">Nenhum lançamento neste mês.</p>`}
        </section>
        <section class="card"><div class="card-topo"><h3>Planos</h3><button class="btn-texto" onClick=${() => setModal({ tipo: 'planos' })}>Editar valores</button></div>
          <div class="planos">${planos.filter((p) => p.ativo).map((p) => html`<div><b>${p.nome}</b><span>${p.meses} ${p.meses > 1 ? 'meses' : 'mês'} · ${brl(p.valor)}</span></div>`)}</div></section>
        ${modal && modal.tipo === 'lanc' && html`<${ModalLancamento} lanc=${modal.lanc} alunas=${ativas} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
        ${modal && modal.tipo === 'plano' && html`<${NovaAssinatura} aluna=${modal.aluna} planos=${planos} anterior=${assinaturas.filter((x) => x.aluna_id === modal.aluna.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0]} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
        ${modal && modal.tipo === 'planos' && html`<${ModalPlanos} planos=${planos} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
        `;
    }}<//>
  </div>`;
}

function ModalLancamento({ lanc, alunas, onFechar, onFeito }) {
  const [f, setF] = useState(lanc ? { ...lanc, valor: String(lanc.valor).replace('.', ','), categoria: lanc.categoria || '', aluna_id: lanc.aluna_id || '', pago: !!lanc.pago_em }
    : { tipo: 'despesa', descricao: '', categoria: '', valor: '', vencimento: hoje(), aluna_id: '', pago: true });
  const salvar = async (ev) => {
    ev.preventDefault();
    const valor = lerNum(f.valor); if (!f.descricao.trim() || !valor) { toast('Preencha descrição e valor.', 'erro'); return; }
    const linha = { tipo: f.tipo, descricao: f.descricao.trim(), categoria: f.categoria || null, valor, vencimento: f.vencimento, aluna_id: f.aluna_id || null, pago_em: f.pago ? (lanc && lanc.pago_em) || hoje() : null };
    try { if (lanc) await api.upd('lancamentos', lanc.id, linha); else await api.ins('lancamentos', linha); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar este lançamento?')) return; await api.del('lancamentos', lanc.id); onFeito(); };
  return html`<${Modal} titulo=${lanc ? 'Editar lançamento' : 'Novo lançamento'} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <div class="chips">${[['receita', 'Receita'], ['despesa', 'Despesa']].map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
      <${Campo} rotulo="Descrição"><input class="input" value=${f.descricao} onInput=${(ev) => setF({ ...f, descricao: ev.target.value })}/><//>
      <div class="grade2">
        <${Campo} rotulo="Valor (R$)"><input class="input" inputmode="decimal" value=${f.valor} onInput=${(ev) => setF({ ...f, valor: ev.target.value })}/><//>
        <${Campo} rotulo="Vencimento"><input class="input" type="date" value=${f.vencimento} onInput=${(ev) => setF({ ...f, vencimento: ev.target.value })}/><//>
      </div>
      <${Campo} rotulo="Categoria" dica="Ex.: Consultoria, Marketing, Ferramentas, Presencial"><input class="input" value=${f.categoria} onInput=${(ev) => setF({ ...f, categoria: ev.target.value })}/><//>
      <${Campo} rotulo="Aluna (opcional)"><select class="input" value=${f.aluna_id} onChange=${(ev) => setF({ ...f, aluna_id: ev.target.value })}><option value="">Nenhuma</option>${alunas.map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select><//>
      <label class="toggle"><input type="checkbox" checked=${f.pago} onChange=${(ev) => setF({ ...f, pago: ev.target.checked })}/> Já foi pago</label>
      <button class="btn primario grande">Salvar</button>
      ${lanc && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
    </form><//>`;
}

function NovaAssinatura({ aluna, planos, anterior, onFechar, onFeito }) {
  const inicio0 = anterior && anterior.fim >= somaDias(hoje(), -15) ? anterior.fim : hoje();
  const [f, setF] = useState({ plano_id: (planos[0] || {}).id, inicio: inicio0, valor: planos[0] ? String(planos[0].valor) : '', parcelas: 1, forma: 'Pix', primeiraPaga: true });
  const plano = planos.find((p) => p.id === f.plano_id) || {};
  const escolhe = (id) => { const p = planos.find((x) => x.id === id); setF({ ...f, plano_id: id, valor: String(p.valor) }); };
  const valor = lerNum(f.valor) || 0; const parcelas = Math.max(1, lerNum(f.parcelas) || 1);
  const salvar = async (ev) => {
    ev.preventDefault();
    try {
      const [a] = await api.ins('assinaturas', { aluna_id: aluna.id, plano_id: plano.id, plano_nome: plano.nome, inicio: f.inicio, fim: somaMeses(f.inicio, plano.meses), valor, forma_pagamento: parcelas > 1 ? `${f.forma} ${parcelas}x` : f.forma });
      const vp = Math.round((valor / parcelas) * 100) / 100;
      const linhas = [...Array(parcelas)].map((_, i) => ({ tipo: 'receita', descricao: `${plano.nome} · ${aluna.nome}${parcelas > 1 ? ` (${i + 1}/${parcelas})` : ''}`, categoria: 'Consultoria',
        valor: i === parcelas - 1 ? Math.round((valor - vp * (parcelas - 1)) * 100) / 100 : vp, vencimento: somaMeses(f.inicio, i), pago_em: i === 0 && f.primeiraPaga ? hoje() : null, aluna_id: aluna.id, assinatura_id: a.id }));
      await api.ins('lancamentos', linhas);
      toast('Plano registrado', 'ok'); onFeito();
    } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${'Plano · ' + aluna.nome} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <div class="chips">${planos.filter((p) => p.ativo).map((p) => html`<button type="button" class=${f.plano_id === p.id ? 'chip on' : 'chip'} onClick=${() => escolhe(p.id)}>${p.nome} · ${p.meses}m</button>`)}</div>
      <div class="grade2">
        <${Campo} rotulo="Início"><input class="input" type="date" value=${f.inicio} onInput=${(ev) => setF({ ...f, inicio: ev.target.value })}/><//>
        <${Campo} rotulo="Valor total (R$)"><input class="input" inputmode="decimal" value=${f.valor} onInput=${(ev) => setF({ ...f, valor: ev.target.value })}/><//>
        <${Campo} rotulo="Parcelas"><select class="input" value=${f.parcelas} onChange=${(ev) => setF({ ...f, parcelas: +ev.target.value })}>${[...Array(12)].map((_, i) => html`<option value=${i + 1}>${i + 1}x</option>`)}</select><//>
        <${Campo} rotulo="Forma"><select class="input" value=${f.forma} onChange=${(ev) => setF({ ...f, forma: ev.target.value })}>${['Pix', 'Cartão', 'Boleto', 'Dinheiro'].map((o) => html`<option value=${o} selected=${f.forma === o}>${o}</option>`)}</select><//>
      </div>
      <p class="suave">Vai de ${dataBR(f.inicio)} até ${plano.meses ? dataBR(somaMeses(f.inicio, plano.meses)) : '·'}. ${parcelas > 1 ? `${parcelas} parcelas de ${brl(valor / parcelas)} lançadas mês a mês.` : ''}</p>
      <label class="toggle"><input type="checkbox" checked=${f.primeiraPaga} onChange=${(ev) => setF({ ...f, primeiraPaga: ev.target.checked })}/> ${parcelas > 1 ? 'Primeira parcela já foi paga' : 'Já foi pago'}</label>
      <button class="btn primario grande">Registrar plano</button>
    </form><//>`;
}

function ModalPlanos({ planos, onFechar, onFeito }) {
  const [l, setL] = useState(planos.map((p) => ({ ...p, valor: String(p.valor).replace('.', ',') })));
  const salvar = async () => {
    try { for (const p of l) await api.upd('planos', p.id, { nome: p.nome, meses: lerNum(p.meses), valor: lerNum(p.valor), ativo: p.ativo }); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  const muda = (i, k, v) => setL(l.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  return html`<${Modal} titulo="Planos" onFechar=${onFechar}><div class="pilha">
    ${l.map((p, i) => html`<div class="grade3">
      <${Campo} rotulo="Nome"><input class="input" value=${p.nome} onInput=${(ev) => muda(i, 'nome', ev.target.value)}/><//>
      <${Campo} rotulo="Meses"><input class="input" inputmode="numeric" value=${p.meses} onInput=${(ev) => muda(i, 'meses', ev.target.value)}/><//>
      <${Campo} rotulo="Valor"><input class="input" inputmode="decimal" value=${p.valor} onInput=${(ev) => muda(i, 'valor', ev.target.value)}/><//>
    </div>`)}
    <button class="btn primario grande" onClick=${salvar}>Salvar planos</button></div><//>`;
}

function FinanceiroAluna({ aluna }) {
  const e = useCarregar(async () => {
    const [ass, lanc, planos] = await Promise.all([api.q('assinaturas', { eq: { aluna_id: aluna.id }, order: 'inicio', asc: false }), api.q('lancamentos', { eq: { aluna_id: aluna.id }, order: 'vencimento' }), api.q('planos', { order: 'meses' })]);
    return { ass, lanc, planos };
  }, [aluna.id]);
  const [novo, setNovo] = useState(false);
  const pagar = async (l) => { await api.upd('lancamentos', l.id, { pago_em: l.pago_em ? null : hoje() }); e.recarregar(); };
  return html`<${Estado} e=${e}>${({ ass, lanc, planos }) => { const total = lanc.filter((l) => l.pago_em).reduce((t, l) => t + Number(l.valor), 0);
    return html`<div class="pilha">
      <button class="btn primario" onClick=${() => setNovo(true)}>${ass.length ? 'Renovar plano' : '+ Registrar plano'}</button>
      ${ass.length ? ass.map((a) => { const d = diasEntre(hoje(), a.fim); return html`<section class="card"><div class="card-topo"><h3>${a.plano_nome}</h3>
        <span class=${'tag' + (d < 0 ? '' : d <= 10 ? ' atencao' : ' roxo')}>${d < 0 ? 'encerrado' : `${d} dias restantes`}</span></div>
        <p class="suave">${dataBR(a.inicio)} a ${dataBR(a.fim)} · ${brl(a.valor)}${a.forma_pagamento ? ' · ' + a.forma_pagamento : ''}</p>
        <ul class="lista">${lanc.filter((l) => l.assinatura_id === a.id).map((l) => html`<li class="linha lanc">
          <button class=${'check' + (l.pago_em ? ' on' : '')} aria-label="Alternar pago" onClick=${() => pagar(l)}>✓</button>
          <div class="lanc-info"><b>${brl(l.valor)}</b><small>vence ${dataBR(l.vencimento)}${l.pago_em ? ' · pago' : l.vencimento < hoje() ? ' · em atraso' : ''}</small></div></li>`)}</ul>
        <button class="btn-texto perigo" onClick=${async () => { if (confirm('Apagar este plano e as parcelas dele?')) { await api.del('assinaturas', a.id); e.recarregar(); } }}>Apagar plano</button>
      </section>`; }) : html`<${Vazio} titulo="Nenhum plano registrado"/>`}
      ${total > 0 && html`<p class="suave">Total já recebido desta aluna: ${brl(total)}</p>`}
      ${novo && html`<${NovaAssinatura} aluna=${aluna} planos=${planos} anterior=${ass[0]} onFechar=${() => setNovo(false)} onFeito=${() => { setNovo(false); e.recarregar(); }}/>`}
    </div>`; }}<//>`;
}

// ============================================================
// BIBLIOTECA DE EXERCÍCIOS
// ============================================================
function Exercicios() {
  const e = useCarregar(() => api.q('exercicios', { order: 'nome' }), []);
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState(null);
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Exercícios</h1><button class="btn primario" onClick=${() => setEdit({})}>+ Exercício</button></div>
    <p class="suave">Cole o link do seu vídeo (YouTube, Drive, Instagram) em cada exercício e a aluna vê o botão "Ver vídeo" na execução.</p>
    <input class="input" type="search" placeholder="Buscar" value=${busca} onInput=${(ev) => setBusca(ev.target.value)}/>
    <${Estado} e=${e}>${(lista) => {
      const f = lista.filter((x) => (x.nome + ' ' + (x.grupo || '')).toLowerCase().includes(busca.toLowerCase()));
      const grupos = [...new Set(f.map((x) => x.grupo || 'Sem grupo'))].sort();
      return grupos.map((g) => html`<section class="card"><h3>${g}</h3><ul class="lista">${f.filter((x) => (x.grupo || 'Sem grupo') === g).map((x) => html`<li class="linha">
        <button class="linha-botao" onClick=${() => setEdit(x)}><b>${x.nome}</b>${x.video_url ? html`<span class="tag roxo">vídeo</span>` : html`<span class="tag">sem vídeo</span>`}</button></li>`)}</ul></section>`);
    }}<//>
    ${edit && html`<${ModalExercicio} ex=${edit} onFechar=${() => setEdit(null)} onFeito=${() => { setEdit(null); e.recarregar(); }}/>`}
  </div>`;
}

function ModalExercicio({ ex, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: ex.nome || '', grupo: ex.grupo || '', video_url: ex.video_url || '', instrucoes: ex.instrucoes || '' });
  // músculos: começa pelo que o app deduz; só grava se o treinador mexer
  const [mus, setMus] = useState(() => { const m = musculosDe(ex.id ? ex : null); return { primarios: m.primarios, secundarios: m.secundarios, mexeu: false }; });
  const auto = musculosDe({ ...ex, ...f, musculos: null });
  const papel = (k) => (mus.primarios.includes(k) ? 'p' : mus.secundarios.includes(k) ? 's' : '');
  const alterna = (k) => {
    const p = papel(k); const tira = (l) => l.filter((x) => x !== k);
    setMus({ primarios: p === '' ? [...mus.primarios, k] : tira(mus.primarios), secundarios: p === 'p' ? [...mus.secundarios, k] : tira(mus.secundarios), mexeu: true });
  };
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) return;
    const linha = { nome: f.nome.trim(), grupo: f.grupo || null, video_url: f.video_url || null, instrucoes: f.instrucoes || null };
    if (mus.mexeu) linha.musculos = mus.primarios.length || mus.secundarios.length ? { primarios: mus.primarios, secundarios: mus.secundarios } : null;
    try { if (ex.id) await api.upd('exercicios', ex.id, linha); else await api.ins('exercicios', linha); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm(`Apagar "${ex.nome}" da biblioteca? Nas fichas que usam ele, vai aparecer "exercício removido".`)) return; await api.del('exercicios', ex.id); onFeito(); };
  return html`<${Modal} titulo=${ex.id ? 'Editar exercício' : 'Novo exercício'} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
      <${Campo} rotulo="Grupo muscular"><input class="input" list="grupos" value=${f.grupo} onInput=${(ev) => setF({ ...f, grupo: ev.target.value })}/>
        <datalist id="grupos">${['Glúteos', 'Quadríceps', 'Posteriores', 'Adutores', 'Panturrilha', 'Costas', 'Lombar', 'Peito', 'Ombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio'].map((g) => html`<option value=${g}/>`)}</datalist><//>
      <div class="campo"><span class="rotulo">Músculos (volume da ficha)</span>
        <small>Toque uma vez para principal (conta 1 série), duas para auxiliar (0,5), três para tirar.</small>
        ${GRUPOS_MUSC.map((g) => html`<div class="musc-grupo"><small>${g}</small><div class="chips">${Object.keys(MUSCULOS).filter((k) => MUSCULOS[k].grupo === g).map((k) => { const p = papel(k);
          return html`<button type="button" class=${'chip musc ' + p} onClick=${() => alterna(k)}>${MUSCULOS[k].nome}${p === 'p' ? ' · principal' : p === 's' ? ' · auxiliar' : ''}</button>`; })}</div></div>`)}
        ${mus.mexeu ? html`<button type="button" class="btn-texto" onClick=${() => setMus({ primarios: auto.primarios, secundarios: auto.secundarios, mexeu: true })}>Voltar para o automático</button>`
          : html`<small>${musculosDe(ex.id ? ex : null).auto ? 'Automático pelo nome do exercício.' : 'Definido por você.'}</small>`}
      </div>
      <${Campo} rotulo="Link do vídeo"><input class="input" type="url" placeholder="https://" value=${f.video_url} onInput=${(ev) => setF({ ...f, video_url: ev.target.value })}/><//>
      <${Campo} rotulo="Como executar (pontos de atenção)"><textarea class="input" rows="4" value=${f.instrucoes} onInput=${(ev) => setF({ ...f, instrucoes: ev.target.value })}></textarea><//>
      <button class="btn primario grande">Salvar</button>
      ${ex.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
    </form><//>`;
}

