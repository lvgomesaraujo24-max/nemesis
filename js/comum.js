// Telas usadas pelos dois lados (treinador e aluna)
import { html, useState, useMemo } from '../lib/preact-htm.js';
import { api } from './api.js';
import { useCarregar, Estado, Vazio, Linha, Modal, Campo, toast, num, dataBR, dataCurta, hoje, lerNum, tonelagem,
  recordes, sequenciaSemanas, equivalencia, DOBRAS, MEDIDAS, percentualJP7, percentualJP3, DOBRAS_JP3, DIAMETROS, composicao, idadeDe, relativo } from './util.js';

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
    const [sessoes, series, exercicios, checkins, avaliacoes] = await Promise.all([
      api.q('sessoes', { eq: { aluna_id: alunaId }, order: 'data' }),
      api.q('series', { eq: { aluna_id: alunaId }, order: 'created_at' }),
      api.q('exercicios', { order: 'nome' }),
      api.q('checkins', { eq: { aluna_id: alunaId }, order: 'semana' }),
      api.q('avaliacoes', { eq: { aluna_id: alunaId }, order: 'data' }),
    ]);
    return { sessoes, series, exercicios, checkins, avaliacoes };
  }, [alunaId]);
  return html`<${Estado} e=${e}>${(d) => html`<${EvolucaoCorpo} d=${d}/>`}<//>`;
}

function EvolucaoCorpo({ d }) {
  const { sessoes, series, exercicios, checkins, avaliacoes } = d;
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

  const pontosCarga = useMemo(() => {
    const porData = {};
    series.filter((s) => s.exercicio_id === exSel && s.carga != null && !s.aquecimento).forEach((s) => {
      const dt = (sessoes.find((x) => x.id === s.sessao_id) || {}).data || s.created_at.slice(0, 10);
      porData[dt] = Math.max(porData[dt] || 0, s.carga);
    });
    return Object.keys(porData).sort().map((k) => ({ x: dataCurta(k), y: porData[k] }));
  }, [exSel, series]);

  const pontosPeso = useMemo(() => {
    const m = {};
    checkins.forEach((c) => { if (c.peso != null) m[c.semana] = c.peso; });
    avaliacoes.forEach((a) => { if (a.peso != null) m[a.data] = a.peso; });
    return Object.keys(m).sort().map((k) => ({ x: dataCurta(k), y: m[k] }));
  }, [checkins, avaliacoes]);
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
      <div class="card-topo"><h3>Carga por exercício</h3></div>
      <select class="input" value=${exSel} onChange=${(ev) => setExSel(ev.target.value)} aria-label="Exercício">
        ${comCarga.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}
      </select>
      <${Linha} pontos=${pontosCarga} sufixo=" kg"/>
    </section>`}

    ${comCarga.length > 0 && html`<${ProgressaoGeral} sessoes=${sessoes} series=${series} exercicios=${exercicios} onVer=${setExSel}/>`}

    <section class="card">
      <div class="card-topo"><h3>Olimpo · recordes</h3><span class="tag">${recs.length}</span></div>
      ${recs.length ? html`<ul class="lista">${(verTodos ? recs : recs.slice(0, 6)).map((r) => html`<li class="linha">
        <div><b>${r.nome}</b><small>${relativo(r.created_at)}</small></div>
        <span class="valor">${num(r.carga, 1)} kg × ${r.reps || '·'}</span></li>`)}</ul>
        ${recs.length > 6 && html`<button class="btn-texto" onClick=${() => setVerTodos(!verTodos)}>${verTodos ? 'Ver menos' : `Ver todos (${recs.length})`}</button>`}`
      : html`<p class="suave">Os recordes aparecem quando houver séries com carga.</p>`}
    </section>

    ${pontosPeso.length > 0 && html`<section class="card"><div class="card-topo"><h3>Peso corporal</h3><span class="valor">${num(pontosPeso[pontosPeso.length - 1].y, 1)} kg</span></div><${Linha} pontos=${pontosPeso} sufixo=" kg"/></section>`}
    ${pontosGordura.length > 0 && html`<section class="card"><div class="card-topo"><h3>% de gordura</h3><span class="valor">${num(pontosGordura[pontosGordura.length - 1].y, 1)}%</span></div><${Linha} pontos=${pontosGordura} sufixo="%"/></section>`}

    ${feitas.length > 0 && html`<section class="card"><div class="card-topo"><h3>Últimos treinos</h3></div>
      <ul class="lista">${feitas.slice(-8).reverse().map((s) => html`<li class="linha">
        <div><b>${s.treino_nome || 'Treino'}</b><small>${dataBR(s.data)}${s.comentario ? ' · ' + s.comentario : ''}</small></div>
        ${s.esforco ? html`<span class="tag">esforço ${s.esforco}/10</span>` : null}</li>`)}</ul></section>`}
  </div>`;
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
    <div class="acoes">${podeEditar && html`<button class="btn primario" onClick=${() => setNova(true)}>+ Nova avaliação</button>`}
      ${(e.dados || []).length > 1 && html`<button class=${'btn' + (comparando ? ' on' : '')} onClick=${() => { setComparando(!comparando); setSel(comparando ? [] : (e.dados || []).slice(0, 2).map((x) => x.id)); }}>${comparando ? 'Fechar comparação' : 'Comparar avaliações'}</button>`}</div>
    <${Estado} e=${e}>${(lista) => {
      if (!lista.length) return html`<${ComoFunciona} titulo="Nenhuma avaliação ainda" passos=${[
        ['Registre a avaliação', 'Peso, altura, dobras (Pollock 3 ou 7), circunferências e diâmetros ósseos.'],
        ['A composição sai sozinha', '% de gordura, massa gorda, magra, óssea e muscular.'],
        ['Compare as datas', 'Escolha duas ou mais e veja as diferenças lado a lado.'],
        ['Acompanhe nos gráficos', 'Peso, gordura e massa magra ao longo do tempo.']]}/>`;
      const asc = lista.slice().reverse();
      return html`${asc.length > 1 && html`<${GraficosAvaliacao} lista=${asc} sexo=${aluna.sexo}/>`}
        ${comparando && html`<${ComparaAvaliacoes} lista=${asc.filter((x) => sel.includes(x.id))} sexo=${aluna.sexo}/>`}
        ${lista.map((a, i) => html`<div class=${comparando ? 'aval-sel' : ''}>
          ${comparando && html`<label class="toggle"><input type="checkbox" checked=${sel.includes(a.id)} onChange=${() => setSel(sel.includes(a.id) ? sel.filter((x) => x !== a.id) : [...sel, a.id])}/> Comparar ${dataBR(a.data)}</label>`}
          <${CartaoAvaliacao} a=${a} anterior=${lista[i + 1]} sexo=${aluna.sexo} podeEditar=${podeEditar} onApagar=${async () => { if (confirm('Apagar esta avaliação?')) { await api.del('avaliacoes', a.id); e.recarregar(); } }}/></div>`)}`;
    }}<//>
    ${nova && html`<${NovaAvaliacao} aluna=${aluna} onFechar=${() => setNova(false)} onSalvo=${() => { setNova(false); e.recarregar(); }}/>`}
  </div>`;
}

// linhas da comparação: [rótulo, função que lê o valor, unidade, casas]
const somaDobras = (a) => { const v = Object.values(a.dobras || {}).map(Number).filter((x) => !isNaN(x)); return v.length ? v.reduce((x, y) => x + y, 0) : null; };
function linhasComparacao(sexo) {
  const c = (k) => (a) => composicao(a, sexo)[k];
  return [['Peso', (a) => a.peso, 'kg', 1], ['% de gordura', (a) => a.percentual_gordura, '%', 1], ['Massa gorda', c('gorda'), 'kg', 1], ['Massa magra', c('magra'), 'kg', 1],
    ['Massa muscular', c('muscular'), 'kg', 1], ['Massa óssea', c('ossea'), 'kg', 1], ['IMC', c('imc'), '', 1], ['Relação cintura/quadril', c('rcq'), '', 2], ['Soma das dobras', somaDobras, 'mm', 0],
    ...MEDIDAS.map(([k, r]) => [r, (a) => (a.medidas || {})[k], 'cm', 1])];
}
function ComparaAvaliacoes({ lista, sexo }) {
  if (lista.length < 2) return html`<p class="nota">Marque pelo menos duas avaliações abaixo para comparar.</p>`;
  // soma de dobras só compara avaliações do mesmo protocolo
  const mesmoProtocolo = new Set(lista.map((a) => a.protocolo || 'jp7')).size === 1;
  const linhas = linhasComparacao(sexo).filter(([r, f]) => lista.some((a) => f(a) != null) && (mesmoProtocolo || r !== 'Soma das dobras'));
  return html`<section class="card"><h3>Comparação</h3><div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th></th>${lista.map((a) => html`<th>${dataBR(a.data)}</th>`)}<th>Diferença</th></tr></thead>
    <tbody>${linhas.map(([r, f, u, cs]) => { const v0 = f(lista[0]), v1 = f(lista[lista.length - 1]); const d = v0 != null && v1 != null ? Number(v1) - Number(v0) : null;
      return html`<tr><td>${r}</td>${lista.map((a) => html`<td>${f(a) != null ? `${num(f(a), cs)}${u ? ' ' + u : ''}` : '·'}</td>`)}
        <td class=${d == null || Math.abs(d) < 0.05 ? '' : d < 0 ? 'baixa' : 'alta'}>${d == null ? '·' : `${d > 0 ? '+' : ''}${num(d, cs)}${u ? ' ' + u : ''}`}</td></tr>`; })}</tbody></table></div></section>`;
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
    <div class="card-topo"><div><h3>${dataBR(a.data)}</h3><small>${a.protocolo === 'jp3' ? 'Pollock 3 dobras' : Object.keys(a.dobras || {}).length ? 'Pollock 7 dobras' : 'Sem dobras'}</small></div>
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
    ${Object.keys(a.medidas || {}).length > 0 && html`<dl class="grade-medidas">${MEDIDAS.filter(([k]) => (a.medidas || {})[k] != null).map(([k, r]) => html`<div><dt>${r}</dt><dd>${num(a.medidas[k], 1)} cm ${dif(a.medidas[k], anterior && (anterior.medidas || {})[k])}</dd></div>`)}</dl>`}
    ${a.obs && html`<p class="nota">${a.obs}</p>`}
  </section>`;
}

function NovaAvaliacao({ aluna, onFechar, onSalvo }) {
  const [f, setF] = useState({ data: hoje(), idade: idadeDe(aluna.nascimento) || '', peso: '', altura: '', obs: '' });
  const [protocolo, setProtocolo] = useState('jp7');
  const [dobras, setDobras] = useState({});
  const [medidas, setMedidas] = useState({});
  const [diametros, setDiametros] = useState({});
  const sexo = aluna.sexo === 'M' ? 'M' : 'F';
  const pct = protocolo === 'jp3' ? percentualJP3(dobras, lerNum(f.idade), sexo) : percentualJP7(dobras, lerNum(f.idade), sexo);
  const limpa = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, lerNum(v)]).filter(([, v]) => v != null));
  const previa = composicao({ peso: f.peso, altura: f.altura, percentual_gordura: pct, diametros: limpa(diametros), medidas: limpa(medidas) }, sexo);
  const campos = protocolo === 'jp3' ? DOBRAS.filter(([k]) => DOBRAS_JP3[sexo].includes(k)) : DOBRAS;
  const salvar = async (ev) => {
    ev.preventDefault();
    const dobrasUsadas = Object.fromEntries(Object.entries(limpa(dobras)).filter(([k]) => campos.some(([c]) => c === k)));
    const linha = { aluna_id: aluna.id, data: f.data, idade: lerNum(f.idade), peso: lerNum(f.peso), altura: lerNum(f.altura), dobras: dobrasUsadas, medidas: limpa(medidas), percentual_gordura: pct, obs: f.obs || null };
    if (protocolo !== 'jp7') linha.protocolo = protocolo;
    if (Object.keys(limpa(diametros)).length) linha.diametros = limpa(diametros);
    try { await api.ins('avaliacoes', linha); toast('Avaliação salva', 'ok'); onSalvo(); } catch (err) { toast(err.message, 'erro'); }
  };
  const inp = (obj, set, k) => html`<input class="input" inputmode="decimal" value=${obj[k] || ''} onInput=${(ev) => set({ ...obj, [k]: ev.target.value })}/>`;
  return html`<${Modal} titulo=${'Avaliação · ' + aluna.nome} onFechar=${onFechar} largo>
    <form class="pilha" onSubmit=${salvar}>
      <div class="grade2">
        <${Campo} rotulo="Data"><input class="input" type="date" value=${f.data} onInput=${(ev) => setF({ ...f, data: ev.target.value })}/><//>
        <${Campo} rotulo="Idade">${inp(f, setF, 'idade')}<//>
        <${Campo} rotulo="Peso (kg)">${inp(f, setF, 'peso')}<//>
        <${Campo} rotulo="Estatura (cm)">${inp(f, setF, 'altura')}<//>
      </div>
      <div class="card-topo"><h3>Dobras cutâneas (mm)</h3><div class="chips">${[['jp7', 'Pollock 7'], ['jp3', 'Pollock 3']].map(([k, r]) => html`<button type="button" class=${protocolo === k ? 'chip on' : 'chip'} onClick=${() => setProtocolo(k)}>${r}</button>`)}</div></div>
      <div class="grade2">${campos.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(dobras, setDobras, k)}<//>`)}</div>
      <h3>Circunferências (cm)</h3>
      <div class="grade2">${MEDIDAS.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(medidas, setMedidas, k)}<//>`)}</div>
      <h3>Diâmetros ósseos (cm) <small>opcional, para a massa óssea</small></h3>
      <div class="grade2">${DIAMETROS.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(diametros, setDiametros, k)}<//>`)}</div>
      <div class="destaque composicao">${pct != null ? html`<div><span>% de gordura</span><b>${num(pct, 1)}%</b></div>
          ${previa.gorda != null && html`<div><span>Massa gorda</span><b>${num(previa.gorda, 1)} kg</b></div>`}
          ${previa.magra != null && html`<div><span>Massa magra</span><b>${num(previa.magra, 1)} kg</b></div>`}
          ${previa.ossea != null && html`<div><span>Massa óssea</span><b>${num(previa.ossea, 1)} kg</b></div>`}
          ${previa.muscular != null && html`<div><span>Massa muscular</span><b>${num(previa.muscular, 1)} kg</b></div>`}`
        : html`<span>Preencha as ${protocolo === 'jp3' ? '3' : '7'} dobras, a idade e o peso para calcular a composição corporal.</span>`}</div>
      <${Campo} rotulo="Observações"><textarea class="input" rows="2" value=${f.obs} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
      <button class="btn primario grande">Salvar avaliação</button>
    </form><//>`;
}
