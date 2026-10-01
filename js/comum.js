// Telas usadas pelos dois lados (treinador e aluna)
import { html, useState, useMemo } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { podeImagem } from './legal.js';
import { useCarregar, Estado, Vazio, Linha, LinhasSeries, CORES_SERIE, somaDias, Modal, Campo, toast, num, dataBR, dataCurta, hoje, lerNum, tonelagem,
  recordes, sequenciaSemanas, equivalencia, DOBRAS, MEDIDAS, MEDIDAS_TODAS, DIAMETROS, PROTOCOLOS, camposProtocolo, percentualGordura, protocoloSugerido, composicao, idadeDe, idadeEm, relativo, diasEntre } from './util.js';

// ============================================================
// ESTADO VAZIO QUE ENSINA ("Como funciona" em passos)
// ============================================================
export function ComoFunciona({ titulo, texto, passos, children }) {
  return html`<section class="card como-funciona">
    <div><h3>${titulo}</h3>${texto && html`<p class="suave">${texto}</p>`}</div>
    <p class="cf-sobre">Como funciona</p>
    <ol class="cf-passos">${passos.map(([t, d], i) => html`<li><span class="cf-n">${i + 1}</span><div><b>${t}</b><small>${d}</small></div></li>`)}</ol>
    ${children && html`<div class="acoes">${children}</div>`}
  </section>`;
}

// ============================================================
// EVOLUÇÃO E RECORDES
// ============================================================
export function Evolucao({ alunaId }) {
  const e = useCarregar(async () => {
    const [sessoes, series, exercicios, checkins, avaliacoes, mesos] = await Promise.all([
      api.q('sessoes', { eq: { aluna_id: alunaId }, order: 'data' }),
      api.q('series', { eq: { aluna_id: alunaId }, order: 'created_at' }),
      api.q('exercicios', { order: 'nome' }),
      api.q('checkins', { eq: { aluna_id: alunaId }, order: 'semana' }),
      api.q('avaliacoes', { eq: { aluna_id: alunaId }, order: 'data' }),
      api.q('mesociclos', { eq: { aluna_id: alunaId }, order: 'inicio', asc: false }).catch(() => []),
    ]);
    return { sessoes, series, exercicios, checkins, avaliacoes, mesos };
  }, [alunaId]);
  return html`<${Estado} e=${e}>${(d) => html`<${EvolucaoCorpo} d=${d}/>`}<//>`;
}

function EvolucaoCorpo({ d }) {
  const { sessoes, series, exercicios, checkins, avaliacoes, mesos = [] } = d;
  // filtros da progressão de carga: ficha (período do mesociclo) e treino
  // abre na ficha ativa só se ela já tiver pelo menos 2 treinos com carga; senão mostra todo o histórico
  const [fichaSel, setFichaSel] = useState(() => {
    const a = mesos.find((m) => m.status === 'ativo'); if (!a) return '';
    const comCargaIds = new Set(series.filter((s) => s.carga != null && !s.aquecimento).map((s) => s.sessao_id));
    const datas = new Set(sessoes.filter((s) => comCargaIds.has(s.id) && s.data >= a.inicio && s.data <= a.fim).map((s) => s.data));
    return datas.size >= 2 ? a.id : '';
  });
  const [treinoSel, setTreinoSel] = useState('');
  const periodo = useMemo(() => {
    const m = mesos.find((x) => x.id === fichaSel); if (!m) return null;
    return { de: m.inicio, ate: m.fim || '9999-12-31' };   // mesmo período da ficha no Relatório
  }, [fichaSel, mesos]);
  const sessoesFiltro = useMemo(() => sessoes.filter((s) => (!periodo || (s.data >= periodo.de && s.data <= periodo.ate)) && (!treinoSel || s.treino_nome === treinoSel)), [sessoes, periodo, treinoSel]);
  const nomesTreino = [...new Set(sessoes.filter((s) => !periodo || (s.data >= periodo.de && s.data <= periodo.ate)).map((s) => s.treino_nome).filter(Boolean))].sort();
  const feitas = sessoes.filter((s) => s.concluida_em || series.some((x) => x.sessao_id === s.id));
  const mes = hoje().slice(0, 7);
  const noMes = feitas.filter((s) => s.data.slice(0, 7) === mes).length;
  const ton = tonelagem(series);
  const recs = useMemo(() => recordes(series, exercicios), [series]);
  const comCarga = useMemo(() => {
    const ids = new Set(series.filter((s) => s.carga != null && !s.aquecimento).map((s) => s.exercicio_id));
    return exercicios.filter((x) => ids.has(x.id));
  }, [series]);
  const [exSel, setExSel] = useState(() => {
    // começa pelo exercício com mais treinos registrados (a linha mais completa)
    const cont = {};
    series.filter((s) => s.carga != null && !s.aquecimento).forEach((s) => { (cont[s.exercicio_id] = cont[s.exercicio_id] || new Set()).add(s.sessao_id); });
    const top = Object.entries(cont).sort((a, b) => b[1].size - a[1].size)[0];
    return top ? top[0] : null;
  });
  const [verTodos, setVerTodos] = useState(false);
  const idsFiltro = useMemo(() => new Set(sessoesFiltro.map((s) => s.id)), [sessoesFiltro]);
  const exFiltro = useMemo(() => { const ids = new Set(series.filter((s) => idsFiltro.has(s.sessao_id) && s.carga != null && !s.aquecimento).map((s) => s.exercicio_id)); return comCarga.filter((x) => ids.has(x.id)); }, [idsFiltro, comCarga, series]);
  const exVer = exFiltro.some((x) => x.id === exSel) ? exSel : exFiltro[0] ? exFiltro[0].id : null;
  // carga de cada série válida (1ª, 2ª, 3ª...) por data de treino; até 4 linhas
  const porSerie = useMemo(() => {
    const dataDe = Object.fromEntries(sessoesFiltro.map((s) => [s.id, s.data]));
    const validas = series.filter((s) => s.exercicio_id === exVer && s.carga != null && !s.aquecimento && dataDe[s.sessao_id]);
    const datas = [...new Set(validas.map((s) => dataDe[s.sessao_id]))].sort();
    const maxN = Math.min(4, Math.max(0, ...validas.map((s) => s.numero || 1)));
    const linhas = [];
    for (let n = 1; n <= maxN; n++) linhas.push({ nome: `Série ${n}`, cor: CORES_SERIE[n - 1], valores: datas.map((dt) => { const x = validas.filter((s) => (s.numero || 1) === n && dataDe[s.sessao_id] === dt); return x.length ? Math.max(...x.map((s) => s.carga)) : null; }) });
    return { datas, linhas };
  }, [exVer, series, sessoesFiltro]);


  const pontosPeso = useMemo(() => {
    const m = {};
    checkins.forEach((c) => { if (c.peso != null) m[c.semana] = c.peso; });
    avaliacoes.forEach((a) => { if (a.peso != null) m[a.data] = a.peso; });
    return Object.keys(m).sort().map((k) => ({ x: dataCurta(k), y: m[k] }));
  }, [checkins, avaliacoes]);
  const registrosPeso = useMemo(() => [...checkins.filter((c) => c.peso != null).map((c) => ({ data: c.semana, peso: c.peso, fonte: 'Oráculo (semana)' })),
    ...avaliacoes.filter((a) => a.peso != null).map((a) => ({ data: a.data, peso: a.peso, fonte: a.autoavaliacao ? 'Autoavaliação' : 'Avaliação' }))].sort((a, b) => (a.data < b.data ? 1 : -1)), [checkins, avaliacoes]);
  const pontosGordura = avaliacoes.filter((a) => a.percentual_gordura != null).map((a) => ({ x: dataCurta(a.data), y: a.percentual_gordura }));

  if (!feitas.length && !checkins.length && !avaliacoes.length) return html`<${Vazio} titulo="Nada registrado ainda" texto="Assim que o primeiro treino for concluído, a evolução aparece aqui."/>`;

  return html`<div class="pilha">
    <div class="stats">
      <div class="stat"><b>${feitas.length}</b><span>treinos no total</span></div>
      <div class="stat"><b>${noMes}</b><span>neste mês</span></div>
      <div class="stat"><b>${sequenciaSemanas(feitas)}</b><span>semanas seguidas</span></div>
      <div class="stat"><b>${num(ton / 1000, 1)} t</b><span>levantadas no total</span></div>
    </div>
    ${ton > 0 && html`<p class="nota">Tonelagem acumulada: ${num(ton, 0)} kg, ${equivalencia(ton)}.</p>`}

    ${comCarga.length > 0 && html`<section class="card">
      <div class="card-topo"><h3>Progressão de carga</h3></div>
      <div class="filtros-evolucao">
        <select class="input" value=${fichaSel} onChange=${(ev) => { setFichaSel(ev.target.value); setTreinoSel(''); }} aria-label="Ficha de treino">
          <option value="">Todas as fichas</option>
          ${mesos.map((m) => html`<option value=${m.id}>${m.nome || 'Ficha'} · ${dataBR(m.inicio)}${m.status === 'ativo' ? ' (ativa)' : ''}</option>`)}
        </select>
        <select class="input" value=${treinoSel} onChange=${(ev) => setTreinoSel(ev.target.value)} aria-label="Treino">
          <option value="">Todos os treinos</option>
          ${nomesTreino.map((t) => html`<option value=${t}>${t}</option>`)}
        </select>
      </div>
      ${exFiltro.length ? html`<select class="input" value=${exVer} onChange=${(ev) => setExSel(ev.target.value)} aria-label="Exercício">
          ${exFiltro.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}
        </select>
        <${LinhasSeries} datas=${porSerie.datas} linhas=${porSerie.linhas} sufixo=" kg"/>`
      : html`<p class="suave">Nenhum exercício com carga nesse filtro.</p>`}
    </section>`}

    ${comCarga.length > 0 && html`<${ProgressaoGeral} sessoes=${sessoes} series=${series} exercicios=${exercicios} onVer=${(id) => { setFichaSel(''); setTreinoSel(''); setExSel(id); }}/>`}

    <section class="card">
      <div class="card-topo"><div><h3>Olimpo</h3><small class="suave">O melhor de cada exercício: maior carga, repetições nela e 1RM estimado</small></div><span class="tag">${recs.length}</span></div>
      ${recs.length ? html`<div class="olimpo">${(verTodos ? recs : recs.slice(0, 6)).map((r) => { const novo = diasEntre(String(r.created_at).slice(0, 10), hoje()) <= 7;
        return html`<button class=${'trofeu' + (novo ? ' novo' : '')} onClick=${() => setExSel(r.exercicio_id)} title="Ver a curva de carga">
          <div class="trofeu-topo"><${Icone} nome="trofeu" tam=${18}/>${novo && html`<span class="tag roxo">novo</span>`}</div>
          <b class="trofeu-nome">${r.nome}</b>
          <div class="trofeu-num"><span>${num(r.carga, 1)}<small> kg</small></span><em>× ${r.reps || '·'} reps</em></div>
          <small>${r.rm ? `1RM estimado ${num(r.rm, 1)} kg · ` : ''}${dataBR(r.created_at)}</small>
        </button>`; })}</div>
        ${recs.length > 6 && html`<button class="btn-texto" onClick=${() => setVerTodos(!verTodos)}>${verTodos ? 'Ver menos' : `Ver todos (${recs.length})`}</button>`}`
      : html`<p class="suave">Os recordes aparecem quando houver séries com carga.</p>`}
    </section>

    ${pontosPeso.length > 0 && html`<section class="card"><div class="card-topo"><h3>Peso corporal</h3><span class="valor">${num(pontosPeso[pontosPeso.length - 1].y, 1)} kg</span></div><${Linha} pontos=${pontosPeso} sufixo=" kg"/>
      <details class="instr"><summary>Registros de peso (${registrosPeso.length})</summary>
        <table class="tabela-series"><thead><tr><th>Data</th><th>Peso</th><th>Onde</th></tr></thead>
          <tbody>${registrosPeso.map((r) => html`<tr><td>${dataBR(r.data)}</td><td>${num(r.peso, 1)} kg</td><td>${r.fonte}</td></tr>`)}</tbody></table></details></section>`}
    ${pontosGordura.length > 0 && html`<section class="card"><div class="card-topo"><h3>% de gordura</h3><span class="valor">${num(pontosGordura[pontosGordura.length - 1].y, 1)}%</span></div><${Linha} pontos=${pontosGordura} sufixo="%"/></section>`}

    ${feitas.length > 0 && html`<section class="card"><div class="card-topo"><h3>Últimos treinos</h3></div>
      <ul class="lista">${feitas.slice(-8).reverse().map((s) => html`<li class="linha">
        <div><b>${s.treino_nome || 'Treino'}</b><small>${dataBR(s.data)}${s.comentario ? ' · ' + s.comentario : ''}</small>
          ${notasDaSessao(s, series, exercicios).map(([ex, t]) => html`<small class="nota-ex"><b>${ex}:</b> ${t}</small>`)}</div>
        ${s.esforco ? html`<span class="tag">esforço ${s.esforco}/10</span>` : null}</li>`)}</ul></section>`}
  </div>`;
}

// observações que a aluna anotou por exercício na Arena (sessoes.notas, chave = treino_item_id)
function notasDaSessao(s, series, exercicios) {
  return Object.entries(s.notas || {}).filter(([, t]) => t).map(([itemId, t]) => {
    const serie = series.find((x) => x.sessao_id === s.id && x.treino_item_id === itemId);
    return [(exercicios.find((e) => serie && e.id === serie.exercicio_id) || {}).nome || 'Exercício', t];
  });
}

// progressão geral: todos os exercícios lado a lado, com filtro por treino
const e1rm = (x) => (x.carga == null ? 0 : x.carga * (1 + Math.min(x.reps || 1, 12) / 30));
function ProgressaoGeral({ sessoes, series, exercicios, onVer }) {
  const [treino, setTreino] = useState('');
  const nomes = [...new Set(sessoes.map((x) => x.treino_nome).filter(Boolean))].sort();
  const dataDe = {}; sessoes.forEach((x) => { dataDe[x.id] = x; });
  const validas = series.filter((x) => !x.aquecimento && x.carga != null && dataDe[x.sessao_id] && (!treino || dataDe[x.sessao_id].treino_nome === treino));
  const porEx = {};
  validas.forEach((x) => { (porEx[x.exercicio_id] = porEx[x.exercicio_id] || []).push(x); });
  const linhas = Object.entries(porEx).map(([id, l]) => {
    const ord = l.slice().sort((a, b) => (dataDe[a.sessao_id].data < dataDe[b.sessao_id].data ? -1 : 1));
    const d0 = dataDe[ord[0].sessao_id].data;
    const primeira = ord.filter((x) => dataDe[x.sessao_id].data === d0).reduce((m, x) => (e1rm(x) > e1rm(m) ? x : m));
    const melhor = ord.reduce((m, x) => (e1rm(x) > e1rm(m) ? x : m));
    const sess = new Set(ord.map((x) => x.sessao_id)).size;
    return { id, nome: (exercicios.find((e) => e.id === id) || {}).nome || 'Exercício', primeira, melhor, sess, ganho: sess > 1 ? e1rm(melhor) / e1rm(primeira) - 1 : null };
  }).sort((a, b) => (b.ganho ?? -9) - (a.ganho ?? -9));
  const media = linhas.filter((x) => x.ganho != null);
  const txt = (x) => `${num(x.carga, 1)} kg × ${x.reps || '·'}`;
  return html`<section class="card">
    <div class="card-topo"><h3>Progressão geral</h3>${media.length > 0 && html`<span class="tag roxo">média ${media.reduce((t, x) => t + x.ganho, 0) / media.length >= 0 ? '+' : ''}${num((media.reduce((t, x) => t + x.ganho, 0) / media.length) * 100, 0)}%</span>`}</div>
    ${nomes.length > 1 && html`<div class="chips">${['', ...nomes].map((n) => html`<button class=${treino === n ? 'chip on' : 'chip'} onClick=${() => setTreino(n)}>${n || 'Todos os treinos'}</button>`)}</div>`}
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th>Exercício</th><th>Primeira</th><th>Melhor</th><th>Força est.</th></tr></thead>
      <tbody>${linhas.map((x) => html`<tr onClick=${() => onVer(x.id)} class="clicavel"><td>${x.nome}<small> · ${x.sess} sessão(ões)</small></td><td>${txt(x.primeira)}</td><td>${txt(x.melhor)}</td>
        <td class=${x.ganho > 0.005 ? 'positivo' : x.ganho < -0.005 ? 'negativo' : ''}>${x.ganho == null ? '·' : `${x.ganho > 0 ? '+' : ''}${num(x.ganho * 100, 0)}%`}</td></tr>`)}</tbody></table></div>
    <small>Força estimada pela fórmula de Epley. Toque num exercício para ver a curva dele acima.</small>
  </section>`;
}

// ============================================================
// ANAMNESE
// ============================================================
export const PERGUNTAS = [
  { t: 'Objetivo', campos: [
    ['objetivo', 'Qual o seu principal objetivo com o treino?', 'area'],
    ['motivo', 'Por que isso é importante pra você agora?', 'area'],
  ] },
  { t: 'Experiência e rotina', campos: [
    ['experiencia', 'Há quanto tempo treina musculação?', ['Nunca treinei', 'Menos de 6 meses', '6 meses a 1 ano', '1 a 3 anos', 'Mais de 3 anos', 'Voltando depois de uma pausa']],
    ['dias_semana', 'Quantos dias por semana consegue treinar?', ['2', '3', '4', '5', '6']],
    ['tempo_sessao', 'Quanto tempo tem por treino?', ['30 a 45 min', '45 a 60 min', '60 a 75 min', 'Mais de 75 min']],
    ['local_treino', 'Onde vai treinar?', ['Academia completa', 'Academia de condomínio', 'Em casa com alguns pesos', 'Em casa sem equipamento']],
    ['rotina_trabalho', 'Como é o seu dia?', ['Sentada a maior parte do dia', 'Em pé ou andando a maior parte do dia', 'Misto', 'Trabalho físico pesado']],
    ['cardio', 'Faz algum cardio ou esporte hoje? Qual e quanto?', 'texto'],
    ['exercicios_nao_gosta', 'Algum exercício que você não gosta ou não consegue fazer?', 'texto'],
  ] },
  { t: 'Sono, estresse e alimentação', campos: [
    ['sono_horas', 'Quantas horas dorme por noite, em média?', ['Menos de 5', '5 a 6', '6 a 7', '7 a 8', 'Mais de 8']],
    ['sono_qualidade', 'Como acorda na maioria dos dias?', ['Descansada', 'Mais ou menos', 'Cansada']],
    ['estresse', 'Nível de estresse no dia a dia', ['Baixo', 'Moderado', 'Alto', 'Muito alto']],
    ['alimentacao', 'Como está a sua alimentação?', ['Organizada', 'Regular', 'Desorganizada']],
    ['nutri', 'Tem acompanhamento com nutricionista?', ['Sim', 'Não', 'Tenho interesse']],
  ] },
  { t: 'Saúde', campos: [
    ['lesoes', 'Tem ou já teve alguma lesão ou dor? Onde?', 'area'],
    ['cirurgias', 'Já fez alguma cirurgia? Qual e quando?', 'texto'],
    ['condicoes', 'Alguma condição de saúde que eu deva saber? (ex.: pressão, tireoide, SOP, diabetes)', 'area'],
    ['medicamentos', 'Usa algum medicamento contínuo?', 'texto'],
    ['ciclo', 'Seu ciclo menstrual costuma ser regular?', ['Sim', 'Não', 'Uso anticoncepcional contínuo', 'Não se aplica']],
  ] },
];
export const PARQ = [
  'Algum médico já disse que você tem problema de coração e só deve fazer atividade física recomendada por médico?',
  'Você sente dor no peito quando faz atividade física?',
  'No último mês, sentiu dor no peito sem estar fazendo atividade física?',
  'Você perde o equilíbrio por tontura ou já perdeu a consciência?',
  'Tem algum problema ósseo ou articular que pode piorar com atividade física?',
  'Toma remédio para pressão arterial ou para o coração?',
  'Existe alguma outra razão pela qual você não deveria fazer atividade física?',
];

export function Anamnese({ alunaId, leitura, onSalvo }) {
  const e = useCarregar(() => api.um('anamneses', { aluna_id: alunaId }), [alunaId]);
  return html`<${Estado} e=${e}>${(d) => (leitura
    ? html`<${AnamneseLeitura} r=${(d && d.respostas) || null} quando=${d && d.updated_at}/>`
    : html`<${AnamneseForm} alunaId=${alunaId} inicial=${(d && d.respostas) || {}} onSalvo=${onSalvo}/>`)}<//>`;
}

function AnamneseLeitura({ r, quando }) {
  if (!r) return html`<${Vazio} titulo="Alistamento não preenchido" texto="A aluna preenche no primeiro acesso ao app (ou depois, em Perfil)."/>`;
  const alertas = PARQ.map((p, i) => [p, (r.parq || {})['p' + (i + 1)]]).filter(([, v]) => v === 'Sim');
  return html`<div class="pilha">
    <p class="suave">Atualizada em ${dataBR(quando)}</p>
    ${alertas.length > 0 && html`<div class="card alerta"><b>PAR-Q com "sim" em ${alertas.length} pergunta(s)</b><ul>${alertas.map(([p]) => html`<li>${p}</li>`)}</ul><p>Peça liberação médica antes de começar.</p></div>`}
    ${PERGUNTAS.map((b) => html`<section class="card"><h3>${b.t}</h3><dl class="respostas">
      ${b.campos.map(([k, p]) => html`<div><dt>${p}</dt><dd>${r[k] || '·'}</dd></div>`)}</dl></section>`)}
    <section class="card"><h3>PAR-Q</h3><dl class="respostas">${PARQ.map((p, i) => html`<div><dt>${p}</dt><dd>${(r.parq || {})['p' + (i + 1)] || '·'}</dd></div>`)}</dl></section>
  </div>`;
}

function AnamneseForm({ alunaId, inicial, onSalvo }) {
  const [r, setR] = useState({ parq: {}, ...inicial });
  const [salvando, setSalvando] = useState(false);
  const muda = (k, v) => setR({ ...r, [k]: v });
  const salvar = async (ev) => {
    ev.preventDefault();
    const faltaParq = PARQ.some((_, i) => !(r.parq || {})['p' + (i + 1)]);
    if (!r.objetivo || faltaParq) { toast('Preencha pelo menos o objetivo e as 7 perguntas do PAR-Q.', 'erro'); return; }
    setSalvando(true);
    try {
      await api.ups('anamneses', { aluna_id: alunaId, respostas: r, updated_at: new Date().toISOString() }, 'aluna_id');
      await api.upd('profiles', alunaId, { anamnese_ok: true, objetivo: r.objetivo });
      toast('Anamnese salva', 'ok'); onSalvo && onSalvo();
    } catch (err) { toast(err.message, 'erro'); } finally { setSalvando(false); }
  };
  return html`<form class="pilha" onSubmit=${salvar}>
    ${PERGUNTAS.map((b) => html`<section class="card"><h3>${b.t}</h3>
      ${b.campos.map(([k, p, tipo]) => html`<${Campo} rotulo=${p}>
        ${Array.isArray(tipo) ? html`<div class="chips">${tipo.map((o) => html`<button type="button" class=${r[k] === o ? 'chip on' : 'chip'} onClick=${() => muda(k, o)}>${o}</button>`)}</div>`
        : tipo === 'area' ? html`<textarea class="input" rows="2" value=${r[k] || ''} onInput=${(ev) => muda(k, ev.target.value)}></textarea>`
        : html`<input class="input" value=${r[k] || ''} onInput=${(ev) => muda(k, ev.target.value)}/>`}
      <//>`)}</section>`)}
    <section class="card"><h3>PAR-Q</h3><p class="suave">Questionário de prontidão para atividade física. Responda com sinceridade.</p>
      ${PARQ.map((p, i) => { const k = 'p' + (i + 1); return html`<div class="parq"><span>${i + 1}. ${p}</span>
        <div class="chips">${['Não', 'Sim'].map((o) => html`<button type="button" class=${(r.parq || {})[k] === o ? 'chip on' : 'chip'} onClick=${() => setR({ ...r, parq: { ...r.parq, [k]: o } })}>${o}</button>`)}</div></div>`; })}
    </section>
    <button class="btn primario grande" disabled=${salvando}>${salvando ? 'Salvando...' : 'Salvar anamnese'}</button>
  </form>`;
}

// ============================================================
// AVALIAÇÃO FÍSICA
// ============================================================
export function Avaliacoes({ aluna, podeEditar }) {
  const e = useCarregar(() => api.q('avaliacoes', { eq: { aluna_id: aluna.id }, order: 'data', asc: false }), [aluna.id]);
  const [nova, setNova] = useState(false);
  const [comparando, setComparando] = useState(false);
  const [sel, setSel] = useState([]);
  return html`<div class="pilha">
    <div class="acoes">${podeEditar ? html`<button class="btn primario" onClick=${() => setNova(true)}>+ Nova avaliação</button>`
      : html`<button class="btn primario" onClick=${() => setNova(true)}>+ Fazer autoavaliação</button>`}
      ${(e.dados || []).length > 1 && html`<button class=${'btn' + (comparando ? ' on' : '')} onClick=${() => { setComparando(!comparando); setSel(comparando ? [] : (e.dados || []).slice(0, 2).map((x) => x.id)); }}>${comparando ? 'Fechar comparação' : 'Comparar avaliações'}</button>`}</div>
    <${Estado} e=${e}>${(lista) => {
      if (!lista.length) return html`<${ComoFunciona} titulo="Nenhuma avaliação ainda" passos=${[
        ['Registre a avaliação', 'Peso, altura, dobras (Pollock 3 ou 7), circunferências e diâmetros ósseos.'],
        ['A composição sai sozinha', '% de gordura, massa gorda, magra, óssea e muscular.'],
        ['Compare as datas', 'Escolha duas ou mais e veja as diferenças lado a lado.'],
        ['Acompanhe nos gráficos', 'Peso, gordura e massa magra ao longo do tempo.']]}/>`;
      const asc = lista.slice().reverse();
      return html`${asc.length > 1 && html`<${GraficosAvaliacao} lista=${asc} sexo=${aluna.sexo}/>`}
        ${comparando && html`<${ComparaAvaliacoes} lista=${asc.filter((x) => sel.includes(x.id))} sexo=${aluna.sexo} objetivo=${aluna.objetivo}/>`}
        ${lista.map((a, i) => html`<div class=${comparando ? 'aval-sel' : ''}>
          ${comparando && html`<label class="toggle"><input type="checkbox" checked=${sel.includes(a.id)} onChange=${() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id])}/> Comparar ${dataBR(a.data)}</label>`}
          <${CartaoAvaliacao} a=${a} anterior=${lista[i + 1]} sexo=${aluna.sexo} podeEditar=${podeEditar} onApagar=${async () => { if (confirm('Apagar esta avaliação?')) { await api.del('avaliacoes', a.id); e.recarregar(); } }}/></div>`)}`;
    }}<//>
    ${nova && (podeEditar ? html`<${NovaAvaliacao} aluna=${aluna} onFechar=${() => setNova(false)} onSalvo=${() => { setNova(false); e.recarregar(); }}/>`
      : html`<${Autoavaliacao} aluna=${aluna} onFechar=${() => setNova(false)} onSalvo=${() => { setNova(false); e.recarregar(); }}/>`)}
  </div>`;
}

// linhas da comparação: [rótulo, função que lê o valor, unidade, casas]
const somaDobras = (a) => { const v = Object.values(a.dobras || {}).map(Number).filter((x) => !isNaN(x)); return v.length ? v.reduce((x, y) => x + y, 0) : null; };
// [rótulo, leitura, unidade, casas, sentido bom]: 'menor', 'maior' ou 'obj' (depende do objetivo da aluna)
const MEMBROS = /^(Braço|Antebraço|Coxa|Panturrilha|Quadril|Ombro|Tórax)/;
function linhasComparacao(sexo) {
  const c = (k) => (a) => composicao(a, sexo)[k];
  return [['Peso', (a) => a.peso, 'kg', 1, 'obj'], ['% de gordura', (a) => a.percentual_gordura, '%', 1, 'menor'], ['Massa gorda', c('gorda'), 'kg', 1, 'menor'], ['Massa magra', c('magra'), 'kg', 1, 'maior'],
    ['Massa muscular', c('muscular'), 'kg', 1, 'maior'], ['Massa óssea', c('ossea'), 'kg', 1, null], ['IMC', c('imc'), '', 1, 'obj'], ['Relação cintura/quadril', c('rcq'), '', 2, 'menor'], ['Soma das dobras', somaDobras, 'mm', 0, 'menor'],
    ...MEDIDAS_TODAS.map(([k, r]) => [r, (a) => (a.medidas || {})[k], 'cm', 1, ['cintura', 'abdomen'].includes(k) ? 'menor' : MEMBROS.test(r) ? 'membro' : null])];
}
// objetivo em texto livre vira direção: perder (emagrecer, definir) ou ganhar (hipertrofia, massa, glúteo)
// os dois juntos (ex.: "glúteo e definição") = recomposição: peso neutro, membros maiores contam como melhora
export const direcaoObjetivo = (obj) => { const o = String(obj || '').toLowerCase(); const p = /emagre|perder|secar|defini|reduzir/.test(o), g = /massa|hipertrof|ganhar|gl[uú]teo|volume|crescer/.test(o);
  return p && g ? 'recomp' : p ? 'perder' : g ? 'ganhar' : null; };
const NOME_DIR = { perder: 'perder gordura', ganhar: 'ganhar massa', recomp: 'recomposição (menos gordura, mais músculo)' };
const minimo = (cs) => 0.5 * Math.pow(10, -cs);
function classeDif(d, sentido, dir, cs = 1) {
  if (d == null || Math.abs(d) < minimo(cs) || !sentido) return '';
  let bom = sentido === 'menor' ? d < 0 : sentido === 'maior' ? d > 0 : null;
  if (sentido === 'obj') bom = dir === 'perder' ? d < 0 : dir === 'ganhar' ? d > 0 : null;
  if (sentido === 'membro') bom = dir === 'ganhar' || dir === 'recomp' ? d > 0 : null;
  return bom == null ? '' : bom ? 'melhora' : 'piora';
}
const NOME_PROT = { jp7: 'Pollock 7', jp3: 'Pollock 3', weltman: 'Weltman', tran: 'Tran & Weltman', slaughter: 'Slaughter', perimetria: 'só perimetria' };
function ComparaAvaliacoes({ lista, sexo, objetivo }) {
  if (lista.length < 2) return html`<p class="nota">Marque pelo menos duas avaliações abaixo para comparar.</p>`;
  const protos = [...new Set(lista.map((a) => a.protocolo || 'jp7'))];
  const mesmoProtocolo = protos.length === 1;
  const dir = direcaoObjetivo(objetivo);
  const linhas = linhasComparacao(sexo).filter(([r, f]) => lista.some((a) => f(a) != null) && (mesmoProtocolo || r !== 'Soma das dobras'));
  return html`<section class="card"><div class="card-topo"><h3>Comparação</h3><small>${dir ? `Cores pelo objetivo: ${NOME_DIR[dir]}` : 'Verde = melhorou · vermelho = piorou'}</small></div>
    ${!mesmoProtocolo && html`<p class="nota atencao">Atenção: estas avaliações usam protocolos diferentes (${protos.map((p) => NOME_PROT[p] || p).join(', ')}). Parte da diferença no % de gordura pode vir só da troca de protocolo.</p>`}
    <div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th></th>${lista.map((a) => html`<th>${dataBR(a.data)}<br/><small>${NOME_PROT[a.protocolo || 'jp7']}</small></th>`)}<th>Diferença</th><th>%</th></tr></thead>
    <tbody>${linhas.map(([r, f, u, cs, sentido]) => { const v0 = f(lista[0]), v1 = f(lista[lista.length - 1]); const d = v0 != null && v1 != null ? Number(v1) - Number(v0) : null;
      const pc = d != null && Number(v0) ? (d / Number(v0)) * 100 : null; const cl = classeDif(d, sentido, dir, cs);
      return html`<tr><td>${r}</td>${lista.map((a) => html`<td>${f(a) != null ? `${num(f(a), cs)}${u ? ' ' + u : ''}` : '·'}</td>`)}
        <td class=${cl}>${d == null ? '·' : `${d > 0 ? '+' : ''}${num(d, cs)}${u ? ' ' + u : ''}`}</td>
        <td class=${cl}>${pc == null || Math.abs(d) < minimo(cs) ? '·' : `${pc > 0 ? '+' : ''}${num(pc, 1)}%`}</td></tr>`; })}</tbody></table></div></section>`;
}
function GraficosAvaliacao({ lista, sexo }) {
  const [serie, setSerie] = useState('Peso');
  const ops = linhasComparacao(sexo).filter(([, f]) => lista.filter((a) => f(a) != null).length > 1);
  const [r, f, u] = ops.find(([x]) => x === serie) || ops[0] || [];
  if (!f) return null;
  const pontos = lista.filter((a) => f(a) != null).map((a) => ({ x: dataCurta(a.data), y: Number(f(a)) }));
  return html`<section class="card"><div class="card-topo"><h3>Evolução nas avaliações</h3>
      <select class="input curto" aria-label="Medida do gráfico" onChange=${(ev) => setSerie(ev.target.value)}>${ops.map(([x]) => html`<option value=${x} selected=${x === r}>${x}</option>`)}</select></div>
    <${Linha} pontos=${pontos} sufixo=${u ? ' ' + u : ''}/></section>`;
}

function CartaoAvaliacao({ a, anterior, sexo, podeEditar, onApagar }) {
  const dif = (atual, antes) => { if (atual == null || antes == null) return null; const d = atual - antes; return Math.abs(d) < 0.05 ? null : html`<small class=${d < 0 ? 'baixa' : 'alta'}>${d > 0 ? '+' : ''}${num(d, 1)}</small>`; };
  const c = composicao(a, sexo); const ca = anterior ? composicao(anterior, sexo) : {};
  return html`<section class="card">
    <div class="card-topo"><div><h3>${dataBR(a.data)}</h3><small>${a.autoavaliacao ? 'Autoavaliação · ' : ''}${(PROTOCOLOS.find(([k]) => k === (a.protocolo || (Object.keys(a.dobras || {}).length ? 'jp7' : 'perimetria'))) || [, ''])[1]}</small></div>
      ${podeEditar && html`<button class="btn-texto perigo" onClick=${onApagar}>Apagar</button>`}</div>
    <div class="stats">
      <div class="stat"><b>${num(a.peso, 1)} kg</b><span>peso ${dif(a.peso, anterior && anterior.peso)}</span></div>
      <div class="stat"><b>${a.percentual_gordura != null ? num(a.percentual_gordura, 1) + '%' : '·'}</b><span>gordura ${dif(a.percentual_gordura, anterior && anterior.percentual_gordura)}</span></div>
      ${c.magra != null && html`<div class="stat"><b>${num(c.magra, 1)} kg</b><span>massa magra ${dif(c.magra, ca.magra)}</span></div>`}
      ${c.gorda != null && html`<div class="stat"><b>${num(c.gorda, 1)} kg</b><span>massa gorda ${dif(c.gorda, ca.gorda)}</span></div>`}
      ${c.muscular != null && html`<div class="stat"><b>${num(c.muscular, 1)} kg</b><span>massa muscular ${dif(c.muscular, ca.muscular)}</span></div>`}
      ${c.ossea != null && html`<div class="stat"><b>${num(c.ossea, 1)} kg</b><span>massa óssea</span></div>`}
      ${c.imc != null && html`<div class="stat"><b>${num(c.imc, 1)}</b><span>IMC</span></div>`}
      ${c.rcq != null && html`<div class="stat"><b>${num(c.rcq, 2)}</b><span>cintura/quadril</span></div>`}
    </div>
    ${Object.keys(a.medidas || {}).length > 0 && html`<dl class="grade-medidas">${MEDIDAS_TODAS.filter(([k]) => (a.medidas || {})[k] != null).map(([k, r]) => html`<div><dt>${r}</dt><dd>${num(a.medidas[k], 1)} cm ${dif(a.medidas[k], anterior && (anterior.medidas || {})[k])}</dd></div>`)}</dl>`}
    ${a.obs && html`<p class="nota">${a.obs}</p>`}
  </section>`;
}

function NovaAvaliacao({ aluna, onFechar, onSalvo }) {
  const sexo = aluna.sexo === 'M' ? 'M' : 'F';
  const [f, setF] = useState({ data: hoje(), idade: idadeDe(aluna.nascimento) || '', peso: '', altura: '', obs: '' });
  const [protocolo, setProtocolo] = useState(() => protocoloSugerido(sexo, idadeDe(aluna.nascimento)));
  const [dobras, setDobras] = useState({});
  const [medidas, setMedidas] = useState({});
  const [diametros, setDiametros] = useState({});
  const limpa = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, lerNum(v)]).filter(([, v]) => v != null));
  const pede = camposProtocolo(protocolo, sexo);
  const pct = percentualGordura(protocolo, { dobras, medidas, peso: f.peso, altura: f.altura, idade: f.idade }, sexo);
  const previa = composicao({ peso: f.peso, altura: f.altura, percentual_gordura: pct, diametros: limpa(diametros), medidas: limpa(medidas) }, sexo);
  const salvar = async (ev) => {
    ev.preventDefault();
    const linha = { aluna_id: aluna.id, data: f.data, idade: lerNum(f.idade), peso: lerNum(f.peso), altura: lerNum(f.altura), dobras: limpa(dobras), medidas: limpa(medidas), percentual_gordura: pct, obs: f.obs || null };
    if (protocolo !== 'jp7') linha.protocolo = protocolo;
    if (Object.keys(limpa(diametros)).length) linha.diametros = limpa(diametros);
    try { await api.ins('avaliacoes', linha); toast('Avaliação salva', 'ok'); onSalvo(); } catch (err) { toast(err.message, 'erro'); }
  };
  const inp = (obj, set, k) => html`<input class="input" inputmode="decimal" value=${obj[k] || ''} onInput=${(ev) => set({ ...obj, [k]: ev.target.value })}/>`;
  const rot = (r, k, lista) => html`${r}${lista && lista.includes(k) ? html` <b class="obrig">*</b>` : ''}`;
  const info = PROTOCOLOS.find(([k]) => k === protocolo);
  return html`<${Modal} titulo=${'Avaliação · ' + aluna.nome} onFechar=${onFechar} largo>
    <form class="pilha" onSubmit=${salvar}>
      <div class="grade2">
        <${Campo} rotulo="Data"><input class="input" type="date" value=${f.data} onInput=${(ev) => setF({ ...f, data: ev.target.value, idade: aluna.nascimento && ev.target.value ? idadeEm(aluna.nascimento, ev.target.value) : f.idade })}/><//>
        <${Campo} rotulo=${`Idade · ${sexo === 'M' ? 'masculino' : 'feminino'} (do cadastro)`}>${inp(f, setF, 'idade')}<//>
        <${Campo} rotulo="Peso (kg)">${inp(f, setF, 'peso')}<//>
        <${Campo} rotulo="Estatura (cm)">${inp(f, setF, 'altura')}<//>
      </div>
      <div class="campo"><span class="rotulo">Protocolo</span>
        <div class="chips">${PROTOCOLOS.map(([k, r]) => html`<button type="button" class=${protocolo === k ? 'chip on' : 'chip'} onClick=${() => setProtocolo(k)}>${r}</button>`)}</div>
        <small>${info[3]} · pede ${info[2]}. Os campos com * são os que a fórmula usa.</small></div>
      <details class="bloco-aval" open=${!!pede.dobras}><summary>Dobras cutâneas (mm)${pede.dobras ? '' : ' · opcional'}</summary>
        <div class="grade3">${DOBRAS.map(([k, r]) => html`<${Campo} rotulo=${rot(r, k, pede.dobras)}>${inp(dobras, setDobras, k)}<//>`)}</div></details>
      <details class="bloco-aval" open><summary>Perimetria (cm)</summary>
        <div class="grade3">${MEDIDAS.map(([k, r]) => html`<${Campo} rotulo=${rot(r, k, pede.medidas)}>${inp(medidas, setMedidas, k)}<//>`)}</div></details>
      <details class="bloco-aval"><summary>Diâmetros ósseos (mm) · opcional, para a massa óssea</summary>
        <div class="grade3">${DIAMETROS.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(diametros, setDiametros, k)}<//>`)}</div></details>
      <div class="destaque composicao">${pct != null ? html`<div><span>% de gordura</span><b>${num(pct, 1)}%</b></div>
          ${previa.gorda != null && html`<div><span>Massa gorda</span><b>${num(previa.gorda, 1)} kg</b></div>`}
          ${previa.magra != null && html`<div><span>Massa magra</span><b>${num(previa.magra, 1)} kg</b></div>`}
          ${previa.ossea != null && html`<div><span>Massa óssea</span><b>${num(previa.ossea, 1)} kg</b></div>`}
          ${previa.muscular != null && html`<div><span>Massa muscular</span><b>${num(previa.muscular, 1)} kg</b></div>`}
          ${previa.rcq != null && html`<div><span>Cintura/quadril</span><b>${num(previa.rcq, 2)}</b></div>`}`
        : html`<span>${protocolo === 'perimetria' ? 'Só perimetria: sem % de gordura. Os perímetros e o peso entram na comparação.' : 'Preencha os campos com * para calcular a composição corporal.'}</span>`}</div>
      <${Campo} rotulo="Observações"><textarea class="input" rows="2" value=${f.obs} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
      <button class="btn primario grande">Salvar avaliação</button>
    </form><//>`;
}

// ============================================================
// AUTOAVALIAÇÃO (a aluna mede sozinha: perímetros, peso e fotos padronizadas)
// ============================================================
const PONTOS_AUTO = [
  ['cintura', 'Cintura', 'Na parte mais fina da barriga, entre as costelas e o umbigo. Solte o ar e meça sem apertar.'],
  ['abdomen', 'Abdômen', 'Na altura do umbigo, com a barriga relaxada, depois de soltar o ar.'],
  ['quadril', 'Quadril', 'Na parte mais larga do bumbum, com os pés juntos.'],
  ['coxa_med_d', 'Coxa média D', 'No meio da coxa direita, entre a virilha e o joelho, com a perna relaxada.'],
  ['braco_rel_d', 'Braço D relaxado', 'No meio do braço direito, entre o ombro e o cotovelo, braço solto ao lado do corpo.'],
  ['pant_d', 'Panturrilha D', 'Na parte mais grossa da panturrilha direita, em pé.'],
];
const FOTOS_AUTO = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas']];
function Autoavaliacao({ aluna, onFechar, onSalvo }) {
  const [f, setF] = useState({ peso: '', obs: '' });
  const [medidas, setMedidas] = useState({});
  const [fotos, setFotos] = useState({});
  const [salvando, setSalvando] = useState(false);
  const salvar = async (ev) => {
    ev.preventDefault();
    if (Object.values(fotos).some(Boolean)) {
      let ok = false;
      try { ok = await podeImagem(aluna.id); } catch (err) { toast(err.message, 'erro'); return; }
      if (!ok) { toast('Para enviar fotos, autorize fotos e vídeos em Perfil > Privacidade. Ou envie só as medidas.', 'erro'); return; }
    }
    if (!lerNum(f.peso)) { toast('Coloque o seu peso.', 'erro'); return; }
    setSalvando(true);
    try {
      for (const [k, r] of FOTOS_AUTO) {
        const arq = fotos[k]; if (!arq) continue;
        const caminho = `${aluna.id}/fotos/${Date.now()}-autoavaliacao-${k}.${(arq.name.split('.').pop() || 'jpg').toLowerCase()}`;
        await api.subirArquivo(caminho, arq);
        await api.ins('arquivos_aluna', { aluna_id: aluna.id, nome: `Autoavaliação ${dataBR(hoje())} · ${r}`, caminho, tipo: arq.type || null, categoria: 'foto', tamanho: arq.size });
      }
      const m = Object.fromEntries(Object.entries(medidas).map(([k, v]) => [k, lerNum(v)]).filter(([, v]) => v != null));
      await api.ins('avaliacoes', { aluna_id: aluna.id, data: hoje(), idade: idadeDe(aluna.nascimento), peso: lerNum(f.peso), medidas: m, dobras: {}, protocolo: 'perimetria', autoavaliacao: true, obs: f.obs || null });
      toast('Autoavaliação enviada para o seu treinador', 'ok'); onSalvo();
    } catch (err) { toast(err.message, 'erro'); setSalvando(false); }
  };
  return html`<${Modal} titulo="Autoavaliação" onFechar=${onFechar} largo><form class="pilha" onSubmit=${salvar}>
    <p class="nota">Use uma fita métrica de costura. Meça de manhã, antes de comer, sempre no mesmo lugar e sem apertar a pele. Se tiver dúvida em algum ponto, pule.</p>
    <${Campo} rotulo="Peso (kg), em jejum"><input class="input" inputmode="decimal" value=${f.peso} onInput=${(ev) => setF({ ...f, peso: ev.target.value })}/><//>
    ${PONTOS_AUTO.map(([k, r, como]) => html`<div class="auto-ponto"><${Campo} rotulo=${`${r} (cm)`} dica=${como}><input class="input" inputmode="decimal" value=${medidas[k] || ''} onInput=${(ev) => setMedidas({ ...medidas, [k]: ev.target.value })}/><//></div>`)}
    <div class="campo"><span class="rotulo">Fotos</span><small>Roupa justa, luz de frente, celular na altura do umbigo, a uns 2 metros. Braços soltos ao lado do corpo.</small>
      <div class="grade3">${FOTOS_AUTO.map(([k, r]) => html`<label class=${'foto-auto' + (fotos[k] ? ' ok' : '')}><b>${r}</b><small>${fotos[k] ? fotos[k].name : 'toque para tirar'}</small>
        <input type="file" accept="image/*" capture="environment" hidden onChange=${(ev) => setFotos({ ...fotos, [k]: ev.target.files[0] })}/></label>`)}</div></div>
    <${Campo} rotulo="Quer contar algo?"><textarea class="input" rows="2" value=${f.obs} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
    <button class="btn primario grande" disabled=${salvando}>${salvando ? 'Enviando...' : 'Enviar autoavaliação'}</button>
  </form><//>`;
}

// ---------- metas da semana (perguntas metas_semana e metas_cumpridas do Oráculo vivo, atualização 15) ----------
export const ROTULO_METAS = { todas: 'cumpriu todas', parte: 'cumpriu parte', nenhuma: 'não cumpriu' };
const textoResposta = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v));
export async function metasDoEnvio(envioId) {
  const l = await api.q('respostas', { eq: { envio_id: envioId } });
  const pega = (k) => textoResposta((l.find((r) => r.chave === k) || {}).valor).trim();
  return { semana: pega('metas_semana'), cumpridas: pega('metas_cumpridas') };
}
// último Oráculo vivo da aluna que trouxe metas para a semana (null se não houver ou sem as atualizações)
export async function metasAtuais(alunaId) {
  try {
    const forms = (await api.q('formularios', { eq: { tipo: 'oraculo' } })).map((f) => f.id);
    if (!forms.length) return null;
    // só o último Oráculo vale: é ele que o próximo usa para perguntar como foi
    const ultimo = (await api.q('envios', { eq: { aluna_id: alunaId }, order: 'enviado_em', asc: false, limit: 20 })).find((x) => forms.includes(x.formulario_id));
    if (!ultimo) return null;
    const m = await metasDoEnvio(ultimo.id);
    return m.semana ? { ...m, em: ultimo.enviado_em } : null;
  } catch (err) { return null; }
}
export function MetasEnvio({ envio }) {
  const e = useCarregar(() => metasDoEnvio(envio.id).catch(() => null), [envio.id]);
  const m = e.dados;
  if (!m || (!m.semana && !m.cumpridas)) return null;
  return html`<div class="metas-semana">
    ${m.cumpridas && html`<p><b>Metas da semana passada:</b> ${ROTULO_METAS[m.cumpridas] || m.cumpridas}${(envio.contexto && envio.contexto.anterior && envio.contexto.anterior.metas_semana) ? html`<br/><small class="suave">${envio.contexto.anterior.metas_semana}</small>` : ''}</p>`}
    ${m.semana && html`<p><b>Metas para a próxima semana:</b> ${m.semana}</p>`}
  </div>`;
}

