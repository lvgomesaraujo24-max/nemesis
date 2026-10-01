// Lado da ALUNA
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Evolucao, Anamnese, Avaliacoes, metasAtuais } from './comum.js';
import { ResponderFormulario, pendenciasDaAluna } from './vivo.js';
import { CardioAluna, TestesAluna, MetasAluna, NOME_MODALIDADE } from './extras.js';
import { Execucao } from './arena.js';
import { Relatorio } from './relatorio.js';
import { ArquivosAluna } from './aluna360.js';
import { TelaConsentimento, PrivacidadeAluna, consentimentoAtual, precisaConsentir, legalPreenchido } from './legal.js';
import { Icone } from './icones.js';
import { tempoTreino, fmtTempo } from './musculos.js';
import { DEMO } from './api.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Escala, toast, num, dataBR, iso, hoje, segundaDe, lerNum, relativo, diasEntre, semaforo } from './util.js';

export function AppAluna({ perfil, rota, ir, recarregarPerfil }) {
  const [pulouAnamnese, setPulou] = useState(false);
  const [base, id, sub] = rota;
  const pend = useCarregar(() => (DEMO ? Promise.resolve([]) : pendenciasDaAluna(perfil.id).catch(() => [])), [perfil.id, base]);
  // LGPD: sem o aceite dos termos e do consentimento de saúde (versão atual), nada do app abre
  const cons = useCarregar(() => consentimentoAtual(perfil.id), [perfil.id]);
  if (cons.carregando && cons.dados === null && !cons.erro) return html`<div class="carregando cheio"><span class="spin"></span></div>`;
  // falha ao conferir o aceite (rede, sessão): não abre o app sem saber
  if (cons.erro && (DEMO || legalPreenchido())) {
    return html`<div class="tela"><header class="topo"><span class="marca">NEMESIS</span></header><main class="conteudo pilha">
      <div class="boas-vindas"><h1>Não deu para carregar</h1><p class="suave">${cons.erro}</p></div>
      <button class="btn primario grande" onClick=${cons.recarregar}>Tentar de novo</button>
      <button class="btn-texto" onClick=${() => api.sair()}>Sair</button></main></div>`;
  }
  if (precisaConsentir(cons.dados)) return html`<${TelaConsentimento} perfil=${perfil} atual=${cons.dados || null} onFeito=${cons.recarregar}/>`;
  if (!perfil.anamnese_ok && !pulouAnamnese) {
    return html`<div class="tela"><header class="topo"><span class="marca">NEMESIS</span></header>
      <main class="conteudo">
        <div class="boas-vindas"><p class="sobre">Bem-vinda, ${primeiroNome(perfil.nome)}.</p>
          <h1>Antes do primeiro treino, me conta sobre você.</h1>
          <p class="suave">Leva uns 5 minutos. É com isso que eu monto a sua ficha.</p></div>
        <${Anamnese} alunaId=${perfil.id} onSalvo=${() => { ir(''); recarregarPerfil(); }}/>
        <button class="btn-texto" onClick=${() => setPulou(true)}>Preencher depois</button>
      </main></div>`;
  }
  const bloqueio = (pend.dados || []).find((p) => p.atribuicao.bloqueia_app);
  if (bloqueio && base !== 'form') {
    return html`<div class="tela"><header class="topo"><span class="marca">NEMESIS</span></header><main class="conteudo pilha">
      <div class="boas-vindas"><p class="sobre">Antes de continuar</p><h1>${bloqueio.formulario.titulo}</h1></div>
      <${ResponderFormulario} formularioId=${bloqueio.formulario.id} atribuicaoId=${bloqueio.atribuicao.id} onEnviado=${() => pend.recarregar()}/></main></div>`;
  }
  let tela;
  if (base === 'treino' && id) tela = html`<${Execucao} perfil=${perfil} treinoId=${id} ir=${ir}/>`;
  else if (base === 'form' && id) tela = html`<div class="pilha"><button class="btn-texto" onClick=${() => ir('')}>‹ Voltar</button>
    <h1 class="titulo">${((pend.dados || []).find((p) => p.formulario.id === id) || { formulario: { titulo: 'Formulário' } }).formulario.titulo}</h1>
    <${ResponderFormulario} formularioId=${id} atribuicaoId=${sub || null} onEnviado=${() => { pend.recarregar(); ir(''); }}/></div>`;
  else if (base === 'cardio') tela = html`<h1 class="titulo">Cardio</h1><${CardioAluna} aluna=${perfil} podeEditar=${false}/>`;
  else if (base === 'evolucao') tela = html`<div class="pilha"><h1 class="titulo">Evolução</h1>
    <a class="card pendencia" href="#/relatorio"><b>Relatório de evolução</b><span>Seu resumo do mês: treinos, força, recordes e frequência</span></a>
    <${Evolucao} alunaId=${perfil.id}/></div>`;
  else if (base === 'relatorio') tela = html`<div class="pilha"><button class="btn-texto" onClick=${() => ir('evolucao')}>‹ Evolução</button><h1 class="titulo">Relatório</h1><${Relatorio} aluna=${perfil}/></div>`;
  else if (base === 'checkin') tela = html`<${CheckinAluna} perfil=${perfil}/>`;
  else if (base === 'perfil') tela = html`<${PerfilAluna} perfil=${perfil} recarregarPerfil=${recarregarPerfil} onPrivacidade=${cons.recarregar}/>`;
  else tela = html`<${InicioAluna} perfil=${perfil} ir=${ir} recarregarPerfil=${recarregarPerfil} pendentes=${(pend.dados || []).filter((p) => p.formulario.tipo !== 'oraculo')}/>`;
  const aba = base === 'treino' ? '' : base === 'relatorio' ? 'evolucao' : base || '';
  return html`<div class="tela com-nav">
    <header class="topo"><span class="marca">NEMESIS</span></header>
    <main class="conteudo">${tela}</main>
    ${base !== 'treino' && html`<nav class="nav-baixo">
      ${[['', 'Treinos', 'exercicios'], ['evolucao', 'Evolução', 'relatorio'], ['checkin', 'Oráculo', 'oraculo'], ['perfil', 'Perfil', 'alunas']].map(([k, r, i]) => html`<a href=${'#/' + k} class=${aba === k ? 'on' : ''}><${Icone} nome=${i} tam=${21}/>${r}</a>`)}
    </nav>`}
  </div>`;
}

const primeiroNome = (n) => (n || '').split(' ')[0] || '';

// ---------- início: próximo treino, semana, cardio, metas, água e lista de treinos ----------
function InicioAluna({ perfil, ir, pendentes = [], recarregarPerfil }) {
  const e = useCarregar(async () => {
    const [treinos, sessoes, checkins, cardio, cardioFeito] = await Promise.all([
      api.q('treinos', { eq: { aluna_id: perfil.id, ativo: true }, order: 'ordem' }),
      api.q('sessoes', { eq: { aluna_id: perfil.id }, order: 'data' }),
      api.q('checkins', { eq: { aluna_id: perfil.id, semana: segundaDe() } }),
      api.q('cardio_prescricoes', { eq: { aluna_id: perfil.id, ativo: true } }).catch(() => []),
      api.q('cardio_registros', { eq: { aluna_id: perfil.id }, gte: { data: segundaDe() } }).catch(() => []),
    ]);
    const itens = await api.q('treino_itens', { eq: { aluna_id: perfil.id } });
    return { treinos, sessoes, itens, checkinFeito: checkins.length > 0, cardio, cardioFeito };
  }, [perfil.id]);
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return html`<div class="pilha">
    <div class="ola"><p class="sobre">${saud},</p><h1>${primeiroNome(perfil.nome)}</h1><div class="grega" aria-hidden="true"></div></div>
    ${pendentes.map((p) => html`<a class="card aviso" href=${`#/form/${p.formulario.id}/${p.atribuicao.id}`}><b>${p.formulario.titulo}</b><span>${p.atribuicao.prazo ? (p.atribuicao.prazo < hoje() ? `Prazo era ${dataBR(p.atribuicao.prazo)}. ` : `Responda até ${dataBR(p.atribuicao.prazo)}. `) : ''}${p.formulario.descricao || 'Toque para responder.'}</span></a>`)}
    <${Estado} e=${e}>${({ treinos, sessoes, itens, checkinFeito, cardio, cardioFeito }) => {
      if (!treinos.length) return html`<${Vazio} titulo="Sua ficha está sendo montada" texto="Assim que o treinador publicar os seus treinos, eles aparecem aqui."/>
        <${CardioInicio} cardio=${cardio} feitos=${cardioFeito}/>
        <${Agua} perfil=${perfil} recarregarPerfil=${recarregarPerfil}/>`;
      const semana = sessoes.filter((s) => s.data >= segundaDe());
      const obrig = treinos.filter((t) => !t.opcional);
      const ultima = sessoes[sessoes.length - 1];
      let proximo = obrig[0] || treinos[0];
      if (ultima) { const i = obrig.findIndex((t) => t.id === ultima.treino_id); if (i >= 0) proximo = obrig[(i + 1) % obrig.length]; }
      const emAndamento = sessoes.find((s) => s.data === hoje() && !s.concluida_em && treinos.some((t) => t.id === s.treino_id));
      const alvo = emAndamento ? treinos.find((t) => t.id === emAndamento.treino_id) : proximo;
      const itensAlvo = itens.filter((i) => i.treino_id === alvo.id);
      return html`
        <section class="card proximo-treino">
          <span class="emblema"><${Icone} nome="elmo" tam=${30}/></span>
          <small>${emAndamento ? 'Treino em andamento' : 'Próximo treino'}</small>
          <h2>${alvo.nome}</h2>
          <p class="suave">${itensAlvo.length} exercício(s)${itensAlvo.length ? ` · cerca de ${fmtTempo(tempoTreino(itensAlvo))}` : ''}</p>
          <button class="btn primario grande" onClick=${() => ir('treino/' + alvo.id)}>${emAndamento ? 'Continuar o treino' : 'Ir para o treino'}</button>
        </section>
        <div class="semana card">
          <div class="card-topo"><h3 class="titulo-ico"><${Icone} nome="coluna"/>Esta semana</h3><span class="valor">${semana.length}/${obrig.length}</span></div>
          <div class="progresso"><div style=${`width:${Math.min(100, (semana.length / Math.max(1, obrig.length)) * 100)}%`}></div></div>
          <p class="suave">${semana.length >= obrig.length ? 'Semana completa. Isso é constância.' : `Faltam ${obrig.length - semana.length} treino(s) para fechar a semana.`}</p>
        </div>
        ${!checkinFeito && [5, 6, 0].includes(new Date().getDay()) ? html`<a class="card aviso" href="#/checkin"><b>O Oráculo da semana está aberto</b><span>Leva 2 minutos. É com ele que eu ajusto o seu treino.</span></a>` : null}
        <${CardioInicio} cardio=${cardio} feitos=${cardioFeito}/>
        <${MetasDaSemana} perfil=${perfil}/>
        <${Agua} perfil=${perfil} recarregarPerfil=${recarregarPerfil}/>
        <h2 class="secao">Seus treinos</h2>
        ${treinos.map((t) => {
          const ult = [...sessoes].reverse().find((s) => s.treino_id === t.id);
          const n = itens.filter((i) => i.treino_id === t.id).length;
          return html`<button class=${'card treino' + (t.id === proximo.id ? ' proximo' : '')} onClick=${() => ir('treino/' + t.id)}>
            <div><h3>${t.nome}</h3><small>${n} exercício(s) · ${ult ? 'feito ' + relativo(ult.data) : 'ainda não feito'}</small></div>
            <div class="treino-tags">${t.id === proximo.id ? html`<span class="tag roxo">próximo</span>` : null}${t.opcional ? html`<span class="tag">opcional</span>` : null}<span class="seta">›</span></div>
          </button>`;
        })}`;
    }}<//>
  </div>`;
}

// ---------- cardio: sempre na home (com ou sem cardio prescrito) ----------
function CardioInicio({ cardio = [], feitos = [] }) {
  const alvo = cardio.reduce((t, c) => t + (c.vezes_semana || 0), 0);
  const minutos = feitos.reduce((t, r) => t + (Number(r.duracao_min) || 0), 0);
  return html`<a class="card cardio-card" href="#/cardio">
    <div class="card-topo"><h3 class="titulo-ico"><${Icone} nome="tocha"/>Cardio</h3>
      ${alvo ? html`<span class=${'tag' + (feitos.length >= alvo ? ' roxo' : '')}>${feitos.length}/${alvo} na semana</span>` : html`<span class="seta">›</span>`}</div>
    ${cardio.length ? html`<small>${cardio.map((c) => `${c.duracao_min} min de ${NOME_MODALIDADE[c.modalidade] || c.modalidade}, ${c.vezes_semana}x por semana`).join(' · ')}</small>`
      : html`<small>Fez caminhada, bike ou corrida? Registre aqui e entra na sua evolução.</small>`}
    ${minutos > 0 && html`<small class="suave">${num(minutos, 0)} min de cardio nesta semana</small>`}
  </a>`;
}

// ---------- metas que a aluna escreveu no último Oráculo ----------
function MetasDaSemana({ perfil }) {
  const e = useCarregar(() => metasAtuais(perfil.id), [perfil.id]);
  if (!e.dados) return null;
  return html`<a class="card metas-card" href="#/checkin"><div class="card-topo"><h3 class="titulo-ico"><${Icone} nome="louros"/>Suas metas da semana</h3><span class="seta">›</span></div>
    <p>${e.dados.semana}</p><small class="suave">Você definiu no Oráculo de ${dataBR(iso(new Date(e.dados.em)))}. No próximo, conta como foi.</small></a>`;
}

// ---------- água do dia: uma ânfora que enche ----------
// A meta é combinada com o treinador ou a nutricionista e fica no perfil; o app não calcula meta sozinho.
// Tocar na ânfora = um copo (250 ml). Os copos embaixo mostram quantos faltam para a meta.
const COPO = 250;
const CORPO_ANFORA = 'M38 8 H62 V14 H58 V30 C80 36 90 52 88 72 C86 96 70 116 60 124 V128 H66 V134 H34 V128 H40 V124 C30 116 14 96 12 72 C10 52 20 36 42 30 V14 H38 Z';
const ALCAS_ANFORA = 'M42 34 C26 28 18 44 28 54 M58 34 C74 28 82 44 72 54';
const MEANDRO_ANFORA = [20, 28, 36, 44, 52, 60, 68, 76].map((x) => `M${x} 67 V59 H${x + 6} V64 H${x + 3} V62`).join(' ') + ' M14 56 H86 M14 69.5 H86';
function Anfora({ pct, cheia, onToque }) {
  const nivel = pct <= 0 ? 140 : 134 - Math.min(1, pct) * 122;
  return html`<button class=${'anfora' + (cheia ? ' cheia' : '')} onClick=${onToque} aria-label="Bebi um copo de água (mais 250 ml)">
    <svg viewBox="0 0 100 140" width="104" height="146" aria-hidden="true">
      <defs>
        <clipPath id="anfora-corpo"><path d=${CORPO_ANFORA}/></clipPath>
        <linearGradient id="anfora-agua" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--roxo-claro)"/><stop offset="1" style="stop-color:var(--roxo)"/></linearGradient>
      </defs>
      <path d=${CORPO_ANFORA} class="anfora-fundo"/>
      <g clip-path="url(#anfora-corpo)">
        <g class="anfora-nivel" style=${`transform:translateY(${nivel}px)`}><path class="anfora-onda" d="M-100 0 Q-87.5 -5 -75 0 T-50 0 T-25 0 T0 0 T25 0 T50 0 T75 0 T100 0 V150 H-100 Z" fill="url(#anfora-agua)"/></g>
        <path d=${MEANDRO_ANFORA} class="anfora-grega"/>
      </g>
      <path d=${CORPO_ANFORA} class="anfora-contorno"/>
      <path d=${ALCAS_ANFORA} class="anfora-contorno"/>
    </svg>
  </button>`;
}
function Agua({ perfil, recarregarPerfil }) {
  const [meta, setMeta] = useState(perfil.agua_meta_ml || null);
  const [ml, setMl] = useState(null);       // null = carregando; false = sem a atualização 14 no banco
  const [editar, setEditar] = useState(false);
  const historico = useRef([]);             // para "Desfazer"
  const espera = useRef(null);
  useEffect(() => {
    api.q('agua_registros', { eq: { aluna_id: perfil.id, dia: hoje() } }).then((l) => setMl(l[0] ? l[0].ml : 0)).catch(() => setMl(false));
  }, [perfil.id]);
  if (ml === false || ml === null) return null;
  const gravar = (v, desfazendo) => {
    v = Math.max(0, Math.min(10000, Math.round(v / 50) * 50));
    if (!desfazendo) historico.current = [...historico.current.slice(-9), ml];
    setMl(v);
    if (meta && ml < meta && v >= meta) { toast('Meta de água batida hoje. Ânfora cheia!', 'ok'); try { navigator.vibrate && navigator.vibrate(60); } catch (err) { /* */ } }
    clearTimeout(espera.current);
    espera.current = setTimeout(() => api.ups('agua_registros', { aluna_id: perfil.id, dia: hoje(), ml: v, updated_at: new Date().toISOString() }, 'aluna_id,dia')
      .catch((err) => toast(err.message, 'erro')), 500);
  };
  const desfazer = () => { const v = historico.current.pop(); if (v != null) gravar(v, true); };
  const salvarMeta = async (litros) => {
    const v = Math.round((lerNum(litros) || 0) * 1000);
    if (v < 500 || v > 8000) { toast('Coloque a meta em litros, entre 0,5 e 8.', 'erro'); return; }
    try { await api.upd('profiles', perfil.id, { agua_meta_ml: v }); setMeta(v); setEditar(false); recarregarPerfil && recarregarPerfil(); } catch (err) { toast(err.message, 'erro'); }
  };
  const base = meta || 2000;
  const copos = Math.min(12, Math.ceil(base / COPO));
  const cheios = Math.floor(ml / COPO);
  const cheia = !!meta && ml >= meta;
  return html`<section class=${'card agua' + (cheia ? ' cheia' : '')}>
    <div class="card-topo"><h3 class="titulo-ico"><${Icone} nome="anfora"/>Água</h3>
      <button class="btn mini" onClick=${() => setEditar(true)}>${meta ? `Meta ${num(meta / 1000, 1)} L` : 'Definir meta'}</button></div>
    <div class="agua-corpo">
      <${Anfora} pct=${ml / base} cheia=${cheia} onToque=${() => gravar(ml + COPO)}/>
      <div class="agua-lado">
        <div class="agua-numero"><b>${num(ml / 1000, 2)} L</b><small>${cheia ? 'meta batida hoje' : meta ? `faltam ${num((meta - ml) / 1000, 2)} L` : 'bebidos hoje'}</small></div>
        <div class="copos" role="group" aria-label=${`${cheios} de ${copos} copos de 250 ml`}>
          ${Array.from({ length: copos }, (_, i) => html`<button class=${'copo' + (i < cheios ? ' on' : '')} aria-label=${`${i + 1} copo(s)`}
            onClick=${() => gravar(i + 1 === cheios ? i * COPO : (i + 1) * COPO)}><${Icone} nome="copo" tam=${18}/></button>`)}
        </div>
        <small class="suave">Toque na ânfora a cada copo (250 ml).</small>
        <div class="acoes"><button class="btn mini" onClick=${() => gravar(ml + 500)}>+ garrafinha 500 ml</button>
          ${historico.current.length > 0 && html`<button class="btn-texto" onClick=${desfazer}>Desfazer</button>`}</div>
      </div>
    </div>
    ${editar && html`<${Modal} titulo="Meta de água" onFechar=${() => setEditar(false)}><form class="pilha" onSubmit=${(ev) => { ev.preventDefault(); salvarMeta(ev.target.litros.value); }}>
      <p class="suave">Quantos litros por dia? Use a meta que você combinou com o seu treinador ou a sua nutricionista.</p>
      <${Campo} rotulo="Litros por dia"><input class="input" name="litros" inputmode="decimal" placeholder="Ex.: 2,5" value=${meta ? String(meta / 1000).replace('.', ',') : ''}/><//>
      <button class="btn primario grande">Salvar meta</button></form><//>`}
  </section>`;
}

// ---------- check-in semanal ----------
const ITENS_CHECKIN = [
  ['sono', 'Sono', ['péssimo', 'ótimo']], ['energia', 'Energia', ['sem energia', 'muita energia']],
  ['estresse', 'Estresse', ['tranquila', 'muito estressada']], ['fome', 'Fome', ['pouca', 'muita']],
  ['dor', 'Dor muscular ou articular', ['nenhuma', 'muita']], ['dieta', 'Alimentação da semana', ['saiu do plano', 'no plano']],
];
function CheckinAluna({ perfil }) {
  const semana = segundaDe();
  const e = useCarregar(async () => {
    const [lista, sessoes, oraculo, atribs] = await Promise.all([
      api.q('checkins', { eq: { aluna_id: perfil.id }, order: 'semana', asc: false }),
      api.q('sessoes', { eq: { aluna_id: perfil.id }, gte: { data: semana } }),
      DEMO ? Promise.resolve([]) : api.q('formularios', { eq: { tipo: 'oraculo', ativo: true }, order: 'created_at' }).catch(() => []),
      DEMO ? Promise.resolve([]) : api.q('atribuicoes', { eq: { ativa: true } }).catch(() => []),
    ]);
    const form = oraculo[0] || null;
    const atrib = form ? atribs.find((a) => a.formulario_id === form.id && (!a.aluna_id || a.aluna_id === perfil.id)) : null;
    return { lista, treinosSemana: sessoes.length, form, atrib };
  }, [perfil.id]);
  return html`<div class="pilha"><h1 class="titulo">Oráculo da semana</h1>
    <${Estado} e=${e}>${({ lista, treinosSemana, form, atrib }) => {
      const atual = lista.find((c) => c.semana === semana);
      return html`${atual ? html`<section class="card"><div class="card-topo"><h3>Esta semana</h3><span class="tag roxo">enviado</span></div>
          <${ResumoCheckin} c=${atual}/>${atual.resposta ? html`<div class="resposta"><b>Resposta do treinador</b><p>${atual.resposta}</p></div>` : html`<p class="suave">Recebido. A resposta chega até o dia seguinte.</p>`}</section>`
        : form ? html`<div class="card"><${ResponderFormulario} formularioId=${form.id} atribuicaoId=${atrib ? atrib.id : null} onEnviado=${e.recarregar}/></div>`
        : html`<${FormCheckin} perfil=${perfil} semana=${semana} treinos=${treinosSemana} onSalvo=${e.recarregar}/>`}
      ${lista.filter((c) => c.semana !== semana).length > 0 && html`<h2 class="secao">Semanas anteriores</h2>
        ${lista.filter((c) => c.semana !== semana).map((c) => html`<details class="card"><summary><b>Semana de ${dataBR(c.semana)}</b>${c.resposta ? html`<span class="tag">respondido</span>` : null}</summary>
          <${ResumoCheckin} c=${c}/>${c.resposta && html`<div class="resposta"><b>Resposta</b><p>${c.resposta}</p></div>`}</details>`)}`}`;
    }}<//></div>`;
}
export function ResumoCheckin({ c, sinal }) {
  const sem = sinal ? semaforo(c) : null;
  return html`${sem && html`<div class=${'semaforo ' + sem.cor} title="(6 − sono) + (6 − energia) + estresse + dor · 4–9 verde, 10–14 amarelo, 15–20 vermelho"><i></i><b>${sem.rotulo}</b><span>${sem.soma}/20</span></div>`}<div class="resumo-checkin">
    ${c.peso != null && html`<span>Peso <b>${num(c.peso, 1)} kg</b></span>`}
    ${c.treinos_feitos != null && html`<span>Treinos <b>${c.treinos_feitos}</b></span>`}
    ${ITENS_CHECKIN.map(([k, r]) => (c[k] != null && !(k === 'estresse' && c.estresse10 != null) ? html`<span class=${alerta(k, c[k]) ? 'ruim' : ''}>${r.split(' ')[0]} <b>${c[k]}/5</b></span>` : null))}
    ${c.estresse10 != null && html`<span class=${c.estresse10 >= 7 ? 'ruim' : ''}>Estresse <b>${c.estresse10}/10</b></span>`}
    ${c.dor_muscular != null && html`<span class=${c.dor_muscular >= 4 ? 'ruim' : ''}>Dor muscular <b>${c.dor_muscular}/5</b></span>`}
    ${c.dor_articular != null && html`<span class=${c.dor_articular >= 3 ? 'ruim' : ''}>Dor articular <b>${c.dor_articular}/5</b>${c.dor_local ? ' · ' + c.dor_local : ''}</span>`}
    ${c.insonia && html`<span class="ruim">Menos de 5 h de sono</span>`}
  </div>${c.comentario && html`<p class="nota">"${c.comentario}"</p>`}`;
}
export const alerta = (k, v) => (['estresse', 'fome', 'dor'].includes(k) ? v >= 4 : v <= 2);

function FormCheckin({ perfil, semana, treinos, onSalvo }) {
  const [f, setF] = useState({ peso: '', treinos_feitos: treinos, comentario: '' });
  const salvar = async (ev) => {
    ev.preventDefault();
    if (ITENS_CHECKIN.some(([k]) => f[k] == null)) { toast('Responda todas as escalas de 1 a 5.', 'erro'); return; }
    try {
      await api.ins('checkins', { aluna_id: perfil.id, semana, peso: lerNum(f.peso), treinos_feitos: lerNum(f.treinos_feitos), comentario: f.comentario || null, ...Object.fromEntries(ITENS_CHECKIN.map(([k]) => [k, f[k]])) });
      toast('Check-in enviado', 'ok'); onSalvo();
    } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<form class="card pilha" onSubmit=${salvar}>
    <p class="suave">Semana de ${dataBR(semana)}. Responda pensando nos últimos 7 dias.</p>
    <div class="grade2">
      <${Campo} rotulo="Peso em jejum (kg)"><input class="input" inputmode="decimal" value=${f.peso} onInput=${(ev) => setF({ ...f, peso: ev.target.value })}/><//>
      <${Campo} rotulo="Treinos feitos na semana"><input class="input" inputmode="numeric" value=${f.treinos_feitos} onInput=${(ev) => setF({ ...f, treinos_feitos: ev.target.value })}/><//>
    </div>
    ${ITENS_CHECKIN.map(([k, r, rot]) => html`<${Campo} rotulo=${r}><${Escala} valor=${f[k]} onMuda=${(v) => setF({ ...f, [k]: v })} rotulos=${rot}/><//>`)}
    <${Campo} rotulo="Como foi a semana? Alguma dificuldade?"><textarea class="input" rows="3" value=${f.comentario} onInput=${(ev) => setF({ ...f, comentario: ev.target.value })}></textarea><//>
    <button class="btn primario grande">Enviar check-in</button>
  </form>`;
}

// ---------- perfil ----------
function PerfilAluna({ perfil, recarregarPerfil, onPrivacidade }) {
  const [aba, setAba] = useState('dados');
  const [f, setF] = useState({ nome: perfil.nome || '', telefone: perfil.telefone || '', nascimento: perfil.nascimento || '' });
  const ass = useCarregar(() => api.q('assinaturas', { eq: { aluna_id: perfil.id }, order: 'fim', asc: false, limit: 1 }), [perfil.id]);
  const salvar = async (ev) => {
    ev.preventDefault();
    try { await api.upd('profiles', perfil.id, { nome: f.nome, telefone: f.telefone || null, nascimento: f.nascimento || null }); toast('Dados salvos', 'ok'); recarregarPerfil(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<div class="pilha"><h1 class="titulo">Perfil</h1>
    <div class="abas">${[['dados', 'Dados'], ['metas', 'Metas'], ['avaliacoes', 'Avaliações'], ['arquivos', 'Fotos e arquivos'], ['testes', 'Testes'], ['anamnese', 'Alistamento'], ['privacidade', 'Privacidade']].map(([k, r]) => html`<button class=${aba === k ? 'on' : ''} onClick=${() => setAba(k)}>${r}</button>`)}</div>
    ${aba === 'dados' && html`
      <${Estado} e=${ass}>${(l) => { const a = l[0]; if (!a) return null; const resta = diasEntre(hoje(), a.fim);
        return html`<section class="card"><div class="card-topo"><h3>Plano ${a.plano_nome}</h3><span class=${'tag' + (resta < 0 ? ' perigo' : resta <= 10 ? ' atencao' : ' roxo')}>${resta < 0 ? 'vencido' : `${resta} dias`}</span></div>
          <p class="suave">De ${dataBR(a.inicio)} até ${dataBR(a.fim)}</p></section>`; }}<//>
      <form class="card pilha" onSubmit=${salvar}>
        <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
        <${Campo} rotulo="WhatsApp"><input class="input" inputmode="tel" value=${f.telefone} onInput=${(ev) => setF({ ...f, telefone: ev.target.value })}/><//>
        <${Campo} rotulo="Data de nascimento"><input class="input" type="date" value=${f.nascimento} onInput=${(ev) => setF({ ...f, nascimento: ev.target.value })}/><//>
        <p class="suave">E-mail: ${perfil.email}</p>
        <button class="btn primario">Salvar</button>
      </form>
      <button class="btn" onClick=${() => api.sair()}>Sair da conta</button>`}
    ${aba === 'avaliacoes' && html`<${Avaliacoes} aluna=${perfil} podeEditar=${false}/>`}
    ${aba === 'arquivos' && html`<${ArquivosAluna} aluna=${perfil} daAluna=${true}/>`}
    ${aba === 'privacidade' && html`<${PrivacidadeAluna} perfil=${perfil} onMudou=${onPrivacidade}/>`}
    ${aba === 'metas' && html`<${MetasAluna} aluna=${perfil} podeEditar=${false}/>`}
    ${aba === 'testes' && html`<${TestesAluna} aluna=${perfil} podeEditar=${false}/>`}
    ${aba === 'anamnese' && html`<${Anamnese} alunaId=${perfil.id} onSalvo=${recarregarPerfil}/>`}
  </div>`;
}
