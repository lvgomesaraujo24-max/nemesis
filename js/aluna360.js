// Visão 360 da aluna: formulários (atribuições e respostas com status), arquivos e Crônica (feed do que a aluna viveu).
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { ComoFunciona } from './comum.js';
import { ModalEnvio, statusAtribuicao } from './formularios.js';
import { useCarregar, Estado, Modal, Campo, Abas, toast, dataBR, hoje, somaDias, segundaDe, relativo, num } from './util.js';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ============================================================
// FORMULÁRIOS DA ALUNA
// ============================================================
export function FormulariosAluna({ aluna }) {
  const [aba, setAba] = useState('atribuicoes');
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState(null);
  const e = useCarregar(async () => {
    const [forms, atribs, envios] = await Promise.all([api.q('formularios', { order: 'titulo' }), api.q('atribuicoes', { order: 'created_at', asc: false }), api.q('envios', { eq: { aluna_id: aluna.id }, order: 'enviado_em', asc: false })]);
    return { forms, atribs: atribs.filter((a) => a.aluna_id === aluna.id || !a.aluna_id), envios };
  }, [aluna.id]);
  return html`<div class="pilha">
    <div class="titulo-acoes"><${Abas} abas=${[['atribuicoes', 'Atribuições'], ['respostas', 'Respostas']]} atual=${aba} onMuda=${setAba}/>
      <button class="btn primario" onClick=${() => setNovo(true)}>+ Atribuir formulário</button></div>
    <${Estado} e=${e}>${({ forms, atribs, envios }) => {
      const titulo = (id) => (forms.find((f) => f.id === id) || {}).titulo || 'Formulário';
      if (aba === 'respostas') return envios.length ? html`<div class="pilha">${envios.map((x) => html`<button class="card" onClick=${() => setAberto(x)}>
          <div class="card-topo"><div><h3>${titulo(x.formulario_id)}</h3><small>respondido ${dataBR(x.enviado_em)} · ${relativo(x.enviado_em)}</small></div>
            ${x.lido_em ? html`<span class="tag">lido</span>` : html`<span class="tag atencao">para ler</span>`}</div></button>`)}</div>`
        : html`<${ComoFunciona} titulo="Nenhuma resposta ainda" passos=${[['Atribua', 'Escolha o formulário e quando ela recebe.'], ['Ela responde no app', 'Pode exigir a resposta antes de liberar o app.'], ['Você lê aqui', 'Cada resposta fica guardada com a data.']]}/>`;
      if (!atribs.length) return html`<${ComoFunciona} titulo="Nada atribuído ainda" passos=${[['Atribua um formulário', 'Alistamento, check-in, feedback de treino ou o que você criar em Formulários.'],
        ['Escolha quando', 'Agora, numa data, ou toda semana.'], ['Acompanhe o status', 'Pendente ou respondido, sem precisar cobrar no WhatsApp.']]}/>`;
      return html`<div class="pilha">${atribs.map((a) => { const st = statusAtribuicao(a, envios);
        return html`<section class=${'card' + (a.ativa ? '' : ' apagado')}><div class="card-topo"><div><h3>${titulo(a.formulario_id)}</h3>
          <small>${a.aluna_id ? 'só para ela' : 'para todas as alunas'} · ${descQuando(a)}${a.bloqueia_app ? ' · bloqueia o app até responder' : ''}</small></div>
          <span class=${'tag ' + st[0]}>${st[1]}</span></div>
          ${st[2] && html`<small>${st[2]}</small>`}
          ${a.aluna_id && html`<div class="acoes"><button class="btn-texto" onClick=${async () => { try { await api.upd('atribuicoes', a.id, { ativa: !a.ativa }); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } }}>${a.ativa ? 'Pausar' : 'Reativar'}</button>
            <button class="btn-texto perigo" onClick=${async () => { if (confirm('Apagar esta atribuição?')) { try { await api.del('atribuicoes', a.id); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } } }}>Apagar</button></div>`}
        </section>`; })}</div>`;
    }}<//>
    ${novo && e.dados && html`<${ModalAtribuirAluna} aluna=${aluna} forms=${e.dados.forms} onFechar=${() => setNovo(false)} onFeito=${() => { setNovo(false); e.recarregar(); }}/>`}
    ${aberto && html`<${ModalEnvio} envio=${aberto} nome=${aluna.nome} onFechar=${() => { setAberto(null); e.recarregar(); }}/>`}
  </div>`;
}

const descQuando = (a) => (a.quando === 'recorrente' ? `toda ${((a.recorrencia || {}).dias_semana || []).map((x) => DIAS[x]).join(', ')}`
  : a.quando === 'programado' ? `em ${a.agendado_para ? dataBR(a.agendado_para) : '?'}` : `desde ${dataBR(a.created_at)}`);

function ModalAtribuirAluna({ aluna, forms, onFechar, onFeito }) {
  const [f, setF] = useState({ formulario_id: (forms[0] || {}).id || '', quando: 'agora', dias: [5], dia: hoje(), hora: '08:00', entrega: 'manual', bloqueia_app: false });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.formulario_id) { toast('Escolha o formulário.', 'erro'); return; }
    try {
      await api.ins('atribuicoes', { formulario_id: f.formulario_id, aluna_id: aluna.id, entrega: f.entrega, quando: f.quando, bloqueia_app: f.bloqueia_app, ativa: true,
        recorrencia: f.quando === 'recorrente' ? { dias_semana: f.dias } : null, agendado_para: f.quando === 'programado' ? new Date(`${f.dia}T${f.hora}:00`).toISOString() : null });
      toast('Formulário atribuído', 'ok'); onFeito();
    } catch (err) { toast(err.message, 'erro'); }
  };
  const chips = (k, ops) => html`<div class="chips">${ops.map(([v, r]) => html`<button type="button" class=${f[k] === v ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, [k]: v })}>${r}</button>`)}</div>`;
  if (!forms.length) return html`<${Modal} titulo="Atribuir formulário" onFechar=${onFechar}><p class="nota">Crie um formulário primeiro, em Formulários no menu.</p><//>`;
  return html`<${Modal} titulo=${'Atribuir para ' + aluna.nome} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Formulário"><select class="input" onChange=${(ev) => setF({ ...f, formulario_id: ev.target.value })}>${forms.map((x) => html`<option value=${x.id} selected=${f.formulario_id === x.id}>${x.titulo}</option>`)}</select><//>
    <${Campo} rotulo="Quando">${chips('quando', [['agora', 'Agora'], ['programado', 'Numa data'], ['recorrente', 'Toda semana']])}<//>
    ${f.quando === 'recorrente' && html`<div class="chips">${DIAS.map((r, i) => html`<button type="button" class=${f.dias.includes(i) ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, dias: f.dias.includes(i) ? f.dias.filter((x) => x !== i) : [...f.dias, i].sort() })}>${r}</button>`)}</div>`}
    ${f.quando === 'programado' && html`<div class="grade2"><${Campo} rotulo="Dia"><input class="input" type="date" value=${f.dia} onInput=${(ev) => setF({ ...f, dia: ev.target.value })}/><//>
      <${Campo} rotulo="Hora"><input class="input" type="time" value=${f.hora} onInput=${(ev) => setF({ ...f, hora: ev.target.value })}/><//></div>`}
    <${Campo} rotulo="Entrega">${chips('entrega', [['manual', 'Aparece no app'], ['fim_treino', 'Ao finalizar o treino']])}<//>
    <label class="toggle"><input type="checkbox" checked=${f.bloqueia_app} onChange=${(ev) => setF({ ...f, bloqueia_app: ev.target.checked })}/> Exigir resposta antes de usar o app</label>
    <button class="btn primario grande">Atribuir</button>
  </form><//>`;
}

// ============================================================
// ARQUIVOS DA ALUNA
// ============================================================
export const CATEGORIAS_ARQ = [['foto', 'Foto de evolução'], ['exame', 'Exame'], ['documento', 'Documento'], ['outro', 'Outro']];
const tamanho = (b) => (b >= 1048576 ? `${num(b / 1048576, 1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ArquivosAluna({ aluna, podeApagar = true }) {
  const e = useCarregar(() => api.q('arquivos_aluna', { eq: { aluna_id: aluna.id }, order: 'created_at', asc: false }), [aluna.id]);
  const [categoria, setCategoria] = useState('foto');
  const [filtro, setFiltro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviar = async (ev) => {
    const arquivos = [...(ev.target.files || [])]; ev.target.value = '';
    if (!arquivos.length) return;
    setEnviando(true);
    try {
      for (const a of arquivos) {
        if (a.size > 20 * 1024 * 1024) { toast(`${a.name} passa de 20 MB`, 'erro'); continue; }
        const caminho = `${aluna.id}/${Date.now()}-${a.name.normalize('NFD').replace(/[^\w.-]+/g, '_')}`;
        await api.subirArquivo(caminho, a);
        await api.ins('arquivos_aluna', { aluna_id: aluna.id, nome: a.name, caminho, tipo: a.type || null, categoria, tamanho: a.size });
      }
      toast('Arquivo(s) enviado(s)', 'ok'); e.recarregar();
    } catch (err) { toast(err.message, 'erro'); } finally { setEnviando(false); }
  };
  const abrir = async (x) => { try { const url = await api.linkArquivo(x.caminho); if (url) window.open(url, '_blank', 'noopener'); } catch (err) { toast(err.message, 'erro'); } };
  const apagar = async (x) => {
    if (!confirm(`Apagar "${x.nome}"?`)) return;
    try { await api.apagarArquivo(x.caminho); await api.del('arquivos_aluna', x.id); e.recarregar(); } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<div class="pilha">
    <section class="card envio-arquivo">
      <div class="chips">${CATEGORIAS_ARQ.map(([k, r]) => html`<button class=${categoria === k ? 'chip on' : 'chip'} onClick=${() => setCategoria(k)}>${r}</button>`)}</div>
      <label class=${'btn primario' + (enviando ? ' desativado' : '')}><${Icone} nome="mais" tam=${16}/>${enviando ? 'Enviando...' : 'Enviar arquivos'}
        <input type="file" multiple hidden disabled=${enviando} accept=${categoria === 'foto' ? 'image/*' : undefined} onChange=${enviar}/></label>
      <small>Fotos, exames e PDFs ficam guardados só para você e para a aluna. Até 20 MB por arquivo.</small>
    </section>
    <${Estado} e=${e}>${(lista) => {
      const l = filtro ? lista.filter((x) => x.categoria === filtro) : lista;
      if (!lista.length) return html`<${ComoFunciona} titulo="Nenhum arquivo ainda" passos=${[['Escolha a categoria', 'Foto de evolução, exame, documento ou outro.'], ['Envie', 'Do celular ou do computador, vários de uma vez.'], ['Use no relatório', 'As fotos ajudam no antes e depois do relatório de evolução.']]}/>`;
      return html`<div class="chips">${[['', 'Todos'], ...CATEGORIAS_ARQ].map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r} ${k ? `(${lista.filter((x) => x.categoria === k).length})` : ''}</button>`)}</div>
        <div class="arquivos-grade">${l.map((x) => html`<${CartaoArquivo} key=${x.id} x=${x} abrir=${() => abrir(x)} apagar=${podeApagar ? () => apagar(x) : null}/>`)}</div>`;
    }}<//>
  </div>`;
}

function CartaoArquivo({ x, abrir, apagar }) {
  const [url, setUrl] = useState(null);
  const imagem = /^image\//.test(x.tipo || '');
  useEffect(() => { if (imagem) api.linkArquivo(x.caminho).then(setUrl).catch(() => {}); }, [x.caminho]);
  return html`<div class="arquivo">
    <button class="arquivo-previa" onClick=${abrir} aria-label=${`Abrir ${x.nome}`}>${imagem && url ? html`<img src=${url} alt=${x.nome} loading="lazy"/>` : html`<span>${(x.nome.split('.').pop() || '').toUpperCase().slice(0, 4)}</span>`}</button>
    <div class="arquivo-info"><b title=${x.nome}>${x.nome}</b><small>${(CATEGORIAS_ARQ.find(([k]) => k === x.categoria) || [, 'Outro'])[1]} · ${dataBR(x.created_at)}${x.tamanho ? ' · ' + tamanho(x.tamanho) : ''}</small></div>
    ${apagar && html`<button class="icone perigo" aria-label=${`Apagar ${x.nome}`} onClick=${apagar}><${Icone} nome="lixeira" tam=${16}/></button>`}
  </div>`;
}

// ============================================================
// CRÔNICA (a estrada da aluna: cada pedra é um marco)
// ============================================================
const TIPOS_ATV = [['treino', 'Treinos', '◆'], ['recorde', 'Recordes', '▲'], ['ficha', 'Ficha', '✎'], ['checkin', 'Check-ins', '✓'], ['formulario', 'Formulários', '☰'],
  ['avaliacao', 'Avaliações', '◎'], ['meta', 'Metas', '★'], ['foto', 'Fotos', '◐'], ['plano', 'Plano', '$'], ['arquivo', 'Arquivos', '▣'], ['troca', 'Trocas de exercício', '⇄']];

export function AtividadesAluna({ aluna }) {
  const [ocultos, setOcultos] = useState(() => { try { return JSON.parse(localStorage.getItem('nemesis-atividades-ocultas')) || []; } catch (e) { return []; } });
  const [dias, setDias] = useState(30);
  const e = useCarregar(async () => {
    const desde = somaDias(hoje(), -dias);
    const ts = new Date(desde + 'T00:00:00').toISOString();
    const eq = { aluna_id: aluna.id };
    const pega = (t, o) => api.q(t, o).catch(() => []);
    const [sessoes, todas, checkins, envios, forms, avals, ass, arqs, alertas, treinos, mesos, metas, exercicios] = await Promise.all([
      pega('sessoes', { eq, gte: { data: desde } }), pega('series', { eq, order: 'created_at' }), pega('checkins', { eq, gte: { semana: somaDias(desde, -7) } }),
      pega('envios', { eq, gte: { enviado_em: ts } }), pega('formularios', {}), pega('avaliacoes', { eq, gte: { data: desde } }), pega('assinaturas', { eq }),
      pega('arquivos_aluna', { eq, gte: { created_at: ts } }), pega('alertas_coach', { eq, gte: { created_at: ts } }), pega('treinos', { eq }), pega('mesociclos', { eq }),
      pega('metas', { eq }), pega('exercicios', {})]);
    // recordes: série que passou a maior carga já feita naquele exercício (a primeira vez não conta)
    const melhor = {}, recs = [];
    todas.filter((x) => !x.aquecimento && x.carga != null).sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).forEach((x) => {
      const m = melhor[x.exercicio_id];
      if (m && (x.carga > m.carga || (x.carga === m.carga && (x.reps || 0) > (m.reps || 0))) && x.created_at >= ts) recs.push({ ...x, antes: m });
      if (!m || x.carga > m.carga || (x.carga === m.carga && (x.reps || 0) > (m.reps || 0))) melhor[x.exercicio_id] = x;
    });
    // um recorde por exercício por dia (o maior)
    const recDia = {}; recs.forEach((x) => { recDia[x.exercicio_id + String(x.created_at).slice(0, 10)] = x; });
    return { sessoes, series: todas.filter((x) => x.created_at >= ts), checkins, envios, forms, avals, ass: ass.filter((x) => x.inicio >= desde), arqs,
      alertas: alertas.filter((x) => x.titulo === 'Troca de exercício'), recs: Object.values(recDia), exercicios,
      treinos: treinos.filter((x) => String(x.created_at || '') >= ts), mesos: mesos.filter((x) => x.inicio >= desde), metas, desde };
  }, [aluna.id, dias]);
  const alterna = (k) => { const v = ocultos.includes(k) ? ocultos.filter((x) => x !== k) : [...ocultos, k]; setOcultos(v); try { localStorage.setItem('nemesis-atividades-ocultas', JSON.stringify(v)); } catch (err) { /* */ } };
  return html`<div class="pilha">
    <div class="camadas">${TIPOS_ATV.map(([k, r]) => html`<button class=${'camada' + (ocultos.includes(k) ? '' : ' on')} onClick=${() => alterna(k)}>${r}</button>`)}
      <select class="input curto" aria-label="Período" onChange=${(ev) => setDias(+ev.target.value)}>${[[7, '7 dias'], [30, '30 dias'], [90, '90 dias']].map(([v, r]) => html`<option value=${v} selected=${dias === v}>${r}</option>`)}</select></div>
    <${Estado} e=${e}>${(d) => {
      const itens = [];
      const temSerie = {}; d.series.forEach((x) => { temSerie[x.sessao_id] = (temSerie[x.sessao_id] || 0) + (x.aquecimento ? 0 : 1); });
      d.sessoes.filter((x) => x.concluida_em || temSerie[x.id]).forEach((x) => itens.push({ tipo: 'treino', quando: x.concluida_em || x.iniciada_em || x.data, txt: `Treinou ${x.treino_nome || ''}`,
        sub: [temSerie[x.id] && `${temSerie[x.id]} séries`, x.esforco && `esforço ${x.esforco}/10`, x.comentario].filter(Boolean).join(' · ') }));
      d.checkins.forEach((x) => itens.push({ tipo: 'checkin', quando: x.created_at || x.semana, txt: 'Mandou o check-in da semana', sub: [x.peso && `${num(x.peso, 1)} kg`, x.comentario].filter(Boolean).join(' · ') }));
      d.envios.forEach((x) => itens.push({ tipo: 'formulario', quando: x.enviado_em, txt: `Respondeu "${(d.forms.find((f) => f.id === x.formulario_id) || {}).titulo || 'formulário'}"` }));
      d.avals.forEach((x) => itens.push({ tipo: 'avaliacao', quando: x.data, marco: true, txt: x.autoavaliacao ? 'Autoavaliação (medidas e fotos)' : 'Avaliação física', sub: [x.peso && `${num(x.peso, 1)} kg`, x.percentual_gordura != null && `${num(x.percentual_gordura, 1)}% de gordura`].filter(Boolean).join(' · ') }));
      d.ass.forEach((x) => itens.push({ tipo: 'plano', quando: x.inicio, txt: `Plano ${x.plano_nome || ''} começou`, sub: `até ${dataBR(x.fim)}` }));
      const nomeEx = (id) => (d.exercicios.find((x) => x.id === id) || {}).nome || 'Exercício';
      // recordes do mesmo dia viram uma pedra só
      const recsDia = {}; d.recs.forEach((x) => { const k = String(x.created_at).slice(0, 10); (recsDia[k] = recsDia[k] || []).push(x); });
      Object.values(recsDia).forEach((xs) => itens.push(xs.length === 1
        ? { tipo: 'recorde', quando: xs[0].created_at, txt: `Recorde no ${nomeEx(xs[0].exercicio_id)}: ${num(xs[0].carga, 1)} kg × ${xs[0].reps || '·'}`, sub: `antes ${num(xs[0].antes.carga, 1)} kg × ${xs[0].antes.reps || '·'}` }
        : { tipo: 'recorde', quando: xs[xs.length - 1].created_at, txt: `${xs.length} recordes no treino`, sub: xs.map((x) => `${nomeEx(x.exercicio_id)} ${num(x.carga, 1)} kg × ${x.reps || '·'}`).join(' · ') }));
      const fichas = {}; d.treinos.forEach((x) => { const k = String(x.created_at).slice(0, 10); (fichas[k] = fichas[k] || []).push(x.nome); });
      Object.entries(fichas).forEach(([k, ns]) => itens.push({ tipo: 'ficha', quando: k, txt: ns.length > 1 ? 'Ficha nova' : `Treino novo: ${ns[0]}`, sub: ns.length > 1 ? ns.join(', ') : null, marco: ns.length > 1 }));
      d.mesos.forEach((x) => itens.push({ tipo: 'ficha', quando: x.inicio, txt: `Começou o mesociclo ${x.nome || ''}`.trim(), sub: `${dataBR(x.inicio)} a ${dataBR(x.fim)}`, marco: true }));
      d.metas.forEach((x) => {
        const t = x.titulo || { carga: `Carga no ${nomeEx(x.exercicio_id)}`, peso: 'Peso', gordura: '% de gordura', medida: x.medida || 'Medida', vo2: 'VO2' }[x.tipo] || 'Meta';
        if (String(x.created_at || '') >= d.desde) itens.push({ tipo: 'meta', quando: x.created_at, txt: `Nova meta: ${t}`, sub: x.valor_alvo != null ? `alvo ${num(x.valor_alvo, 1)}${x.prazo ? ' até ' + dataBR(x.prazo) : ''}` : null });
        if (x.concluida_em && x.concluida_em >= d.desde) itens.push({ tipo: 'meta', quando: x.concluida_em, txt: `Meta batida: ${t}`, marco: true });
      });
      const fotos = {}; d.arqs.filter((x) => x.categoria === 'foto').forEach((x) => { const k = String(x.created_at).slice(0, 10); fotos[k] = (fotos[k] || 0) + 1; });
      Object.entries(fotos).forEach(([k, n]) => itens.push({ tipo: 'foto', quando: k, txt: n > 1 ? `${n} fotos de progresso` : 'Foto de progresso' }));
      d.arqs.filter((x) => x.categoria !== 'foto').forEach((x) => itens.push({ tipo: 'arquivo', quando: x.created_at, txt: `Arquivo: ${x.nome}` }));
      d.alertas.forEach((x) => itens.push({ tipo: 'troca', quando: x.created_at, txt: x.texto }));
      const l = itens.filter((x) => !ocultos.includes(x.tipo)).sort((a, b) => (String(a.quando) < String(b.quando) ? 1 : -1));
      if (!l.length) return html`<div class="card vazio"><p>Nada nesse período.</p></div>`;
      const porDia = {}; l.forEach((x) => { const k = String(x.quando).slice(0, 10); (porDia[k] = porDia[k] || []).push(x); });
      const marcos = l.filter((x) => x.marco).length;
      return html`<div class="feed cronica">
        <p class="suave">${l.length} registro(s) nos últimos ${dias} dias${marcos ? ` · ${marcos} marco(s) na estrada` : ''}.</p>
        ${Object.entries(porDia).map(([dia, xs]) => html`<section class="feed-dia"><h4>${relativo(dia) === 'hoje' ? 'Hoje' : relativo(dia) === 'ontem' ? 'Ontem' : dataBR(dia)}</h4>
        ${xs.map((x) => html`<div class=${'feed-item ' + x.tipo + (x.marco ? ' marco' : '')}><span class="feed-ico">${(TIPOS_ATV.find(([k]) => k === x.tipo) || [])[2]}</span>
          <div><b>${x.txt}</b>${x.sub && html`<small>${x.sub}</small>`}</div>
          ${String(x.quando).length > 10 && html`<small class="feed-hora">${new Date(x.quando).toTimeString().slice(0, 5)}</small>`}</div>`)}</section>`)}</div>`;
    }}<//>
  </div>`;
}

// ============================================================
// VÍDEOS DE EXECUÇÃO (a aluna envia a série, o treinador corrige no app)
// ============================================================
export function VideosAluna({ aluna }) {
  const e = useCarregar(async () => {
    const [videos, exercicios] = await Promise.all([api.q('videos_execucao', { eq: { aluna_id: aluna.id }, order: 'created_at', asc: false }), api.q('exercicios', {})]);
    return { videos, exercicios };
  }, [aluna.id]);
  return html`<${Estado} e=${e}>${({ videos, exercicios }) => (videos.length
    ? html`<div class="pilha">${videos.map((v) => html`<${CartaoVideo} key=${v.id} v=${v} exNome=${(exercicios.find((x) => x.id === v.exercicio_id) || {}).nome || 'Exercício'} onFeito=${e.recarregar}/>`)}</div>`
    : html`<${ComoFunciona} titulo="Nenhum vídeo ainda" passos=${[['A aluna grava a série', 'No treino, em cada exercício, ela toca em "Enviar vídeo da série".'],
      ['Você assiste aqui', 'E também na fila do dia, na Acrópole.'], ['Devolve a correção', 'O texto aparece para ela no próprio exercício, no próximo treino.']]}/>`)}<//>`;
}

export function CartaoVideo({ v, exNome, alunaNome, onFeito }) {
  const [url, setUrl] = useState(null);
  const [txt, setTxt] = useState(v.correcao || '');
  const [salvando, setSalvando] = useState(false);
  const assistir = async () => { try { setUrl(await api.linkArquivo(v.caminho)); } catch (err) { toast(err.message, 'erro'); } };
  const corrigir = async () => {
    if (!txt.trim()) { toast('Escreva a correção.', 'erro'); return; }
    setSalvando(true);
    try { await api.upd('videos_execucao', v.id, { correcao: txt.trim(), corrigido_em: new Date().toISOString() }); toast('Correção enviada', 'ok'); onFeito && onFeito(); }
    catch (err) { toast(err.message, 'erro'); } finally { setSalvando(false); }
  };
  return html`<section class="card video-card">
    <div class="card-topo"><div><h3>${alunaNome ? `${alunaNome} · ` : ''}${exNome}</h3><small>enviado ${relativo(v.created_at)}</small></div>
      <span class=${'tag ' + (v.correcao ? 'ok' : 'atencao')}>${v.correcao ? 'corrigido' : 'para corrigir'}</span></div>
    ${v.comentario && html`<p class="nota">"${v.comentario}"</p>`}
    ${url ? html`<video class="video-exec" src=${url} controls playsinline preload="metadata"></video>` : html`<button class="btn" onClick=${assistir}><${Icone} nome="video" tam=${16}/>Assistir</button>`}
    <textarea class="input" rows="2" placeholder="Correção: o que manter, o que ajustar e a dica para a próxima série" value=${txt} onInput=${(ev) => setTxt(ev.target.value)}></textarea>
    <button class="btn primario" disabled=${salvando} onClick=${corrigir}>${v.correcao ? 'Atualizar correção' : 'Enviar correção'}</button>
  </section>`;
}
