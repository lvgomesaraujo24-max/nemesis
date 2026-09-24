// DOSSIÊ DO COACH: notas privadas (só o treinador vê), com Quick Add pelo Selo.
// Nada daqui aparece para a aluna. Ninguém apaga: "desfazer" e "arquivar" só arquivam.
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Modal, Campo, Vazio, useCarregar, Estado, toast, dataBR, hoje, somaDias } from './util.js';

export const TAGS = [['lesao', 'Lesão / desconforto'], ['pausa', 'Pausa'], ['psicologia', 'Psicologia'], ['ajuste_rota', 'Ajuste de rota']];
const NOME_TAG = Object.fromEntries(TAGS);
const REG = [['joelho', 'Joelho'], ['lombar', 'Lombar'], ['quadril', 'Quadril'], ['ombro', 'Ombro'], ['cotovelo', 'Cotovelo'], ['punho', 'Punho'], ['tornozelo', 'Tornozelo'], ['outra', 'Outra']];
const MECANISMO = ['sobrecarga', 'impacto', 'torção', 'gesto específico', 'não sabe'];
const MOTIVOS = [['provas', 'Provas'], ['viagem', 'Viagem'], ['saude', 'Saúde'], ['saude_mental', 'Saúde mental'], ['trabalho', 'Trabalho'], ['outro', 'Outro']];
const MARCADORES = ['busca validação', 'baixa tolerância ao esforço', 'medo de carga', 'comparação com outras', 'motivação alta', 'desmotivação'];
const ULTIMO = 'nemesis-selo-ultimo';

// qualquer tela abre o Selo com dados pré-preenchidos
export const abrirSelo = (preset = {}) => window.dispatchEvent(new CustomEvent('nemesis-selo', { detail: preset }));

// ---------- botão flutuante + folha ----------
export function Selo({ alunaAtual }) {
  const [aberto, setAberto] = useState(null);
  const segurar = useRef(null);
  useEffect(() => {
    const f = (ev) => setAberto({ ...ev.detail });
    addEventListener('nemesis-selo', f);
    return () => removeEventListener('nemesis-selo', f);
  }, []);
  const abrir = () => setAberto(alunaAtual ? { aluna_id: alunaAtual.id, nome: alunaAtual.nome } : {});
  // pressionar e segurar: repete a última aluna e a última tag
  const inicio = () => { segurar.current = setTimeout(() => { segurar.current = 'longo'; let u = null; try { u = JSON.parse(localStorage.getItem(ULTIMO)); } catch (e) { /* */ } if (u) setAberto(u); else abrir(); }, 550); };
  const fim = () => { if (segurar.current === 'longo') { segurar.current = null; return; } clearTimeout(segurar.current); segurar.current = null; abrir(); };
  return html`
    <button class="selo" aria-label="Registrar no Dossiê (segure para repetir a última aluna)" onPointerDown=${inicio} onPointerUp=${fim} onPointerLeave=${() => { if (segurar.current && segurar.current !== 'longo') clearTimeout(segurar.current); }}
      onKeyDown=${(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), abrir())}>Ω</button>
    ${aberto && html`<${FolhaSelo} preset=${aberto} onFechar=${() => setAberto(null)}/>`}`;
}

function FolhaSelo({ preset, onFechar }) {
  const [aluna, setAluna] = useState(preset.aluna_id ? { id: preset.aluna_id, nome: preset.nome || '' } : null);
  const [tag, setTag] = useState(preset.tag || null);
  const [f, setF] = useState({ regiao: preset.regiao ? normReg(preset.regiao) : '', lado: '', dor_eva: null, mecanismo: '', motivo_pausa: '', retorno: '', marcadores: [], exercicio_id: '', quando: 'imediato', texto: preset.texto || '' });
  const [ocupado, setOcupado] = useState(false);
  const campoTexto = useRef();
  useEffect(() => { if (aluna && tag && campoTexto.current) campoTexto.current.focus(); }, [aluna, tag]);
  const chip = (k, v, r) => html`<button type="button" class=${f[k] === v ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, [k]: f[k] === v ? '' : v })}>${r || v}</button>`;

  const selar = async () => {
    if (!aluna || !tag) { toast('Escolha a aluna e a tag.', 'erro'); return; }
    if (!f.texto.trim()) { toast('Escreva uma frase (pode ditar).', 'erro'); return; }
    setOcupado(true);
    const linha = { aluna_id: aluna.id, tag, texto: f.texto.trim(), capturado_em: new Date().toISOString(), ocorrido_em: new Date().toISOString() };
    if (tag === 'lesao') Object.assign(linha, { regiao: f.regiao || null, lado: f.lado || null, dor_eva: f.dor_eva, mecanismo: f.mecanismo || null, situacao: 'ativa' });
    if (tag === 'pausa') Object.assign(linha, { motivo_pausa: f.motivo_pausa || null, pausa_inicio: hoje(), pausa_fim: f.retorno === '1' ? somaDias(hoje(), 7) : f.retorno === '2' ? somaDias(hoje(), 14) : null });
    if (tag === 'psicologia') linha.marcadores = f.marcadores;
    if (tag === 'ajuste_rota') Object.assign(linha, { exercicio_id: f.exercicio_id || null, marcadores: [f.quando === 'proximo' ? 'próximo ciclo' : 'imediato'] });
    try {
      const [n] = await api.ins('dossie', linha);
      try { localStorage.setItem(ULTIMO, JSON.stringify({ aluna_id: aluna.id, nome: aluna.nome, tag })); } catch (e) { /* */ }
      onFechar();
      const hora = new Date(n.registrado_em || Date.now()).toTimeString().slice(0, 5);
      toastDesfazer(`Selado às ${hora}`, async () => { await api.upd('dossie', n.id, { arquivada_em: new Date().toISOString() }); toast('Nota arquivada'); });
      window.dispatchEvent(new CustomEvent('nemesis-dossie'));
    } catch (e) { toast(e.message, 'erro'); setOcupado(false); }
  };

  return html`<${Modal} titulo="Selar no Dossiê" onFechar=${onFechar}><div class="pilha folha-selo">
    ${!aluna ? html`<${EscolherAluna} onEscolher=${setAluna}/>` : html`<div class="escolhido"><b>${aluna.nome || 'Aluna'}</b><button type="button" class="btn-texto" onClick=${() => setAluna(null)}>Trocar</button></div>`}
    ${aluna && html`<div class="tags-selo">${TAGS.map(([k, r]) => html`<button type="button" class=${'tag-selo' + (tag === k ? ' on' : '')} onClick=${() => setTag(k)}>${r}</button>`)}</div>`}
    ${aluna && tag === 'lesao' && html`<div class="pilha">
      <div class="chips">${REG.map(([k, r]) => chip('regiao', k, r))}</div>
      <div class="chips">${[['E', 'Esquerdo'], ['D', 'Direito'], ['bilateral', 'Bilateral']].map(([k, r]) => chip('lado', k, r))}</div>
      <${Campo} rotulo=${'Dor (0 a 10)' + (f.dor_eva != null ? ': ' + f.dor_eva : '')}><div class="regua">${[...Array(11)].map((_, i) => html`<button type="button" class=${f.dor_eva === i ? 'on' : ''} onClick=${() => setF({ ...f, dor_eva: f.dor_eva === i ? null : i })}>${i}</button>`)}</div><//>
      <div class="chips">${MECANISMO.map((m) => chip('mecanismo', m))}</div></div>`}
    ${aluna && tag === 'pausa' && html`<div class="pilha"><div class="chips">${MOTIVOS.map(([k, r]) => chip('motivo_pausa', k, r))}</div>
      <div class="chips">${[['1', '1 semana'], ['2', '2 semanas'], ['', 'Sem previsão']].map(([k, r]) => html`<button type="button" class=${f.retorno === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, retorno: k })}>${r}</button>`)}</div></div>`}
    ${aluna && tag === 'psicologia' && html`<div class="chips">${MARCADORES.map((m) => html`<button type="button" class=${f.marcadores.includes(m) ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, marcadores: f.marcadores.includes(m) ? f.marcadores.filter((x) => x !== m) : [...f.marcadores, m] })}>${m}</button>`)}</div>`}
    ${aluna && tag === 'ajuste_rota' && html`<${AjusteChips} aluna=${aluna} f=${f} setF=${setF}/>`}
    ${aluna && tag && html`<textarea class="input" rows="3" ref=${campoTexto} placeholder="Uma frase basta. Toque no microfone do teclado para ditar." value=${f.texto} onInput=${(ev) => setF({ ...f, texto: ev.target.value })}></textarea>
      <button class="btn primario grande" disabled=${ocupado} onClick=${selar}>${ocupado ? 'Selando…' : 'Selar'}</button>`}
  </div><//>`;
}
const normReg = (r) => { const s = String(r || '').toLowerCase(); const k = REG.find(([k]) => s.includes(k)); return k ? k[0] : 'outra'; };

function AjusteChips({ aluna, f, setF }) {
  const e = useCarregar(async () => {
    const [itens, ex] = await Promise.all([api.q('treino_itens', { eq: { aluna_id: aluna.id } }), api.q('exercicios', {})]);
    const ids = [...new Set(itens.map((i) => i.exercicio_id))];
    return ids.map((id) => ex.find((x) => x.id === id)).filter(Boolean);
  }, [aluna.id]);
  return html`<div class="pilha"><${Estado} e=${e}>${(lista) => html`<select class="input" value=${f.exercicio_id} onChange=${(ev) => setF({ ...f, exercicio_id: ev.target.value })}>
      <option value="">Exercício da ficha (opcional)</option>${lista.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}</select>`}<//>
    <div class="chips">${[['imediato', 'Imediato'], ['proximo', 'Próximo ciclo']].map(([k, r]) => html`<button type="button" class=${f.quando === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, quando: k })}>${r}</button>`)}</div></div>`;
}

// "Na arena agora" primeiro: sessão aberta ou treino nos últimos 90 min
function EscolherAluna({ onEscolher }) {
  const [busca, setBusca] = useState('');
  const e = useCarregar(async () => {
    const [alunas, sessoes] = await Promise.all([api.q('profiles', { eq: { role: 'student', ativo: true }, order: 'nome' }), api.q('sessoes', { gte: { data: somaDias(hoje(), -14) }, order: 'iniciada_em', asc: false })]);
    const limite = Date.now() - 90 * 60000;
    const arena = new Set(sessoes.filter((s) => (s.data === hoje() && !s.concluida_em) || new Date(s.concluida_em || s.iniciada_em).getTime() >= limite).map((s) => s.aluna_id));
    const recentes = [...new Set(sessoes.map((s) => s.aluna_id))].filter((id) => !arena.has(id)).slice(0, 5);
    return { alunas, arena: alunas.filter((a) => arena.has(a.id)), recentes: recentes.map((id) => alunas.find((a) => a.id === id)).filter(Boolean) };
  }, []);
  return html`<${Estado} e=${e}>${({ alunas, arena, recentes }) => {
    const achadas = busca ? alunas.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 8) : [];
    const botao = (a) => html`<button type="button" class="chip" onClick=${() => onEscolher({ id: a.id, nome: a.nome })}>${a.nome.split(' ').slice(0, 2).join(' ')}</button>`;
    return html`<div class="pilha">
      ${arena.length > 0 && html`<div><p class="rotulo">Na arena agora</p><div class="chips">${arena.map(botao)}</div></div>`}
      ${recentes.length > 0 && html`<div><p class="rotulo">Recentes</p><div class="chips">${recentes.map(botao)}</div></div>`}
      <input class="input" type="search" placeholder="Buscar aluna" value=${busca} onInput=${(ev) => setBusca(ev.target.value)}/>
      ${achadas.length > 0 && html`<div class="chips">${achadas.map(botao)}</div>`}
      ${!alunas.length && html`<p class="suave">Nenhuma aluna ativa.</p>`}</div>`;
  }}<//>`;
}

// toast com botão Desfazer (8 s)
function toastDesfazer(msg, desfazer) {
  const el = document.createElement('div'); el.className = 'toast-acao';
  el.innerHTML = `<span></span><button type="button">Desfazer</button>`; el.querySelector('span').textContent = msg;
  const tirar = () => el.remove();
  el.querySelector('button').onclick = async () => { tirar(); try { await desfazer(); } catch (e) { toast(e.message, 'erro'); } };
  document.body.appendChild(el); setTimeout(tirar, 8000);
}

// ---------- aba Dossiê da aluna ----------
export function DossieAluna({ aluna }) {
  const [arquivadas, setArquivadas] = useState(false);
  const e = useCarregar(async () => {
    const [notas, versoes, ex] = await Promise.all([api.q('dossie', { eq: { aluna_id: aluna.id }, order: 'registrado_em', asc: false }), api.q('dossie_versoes', { order: 'substituida_em' }), api.q('exercicios', {})]);
    return { notas, versoes, ex };
  }, [aluna.id]);
  useEffect(() => { const f = () => e.recarregar(); addEventListener('nemesis-dossie', f); return () => removeEventListener('nemesis-dossie', f); }, []);
  const [aberto, setAberto] = useState({});
  const [editar, setEditar] = useState(null);
  const [filtro, setFiltro] = useState('');
  return html`<div class="pilha">
    <div class="titulo-acoes"><p class="suave">Privado. A aluna nunca vê estas notas.</p><button class="btn primario" onClick=${() => abrirSelo({ aluna_id: aluna.id, nome: aluna.nome })}>Ω Nova nota</button></div>
    <div class="chips"><button class=${!filtro ? 'chip on' : 'chip'} onClick=${() => setFiltro('')}>Todas</button>${TAGS.map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r}</button>`)}</div>
    <${Estado} e=${e}>${({ notas, versoes, ex }) => {
      const l = notas.filter((n) => (arquivadas ? n.arquivada_em : !n.arquivada_em) && (!filtro || n.tag === filtro));
      const nArq = notas.filter((n) => n.arquivada_em).length;
      return html`${!l.length && html`<${Vazio} titulo=${arquivadas ? 'Nenhuma nota arquivada' : 'Dossiê vazio'} texto=${arquivadas ? '' : 'Toque no selo Ω (canto de baixo) para registrar em 10 segundos, de qualquer tela.'}/>`}
        ${l.map((n) => { const aberta = aberto[n.id]; const nv = versoes.filter((v) => v.nota_id === n.id).length;
          return html`<article class=${'tabuleta' + (aberta ? ' aberta' : '')}>
            <div class="card-topo"><span class=${'tag tag-' + n.tag}>${NOME_TAG[n.tag]}</span><code class="carimbo">${carimbo(n.registrado_em)}</code></div>
            <div class="tabuleta-texto" aria-hidden=${!aberta}>
              <p>${n.texto}</p>
              <small>${detalhes(n, ex)}</small>
            </div>
            ${!aberta ? html`<button class="btn mini" onClick=${() => setAberto({ ...aberto, [n.id]: true })}>Romper o selo</button>`
              : html`<div class="acoes"><button class="btn mini" onClick=${() => setEditar(n)}>Completar</button>
                ${n.tag === 'lesao' && n.situacao !== 'resolvida' && html`<button class="btn mini fantasma" onClick=${async () => { await api.upd('dossie', n.id, { situacao: n.situacao === 'ativa' ? 'monitorando' : 'resolvida' }); e.recarregar(); }}>${n.situacao === 'ativa' ? 'Monitorando' : 'Resolvida'}</button>`}
                <button class="btn mini fantasma" onClick=${async () => { await api.upd('dossie', n.id, { arquivada_em: n.arquivada_em ? null : new Date().toISOString() }); e.recarregar(); }}>${n.arquivada_em ? 'Desarquivar' : 'Arquivar'}</button>
                <button class="btn-texto" onClick=${() => setAberto({ ...aberto, [n.id]: false })}>Selar de novo</button>
                ${nv > 0 && html`<small>versão ${n.versao} · ${nv} anterior(es) guardada(s)</small>`}</div>`}
          </article>`; })}
        ${nArq > 0 && html`<button class="btn-texto" onClick=${() => setArquivadas(!arquivadas)}>${arquivadas ? 'Ver ativas' : `Ver arquivadas (${nArq})`}</button>`}
        ${editar && html`<${EditarNota} n=${editar} onFechar=${() => setEditar(null)} onFeito=${() => { setEditar(null); e.recarregar(); }}/>`}`;
    }}<//>
  </div>`;
}
const carimbo = (s) => { const d = new Date(s); return `${dataBR(s)} ${d.toTimeString().slice(0, 5)}`; };
function detalhes(n, ex) {
  const p = [];
  if (n.regiao) p.push(n.regiao + (n.lado ? ' ' + n.lado : ''));
  if (n.dor_eva != null) p.push(`dor ${n.dor_eva}/10`);
  if (n.mecanismo) p.push(n.mecanismo);
  if (n.situacao) p.push(n.situacao);
  if (n.motivo_pausa) p.push('motivo: ' + n.motivo_pausa);
  if (n.pausa_inicio) p.push(`pausa de ${dataBR(n.pausa_inicio)}${n.pausa_fim ? ' a ' + dataBR(n.pausa_fim) : ', sem previsão'}`);
  if (n.exercicio_id) p.push((ex.find((x) => x.id === n.exercicio_id) || {}).nome || 'exercício');
  if (n.marcadores && n.marcadores.length) p.push(n.marcadores.join(', '));
  return p.join(' · ');
}

function EditarNota({ n, onFechar, onFeito }) {
  const [f, setF] = useState({ texto: n.texto, pausa_fim: n.pausa_fim || '', dor_eva: n.dor_eva == null ? '' : String(n.dor_eva) });
  const salvar = async (ev) => {
    ev.preventDefault();
    const patch = { texto: f.texto.trim() };
    if (n.tag === 'pausa') patch.pausa_fim = f.pausa_fim || null;
    if (n.tag === 'lesao') patch.dor_eva = f.dor_eva === '' ? null : Math.max(0, Math.min(10, parseInt(f.dor_eva, 10) || 0));
    try { await api.upd('dossie', n.id, patch); toast('Nova versão selada', 'ok'); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  return html`<${Modal} titulo="Completar nota" onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <p class="suave">A edição vira uma versão nova. O carimbo original não muda.</p>
    <textarea class="input" rows="4" value=${f.texto} onInput=${(ev) => setF({ ...f, texto: ev.target.value })}></textarea>
    ${n.tag === 'pausa' && html`<${Campo} rotulo="Retorno"><input class="input" type="date" value=${f.pausa_fim} onInput=${(ev) => setF({ ...f, pausa_fim: ev.target.value })}/><//>`}
    ${n.tag === 'lesao' && html`<${Campo} rotulo="Dor atual (0 a 10)"><input class="input" inputmode="numeric" value=${f.dor_eva} onInput=${(ev) => setF({ ...f, dor_eva: ev.target.value })}/><//>`}
    <button class="btn primario grande">Salvar versão</button></form><//>`;
}
