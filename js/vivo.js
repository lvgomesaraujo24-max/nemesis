// FORMULÁRIO VIVO: renderiza o pacote do rpc montar_formulario.
// Cada toque só recalcula em memória; o servidor só é chamado no Enviar.
import { html, useState, useEffect, useMemo, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { avaliar, preencher, pegar, presente, REGIOES, nomeRegiao, RIR } from './motor.js';
import { Campo, Escala, Modal, toast, hoje, lerNum } from './util.js';

const RASCUNHO = (id) => 'nemesis-rascunho-' + id;
const lerRascunho = (id) => { try { return JSON.parse(localStorage.getItem(RASCUNHO(id))); } catch (e) { return null; } };
const gravarRascunho = (id, r) => { try { localStorage.setItem(RASCUNHO(id), JSON.stringify(r)); } catch (e) { /* */ } };
const apagarRascunho = (id) => { try { localStorage.removeItem(RASCUNHO(id)); } catch (e) { /* */ } };

// respostas derivadas que as regras usam (ex.: maior dor do mapa corporal)
function derivar(resp, perguntas) {
  const out = { ...resp };
  const mapa = perguntas.find((p) => p.tipo === 'mapa_corporal');
  if (mapa && Array.isArray(resp[mapa.chave]) && resp[mapa.chave].length) out.dores_max = Math.max(...resp[mapa.chave].map((d) => Number(d.intensidade) || 0));
  return out;
}

export function FormularioVivo({ pacote, atribuicaoId, previa, onEnviado }) {
  const form = pacote.formulario || {};
  const perguntas = pacote.perguntas || [];
  const ctx = pacote.ctx || {};
  const [resp, setResp] = useState(() => {
    const r = (!previa && lerRascunho(form.id)) || {};
    // valor padrão vindo do contexto (ex.: treinos que o app já registrou)
    for (const p of perguntas) {
      const pad = p.config && p.config.padrao;
      if (r[p.chave] == null && pad != null) { const v = typeof pad === 'string' && /^(ctx|aluna)\./.test(pad) ? pegar({ ctx, aluna: pacote.aluna }, pad) : pad; if (v != null) r[p.chave] = v; }
    }
    return r;
  });
  const [fechadas, setFechadas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const vistas = useRef(new Set());
  const resp2 = useMemo(() => derivar(resp, perguntas), [resp]);
  const fonte = useMemo(() => ({ resp: resp2, ctx, aluna: pacote.aluna || {} }), [resp2]);
  const visiveis = perguntas.filter((p) => avaliar(p.mostrar_se, fonte));
  const tituloDe = (p) => preencher(((p.titulo_variantes || []).find((v) => avaliar(v.quando, fonte)) || p).titulo, fonte);
  const cooldown = ctx.dicas_em_cooldown || [];
  const dicas = (pacote.dicas || []).filter((d) => !fechadas.includes(d.id) && !cooldown.includes(d.id) && avaliar(d.regra, fonte)).sort((x, y) => y.prioridade - x.prioridade);
  dicas.forEach((d) => vistas.current.add(d.id));
  const abertura = useMemo(() => (pacote.aberturas || []).filter((m) => avaliar(m.regra, fonte)).sort((x, y) => y.prioridade - x.prioridade)[0], []);
  useEffect(() => { if (previa) return; const t = setTimeout(() => gravarRascunho(form.id, resp), 800); return () => clearTimeout(t); }, [resp]);

  const muda = (chave, v) => setResp((r) => ({ ...r, [chave]: v }));
  const fechar = (id) => setFechadas((l) => [...l, id]);

  const enviar = async () => {
    const faltam = visiveis.filter((p) => p.obrigatoria && !presente(resp[p.chave]));
    if (faltam.length) { toast(`Falta responder: ${tituloDe(faltam[0])}`, 'erro'); const el = document.getElementById('p-' + faltam[0].chave); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (previa) { toast('Na prévia nada é enviado.'); return; }
    const envio = {}; visiveis.forEach((p) => { if (presente(resp[p.chave]) || resp[p.chave] === false) envio[p.chave] = resp[p.chave]; });
    if (resp2.dores_max != null) envio.dores_max = resp2.dores_max;
    setEnviando(true);
    try {
      await api.rpc('enviar_formulario', { p_formulario: form.id, p_versao: form.versao || 1, p_atribuicao: atribuicaoId || null, p_respostas: envio, p_dicas: [...vistas.current] });
      apagarRascunho(form.id); toast('Enviado ao Oráculo', 'ok'); onEnviado && onEnviado();
    } catch (e) { toast(e.message, 'erro'); setEnviando(false); }
  };

  return html`<div class="pilha vivo">
    ${form.descricao && html`<p class="suave">${form.descricao}</p>`}
    ${abertura && html`<div class="papiro abertura"><p>${preencher(abertura.texto, fonte)}</p></div>`}
    ${dicas.filter((d) => !d.pergunta_chave).slice(0, 1).map((d) => html`<${Papiro} d=${d} onFechar=${() => fechar(d.id)}/>`)}
    ${visiveis.map((p) => html`<div class="pergunta" id=${'p-' + p.chave} key=${p.id}>
      <${Pergunta} p=${p} titulo=${tituloDe(p)} valor=${resp[p.chave]} onMuda=${(v) => muda(p.chave, v)} ctx=${ctx}/>
      ${dicas.filter((d) => d.pergunta_chave === p.chave).slice(0, 2).map((d) => html`<${Papiro} d=${d} onFechar=${() => fechar(d.id)}/>`)}
    </div>`)}
    <button class="btn primario grande" disabled=${enviando} onClick=${enviar}>${previa ? 'Conferir obrigatórias (prévia)' : enviando ? 'Enviando…' : form.tipo === 'oraculo' ? 'Enviar ao Oráculo' : 'Enviar'}</button>
  </div>`;
}

function Papiro({ d, onFechar }) {
  return html`<aside class=${'papiro ' + d.severidade} role="note">
    <div class="card-topo"><b>${d.titulo}</b><button class="icone" aria-label="Fechar dica" onClick=${onFechar}>✕</button></div>
    <p>${d.texto}</p>${d.fonte && html`<a href=${d.fonte} target="_blank" rel="noopener">De onde vem isso?</a>`}</aside>`;
}

export function Pergunta({ p, titulo, valor, onMuda, ctx }) {
  const c = p.config || {};
  const rot = html`<span class="rotulo">${titulo}${p.obrigatoria ? '' : html` <small>(opcional)</small>`}</span>`;
  const ajuda = p.ajuda && html`<small>${p.ajuda}</small>`;
  switch (p.tipo) {
    case 'texto_curto': return html`<label class="campo">${rot}<input class="input" value=${valor || ''} onInput=${(e) => onMuda(e.target.value)}/>${ajuda}</label>`;
    case 'texto_longo': return html`<label class="campo">${rot}<textarea class="input" rows="3" value=${valor || ''} onInput=${(e) => onMuda(e.target.value)}></textarea>${ajuda}</label>`;
    case 'numero': return html`<label class="campo">${rot}<input class="input" inputmode="decimal" value=${valor == null ? '' : String(valor).replace('.', ',')} onInput=${(e) => onMuda(lerNum(e.target.value))}/>${ajuda}</label>`;
    case 'data': return html`<label class="campo">${rot}<input class="input" type="date" value=${valor || ''} onInput=${(e) => onMuda(e.target.value)}/>${ajuda}</label>`;
    case 'escala': return html`<div class="campo">${rot}<${Escala} valor=${valor} onMuda=${onMuda} min=${c.min != null ? c.min : 1} max=${c.max != null ? c.max : 5} rotulos=${c.ancoras}/>${ajuda}</div>`;
    case 'sim_nao': return html`<div class="campo">${rot}<div class="chips">${[[true, 'Sim'], [false, 'Não']].map(([v, r]) => html`<button type="button" class=${valor === v ? 'chip on' : 'chip'} onClick=${() => onMuda(v)}>${r}</button>`)}</div>${ajuda}</div>`;
    case 'multipla': {
      const val = (o) => (o.num != null ? o.num : o.valor);
      return html`<div class="campo">${rot}<div class="chips">${(p.opcoes || []).map((o) => html`<button type="button" class=${valor === val(o) ? 'chip on' : 'chip'} onClick=${() => onMuda(val(o))}>${o.rotulo || o.valor}</button>`)}</div>${ajuda}</div>`;
    }
    case 'caixas': {
      const l = Array.isArray(valor) ? valor : [];
      const alterna = (v) => { if (v === 'nenhum') return onMuda(l.includes('nenhum') ? [] : ['nenhum']); const s = l.filter((x) => x !== 'nenhum'); onMuda(s.includes(v) ? s.filter((x) => x !== v) : [...s, v]); };
      return html`<div class="campo">${rot}<div class="chips">${(p.opcoes || []).map((o) => html`<button type="button" class=${l.includes(o.valor) ? 'chip on' : 'chip'} onClick=${() => alterna(o.valor)}>${o.rotulo || o.valor}</button>`)}</div>${ajuda}</div>`;
    }
    case 'rir': return html`<div class="campo">${rot}<div class="rir">${RIR.map(([n, t]) => html`<button type="button" class=${valor === n ? 'on' : ''} onClick=${() => onMuda(n)}><b>${String(n).replace('.', ',')}</b><span>${t}</span></button>`)}</div>${ajuda}</div>`;
    case 'ciclo': return html`<${PerguntaCiclo} rot=${rot} valor=${valor} onMuda=${onMuda} ctx=${ctx}/>`;
    case 'mapa_corporal': return html`<${MapaCorporal} rot=${rot} valor=${valor} onMuda=${onMuda}/>`;
    default: return html`<label class="campo">${rot}<input class="input" value=${valor || ''} onInput=${(e) => onMuda(e.target.value)}/></label>`;
  }
}

function PerguntaCiclo({ rot, valor, onMuda, ctx }) {
  const v = valor || {};
  return html`<div class="campo">${rot}
    <div class="chips">${[[true, 'Sim'], [false, 'Não']].map(([k, r]) => html`<button type="button" class=${v.menstruou === k ? 'chip on' : 'chip'} onClick=${() => onMuda({ ...v, menstruou: k, inicio: k ? v.inicio || hoje() : null })}>${r}</button>`)}</div>
    ${v.menstruou && html`<label class="campo"><span class="rotulo">Primeiro dia da menstruação</span><input class="input" type="date" max=${hoje()} value=${v.inicio || ''} onInput=${(e) => onMuda({ ...v, inicio: e.target.value })}/></label>`}
    ${ctx && ctx.ciclo && ctx.ciclo.status === 'ok' && html`<small>Estimativa pelo calendário, aproximada.</small>`}</div>`;
}

// mapa corporal: lista de regiões (acessível e com área de toque grande); cada toque abre a régua de dor
const QUANDO = [['treino', 'Durante o treino'], ['repouso', 'Em repouso'], ['dia_seguinte', 'No dia seguinte']];
function MapaCorporal({ rot, valor, onMuda }) {
  const l = Array.isArray(valor) ? valor : [];
  const [editando, setEditando] = useState(null);
  const marca = (regiao, lado) => l.find((d) => d.regiao === regiao && (d.lado || 'centro') === (lado || 'centro'));
  const salvar = (item) => { const resto = l.filter((d) => !(d.regiao === item.regiao && (d.lado || 'centro') === (item.lado || 'centro'))); onMuda(item.intensidade == null ? resto : [...resto, item]); setEditando(null); };
  const cor = (i) => (i >= 7 ? 'forte' : i >= 4 ? 'media' : 'leve');
  return html`<div class="campo">${rot}
    <div class="mapa">${REGIOES.map(([k, nome, lados]) => html`<div class="mapa-linha"><span>${nome}</span><div class="mapa-botoes">
      ${(lados ? [['E', 'E'], ['D', 'D']] : [['centro', '·']]).map(([lado, r]) => { const m = marca(k, lado); return html`<button type="button" class=${'mapa-b' + (m ? ' ' + cor(m.intensidade) : '')}
        aria-label=${`${nomeRegiao(k, lado)}${m ? ', dor ' + m.intensidade : ''}`} onClick=${() => setEditando({ regiao: k, lado: lado === 'centro' ? null : lado, intensidade: m ? m.intensidade : null, quando: m ? m.quando || [] : [] })}>${m ? m.intensidade : r}</button>`; })}
    </div></div>`)}</div>
    ${l.length > 0 && html`<ul class="mapa-resumo">${l.map((d) => html`<li>${nomeRegiao(d.regiao, d.lado)} · ${d.intensidade}/10${d.quando && d.quando.length ? ' · ' + d.quando.map((q) => (QUANDO.find((x) => x[0] === q) || [0, q])[1].toLowerCase()).join(', ') : ''}</li>`)}</ul>`}
    ${editando && html`<${Modal} titulo=${nomeRegiao(editando.regiao, editando.lado)} onFechar=${() => setEditando(null)}><div class="pilha">
      <p class="rotulo">Intensidade da dor</p>
      <div class="regua">${[...Array(11)].map((_, i) => html`<button type="button" class=${editando.intensidade === i ? 'on' : ''} onClick=${() => setEditando({ ...editando, intensidade: i })}>${i}</button>`)}</div>
      <div class="escala-rot"><span>sem dor</span><span>pior dor que já senti</span></div>
      <p class="rotulo">Quando dói?</p>
      <div class="chips">${QUANDO.map(([k, r]) => html`<button type="button" class=${editando.quando.includes(k) ? 'chip on' : 'chip'} onClick=${() => setEditando({ ...editando, quando: editando.quando.includes(k) ? editando.quando.filter((x) => x !== k) : [...editando.quando, k] })}>${r}</button>`)}</div>
      <button class="btn primario grande" disabled=${editando.intensidade == null} onClick=${() => salvar(editando)}>Marcar</button>
      ${marca(editando.regiao, editando.lado || 'centro') && html`<button class="btn-texto perigo" onClick=${() => salvar({ ...editando, intensidade: null })}>Tirar marcação</button>`}
    </div><//>`}
  </div>`;
}

// ---------- pendências da aluna (calculadas no aparelho a partir das atribuições) ----------
const ultimaOcorrencia = (dias) => { for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (dias.includes(d.getDay())) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); } } return null; };
export async function pendenciasDaAluna(perfilId) {
  const [atribs, envios, forms, sessoes] = await Promise.all([
    api.q('atribuicoes', { eq: { ativa: true } }), api.q('envios', { eq: { aluna_id: perfilId }, order: 'enviado_em', asc: false }),
    api.q('formularios', { eq: { ativo: true } }), api.q('sessoes', { eq: { aluna_id: perfilId, data: hoje() } }),
  ]);
  const out = [];
  for (const a of atribs) {
    if (a.aluna_id && a.aluna_id !== perfilId) continue;
    const f = forms.find((x) => x.id === a.formulario_id); if (!f) continue;
    const doForm = envios.filter((e) => e.formulario_id === f.id);
    let desde = null;
    if (a.quando === 'agora') desde = a.created_at;
    else if (a.quando === 'programado') { if (!a.agendado_para || new Date(a.agendado_para) > new Date()) continue; desde = a.agendado_para; }
    else { const dias = (a.recorrencia && a.recorrencia.dias_semana) || []; const d = ultimaOcorrencia(dias); if (!d) continue; desde = d + 'T00:00:00'; }
    if (a.entrega === 'fim_treino') { const s = sessoes.find((x) => x.concluida_em); if (!s) continue; if (new Date(s.concluida_em) > new Date(desde)) desde = s.concluida_em; }
    const respondido = a.quando === 'recorrente' || a.entrega === 'fim_treino' ? doForm.some((e) => new Date(e.enviado_em) >= new Date(desde)) : doForm.some((e) => e.atribuicao_id === a.id);
    if (!respondido && !out.some((o) => o.formulario.id === f.id)) out.push({ atribuicao: a, formulario: f });
  }
  return out;
}

// tela que carrega o pacote e mostra o formulário
export function ResponderFormulario({ formularioId, atribuicaoId, alunaPrevia, previa, onEnviado }) {
  const [pacote, setPacote] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => { setPacote(null); api.rpc('montar_formulario', alunaPrevia ? { p_formulario: formularioId, p_aluna: alunaPrevia } : { p_formulario: formularioId }).then(setPacote).catch((e) => setErro(e.message)); }, [formularioId, alunaPrevia]);
  if (erro) return html`<div class="card vazio"><p>Não consegui abrir o formulário: ${erro}</p></div>`;
  if (!pacote) return html`<div class="carregando"><span class="spin"></span></div>`;
  return html`<${FormularioVivo} pacote=${pacote} atribuicaoId=${atribuicaoId} previa=${previa} onEnviado=${onEnviado}/>`;
}
