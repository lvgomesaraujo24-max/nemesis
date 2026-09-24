// Lado da ALUNA
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Evolucao, Anamnese, Avaliacoes } from './comum.js';
import { ResponderFormulario, pendenciasDaAluna } from './vivo.js';
import { CardioAluna, TestesAluna, MetasAluna } from './extras.js';
import { DEMO } from './api.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Escala, toast, num, dataBR, hoje, segundaDe, lerNum, relativo, diasEntre } from './util.js';

export function AppAluna({ perfil, rota, ir, recarregarPerfil }) {
  const [pulouAnamnese, setPulou] = useState(false);
  const [base, id, sub] = rota;
  const pend = useCarregar(() => (DEMO ? Promise.resolve([]) : pendenciasDaAluna(perfil.id).catch(() => [])), [perfil.id, base]);
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
  else if (base === 'evolucao') tela = html`<h1 class="titulo">Evolução</h1><${Evolucao} alunaId=${perfil.id}/>`;
  else if (base === 'checkin') tela = html`<${CheckinAluna} perfil=${perfil}/>`;
  else if (base === 'perfil') tela = html`<${PerfilAluna} perfil=${perfil} recarregarPerfil=${recarregarPerfil}/>`;
  else tela = html`<${InicioAluna} perfil=${perfil} ir=${ir} pendentes=${(pend.dados || []).filter((p) => p.formulario.tipo !== 'oraculo')}/>`;
  const aba = base === 'treino' ? '' : base || '';
  return html`<div class="tela com-nav">
    <header class="topo"><span class="marca">NEMESIS</span></header>
    <main class="conteudo">${tela}</main>
    ${base !== 'treino' && html`<nav class="nav-baixo">
      ${[['', 'Treinos', '◆'], ['evolucao', 'Evolução', '↗'], ['checkin', 'Oráculo', '✓'], ['perfil', 'Perfil', '●']].map(([k, r, i]) => html`<a href=${'#/' + k} class=${aba === k ? 'on' : ''}><span class="nav-i">${i}</span>${r}</a>`)}
    </nav>`}
  </div>`;
}

const primeiroNome = (n) => (n || '').split(' ')[0] || '';

// ---------- início: lista de treinos ----------
function InicioAluna({ perfil, ir, pendentes = [] }) {
  const e = useCarregar(async () => {
    const [treinos, sessoes, checkins, cardio] = await Promise.all([
      api.q('treinos', { eq: { aluna_id: perfil.id, ativo: true }, order: 'ordem' }),
      api.q('sessoes', { eq: { aluna_id: perfil.id }, order: 'data' }),
      api.q('checkins', { eq: { aluna_id: perfil.id, semana: segundaDe() } }),
      api.q('cardio_prescricoes', { eq: { aluna_id: perfil.id, ativo: true } }).catch(() => []),
    ]);
    const itens = await api.q('treino_itens', { eq: { aluna_id: perfil.id } });
    return { treinos, sessoes, itens, checkinFeito: checkins.length > 0, cardio };
  }, [perfil.id]);
  const hora = new Date().getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return html`<div class="pilha">
    <div class="ola"><p class="sobre">${saud},</p><h1>${primeiroNome(perfil.nome)}</h1></div>
    ${pendentes.map((p) => html`<a class="card aviso" href=${`#/form/${p.formulario.id}/${p.atribuicao.id}`}><b>${p.formulario.titulo}</b><span>${p.formulario.descricao || 'Toque para responder.'}</span></a>`)}
    <${Estado} e=${e}>${({ treinos, sessoes, itens, checkinFeito, cardio }) => {
      if (!treinos.length) return html`<${Vazio} titulo="Sua ficha está sendo montada" texto="Assim que o treinador publicar os seus treinos, eles aparecem aqui."/>`;
      const semana = sessoes.filter((s) => s.data >= segundaDe());
      const obrig = treinos.filter((t) => !t.opcional);
      const ultima = sessoes[sessoes.length - 1];
      let proximo = obrig[0];
      if (ultima) { const i = obrig.findIndex((t) => t.id === ultima.treino_id); if (i >= 0) proximo = obrig[(i + 1) % obrig.length]; }
      const emAndamento = sessoes.find((s) => s.data === hoje() && !s.concluida_em);
      return html`
        <div class="semana card">
          <div class="card-topo"><h3>Esta semana</h3><span class="valor">${semana.length}/${obrig.length}</span></div>
          <div class="progresso"><div style=${`width:${Math.min(100, (semana.length / Math.max(1, obrig.length)) * 100)}%`}></div></div>
          <p class="suave">${semana.length >= obrig.length ? 'Semana completa. Isso é constância.' : `Faltam ${obrig.length - semana.length} treino(s) para fechar a semana.`}</p>
        </div>
        ${!checkinFeito && [5, 6, 0].includes(new Date().getDay()) ? html`<a class="card aviso" href="#/checkin"><b>O Oráculo da semana está aberto</b><span>Leva 2 minutos. É com ele que eu ajusto o seu treino.</span></a>` : null}
        ${cardio && cardio.length > 0 && html`<a class="card" href="#/cardio"><div class="card-topo"><h3>Cardio da semana</h3><span class="seta">›</span></div><small>${cardio.map((c) => `${c.duracao_min} min ${c.modalidade} · ${c.vezes_semana}x`).join(' · ')}</small></a>`}
        ${emAndamento && html`<button class="card aviso" onClick=${() => ir('treino/' + emAndamento.treino_id)}><b>Treino em andamento</b><span>Continuar ${emAndamento.treino_nome}</span></button>`}
        <h2 class="secao">Seus treinos</h2>
        ${treinos.map((t) => {
          const ult = [...sessoes].reverse().find((s) => s.treino_id === t.id);
          const n = itens.filter((i) => i.treino_id === t.id).length;
          return html`<button class=${'card treino' + (proximo && t.id === proximo.id ? ' proximo' : '')} onClick=${() => ir('treino/' + t.id)}>
            <div><h3>${t.nome}</h3><small>${n} exercício(s) · ${ult ? 'feito ' + relativo(ult.data) : 'ainda não feito'}</small></div>
            <div class="treino-tags">${proximo && t.id === proximo.id ? html`<span class="tag roxo">próximo</span>` : null}${t.opcional ? html`<span class="tag">opcional</span>` : null}<span class="seta">›</span></div>
          </button>`;
        })}`;
    }}<//>
  </div>`;
}

// ---------- execução do treino ----------
function Execucao({ perfil, treinoId, ir }) {
  const e = useCarregar(async () => {
    const [treino, itens, exercicios, sessoes, historico] = await Promise.all([
      api.um('treinos', { id: treinoId }),
      api.q('treino_itens', { eq: { treino_id: treinoId }, order: 'ordem' }),
      api.q('exercicios', {}),
      api.q('sessoes', { eq: { aluna_id: perfil.id, treino_id: treinoId }, order: 'iniciada_em' }),
      api.q('series', { eq: { aluna_id: perfil.id }, order: 'created_at' }),
    ]);
    const aberta = sessoes.find((s) => s.data === hoje() && !s.concluida_em) || null;
    return { treino, itens, exercicios, aberta, historico };
  }, [treinoId]);
  return html`<${Estado} e=${e}>${(d) => (d.treino ? html`<${ExecucaoCorpo} d=${d} perfil=${perfil} ir=${ir}/>` : html`<${Vazio} titulo="Treino não encontrado"/>`)}<//>`;
}

function ExecucaoCorpo({ d, perfil, ir }) {
  const { treino, itens, exercicios } = d;
  const [sessao, setSessao] = useState(d.aberta);
  const [historico, setHistorico] = useState(d.historico);
  const [linhas, setLinhas] = useState(() => montarLinhas(itens, d.historico, d.aberta));
  const [descanso, setDescanso] = useState(null); // {fim, total}
  const [finalizar, setFinalizar] = useState(false);
  const exNome = (id) => (exercicios.find((x) => x.id === id) || {}).nome || 'Exercício';
  const exVideo = (id) => (exercicios.find((x) => x.id === id) || {}).video_url;
  const exInstr = (id) => (exercicios.find((x) => x.id === id) || {}).instrucoes;

  const feitas = Object.values(linhas).flat().filter((l) => l.id && !l.aquecimento).length;
  const total = itens.reduce((t, i) => t + i.series, 0);

  const sessaoRef = useRef(d.aberta);
  const criando = useRef(null);
  const garantirSessao = async () => {
    // evita criar duas sessões se a aluna tocar em duas séries muito rápido
    if (sessaoRef.current) return sessaoRef.current;
    if (!criando.current) {
      criando.current = api.ins('sessoes', { aluna_id: perfil.id, treino_id: treino.id, treino_nome: treino.nome, data: hoje(), iniciada_em: new Date().toISOString() })
        .then(([s]) => { sessaoRef.current = s; setSessao(s); return s; })
        .catch((err) => { criando.current = null; throw err; });
    }
    return criando.current;
  };

  const concluir = async (item, idx) => {
    const l = linhas[item.id][idx];
    const carga = lerNum(l.carga); const reps = lerNum(l.reps);
    try {
      const s = await garantirSessao();
      const [salva] = await api.ins('series', { sessao_id: s.id, aluna_id: perfil.id, treino_item_id: item.id, exercicio_id: item.exercicio_id, numero: l.numero, carga, reps: reps == null ? null : Math.round(reps), aquecimento: l.aquecimento });
      const antes = historico.filter((h) => h.exercicio_id === item.exercicio_id && !h.aquecimento && h.carga != null);
      const maxAntes = antes.length ? Math.max(...antes.map((h) => h.carga)) : null;
      setHistorico([...historico, salva]);
      setLinhas((ls) => ({ ...ls, [item.id]: ls[item.id].map((x, i) => (i === idx ? { ...x, id: salva.id } : x)) }));
      if (!l.aquecimento && carga != null && maxAntes != null && carga > maxAntes) toast(`Novo recorde em ${exNome(item.exercicio_id)}: ${num(carga, 1)} kg`, 'recorde');
      const seg = l.aquecimento ? Math.min(60, item.descanso) : item.descanso;
      if (seg > 0) setDescanso({ fim: Date.now() + seg * 1000, total: seg });
    } catch (err) { toast(err.message, 'erro'); }
  };
  const desfazer = async (item, idx) => {
    const l = linhas[item.id][idx];
    try {
      await api.del('series', l.id);
      setHistorico(historico.filter((h) => h.id !== l.id));
      setLinhas((ls) => ({ ...ls, [item.id]: ls[item.id].map((x, i) => (i === idx ? { ...x, id: null } : x)) }));
    } catch (err) { toast(err.message, 'erro'); }
  };
  const muda = (item, idx, campo, v) => setLinhas((ls) => ({ ...ls, [item.id]: ls[item.id].map((x, i) => (i === idx ? { ...x, [campo]: v } : x)) }));

  return html`<div class="pilha execucao">
    <div class="exec-topo">
      <button class="btn-texto" onClick=${() => ir('')}>‹ Voltar</button>
      <h1>${treino.nome}</h1>
      <div class="progresso"><div style=${`width:${(feitas / Math.max(1, total)) * 100}%`}></div></div>
      <p class="suave">${feitas} de ${total} séries${treino.observacoes ? ' · ' + treino.observacoes : ''}</p>
    </div>
    ${itens.map((item, n) => {
      const ult = ultimaVez(historico, item.exercicio_id, sessao);
      return html`<section class="card exercicio">
        <div class="ex-cab"><span class="ex-n">${n + 1}</span><div><h3>${exNome(item.exercicio_id)}</h3>
          <small>${item.series} × ${item.reps} · descanso ${fmtSeg(item.descanso)}${item.tecnica ? ' · ' + item.tecnica : ''}</small></div></div>
        ${item.obs && html`<p class="nota">${item.obs}</p>`}
        ${exInstr(item.exercicio_id) && html`<details class="instr"><summary>Como executar</summary><p>${exInstr(item.exercicio_id)}</p></details>`}
        ${exVideo(item.exercicio_id) && html`<a class="btn-texto" href=${exVideo(item.exercicio_id)} target="_blank" rel="noopener">▶ Ver vídeo</a>`}
        ${ult && html`<p class="ultima">Última vez: ${ult}</p>`}
        <div class="series">
          <div class="serie cab"><span>Série</span><span>kg</span><span>reps</span><span></span></div>
          ${linhas[item.id].map((l, idx) => html`<div class=${'serie' + (l.id ? ' feita' : '') + (l.aquecimento ? ' aquec' : '')}>
            <span class="s-n">${l.aquecimento ? 'Aquec.' : l.numero}</span>
            <input class="input" inputmode="decimal" placeholder="sem peso" value=${l.carga} disabled=${!!l.id} onInput=${(ev) => muda(item, idx, 'carga', ev.target.value)} aria-label="Carga em kg"/>
            <input class="input" inputmode="numeric" placeholder=${item.reps} value=${l.reps} disabled=${!!l.id} onInput=${(ev) => muda(item, idx, 'reps', ev.target.value)} aria-label="Repetições"/>
            ${l.id ? html`<button class="check on" aria-label="Desfazer série" onClick=${() => desfazer(item, idx)}>✓</button>`
              : html`<button class="check" aria-label="Concluir série" onClick=${() => concluir(item, idx)}>✓</button>`}
          </div>`)}
        </div>
        ${l0(linhas[item.id]) && html`<p class="dica">Aquecimento é aproximação: uns 50% da carga, poucas reps, longe da falha.</p>`}
      </section>`;
    })}
    <button class="btn primario grande" onClick=${() => (sessao ? setFinalizar(true) : toast('Conclua pelo menos uma série antes de finalizar.', 'erro'))}>Finalizar treino</button>
    ${descanso && html`<${Descanso} d=${descanso} onFim=${() => setDescanso(null)} onMais=${() => setDescanso({ ...descanso, fim: descanso.fim + 15000, total: descanso.total + 15 })}/>`}
    ${finalizar && html`<${Finalizar} sessao=${sessao} feitas=${feitas} total=${total} onFechar=${() => setFinalizar(false)} onFeito=${() => { toast('Treino registrado. Bom trabalho!', 'ok'); ir('evolucao'); }}/>`}
  </div>`;
}
const l0 = (ls) => ls.some((l) => l.aquecimento);
const fmtSeg = (s) => (s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ' ' + (s % 60) + 's' : ''}` : `${s}s`);

function montarLinhas(itens, historico, aberta) {
  const out = {};
  for (const it of itens) {
    const ant = historico.filter((h) => h.exercicio_id === it.exercicio_id && !h.aquecimento && (!aberta || h.sessao_id !== aberta.id));
    const ultSessao = ant.length ? ant[ant.length - 1].sessao_id : null;
    const daUlt = ant.filter((h) => h.sessao_id === ultSessao);
    const lista = [];
    for (let i = 1; i <= it.aquecimento; i++) lista.push({ numero: i, aquecimento: true, carga: '', reps: '', id: null });
    for (let i = 1; i <= it.series; i++) {
      const ref = daUlt.find((h) => h.numero === i) || daUlt[daUlt.length - 1];
      lista.push({ numero: i, aquecimento: false, carga: ref && ref.carga != null ? String(ref.carga).replace('.', ',') : '', reps: '', id: null });
    }
    if (aberta) {
      historico.filter((h) => h.sessao_id === aberta.id && h.treino_item_id === it.id).forEach((h) => {
        const l = lista.find((x) => x.numero === h.numero && x.aquecimento === h.aquecimento);
        if (l) Object.assign(l, { id: h.id, carga: h.carga == null ? '' : String(h.carga).replace('.', ','), reps: h.reps == null ? '' : String(h.reps) });
      });
    }
    out[it.id] = lista;
  }
  return out;
}
function ultimaVez(historico, exId, sessao) {
  const ant = historico.filter((h) => h.exercicio_id === exId && !h.aquecimento && (!sessao || h.sessao_id !== sessao.id));
  if (!ant.length) return null;
  const sid = ant[ant.length - 1].sessao_id;
  return ant.filter((h) => h.sessao_id === sid).map((h) => `${h.carga == null ? 'sem peso' : num(h.carga, 1) + ' kg'} × ${h.reps ?? '·'}`).join('  ·  ');
}

function Descanso({ d, onFim, onMais }) {
  const [agora, setAgora] = useState(Date.now());
  const avisou = useRef(false);
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 250); return () => clearInterval(t); }, []);
  const resta = Math.max(0, Math.ceil((d.fim - agora) / 1000));
  useEffect(() => { if (resta === 0 && !avisou.current) { avisou.current = true; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* */ } setTimeout(onFim, 1200); } }, [resta]);
  return html`<div class="descanso" role="status">
    <div class="descanso-barra" style=${`width:${(resta / d.total) * 100}%`}></div>
    <span>${resta > 0 ? `Descanso ${Math.floor(resta / 60)}:${String(resta % 60).padStart(2, '0')}` : 'Bora pra próxima!'}</span>
    <div><button class="btn-texto" onClick=${onMais}>+15s</button><button class="btn-texto" onClick=${onFim}>Pular</button></div>
  </div>`;
}

function Finalizar({ sessao, feitas, total, onFechar, onFeito }) {
  const [esforco, setEsforco] = useState(null);
  const [coment, setComent] = useState('');
  const salvar = async () => {
    try { await api.upd('sessoes', sessao.id, { concluida_em: new Date().toISOString(), esforco, comentario: coment || null }); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo="Finalizar treino" onFechar=${onFechar}>
    <div class="pilha">
      <p>${feitas} de ${total} séries concluídas.${feitas < total ? ' Tudo bem, o que ficou registrado conta.' : ''}</p>
      <${Campo} rotulo="Quão pesado foi o treino? (1 = leve, 10 = máximo)"><${Escala} valor=${esforco} onMuda=${setEsforco} min=${1} max=${10}/><//>
      <${Campo} rotulo="Algo para me contar? (dor, máquina ocupada, carga que subiu)"><textarea class="input" rows="3" value=${coment} onInput=${(ev) => setComent(ev.target.value)}></textarea><//>
      <button class="btn primario grande" onClick=${salvar}>Concluir treino</button>
    </div><//>`;
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
export function ResumoCheckin({ c }) {
  return html`<div class="resumo-checkin">
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
function PerfilAluna({ perfil, recarregarPerfil }) {
  const [aba, setAba] = useState('dados');
  const [f, setF] = useState({ nome: perfil.nome || '', telefone: perfil.telefone || '', nascimento: perfil.nascimento || '' });
  const ass = useCarregar(() => api.q('assinaturas', { eq: { aluna_id: perfil.id }, order: 'fim', asc: false, limit: 1 }), [perfil.id]);
  const salvar = async (ev) => {
    ev.preventDefault();
    try { await api.upd('profiles', perfil.id, { nome: f.nome, telefone: f.telefone || null, nascimento: f.nascimento || null }); toast('Dados salvos', 'ok'); recarregarPerfil(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<div class="pilha"><h1 class="titulo">Perfil</h1>
    <div class="abas">${[['dados', 'Dados'], ['metas', 'Metas'], ['avaliacoes', 'Avaliações'], ['testes', 'Testes'], ['anamnese', 'Alistamento']].map(([k, r]) => html`<button class=${aba === k ? 'on' : ''} onClick=${() => setAba(k)}>${r}</button>`)}</div>
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
    ${aba === 'metas' && html`<${MetasAluna} aluna=${perfil} podeEditar=${false}/>`}
    ${aba === 'testes' && html`<${TestesAluna} aluna=${perfil} podeEditar=${false}/>`}
    ${aba === 'anamnese' && html`<${Anamnese} alunaId=${perfil.id} onSalvo=${recarregarPerfil}/>`}
  </div>`;
}
