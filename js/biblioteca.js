// Biblioteca de exercícios (nível 3): músculos no mapa, etiquetas, perfil de resistência,
// vídeo, dica de execução e grupo de substituição (o que a aluna pode usar se o aparelho estiver ocupado).
import { html, useState } from '../lib/preact-htm.js';
import { api } from './api.js';
import { MapaCorpo } from './corpo.js';
import { Icone } from './icones.js';
import { MUSCULOS, GRUPOS_MUSC, EQUIPAMENTOS, ARTICULACOES, PERFIS, musculosDe, nomeDe } from './musculos.js';
import { useCarregar, Estado, Modal, Campo, toast } from './util.js';

export function Exercicios() {
  const e = useCarregar(() => api.q('exercicios', { order: 'nome' }), []);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('');
  const [edit, setEdit] = useState(null);
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Exercícios</h1><button class="btn primario" onClick=${() => setEdit({})}>+ Exercício</button></div>
    <p class="suave">Seu vídeo, sua dica de execução e os músculos de cada exercício. É daqui que sai o volume da ficha e o que a aluna pode usar no lugar.</p>
    <input class="input" type="search" placeholder="Buscar" value=${busca} onInput=${(ev) => setBusca(ev.target.value)}/>
    <div class="chips">${[['', 'Todos'], ...EQUIPAMENTOS, ['sem_video', 'Sem vídeo']].map(([k, r]) => html`<button class=${filtro === k ? 'chip on' : 'chip'} onClick=${() => setFiltro(k)}>${r}</button>`)}</div>
    <${Estado} e=${e}>${(lista) => {
      const f = lista.filter((x) => (x.nome + ' ' + (x.grupo || '')).toLowerCase().includes(busca.toLowerCase())
        && (!filtro || (filtro === 'sem_video' ? !x.video_url : x.equipamento === filtro)));
      const grupos = [...new Set(f.map((x) => x.grupo || 'Sem grupo'))].sort();
      return grupos.map((g) => html`<section class="card"><h3>${g}</h3><ul class="lista">${f.filter((x) => (x.grupo || 'Sem grupo') === g).map((x) => { const m = musculosDe(x);
        return html`<li class="linha"><button class="linha-botao" onClick=${() => setEdit(x)}>
          <span class="bib-nome"><b>${x.nome}</b><small>${m.primarios.map((k) => MUSCULOS[k].nome).join(', ')}</small></span>
          <span class="treino-tags">${x.equipamento && html`<span class="tag">${nomeDe(EQUIPAMENTOS, x.equipamento)}</span>`}
            ${x.articulacao && html`<span class="tag">${x.articulacao === 'multi' ? 'Multi' : 'Mono'}</span>`}
            ${(x.substitutos || []).length > 0 && html`<span class="tag">${x.substitutos.length} troca(s)</span>`}
            ${x.video_url ? html`<span class="tag roxo">vídeo</span>` : html`<span class="tag">sem vídeo</span>`}</span></button></li>`; })}</ul></section>`);
    }}<//>
    ${edit && html`<${ModalExercicio} ex=${edit} todos=${e.dados || []} onFechar=${() => setEdit(null)} onFeito=${() => { setEdit(null); e.recarregar(); }}/>`}
  </div>`;
}

function ModalExercicio({ ex, todos, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: ex.nome || '', grupo: ex.grupo || '', video_url: ex.video_url || '', instrucoes: ex.instrucoes || '',
    equipamento: ex.equipamento || '', articulacao: ex.articulacao || '', perfil_resistencia: ex.perfil_resistencia || '', substitutos: ex.substitutos || [] });
  const [mexeuEtiquetas, setMexeuEtiquetas] = useState(false);
  const [vista, setVista] = useState('frente');
  const [buscaSub, setBuscaSub] = useState('');
  // músculos: começa pelo que o app deduz; só grava se o treinador mexer
  const [mus, setMus] = useState(() => { const m = musculosDe(ex.id ? ex : null); return { primarios: m.primarios, secundarios: m.secundarios, mexeu: false }; });
  const auto = musculosDe({ ...ex, ...f, musculos: null });
  const papel = (k) => (mus.primarios.includes(k) ? 'p' : mus.secundarios.includes(k) ? 's' : '');
  const alterna = (k) => {
    const p = papel(k); const tira = (l) => l.filter((x) => x !== k);
    setMus({ primarios: p === '' ? [...mus.primarios, k] : tira(mus.primarios), secundarios: p === 'p' ? [...mus.secundarios, k] : tira(mus.secundarios), mexeu: true });
  };
  const muda = (k, v) => { setF({ ...f, [k]: v }); if (['equipamento', 'articulacao', 'perfil_resistencia', 'substitutos'].includes(k)) setMexeuEtiquetas(true); };
  const valores = Object.fromEntries([...mus.primarios.map((k) => [k, 15]), ...mus.secundarios.map((k) => [k, 7])]);
  const outros = todos.filter((x) => x.id !== ex.id);
  const subs = outros.filter((x) => f.substitutos.includes(x.id));
  const achados = buscaSub ? outros.filter((x) => !f.substitutos.includes(x.id) && x.nome.toLowerCase().includes(buscaSub.toLowerCase())).slice(0, 6) : [];
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) { toast('Dê um nome ao exercício.', 'erro'); return; }
    const linha = { nome: f.nome.trim(), grupo: f.grupo || null, video_url: f.video_url || null, instrucoes: f.instrucoes || null };
    if (mus.mexeu) linha.musculos = mus.primarios.length || mus.secundarios.length ? { primarios: mus.primarios, secundarios: mus.secundarios } : null;
    if (mexeuEtiquetas) Object.assign(linha, { equipamento: f.equipamento || null, articulacao: f.articulacao || null, perfil_resistencia: f.perfil_resistencia || null, substitutos: f.substitutos });
    try { if (ex.id) await api.upd('exercicios', ex.id, linha); else await api.ins('exercicios', linha); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm(`Apagar "${ex.nome}" da biblioteca? Nas fichas que usam ele, vai aparecer "exercício removido".`)) return; await api.del('exercicios', ex.id); onFeito(); };
  const chips = (lista, k) => html`<div class="chips">${lista.map(([v, r]) => html`<button type="button" class=${f[k] === v ? 'chip on' : 'chip'} onClick=${() => muda(k, f[k] === v ? '' : v)}>${r}</button>`)}</div>`;
  return html`<${Modal} titulo=${ex.id ? 'Editar exercício' : 'Novo exercício'} onFechar=${onFechar} largo=${true}>
    <form class="pilha" onSubmit=${salvar}>
      <div class="grade2">
        <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => muda('nome', ev.target.value)} autofocus=${!ex.id}/><//>
        <${Campo} rotulo="Grupo"><input class="input" list="grupos" value=${f.grupo} onInput=${(ev) => muda('grupo', ev.target.value)}/>
          <datalist id="grupos">${['Glúteos', 'Quadríceps', 'Posteriores', 'Adutores', 'Panturrilha', 'Costas', 'Lombar', 'Peito', 'Ombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio'].map((g) => html`<option value=${g}/>`)}</datalist><//>
      </div>
      <div class="bib-musculos">
        <div class="bib-mapa"><button type="button" class="icone" aria-label="Virar o corpo" onClick=${() => setVista(vista === 'frente' ? 'costas' : 'frente')}><${Icone} nome="girar" tam=${18}/></button>
          <${MapaCorpo} valores=${valores} vista=${vista} largura=${150} onMusculo=${alterna}/>
          <small>${vista === 'frente' ? 'Frente' : 'Costas'} · toque no músculo</small></div>
        <div class="campo"><span class="rotulo">Músculos</span>
          <small>Toque uma vez para principal (conta 1 série), duas para auxiliar (0,5), três para tirar. Vale no mapa e nos nomes.</small>
          ${GRUPOS_MUSC.map((g) => html`<div class="musc-grupo"><small>${g}</small><div class="chips">${Object.keys(MUSCULOS).filter((k) => MUSCULOS[k].grupo === g).map((k) => { const p = papel(k);
            return html`<button type="button" class=${'chip musc ' + p} onClick=${() => alterna(k)}>${MUSCULOS[k].nome}${p === 'p' ? ' · principal' : p === 's' ? ' · auxiliar' : ''}</button>`; })}</div></div>`)}
          ${mus.mexeu ? html`<button type="button" class="btn-texto" onClick=${() => setMus({ primarios: auto.primarios, secundarios: auto.secundarios, mexeu: true })}>Voltar para o automático</button>`
            : html`<small>${musculosDe(ex.id ? ex : null).auto ? 'Automático pelo nome do exercício.' : 'Definido por você.'}</small>`}
        </div>
      </div>
      <${Campo} rotulo="Execução">${chips(EQUIPAMENTOS, 'equipamento')}${chips(ARTICULACOES, 'articulacao')}<//>
      <div class="campo"><span class="rotulo">Perfil de resistência</span>${chips(PERFIS.map(([k, r]) => [k, r]), 'perfil_resistencia')}
        ${f.perfil_resistencia && html`<small>A aluna lê: "${(PERFIS.find(([k]) => k === f.perfil_resistencia) || [])[2]}"</small>`}</div>
      <${Campo} rotulo="Link do vídeo" dica="YouTube, Drive ou Instagram. A aluna vê o botão na execução."><input class="input" type="url" placeholder="https://" value=${f.video_url} onInput=${(ev) => muda('video_url', ev.target.value)}/><//>
      <${Campo} rotulo="Sua dica de execução"><textarea class="input" rows="3" placeholder="Ex.: empurre o chão com o calcanhar e trave o quadril em cima por 1 segundo." value=${f.instrucoes} onInput=${(ev) => muda('instrucoes', ev.target.value)}></textarea><//>
      <div class="campo"><span class="rotulo">Grupo de substituição</span>
        <small>Se o aparelho estiver ocupado, a aluna pode trocar por um destes. Você recebe o aviso na Acrópole.</small>
        ${subs.length > 0 && html`<div class="chips">${subs.map((x) => html`<button type="button" class="chip on" onClick=${() => muda('substitutos', f.substitutos.filter((y) => y !== x.id))}>${x.nome} ✕</button>`)}</div>`}
        <input class="input" type="search" placeholder="Buscar exercício equivalente" value=${buscaSub} onInput=${(ev) => setBuscaSub(ev.target.value)}/>
        ${achados.length > 0 && html`<div class="sugestoes">${achados.map((x) => html`<button type="button" onClick=${() => { muda('substitutos', [...f.substitutos, x.id]); setBuscaSub(''); }}>${x.nome}<small>${x.grupo || ''}</small></button>`)}</div>`}
      </div>
      <button class="btn primario grande">Salvar</button>
      ${ex.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
    </form><//>`;
}
