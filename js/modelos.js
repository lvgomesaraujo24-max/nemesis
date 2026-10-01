// Modelos (Forja): fichas prontas para reaproveitar. Protocolo > Treino > Exercício.
import { html, useState } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { Ficha, ModalNovoModelo, copiarTreinos, CamposModelo, extrasModelo, OBJETIVOS_MODELO } from './ficha.js';
import { ComoFunciona } from './comum.js';
import { NIVEIS, tipoDoTreino } from './musculos.js';
import { useCarregar, Estado, Modal, Campo, toast } from './util.js';

const nomeNivel = (k) => (NIVEIS.find(([x]) => x === k) || [null, ''])[1];
const extrasTexto = (m) => [(OBJETIVOS_MODELO.find(([k]) => k === m.objetivo) || [])[1], m.frequencia_semanal && `${m.frequencia_semanal}x por semana`, m.duracao_semanas && `${m.duracao_semanas} semanas`].filter(Boolean);
const resumoModelo = (m) => [nomeNivel(m.nivel), (OBJETIVOS_MODELO.find(([k]) => k === m.objetivo) || [])[1], m.frequencia_semanal && `${m.frequencia_semanal}x por semana`, m.duracao_semanas && `${m.duracao_semanas} semanas`].filter(Boolean);

export function Modelos({ id, ir }) {
  const e = useCarregar(async () => {
    const [modelos, treinos, itens] = await Promise.all([api.q('modelos', { order: 'nome' }), api.q('treinos', {}), api.q('treino_itens', {})]);
    return { modelos, treinos: treinos.filter((t) => t.modelo_id), itens: itens.filter((i) => i.modelo_id) };
  }, [id]);
  const [novo, setNovo] = useState(false);
  return html`<${Estado} e=${e}>${({ modelos, treinos, itens }) => {
    const atual = id && modelos.find((m) => m.id === id);
    if (id && atual) return html`<${ModeloDetalhe} m=${atual} ir=${ir} recarregar=${e.recarregar}/>`;
    return html`<div class="pilha">
      <div class="titulo-acoes"><div><h1 class="titulo">Modelos</h1><p class="suave">Fichas prontas: monte uma vez e aplique em quantas alunas quiser.</p></div>
        <button class="btn primario" onClick=${() => setNovo(true)}>+ Novo modelo</button></div>
      ${!modelos.length ? html`<${ComoFunciona} titulo="Nenhum modelo ainda" passos=${[
          ['Crie o modelo', 'Dê nome e nível. Ou, na ficha de uma aluna, toque em "Salvar como modelo".'],
          ['Monte os treinos', 'O mesmo editor da ficha: tipos, prescrição na linha, presets e volume ao vivo.'],
          ['Aplique na aluna', 'Um toque copia os treinos para a ficha dela.'],
          ['Ajuste o fino', 'Na ficha da aluna você mexe no que for dela, sem alterar o modelo.']]}>
          <button class="btn primario" onClick=${() => setNovo(true)}>Criar modelo</button><//>`
      : html`<div class="modelos-grade">${modelos.map((m) => { const ts = treinos.filter((t) => t.modelo_id === m.id); const its = itens.filter((i) => i.modelo_id === m.id);
          return html`<button class="card modelo" onClick=${() => ir('modelos/' + m.id)}>
            <div class="card-topo"><b>${m.nome}</b>${m.nivel && html`<span class="tag roxo">${nomeNivel(m.nivel)}</span>`}</div>
            ${extrasTexto(m).length > 0 && html`<small>${extrasTexto(m).join(' · ')}</small>`}
            ${m.descricao && html`<small>${m.descricao}</small>`}
            <div class="modelo-treinos">${ts.map((t) => html`<span class="tag">${t.nome}</span>`)}</div>
            <small>${ts.length} treino(s) · ${its.length} exercício(s) · ${tipoDoTreino(its)}</small></button>`; })}</div>`}
      ${novo && html`<${ModalNovoModelo} onFechar=${() => setNovo(false)} onFeito=${(m) => { setNovo(false); ir('modelos/' + m.id); }}/>`}
    </div>`;
  }}<//>`;
}

function ModeloDetalhe({ m, ir, recarregar }) {
  const [modal, setModal] = useState(null);
  const duplicar = async () => {
    try {
      const [n] = await api.ins('modelos', { nome: `${m.nome} (cópia)`, nivel: m.nivel, descricao: m.descricao, ...extrasModelo(m) });
      await copiarTreinos({ campo: 'modelo_id', id: m.id }, { campo: 'modelo_id', id: n.id }, 0);
      toast('Modelo duplicado', 'ok'); ir('modelos/' + n.id);
    } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => {
    if (!confirm(`Apagar o modelo "${m.nome}"? As fichas das alunas que usaram ele não mudam.`)) return;
    try { await api.del('modelos', m.id); ir('modelos'); } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<div class="pilha">
    <button class="btn-texto" onClick=${() => ir('modelos')}>‹ Modelos</button>
    <div class="titulo-acoes"><div><h1 class="titulo">${m.nome}</h1><p class="suave">${[...resumoModelo(m), m.descricao].filter(Boolean).join(' · ') || 'Modelo de ficha'}</p></div>
      <div class="acoes"><button class="btn primario" onClick=${() => setModal('aplicar')}><${Icone} nome="alunas" tam=${16}/>Aplicar em aluna</button>
        <button class="btn" onClick=${() => setModal('editar')}>Editar</button><button class="btn" onClick=${duplicar}>Duplicar</button>
        <button class="btn-texto perigo" onClick=${apagar}>Apagar</button></div></div>
    <${Ficha} modelo=${m}/>
    ${modal === 'aplicar' && html`<${ModalAplicar} m=${m} onFechar=${() => setModal(null)} onFeito=${(aluna) => { setModal(null); ir(`aluna/${aluna}/ficha`); }}/>`}
    ${modal === 'editar' && html`<${ModalEditarModelo} m=${m} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
  </div>`;
}

function ModalAplicar({ m, onFechar, onFeito }) {
  const e = useCarregar(() => api.q('profiles', { eq: { role: 'student', ativo: true }, order: 'nome' }), []);
  const [aluna, setAluna] = useState('');
  const [ocultar, setOcultar] = useState(true);
  const [indo, setIndo] = useState(false);
  const aplicar = async () => {
    setIndo(true);
    try {
      const atuais = await api.q('treinos', { eq: { aluna_id: aluna } });
      if (ocultar) for (const t of atuais.filter((x) => x.ativo)) await api.upd('treinos', t.id, { ativo: false });
      const n = await copiarTreinos({ campo: 'modelo_id', id: m.id }, { campo: 'aluna_id', id: aluna }, atuais.length);
      toast(`${n} treino(s) aplicados`, 'ok'); onFeito(aluna);
    } catch (err) { toast(err.message, 'erro'); setIndo(false); }
  };
  return html`<${Modal} titulo=${`Aplicar "${m.nome}"`} onFechar=${onFechar}><${Estado} e=${e}>${(alunas) => html`<div class="pilha">
    <select class="input" value=${aluna} onChange=${(ev) => setAluna(ev.target.value)}><option value="">Escolha a aluna</option>${alunas.map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select>
    <label class="toggle"><input type="checkbox" checked=${ocultar} onChange=${(ev) => setOcultar(ev.target.checked)}/> Ocultar da aluna os treinos que ela tem hoje (ficam salvos)</label>
    <button class="btn primario grande" disabled=${!aluna || indo} onClick=${aplicar}>${indo ? 'Aplicando...' : 'Aplicar na ficha'}</button>
  </div>`}<//><//>`;
}

function ModalEditarModelo({ m, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: m.nome, nivel: m.nivel || 'intermediaria', descricao: m.descricao || '', objetivo: m.objetivo || '', frequencia_semanal: m.frequencia_semanal || '', duracao_semanas: m.duracao_semanas || '' });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) return;
    try { await api.upd('modelos', m.id, { nome: f.nome.trim(), nivel: f.nivel, descricao: f.descricao || null, ...extrasModelo(f, m) }); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo="Editar modelo" onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
    <${Campo} rotulo="Nível"><div class="chips">${NIVEIS.map(([k, r]) => html`<button type="button" class=${f.nivel === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, nivel: k })}>${r}</button>`)}</div><//>
    <${CamposModelo} f=${f} setF=${setF}/>
    <${Campo} rotulo="Descrição"><textarea class="input" rows="2" value=${f.descricao} onInput=${(ev) => setF({ ...f, descricao: ev.target.value })}></textarea><//>
    <button class="btn primario grande">Salvar</button></form><//>`;
}
