// CHRONOS · agenda do treinador.
// Visões Semana, Mês e Fila de trabalho. A agenda se preenche sozinha com camadas automáticas
// (aniversário, fim de ficha, vencimento de plano, check-in semanal, avaliação a cada X semanas, metas),
// e cada camada pode ser escondida. Compromissos se ligam a uma aluna, repetem e guardam o link da call.
import { html, useState, useEffect } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { useCarregar, Estado, Modal, Campo, toast, dataBR, hoje, somaDias, somaMeses, diasEntre, linkWhats } from './util.js';

export const dataLocal = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const segunda = (s) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dataLocal(d); };
const SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const pn = (n) => (n || '').split(' ')[0];

export const TIPOS_EVENTO = [['video', 'Call'], ['presencial', 'Aula presencial'], ['avaliacao', 'Avaliação'], ['ritual', 'Ritual'], ['lembrete', 'Lembrete'], ['outro', 'Outro']];
export const CAMADAS = [['compromissos', 'Compromissos', '#c38bea'], ['checkin', 'Check-in semanal', '#5fd4a0'], ['avaliacao', 'Avaliações', '#5b8def'],
  ['ficha', 'Fim de ficha', '#f2c14e'], ['plano', 'Vencimento de plano', '#ff6b81'], ['aniversario', 'Aniversários', '#e08a3c'], ['metas', 'Prazos de metas', '#a0a0a0'], ['revisao', 'Dia de revisão', '#8fb0f5']];
const cor = (c) => (CAMADAS.find(([k]) => k === c) || [])[2] || '#999';
const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? padrao : v; } catch (e) { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } };

export function Agenda({ ir }) {
  const [visao, setVisaoL] = useState(() => ler('nemesis-agenda-visao', 'semana'));
  const [ref, setRef] = useState(hoje());
  const [ocultas, setOcultasL] = useState(() => ler('nemesis-agenda-ocultas', []));
  const [diaCheckin, setDiaCheckinL] = useState(() => ler('nemesis-dia-checkin', 1));
  const [modal, setModal] = useState(null);
  const setVisao = (v) => { setVisaoL(v); gravar('nemesis-agenda-visao', v); };
  const setOcultas = (v) => { setOcultasL(v); gravar('nemesis-agenda-ocultas', v); };
  const setDiaCheckin = (v) => { setDiaCheckinL(v); gravar('nemesis-dia-checkin', v); };

  // intervalo visível
  let ini, fim, titulo;
  if (visao === 'mes') { const m = ref.slice(0, 7); ini = segunda(m + '-01'); fim = somaDias(ini, 41); titulo = `${MESES[+m.slice(5) - 1]} ${m.slice(0, 4)}`; }
  else if (visao === 'lista') { ini = hoje(); fim = somaDias(ini, 13); titulo = 'Próximos 14 dias'; }
  else { ini = segunda(ref); fim = somaDias(ini, 6); titulo = `${dataBR(ini).slice(0, 5)} a ${dataBR(fim).slice(0, 5)}`; }
  const navegar = (d) => setRef(visao === 'mes' ? somaMeses(ref.slice(0, 7) + '-15', d) : somaDias(ref, d * 7));

  const e = useCarregar(async () => {
    const [ag, alunas, mesos, metas, ass, avals, planos] = await Promise.all([
      api.q('agenda', { gte: { inicio: new Date(ini + 'T00:00:00').toISOString() }, lte: { inicio: new Date(somaDias(fim, 1) + 'T00:00:00').toISOString() }, order: 'inicio' }),
      api.q('profiles', { eq: { role: 'student', ativo: true } }), api.q('mesociclos', { eq: { status: 'ativo' } }).catch(() => []),
      api.q('metas', { eq: { status: 'ativa' } }).catch(() => []), api.q('assinaturas', {}), api.q('avaliacoes', { order: 'data' }), api.q('planos', {})]);
    return { ag, alunas, mesos, metas, ass, avals, planos };
  }, [ini, fim]);

  return html`<div class="pilha chronos">
    <div class="titulo-acoes"><h1 class="titulo">Chronos</h1>
      <div class="acoes"><div class="seg">${[['semana', 'Semana'], ['mes', 'Mês'], ['lista', 'Fila de trabalho']].map(([k, r]) => html`<button class=${visao === k ? 'on' : ''} onClick=${() => setVisao(k)}>${r}</button>`)}</div>
        <button class="btn primario" onClick=${() => setModal({})}>+ Compromisso</button></div></div>
    <div class="chronos-barra">
      ${visao !== 'lista' ? html`<div class="mes-nav"><button class="icone" aria-label="Anterior" onClick=${() => navegar(-1)}>‹</button><b>${titulo}</b><button class="icone" aria-label="Próximo" onClick=${() => navegar(1)}>›</button>
        <button class="btn-texto mini" onClick=${() => setRef(hoje())}>Hoje</button></div>` : html`<b>${titulo}</b>`}
      <div class="camadas">${CAMADAS.map(([k, r]) => { const on = !ocultas.includes(k);
        return html`<button class=${'camada' + (on ? ' on' : '')} onClick=${() => setOcultas(on ? [...ocultas, k] : ocultas.filter((x) => x !== k))}><i style=${`background:${cor(k)}`}></i>${r}</button>`; })}
        <label class="camada-dia">Check-in às <select onChange=${(ev) => setDiaCheckin(+ev.target.value)}>${DIAS_NOME.map((d, i) => html`<option value=${i} selected=${diaCheckin === i}>${d}s</option>`)}</select></label></div>
    </div>
    <${Estado} e=${e}>${(d) => {
      const itensDoDia = montarItens(d, ini, fim, ocultas, diaCheckin);
      const abrir = (x) => (x.g ? setModal(x.g) : x.rota ? ir(x.rota) : null);
      if (visao === 'lista') return html`<${Fila} itensDoDia=${itensDoDia} ini=${ini} fim=${fim} abrir=${abrir} recarregar=${e.recarregar}/>`;
      if (visao === 'mes') return html`<div class="mes-grade">${SEM.map((s) => html`<div class="mes-cab">${s}</div>`)}
        ${[...Array(42)].map((_, i) => { const dia = somaDias(ini, i); const l = itensDoDia(dia); const fora = dia.slice(0, 7) !== ref.slice(0, 7);
          return html`<div class=${'mes-dia' + (dia === hoje() ? ' hoje' : '') + (fora ? ' fora' : '')} onDblClick=${() => setModal({ dia })}>
            <span class="mes-n">${+dia.slice(8)}</span>
            ${l.slice(0, 3).map((x) => html`<button class=${'mes-item' + (x.feito ? ' feito' : '')} style=${`--c:${cor(x.camada)}`} onClick=${() => abrir(x)} title=${`${x.txt}${x.sub ? ' · ' + x.sub : ''}`}>${x.hora && x.hora.length === 5 ? x.hora + ' ' : ''}${x.txt}</button>`)}
            ${l.length > 3 && html`<button class="btn-texto mini" onClick=${() => { setRef(dia); setVisao('semana'); }}>+${l.length - 3}</button>`}</div>`; })}</div>`;
      return html`<div class="semana-grade">${[...Array(7)].map((_, i) => { const dia = somaDias(ini, i);
        return html`<div class=${'semana-dia' + (dia === hoje() ? ' hoje' : '')}>
          <h4>${SEM[i]} <small>${dataBR(dia).slice(0, 5)}</small></h4>
          ${itensDoDia(dia).map((x) => html`<button class=${'semana-item' + (x.feito ? ' feito' : '')} style=${`--c:${cor(x.camada)}`} onClick=${() => abrir(x)}>
            <span>${x.hora}</span><b>${x.txt}</b>${x.sub && html`<small>${x.sub}</small>`}</button>`)}
          <button class="btn-texto mini" onClick=${() => setModal({ dia })}>+</button></div>`; })}</div>`;
    }}<//>
    <p class="suave">A fase do ciclo das alunas nunca aparece na agenda.</p>
    ${modal && html`<${ModalCompromisso} inicial=${modal} onFechar=${() => setModal(null)} onFeito=${() => { setModal(null); e.recarregar(); }}/>`}
  </div>`;
}

// junta compromissos e camadas automáticas: devolve uma função (dia) => itens
function montarItens({ ag, alunas, mesos, metas, ass, avals, planos }, ini, fim, ocultas, diaCheckin) {
  const on = (c) => !ocultas.includes(c);
  const nome = (id) => pn((alunas.find((a) => a.id === id) || {}).nome);
  const ativas = new Set(alunas.map((a) => a.id));
  const porDia = {};
  const add = (dia, x) => { if (dia < ini || dia > fim) return; (porDia[dia] = porDia[dia] || []).push(x); };
  if (on('compromissos')) ag.forEach((g) => { const dt = new Date(g.inicio); add(dataLocal(dt), { k: g.id, hora: dt.toTimeString().slice(0, 5), txt: g.titulo, sub: g.aluna_id ? nome(g.aluna_id) : '', g, feito: g.feito, camada: 'compromissos', aluna: g.aluna_id }); });
  if (on('ficha')) mesos.filter((m) => ativas.has(m.aluna_id)).forEach((m) => add(m.fim, { k: 'm' + m.id, hora: '★', txt: 'Ficha termina', sub: nome(m.aluna_id), camada: 'ficha', rota: `aluna/${m.aluna_id}/ficha`, aluna: m.aluna_id }));
  if (on('metas')) metas.filter((m) => m.prazo && ativas.has(m.aluna_id)).forEach((m) => add(m.prazo, { k: 'mt' + m.id, hora: '★', txt: 'Prazo de meta', sub: nome(m.aluna_id), camada: 'metas', rota: `aluna/${m.aluna_id}/metas`, aluna: m.aluna_id }));
  if (on('plano')) ass.filter((s) => ativas.has(s.aluna_id)).forEach((s) => add(s.fim, { k: 's' + s.id, hora: '◆', txt: 'Plano vence', sub: `${nome(s.aluna_id)} · ${s.plano_nome || ''}`, camada: 'plano', rota: `aluna/${s.aluna_id}/financeiro`, aluna: s.aluna_id }));
  if (on('aniversario')) for (let dia = ini; dia <= fim; dia = somaDias(dia, 1)) alunas.filter((a) => a.nascimento && a.nascimento.slice(5) === dia.slice(5))
    .forEach((a) => add(dia, { k: 'n' + a.id + dia, hora: '🎂', txt: 'Aniversário', sub: nome(a.id), camada: 'aniversario', rota: `aluna/${a.id}`, aluna: a.id, telefone: a.telefone, whats: `${pn(a.nome)}, feliz aniversário! Que seja um ano forte, em todos os sentidos.` }));
  if (on('checkin')) for (let dia = ini; dia <= fim; dia = somaDias(dia, 1)) if (new Date(dia + 'T12:00:00').getDay() === diaCheckin && alunas.length)
    add(dia, { k: 'c' + dia, hora: '✓', txt: 'Check-in semanal', sub: `${alunas.length} aluna(s)`, camada: 'checkin', rota: 'checkins' });
  if (on('revisao')) for (let dia = ini; dia <= fim; dia = somaDias(dia, 1)) { const dow = new Date(dia + 'T12:00:00').getDay();
    alunas.filter((a) => a.dia_revisao === dow).forEach((a) => add(dia, { k: 'r' + a.id + dia, hora: '✎', txt: 'Revisão', sub: nome(a.id), camada: 'revisao', rota: `aluna/${a.id}/ficha`, aluna: a.id })); }
  if (on('avaliacao')) alunas.forEach((a) => {
    // próxima avaliação: última + intervalo do plano vigente (8 semanas se o plano não disser)
    const ult = avals.filter((v) => v.aluna_id === a.id).map((v) => v.data).sort().pop();
    const vig = ass.filter((s) => s.aluna_id === a.id && s.inicio <= hoje() && s.fim >= hoje()).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0];
    const p = vig && planos.find((x) => x.id === vig.plano_id);
    const semanas = (p && p.entregas && p.entregas.avaliacao_semanas) || 8;
    if (!ult) return;
    let prox = somaDias(ult, semanas * 7);
    const atrasada = prox < hoje();
    if (atrasada) prox = hoje();
    add(prox, { k: 'av' + a.id, hora: '◎', txt: atrasada ? 'Reavaliação atrasada' : 'Reavaliação', sub: nome(a.id), camada: 'avaliacao', rota: `aluna/${a.id}/avaliacoes`, aluna: a.id });
  });
  Object.values(porDia).forEach((l) => l.sort((a, b) => (a.hora.length === 5 && b.hora.length === 5 ? a.hora.localeCompare(b.hora) : a.hora.length === 5 ? 1 : -1)));
  return (dia) => porDia[dia] || [];
}

// fila de trabalho: o que precisa sair em cada dia, como lista
function Fila({ itensDoDia, ini, fim, abrir, recarregar }) {
  const feito = async (g) => { try { await api.upd('agenda', g.id, { feito: !g.feito }); recarregar(); } catch (e) { toast(e.message, 'erro'); } };
  const dias = []; for (let d = ini; d <= fim; d = somaDias(d, 1)) if (itensDoDia(d).length) dias.push(d);
  if (!dias.length) return html`<div class="card vazio"><p>Nada nos próximos 14 dias.</p></div>`;
  return html`<div class="fila">${dias.map((d) => { const n = diasEntre(hoje(), d);
    return html`<section class="card fila-dia"><h3>${n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : `${DIAS_NOME[new Date(d + 'T12:00:00').getDay()]}, ${dataBR(d).slice(0, 5)}`}</h3>
      ${itensDoDia(d).map((x) => html`<div class=${'fila-item' + (x.feito ? ' feito' : '')} style=${`--c:${cor(x.camada)}`}>
        <span class="fila-hora">${x.hora}</span><button class="fila-txt" onClick=${() => abrir(x)}><b>${x.txt}</b>${x.sub && html`<small>${x.sub}</small>`}</button>
        <div class="mini-acoes">${x.g && x.g.link && html`<a class="btn-texto" href=${x.g.link} target="_blank" rel="noopener">Entrar</a>`}
          ${x.whats && x.telefone && html`<a class="btn-texto" target="_blank" rel="noopener" href=${linkWhats(x.telefone, x.whats)}>WhatsApp</a>`}
          ${x.g && html`<button class=${'check pequeno' + (x.g.feito ? ' on' : '')} aria-label="Feito" onClick=${() => feito(x.g)}>✓</button>`}</div></div>`)}
    </section>`; })}</div>`;
}

// rituais prontos: um toque preenche título, tipo, horário e repetição
const proximaSexta = () => { let d = hoje(); while (new Date(d + 'T12:00:00').getDay() !== 5) d = somaDias(d, 1); return d; };
const RITUAIS = [
  { nome: 'Call mensal de metas', f: { titulo: 'Call mensal de metas', tipo: 'video', hora: '19:00', repetir: 'mensal', vezes: 3 }, dica: 'Pede a aluna. Pensada para Delfos em diante.' },
  { nome: 'Café da tarde (semanal)', f: { titulo: 'Café da tarde', tipo: 'ritual', hora: '16:00', repetir: 'semanal', vezes: 4 } },
  { nome: 'Relatório de sexta', f: { titulo: 'Relatório de sexta', tipo: 'lembrete', hora: '10:00', repetir: 'semanal', vezes: 4, dia: 'sexta' } },
];

export function ModalCompromisso({ inicial, onFechar, onFeito }) {
  const [alunas, setAlunas] = useState([]);
  useEffect(() => { api.q('profiles', { eq: { role: 'student', ativo: true }, order: 'nome' }).then(setAlunas).catch(() => {}); }, []);
  const g = inicial || {};
  const ini = g.inicio ? new Date(g.inicio) : null;
  const [f, setF] = useState({ titulo: g.titulo || '', tipo: g.tipo || 'video', aluna_id: g.aluna_id || '', dia: ini ? dataLocal(ini) : (g.dia || hoje()), hora: ini ? ini.toTimeString().slice(0, 5) : '18:00', link: g.link || '', repetir: 'nao', vezes: 4 });
  const ritual = (r) => setF({ ...f, ...r.f, dia: r.f.dia === 'sexta' ? proximaSexta() : f.dia });
  const datas = () => {
    const n = f.repetir === 'nao' ? 1 : Math.max(1, Math.min(24, Number(f.vezes) || 1));
    return [...Array(n)].map((_, i) => (f.repetir === 'mensal' ? somaMeses(f.dia, i) : somaDias(f.dia, i * (f.repetir === 'quinzenal' ? 14 : 7))));
  };
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.titulo.trim()) { toast('Dê um título.', 'erro'); return; }
    const linha = (dia) => ({ titulo: f.titulo.trim(), tipo: f.tipo, aluna_id: f.aluna_id || null, inicio: new Date(`${dia}T${f.hora || '00:00'}:00`).toISOString(), link: f.link || null });
    try {
      if (g.id) await api.upd('agenda', g.id, linha(f.dia));
      else await api.ins('agenda', datas().map(linha));
      onFeito();
    } catch (e) { toast(e.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar este compromisso?')) return; try { await api.del('agenda', g.id); onFeito(); } catch (e) { toast(e.message, 'erro'); } };
  const aluna = alunas.find((a) => a.id === f.aluna_id);
  return html`<${Modal} titulo=${g.id ? 'Editar compromisso' : 'Novo compromisso'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    ${!g.id && html`<div class="campo"><span class="rotulo">Rituais num clique</span><div class="chips">${RITUAIS.map((r) => html`<button type="button" class="chip" title=${r.dica || ''} onClick=${() => ritual(r)}>${r.nome}</button>`)}</div></div>`}
    <div class="chips">${TIPOS_EVENTO.map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
    <${Campo} rotulo="Título"><input class="input" value=${f.titulo} placeholder="Ex.: Chamada de ajuste de ficha" onInput=${(ev) => setF({ ...f, titulo: ev.target.value })}/><//>
    <${Campo} rotulo="Aluna" dica="Ligado a uma aluna, o compromisso aparece para ela no seu radar."><select class="input" onChange=${(ev) => setF({ ...f, aluna_id: ev.target.value })}><option value="">Compromisso meu</option>${alunas.map((a) => html`<option value=${a.id} selected=${f.aluna_id === a.id}>${a.nome}</option>`)}</select><//>
    <div class="grade2">
      <${Campo} rotulo="Dia"><input class="input" type="date" value=${f.dia} onInput=${(ev) => setF({ ...f, dia: ev.target.value })}/><//>
      <${Campo} rotulo="Hora"><input class="input" type="time" value=${f.hora} onInput=${(ev) => setF({ ...f, hora: ev.target.value })}/><//>
    </div>
    ${!g.id && html`<div class="grade2">
      <${Campo} rotulo="Repetir"><select class="input" onChange=${(ev) => setF({ ...f, repetir: ev.target.value })}>${[['nao', 'Não repete'], ['semanal', 'Toda semana'], ['quinzenal', 'A cada 2 semanas'], ['mensal', 'Todo mês']].map(([k, r]) => html`<option value=${k} selected=${f.repetir === k}>${r}</option>`)}</select><//>
      ${f.repetir !== 'nao' && html`<${Campo} rotulo="Quantas vezes"><input class="input" inputmode="numeric" value=${f.vezes} onInput=${(ev) => setF({ ...f, vezes: ev.target.value })}/><//>`}
    </div>`}
    <${Campo} rotulo="Link da call" dica="Cole o link do Meet, Zoom ou WhatsApp. Ele aparece no botão Entrar."><input class="input" type="url" placeholder="https://" value=${f.link} onInput=${(ev) => setF({ ...f, link: ev.target.value })}/><//>
    ${!g.id && f.repetir !== 'nao' && html`<p class="suave">Vai criar ${datas().length} compromissos: ${datas().slice(0, 4).map((d) => dataBR(d).slice(0, 5)).join(', ')}${datas().length > 4 ? '…' : ''}</p>`}
    <button class="btn primario grande">Salvar</button>
    ${g.id && aluna && aluna.telefone && html`<a class="btn" target="_blank" rel="noopener" href=${linkWhats(aluna.telefone, `Oi, ${pn(aluna.nome)}! Lembrete: ${f.titulo} em ${dataBR(f.dia)} às ${f.hora}.${f.link ? ' Link: ' + f.link : ''}`)}><${Icone} nome="comentario" tam=${16}/>Lembrar a aluna no WhatsApp</a>`}
    ${g.id && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
  </form><//>`;
}
