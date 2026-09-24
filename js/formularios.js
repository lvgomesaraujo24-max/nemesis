// FORMULÁRIOS (treinador): construtor do Oráculo, do Alistamento e de formulários livres,
// dicas condicionais, mensagens de abertura, atribuições e respostas recebidas.
import { html, useState } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { descrever, OPERADORES } from './motor.js';
import { ResponderFormulario } from './vivo.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Abas, toast, dataBR, relativo } from './util.js';

const TIPOS_FORM = [['oraculo', 'Oráculo (check-in)'], ['alistamento', 'Alistamento (entrada)'], ['livre', 'Livre']];
const NOME_TIPO = Object.fromEntries(TIPOS_FORM);
const TIPOS_PERG = [['escala', 'Escala'], ['multipla', 'Múltipla escolha'], ['caixas', 'Caixas (várias)'], ['sim_nao', 'Sim ou não'], ['numero', 'Número'],
  ['texto_curto', 'Texto curto'], ['texto_longo', 'Texto longo'], ['data', 'Data'], ['mapa_corporal', 'Mapa corporal'], ['rir', 'Escala RIR'], ['ciclo', 'Registro do ciclo']];
const NOME_PERG = Object.fromEntries(TIPOS_PERG);
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const SEV = { info: 'info', atencao: 'atenção', alerta: 'alerta' };

export function Formularios({ id, aba, ir }) {
  if (DEMO) return html`<div class="pilha"><h1 class="titulo">Formulários</h1><${Vazio} titulo="Disponível com o banco ligado"/></div>`;
  if (id) return html`<${Editor} id=${id} aba=${aba || 'perguntas'} ir=${ir}/>`;
  return html`<${ListaFormularios} ir=${ir}/>`;
}

function ListaFormularios({ ir }) {
  const e = useCarregar(async () => {
    const [forms, perg, atribs, envios] = await Promise.all([api.q('formularios', { order: 'created_at' }), api.q('perguntas', {}), api.q('atribuicoes', {}), api.q('envios', { order: 'enviado_em', asc: false, limit: 500 })]);
    return { forms, perg, atribs, envios };
  }, []);
  const [novo, setNovo] = useState(false);
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Formulários</h1><button class="btn primario" onClick=${() => setNovo(true)}>+ Novo formulário</button></div>
    <p class="suave">O Oráculo é o check-in semanal; o Alistamento é o formulário de entrada. As regras rodam no celular da aluna, sem custo.</p>
    <${Estado} e=${e}>${({ forms, perg, atribs, envios }) => (forms.length ? forms.map((f) => {
      const np = perg.filter((p) => p.formulario_id === f.id).length; const na = atribs.filter((a) => a.formulario_id === f.id && a.ativa).length;
      const ne = envios.filter((x) => x.formulario_id === f.id); const naoLidos = f.tipo === 'oraculo' ? 0 : ne.filter((x) => !x.lido_em).length;
      return html`<button class="card form-card" onClick=${() => ir('formularios/' + f.id)}>
        <div class="card-topo"><div><h3>${f.titulo}</h3><small>${NOME_TIPO[f.tipo]} · ${np} pergunta(s) · versão ${f.versao}</small></div>
          <div class="treino-tags">${!f.ativo ? html`<span class="tag">inativo</span>` : na ? html`<span class="tag roxo">${na} atribuição(ões)</span>` : html`<span class="tag atencao">sem atribuição</span>`}
          ${naoLidos > 0 && html`<span class="tag atencao">${naoLidos} para ler</span>`}<span class="seta">›</span></div></div>
        <small>${ne.length} envio(s)${ne[0] ? ' · último ' + relativo(ne[0].enviado_em) : ''}</small></button>`;
    }) : html`<${Vazio} titulo="Nenhum formulário" texto="Rode a atualizacao-2.sql: ela cria o Oráculo padrão."/>`)}<//>
    ${novo && html`<${ModalFormulario} onFechar=${() => setNovo(false)} onFeito=${(f) => { setNovo(false); ir('formularios/' + f.id); }}/>`}
  </div>`;
}

function ModalFormulario({ form, onFechar, onFeito }) {
  const [f, setF] = useState({ tipo: form ? form.tipo : 'livre', titulo: form ? form.titulo : '', descricao: form ? form.descricao || '' : '', ativo: form ? form.ativo : true });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.titulo.trim()) { toast('Dê um título.', 'erro'); return; }
    try {
      const linha = { tipo: f.tipo, titulo: f.titulo.trim(), descricao: f.descricao || null, ativo: f.ativo };
      const [r] = form ? await api.upd('formularios', form.id, linha) : await api.ins('formularios', linha);
      onFeito(r);
    } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm(`Apagar "${form.titulo}"? As respostas recebidas por ele também são apagadas. Para só esconder, desmarque "Ativo".`)) return; try { await api.del('formularios', form.id); onFeito(null); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${form ? 'Editar formulário' : 'Novo formulário'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <div class="chips">${TIPOS_FORM.map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
    <${Campo} rotulo="Título"><input class="input" value=${f.titulo} onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    <${Campo} rotulo="Descrição (a aluna vê no topo)"><textarea class="input" rows="2" value=${f.descricao} onInput=${(ev) => setF({ ...f, descricao: ev.target.value })}></textarea><//>
    <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Ativo</label>
    <button class="btn primario grande">Salvar</button>
    ${form && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar formulário</button>`}
  </form><//>`;
}

const ABAS = [['perguntas', 'Perguntas'], ['dicas', 'Dicas'], ['aberturas', 'Aberturas'], ['atribuicoes', 'Atribuições'], ['respostas', 'Respostas'], ['previa', 'Prévia']];
function Editor({ id, aba, ir }) {
  const e = useCarregar(async () => {
    const [form, perguntas, dicas, aberturas, atribs, alunas] = await Promise.all([api.um('formularios', { id }), api.q('perguntas', { eq: { formulario_id: id }, order: 'ordem' }),
      api.q('dicas_condicionais', { eq: { formulario_id: id }, order: 'prioridade', asc: false }), api.q('mensagens_abertura', { eq: { formulario_id: id }, order: 'prioridade', asc: false }),
      api.q('atribuicoes', { eq: { formulario_id: id }, order: 'created_at' }), api.q('profiles', { eq: { role: 'student' }, order: 'nome' })]);
    return { form, perguntas, dicas, aberturas, atribs, alunas };
  }, [id]);
  const [editForm, setEditForm] = useState(false);
  return html`<${Estado} e=${e}>${(d) => (!d.form ? html`<${Vazio} titulo="Formulário não encontrado"/>` : html`<div class="pilha">
    <button class="btn-texto" onClick=${() => ir('formularios')}>‹ Formulários</button>
    <div class="titulo-acoes"><div><h1 class="titulo">${d.form.titulo}</h1><p class="suave">${NOME_TIPO[d.form.tipo]} · versão ${d.form.versao}${d.form.ativo ? '' : ' · inativo'}</p></div>
      <button class="btn" onClick=${() => setEditForm(true)}>Editar dados</button></div>
    <${Abas} abas=${ABAS} atual=${aba} onMuda=${(k) => ir(`formularios/${id}/${k}`)}/>
    ${aba === 'perguntas' && html`<${Perguntas} d=${d} recarregar=${e.recarregar}/>`}
    ${aba === 'dicas' && html`<${Dicas} d=${d} recarregar=${e.recarregar}/>`}
    ${aba === 'aberturas' && html`<${Aberturas} d=${d} recarregar=${e.recarregar}/>`}
    ${aba === 'atribuicoes' && html`<${Atribuicoes} d=${d} recarregar=${e.recarregar}/>`}
    ${aba === 'respostas' && html`<${Respostas} d=${d}/>`}
    ${aba === 'previa' && html`<${Previa} d=${d}/>`}
    ${editForm && html`<${ModalFormulario} form=${d.form} onFechar=${() => setEditForm(false)} onFeito=${(r) => { setEditForm(false); if (!r) ir('formularios'); else e.recarregar(); }}/>`}
  </div>`)}<//>`;
}

// editar um formulário publicado sobe a versão: envios antigos guardam a versão respondida
const subirVersao = (form) => api.upd('formularios', form.id, { versao: (form.versao || 1) + 1 });

// ---------- perguntas ----------
function Perguntas({ d, recarregar }) {
  const [modal, setModal] = useState(null);
  const mover = async (i, dir) => {
    const l = d.perguntas; const j = i + dir; if (j < 0 || j >= l.length) return;
    try { await api.upd('perguntas', l[i].id, { ordem: l[j].ordem }); await api.upd('perguntas', l[j].id, { ordem: l[i].ordem === l[j].ordem ? l[i].ordem + dir : l[i].ordem }); recarregar(); } catch (e) { toast(e.message, 'erro'); }
  };
  return html`<div class="pilha">
    <button class="btn primario" onClick=${() => setModal({})}>+ Pergunta</button>
    ${!d.perguntas.length && html`<${Vazio} titulo="Nenhuma pergunta ainda"/>`}
    <ol class="itens">${d.perguntas.map((p, i) => html`<li>
      <div class="item-info"><b>${p.titulo}</b><small>${NOME_PERG[p.tipo] || p.tipo} · chave <code>${p.chave}</code>${p.obrigatoria ? '' : ' · opcional'}${p.mostrar_se ? ' · aparece se ' + descrever(p.mostrar_se) : ''}${(p.titulo_variantes || []).length ? ` · ${p.titulo_variantes.length} título(s) vivo(s)` : ''}</small></div>
      <div class="mini-acoes"><button class="icone" aria-label="Subir" onClick=${() => mover(i, -1)}>↑</button><button class="icone" aria-label="Descer" onClick=${() => mover(i, 1)}>↓</button>
        <button class="btn-texto" onClick=${() => setModal(p)}>Editar</button></div></li>`)}</ol>
    ${modal && html`<${ModalPergunta} p=${modal} d=${d} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
  </div>`;
}

const json = (v) => (v == null ? '' : JSON.stringify(v, null, 1));
const lerJson = (s, padrao) => { if (!String(s || '').trim()) return padrao; return JSON.parse(s); };
const opcoesTexto = (l) => (l || []).map((o) => [o.valor, o.rotulo || '', o.num != null ? o.num : ''].join(' | ').replace(/( \| )+$/, '')).join('\n');
const lerOpcoes = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [valor, rotulo, n] = l.split('|').map((x) => x.trim()); const o = { valor, rotulo: rotulo || valor }; if (n !== undefined && n !== '' && !isNaN(Number(n.replace(',', '.')))) o.num = Number(n.replace(',', '.')); return o; });

function ModalPergunta({ p, d, onFechar, onFeito }) {
  const c = p.config || {};
  const [f, setF] = useState({ tipo: p.tipo || 'escala', titulo: p.titulo || '', chave: p.chave || '', ajuda: p.ajuda || '', obrigatoria: p.obrigatoria !== false,
    opcoes: opcoesTexto(p.opcoes), min: c.min != null ? c.min : 1, max: c.max != null ? c.max : 5, ancora1: (c.ancoras || [])[0] || '', ancora2: (c.ancoras || [])[1] || '',
    mostrar_se: json(p.mostrar_se), variantes: json(p.titulo_variantes && p.titulo_variantes.length ? p.titulo_variantes : null), extra: json(Object.fromEntries(Object.entries(c).filter(([k]) => !['min', 'max', 'ancoras'].includes(k)))) });
  const [avancado, setAvancado] = useState(!!(p.mostrar_se || (p.titulo_variantes || []).length));
  const chaveAuto = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
  const salvar = async (ev) => {
    ev.preventDefault();
    const chave = (f.chave || chaveAuto(f.titulo)).trim();
    if (!f.titulo.trim() || !chave) { toast('Preencha o título.', 'erro'); return; }
    let mostrar_se, variantes, extra;
    try { mostrar_se = lerJson(f.mostrar_se, null); variantes = lerJson(f.variantes, []); extra = lerJson(f.extra, {}); } catch (e) { toast('Alguma regra avançada não é um JSON válido.', 'erro'); return; }
    const config = { ...extra };
    if (f.tipo === 'escala') Object.assign(config, { min: Number(f.min), max: Number(f.max), ancoras: [f.ancora1, f.ancora2].some(Boolean) ? [f.ancora1, f.ancora2] : undefined });
    const linha = { formulario_id: d.form.id, tipo: f.tipo, titulo: f.titulo.trim(), chave, ajuda: f.ajuda || null, obrigatoria: f.obrigatoria,
      opcoes: ['multipla', 'caixas'].includes(f.tipo) ? lerOpcoes(f.opcoes) : [], config, mostrar_se, titulo_variantes: variantes || [] };
    try {
      if (p.id) await api.upd('perguntas', p.id, linha);
      else await api.ins('perguntas', { ...linha, ordem: d.perguntas.length ? Math.max(...d.perguntas.map((x) => x.ordem)) + 1 : 1 });
      await subirVersao(d.form); onFeito();
    } catch (e) { toast(/duplicate|unique/i.test(e.message) ? 'Já existe outra pergunta com essa chave.' : e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar esta pergunta?')) return; try { await api.del('perguntas', p.id); await subirVersao(d.form); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${p.id ? 'Editar pergunta' : 'Nova pergunta'} onFechar=${onFechar} largo=${true}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Tipo"><select class="input" value=${f.tipo} onChange=${(ev) => setF({ ...f, tipo: ev.target.value })}>${TIPOS_PERG.map(([k, r]) => html`<option value=${k}>${r}</option>`)}</select><//>
    <${Campo} rotulo="Pergunta"><input class="input" value=${f.titulo} onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    <div class="grade2">
      <${Campo} rotulo="Chave" dica="Nome usado nas regras. Não mude depois de ter respostas."><input class="input" placeholder=${chaveAuto(f.titulo)} value=${f.chave} onInput=${(ev) => setF({ ...f, chave: ev.target.value })}/><//>
      <${Campo} rotulo="Ajuda (opcional)"><input class="input" value=${f.ajuda} onInput=${(ev) => setF({ ...f, ajuda: ev.target.value })}/><//>
    </div>
    ${['multipla', 'caixas'].includes(f.tipo) && html`<${Campo} rotulo="Opções" dica="Uma por linha: valor | rótulo | número (o número é o que as regras comparam). Ex.: lt5 | Menos de 5 h | 4.5">
      <textarea class="input mono" rows="5" value=${f.opcoes} onInput=${(ev) => setF({ ...f, opcoes: ev.target.value })}></textarea><//>`}
    ${f.tipo === 'escala' && html`<div class="grade2">
      <${Campo} rotulo="Mínimo"><input class="input" inputmode="numeric" value=${f.min} onInput=${(ev) => setF({ ...f, min: ev.target.value })}/><//>
      <${Campo} rotulo="Máximo"><input class="input" inputmode="numeric" value=${f.max} onInput=${(ev) => setF({ ...f, max: ev.target.value })}/><//>
      <${Campo} rotulo="Âncora do mínimo"><input class="input" value=${f.ancora1} onInput=${(ev) => setF({ ...f, ancora1: ev.target.value })}/><//>
      <${Campo} rotulo="Âncora do máximo"><input class="input" value=${f.ancora2} onInput=${(ev) => setF({ ...f, ancora2: ev.target.value })}/><//>
    </div>`}
    <label class="toggle"><input type="checkbox" checked=${f.obrigatoria} onChange=${(ev) => setF({ ...f, obrigatoria: ev.target.checked })}/> Obrigatória</label>
    <button type="button" class="btn-texto" onClick=${() => setAvancado(!avancado)}>${avancado ? '▾' : '▸'} Ramificação e título vivo</button>
    ${avancado && html`<div class="pilha">
      <${Campo} rotulo="Mostrar só se (regra)" dica=${'Ex.: {"campo":"resp.tem_dor","op":"=","valor":true} · Operadores: ' + OPERADORES.join(' ')}>
        <textarea class="input mono" rows="3" value=${f.mostrar_se} onInput=${(ev) => setF({ ...f, mostrar_se: ev.target.value })}></textarea><//>
      ${f.mostrar_se.trim() && html`<small class="descricao-regra">Mostra quando: ${tentar(() => descrever(JSON.parse(f.mostrar_se)))}</small>`}
      <${Campo} rotulo="Títulos vivos" dica='Lista de { "quando": regra, "titulo": "texto com {{ctx.anterior.peso}}" }. O primeiro que passar vale.'>
        <textarea class="input mono" rows="4" value=${f.variantes} onInput=${(ev) => setF({ ...f, variantes: ev.target.value })}></textarea><//>
      <${Campo} rotulo="Configuração extra" dica='Ex.: {"padrao":"ctx.semana_atual.treinos","min":0,"max":14}'>
        <textarea class="input mono" rows="2" value=${f.extra} onInput=${(ev) => setF({ ...f, extra: ev.target.value })}></textarea><//>
    </div>`}
    <button class="btn primario grande">Salvar</button>
    ${p.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar pergunta</button>`}
  </form><//>`;
}
const tentar = (fn) => { try { return fn(); } catch (e) { return 'JSON inválido'; } };

// ---------- dicas ----------
function Dicas({ d, recarregar }) {
  const [modal, setModal] = useState(null);
  const alternar = async (x) => { try { await api.upd('dicas_condicionais', x.id, { ativo: !x.ativo }); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  const grupo = (publico, titulo, texto) => { const l = d.dicas.filter((x) => x.publico === publico); return html`<section class="card"><h3>${titulo}</h3><p class="suave">${texto}</p>
    ${l.length ? html`<ul class="lista">${l.map((x) => html`<li class="linha"><button class="linha-botao" onClick=${() => setModal(x)}><div class="item-info"><b>${x.titulo}</b>
      <small>${SEV[x.severidade]} · quando ${descrever(x.regra)}${x.pergunta_chave ? ' · na pergunta ' + x.pergunta_chave : ''}${x.cooldown_dias ? ` · repete a cada ${x.cooldown_dias} dia(s)` : ''}</small></div></button>
      <label class="toggle"><input type="checkbox" checked=${x.ativo} onChange=${() => alternar(x)} aria-label="Ativa"/></label></li>`)}</ul>` : html`<p class="suave">Nenhuma.</p>`}</section>`; };
  return html`<div class="pilha">
    <button class="btn primario" onClick=${() => setModal({ publico: 'aluna' })}>+ Dica</button>
    ${grupo('aluna', 'Para a aluna', 'Aparecem como papiro enquanto ela responde. Máximo de 2 por pergunta.')}
    ${grupo('coach', 'Para você', 'Avaliadas no banco, no envio. Viram alertas na Acrópole. A aluna nunca vê.')}
    ${modal && html`<${ModalDica} x=${modal} d=${d} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
  </div>`;
}
function ModalDica({ x, d, onFechar, onFeito }) {
  const [f, setF] = useState({ titulo: x.titulo || '', texto: x.texto || '', fonte: x.fonte || '', severidade: x.severidade || 'info', publico: x.publico || 'aluna', pergunta_chave: x.pergunta_chave || '',
    prioridade: x.prioridade != null ? x.prioridade : 50, cooldown_dias: x.cooldown_dias || 0, regra: json(x.regra) || '{"campo":"resp.","op":">=","valor":4}' });
  const salvar = async (ev) => {
    ev.preventDefault(); let regra; try { regra = JSON.parse(f.regra); } catch (e) { toast('A regra não é um JSON válido.', 'erro'); return; }
    if (!f.titulo.trim() || !f.texto.trim()) { toast('Preencha título e texto.', 'erro'); return; }
    const linha = { formulario_id: d.form.id, titulo: f.titulo.trim(), texto: f.texto.trim(), fonte: f.fonte || null, severidade: f.severidade, publico: f.publico, pergunta_chave: f.pergunta_chave || null,
      prioridade: Number(f.prioridade) || 0, cooldown_dias: Number(f.cooldown_dias) || 0, regra };
    try { if (x.id) await api.upd('dicas_condicionais', x.id, linha); else await api.ins('dicas_condicionais', linha); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar esta dica?')) return; try { await api.del('dicas_condicionais', x.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${x.id ? 'Editar dica' : 'Nova dica'} onFechar=${onFechar} largo=${true}><form class="pilha" onSubmit=${salvar}>
    <div class="chips">${[['aluna', 'Para a aluna'], ['coach', 'Para mim (alerta)']].map(([k, r]) => html`<button type="button" class=${f.publico === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, publico: k })}>${r}</button>`)}</div>
    <${Campo} rotulo="Título"><input class="input" value=${f.titulo} onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    <${Campo} rotulo="Texto (até 2 frases)"><textarea class="input" rows="3" value=${f.texto} onInput=${(ev) => setF({ ...f, texto: ev.target.value })}></textarea><//>
    <${Campo} rotulo="Quando dispara (regra)" dica=${'Operadores: ' + OPERADORES.join(' ') + ' · campos: resp.chave, ctx.ultima_dor.intensidade, ctx.ciclo.fase…'}>
      <textarea class="input mono" rows="3" value=${f.regra} onInput=${(ev) => setF({ ...f, regra: ev.target.value })}></textarea><//>
    <small class="descricao-regra">Dispara quando: ${tentar(() => descrever(JSON.parse(f.regra)))}</small>
    <div class="grade2">
      <${Campo} rotulo="Severidade"><select class="input" value=${f.severidade} onChange=${(ev) => setF({ ...f, severidade: ev.target.value })}>${Object.entries(SEV).map(([k, r]) => html`<option value=${k}>${r}</option>`)}</select><//>
      <${Campo} rotulo="Aparece na pergunta"><select class="input" value=${f.pergunta_chave} onChange=${(ev) => setF({ ...f, pergunta_chave: ev.target.value })}><option value="">No topo</option>${d.perguntas.map((p) => html`<option value=${p.chave}>${p.chave}</option>`)}</select><//>
      <${Campo} rotulo="Prioridade (0 a 100)"><input class="input" inputmode="numeric" value=${f.prioridade} onInput=${(ev) => setF({ ...f, prioridade: ev.target.value })}/><//>
      <${Campo} rotulo="Não repetir antes de (dias)"><input class="input" inputmode="numeric" value=${f.cooldown_dias} onInput=${(ev) => setF({ ...f, cooldown_dias: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Fonte (DOI ou link)"><input class="input" type="url" value=${f.fonte} onInput=${(ev) => setF({ ...f, fonte: ev.target.value })}/><//>
    <button class="btn primario grande">Salvar</button>
    ${x.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar dica</button>`}
  </form><//>`;
}

// ---------- aberturas ----------
function Aberturas({ d, recarregar }) {
  const [modal, setModal] = useState(null);
  return html`<div class="pilha">
    <p class="suave">A mensagem de maior prioridade cuja regra passar abre o formulário. Sem regra = mensagem padrão. Use {{aluna.primeiro_nome}}.</p>
    <button class="btn primario" onClick=${() => setModal({})}>+ Mensagem</button>
    ${d.aberturas.map((m) => html`<button class="card" onClick=${() => setModal(m)}><small>${m.regra ? 'quando ' + descrever(m.regra) : 'padrão'} · prioridade ${m.prioridade}</small><p>${m.texto}</p></button>`)}
    ${modal && html`<${ModalAbertura} m=${modal} d=${d} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
  </div>`;
}
function ModalAbertura({ m, d, onFechar, onFeito }) {
  const [f, setF] = useState({ texto: m.texto || '', regra: json(m.regra), prioridade: m.prioridade != null ? m.prioridade : 50 });
  const salvar = async (ev) => {
    ev.preventDefault(); let regra; try { regra = lerJson(f.regra, null); } catch (e) { toast('A regra não é um JSON válido.', 'erro'); return; }
    const linha = { formulario_id: d.form.id, texto: f.texto.trim(), regra, prioridade: Number(f.prioridade) || 0 };
    try { if (m.id) await api.upd('mensagens_abertura', m.id, linha); else await api.ins('mensagens_abertura', linha); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar esta mensagem?')) return; try { await api.del('mensagens_abertura', m.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo="Mensagem de abertura" onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Texto"><textarea class="input" rows="3" value=${f.texto} onInput=${(ev) => setF({ ...f, texto: ev.target.value })}></textarea><//>
    <${Campo} rotulo="Quando (regra, vazio = padrão)" dica='Ex.: {"campo":"ctx.ciclo.fase","op":"=","valor":"lutea"}'><textarea class="input mono" rows="2" value=${f.regra} onInput=${(ev) => setF({ ...f, regra: ev.target.value })}></textarea><//>
    <${Campo} rotulo="Prioridade"><input class="input" inputmode="numeric" value=${f.prioridade} onInput=${(ev) => setF({ ...f, prioridade: ev.target.value })}/><//>
    <button class="btn primario grande">Salvar</button>
    ${m.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
  </form><//>`;
}

// ---------- atribuições ----------
function Atribuicoes({ d, recarregar }) {
  const [novo, setNovo] = useState(false);
  const nome = (id) => (id ? (d.alunas.find((a) => a.id === id) || {}).nome || 'aluna removida' : 'Todas as alunas');
  const desc = (a) => a.quando === 'recorrente' ? `toda ${((a.recorrencia || {}).dias_semana || []).map((x) => DIAS[x]).join(', ') || '(sem dia)'}` : a.quando === 'programado' ? `em ${a.agendado_para ? dataBR(a.agendado_para) + ' ' + new Date(a.agendado_para).toTimeString().slice(0, 5) : '?'}` : 'liberado agora';
  const alternar = async (a) => { try { await api.upd('atribuicoes', a.id, { ativa: !a.ativa }); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  const apagar = async (a) => { if (!confirm('Apagar esta atribuição?')) return; try { await api.del('atribuicoes', a.id); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<div class="pilha">
    <button class="btn primario" onClick=${() => setNovo(true)}>+ Atribuir</button>
    ${!d.atribs.length && html`<${Vazio} titulo="Ninguém recebe este formulário ainda"/>`}
    ${d.atribs.map((a) => html`<section class=${'card' + (a.ativa ? '' : ' apagado')}><div class="card-topo"><div><h3>${nome(a.aluna_id)}</h3>
      <small>${desc(a)} · ${a.entrega === 'fim_treino' ? 'ao finalizar o treino' : 'aparece no app'}${a.bloqueia_app ? ' · bloqueia o app até responder' : ''}</small></div>
      <label class="toggle"><input type="checkbox" checked=${a.ativa} onChange=${() => alternar(a)} aria-label="Ativa"/></label></div>
      <button class="btn-texto perigo" onClick=${() => apagar(a)}>Apagar</button></section>`)}
    ${novo && html`<${ModalAtribuicao} d=${d} onFechar=${() => setNovo(false)} onFeito=${() => { setNovo(false); recarregar(); }}/>`}
  </div>`;
}
function ModalAtribuicao({ d, onFechar, onFeito }) {
  const [f, setF] = useState({ aluna_id: '', entrega: 'manual', quando: d.form.tipo === 'oraculo' ? 'recorrente' : 'agora', dias: [5], dia: '', hora: '08:00', bloqueia_app: d.form.tipo === 'alistamento' });
  const salvar = async (ev) => {
    ev.preventDefault();
    if (f.quando === 'recorrente' && !f.dias.length) { toast('Escolha pelo menos um dia.', 'erro'); return; }
    if (f.quando === 'programado' && !f.dia) { toast('Escolha a data.', 'erro'); return; }
    const linha = { formulario_id: d.form.id, aluna_id: f.aluna_id || null, entrega: f.entrega, quando: f.quando, bloqueia_app: f.bloqueia_app, ativa: true,
      recorrencia: f.quando === 'recorrente' ? { dias_semana: f.dias } : null, agendado_para: f.quando === 'programado' ? new Date(`${f.dia}T${f.hora}:00`).toISOString() : null };
    try { await api.ins('atribuicoes', linha); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const chips = (k, ops) => html`<div class="chips">${ops.map(([v, r]) => html`<button type="button" class=${f[k] === v ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, [k]: v })}>${r}</button>`)}</div>`;
  return html`<${Modal} titulo=${'Atribuir · ' + d.form.titulo} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Para quem"><select class="input" value=${f.aluna_id} onChange=${(ev) => setF({ ...f, aluna_id: ev.target.value })}><option value="">Todas as alunas</option>${d.alunas.filter((a) => a.ativo).map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select><//>
    <${Campo} rotulo="Entrega">${chips('entrega', [['manual', 'Aparece no app'], ['fim_treino', 'Ao finalizar o treino']])}<//>
    <${Campo} rotulo="Quando">${chips('quando', [['agora', 'Agora'], ['programado', 'Programado'], ['recorrente', 'Toda semana']])}<//>
    ${f.quando === 'recorrente' && html`<div class="chips">${DIAS.map((r, i) => html`<button type="button" class=${f.dias.includes(i) ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, dias: f.dias.includes(i) ? f.dias.filter((x) => x !== i) : [...f.dias, i].sort() })}>${r}</button>`)}</div>`}
    ${f.quando === 'programado' && html`<div class="grade2"><${Campo} rotulo="Dia"><input class="input" type="date" value=${f.dia} onInput=${(ev) => setF({ ...f, dia: ev.target.value })}/><//>
      <${Campo} rotulo="Hora"><input class="input" type="time" value=${f.hora} onInput=${(ev) => setF({ ...f, hora: ev.target.value })}/><//></div>`}
    <label class="toggle"><input type="checkbox" checked=${f.bloqueia_app} onChange=${(ev) => setF({ ...f, bloqueia_app: ev.target.checked })}/> Exigir resposta antes de usar o app</label>
    <button class="btn primario grande">Atribuir</button>
  </form><//>`;
}

// ---------- respostas ----------
function Respostas({ d }) {
  const e = useCarregar(async () => {
    const envios = await api.q('envios', { eq: { formulario_id: d.form.id }, order: 'enviado_em', asc: false, limit: 100 });
    return envios;
  }, [d.form.id]);
  const [aberto, setAberto] = useState(null);
  const nome = (id) => (d.alunas.find((a) => a.id === id) || {}).nome || 'Aluna';
  return html`<${Estado} e=${e}>${(envios) => (envios.length ? html`<div class="pilha">${envios.map((x) => html`<button class="card" onClick=${() => setAberto(x)}>
      <div class="card-topo"><div><h3>${nome(x.aluna_id)}</h3><small>${dataBR(x.enviado_em)} · versão ${x.versao}</small></div>
      ${d.form.tipo !== 'oraculo' && (x.lido_em ? html`<span class="tag">lido</span>` : html`<span class="tag atencao">para ler</span>`)}</div></button>`)}
    ${aberto && html`<${ModalEnvio} envio=${aberto} perguntas=${d.perguntas} nome=${nome(aberto.aluna_id)} onFechar=${() => { setAberto(null); e.recarregar(); }}/>`}</div>`
    : html`<${Vazio} titulo="Nenhuma resposta ainda"/>`)}<//>`;
}
export function ModalEnvio({ envio, perguntas, nome, onFechar }) {
  const e = useCarregar(async () => {
    const [resp, perg] = await Promise.all([api.q('respostas', { eq: { envio_id: envio.id } }), perguntas ? Promise.resolve(perguntas) : api.q('perguntas', { eq: { formulario_id: envio.formulario_id }, order: 'ordem' })]);
    if (!envio.lido_em) { try { await api.upd('envios', envio.id, { lido_em: new Date().toISOString() }); } catch (err) { /* sem permissão de update: ok */ } }
    return { resp, perg };
  }, [envio.id]);
  return html`<${Modal} titulo=${nome + ' · ' + dataBR(envio.enviado_em)} onFechar=${onFechar}><${Estado} e=${e}>${({ resp, perg }) => html`<dl class="respostas">
    ${perg.map((p) => { const r = resp.find((x) => x.chave === p.chave); if (!r) return null; return html`<div><dt>${p.titulo}</dt><dd>${mostrarValor(r.valor, p)}</dd></div>`; })}
    ${resp.filter((r) => !perg.some((p) => p.chave === r.chave) && r.chave !== 'dores_max').map((r) => html`<div><dt>${r.chave}</dt><dd>${mostrarValor(r.valor)}</dd></div>`)}
  </dl>`}<//><//>`;
}
export function mostrarValor(v, p) {
  if (v == null) return '·';
  if (v === true) return 'Sim'; if (v === false) return 'Não';
  if (p && p.tipo === 'multipla') { const o = (p.opcoes || []).find((x) => x.num === v || x.valor === v); if (o) return o.rotulo; }
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' ? `${x.regiao}${x.lado ? ' ' + x.lado : ''} ${x.intensidade}/10` : ((p && (p.opcoes || []).find((o) => o.valor === x)) || {}).rotulo || x)).join(', ');
  if (typeof v === 'object') return v.menstruou != null ? (v.menstruou ? `Sim, começou em ${dataBR(v.inicio)}` : 'Não') : JSON.stringify(v);
  return String(v);
}

// ---------- prévia ----------
function Previa({ d }) {
  const ativas = d.alunas.filter((a) => a.ativo);
  const [aluna, setAluna] = useState(ativas[0] ? ativas[0].id : '');
  return html`<div class="pilha">
    <p class="suave">Mostra o formulário como a aluna escolhida veria hoje, com o histórico dela. Nada é enviado.</p>
    ${ativas.length ? html`<select class="input" value=${aluna} onChange=${(ev) => setAluna(ev.target.value)}>${ativas.map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select>
      <div class="card"><${ResponderFormulario} formularioId=${d.form.id} alunaPrevia=${aluna} previa=${true}/></div>`
      : html`<${Vazio} titulo="Cadastre uma aluna para ver a prévia"/>`}
  </div>`;
}
