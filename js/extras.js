// Agenda semanal, validade da ficha (mesociclos), cardio, testes aeróbicos e metas.
import { html, useState } from '../lib/preact-htm.js';
import { api } from './api.js';
import { ModalCompromisso, dataLocal } from './comando.js';
import { useCarregar, Estado, Vazio, Modal, Campo, toast, num, dataBR, hoje, somaDias, diasEntre, lerNum, idadeDe, linkWhats } from './util.js';

// ============================================================
// AGENDA (visão semanal)
// ============================================================
const SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const segunda = (s) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dataLocal(d); };
export function Agenda({ ir }) {
  const [ini, setIni] = useState(segunda(hoje()));
  const [modal, setModal] = useState(null);
  const fim = somaDias(ini, 7);
  const e = useCarregar(async () => {
    const [ag, alunas, mesos, metas, ass] = await Promise.all([
      api.q('agenda', { gte: { inicio: new Date(ini + 'T00:00:00').toISOString() }, lte: { inicio: new Date(fim + 'T00:00:00').toISOString() }, order: 'inicio' }),
      api.q('profiles', { eq: { role: 'student', ativo: true } }), api.q('mesociclos', { eq: { status: 'ativo' } }),
      api.q('metas', { eq: { status: 'ativa' } }), api.q('assinaturas', { gte: { fim: ini }, lte: { fim } })]);
    return { ag, alunas, mesos, metas, ass };
  }, [ini]);
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Agenda de Chronos</h1><button class="btn primario" onClick=${() => setModal({})}>+ Compromisso</button></div>
    <div class="mes-nav"><button class="icone" aria-label="Semana anterior" onClick=${() => setIni(somaDias(ini, -7))}>‹</button><b>${dataBR(ini).slice(0, 5)} a ${dataBR(somaDias(ini, 6)).slice(0, 5)}</b><button class="icone" aria-label="Próxima semana" onClick=${() => setIni(somaDias(ini, 7))}>›</button></div>
    <${Estado} e=${e}>${({ ag, alunas, mesos, metas, ass }) => {
      const nome = (id) => ((alunas.find((a) => a.id === id) || {}).nome || '').split(' ')[0];
      const ativas = new Set(alunas.map((a) => a.id));
      const dias = [...Array(7)].map((_, i) => somaDias(ini, i));
      const doDia = (d) => [
        ...ag.filter((g) => dataLocal(new Date(g.inicio)) === d).map((g) => ({ k: g.id, hora: new Date(g.inicio).toTimeString().slice(0, 5), txt: g.titulo, sub: nome(g.aluna_id), g, feito: g.feito })),
        ...mesos.filter((m) => m.fim === d && ativas.has(m.aluna_id)).map((m) => ({ k: 'm' + m.id, hora: '★', txt: 'Ficha termina', sub: nome(m.aluna_id), aluna: m.aluna_id })),
        ...metas.filter((m) => m.prazo === d && ativas.has(m.aluna_id)).map((m) => ({ k: 'mt' + m.id, hora: '★', txt: 'Prazo de meta', sub: nome(m.aluna_id), aluna: m.aluna_id })),
        ...ass.filter((s) => s.fim === d && ativas.has(s.aluna_id)).map((s) => ({ k: 's' + s.id, hora: '◆', txt: 'Plano vence', sub: nome(s.aluna_id), aluna: s.aluna_id })),
        ...alunas.filter((a) => a.nascimento && a.nascimento.slice(5) === d.slice(5)).map((a) => ({ k: 'n' + a.id, hora: '★', txt: 'Aniversário', sub: nome(a.id), aluna: a.id })),
      ];
      return html`<div class="semana-grade">${dias.map((d, i) => html`<div class=${'semana-dia' + (d === hoje() ? ' hoje' : '')}>
        <h4>${SEM[i]} <small>${dataBR(d).slice(0, 5)}</small></h4>
        ${doDia(d).map((x) => html`<button class=${'semana-item' + (x.feito ? ' feito' : '') + (x.g ? '' : ' marco')} onClick=${() => (x.g ? setModal(x.g) : ir('aluna/' + x.aluna))}>
          <span>${x.hora}</span><b>${x.txt}</b>${x.sub && html`<small>${x.sub}</small>`}</button>`)}
        <button class="btn-texto mini" onClick=${() => setModal({ dia: d })}>+</button></div>`)}</div>
        <p class="suave">A fase do ciclo das alunas nunca aparece na agenda.</p>`;
    }}<//>
    ${modal && html`<${ModalCompromisso} inicial=${modal} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
  </div>`;
}

// ============================================================
// VALIDADE DA FICHA (mesociclo)
// ============================================================
export function Mesociclo({ aluna }) {
  const e = useCarregar(() => api.q('mesociclos', { eq: { aluna_id: aluna.id }, order: 'inicio', asc: false }), [aluna.id]);
  const [modal, setModal] = useState(null);
  return html`<${Estado} e=${e}>${(l) => {
    const atual = l.find((m) => m.status === 'ativo');
    const d = atual ? diasEntre(hoje(), atual.fim) : null;
    return html`<section class=${'card meso' + (d != null && d <= 7 ? ' limite' : '')}>
      <div class="card-topo"><div><h3>${atual ? atual.nome || 'Ficha atual' : 'Ficha sem validade'}</h3>
        <small>${atual ? `${dataBR(atual.inicio)} a ${dataBR(atual.fim)} · ${d < 0 ? `venceu há ${-d} dia(s)` : d === 0 ? 'vence hoje' : `vence em ${d} dia(s)`}` : 'Defina a validade para ela entrar em "Fichas no limite".'}</small></div>
        <div class="mini-acoes">${atual && html`<button class="btn-texto" onClick=${() => setModal({ m: atual })}>Editar</button>`}
          <button class="btn mini" onClick=${() => setModal({ novo: true, anterior: atual })}>${atual ? 'Nova ficha' : 'Definir validade'}</button></div></div>
      ${l.filter((m) => m.status === 'encerrado').length > 0 && html`<small>${l.filter((m) => m.status === 'encerrado').length} mesociclo(s) anterior(es)</small>`}
      ${modal && html`<${ModalMeso} aluna=${aluna} m=${modal.m} novo=${modal.novo} anterior=${modal.anterior} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
    </section>`;
  }}<//>`;
}
function ModalMeso({ aluna, m, novo, anterior, onFechar, onFeito }) {
  const [f, setF] = useState({ nome: m ? m.nome || '' : '', inicio: m ? m.inicio : hoje(), semanas: m ? Math.round(diasEntre(m.inicio, m.fim) / 7) : 6, fim: m ? m.fim : somaDias(hoje(), 42) });
  const muda = (k, v) => { const n = { ...f, [k]: v }; if (k !== 'fim') n.fim = somaDias(n.inicio, (Number(n.semanas) || 6) * 7); setF(n); };
  const salvar = async (ev) => {
    ev.preventDefault();
    try {
      if (m) await api.upd('mesociclos', m.id, { nome: f.nome || null, inicio: f.inicio, fim: f.fim });
      else {
        if (anterior) await api.upd('mesociclos', anterior.id, { status: 'encerrado' });
        await api.ins('mesociclos', { aluna_id: aluna.id, nome: f.nome || null, inicio: f.inicio, fim: f.fim, status: 'ativo' });
      }
      onFeito();
    } catch (e) { toast(e.message, 'erro'); }
  };
  return html`<${Modal} titulo=${novo ? 'Nova ficha (mesociclo)' : 'Validade da ficha'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    ${novo && anterior && html`<p class="suave">A ficha atual vira histórico. Monte os treinos novos na aba Ficha.</p>`}
    <${Campo} rotulo="Nome (opcional)"><input class="input" placeholder="Ex.: Bloco 2 · força" value=${f.nome} onInput=${(ev) => muda('nome', ev.target.value)}/><//>
    <div class="grade2">
      <${Campo} rotulo="Início"><input class="input" type="date" value=${f.inicio} onInput=${(ev) => muda('inicio', ev.target.value)}/><//>
      <${Campo} rotulo="Semanas"><input class="input" inputmode="numeric" value=${f.semanas} onInput=${(ev) => muda('semanas', ev.target.value)}/><//>
    </div>
    <${Campo} rotulo="Vale até"><input class="input" type="date" value=${f.fim} onInput=${(ev) => muda('fim', ev.target.value)}/><//>
    <button class="btn primario grande">Salvar</button></form><//>`;
}

// ============================================================
// CARDIO
// ============================================================
const MODALIDADES = [['esteira', 'Esteira'], ['bike', 'Bike'], ['eliptico', 'Elíptico'], ['escada', 'Escada'], ['remo', 'Remo'], ['rua', 'Rua']];
const NOME_MOD = Object.fromEntries(MODALIDADES);
// METs pelas equações do ACSM (caminhada, corrida e cicloergômetro); o resto é manual
export function calcMets({ modalidade, modo, velocidade_kmh, inclinacao_pct, watts, mets_manual }, peso) {
  const v = lerNum(velocidade_kmh), g = (lerNum(inclinacao_pct) || 0) / 100, w = lerNum(watts);
  if ((modalidade === 'esteira' || modalidade === 'rua') && v) {
    const mmin = (v * 1000) / 60;
    const vo2 = modo === 'corrida' ? 0.2 * mmin + 0.9 * mmin * g + 3.5 : 0.1 * mmin + 1.8 * mmin * g + 3.5;
    return Math.round((vo2 / 3.5) * 10) / 10;
  }
  if (modalidade === 'bike' && w && peso) return Math.round((((1.8 * w * 6.12) / peso + 7) / 3.5) * 10) / 10;
  return lerNum(mets_manual);
}
const descCardio = (c) => [NOME_MOD[c.modalidade], c.modo, c.velocidade_kmh && `${num(c.velocidade_kmh, 1)} km/h`, c.inclinacao_pct && `${num(c.inclinacao_pct, 1)}%`, c.watts && `${num(c.watts, 0)} W`, c.nivel && `nível ${c.nivel}`].filter(Boolean).join(' · ');

export function CardioAluna({ aluna, podeEditar = true }) {
  const e = useCarregar(async () => {
    const [presc, regs, aval, chk] = await Promise.all([api.q('cardio_prescricoes', { eq: { aluna_id: aluna.id }, order: 'ordem' }), api.q('cardio_registros', { eq: { aluna_id: aluna.id }, order: 'data', asc: false, limit: 60 }),
      api.q('avaliacoes', { eq: { aluna_id: aluna.id }, order: 'data', asc: false, limit: 1 }), api.q('checkins', { eq: { aluna_id: aluna.id }, order: 'semana', asc: false, limit: 1 })]);
    const peso = (chk[0] && chk[0].peso) || (aval[0] && aval[0].peso) || null;
    return { presc, regs, peso };
  }, [aluna.id]);
  const [modal, setModal] = useState(null);
  const [registrar, setRegistrar] = useState(null);
  return html`<${Estado} e=${e}>${({ presc, regs, peso }) => {
    const semana = regs.filter((r) => r.data >= somaDias(hoje(), -((new Date().getDay() + 6) % 7)));
    return html`<div class="pilha">
      ${podeEditar && html`<button class="btn primario" onClick=${() => setModal({})}>+ Prescrever cardio</button>`}
      ${!presc.filter((p) => p.ativo).length && html`<${Vazio} titulo="Sem cardio prescrito"/>`}
      ${presc.filter((p) => p.ativo || podeEditar).map((p) => { const feitos = semana.filter((r) => r.prescricao_id === p.id).length;
        return html`<section class=${'card' + (p.ativo ? '' : ' apagado')}><div class="card-topo"><div><h3>${NOME_MOD[p.modalidade]} · ${p.duracao_min} min</h3>
          <small>${descCardio(p)}${p.mets ? ` · ${num(p.mets, 1)} METs` : ''} · ${p.vezes_semana}x por semana${p.momento ? ' · ' + p.momento.replace('_', ' ') : ''}</small></div>
          <span class=${'tag' + (feitos >= p.vezes_semana ? ' roxo' : '')}>${feitos}/${p.vezes_semana} na semana</span></div>
          ${p.obs && html`<p class="nota">${p.obs}</p>`}
          <div class="acoes"><button class="btn mini" onClick=${() => setRegistrar(p)}>Registrar feito</button>${podeEditar && html`<button class="btn-texto" onClick=${() => setModal(p)}>Editar</button>`}</div></section>`; })}
      ${regs.length > 0 && html`<section class="card"><h3>Registros</h3><ul class="lista">${regs.slice(0, 20).map((r) => html`<li class="linha"><div><b>${NOME_MOD[r.modalidade] || r.modalidade} · ${num(r.duracao_min, 0)} min</b>
        <small>${dataBR(r.data)}${r.distancia_km ? ` · ${num(r.distancia_km, 2)} km` : ''}${r.fc_media ? ` · FC ${r.fc_media}` : ''}${r.percepcao ? ` · esforço ${r.percepcao}/10` : ''}${r.kcal ? ` · ~${num(r.kcal, 0)} kcal` : ''}</small></div>
        ${(podeEditar || r.aluna_id === aluna.id) && html`<button class="icone" aria-label="Apagar registro" onClick=${async () => { if (confirm('Apagar este registro?')) { await api.del('cardio_registros', r.id); e.recarregar(); } }}>✕</button>`}</li>`)}</ul></section>`}
      ${peso == null && podeEditar && html`<p class="suave">Sem peso registrado: a estimativa de gasto calórico e os METs da bike ficam vazios.</p>`}
      ${modal && html`<${ModalCardio} aluna=${aluna} p=${modal} peso=${peso} ordem=${presc.length} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
      ${registrar && html`<${ModalRegistroCardio} aluna=${aluna} p=${registrar} peso=${peso} onFechar=${() => setRegistrar(null)} onFeito=${() => { setRegistrar(null); e.recarregar(); }}/>`}
    </div>`;
  }}<//>`;
}
function camposCardio(f, setF) {
  const n = (k, r) => html`<${Campo} rotulo=${r}><input class="input" inputmode="decimal" value=${f[k] == null ? '' : f[k]} onInput=${(ev) => setF({ ...f, [k]: ev.target.value })}/><//>`;
  return html`<div class="chips">${MODALIDADES.map(([k, r]) => html`<button type="button" class=${f.modalidade === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, modalidade: k })}>${r}</button>`)}</div>
    ${['esteira', 'rua'].includes(f.modalidade) && html`<div class="chips">${[['caminhada', 'Caminhada'], ['corrida', 'Corrida']].map(([k, r]) => html`<button type="button" class=${f.modo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, modo: k })}>${r}</button>`)}</div>`}
    <div class="grade2">
      ${['esteira', 'rua'].includes(f.modalidade) && n('velocidade_kmh', 'Velocidade (km/h)')}
      ${f.modalidade === 'esteira' && n('inclinacao_pct', 'Inclinação (%)')}
      ${['bike', 'remo'].includes(f.modalidade) && n('watts', 'Potência (W)')}
      ${['bike', 'eliptico', 'escada', 'remo'].includes(f.modalidade) && html`<${Campo} rotulo="Nível"><input class="input" value=${f.nivel || ''} onInput=${(ev) => setF({ ...f, nivel: ev.target.value })}/><//>`}
      ${!['esteira', 'rua'].includes(f.modalidade) && !(f.modalidade === 'bike' && f.watts) && n('mets_manual', 'METs (estimado)')}
    </div>`;
}
function ModalCardio({ aluna, p, peso, ordem, onFechar, onFeito }) {
  const [f, setF] = useState({ modalidade: 'esteira', modo: 'caminhada', duracao_min: 30, vezes_semana: 3, momento: 'pos_treino', obs: '', ativo: true, ...p, velocidade_kmh: p.velocidade_kmh ?? '', inclinacao_pct: p.inclinacao_pct ?? '', watts: p.watts ?? '', mets_manual: p.mets_manual ?? '' });
  const mets = calcMets(f, peso);
  const salvar = async (ev) => {
    ev.preventDefault();
    const linha = { aluna_id: aluna.id, modalidade: f.modalidade, modo: ['esteira', 'rua'].includes(f.modalidade) ? f.modo : null, velocidade_kmh: lerNum(f.velocidade_kmh), inclinacao_pct: lerNum(f.inclinacao_pct), watts: lerNum(f.watts),
      nivel: f.nivel || null, mets_manual: lerNum(f.mets_manual), mets, duracao_min: Math.round(lerNum(f.duracao_min) || 0), vezes_semana: Math.max(1, Math.round(lerNum(f.vezes_semana) || 1)), momento: f.momento || null, obs: f.obs || null, ativo: f.ativo };
    if (!linha.duracao_min) { toast('Informe a duração.', 'erro'); return; }
    try { if (p.id) await api.upd('cardio_prescricoes', p.id, linha); else await api.ins('cardio_prescricoes', { ...linha, ordem }); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar esta prescrição? Os registros continuam.')) return; try { await api.del('cardio_prescricoes', p.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${p.id ? 'Editar cardio' : 'Prescrever cardio'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    ${camposCardio(f, setF)}
    <div class="grade2">
      <${Campo} rotulo="Duração (min)"><input class="input" inputmode="numeric" value=${f.duracao_min} onInput=${(ev) => setF({ ...f, duracao_min: ev.target.value })}/><//>
      <${Campo} rotulo="Vezes por semana"><input class="input" inputmode="numeric" value=${f.vezes_semana} onInput=${(ev) => setF({ ...f, vezes_semana: ev.target.value })}/><//>
    </div>
    <div class="chips">${[['pos_treino', 'Depois do treino'], ['dia_separado', 'Dia separado'], ['qualquer', 'Quando der']].map(([k, r]) => html`<button type="button" class=${f.momento === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, momento: k })}>${r}</button>`)}</div>
    <p class="destaque"><span>Intensidade estimada</span><b>${mets ? num(mets, 1) + ' METs' : '·'}</b></p>
    <${Campo} rotulo="Observação para a aluna"><textarea class="input" rows="2" value=${f.obs || ''} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
    <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Visível para a aluna</label>
    <button class="btn primario grande">Salvar</button>
    ${p.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar prescrição</button>`}
  </form><//>`;
}
function ModalRegistroCardio({ aluna, p, peso, onFechar, onFeito }) {
  const [f, setF] = useState({ data: hoje(), modalidade: p.modalidade, modo: p.modo, velocidade_kmh: p.velocidade_kmh ?? '', inclinacao_pct: p.inclinacao_pct ?? '', watts: p.watts ?? '', nivel: p.nivel || '', mets_manual: p.mets_manual ?? '', duracao_min: p.duracao_min, distancia_km: '', fc_media: '', percepcao: null, obs: '' });
  const salvar = async (ev) => {
    ev.preventDefault();
    const mets = calcMets(f, peso); const dur = lerNum(f.duracao_min);
    const linha = { aluna_id: aluna.id, prescricao_id: p.id || null, data: f.data, modalidade: f.modalidade, modo: f.modo || null, velocidade_kmh: lerNum(f.velocidade_kmh), inclinacao_pct: lerNum(f.inclinacao_pct), watts: lerNum(f.watts),
      nivel: f.nivel || null, duracao_min: dur, distancia_km: lerNum(f.distancia_km), fc_media: lerNum(f.fc_media), percepcao: f.percepcao, mets, kcal: mets && peso && dur ? Math.round(((mets * 3.5 * peso) / 200) * dur) : null, obs: f.obs || null };
    if (!dur) { toast('Informe a duração.', 'erro'); return; }
    try { await api.ins('cardio_registros', linha); toast('Cardio registrado', 'ok'); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  return html`<${Modal} titulo="Registrar cardio" onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    ${camposCardio(f, setF)}
    <div class="grade2">
      <${Campo} rotulo="Data"><input class="input" type="date" value=${f.data} onInput=${(ev) => setF({ ...f, data: ev.target.value })}/><//>
      <${Campo} rotulo="Duração (min)"><input class="input" inputmode="numeric" value=${f.duracao_min} onInput=${(ev) => setF({ ...f, duracao_min: ev.target.value })}/><//>
      <${Campo} rotulo="Distância (km, opcional)"><input class="input" inputmode="decimal" value=${f.distancia_km} onInput=${(ev) => setF({ ...f, distancia_km: ev.target.value })}/><//>
      <${Campo} rotulo="FC média (opcional)"><input class="input" inputmode="numeric" value=${f.fc_media} onInput=${(ev) => setF({ ...f, fc_media: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Quão pesado foi? (1 a 10)"><div class="regua">${[...Array(10)].map((_, i) => html`<button type="button" class=${f.percepcao === i + 1 ? 'on' : ''} onClick=${() => setF({ ...f, percepcao: i + 1 })}>${i + 1}</button>`)}</div><//>
    <button class="btn primario grande">Registrar</button></form><//>`;
}

// ============================================================
// TESTES AERÓBICOS
// ============================================================
const FC_TANAKA = (idade) => (idade ? Math.round(208 - 0.7 * idade) : null);
const FATOR_IDADE = [[15, 1.1], [25, 1], [35, 0.87], [40, 0.83], [45, 0.78], [50, 0.75], [55, 0.71], [60, 0.68], [65, 0.65]];
const fatorIdade = (i) => { let f = 1.1; for (const [a, v] of FATOR_IDADE) if (i >= a) f = v; return f; };
export const PROTOCOLOS = {
  cooper: { nome: 'Cooper 12 min (corrida)', mod: 'Campo', campos: [['distancia_m', 'Distância em 12 min (m)']], calc: (d) => (d.distancia_m ? (d.distancia_m - 504.9) / 44.73 : null) },
  rockport: { nome: 'Rockport 1 milha (caminhada)', mod: 'Campo ou esteira', campos: [['tempo_min', 'Tempo para 1.609 m (min, ex.: 14,5)'], ['fc_final', 'FC ao final (bpm)'], ['peso', 'Peso (kg)']],
    calc: (d, a) => (d.tempo_min && d.fc_final && d.peso && a.idade ? 132.853 - 0.0769 * d.peso * 2.2046 - 0.3877 * a.idade + 6.315 * (a.sexo === 'M' ? 1 : 0) - 3.2649 * d.tempo_min - 0.1565 * d.fc_final : null) },
  bruce: { nome: 'Bruce (esteira)', mod: 'Esteira', campos: [['tempo_min', 'Tempo total até a exaustão (min)']], calc: (d, a) => (d.tempo_min ? (a.sexo === 'M' ? 14.8 - 1.379 * d.tempo_min + 0.451 * d.tempo_min ** 2 - 0.012 * d.tempo_min ** 3 : 4.38 * d.tempo_min - 3.9) : null) },
  astrand: { nome: 'Åstrand-Ryhming (bike, submáximo)', mod: 'Bike', campos: [['watts', 'Carga (W)'], ['fc_estavel', 'FC estável no 5º-6º min (bpm)'], ['peso', 'Peso (kg)']],
    calc: (d, a) => { if (!d.watts || !d.fc_estavel || !d.peso) return null; const kgm = d.watts * 6.12; const l = a.sexo === 'M' ? (0.00212 * kgm + 0.299) / (0.769 * d.fc_estavel - 48.5) * 100 : (0.00193 * kgm + 0.326) / (0.769 * d.fc_estavel - 56.1) * 100; return (l * (a.idade ? fatorIdade(a.idade) : 1) * 1000) / d.peso; } },
  tc6: { nome: 'Caminhada de 6 minutos (TC6)', mod: 'Sem equipamento', campos: [['distancia_m', 'Distância em 6 min (m)']], calc: () => null, principal: (d) => d.distancia_m, unidade: 'm' },
  manual: { nome: 'Outro / valor medido', mod: 'Qualquer', campos: [['vo2', 'VO2máx (ml/kg/min)']], calc: (d) => d.vo2 || null },
};

export function TestesAluna({ aluna, podeEditar = true }) {
  const e = useCarregar(() => api.q('testes_aerobicos', { eq: { aluna_id: aluna.id }, order: 'data', asc: false }), [aluna.id]);
  const [novo, setNovo] = useState(false);
  const idade = idadeDe(aluna.nascimento);
  return html`<${Estado} e=${e}>${(l) => html`<div class="pilha">
    <div class="stats"><div class="stat"><b>${FC_TANAKA(idade) || '·'}</b><span>FCmáx estimada (Tanaka)</span></div>
      <div class="stat"><b>${l.find((t) => t.vo2max) ? num(l.find((t) => t.vo2max).vo2max, 1) : '·'}</b><span>VO2máx mais recente</span></div></div>
    ${!idade && html`<p class="suave">Cadastre a data de nascimento (aba Dados) para calcular FCmáx e os protocolos que usam idade.</p>`}
    ${podeEditar && html`<button class="btn primario" onClick=${() => setNovo(true)}>+ Registrar teste</button>`}
    ${!l.length && html`<${Vazio} titulo="Nenhum teste registrado"/>`}
    ${l.map((t, i) => { const ant = l.slice(i + 1).find((x) => x.protocolo === t.protocolo && x.resultado != null); const delta = ant && t.resultado != null ? t.resultado - ant.resultado : null;
      return html`<section class="card"><div class="card-topo"><div><h3>${(PROTOCOLOS[t.protocolo] || { nome: t.protocolo }).nome}</h3><small>${dataBR(t.data)}${t.fc_max ? ` · FCmáx ${t.fc_max}` : ''}${t.fc_repouso ? ` · FC repouso ${t.fc_repouso}` : ''}</small></div>
        <div class="valor">${t.resultado != null ? `${num(t.resultado, 1)} ${t.unidade}` : '·'}${delta != null && html`<small class=${delta >= 0 ? 'baixa' : 'alta'}>${delta >= 0 ? '+' : ''}${num(delta, 1)}</small>`}</div></div>
        ${t.obs && html`<p class="nota">${t.obs}</p>`}
        ${podeEditar && html`<button class="btn-texto perigo" onClick=${async () => { if (confirm('Apagar este teste?')) { await api.del('testes_aerobicos', t.id); e.recarregar(); } }}>Apagar</button>`}</section>`; })}
    <p class="suave">Estimativas por equação têm erro maior que teste com análise de gases. Compare a aluna com ela mesma, no mesmo protocolo.</p>
    ${novo && html`<${ModalTeste} aluna=${aluna} idade=${idade} onFechar=${() => setNovo(false)} onFeito=${() => { setNovo(false); e.recarregar(); }}/>`}
  </div>`}<//>`;
}
function ModalTeste({ aluna, idade, onFechar, onFeito }) {
  const [prot, setProt] = useState('cooper');
  const [dados, setDados] = useState({});
  const [f, setF] = useState({ data: hoje(), fc_repouso: '', obs: '' });
  const P = PROTOCOLOS[prot];
  const nums = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, lerNum(v)]));
  let vo2 = null; try { vo2 = P.calc(nums, { idade, sexo: aluna.sexo }); } catch (e) { vo2 = null; }
  if (vo2 != null && (!isFinite(vo2) || vo2 <= 0)) vo2 = null;
  const principal = P.principal ? P.principal(nums) : vo2;
  const salvar = async (ev) => {
    ev.preventDefault();
    if (principal == null) { toast('Preencha os campos do protocolo.', 'erro'); return; }
    try {
      await api.ins('testes_aerobicos', { aluna_id: aluna.id, data: f.data, protocolo: prot, dados: nums, vo2max: vo2 != null ? Math.round(vo2 * 10) / 10 : null, resultado: Math.round(principal * 10) / 10,
        unidade: P.unidade || 'ml/kg/min', fc_repouso: lerNum(f.fc_repouso), fc_max: FC_TANAKA(idade), obs: f.obs || null });
      onFeito();
    } catch (e) { toast(e.message, 'erro'); }
  };
  return html`<${Modal} titulo="Registrar teste aeróbico" onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Campo} rotulo="Protocolo"><select class="input" value=${prot} onChange=${(ev) => { setProt(ev.target.value); setDados({}); }}>${Object.entries(PROTOCOLOS).map(([k, p]) => html`<option value=${k}>${p.nome} · ${p.mod}</option>`)}</select><//>
    <div class="grade2">${P.campos.map(([k, r]) => html`<${Campo} rotulo=${r}><input class="input" inputmode="decimal" value=${dados[k] || ''} onInput=${(ev) => setDados({ ...dados, [k]: ev.target.value })}/><//>`)}
      <${Campo} rotulo="Data"><input class="input" type="date" value=${f.data} onInput=${(ev) => setF({ ...f, data: ev.target.value })}/><//>
      <${Campo} rotulo="FC de repouso (opcional)"><input class="input" inputmode="numeric" value=${f.fc_repouso} onInput=${(ev) => setF({ ...f, fc_repouso: ev.target.value })}/><//></div>
    <p class="destaque"><span>${P.principal ? 'Resultado' : 'VO2máx estimado'}</span><b>${principal != null ? `${num(principal, 1)} ${P.unidade || 'ml/kg/min'}` : '·'}</b></p>
    ${['rockport', 'astrand'].includes(prot) && !idade && html`<p class="suave">Sem idade cadastrada o cálculo fica incompleto.</p>`}
    <${Campo} rotulo="Observação"><textarea class="input" rows="2" value=${f.obs} onInput=${(ev) => setF({ ...f, obs: ev.target.value })}></textarea><//>
    <button class="btn primario grande">Salvar</button></form><//>`;
}

// ============================================================
// METAS (com análise de causa raiz obrigatória quando não batida)
// ============================================================
const TIPOS_META = [['carga', 'Carga'], ['peso', 'Peso'], ['gordura', '% de gordura'], ['medida', 'Medida'], ['vo2', 'VO2máx'], ['livre', 'Livre']];
const CAUSAS = [['adesao', 'Adesão'], ['recuperacao', 'Recuperação (sono e estresse)'], ['lesao', 'Lesão ou dor'], ['nutricao', 'Nutrição'], ['calibragem', 'Meta mal calibrada (alvo ou prazo)'], ['externos', 'Fatores externos']];
const NOME_STATUS = { ativa: 'ativa', batida: 'batida', nao_batida: 'não batida', cancelada: 'cancelada' };
export function MetasAluna({ aluna, podeEditar = true }) {
  const e = useCarregar(async () => {
    const [metas, ex] = await Promise.all([api.q('metas', { eq: { aluna_id: aluna.id }, order: 'created_at', asc: false }), api.q('exercicios', { order: 'nome' })]);
    return { metas, ex };
  }, [aluna.id]);
  const [modal, setModal] = useState(null);
  const [analise, setAnalise] = useState(null);
  return html`<${Estado} e=${e}>${({ metas, ex }) => html`<div class="pilha">
    ${podeEditar && html`<button class="btn primario" onClick=${() => setModal({})}>+ Meta</button>`}
    ${!metas.length && html`<${Vazio} titulo="Nenhuma meta"/>`}
    ${metas.map((m) => { const venceu = m.status === 'ativa' && m.prazo && m.prazo < hoje(); const pend = (m.status === 'nao_batida' || venceu) && !m.analisada_em;
      return html`<section class=${'card' + (pend && podeEditar ? ' alerta' : '')}>
        <div class="card-topo"><div><h3>${m.titulo || (TIPOS_META.find((t) => t[0] === m.tipo) || [])[1]}</h3>
          <small>${m.tipo === 'carga' && m.exercicio_id ? ((ex.find((x) => x.id === m.exercicio_id) || {}).nome || '') + ' · ' : ''}${m.medida ? m.medida + ' · ' : ''}${m.valor_inicial != null ? `de ${num(m.valor_inicial, 1)} ` : ''}${m.valor_alvo != null ? `para ${num(m.valor_alvo, 1)}` : ''}${m.prazo ? ` · prazo ${dataBR(m.prazo)}` : ''}</small></div>
          <span class=${'tag' + (m.status === 'batida' ? ' roxo' : pend ? ' atencao' : '')}>${venceu ? 'prazo vencido' : NOME_STATUS[m.status]}</span></div>
        ${m.analisada_em && html`<div class="resposta"><b>${podeEditar ? 'Análise de causa raiz' : 'Meta encerrada'}</b>${podeEditar && html`<p>${(CAUSAS.find((c) => c[0] === m.causa_categoria) || [0, m.causa_categoria])[1]}: ${m.causa_descricao}</p>`}<p>Próximo passo: ${m.acao_corretiva}</p></div>`}
        ${podeEditar && html`<div class="acoes">
          ${m.status === 'ativa' && html`<button class="btn mini" onClick=${async () => { await api.upd('metas', m.id, { status: 'batida', concluida_em: hoje() }); e.recarregar(); }}>Batida</button>`}
          ${pend || m.status === 'ativa' ? html`<button class=${'btn mini' + (pend ? ' ouro' : ' fantasma')} onClick=${() => setAnalise(m)}>${pend ? 'Analisar causa' : 'Não batida'}</button>` : null}
          <button class="btn-texto" onClick=${() => setModal(m)}>Editar</button></div>`}
      </section>`; })}
    ${modal && html`<${ModalMeta} aluna=${aluna} m=${modal} ex=${ex} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
    ${analise && html`<${ModalCausa} aluna=${aluna} m=${analise} onFechar=${() => setAnalise(null)} onFeito=${() => { setAnalise(null); e.recarregar(); }}/>`}
  </div>`}<//>`;
}
function ModalMeta({ aluna, m, ex, onFechar, onFeito }) {
  const [f, setF] = useState({ tipo: m.tipo || 'carga', titulo: m.titulo || '', exercicio_id: m.exercicio_id || '', medida: m.medida || '', valor_inicial: m.valor_inicial ?? '', valor_alvo: m.valor_alvo ?? '', prazo: m.prazo || somaDias(hoje(), 56) });
  const salvar = async (ev) => {
    ev.preventDefault();
    const linha = { aluna_id: aluna.id, tipo: f.tipo, titulo: f.titulo || null, exercicio_id: f.tipo === 'carga' ? f.exercicio_id || null : null, medida: f.tipo === 'medida' ? f.medida || null : null,
      valor_inicial: lerNum(f.valor_inicial), valor_alvo: lerNum(f.valor_alvo), prazo: f.prazo || null };
    try { if (m.id) await api.upd('metas', m.id, linha); else await api.ins('metas', { ...linha, status: 'ativa' }); onFeito(); } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar esta meta?')) return; try { await api.del('metas', m.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  return html`<${Modal} titulo=${m.id ? 'Editar meta' : 'Nova meta'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <div class="chips">${TIPOS_META.map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
    <${Campo} rotulo="Título (a aluna vê)"><input class="input" placeholder="Ex.: 60 kg na elevação pélvica" value=${f.titulo} onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    ${f.tipo === 'carga' && html`<${Campo} rotulo="Exercício"><select class="input" value=${f.exercicio_id} onChange=${(ev) => setF({ ...f, exercicio_id: ev.target.value })}><option value="">Escolha</option>${ex.map((x) => html`<option value=${x.id}>${x.nome}</option>`)}</select><//>`}
    ${f.tipo === 'medida' && html`<${Campo} rotulo="Medida"><input class="input" placeholder="cintura, quadril..." value=${f.medida} onInput=${(ev) => setF({ ...f, medida: ev.target.value })}/><//>`}
    <div class="grade2">
      <${Campo} rotulo="Valor inicial"><input class="input" inputmode="decimal" value=${f.valor_inicial} onInput=${(ev) => setF({ ...f, valor_inicial: ev.target.value })}/><//>
      <${Campo} rotulo="Alvo"><input class="input" inputmode="decimal" value=${f.valor_alvo} onInput=${(ev) => setF({ ...f, valor_alvo: ev.target.value })}/><//>
    </div>
    <${Campo} rotulo="Prazo"><input class="input" type="date" value=${f.prazo} onInput=${(ev) => setF({ ...f, prazo: ev.target.value })}/><//>
    <button class="btn primario grande">Salvar</button>
    ${m.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar meta</button>`}
  </form><//>`;
}
function ModalCausa({ aluna, m, onFechar, onFeito }) {
  const inicio = String(m.created_at || '').slice(0, 10) || somaDias(hoje(), -56);
  const e = useCarregar(async () => {
    const [sess, chk, dos] = await Promise.all([api.q('sessoes', { eq: { aluna_id: aluna.id }, gte: { data: inicio } }), api.q('checkins', { eq: { aluna_id: aluna.id }, gte: { semana: inicio } }),
      api.q('dossie', { eq: { aluna_id: aluna.id } })]);
    const semanas = Math.max(1, Math.round(diasEntre(inicio, m.prazo && m.prazo < hoje() ? m.prazo : hoje()) / 7));
    const ruins = chk.filter((c) => (c.sono != null && c.sono <= 2) || (c.estresse != null && c.estresse >= 4)).length;
    const notas = dos.filter((n) => ['lesao', 'pausa'].includes(n.tag) && String(n.registrado_em).slice(0, 10) >= inicio);
    return { porSemana: sess.filter((s) => s.concluida_em).length / semanas, ruins, nChk: chk.length, notas };
  }, [m.id]);
  const [f, setF] = useState({ causa_categoria: m.causa_categoria || '', causa_descricao: m.causa_descricao || '', acao_corretiva: m.acao_corretiva || '' });
  const salvar = async (ev) => {
    ev.preventDefault();
    if (!f.causa_categoria || f.causa_descricao.trim().length < 20 || !f.acao_corretiva.trim()) { toast('Escolha a causa, descreva com pelo menos 20 caracteres e defina a ação corretiva.', 'erro'); return; }
    try { await api.upd('metas', m.id, { status: 'nao_batida', causa_categoria: f.causa_categoria, causa_descricao: f.causa_descricao.trim(), acao_corretiva: f.acao_corretiva.trim(), analisada_em: hoje() }); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${'Causa raiz · ' + (m.titulo || m.tipo)} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <${Estado} e=${e}>${(ev) => html`<div class="nota">Evidências do período: ${num(ev.porSemana, 1)} treino(s) concluído(s) por semana · ${ev.ruins} de ${ev.nChk} Oráculo(s) com sono ruim ou estresse alto · ${ev.notas.length} nota(s) de lesão ou pausa no Dossiê.</div>`}<//>
    <${Campo} rotulo="Categoria da causa"><div class="chips">${CAUSAS.map(([k, r]) => html`<button type="button" class=${f.causa_categoria === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, causa_categoria: k })}>${r}</button>`)}</div><//>
    <${Campo} rotulo="O que aconteceu (só você vê)" dica=${`${f.causa_descricao.trim().length}/20 caracteres no mínimo`}><textarea class="input" rows="3" value=${f.causa_descricao} onInput=${(ev) => setF({ ...f, causa_descricao: ev.target.value })}></textarea><//>
    <${Campo} rotulo="Ação corretiva (a aluna vê)"><textarea class="input" rows="2" value=${f.acao_corretiva} onInput=${(ev) => setF({ ...f, acao_corretiva: ev.target.value })}></textarea><//>
    <button class="btn primario grande">Encerrar com análise</button></form><//>`;
}
