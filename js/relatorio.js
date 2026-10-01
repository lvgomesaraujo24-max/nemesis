// Relatório de evolução (mensal, por ficha ou por período livre).
// O treinador gera, baixa em PDF (imprimir > salvar como PDF) e manda para a aluna.
// A aluna vê o mesmo relatório no app, em Evolução.
// As páginas além dos números do período (deusa, visão macro, comparativo...) estão em relatorio-paginas.js.
import { html, useState, useMemo, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { useCarregar, Estado, Vazio, Campo, toast, num, dataBR, dataCurta, hoje, somaDias, diasEntre, segundaDe, MEDIDAS_TODAS,
  tonelagem, linkWhats, copiar } from './util.js';
import { Cab, Rodape, Dado, Capa, Macro, Comparativo, MapaDoCorpo, BemEstar, MetasConquistas, Jornada, Missao, CardStories,
  deusaDe, proximoMeso, conquistas, fimDoMes, somaMesYM, mesDe } from './relatorio-paginas.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesLongo = (ym) => { const [y, m] = ym.split('-'); return `${MESES[+m - 1]} de ${y}`; };
const primeiro = (n) => (n || '').split(' ')[0] || '';
const pct = (v) => `${v > 0 ? '+' : ''}${num(v * 100, 0)}%`;
const serieTxt = (s) => (s ? `${num(s.carga, 1)}kg × ${s.reps || '·'}` : '·');
// força estimada (Epley). Acima de 12 reps a fórmula perde precisão, então limita.
const e1rm = (s) => (s.carga == null ? 0 : s.carga * (1 + Math.min(s.reps || 1, 12) / 30));

// ============================================================
// CÁLCULO (puro: recebe os dados, devolve as métricas do período)
// ============================================================
export function calcularRelatorio({ ini, fim, aluna, sessoes, series, exercicios, treinos, checkins, avaliacoes }) {
  const ate = fim < hoje() ? fim : hoje(); // período em andamento conta só até hoje
  const diasConsiderados = Math.max(1, diasEntre(ini, ate) + 1);
  const semanas = Math.max(1, Math.round(diasConsiderados / 7));
  const nomeEx = (id) => (exercicios.find((e) => e.id === id) || {}).nome || 'Exercício';
  const grupoEx = (id) => (exercicios.find((e) => e.id === id) || {}).grupo || 'Outros';

  const temSerie = new Set(series.map((s) => s.sessao_id));
  const todasFeitas = sessoes.filter((s) => s.concluida_em || temSerie.has(s.id)).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const feitas = todasFeitas.filter((s) => s.data >= ini && s.data <= fim);
  const idsFeitas = new Set(feitas.map((s) => s.id));
  const dataSessao = {}; todasFeitas.forEach((s) => { dataSessao[s.id] = s.data; });
  const validas = series.filter((s) => !s.aquecimento && dataSessao[s.sessao_id]);
  const doPeriodo = validas.filter((s) => idsFeitas.has(s.sessao_id));

  // ---- frequência ----
  const obrig = treinos.filter((t) => t.ativo && !t.opcional);
  const alvo = aluna.treinos_semana_alvo || obrig.length || 3;
  const semanasGrade = [];
  for (let s = segundaDe(new Date(ini + 'T12:00:00')); s <= ate; s = somaDias(s, 7)) {
    const fimSem = somaDias(s, 6);
    const feitos = feitas.filter((x) => x.data >= s && x.data <= fimSem).length;
    // semana cortada pelo início/fim do período: meta proporcional aos dias que caem dentro
    const dentro = diasEntre(s < ini ? ini : s, fimSem > ate ? ate : fimSem) + 1;
    semanasGrade.push({ inicio: s < ini ? ini : s, feitos, meta: Math.max(1, Math.round((alvo * dentro) / 7)) });
  }
  // previstos = soma das metas semanais, para bater com a grade
  const previstos = Math.max(1, semanasGrade.reduce((t, s) => t + s.meta, 0));
  const aderencia = Math.min(1, feitas.length / previstos);
  const porTreino = obrig.map((t) => {
    const feitosT = feitas.filter((s) => s.treino_id === t.id).length;
    const esperado = Math.max(1, Math.round(previstos / obrig.length));
    return { nome: t.nome, feitos: feitosT, faltas: Math.max(0, esperado - feitosT), taxa: Math.min(1, feitosT / esperado) };
  });
  const extras = feitas.filter((s) => !obrig.some((t) => t.id === s.treino_id)).length;

  const duracoes = feitas.map((s) => (s.concluida_em && s.iniciada_em ? (new Date(s.concluida_em) - new Date(s.iniciada_em)) / 60000 : null))
    .filter((m) => m != null && m >= 5 && m <= 300);
  const duracaoMedia = duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null;
  const esforcos = feitas.map((s) => s.esforco).filter((v) => v != null);
  const esforcoMedio = esforcos.length ? esforcos.reduce((a, b) => a + b, 0) / esforcos.length : null;

  // ---- volume ----
  const volume = tonelagem(doPeriodo);
  const seriesEfetivas = doPeriodo.length;
  const porGrupo = {};
  doPeriodo.forEach((s) => { const g = grupoEx(s.exercicio_id); porGrupo[g] = (porGrupo[g] || 0) + 1; });
  const grupos = Object.entries(porGrupo).map(([g, n]) => ({ g, n })).sort((a, b) => b.n - a.n);

  // ---- recordes: melhor série de cada sessão comparada com tudo que veio antes ----
  const melhorPorSessaoEx = {};
  validas.filter((s) => s.carga != null).forEach((s) => {
    const k = s.sessao_id + '|' + s.exercicio_id;
    const r = melhorPorSessaoEx[k];
    if (!r || s.carga > r.carga || (s.carga === r.carga && (s.reps || 0) > (r.reps || 0))) melhorPorSessaoEx[k] = s;
  });
  const cronologico = Object.values(melhorPorSessaoEx).sort((a, b) => {
    const da = dataSessao[a.sessao_id], db = dataSessao[b.sessao_id];
    return da < db ? -1 : da > db ? 1 : a.created_at < b.created_at ? -1 : 1;
  });
  const melhorAte = {};
  const recordes = [];
  const recordesTodos = []; // de todo o histórico (conquistas)
  cronologico.forEach((s) => {
    const r = melhorAte[s.exercicio_id];
    const bateu = r && (s.carga > r.carga || (s.carga === r.carga && (s.reps || 0) > (r.reps || 0)));
    if (bateu) recordesTodos.push({ ...s, data: dataSessao[s.sessao_id], nome: nomeEx(s.exercicio_id), antes: r });
    if (bateu && idsFeitas.has(s.sessao_id)) recordes.push({ ...s, data: dataSessao[s.sessao_id], nome: nomeEx(s.exercicio_id), antes: r });
    if (!r || bateu) melhorAte[s.exercicio_id] = s;
  });
  recordes.sort((a, b) => (a.data < b.data ? 1 : -1));

  // ---- força estimada: referência (última sessão antes do período, ou a primeira dentro) x melhor do período ----
  const forca = [];
  const exNoPeriodo = [...new Set(doPeriodo.filter((s) => s.carga != null).map((s) => s.exercicio_id))];
  exNoPeriodo.forEach((id) => {
    const doEx = cronologico.filter((s) => s.exercicio_id === id);
    const antes = doEx.filter((s) => dataSessao[s.sessao_id] < ini);
    const dentro = doEx.filter((s) => idsFeitas.has(s.sessao_id));
    const ref = antes.length ? antes[antes.length - 1] : dentro[0];
    const maiorPorE1 = (l) => l.reduce((m, s) => (e1rm(s) > e1rm(m) ? s : m), l[0]);
    // dentro da sessão, a melhor em força estimada pode não ser a de maior carga
    const melhoresDentro = dentro.map((m) => maiorPorE1(validas.filter((s) => s.sessao_id === m.sessao_id && s.exercicio_id === id && s.carga != null)));
    const refE = maiorPorE1(validas.filter((s) => s.sessao_id === ref.sessao_id && s.exercicio_id === id && s.carga != null));
    const melhor = maiorPorE1(melhoresDentro);
    const sessoesDoEx = antes.length ? dentro.length : dentro.length - 1;
    const ganho = e1rm(refE) > 0 ? e1rm(melhor) / e1rm(refE) - 1 : 0;
    forca.push({ id, nome: nomeEx(id), inicio: refE, melhor, ganho: sessoesDoEx > 0 ? ganho : null, sessoes: dentro.length });
  });
  forca.sort((a, b) => (b.ganho ?? -9) - (a.ganho ?? -9) || a.nome.localeCompare(b.nome));
  const destaques = forca.filter((f) => f.ganho > 0.005).slice(0, 5);

  // ---- corpo ----
  const pesos = [];
  checkins.forEach((c) => { if (c.peso != null) pesos.push({ data: c.semana, peso: Number(c.peso) }); });
  avaliacoes.forEach((a) => { if (a.peso != null) pesos.push({ data: a.data, peso: Number(a.peso) }); });
  pesos.sort((a, b) => (a.data < b.data ? -1 : 1));
  const pesosAteFim = pesos.filter((p) => p.data <= fim);
  const pesoAtual = pesosAteFim[pesosAteFim.length - 1] || null;
  const pesoRef = [...pesos.filter((p) => p.data < ini)].pop() || pesos.find((p) => p.data >= ini && p.data <= fim) || null;
  const pesosNoPeriodo = pesos.filter((p) => p.data >= ini && p.data <= fim);
  const avAteFim = avaliacoes.filter((a) => a.data <= fim).sort((a, b) => (a.data < b.data ? -1 : 1));
  const avAtual = avAteFim[avAteFim.length - 1] || null;
  const avAnterior = avAtual && avAtual.data >= ini ? avAteFim[avAteFim.length - 2] || null : null;

  // ---- bem-estar (check-ins da semana, escala 1 a 5) ----
  const chk = checkins.filter((c) => c.semana >= segundaDe(new Date(ini + 'T12:00:00')) && c.semana <= fim);
  const media = (k) => { const v = chk.map((c) => c[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const bemEstar = [['sono', 'Sono', true], ['energia', 'Energia', true], ['dieta', 'Alimentação', true], ['estresse', 'Estresse', false], ['fome', 'Fome', false], ['dor', 'Dor', false]]
    .map(([k, r, alto]) => ({ k, r, alto, v: media(k) })).filter((x) => x.v != null);

  return { ini, fim, ate, semanas, feitas, previstos, aderencia, alvo, semanasGrade, porTreino, extras, duracaoMedia, esforcoMedio,
    volume, seriesEfetivas, grupos, recordes, forca, destaques, pesoAtual, pesoRef, pesosNoPeriodo, avAtual, avAnterior,
    bemEstar, checkinsFeitos: chk.length, mediaSemanal: volume / semanas, exerciciosFeitos: exNoPeriodo.length,
    seriesPeriodo: doPeriodo, validas, dataSessao, todasFeitas, recordesTodos };
}

// ============================================================
// TELA
// ============================================================
export function Relatorio({ aluna, coachNome, podeEditar }) {
  const e = useCarregar(async () => {
    const opcional = (p) => p.catch(() => []); // tabela de atualização que o banco ainda não tem não derruba o relatório
    const [sessoes, series, exercicios, treinos, checkins, avaliacoes, anamnese, mesociclos, metas, dores, testes, notas, agenda, fotosAluna] = await Promise.all([
      api.q('sessoes', { eq: { aluna_id: aluna.id }, order: 'data' }),
      api.q('series', { eq: { aluna_id: aluna.id }, order: 'created_at' }),
      api.q('exercicios', { order: 'nome' }),
      api.q('treinos', { eq: { aluna_id: aluna.id }, order: 'ordem' }),
      api.q('checkins', { eq: { aluna_id: aluna.id }, order: 'semana' }),
      api.q('avaliacoes', { eq: { aluna_id: aluna.id }, order: 'data' }),
      api.um('anamneses', { aluna_id: aluna.id }).catch(() => null),
      opcional(api.q('mesociclos', { eq: { aluna_id: aluna.id }, order: 'inicio', asc: false })),
      opcional(api.q('metas', { eq: { aluna_id: aluna.id }, order: 'created_at' })),
      opcional(api.q('dor_relatos', { eq: { aluna_id: aluna.id }, order: 'created_at' })),
      opcional(api.q('testes_aerobicos', { eq: { aluna_id: aluna.id }, order: 'data' })),
      opcional(api.q('relatorio_notas', { eq: { aluna_id: aluna.id } })),
      podeEditar ? opcional(api.q('agenda', { eq: { aluna_id: aluna.id }, gte: { inicio: hoje() }, order: 'inicio' })) : [],
      opcional(api.q('arquivos_aluna', { eq: { aluna_id: aluna.id, categoria: 'foto' }, order: 'created_at' })),
    ]);
    return { sessoes, series, exercicios, treinos, checkins, avaliacoes, anamnese, mesociclos, metas, dores, testes, notas, agenda, fotosAluna };
  }, [aluna.id]);
  // key: trocar de aluna recomeça a tela (mês, rascunhos e notas não passam de uma para outra)
  return html`<${Estado} e=${e}>${(d) => html`<${RelatorioCorpo} key=${aluna.id} d=${d} aluna=${aluna} coachNome=${coachNome} podeEditar=${podeEditar}/>`}<//>`;
}

const FOCOS_VAZIOS = [{ titulo: '', alvo: '', texto: '' }, { titulo: '', alvo: '', texto: '' }, { titulo: '', alvo: '', texto: '' }];
const focosDe = (m) => FOCOS_VAZIOS.map((f, i) => ({ ...f, ...((Array.isArray(m) && m[i]) || {}) }));

function RelatorioCorpo({ d, aluna, coachNome, podeEditar }) {
  const ficha = d.mesociclos.find((m) => m.status === 'ativo') || d.mesociclos[0] || null;
  // até o dia 7, o mês que interessa é o que acabou de fechar
  const [modo, setModo] = useState('mes');
  const [ym, setYm] = useState(() => (Number(hoje().slice(8)) <= 7 ? somaMesYM(hoje().slice(0, 7), -1) : hoje().slice(0, 7)));
  const [livre, setLivre] = useState({ ini: somaDias(hoje(), -29), fim: hoje() });
  const [fotos, setFotos] = useState({ antes: null, depois: null, rotAntes: 'Início', rotDepois: 'Atual' });
  const [notas, setNotas] = useState(d.notas);
  const [rascunhos, setRascunhos] = useState({});
  const [salvando, setSalvando] = useState(false);

  // período atual, período anterior (mesmo tamanho) e os rótulos de cada página
  let ini, fim, periodo, tipo, chave, iniA, fimA, rotulo;
  const M = (s) => s.replace(/^./, (c) => c.toUpperCase());
  if (modo === 'ficha' && ficha) {
    ini = ficha.inicio; fim = ficha.fim; tipo = 'Ciclo'; chave = `ficha-${ficha.id}`;
    periodo = `${ficha.nome || 'Ficha'} · ${Math.max(1, Math.round((diasEntre(ini, fim) + 1) / 7))} semanas`;
    rotulo = { anterior: 'o anterior', comparativo: 'Este ciclo × anterior', diaADia: 'O ciclo, dia a dia', missao: 'Missão do próximo ciclo', card: `${dataCurta(ini)} a ${dataCurta(fim)}` };
  } else if (modo === 'livre') {
    ini = livre.ini <= livre.fim ? livre.ini : livre.fim; fim = livre.ini <= livre.fim ? livre.fim : livre.ini; tipo = 'Período'; chave = `${ini}_${fim}`;
    periodo = `${dataBR(ini)} a ${dataBR(fim)}`;
    rotulo = { anterior: 'o anterior', comparativo: 'Este período × anterior', diaADia: 'O período, dia a dia', missao: 'Missão do próximo período', card: `${dataCurta(ini)} a ${dataCurta(fim)}` };
  } else {
    ini = `${ym}-01`; fim = fimDoMes(ym); tipo = 'Mês'; chave = ym;
    periodo = `Relatório mensal · ${mesLongo(ym)}`;
    const antYm = somaMesYM(ym, -1), proxYm = somaMesYM(ym, 1);
    iniA = `${antYm}-01`; fimA = fimDoMes(antYm);
    rotulo = { anterior: mesDe(antYm), comparativo: `${M(mesDe(ym))} × ${M(mesDe(antYm))}`, diaADia: `${M(mesDe(ym))}, dia a dia`, missao: `Missão de ${M(mesDe(proxYm))}`, card: `${mesDe(ym)} · ${ym.slice(0, 4)}` };
  }
  if (!iniA) { const dias = diasEntre(ini, fim) + 1; iniA = somaDias(ini, -dias); fimA = somaDias(ini, -1); }

  const r = useMemo(() => calcularRelatorio({ ini, fim, aluna, ...d }), [ini, fim, d]);
  const ant = useMemo(() => calcularRelatorio({ ini: iniA, fim: fimA, aluna, ...d }), [iniA, fimA, d]);
  // mês a mês, dos últimos 12 meses até o fim do período (jornada e conquistas)
  const meses = useMemo(() => {
    if (!r.todasFeitas.length) return [];
    const ultimo = fim.slice(0, 7);
    let m = r.todasFeitas[0].data.slice(0, 7);
    if (somaMesYM(ultimo, -11) > m) m = somaMesYM(ultimo, -11);
    const l = [];
    for (; m <= ultimo; m = somaMesYM(m, 1)) l.push({ ym: m, ini: `${m}-01`, fim: fimDoMes(m), r: calcularRelatorio({ ini: `${m}-01`, fim: fimDoMes(m), aluna, ...d }) });
    return l;
  }, [fim, d]);
  const deusa = deusaDe(r);
  const objetivo = aluna.objetivo || (d.anamnese && d.anamnese.respostas && d.anamnese.respostas.objetivo) || '';

  // palavra do treinador e missão: ficam no banco, a aluna também vê
  const nota = notas.find((n) => n.chave === chave) || null;
  const legado = () => { try { return localStorage.getItem(`nemesis-rel-msg-${aluna.id}`) || ''; } catch (err) { return ''; } };
  const salvo = { mensagem: nota ? nota.mensagem || '' : podeEditar ? legado() : '', missao: focosDe(nota && nota.missao) };
  const atual = rascunhos[chave] || salvo;
  const pendente = !!rascunhos[chave];
  const editar = (patch) => setRascunhos({ ...rascunhos, [chave]: { ...atual, ...patch } });
  const editarFoco = (i, k, v) => editar({ missao: atual.missao.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  const salvarNota = async () => {
    setSalvando(true);
    try {
      const linha = { aluna_id: aluna.id, chave, mensagem: atual.mensagem.trim() || null, missao: atual.missao.filter((f) => f.titulo.trim() || f.texto.trim()), updated_at: new Date().toISOString() };
      const [salva] = await api.ups('relatorio_notas', linha, 'aluna_id,chave');
      setNotas([...notas.filter((n) => n.chave !== chave), salva || linha]);
      const { [chave]: _, ...resto } = rascunhos; setRascunhos(resto);
      toast('Salvo. A aluna vê no relatório dela.');
    } catch (err) { toast(err.message, 'erro'); }
    setSalvando(false);
  };
  useEffect(() => { if (!pendente) return undefined; const f = (ev) => { ev.preventDefault(); ev.returnValue = ''; }; addEventListener('beforeunload', f); return () => removeEventListener('beforeunload', f); }, [pendente]);

  // foto guardada em Arquivos (categoria foto de evolução)
  const usarFoto = (k) => async (ev) => {
    const x = (d.fotosAluna || []).find((f) => f.id === ev.target.value); if (!x) return;
    try { const url = await api.linkArquivo(x.caminho); setFotos((f) => ({ ...f, [k]: url, [k === 'antes' ? 'rotAntes' : 'rotDepois']: dataBR(x.created_at) })); }
    catch (err) { toast(err.message, 'erro'); }
  };
  const lerFoto = (k) => (ev) => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const leitor = new FileReader();
    leitor.onload = () => setFotos((x) => ({ ...x, [k]: leitor.result }));
    leitor.readAsDataURL(f);
  };
  const resumoTexto = () => {
    const linhas = [`Oi, ${primeiro(aluna.nome)}! Seu relatório de evolução (${modo === 'mes' ? mesLongo(ym) : periodo}) está pronto 💜`, '',
      `• Sua deusa do período: ${deusa.nome}, ${deusa.lema}`,
      `• ${r.feitas.length} treino(s) feitos · ${num(r.aderencia * 100, 0)}% de aderência`,
      `• ${num(r.volume / 1000, 1)} toneladas levantadas`,
      `• ${r.recordes.length} recorde(s) pessoal(is) de carga`];
    if (r.destaques[0]) linhas.push(`• Destaque: ${r.destaques[0].nome} com ${pct(r.destaques[0].ganho)} de força estimada`);
    if (r.pesoAtual && r.pesoRef && r.pesoAtual.data !== r.pesoRef.data) linhas.push(`• Peso: ${num(r.pesoRef.peso, 1)} → ${num(r.pesoAtual.peso, 1)} kg`);
    linhas.push('', 'O relatório completo está no app, em Evolução > Relatório. Te mando o PDF aqui também. A última página é um card para você postar nos Stories.');
    return linhas.join('\n');
  };
  const imprimir = () => { document.title = `Relatorio_Evolucao_${(aluna.nome || 'aluna').replace(/\s+/g, '_')}_${ini}`; window.print(); setTimeout(() => { document.title = 'Nemesis'; }, 1500); };

  return html`<div class="pilha">
    <section class="card relatorio-controles">
      <div class="chips">${[['mes', 'Mês'], ...(ficha ? [['ficha', 'Ficha atual']] : []), ['livre', 'Período livre']].map(([k, rot]) => html`<button type="button" class=${modo === k ? 'chip on' : 'chip'} onClick=${() => setModo(k)}>${rot}</button>`)}</div>
      ${modo === 'mes' && html`<div class="mes-nav"><button class="icone" aria-label="Mês anterior" onClick=${() => setYm(somaMesYM(ym, -1))}>‹</button><b>${mesLongo(ym).replace(/^./, (c) => c.toUpperCase())}</b><button class="icone" aria-label="Próximo mês" disabled=${ym >= hoje().slice(0, 7)} onClick=${() => setYm(somaMesYM(ym, 1))}>›</button></div>`}
      ${modo === 'ficha' && ficha && html`<p class="suave">${ficha.nome || 'Ficha'} · ${dataBR(ficha.inicio)} a ${dataBR(ficha.fim)}</p>`}
      ${modo === 'livre' && html`<div class="grade2">
        <${Campo} rotulo="De"><input class="input" type="date" value=${livre.ini} onInput=${(ev) => setLivre({ ...livre, ini: ev.target.value })}/><//>
        <${Campo} rotulo="Até"><input class="input" type="date" value=${livre.fim} onInput=${(ev) => setLivre({ ...livre, fim: ev.target.value })}/><//></div>`}
      ${podeEditar && html`<details class="rel-extras" open=${pendente}><summary>Palavra do treinador e missão${nota ? ' · salvas' : ''}</summary><div class="pilha">
        <${Campo} rotulo="Palavra do treinador" dica="Entra na página da missão. A aluna também vê, no app e no PDF."><textarea class="input" rows="4" value=${atual.mensagem} onInput=${(ev) => editar({ mensagem: ev.target.value })} placeholder="Ex.: Mês de muita consistência. No próximo, foco em subir a carga do stiff."></textarea><//>
        <p class="rotulo">${rotulo.missao}: até 3 focos</p>
        ${atual.missao.map((f, i) => html`<div class="rel-foco">
          <div class="grade2">
            <input class="input" aria-label=${`Foco ${i + 1}`} placeholder=${['Foco 1 · ex.: Búlgaro no Smith', 'Foco 2 · ex.: Proteger o sono', 'Foco 3 · ex.: Zero faltas'][i]} value=${f.titulo} onInput=${(ev) => editarFoco(i, 'titulo', ev.target.value)}/>
            <input class="input" aria-label=${`Alvo do foco ${i + 1}`} placeholder="Alvo · ex.: 12,5 → 15 kg" value=${f.alvo} onInput=${(ev) => editarFoco(i, 'alvo', ev.target.value)}/>
          </div>
          <textarea class="input" rows="2" aria-label=${`Por que o foco ${i + 1}`} placeholder="Por que esse foco (opcional)" value=${f.texto} onInput=${(ev) => editarFoco(i, 'texto', ev.target.value)}></textarea></div>`)}
        <button type="button" class="btn primario" disabled=${!pendente || salvando} onClick=${salvarNota}>${salvando ? 'Salvando…' : pendente ? 'Salvar palavra e missão' : 'Salvo'}</button>
      </div></details>`}
      ${podeEditar && html`<details class="rel-extras"><summary>Fotos antes e depois (opcional)</summary><div class="pilha">
        ${(d.fotosAluna || []).length > 0 && html`<div class="grade2">${['antes', 'depois'].map((k) => html`<${Campo} rotulo=${`Foto ${k} (dos arquivos dela)`}>
          <select class="input" onChange=${usarFoto(k)}><option value="">Escolher foto</option>${d.fotosAluna.map((x) => html`<option value=${x.id}>${dataBR(x.created_at)} · ${x.nome}</option>`)}</select><//>`)}</div>`}
        <div class="grade2">
          <${Campo} rotulo="Foto antes"><input class="input" type="file" accept="image/*" onChange=${lerFoto('antes')}/><//>
          <${Campo} rotulo="Foto depois"><input class="input" type="file" accept="image/*" onChange=${lerFoto('depois')}/><//>
          <${Campo} rotulo="Legenda antes"><input class="input" value=${fotos.rotAntes} onInput=${(ev) => setFotos({ ...fotos, rotAntes: ev.target.value })}/><//>
          <${Campo} rotulo="Legenda depois"><input class="input" value=${fotos.rotDepois} onInput=${(ev) => setFotos({ ...fotos, rotDepois: ev.target.value })}/><//>
        </div>
        <small>Fotos escolhidas do computador entram só no PDF gerado agora. As da aba Arquivos já ficam guardadas para a próxima vez.</small>
        ${(fotos.antes || fotos.depois) && html`<button type="button" class="btn-texto perigo" onClick=${() => setFotos({ ...fotos, antes: null, depois: null })}>Tirar fotos</button>`}
      </div></details>`}
      <div class="acoes">
        <button class="btn primario" onClick=${imprimir}>Baixar PDF</button>
        ${podeEditar && aluna.telefone && html`<a class="btn" target="_blank" rel="noopener" href=${linkWhats(aluna.telefone, resumoTexto())}>Mandar no WhatsApp</a>`}
        ${podeEditar && html`<button class="btn" onClick=${() => copiar(resumoTexto())}>Copiar resumo</button>`}
      </div>
      <small>${podeEditar ? 'No "Baixar PDF", escolha "Salvar como PDF" e anexe na conversa. A aluna também vê este relatório no app, em Evolução.' : 'No "Baixar PDF", escolha "Salvar como PDF". A última página é um card para postar nos Stories.'}</small>
    </section>

    ${!r.feitas.length && !r.pesosNoPeriodo.length
      ? html`<${Vazio} titulo="Nada registrado nesse período" texto="Escolha outro mês ou período para ver o relatório."/>`
      : html`<${Folhas} r=${r} ant=${ant} d=${d} meses=${meses} deusa=${deusa} aluna=${aluna} coachNome=${coachNome} periodo=${periodo} tipo=${tipo} rotulo=${rotulo}
          objetivo=${objetivo} nota=${podeEditar ? atual : salvo} fotos=${fotos} proxRelatorio=${modo === 'mes' ? fimDoMes(somaMesYM(ym, 1)) : null}/>`}
  </div>`;
}

// ============================================================
// FOLHAS (o que vai para o PDF)
// ============================================================
function Folhas({ r, ant, d, meses, deusa, aluna, coachNome, periodo, tipo, rotulo, objetivo, nota, fotos, proxRelatorio }) {
  const temFotos = fotos.antes || fotos.depois;
  let n = 1;
  const pag = () => String(++n).padStart(2, '0');
  const maxGanho = Math.max(0.01, ...r.destaques.map((f) => f.ganho));
  const maxGrupo = Math.max(1, ...r.grupos.map((g) => g.n));
  const obrigIds = new Set(d.treinos.filter((t) => t.ativo && !t.opcional).map((t) => t.id));
  const temBemEstar = r.checkinsFeitos > 0 || (d.dores || []).length > 0;
  const todas = conquistas(r, meses, d.avaliacoes);
  const desbloqueadas = todas.filter((c) => c.data && c.data >= r.ini);
  // missão: focos e palavra do treinador, as semanas do mesociclo que vem e as próximas datas
  const meso = proximoMeso(d.mesociclos, r.fim);
  const datas = [];
  const aval = (d.agenda || []).find((a) => a.tipo === 'avaliacao' && String(a.inicio).slice(0, 10) > r.fim);
  if (aval) datas.push(['Próxima avaliação', dataCurta(String(aval.inicio).slice(0, 10)), 'dobras e medidas']);
  const atual = d.mesociclos.find((m) => m.status === 'ativo');
  if (atual && atual.fim >= r.fim && diasEntre(r.fim, atual.fim) <= 60) datas.push(['Ficha nova', dataCurta(somaDias(atual.fim, 1)), 'o próximo bloco começa']);
  if (proxRelatorio) datas.push(['Próximo relatório', dataCurta(proxRelatorio), 'no fim do mês']);
  const focos = (nota.missao || []).filter((f) => f.titulo || f.texto);
  const temMissao = focos.length > 0 || !!nota.mensagem || meso.length > 0;
  const ctx = { r, ant, d, aluna };

  return html`<div class="relatorio-folhas">
    <${Capa} r=${r} aluna=${aluna} coachNome=${coachNome} periodo=${periodo} deusa=${deusa}/>
    <${Macro} ...${ctx} n=${pag()} tipo=${tipo} rotulo=${rotulo} objetivo=${objetivo} obrigIds=${obrigIds} desbloqueadas=${desbloqueadas}/>
    <${Comparativo} ...${ctx} n=${pag()} rotulo=${rotulo} objetivo=${objetivo}/>

    ${temFotos && html`<section class="folha">
      <${Cab} sobre="Comparativo" titulo="Antes e Depois"/>
      <div class="rf-fotos">
        ${[['antes', fotos.rotAntes], ['depois', fotos.rotDepois]].map(([k, rot]) => html`<figure>${fotos[k] ? html`<img src=${fotos[k]} alt=${rot}/>` : html`<div class="rf-foto-vazia">sem foto</div>`}<figcaption class=${k === 'depois' ? 'rf-acento' : ''}>${rot}</figcaption></figure>`)}
      </div>
      <${Rodape} aluna=${aluna} n=${pag()}/>
    </section>`}

    <section class="folha">
      <${Cab} sobre="Progressão" titulo="Carga e Força"/>
      <p class="rf-sobre">Ganho de força estimada <span class="rf-leve">referência × melhor marca do período</span></p>
      ${r.destaques.length ? html`<div class="rf-barras">${r.destaques.map((f, i) => html`<div class="rf-barra-linha" title=${`${f.nome}: ${pct(f.ganho)}`}>
        <span class="rf-barra-nome">${f.nome}</span>
        <span class="rf-barra-trilho"><i class=${i === 0 ? 'on' : ''} style=${`width:${Math.max(3, (f.ganho / maxGanho) * 100)}%`}></i></span>
        <b>${pct(f.ganho)}</b></div>`)}</div>`
      : html`<p class="rf-leve">Sem ganho de força para mostrar ainda.</p>`}
      <p class="rf-sobre">Todos os exercícios acompanhados</p>
      <table class="rf-tabela">
        <thead><tr><th>Exercício</th><th>Referência</th><th>Melhor</th><th>Força est.</th></tr></thead>
        <tbody>${r.forca.map((f) => html`<tr><td>${f.nome}</td><td>${serieTxt(f.inicio)}</td><td>${serieTxt(f.melhor)}</td>
          <td class=${f.ganho > 0.005 ? 'rf-acento' : 'rf-leve'}>${f.ganho == null ? 'primeira vez' : Math.abs(f.ganho) <= 0.005 ? 'sem variação' : pct(f.ganho)}</td></tr>`)}</tbody>
      </table>
      <p class="rf-leve rf-pe-nota">Força estimada pela fórmula de Epley (carga × reps). A referência é a última sessão antes do período ou, se não houver, a primeira dentro dele.</p>
      <${Rodape} aluna=${aluna} n=${pag()}/>
    </section>

    <section class="folha">
      <${Cab} sobre="Performance" titulo="Recordes e Volume"/>
      <div class="rf-grade3">
        <${Dado} rot="Volume total" val=${num(r.volume / 1000, 1)} sub="toneladas (carga × reps)" destaque/>
        <${Dado} rot="Média semanal" val=${num(r.mediaSemanal / 1000, 1)} sub="toneladas"/>
        <${Dado} rot="Exercícios" val=${r.exerciciosFeitos} sub=${`${r.seriesEfetivas} séries válidas`}/>
      </div>
      <p class="rf-sobre">Recordes pessoais de carga <span class="rf-leve">${r.recordes.length > 10 ? `10 mais recentes de ${r.recordes.length}` : `${r.recordes.length} no período`}</span></p>
      ${r.recordes.length ? html`<table class="rf-tabela">
        <thead><tr><th>Data</th><th>Exercício</th><th>Antes</th><th>Novo</th></tr></thead>
        <tbody>${r.recordes.slice(0, 10).map((x) => html`<tr><td class="rf-acento">${dataCurta(x.data)}</td><td>${x.nome}</td><td class="rf-leve">${serieTxt(x.antes)}</td><td><b>${serieTxt(x)}</b></td></tr>`)}</tbody></table>`
      : html`<p class="rf-leve">Nenhum recorde novo neste período.</p>`}
      <p class="rf-sobre">Séries válidas por grupamento</p>
      <div class="rf-barras">${r.grupos.map((g, i) => html`<div class="rf-barra-linha" title=${`${g.g}: ${g.n} séries`}>
        <span class="rf-barra-nome">${g.g}</span>
        <span class="rf-barra-trilho"><i class=${i < 2 ? 'on' : ''} style=${`width:${Math.max(3, (g.n / maxGrupo) * 100)}%`}></i></span>
        <b>${g.n}</b></div>`)}</div>
      <${Rodape} aluna=${aluna} n=${pag()}/>
    </section>

    <section class="folha">
      <${Cab} sobre="Constância" titulo="Frequência"/>
      <div class="rf-freq">
        <div><p class="rf-rot">Aderência</p><b class="rf-grande rf-acento">${num(r.aderencia * 100, 0)}%</b><small>${r.feitas.length} de ${r.previstos} treinos previstos (${r.alvo} por semana)</small></div>
        <div class="rf-semanas">${r.semanasGrade.map((s) => html`<div class="rf-semana" title=${`Semana de ${dataCurta(s.inicio)}: ${s.feitos} de ${s.meta}`}>
          <span>${dataCurta(s.inicio)}</span>
          <span class="rf-quadros">${[...Array(Math.max(s.meta, s.feitos))].map((_, i) => html`<i class=${i < s.feitos ? (i < s.meta ? 'feito' : 'feito extra') : 'falta'}></i>`)}</span></div>`)}
          <div class="rf-legenda"><span><i class="feito"></i>Realizado</span><span><i class="falta"></i>Falta</span><span><i class="feito extra"></i>Extra</span></div>
        </div>
      </div>
      ${r.porTreino.length > 0 && html`<p class="rf-sobre">Aderência por treino</p>
        <div class="rf-barras">${r.porTreino.map((t) => html`<div class="rf-barra-linha" title=${`${t.nome}: ${t.feitos} realizados`}>
          <span class="rf-barra-nome">${t.nome}<small>${t.feitos} realizado(s) · ${t.faltas} falta(s)</small></span>
          <span class="rf-barra-trilho fundo"><i class="on" style=${`width:${Math.max(2, t.taxa * 100)}%`}></i></span>
          <b>${num(t.taxa * 100, 0)}%</b></div>`)}</div>
        ${r.extras > 0 && html`<p class="rf-leve">+ ${r.extras} treino(s) opcional(is) ou fora da ficha atual.</p>`}`}
      <div class="rf-grade3">
        <${Dado} rot="Treinos realizados" val=${r.feitas.length} sub="no período"/>
        <${Dado} rot="Duração média" val=${r.duracaoMedia != null ? num(r.duracaoMedia, 0) : '·'} sub="min por sessão"/>
        <div class="rf-dado"><span class="rf-rot">Esforço médio (RPE)</span><b>${r.esforcoMedio != null ? num(r.esforcoMedio, 1) : '·'}</b>
          ${r.esforcoMedio != null && html`<span class="rf-rpe" title=${`${num(r.esforcoMedio, 1)} de 10`}>${[...Array(10)].map((_, i) => html`<i class=${i < Math.round(r.esforcoMedio) ? 'on' : ''}></i>`)}</span>`}</div>
      </div>
      <${Rodape} aluna=${aluna} n=${pag()}/>
    </section>

    ${r.seriesPeriodo.length > 0 && html`<${MapaDoCorpo} ...${ctx} n=${pag()} objetivo=${objetivo}/>`}
    ${temBemEstar && html`<${BemEstar} ...${ctx} n=${pag()}/>`}

    ${r.avAtual && html`<section class="folha">
      <${Cab} sobre="Composição corporal" titulo="Avaliação Física"/>
      <p class="rf-sobre">Medidas <span class="rf-leve">${r.avAnterior ? `${dataBR(r.avAnterior.data)} × ${dataBR(r.avAtual.data)}` : dataBR(r.avAtual.data)}</span></p>
      <table class="rf-tabela"><thead><tr><th>Medida</th>${r.avAnterior && html`<th>Antes</th>`}<th>Atual</th>${r.avAnterior && html`<th>Diferença</th>`}</tr></thead>
      <tbody>${[['peso', 'Peso', 'kg'], ['percentual_gordura', '% de gordura', '%'], ...MEDIDAS_TODAS.map(([k, rt]) => [k, rt, 'cm', true])]
        .map(([k, rot, un, med]) => { const v = (a) => (a ? (med ? (a.medidas || {})[k] : a[k]) : null); const at = v(r.avAtual), an = v(r.avAnterior);
          if (at == null || at === '') return null;
          const dif = an != null && an !== '' ? Number(at) - Number(an) : null;
          return html`<tr><td>${rot}</td>${r.avAnterior && html`<td class="rf-leve">${an != null && an !== '' ? `${num(an, 1)} ${un}` : '·'}</td>`}<td><b>${num(at, 1)} ${un}</b></td>
            ${r.avAnterior && html`<td>${dif == null ? '·' : `${dif > 0 ? '+' : ''}${num(dif, 1)} ${un}`}</td>`}</tr>`; })}</tbody></table>
      <${Rodape} aluna=${aluna} n=${pag()}/>
    </section>`}

    <${MetasConquistas} ...${ctx} n=${pag()} todas=${todas}/>
    ${meses.length >= 2 && html`<${Jornada} ...${ctx} n=${pag()} meses=${meses}/>`}
    ${temMissao && html`<${Missao} aluna=${aluna} n=${pag()} titulo=${rotulo.missao} missao=${focos} msg=${nota.mensagem} coachNome=${coachNome} meso=${meso} datas=${datas}/>`}
    <${CardStories} r=${r} aluna=${aluna} deusa=${deusa} rotuloPeriodo=${rotulo.card} assinatura=${(window.NEMESIS_CONFIG || {}).ASSINATURA || coachNome || ''}/>
  </div>`;
}
