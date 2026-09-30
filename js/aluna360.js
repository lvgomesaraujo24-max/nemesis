// Visão 360 da aluna: formulários (atribuições e respostas com status), arquivos e feed de atividades.
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { ComoFunciona } from './comum.js';
import { ModalEnvio } from './formularios.js';
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

// [classe da tag, rótulo, detalhe]
function statusAtribuicao(a, envios) {
  const doForm = envios.filter((x) => x.formulario_id === a.formulario_id);
  if (!a.ativa) return ['', 'pausada', null];
  if (a.quando === 'recorrente') {
    const semana = doForm.find((x) => String(x.enviado_em).slice(0, 10) >= segundaDe());
    return semana ? ['ok', 'respondido esta semana', `em ${dataBR(semana.enviado_em)}`] : ['atencao', 'pendente esta semana', doForm[0] ? `última resposta ${relativo(doForm[0].enviado_em)}` : 'nunca respondeu'];
  }
  if (a.quando === 'programado' && a.agendado_para && new Date(a.agendado_para) > new Date()) return ['', 'agendado', `libera em ${dataBR(a.agendado_para)}`];
  const resp = doForm.find((x) => x.atribuicao_id === a.id) || doForm.find((x) => x.enviado_em >= a.created_at);
  if (resp) return ['ok', 'respondido', `em ${dataBR(resp.enviado_em)}`];
  const desde = String(a.agendado_para || a.created_at).slice(0, 10);
  return desde < somaDias(hoje(), -3) ? ['perigo', 'atrasado', `pendente desde ${dataBR(desde)}`] : ['atencao', 'pendente', `desde ${dataBR(desde)}`];
}

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
// ATIVIDADES (feed do que a aluna fez)
// ============================================================
const TIPOS_ATV = [['treino', 'Treinos', '◆'], ['checkin', 'Check-ins', '✓'], ['formulario', 'Formulários', '☰'], ['avaliacao', 'Avaliações', '◎'], ['plano', 'Plano', '$'], ['arquivo', 'Arquivos', '▣'], ['troca', 'Trocas de exercício', '⇄']];

export function AtividadesAluna({ aluna }) {
  const [ocultos, setOcultos] = useState(() => { try { return JSON.parse(localStorage.getItem('nemesis-atividades-ocultas')) || []; } catch (e) { return []; } });
  const [dias, setDias] = useState(30);
  const e = useCarregar(async () => {
    const desde = somaDias(hoje(), -dias);
    const ts = new Date(desde + 'T00:00:00').toISOString();
    const eq = { aluna_id: aluna.id };
    const pega = (t, o) => api.q(t, o).catch(() => []);
    const [sessoes, series, checkins, envios, forms, avals, ass, arqs, alertas] = await Promise.all([
      pega('sessoes', { eq, gte: { data: desde } }), pega('series', { eq, gte: { created_at: ts } }), pega('checkins', { eq, gte: { semana: somaDias(desde, -7) } }),
      pega('envios', { eq, gte: { enviado_em: ts } }), pega('formularios', {}), pega('avaliacoes', { eq, gte: { data: desde } }), pega('assinaturas', { eq }),
      pega('arquivos_aluna', { eq, gte: { created_at: ts } }), pega('alertas_coach', { eq, gte: { created_at: ts } })]);
    return { sessoes, series, checkins, envios, forms, avals, ass: ass.filter((x) => x.inicio >= desde), arqs, alertas: alertas.filter((x) => x.titulo === 'Troca de exercício') };
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
      d.avals.forEach((x) => itens.push({ tipo: 'avaliacao', quando: x.data, txt: 'Avaliação física', sub: [x.peso && `${num(x.peso, 1)} kg`, x.percentual_gordura != null && `${num(x.percentual_gordura, 1)}% de gordura`].filter(Boolean).join(' · ') }));
      d.ass.forEach((x) => itens.push({ tipo: 'plano', quando: x.inicio, txt: `Plano ${x.plano_nome || ''} começou`, sub: `até ${dataBR(x.fim)}` }));
      d.arqs.forEach((x) => itens.push({ tipo: 'arquivo', quando: x.created_at, txt: `Arquivo: ${x.nome}` }));
      d.alertas.forEach((x) => itens.push({ tipo: 'troca', quando: x.created_at, txt: x.texto }));
      const l = itens.filter((x) => !ocultos.includes(x.tipo)).sort((a, b) => (String(a.quando) < String(b.quando) ? 1 : -1));
      if (!l.length) return html`<div class="card vazio"><p>Nada nesse período.</p></div>`;
      const porDia = {}; l.forEach((x) => { const k = String(x.quando).slice(0, 10); (porDia[k] = porDia[k] || []).push(x); });
      return html`<div class="feed">${Object.entries(porDia).map(([dia, xs]) => html`<section class="feed-dia"><h4>${relativo(dia) === 'hoje' ? 'Hoje' : relativo(dia) === 'ontem' ? 'Ontem' : dataBR(dia)}</h4>
        ${xs.map((x) => html`<div class=${'feed-item ' + x.tipo}><span class="feed-ico">${(TIPOS_ATV.find(([k]) => k === x.tipo) || [])[2]}</span>
          <div><b>${x.txt}</b>${x.sub && html`<small>${x.sub}</small>`}</div>
          ${String(x.quando).length > 10 && html`<small class="feed-hora">${new Date(x.quando).toTimeString().slice(0, 5)}</small>`}</div>`)}</section>`)}</div>`;
    }}<//>
  </div>`;
}
