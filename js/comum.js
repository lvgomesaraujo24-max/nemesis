// Telas usadas pelos dois lados (treinador e aluna)
import { html, useState, useMemo } from '../lib/preact-htm.js';
import { api } from './api.js';
import { useCarregar, Estado, Vazio, Linha, Modal, Campo, toast, num, dataBR, dataCurta, hoje, lerNum, tonelagem,
  recordes, sequenciaSemanas, equivalencia, DOBRAS, MEDIDAS, percentualJP7, idadeDe, relativo } from './util.js';

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

    <section class="card">
      <div class="card-topo"><h3>Recordes</h3><span class="tag">${recs.length}</span></div>
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
  if (!r) return html`<${Vazio} titulo="Anamnese não preenchida" texto="A aluna preenche no primeiro acesso ao app (ou depois, em Perfil)."/>`;
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
  return html`<div class="pilha">
    ${podeEditar && html`<button class="btn primario" onClick=${() => setNova(true)}>+ Nova avaliação</button>`}
    <${Estado} e=${e}>${(lista) => (lista.length ? lista.map((a, i) => html`<${CartaoAvaliacao} a=${a} anterior=${lista[i + 1]} podeEditar=${podeEditar} onApagar=${async () => { if (confirm('Apagar esta avaliação?')) { await api.del('avaliacoes', a.id); e.recarregar(); } }}/>`)
      : html`<${Vazio} titulo="Nenhuma avaliação ainda" texto=${podeEditar ? 'Registre dobras e medidas para acompanhar a composição corporal.' : 'Seu treinador registra as avaliações aqui.'}/>`)}<//>
    ${nova && html`<${NovaAvaliacao} aluna=${aluna} onFechar=${() => setNova(false)} onSalvo=${() => { setNova(false); e.recarregar(); }}/>`}
  </div>`;
}

function CartaoAvaliacao({ a, anterior, podeEditar, onApagar }) {
  const dif = (k, obj) => { if (!anterior) return null; const v = obj === 'm' ? (a.medidas || {})[k] : a[k]; const p = obj === 'm' ? (anterior.medidas || {})[k] : anterior[k]; if (v == null || p == null) return null; const d = v - p; return d === 0 ? null : html`<small class=${d < 0 ? 'baixa' : 'alta'}>${d > 0 ? '+' : ''}${num(d, 1)}</small>`; };
  return html`<section class="card">
    <div class="card-topo"><h3>${dataBR(a.data)}</h3>${podeEditar && html`<button class="btn-texto perigo" onClick=${onApagar}>Apagar</button>`}</div>
    <div class="stats">
      <div class="stat"><b>${num(a.peso, 1)} kg</b><span>peso ${dif('peso')}</span></div>
      <div class="stat"><b>${a.percentual_gordura != null ? num(a.percentual_gordura, 1) + '%' : '·'}</b><span>gordura ${dif('percentual_gordura')}</span></div>
      ${a.peso && a.percentual_gordura != null ? html`<div class="stat"><b>${num(a.peso * (1 - a.percentual_gordura / 100), 1)} kg</b><span>massa magra</span></div>` : null}
      ${a.peso && a.altura ? html`<div class="stat"><b>${num(a.peso / (a.altura / 100) ** 2, 1)}</b><span>IMC</span></div>` : null}
    </div>
    ${Object.keys(a.medidas || {}).length > 0 && html`<dl class="grade-medidas">${MEDIDAS.filter(([k]) => (a.medidas || {})[k] != null).map(([k, r]) => html`<div><dt>${r}</dt><dd>${num(a.medidas[k], 1)} cm ${dif(k, 'm')}</dd></div>`)}</dl>`}
    ${a.obs && html`<p class="nota">${a.obs}</p>`}
  </section>`;
}

function NovaAvaliacao({ aluna, onFechar, onSalvo }) {
  const [f, setF] = useState({ data: hoje(), idade: idadeDe(aluna.nascimento) || '', peso: '', altura: '', obs: '' });
  const [dobras, setDobras] = useState({});
  const [medidas, setMedidas] = useState({});
  const pct = percentualJP7(dobras, lerNum(f.idade), aluna.sexo);
  const salvar = async (ev) => {
    ev.preventDefault();
    const limpa = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, lerNum(v)]).filter(([, v]) => v != null));
    try {
      await api.ins('avaliacoes', { aluna_id: aluna.id, data: f.data, idade: lerNum(f.idade), peso: lerNum(f.peso), altura: lerNum(f.altura), dobras: limpa(dobras), medidas: limpa(medidas), percentual_gordura: pct, obs: f.obs || null });
      toast('Avaliação salva', 'ok'); onSalvo();
    } catch (err) { toast(err.message, 'erro'); }
  };
  const inp = (obj, set, k) => html`<input class="input" inputmode="decimal" value=${obj[k] || ''} onInput=${(ev) => set({ ...obj, [k]: ev.target.value })}/>`;
  return html`<${Modal} titulo=${'Avaliação · ' + aluna.nome} onFechar=${onFechar} largo>
    <form class="pilha" onSubmit=${salvar}>
      <div class="grade2">
        <${Campo} rotulo="Data"><input class="input" type="date" value=${f.data} onInput=${(ev) => setF({ ...f, data: ev.target.value })}/><//>
        <${Campo} rotulo="Idade">${inp(f, setF, 'idade')}<//>
        <${Campo} rotulo="Peso (kg)">${inp(f, setF, 'peso')}<//>
        <${Campo} rotulo="Altura (cm)">${inp(f, setF, 'altura')}<//>
      </div>
      <h3>Dobras cutâneas (mm) · Jackson & Pollock 7</h3>
      <div class="grade2">${DOBRAS.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(dobras, setDobras, k)}<//>`)}</div>
      <div class="destaque">${pct != null ? html`<span>% de gordura estimado</span><b>${num(pct, 1)}%</b>` : html`<span>Preencha as 7 dobras e a idade para calcular o % de gordura.</span>`}</div>
      <h3>Circunferências (cm)</h3>
      <div class="grade2">${MEDIDAS.map(([k, r]) => html`<${Campo} rotulo=${r}>${inp(medidas, setMedidas, k)}<//>`)}</div>
      <${Campo} rotulo="Observações"><textarea class="input" rows="2" value=${f.obs} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
      <button class="btn primario grande">Salvar avaliação</button>
    </form><//>`;
}
