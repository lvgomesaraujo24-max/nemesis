// Editor da ficha (treinador): treinos em abas, exercícios editados na própria linha,
// replicar valores, tempo estimado e volume semanal por músculo com mapa do corpo.
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Mesociclo } from './extras.js';
import { Icone } from './icones.js';
import { MapaCorpo } from './corpo.js';
import { MUSCULOS, GRUPOS_MUSC, TIPOS, METODOS, METODOS_AEROBICO, DESCANSOS, musculosDe, tipoDoTreino, lerFaixa, juntarFaixa,
  tempoTreino, fmtTempo, volumePorMusculo, seriesValidas, nivelVolume, REF_VOLUME } from './musculos.js';
import { useCarregar, Estado, Vazio, Modal, Campo, toast, lerNum } from './util.js';

const PADRAO = {
  musculacao: { series: 3, reps: '8-12', descanso: 90, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
  aquecimento: { series: 2, reps: '15', descanso: 30, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
  aerobico: { series: 1, reps: '', descanso: 0, descanso_tipo: 'livre', metodo: 'continuo', aquecimento: 0, duracao: 20 },
  crossfit: { series: 3, reps: '10', descanso: 60, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
};
// o que o "Replicar valores" copia do 1º exercício para os outros
const REPLICAR = [['reps', 'Repetições', ['reps']], ['metodo', 'Método', ['metodo', 'tecnica']], ['series', 'Séries', ['series']],
  ['cadencia', 'Cadência', ['cadencia_exc', 'cadencia_con']], ['intervalo', 'Intervalo', ['descanso', 'descanso_tipo', 'descanso_max']],
  ['aquecimento', 'Séries de aquecimento', ['aquecimento']], ['esforco', 'RIR/RPE', ['esforco_tipo', 'esforco_alvo']]];

export function Ficha({ aluna }) {
  const e = useCarregar(async () => {
    const [treinos, itens, exercicios] = await Promise.all([
      api.q('treinos', { eq: { aluna_id: aluna.id }, order: 'ordem' }),
      api.q('treino_itens', { eq: { aluna_id: aluna.id }, order: 'ordem' }),
      api.q('exercicios', { order: 'nome' }),
    ]);
    return { treinos, itens, exercicios };
  }, [aluna.id]);
  return html`<${Estado} e=${e}>${(d) => html`<${Editor} aluna=${aluna} d=${d} recarregar=${e.recarregar}/>`}<//>`;
}

function Editor({ aluna, d, recarregar }) {
  const [itens, setItens] = useState(d.itens);
  const [treinos, setTreinos] = useState(d.treinos);
  const [atual, setAtual] = useState(() => (d.treinos[0] || {}).id || null);
  const [modal, setModal] = useState(null);
  useEffect(() => {
    setItens(d.itens); setTreinos(d.treinos);
    if (!d.treinos.some((t) => t.id === atual)) setAtual((d.treinos[0] || {}).id || null);
  }, [d]);
  const exercicios = d.exercicios;
  const treino = treinos.find((t) => t.id === atual);
  const doTreino = itens.filter((i) => i.treino_id === atual).sort((a, b) => a.ordem - b.ordem);
  const daFicha = itens.filter((i) => { const t = treinos.find((x) => x.id === i.treino_id); return t && t.ativo && !t.opcional; });

  // salva na hora e mostra antes da resposta do banco
  const salvarItem = async (id, patch) => {
    setItens((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try { await api.upd('treino_itens', id, patch); } catch (err) { toast(err.message, 'erro'); recarregar(); }
  };
  const salvarTreino = async (id, patch) => {
    setTreinos((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try { await api.upd('treinos', id, patch); } catch (err) { toast(err.message, 'erro'); recarregar(); }
  };
  const moverItem = async (i, dir) => {
    const j = i + dir; if (j < 0 || j >= doTreino.length) return;
    const a = doTreino[i], b = doTreino[j];
    setItens((l) => l.map((x) => (x.id === a.id ? { ...x, ordem: j } : x.id === b.id ? { ...x, ordem: i } : x)));
    try { await api.upd('treino_itens', a.id, { ordem: j }); await api.upd('treino_itens', b.id, { ordem: i }); } catch (err) { toast(err.message, 'erro'); recarregar(); }
  };
  const moverTreino = async (dir) => {
    const i = treinos.findIndex((t) => t.id === atual); const j = i + dir; if (j < 0 || j >= treinos.length) return;
    try { await api.upd('treinos', treinos[i].id, { ordem: j }); await api.upd('treinos', treinos[j].id, { ordem: i }); recarregar(); } catch (err) { toast(err.message, 'erro'); }
  };
  const remover = async (it) => {
    if (!confirm('Remover este exercício do treino?')) return;
    setItens((l) => l.filter((x) => x.id !== it.id));
    try { await api.del('treino_itens', it.id); } catch (err) { toast(err.message, 'erro'); recarregar(); }
  };
  const adicionar = async (tipo, ex) => {
    try {
      const [novo] = await api.ins('treino_itens', { ...PADRAO[tipo], tipo, exercicio_id: ex.id, treino_id: atual, aluna_id: aluna.id, ordem: doTreino.length });
      setItens((l) => [...l, novo]); setModal(null);
    } catch (err) { toast(err.message, 'erro'); }
  };
  const replicar = async (chaves) => {
    const fonte = doTreino.find((i) => i.tipo !== 'aerobico');
    if (!fonte) return;
    const campos = REPLICAR.filter(([k]) => chaves.includes(k)).flatMap(([, , c]) => c);
    const patch = Object.fromEntries(campos.map((c) => [c, fonte[c] ?? null]));
    const alvos = doTreino.filter((i) => i.id !== fonte.id && i.tipo !== 'aerobico');
    setItens((l) => l.map((i) => (alvos.some((a) => a.id === i.id) ? { ...i, ...patch } : i)));
    try { for (const a of alvos) await api.upd('treino_itens', a.id, patch); toast(`Valores do 1º exercício copiados para ${alvos.length} exercício(s)`, 'ok'); }
    catch (err) { toast(err.message, 'erro'); recarregar(); }
  };

  return html`<div class="pilha ficha-editor">
    <${Mesociclo} aluna=${aluna}/>
    <div class="treino-abas">
      ${treinos.map((t) => { const its = itens.filter((i) => i.treino_id === t.id);
        return html`<button class=${'treino-aba' + (t.id === atual ? ' on' : '') + (t.ativo ? '' : ' apagado')} onClick=${() => setAtual(t.id)}>
          <b>${t.nome}</b><small>${tipoDoTreino(its)}${t.opcional ? ' · opcional' : ''}</small></button>`; })}
      <button class="treino-aba nova" onClick=${() => setModal({ tipo: 'treino' })}><${Icone} nome="mais" tam=${16}/>Criar treino</button>
      <button class="treino-aba nova" onClick=${() => setModal({ tipo: 'copiar' })}><${Icone} nome="copiar" tam=${16}/>Importar</button>
    </div>

    ${!treino ? html`<${Vazio} titulo="Ficha vazia" texto="Crie os treinos (A, B, C...) e adicione os exercícios de cada um."/>` : html`<section class="editor-treino">
      <div class="et-topo">
        <div class="et-titulo"><button class="et-nome" onClick=${() => setModal({ tipo: 'treino', treino })}>${treino.nome}</button>
          <p class="et-sub">${tipoDoTreino(doTreino)}${doTreino.length ? html` · <${Icone} nome="relogio" tam=${15}/> ${fmtTempo(tempoTreino(doTreino))}` : ''}${treino.opcional ? ' · opcional' : ''}${treino.ativo ? '' : ' · oculto da aluna'}</p></div>
        <div class="mini-acoes">
          <button class="icone" aria-label="Mover treino para a esquerda" onClick=${() => moverTreino(-1)}>‹</button><button class="icone" aria-label="Mover treino para a direita" onClick=${() => moverTreino(1)}>›</button>
          <button class="btn mini" onClick=${() => setModal({ tipo: 'treino', treino })}>Editar treino</button></div>
      </div>
      <div class="et-barra">
        <span class="et-raio" title="Ações rápidas"><${Icone} nome="raio" tam=${16}/></span>
        <${Replicar} onAplicar=${replicar} desativado=${doTreino.filter((i) => i.tipo !== 'aerobico').length < 2}/>
        <${Volume} doTreino=${doTreino} daFicha=${daFicha} exercicios=${exercicios}/>
      </div>
      ${doTreino.map((it, i) => html`<${Item} key=${it.id} it=${it} ex=${exercicios.find((x) => x.id === it.exercicio_id)} i=${i} n=${doTreino.length}
        salvar=${(p) => salvarItem(it.id, p)} mover=${(dir) => moverItem(i, dir)} remover=${() => remover(it)} trocar=${() => setModal({ tipo: 'escolher', trocar: it })}/>`)}
      <${Adicionar} onTipo=${(tipo) => setModal({ tipo: 'escolher', tipoEx: tipo })}/>
      <label class="et-obs"><span>Observações do treino</span>
        <textarea class="input" rows="3" placeholder="Observações do treino..." value=${treino.observacoes || ''} onChange=${(ev) => salvarTreino(treino.id, { observacoes: ev.target.value || null })}></textarea></label>
    </section>`}

    ${modal && modal.tipo === 'treino' && html`<${ModalTreino} aluna=${aluna} treino=${modal.treino} ordem=${treinos.length} onFechar=${() => setModal(null)}
      onFeito=${(novo) => { setModal(null); if (novo) setAtual(novo.id); recarregar(); }}/>`}
    ${modal && modal.tipo === 'copiar' && html`<${ModalCopiar} aluna=${aluna} ordemInicial=${treinos.length} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
    ${modal && modal.tipo === 'escolher' && html`<${ModalEscolher} exercicios=${exercicios} tipo=${modal.trocar ? modal.trocar.tipo || 'musculacao' : modal.tipoEx} troca=${!!modal.trocar}
      onFechar=${() => setModal(null)} onEscolher=${(ex) => { if (modal.trocar) { salvarItem(modal.trocar.id, { exercicio_id: ex.id }); setModal(null); } else adicionar(modal.tipoEx, ex); }}/>`}
  </div>`;
}

// ---------- uma linha de exercício ----------
const numOuNull = (v) => { const n = lerNum(v); return n == null ? null : n; };
const opcoes = (lista, atual) => lista.map(([v, r]) => html`<option value=${v} selected=${String(atual) === String(v)}>${r}</option>`);
const CAD = [0, 1, 2, 3, 4, 5, 6].map((n) => [n, `${n}s`]);
const RIR = [0, 1, 2, 3, 4, 5].map((n) => [n, String(n)]);
const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => [n, String(n).replace('.', ',')]);

function Item({ it, ex, i, n, salvar, mover, remover, trocar }) {
  const tipo = it.tipo || 'musculacao';
  const [verObs, setVerObs] = useState(false);
  const faixa = lerFaixa(it.reps);
  const dt = it.descanso_tipo || 'exato';
  const et = it.esforco_tipo || 'rir';
  const mus = musculosDe(ex);
  const cel = (rotulo, corpo, extra) => html`<div class="cel"><div class="cel-rot">${rotulo}</div><div class=${'cel-corpo' + (extra ? ' ' + extra : '')}>${corpo}</div></div>`;
  const num = (campo, ph = '—') => html`<input class="cel-in" inputmode="numeric" placeholder=${ph} value=${it[campo] ?? ''} onChange=${(ev) => salvar({ [campo]: numOuNull(ev.target.value) ?? (campo === 'series' ? 1 : campo === 'aquecimento' ? 0 : null) })}/>`;
  return html`<article class=${'ex-item tipo-' + tipo}>
    <div class="ex-topo">
      <span class="ex-ordem"><button class="icone" aria-label="Subir" disabled=${i === 0} onClick=${() => mover(-1)}><${Icone} nome="subir" tam=${15}/></button>
        <button class="icone" aria-label="Descer" disabled=${i === n - 1} onClick=${() => mover(1)}><${Icone} nome="abaixo" tam=${15}/></button></span>
      <button class="icone" title="Trocar exercício" aria-label="Trocar exercício" onClick=${trocar}><${Icone} nome="trocar" tam=${18}/></button>
      <div class="ex-nome"><b>${ex ? ex.nome : '(exercício removido)'}</b>
        <small>${tipo !== 'musculacao' ? html`<span class="tipo-ponto" style=${`background:${TIPOS[tipo].cor}`}></span>${TIPOS[tipo].nome} · ` : ''}${mus.primarios.map((m) => MUSCULOS[m].nome).join(', ') || (ex && ex.grupo) || ''}</small></div>
      <div class="ex-acoes">
        <button class=${'icone' + (it.obs || verObs ? ' on' : '')} title="Observação para a aluna" aria-label="Observação" onClick=${() => setVerObs(!verObs)}><${Icone} nome="comentario" tam=${17}/></button>
        ${ex && ex.video_url ? html`<a class="icone" title="Ver vídeo" aria-label="Ver vídeo" href=${ex.video_url} target="_blank" rel="noopener"><${Icone} nome="video" tam=${17}/></a>`
          : html`<span class="icone apagado" title="Sem vídeo na biblioteca"><${Icone} nome="video" tam=${17}/></span>`}
        <button class="icone perigo" title="Remover" aria-label="Remover" onClick=${remover}><${Icone} nome="lixeira" tam=${17}/></button>
      </div>
    </div>
    ${tipo === 'aerobico' ? html`<div class="ex-campos">
        ${cel('Duração (min)', num('duracao'))}
        ${cel('Intensidade', html`<input class="cel-in" placeholder="Ex.: zona 2, FC 130-150" value=${it.intensidade || ''} onChange=${(ev) => salvar({ intensidade: ev.target.value || null })}/>`)}
        ${cel('Método', html`<select class="cel-in" onChange=${(ev) => salvar({ metodo: ev.target.value })}>${opcoes(METODOS_AEROBICO, it.metodo || 'continuo')}</select>`)}
      </div>`
    : html`<div class="ex-campos">
        ${cel('Séries', num('series'))}
        ${cel('Aquec.', num('aquecimento', '0'))}
        ${cel('Faixa de repetições', html`<input class="cel-in" placeholder="—" value=${faixa.min} onChange=${(ev) => salvar({ reps: juntarFaixa(ev.target.value, faixa.max) })}/><span class="cel-div"></span>
          <input class="cel-in" placeholder="—" value=${faixa.max} onChange=${(ev) => salvar({ reps: juntarFaixa(faixa.min, ev.target.value) })}/>`, 'duplo')}
        ${cel('Cadência', html`<label class="cad">Exc<select class="cel-in" onChange=${(ev) => salvar({ cadencia_exc: Number(ev.target.value), cadencia_con: it.cadencia_con ?? 0 })}>${opcoes(CAD, it.cadencia_exc ?? 2)}</select></label>
          <label class="cad">Con<select class="cel-in" onChange=${(ev) => salvar({ cadencia_con: Number(ev.target.value), cadencia_exc: it.cadencia_exc ?? 2 })}>${opcoes(CAD, it.cadencia_con ?? 0)}</select></label>`, 'duplo')}
        ${cel(html`<select class="cel-sel" aria-label="Formato do descanso" onChange=${(ev) => salvar({ descanso_tipo: ev.target.value })}>${opcoes(DESCANSOS, dt)}</select>`,
          dt === 'livre' ? html`<span class="cel-txt">até recuperar</span>`
          : dt === 'faixa' ? html`${num('descanso')}<span class="cel-div"></span>${num('descanso_max')}` : num('descanso'), dt === 'faixa' ? 'duplo' : '')}
        ${cel('Método', html`<select class="cel-in" onChange=${(ev) => salvar({ metodo: ev.target.value })}>${opcoes(METODOS, it.metodo || 'padrao')}</select>`)}
        ${cel(html`<select class="cel-sel" aria-label="Escala de esforço" onChange=${(ev) => salvar({ esforco_tipo: ev.target.value, esforco_alvo: null })}>${opcoes([['rir', 'RIR'], ['rpe', 'RPE']], et)}</select>`,
          html`<select class="cel-in" onChange=${(ev) => salvar({ esforco_tipo: et, esforco_alvo: ev.target.value === '' ? null : Number(ev.target.value) })}>
            <option value="" selected=${it.esforco_alvo == null}>—</option>${opcoes(et === 'rpe' ? RPE : RIR, it.esforco_alvo)}</select>`)}
      </div>`}
    ${(verObs || it.obs || (it.metodo && it.metodo !== 'padrao' && it.tecnica)) && html`<div class="ex-obs">
      ${it.metodo && it.metodo !== 'padrao' && tipo !== 'aerobico' && html`<input class="input" placeholder="Detalhe do método (ex.: 2 drops de 20%)" value=${it.tecnica || ''} onChange=${(ev) => salvar({ tecnica: ev.target.value || null })}/>`}
      ${(verObs || it.obs) && html`<textarea class="input" rows="2" placeholder="Observação para a aluna" value=${it.obs || ''} onChange=${(ev) => salvar({ obs: ev.target.value || null })}></textarea>`}
    </div>`}
  </article>`;
}

// ---------- replicar valores ----------
function Replicar({ onAplicar, desativado }) {
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState([]);
  const ref = useFora(() => setAberto(false));
  const alterna = (k) => setSel(sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k]);
  return html`<div class="pop" ref=${ref}>
    <button class=${'pop-botao' + (aberto ? ' on' : '')} disabled=${desativado} title=${desativado ? 'Precisa de 2 exercícios ou mais' : ''} onClick=${() => setAberto(!aberto)}>Replicar valores <${Icone} nome=${aberto ? 'subir' : 'abaixo'} tam=${15}/></button>
    ${aberto && html`<div class="pop-caixa replicar">
      <p class="pop-dica">Copia do 1º exercício para os outros deste treino</p>
      ${REPLICAR.map(([k, r]) => html`<label class="rep-op"><input type="checkbox" checked=${sel.includes(k)} onChange=${() => alterna(k)}/><span>${r}</span></label>`)}
      <div class="rep-rodape">
        <button class="btn-texto" onClick=${() => setSel(sel.length === REPLICAR.length ? [] : REPLICAR.map(([k]) => k))}>${sel.length === REPLICAR.length ? 'Nenhum' : 'Todos'}</button>
        <button class="btn mini primario" disabled=${!sel.length} onClick=${() => { onAplicar(sel); setAberto(false); }}>Aplicar</button></div>
    </div>`}
  </div>`;
}

// ---------- volume por grupo muscular ----------
function Volume({ doTreino, daFicha, exercicios }) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState('corpo');
  const [vista, setVista] = useState('frente');
  const [escopo, setEscopo] = useState('treino');
  const [fechados, setFechados] = useState([]);
  const ref = useFora(() => setAberto(false));
  const base = escopo === 'treino' ? doTreino : daFicha;
  const vol = volumePorMusculo(base, exercicios);
  const total = seriesValidas(doTreino);
  const grupos = GRUPOS_MUSC.map((g) => {
    const ms = Object.keys(MUSCULOS).filter((m) => MUSCULOS[m].grupo === g && vol[m] > 0).sort((a, b) => vol[b] - vol[a]);
    return { g, ms, soma: ms.reduce((t, m) => t + vol[m], 0) };
  }).filter((x) => x.ms.length);
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');
  return html`<div class="pop" ref=${ref}>
    <button class=${'pop-botao' + (aberto ? ' on' : '')} onClick=${() => setAberto(!aberto)}>Volume <b class="acento">${total} séries</b> <${Icone} nome=${aberto ? 'subir' : 'abaixo'} tam=${15}/></button>
    ${aberto && html`<div class="pop-caixa volume">
      <div class="vol-topo"><div><b>Volume por grupo muscular</b><small>${escopo === 'treino' ? 'Séries semanais neste treino' : 'Séries semanais da ficha (treinos fixos, 1× por semana)'}</small></div>
        <button class=${'icone quadrado' + (modo === 'lista' ? ' on' : '')} aria-label=${modo === 'corpo' ? 'Ver lista' : 'Ver corpo'} onClick=${() => setModo(modo === 'corpo' ? 'lista' : 'corpo')}><${Icone} nome="grafico" tam=${18}/></button></div>
      <div class="chips mini">${[['treino', 'Este treino'], ['ficha', 'Ficha inteira']].map(([k, r]) => html`<button class=${escopo === k ? 'chip on' : 'chip'} onClick=${() => setEscopo(k)}>${r}</button>`)}</div>
      ${modo === 'corpo' ? html`<div class="vol-corpo">
          <button class="icone vol-girar" aria-label="Virar o corpo" onClick=${() => setVista(vista === 'frente' ? 'costas' : 'frente')}><${Icone} nome="girar" tam=${18}/></button>
          <${MapaCorpo} valores=${vol} vista=${vista} largura=${170}/>
          <small>${vista === 'frente' ? 'Visão frontal' : 'Visão posterior'}</small>
          <div class="vol-legenda"><span>Intensidade:</span><i></i><span>0%</span><span>100%</span></div></div>`
      : html`<div class="vol-lista">${grupos.length ? grupos.map(({ g, ms, soma }) => { const f = fechados.includes(g);
          return html`<div class="vol-grupo">
            <button class="vol-grupo-cab" onClick=${() => setFechados(f ? fechados.filter((x) => x !== g) : [...fechados, g])}>
              <${Icone} nome=${f ? 'abaixo' : 'subir'} tam=${15}/><b>${g}</b><small>${ms.length} músculo${ms.length > 1 ? 's' : ''}</small><b class="vol-soma">${f1(soma).replace(',0', '')}</b></button>
            ${!f && ms.map((m) => { const [cls, rot] = nivelVolume(vol[m]);
              return html`<div class="vol-musc"><div class="vol-linha"><span>${MUSCULOS[m].nome}</span><span class=${'nivel ' + cls}>${rot}</span><b>${f1(vol[m])}</b></div>
                <div class="vol-barra"><i style=${`width:${Math.min(100, (vol[m] / REF_VOLUME) * 100)}%`}></i></div></div>`; })}
          </div>`; }) : html`<p class="suave">Nenhuma série de musculação ainda.</p>`}</div>
        <p class="vol-ref">Referência: 0 (baixo) · 5 (moderado) · 10 (alto) · 15 (altíssimo). Músculo principal conta 1 série; auxiliar conta 0,5.</p>`}
    </div>`}
  </div>`;
}

// fecha o popover ao tocar fora
function useFora(fn) {
  const ref = useRef();
  useEffect(() => {
    const f = (ev) => { if (ref.current && !ref.current.contains(ev.target)) fn(); };
    document.addEventListener('pointerdown', f); return () => document.removeEventListener('pointerdown', f);
  }, []);
  return ref;
}

// ---------- adicionar exercício ----------
function Adicionar({ onTipo }) {
  const [aberto, setAberto] = useState(false);
  const ref = useFora(() => setAberto(false));
  return html`<div class="adicionar" ref=${ref}>
    <span class="adicionar-linha"></span>
    <button class=${'adicionar-botao' + (aberto ? ' on' : '')} aria-label="Adicionar exercício" onClick=${() => setAberto(!aberto)}><${Icone} nome="mais" tam=${26}/></button>
    <span class="adicionar-linha"></span>
    <b class="adicionar-rot">Adicionar exercício</b>
    ${aberto && html`<div class="pop-caixa tipos"><p class="pop-titulo">Tipo de exercício</p>
      ${Object.entries(TIPOS).map(([k, t]) => html`<button class="tipo-op" onClick=${() => { setAberto(false); onTipo(k); }}>
        <span class="tipo-ico" style=${`color:${t.cor};background:${t.cor}22`}><${Icone} nome=${k === 'aerobico' ? 'relogio' : k === 'musculacao' ? 'exercicios' : k === 'crossfit' ? 'raio' : 'girar'} tam=${20}/></span>
        <span><b>${t.nome}</b><small>${t.sub}</small></span></button>`)}</div>`}
  </div>`;
}

function ModalEscolher({ exercicios, tipo, troca, onFechar, onEscolher }) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState(exercicios);
  const cardio = (x) => /cardio/i.test(x.grupo || '');
  const base = tipo === 'aerobico' ? [...lista.filter(cardio), ...lista.filter((x) => !cardio(x))] : lista.filter((x) => !cardio(x) || tipo === 'aquecimento');
  const achados = (busca ? base.filter((x) => (x.nome + ' ' + (x.grupo || '')).toLowerCase().includes(busca.toLowerCase())) : base).slice(0, 40);
  const criar = async () => { try { const [n] = await api.ins('exercicios', { nome: busca.trim(), grupo: tipo === 'aerobico' ? 'Cardio' : null }); exercicios.push(n); setLista([...exercicios]); onEscolher(n); } catch (err) { toast(err.message, 'erro'); } };
  return html`<${Modal} titulo=${troca ? 'Trocar exercício' : `Adicionar · ${TIPOS[tipo].nome}`} onFechar=${onFechar}><div class="pilha">
    <input class="input" type="search" placeholder="Buscar na biblioteca" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} autofocus/>
    <div class="escolher-lista">${achados.map((x) => { const m = musculosDe(x);
      return html`<button class="escolher-op" onClick=${() => onEscolher(x)}><b>${x.nome}</b><small>${m.primarios.map((k) => MUSCULOS[k].nome).join(', ') || x.grupo || ''}</small></button>`; })}
      ${busca.trim() && !exercicios.some((x) => x.nome.toLowerCase() === busca.trim().toLowerCase()) && html`<button class="escolher-op criar" onClick=${criar}>+ Criar "${busca.trim()}" na biblioteca</button>`}</div>
  </div><//>`;
}

// ---------- treino ----------
function ModalTreino({ aluna, treino, ordem, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: treino ? treino.nome : `Treino ${String.fromCharCode(65 + ordem)}`, opcional: treino ? treino.opcional : false, ativo: treino ? treino.ativo : true });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) return;
    try {
      if (treino) { await api.upd('treinos', treino.id, f); onFeito(); }
      else { const [novo] = await api.ins('treinos', { ...f, aluna_id: aluna.id, ordem }); onFeito(novo); }
    } catch (err) { toast(err.message, 'erro'); }
  };
  const duplicar = async () => {
    try {
      const [novo] = await api.ins('treinos', { aluna_id: aluna.id, nome: `${treino.nome} (cópia)`, ordem, opcional: treino.opcional, observacoes: treino.observacoes, ativo: treino.ativo });
      const its = await api.q('treino_itens', { eq: { treino_id: treino.id } });
      const linhas = its.map(({ id, treino_id, ...r }) => ({ ...r, treino_id: novo.id }));
      if (linhas.length) await api.ins('treino_itens', linhas);
      onFeito(novo);
    } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm(`Apagar o treino "${treino.nome}" e todos os exercícios dele? O histórico de cargas da aluna continua salvo.`)) return; try { await api.del('treinos', treino.id); onFeito(); } catch (err) { toast(err.message, 'erro'); } };
  return html`<${Modal} titulo=${treino ? 'Editar treino' : 'Criar treino'} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <${Campo} rotulo="Nome" dica="Ex.: A · Inferior posterior"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
      <label class="toggle"><input type="checkbox" checked=${f.opcional} onChange=${(ev) => setF({ ...f, opcional: ev.target.checked })}/> Treino opcional (não conta para fechar a semana)</label>
      <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Visível para a aluna</label>
      <button class="btn primario grande">Salvar</button>
      ${treino && html`<button type="button" class="btn" onClick=${duplicar}>Duplicar treino</button>
        <button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar treino</button>`}
    </form><//>`;
}

function ModalCopiar({ aluna, ordemInicial, onFechar, onFeito }) {
  const e = useCarregar(async () => (await api.q('profiles', { eq: { role: 'student' }, order: 'nome' })).filter((a) => a.id !== aluna.id), []);
  const [origem, setOrigem] = useState('');
  const [copiando, setCopiando] = useState(false);
  const copiarFicha = async () => {
    setCopiando(true);
    try {
      const [ts, its] = await Promise.all([api.q('treinos', { eq: { aluna_id: origem }, order: 'ordem' }), api.q('treino_itens', { eq: { aluna_id: origem } })]);
      if (!ts.length) { toast('Essa aluna não tem treinos.', 'erro'); setCopiando(false); return; }
      for (const [k, t] of ts.entries()) {
        const [novo] = await api.ins('treinos', { aluna_id: aluna.id, nome: t.nome, ordem: ordemInicial + k, opcional: t.opcional, observacoes: t.observacoes, ativo: t.ativo });
        const linhas = its.filter((i) => i.treino_id === t.id).map(({ id, treino_id, aluna_id, ...r }) => ({ ...r, treino_id: novo.id, aluna_id: aluna.id }));
        if (linhas.length) await api.ins('treino_itens', linhas);
      }
      toast(`${ts.length} treino(s) importado(s)`, 'ok'); onFeito();
    } catch (err) { toast(err.message, 'erro'); setCopiando(false); }
  };
  return html`<${Modal} titulo="Importar treinos" onFechar=${onFechar}>
    <${Estado} e=${e}>${(lista) => html`<div class="pilha">
      <p class="suave">Os treinos da outra aluna são adicionados à ficha de ${aluna.nome}. Depois você ajusta o que precisar.</p>
      <select class="input" value=${origem} onChange=${(ev) => setOrigem(ev.target.value)}><option value="">Escolha a aluna</option>${lista.map((a) => html`<option value=${a.id}>${a.nome}</option>`)}</select>
      <button class="btn primario grande" disabled=${!origem || copiando} onClick=${copiarFicha}>${copiando ? 'Importando...' : 'Importar treinos'}</button>
    </div>`}<//><//>`;
}
