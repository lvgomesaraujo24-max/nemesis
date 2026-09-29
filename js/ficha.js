// Editor de treinos (Forja): serve para a ficha da aluna e para os modelos.
// Treinos em abas, exercícios editados na própria linha, presets de linha, replicar valores,
// tempo estimado, barra de volume semanal ao vivo (faixas por nível) e mapa do corpo.
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Mesociclo } from './extras.js';
import { Icone } from './icones.js';
import { MapaCorpo } from './corpo.js';
import { MUSCULOS, GRUPOS_MUSC, TIPOS, METODOS, METODOS_AEROBICO, DESCANSOS, REPS_TIPOS, NIVEIS, GRUPOS_TREINO, musculosDe, tipoDoTreino,
  lerFaixa, juntarFaixa, tipoReps, repsPara, numeroReps, tempoTreino, fmtTempo, volumePorMusculo, volumePorGrupo, faixaGrupo, statusFaixa,
  seriesValidas, nivelVolume, REF_VOLUME } from './musculos.js';
import { useCarregar, Estado, Modal, Campo, toast, lerNum } from './util.js';
import { ComoFunciona } from './comum.js';

const PADRAO = {
  musculacao: { series: 3, reps: '8-12', reps_tipo: 'faixa', descanso: 90, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
  aquecimento: { series: 2, reps: '15', reps_tipo: 'exata', descanso: 30, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
  aerobico: { series: 1, reps: '', descanso: 0, descanso_tipo: 'livre', metodo: 'continuo', aquecimento: 0, duracao: 20 },
  crossfit: { series: 3, reps: '10', reps_tipo: 'exata', descanso: 60, descanso_tipo: 'exato', metodo: 'padrao', aquecimento: 0 },
};
// o que o "Replicar valores" copia do 1º exercício para os outros
const REPLICAR = [['reps', 'Repetições', ['reps', 'reps_tipo']], ['metodo', 'Método', ['metodo', 'tecnica']], ['series', 'Séries', ['series']],
  ['cadencia', 'Cadência', ['cadencia_exc', 'cadencia_con']], ['intervalo', 'Intervalo', ['descanso', 'descanso_tipo', 'descanso_max']],
  ['aquecimento', 'Séries de aquecimento', ['aquecimento']], ['esforco', 'RIR/RPE', ['esforco_tipo', 'esforco_alvo']]];
// o que um preset de linha guarda
const CAMPOS_PRESET = ['series', 'aquecimento', 'reps', 'reps_tipo', 'cadencia_exc', 'cadencia_con', 'descanso', 'descanso_tipo', 'descanso_max', 'metodo', 'tecnica', 'esforco_tipo', 'esforco_alvo'];

// dono dos treinos: uma aluna (ficha) ou um modelo
const donoDe = (aluna, modelo) => (aluna ? { campo: 'aluna_id', id: aluna.id, tabela: 'profiles', nivel: aluna.nivel, aluna } : { campo: 'modelo_id', id: modelo.id, tabela: 'modelos', nivel: modelo.nivel, modelo });
const colunasDono = (dono) => ({ aluna_id: dono.campo === 'aluna_id' ? dono.id : null, modelo_id: dono.campo === 'modelo_id' ? dono.id : null });

// copia todos os treinos de um dono para outro (aluna -> aluna, modelo -> aluna, aluna -> modelo)
export async function copiarTreinos(origem, destino, ordemInicial = 0) {
  const [ts, its] = await Promise.all([api.q('treinos', { eq: { [origem.campo]: origem.id }, order: 'ordem' }), api.q('treino_itens', { eq: { [origem.campo]: origem.id } })]);
  for (const [k, t] of ts.entries()) {
    const [novo] = await api.ins('treinos', { ...colunasDono(destino), nome: t.nome, ordem: ordemInicial + k, opcional: t.opcional, observacoes: t.observacoes, ativo: t.ativo });
    const linhas = its.filter((i) => i.treino_id === t.id).map(({ id, treino_id, aluna_id, modelo_id, created_at, ...r }) => ({ ...r, ...colunasDono(destino), treino_id: novo.id }));
    if (linhas.length) await api.ins('treino_itens', linhas);
  }
  return ts.length;
}

export function Ficha({ aluna, modelo }) {
  const dono = donoDe(aluna, modelo);
  const e = useCarregar(async () => {
    const [treinos, itens, exercicios, presets] = await Promise.all([
      api.q('treinos', { eq: { [dono.campo]: dono.id }, order: 'ordem' }),
      api.q('treino_itens', { eq: { [dono.campo]: dono.id }, order: 'ordem' }),
      api.q('exercicios', { order: 'nome' }),
      api.q('presets_linha', { order: 'nome' }).catch(() => []),
    ]);
    return { treinos, itens, exercicios, presets };
  }, [dono.id]);
  return html`<${Estado} e=${e}>${(d) => html`<${Editor} dono=${dono} d=${d} recarregar=${e.recarregar}/>`}<//>`;
}

function Editor({ dono, d, recarregar }) {
  const [itens, setItens] = useState(d.itens);
  const [treinos, setTreinos] = useState(d.treinos);
  const [presets, setPresets] = useState(d.presets);
  const [nivel, setNivelLocal] = useState(dono.nivel || 'intermediaria');
  const primeiro = (ts) => (ts.find((t) => t.ativo) || ts[0] || {}).id || null;
  const [atual, setAtual] = useState(() => primeiro(d.treinos));
  const [modal, setModal] = useState(null);
  const [arrasto, setArrasto] = useState(null); // { de, sobre }
  useEffect(() => {
    setItens(d.itens); setTreinos(d.treinos); setPresets(d.presets);
    if (!d.treinos.some((t) => t.id === atual)) setAtual(primeiro(d.treinos));
  }, [d]);
  const exercicios = d.exercicios;
  const treino = treinos.find((t) => t.id === atual);
  const doTreino = itens.filter((i) => i.treino_id === atual).sort((a, b) => a.ordem - b.ordem);
  const daFicha = itens.filter((i) => { const t = treinos.find((x) => x.id === i.treino_id); return t && t.ativo && !t.opcional; });
  const falha = (err) => { toast(err.message, 'erro'); recarregar(); };

  // salva na hora e mostra antes da resposta do banco
  const salvarItem = async (id, patch) => {
    setItens((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try { await api.upd('treino_itens', id, patch); } catch (err) { falha(err); }
  };
  const salvarTreino = async (id, patch) => {
    setTreinos((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try { await api.upd('treinos', id, patch); } catch (err) { falha(err); }
  };
  const setNivel = async (v) => { setNivelLocal(v); try { await api.upd(dono.tabela, dono.id, { nivel: v }); } catch (err) { toast(err.message, 'erro'); } };
  const reordenar = async (de, para) => {
    if (de === para || para < 0 || para >= doTreino.length) return;
    const l = [...doTreino]; const [x] = l.splice(de, 1); l.splice(para, 0, x);
    const mudou = l.map((it, i) => ({ it, i })).filter(({ it, i }) => it.ordem !== i);
    setItens((todos) => todos.map((t) => { const m = mudou.find((y) => y.it.id === t.id); return m ? { ...t, ordem: m.i } : t; }));
    try { for (const { it, i } of mudou) await api.upd('treino_itens', it.id, { ordem: i }); } catch (err) { falha(err); }
  };
  const moverTreino = async (dir) => {
    const i = treinos.findIndex((t) => t.id === atual); const j = i + dir; if (j < 0 || j >= treinos.length) return;
    try { await api.upd('treinos', treinos[i].id, { ordem: j }); await api.upd('treinos', treinos[j].id, { ordem: i }); recarregar(); } catch (err) { toast(err.message, 'erro'); }
  };
  const remover = async (it) => {
    if (!confirm('Remover este exercício do treino?')) return;
    setItens((l) => l.filter((x) => x.id !== it.id));
    try { await api.del('treino_itens', it.id); } catch (err) { falha(err); }
  };
  const adicionar = async (tipo, exs) => {
    try {
      const novos = await api.ins('treino_itens', exs.map((ex, k) => ({ ...PADRAO[tipo], tipo, exercicio_id: ex.id, treino_id: atual, ...colunasDono(dono), ordem: doTreino.length + k })));
      setItens((l) => [...l, ...novos]); setModal(null);
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
    catch (err) { falha(err); }
  };
  const salvarPreset = async (it) => {
    const nome = prompt('Nome do preset (ex.: Glúteo força)');
    if (!nome || !nome.trim()) return;
    const dados = Object.fromEntries(CAMPOS_PRESET.map((c) => [c, it[c] ?? null]));
    try { const [p] = await api.ins('presets_linha', { nome: nome.trim(), dados }); setPresets((l) => [...l, p].sort((a, b) => a.nome.localeCompare(b.nome))); toast('Preset salvo', 'ok'); }
    catch (err) { toast(err.message, 'erro'); }
  };
  const apagarPreset = async (p) => {
    if (!confirm(`Apagar o preset "${p.nome}"?`)) return;
    setPresets((l) => l.filter((x) => x.id !== p.id));
    try { await api.del('presets_linha', p.id); } catch (err) { toast(err.message, 'erro'); }
  };

  return html`<div class="pilha ficha-editor">
    ${dono.aluna && html`<${Mesociclo} aluna=${dono.aluna}/>`}
    <div class="treino-abas">
      ${treinos.map((t) => { const its = itens.filter((i) => i.treino_id === t.id);
        return html`<button class=${'treino-aba' + (t.id === atual ? ' on' : '') + (t.ativo ? '' : ' apagado')} onClick=${() => setAtual(t.id)}>
          <b>${t.nome}</b><small>${tipoDoTreino(its)}${t.opcional ? ' · opcional' : ''}</small></button>`; })}
      <button class="treino-aba nova" onClick=${() => setModal({ tipo: 'treino' })}><${Icone} nome="mais" tam=${16}/>Criar treino</button>
      <button class="treino-aba nova" onClick=${() => setModal({ tipo: 'importar' })}><${Icone} nome="copiar" tam=${16}/>Importar</button>
      ${dono.aluna && treinos.length > 0 && html`<button class="treino-aba nova" onClick=${() => setModal({ tipo: 'salvarModelo' })}><${Icone} nome="forja" tam=${16}/>Salvar como modelo</button>`}
    </div>

    ${!treino ? html`<${ComoFunciona} titulo=${dono.aluna ? 'Ficha vazia' : 'Modelo vazio'} passos=${[
        ['Crie os treinos', 'A, B, C... ou importe de um modelo pronto.'],
        ['Adicione os exercícios', 'Escolha o tipo e marque vários de uma vez na biblioteca.'],
        ['Prescreva na linha', 'Séries, repetições, cadência, descanso, método e RIR. Use presets para ir mais rápido.'],
        ['Confira o volume', 'A barra mostra as séries semanais por grupo, na faixa do nível dela.']]}>
        <button class="btn primario" onClick=${() => setModal({ tipo: 'treino' })}>Criar treino</button>
        <button class="btn" onClick=${() => setModal({ tipo: 'importar' })}>Importar</button><//>`
    : html`<section class="editor-treino">
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
      <${BarraVolume} doTreino=${doTreino} daFicha=${daFicha} exercicios=${exercicios} nivel=${nivel} onNivel=${setNivel}/>
      ${doTreino.map((it, i) => html`<${Item} key=${it.id} it=${it} ex=${exercicios.find((x) => x.id === it.exercicio_id)} i=${i} n=${doTreino.length} presets=${presets}
        salvar=${(p) => salvarItem(it.id, p)} mover=${(dir) => reordenar(i, i + dir)} remover=${() => remover(it)} trocar=${() => setModal({ tipo: 'escolher', trocar: it })}
        salvarPreset=${() => salvarPreset(it)} apagarPreset=${apagarPreset}
        arrasto=${arrasto} setArrasto=${setArrasto} soltar=${() => { if (arrasto) reordenar(arrasto.de, i); setArrasto(null); }}/>`)}
      <${Adicionar} onTipo=${(tipo) => setModal({ tipo: 'escolher', tipoEx: tipo })}/>
      <label class="et-obs"><span>Observações do treino</span>
        <textarea class="input" rows="3" placeholder="Observações do treino..." value=${treino.observacoes || ''} onChange=${(ev) => salvarTreino(treino.id, { observacoes: ev.target.value || null })}></textarea></label>
    </section>`}

    ${modal && modal.tipo === 'treino' && html`<${ModalTreino} dono=${dono} treino=${modal.treino} ordem=${treinos.length} onFechar=${() => setModal(null)}
      onFeito=${(novo) => { setModal(null); if (novo) setAtual(novo.id); recarregar(); }}/>`}
    ${modal && modal.tipo === 'importar' && html`<${ModalImportar} dono=${dono} ordemInicial=${treinos.length} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); recarregar(); }}/>`}
    ${modal && modal.tipo === 'salvarModelo' && html`<${ModalNovoModelo} origem=${dono} nomeInicial=${`Ficha de ${(dono.aluna.nome || '').split(' ')[0]}`} nivelInicial=${nivel} onFechar=${() => setModal(null)}
      onFeito=${() => { setModal(null); toast('Modelo salvo. Ele está em Modelos.', 'ok'); }}/>`}
    ${modal && modal.tipo === 'escolher' && html`<${ModalEscolher} exercicios=${exercicios} tipo=${modal.trocar ? modal.trocar.tipo || 'musculacao' : modal.tipoEx} troca=${!!modal.trocar}
      onFechar=${() => setModal(null)} onEscolher=${(exs) => { if (modal.trocar) { salvarItem(modal.trocar.id, { exercicio_id: exs[0].id }); setModal(null); } else adicionar(modal.tipoEx, exs); }}/>`}
  </div>`;
}

// ---------- barra de volume semanal (sempre visível) ----------
function BarraVolume({ doTreino, daFicha, exercicios, nivel, onNivel }) {
  const [escopo, setEscopo] = useState('ficha');
  const v = volumePorGrupo(escopo === 'ficha' ? daFicha : doTreino, exercicios);
  const grupos = GRUPOS_TREINO.filter(([k]) => v[k] > 0 || k === 'gluteo');
  const f1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  return html`<div class="barra-vol">
    <div class="bv-topo"><b>Volume semanal</b>
      <div class="chips mini">${[['ficha', 'Semana (ficha)'], ['treino', 'Este treino']].map(([k, r]) => html`<button class=${escopo === k ? 'chip on' : 'chip'} onClick=${() => setEscopo(k)}>${r}</button>`)}</div>
      <label class="bv-nivel">Nível <select onChange=${(ev) => onNivel(ev.target.value)}>${NIVEIS.map(([k, r]) => html`<option value=${k} selected=${nivel === k}>${r}</option>`)}</select></label></div>
    <div class="bv-grupos">${grupos.map(([k, nome]) => { const fx = faixaGrupo(k, nivel); const x = v[k] || 0;
      const [cls, rot] = escopo === 'ficha' ? statusFaixa(x, fx) : ['neutro', ''];
      const topo = fx[1] * 1.25;
      return html`<div class=${'bv-grupo ' + cls} title=${escopo === 'ficha' ? `${nome}: ${f1(x)} séries/semana · faixa ${fx[0]}–${fx[1]} (${rot})` : `${nome}: ${f1(x)} séries neste treino`}>
        <div class="bv-linha"><span>${nome}</span><b>${f1(x)}</b></div>
        <div class="bv-trilho">${escopo === 'ficha' && html`<span class="bv-faixa" style=${`left:${(fx[0] / topo) * 100}%;width:${((fx[1] - fx[0]) / topo) * 100}%`}></span>`}
          <i style=${`width:${Math.min(100, (x / topo) * 100)}%`}></i></div>
        ${escopo === 'ficha' && html`<small>${fx[0]}–${fx[1]}</small>`}</div>`; })}</div>
  </div>`;
}

// ---------- uma linha de exercício ----------
const numOuNull = (v) => { const n = lerNum(v); return n == null ? null : n; };
const opcoes = (lista, atual) => lista.map(([v, r]) => html`<option value=${v} selected=${String(atual) === String(v)}>${r}</option>`);
const CAD = [0, 1, 2, 3, 4, 5, 6].map((n) => [n, `${n}s`]);
const RIR = [0, 1, 2, 3, 4, 5].map((n) => [n, String(n)]);
const RPE = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => [n, String(n).replace('.', ',')]);

// converte o que já está escrito quando o formato das repetições muda
function trocarTipoReps(it, t) {
  const ns = numeroReps(it.reps).split('-').filter(Boolean);
  if (t === 'faixa') return { reps_tipo: t, reps: juntarFaixa(ns[0], ns[1]) };
  if (t === 'pir_cresc' || t === 'pir_decresc') return { reps_tipo: t, reps: ns.length > 2 ? ns.join('-') : t === 'pir_cresc' ? '12-10-8' : '8-10-12' };
  return { reps_tipo: t, reps: repsPara(t, ns[0] || (t === 'isometrica' ? '30' : t === 'reserva' ? '2' : '')) };
}

function CelReps({ it, salvar, cel }) {
  const t = tipoReps(it);
  const faixa = lerFaixa(it.reps);
  const unico = (ph) => html`<input class="cel-in" inputmode="numeric" placeholder=${ph} value=${numeroReps(it.reps)} onChange=${(ev) => salvar({ reps_tipo: t, reps: repsPara(t, ev.target.value) })}/>`;
  const corpo = t === 'faixa' ? html`<input class="cel-in" placeholder="—" value=${faixa.min} onChange=${(ev) => salvar({ reps_tipo: t, reps: juntarFaixa(ev.target.value, faixa.max) })}/><span class="cel-div"></span>
      <input class="cel-in" placeholder="—" value=${faixa.max} onChange=${(ev) => salvar({ reps_tipo: t, reps: juntarFaixa(faixa.min, ev.target.value) })}/>`
    : t === 'exata' ? unico('10')
    : t === 'reserva' ? html`${unico('2')}<span class="cel-txt">na reserva</span>`
    : t === 'isometrica' ? html`${unico('30')}<span class="cel-txt">seg</span>`
    : t === 'maxima' ? html`<span class="cel-txt">máximas</span>`
    : t === 'falha' ? html`<span class="cel-txt">até a falha</span>`
    : html`<input class="cel-in" placeholder=${t === 'pir_cresc' ? '12-10-8' : '8-10-12'} value=${it.reps || ''} onChange=${(ev) => salvar({ reps_tipo: t, reps: numeroReps(ev.target.value) })}/>`;
  return cel(html`<select class="cel-sel" aria-label="Formato das repetições" onChange=${(ev) => salvar(trocarTipoReps(it, ev.target.value))}>${opcoes(REPS_TIPOS, t)}</select>`, corpo, 'duplo');
}

function Item({ it, ex, i, n, presets, salvar, mover, remover, trocar, salvarPreset, apagarPreset, arrasto, setArrasto, soltar }) {
  const tipo = it.tipo || 'musculacao';
  const [verObs, setVerObs] = useState(false);
  const ref = useRef();
  const dt = it.descanso_tipo || 'exato';
  const et = it.esforco_tipo || 'rir';
  const mus = musculosDe(ex);
  const cel = (rotulo, corpo, extra) => html`<div class="cel"><div class="cel-rot">${rotulo}</div><div class=${'cel-corpo' + (extra ? ' ' + extra : '')}>${corpo}</div></div>`;
  const num = (campo, ph = '—') => html`<input class="cel-in" inputmode="numeric" placeholder=${ph} value=${it[campo] ?? ''} onChange=${(ev) => salvar({ [campo]: numOuNull(ev.target.value) ?? (campo === 'series' ? 1 : campo === 'aquecimento' ? 0 : null) })}/>`;
  const sobre = arrasto && arrasto.sobre === i && arrasto.de !== i;
  return html`<article ref=${ref} class=${'ex-item tipo-' + tipo + (arrasto && arrasto.de === i ? ' arrastando' : '') + (sobre ? ' sobre' : '')}
    onDragOver=${(ev) => { if (!arrasto) return; ev.preventDefault(); if (arrasto.sobre !== i) setArrasto({ ...arrasto, sobre: i }); }}
    onDrop=${(ev) => { ev.preventDefault(); soltar(); }}>
    <div class="ex-topo">
      <span class="ex-grip" draggable="true" title="Arraste para reordenar" aria-hidden="true"
        onDragStart=${(ev) => { ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', String(i)); ev.dataTransfer.setDragImage(ref.current, 30, 20); } catch (e) { /* */ } setArrasto({ de: i, sobre: i }); }}
        onDragEnd=${() => setArrasto(null)}><${Icone} nome="arrastar" tam=${16}/></span>
      <span class="ex-ordem"><button class="icone" aria-label="Subir" disabled=${i === 0} onClick=${() => mover(-1)}><${Icone} nome="subir" tam=${15}/></button>
        <button class="icone" aria-label="Descer" disabled=${i === n - 1} onClick=${() => mover(1)}><${Icone} nome="abaixo" tam=${15}/></button></span>
      <button class="icone" title="Trocar exercício" aria-label="Trocar exercício" onClick=${trocar}><${Icone} nome="trocar" tam=${18}/></button>
      <div class="ex-nome"><b>${ex ? ex.nome : '(exercício removido)'}</b>
        <small>${tipo !== 'musculacao' ? html`<span class="tipo-ponto" style=${`background:${TIPOS[tipo].cor}`}></span>${TIPOS[tipo].nome} · ` : ''}${mus.primarios.map((m) => MUSCULOS[m].nome).join(', ') || (ex && ex.grupo) || ''}</small></div>
      <div class="ex-acoes">
        ${tipo !== 'aerobico' && html`<${Presets} presets=${presets} aplicar=${(p) => salvar(p.dados)} salvarPreset=${salvarPreset} apagarPreset=${apagarPreset}/>`}
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
        <${CelReps} it=${it} salvar=${salvar} cel=${cel}/>
        ${cel('Cadência', html`<label class="cad">Exc<select class="cel-in" onChange=${(ev) => salvar({ cadencia_exc: Number(ev.target.value), cadencia_con: it.cadencia_con ?? 0 })}>${opcoes(CAD, it.cadencia_exc ?? 2)}</select></label>
          <label class="cad">Con<select class="cel-in" onChange=${(ev) => salvar({ cadencia_con: Number(ev.target.value), cadencia_exc: it.cadencia_exc ?? 2 })}>${opcoes(CAD, it.cadencia_con ?? 0)}</select></label>`, 'duplo')}
        ${cel(html`<select class="cel-sel" aria-label="Formato do descanso" onChange=${(ev) => salvar({ descanso_tipo: ev.target.value })}>${opcoes(DESCANSOS, dt)}</select>`,
          dt === 'livre' ? html`<span class="cel-txt">o quanto precisar</span>`
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

// ---------- presets de linha ----------
function Presets({ presets, aplicar, salvarPreset, apagarPreset }) {
  const [aberto, setAberto] = useState(false);
  const ref = useFora(() => setAberto(false));
  const resumo = (d) => [d.series && `${d.series}×${d.reps || '·'}`, d.esforco_alvo != null && `${(d.esforco_tipo || 'rir').toUpperCase()} ${d.esforco_alvo}`,
    d.cadencia_exc != null && `${d.cadencia_exc}s exc.`, d.descanso_tipo === 'livre' ? 'descanso livre' : d.descanso && `${d.descanso}s`].filter(Boolean).join(' · ');
  return html`<div class="pop" ref=${ref}>
    <button class=${'icone' + (aberto ? ' on' : '')} title="Presets de linha" aria-label="Presets de linha" onClick=${() => setAberto(!aberto)}><${Icone} nome="preset" tam=${17}/></button>
    ${aberto && html`<div class="pop-caixa presets"><p class="pop-titulo">Presets de linha</p>
      ${presets.length ? presets.map((p) => html`<div class="preset-op"><button onClick=${() => { aplicar(p); setAberto(false); }}><b>${p.nome}</b><small>${resumo(p.dados || {})}</small></button>
        <button class="icone" aria-label=${`Apagar ${p.nome}`} onClick=${() => apagarPreset(p)}><${Icone} nome="lixeira" tam=${15}/></button></div>`)
        : html`<p class="pop-dica">Salve combinações que você usa sempre, como "Glúteo força: 4×6–8, RIR 2, 2s excêntrica, 120s".</p>`}
      <div class="rep-rodape"><button class="btn-texto" onClick=${() => { setAberto(false); salvarPreset(); }}>+ Salvar esta linha como preset</button></div>
    </div>`}
  </div>`;
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
export function useFora(fn) {
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

// busca na biblioteca; ao adicionar dá para marcar vários de uma vez
function ModalEscolher({ exercicios, tipo, troca, onFechar, onEscolher }) {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState(exercicios);
  const [sel, setSel] = useState([]);
  const cardio = (x) => /cardio/i.test(x.grupo || '');
  const base = tipo === 'aerobico' ? [...lista.filter(cardio), ...lista.filter((x) => !cardio(x))] : lista.filter((x) => !cardio(x) || tipo === 'aquecimento');
  const achados = (busca ? base.filter((x) => (x.nome + ' ' + (x.grupo || '')).toLowerCase().includes(busca.toLowerCase())) : base).slice(0, 60);
  const clicar = (x) => (troca ? onEscolher([x]) : setSel(sel.some((y) => y.id === x.id) ? sel.filter((y) => y.id !== x.id) : [...sel, x]));
  const criar = async () => {
    try { const [n] = await api.ins('exercicios', { nome: busca.trim(), grupo: tipo === 'aerobico' ? 'Cardio' : null }); exercicios.push(n); setLista([...exercicios]); setBusca(''); clicar(n); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${troca ? 'Trocar exercício' : `Adicionar · ${TIPOS[tipo].nome}`} onFechar=${onFechar}><div class="pilha">
    <input class="input" type="search" placeholder="Buscar na biblioteca" value=${busca} onInput=${(ev) => setBusca(ev.target.value)} autofocus/>
    ${!troca && html`<small>Toque para marcar vários e adicione todos de uma vez.</small>`}
    <div class="escolher-lista">${achados.map((x) => { const m = musculosDe(x); const on = sel.some((y) => y.id === x.id);
      return html`<button class=${'escolher-op' + (on ? ' on' : '')} onClick=${() => clicar(x)}>
        ${!troca && html`<span class=${'caixa' + (on ? ' on' : '')}>${on ? '✓' : ''}</span>`}
        <span class="escolher-txt"><b>${x.nome}</b><small>${m.primarios.map((k) => MUSCULOS[k].nome).join(', ') || x.grupo || ''}</small></span>
        ${x.video_url && html`<${Icone} nome="video" tam=${16} class="suave-ico"/>`}</button>`; })}
      ${busca.trim() && !exercicios.some((x) => x.nome.toLowerCase() === busca.trim().toLowerCase()) && html`<button class="escolher-op criar" onClick=${criar}>+ Criar "${busca.trim()}" na biblioteca</button>`}</div>
    ${!troca && html`<button class="btn primario grande" disabled=${!sel.length} onClick=${() => onEscolher(sel)}>${sel.length ? `Adicionar ${sel.length} exercício${sel.length > 1 ? 's' : ''}` : 'Marque os exercícios'}</button>`}
  </div><//>`;
}

// ---------- treino ----------
function ModalTreino({ dono, treino, ordem, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: treino ? treino.nome : `Treino ${String.fromCharCode(65 + ordem)}`, opcional: treino ? treino.opcional : false, ativo: treino ? treino.ativo : true });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) return;
    try {
      if (treino) { await api.upd('treinos', treino.id, f); onFeito(); }
      else { const [novo] = await api.ins('treinos', { ...f, ...colunasDono(dono), ordem }); onFeito(novo); }
    } catch (err) { toast(err.message, 'erro'); }
  };
  const duplicar = async () => {
    try {
      const [novo] = await api.ins('treinos', { ...colunasDono(dono), nome: `${treino.nome} (cópia)`, ordem, opcional: treino.opcional, observacoes: treino.observacoes, ativo: treino.ativo });
      const its = await api.q('treino_itens', { eq: { treino_id: treino.id } });
      const linhas = its.map(({ id, treino_id, created_at, ...r }) => ({ ...r, treino_id: novo.id }));
      if (linhas.length) await api.ins('treino_itens', linhas);
      onFeito(novo);
    } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm(`Apagar o treino "${treino.nome}" e todos os exercícios dele?${dono.aluna ? ' O histórico de cargas da aluna continua salvo.' : ''}`)) return; try { await api.del('treinos', treino.id); onFeito(); } catch (err) { toast(err.message, 'erro'); } };
  return html`<${Modal} titulo=${treino ? 'Editar treino' : 'Criar treino'} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <${Campo} rotulo="Nome" dica="Ex.: A · Inferior posterior"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })} autofocus/><//>
      <label class="toggle"><input type="checkbox" checked=${f.opcional} onChange=${(ev) => setF({ ...f, opcional: ev.target.checked })}/> Treino opcional (não conta para fechar a semana)</label>
      <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> ${dono.aluna ? 'Visível para a aluna' : 'Ativo no modelo'}</label>
      <button class="btn primario grande">${treino ? 'Salvar' : 'Criar treino'}</button>
      ${treino && html`<button type="button" class="btn" onClick=${duplicar}>Duplicar treino</button>
        <button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar treino</button>`}
    </form><//>`;
}

// importa de um modelo ou da ficha de outra aluna
function ModalImportar({ dono, ordemInicial, onFechar, onFeito }) {
  const e = useCarregar(async () => {
    const [modelos, alunas] = await Promise.all([api.q('modelos', { order: 'nome' }).catch(() => []), api.q('profiles', { eq: { role: 'student' }, order: 'nome' })]);
    return { modelos: modelos.filter((m) => m.id !== dono.id), alunas: alunas.filter((a) => a.id !== dono.id) };
  }, []);
  const [fonte, setFonte] = useState('modelo');
  const [origem, setOrigem] = useState('');
  const [copiando, setCopiando] = useState(false);
  const importar = async () => {
    setCopiando(true);
    try {
      const n = await copiarTreinos({ campo: fonte === 'modelo' ? 'modelo_id' : 'aluna_id', id: origem }, dono, ordemInicial);
      if (!n) { toast('Não há treinos para importar aí.', 'erro'); setCopiando(false); return; }
      toast(`${n} treino(s) importado(s)`, 'ok'); onFeito();
    } catch (err) { toast(err.message, 'erro'); setCopiando(false); }
  };
  return html`<${Modal} titulo="Importar treinos" onFechar=${onFechar}>
    <${Estado} e=${e}>${({ modelos, alunas }) => { const lista = fonte === 'modelo' ? modelos : alunas;
      return html`<div class="pilha">
        <div class="chips">${[['modelo', 'De um modelo'], ['aluna', 'Da ficha de outra aluna']].map(([k, r]) => html`<button class=${fonte === k ? 'chip on' : 'chip'} onClick=${() => { setFonte(k); setOrigem(''); }}>${r}</button>`)}</div>
        <p class="suave">Os treinos são adicionados ${dono.aluna ? `à ficha de ${dono.aluna.nome}` : 'a este modelo'}. Depois você ajusta o que precisar.</p>
        ${lista.length ? html`<select class="input" value=${origem} onChange=${(ev) => setOrigem(ev.target.value)}><option value="">${fonte === 'modelo' ? 'Escolha o modelo' : 'Escolha a aluna'}</option>
          ${lista.map((x) => html`<option value=${x.id}>${x.nome}${x.nivel ? ` · ${(NIVEIS.find(([k]) => k === x.nivel) || [, ''])[1]}` : ''}</option>`)}</select>`
          : html`<p class="nota">${fonte === 'modelo' ? 'Nenhum modelo ainda. Crie em Modelos, no menu, ou salve uma ficha como modelo.' : 'Nenhuma outra aluna.'}</p>`}
        <button class="btn primario grande" disabled=${!origem || copiando} onClick=${importar}>${copiando ? 'Importando...' : 'Importar treinos'}</button>
      </div>`; }}<//><//>`;
}

// criar modelo sempre pede nome e nível antes (e pode nascer de uma ficha)
export function ModalNovoModelo({ origem, nomeInicial = '', nivelInicial = 'intermediaria', onFechar, onFeito }) {
  const [f, setF] = useState({ nome: nomeInicial, nivel: nivelInicial, descricao: '' });
  const [salvando, setSalvando] = useState(false);
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim()) { toast('Dê um nome ao modelo.', 'erro'); return; }
    setSalvando(true);
    try {
      const [m] = await api.ins('modelos', { nome: f.nome.trim(), nivel: f.nivel, descricao: f.descricao || null });
      if (origem) await copiarTreinos(origem, { campo: 'modelo_id', id: m.id }, 0);
      onFeito(m);
    } catch (err) { toast(err.message, 'erro'); setSalvando(false); }
  };
  return html`<${Modal} titulo=${origem ? 'Salvar ficha como modelo' : 'Novo modelo'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Nome" dica="Ex.: Glúteo 4x · intermediária"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })} autofocus/><//>
    <${Campo} rotulo="Nível"><div class="chips">${NIVEIS.map(([k, r]) => html`<button type="button" class=${f.nivel === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, nivel: k })}>${r}</button>`)}</div><//>
    <${Campo} rotulo="Descrição (opcional)"><textarea class="input" rows="2" value=${f.descricao} onInput=${(ev) => setF({ ...f, descricao: ev.target.value })}></textarea><//>
    <button class="btn primario grande" disabled=${salvando}>${salvando ? 'Salvando...' : origem ? 'Salvar modelo' : 'Criar modelo'}</button>
  </form><//>`;
}
