// Arena: execução do treino pela aluna, um exercício por vez.
// Séries em bolinhas (aquecimento, preparatória, válidas), peso e reps grandes, RIR da série, descanso automático
// com timer e cronômetro, troca de exercício que pode ficar lembrada no aparelho, observações e "Seu desempenho".
import { html, useState, useEffect, useRef } from '../lib/preact-htm.js';
import { api } from './api.js';
import { Icone } from './icones.js';
import { nomeMetodo, textoDescanso, textoEsforco, TIPOS, PERFIS, METODOS_GRUPO, textoCadencia } from './musculos.js';
import { semanaDoMeso } from './extras.js';
import { podeImagem } from './legal.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Escala, toast, num, dataBR, hoje, lerNum, recordes } from './util.js';

// preferências guardadas só neste aparelho (falha em modo privado: segue sem)
const guardado = (k, padrao) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } };
const CHAVE_TOUR = 'nemesis-tour-arena-v1';
const chaveTrocas = (alunaId) => `nemesis-trocas-${alunaId}`;
const relogio = (seg) => { seg = Math.max(0, Math.round(seg)); const h = Math.floor(seg / 3600); const m = Math.floor((seg % 3600) / 60); const s = seg % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };

export function Execucao({ perfil, treinoId, ir }) {
  const e = useCarregar(async () => {
    const [treino, itens, exercicios, sessoes, historico] = await Promise.all([
      api.um('treinos', { id: treinoId }),
      api.q('treino_itens', { eq: { treino_id: treinoId }, order: 'ordem' }),
      api.q('exercicios', {}),
      api.q('sessoes', { eq: { aluna_id: perfil.id }, order: 'iniciada_em' }),
      api.q('series', { eq: { aluna_id: perfil.id }, order: 'created_at' }),
    ]);
    const aberta = sessoes.find((s) => s.treino_id === treinoId && s.data === hoje() && !s.concluida_em) || null;
    // semana do mesociclo: meta de RIR da semana e, no deload, metade das séries
    const meso = (await api.q('mesociclos', { eq: { aluna_id: perfil.id, status: 'ativo' } }).catch(() => []))[0];
    const semana = semanaDoMeso(meso);
    const ajustados = !semana ? itens : itens.map((i) => (i.tipo && i.tipo !== 'musculacao' ? i
      : semana.alvo.deload ? { ...i, series: Math.max(1, Math.ceil(i.series / 2)) }
      : semana.alvo.rir != null ? { ...i, esforco_tipo: 'rir', esforco_alvo: semana.alvo.rir } : i));
    const videos = await api.q('videos_execucao', { eq: { aluna_id: perfil.id }, order: 'created_at' }).catch(() => []);
    return { treino, itens: ajustados, exercicios, aberta, historico, semana, videos, sessoes };
  }, [treinoId]);
  return html`<${Estado} e=${e}>${(d) => (d.treino && d.itens.length ? html`<${Arena} d=${d} perfil=${perfil} ir=${ir}/>`
    : html`<${Vazio} titulo=${d.treino ? 'Treino sem exercícios' : 'Treino não encontrado'} texto="Volte para o início e escolha outro treino."/>`)}<//>`;
}

// linha de prescrição: "3 × 8-12 · descanso 90s · Drop-set · cadência 3-1s · RIR 2"
export function resumoItem(it) {
  if (it.tipo === 'aerobico') return [TIPOS.aerobico.nome, it.duracao ? `${it.duracao} min` : null, it.intensidade, nomeMetodo(it.metodo || 'continuo')].filter(Boolean).join(' · ');
  return [`${it.aquecimento ? it.aquecimento + ' aquec. + ' : ''}${it.preparatorias ? it.preparatorias + ' prep. + ' : ''}${it.series} × ${it.reps || '·'}`, textoDescanso(it),
    it.metodo && it.metodo !== 'padrao' ? nomeMetodo(it.metodo) : null, it.tecnica,
    textoCadencia(it) || null,
    textoEsforco(it), it.tipo && it.tipo !== 'musculacao' ? TIPOS[it.tipo].nome : null].filter(Boolean).join(' · ');
}

// séries de cada exercício: aquecimento, preparatória e válidas (com a carga da última vez como sugestão)
export function montarLinhas(itens, historico, aberta, trocas = {}) {
  const out = {};
  for (const it of itens) {
    const exId = trocas[it.id] || it.exercicio_id;   // troca lembrada: a sugestão de carga vem do exercício que ela vai fazer
    const ant = historico.filter((h) => h.exercicio_id === exId && !h.aquecimento && (!aberta || h.sessao_id !== aberta.id));
    const ultSessao = ant.length ? ant[ant.length - 1].sessao_id : null;
    const daUlt = ant.filter((h) => h.sessao_id === ultSessao);
    const lista = [];
    const vazio = { carga: '', reps: '', rir: '', id: null };
    for (let i = 1; i <= (it.aquecimento || 0); i++) lista.push({ ...vazio, numero: i, aquecimento: true, preparatoria: false });
    for (let i = 1; i <= (it.preparatorias || 0); i++) lista.push({ ...vazio, numero: i, aquecimento: true, preparatoria: true });
    for (let i = 1; i <= it.series; i++) {
      const ref = daUlt.find((h) => h.numero === i) || daUlt[daUlt.length - 1];
      // meta da série (séries detalhadas pelo treinador) ou a da linha do exercício
      const meta = (it.series_detalhe || [])[i - 1] || {};
      const carga = meta.carga != null ? meta.carga : ref && ref.carga != null ? ref.carga : null;
      lista.push({ ...vazio, numero: i, aquecimento: false, preparatoria: false, carga: carga == null ? '' : String(carga).replace('.', ','),
        metaReps: meta.reps || it.reps, metaRir: meta.rir != null ? meta.rir : it.esforco_alvo });
    }
    if (aberta) {
      historico.filter((h) => h.sessao_id === aberta.id && h.treino_item_id === it.id).forEach((h) => {
        const l = lista.find((x) => x.numero === h.numero && x.aquecimento === !!h.aquecimento && x.preparatoria === !!h.preparatoria);
        if (l) Object.assign(l, { id: h.id, carga: h.carga == null ? '' : String(h.carga).replace('.', ','), reps: h.reps == null ? '' : String(h.reps), rir: h.rir == null ? '' : String(h.rir) });
      });
    }
    out[it.id] = lista;
  }
  return out;
}

export function ultimaVez(historico, exId, sessao, aerobico) {
  const ant = historico.filter((h) => h.exercicio_id === exId && !h.aquecimento && (!sessao || h.sessao_id !== sessao.id));
  if (!ant.length) return null;
  const sid = ant[ant.length - 1].sessao_id;
  return ant.filter((h) => h.sessao_id === sid).map((h) => (aerobico ? `${h.reps ?? '·'} min` : `${h.carga == null ? 'sem peso' : num(h.carga, 1) + ' kg'} × ${h.reps ?? '·'}`)).join('  ·  ');
}

const tipoSerie = (l) => (l.preparatoria ? 'prep' : l.aquecimento ? 'aquec' : 'valida');
const proximaPendente = (ls) => { const i = ls.findIndex((l) => !l.id); return i < 0 ? ls.length - 1 : i; };

function Arena({ d, perfil, ir }) {
  const { treino, itens, exercicios } = d;
  const [sessao, setSessao] = useState(d.aberta);
  const [historico, setHistorico] = useState(d.historico);
  const [trocas, setTrocas] = useState(() => { const g = guardado(chaveTrocas(perfil.id), {}); const t = {};
    itens.forEach((it) => { const id = g[it.id]; if (id && (exercicios.find((x) => x.id === it.exercicio_id) || {}).substitutos?.includes(id)) t[it.id] = id; }); return t; });
  const inicio = useRef(null);
  if (!inicio.current) inicio.current = montarLinhas(itens, d.historico, d.aberta, trocas);
  const [linhas, setLinhas] = useState(inicio.current);
  const [idx, setIdx] = useState(() => { const i = itens.findIndex((it) => inicio.current[it.id].some((l) => !l.id)); return i < 0 ? 0 : i; });
  const [sel, setSel] = useState({});              // série escolhida em cada exercício
  const [pulados, setPulados] = useState({});      // exercícios marcados como concluídos sem todas as séries
  const [notas, setNotas] = useState((d.aberta && d.aberta.notas) || {});
  const [modo, setModo] = useState('timer');      // timer (descanso) ou cronômetro
  const [descanso, setDescanso] = useState(null);  // { fim, total }
  const [crono, setCrono] = useState({ inicio: null, acumulado: 0 });
  const [agora, setAgora] = useState(Date.now());
  const [janela, setJanela] = useState(null);      // 'trocar' | 'desempenho' | 'notas' | 'finalizar' | 'tour'
  const [enviandoVideo, setEnviandoVideo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const salvandoRef = useRef(false);               // trava contra dois toques rápidos em "Concluir série"
  const notasRef = useRef(notas); notasRef.current = notas;
  useEffect(() => { if (!guardado(CHAVE_TOUR, false)) setJanela('tour'); }, []);

  const exDe = (id) => exercicios.find((x) => x.id === id) || {};
  const exNome = (id) => exDe(id).nome || 'Exercício';
  const exAtual = (item) => trocas[item.id] || item.exercicio_id;
  const item = itens[idx];
  const exId = exAtual(item);
  const ls = linhas[item.id];
  const s = sel[item.id] != null && sel[item.id] < ls.length ? sel[item.id] : proximaPendente(ls);
  const l = ls[s];
  const aerobico = item.tipo === 'aerobico';
  const feitoEx = (it) => pulados[it.id] || linhas[it.id].every((x) => x.id);
  const validasFeitas = Object.values(linhas).flat().filter((x) => x.id && !x.aquecimento).length;
  const validasTotal = itens.reduce((t, i) => t + i.series, 0);

  // ---------- sessão ----------
  const sessaoRef = useRef(d.aberta);
  const criando = useRef(null);
  const garantirSessao = async () => {
    // evita criar duas sessões se a aluna tocar em duas séries muito rápido
    if (sessaoRef.current) return sessaoRef.current;
    if (!criando.current) {
      const nova = { aluna_id: perfil.id, treino_id: treino.id, treino_nome: treino.nome, data: hoje(), iniciada_em: new Date().toISOString() };
      if (Object.values(notasRef.current).some(Boolean)) nova.notas = notasRef.current;   // observação anotada antes da 1ª série
      criando.current = api.ins('sessoes', nova)
        .then(([x]) => { sessaoRef.current = x; setSessao(x); return x; })
        .catch((err) => { criando.current = null; throw err; });
    }
    return criando.current;
  };
  const relogioLigado = !!(sessao || descanso || crono.inicio);
  useEffect(() => { if (!relogioLigado) return undefined; setAgora(Date.now()); const t = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(t); }, [relogioLigado]);
  const tempoTotal = sessao && sessao.iniciada_em ? (agora - new Date(sessao.iniciada_em).getTime()) / 1000 : 0;

  // ---------- séries ----------
  const muda = (campo, v) => setLinhas((x) => ({ ...x, [item.id]: x[item.id].map((y, i) => (i === s ? { ...y, [campo]: v } : y)) }));
  const iniciarDescanso = (seg) => { if (seg > 0) { setDescanso({ fim: Date.now() + seg * 1000, total: seg }); setModo('timer'); } };
  const concluir = async () => {
    if (salvandoRef.current || l.id) return;
    const carga = lerNum(l.carga); const reps = lerNum(l.reps);
    if (reps == null && !l.aquecimento) { toast(aerobico ? 'Coloque quantos minutos você fez.' : 'Coloque quantas repetições você fez.', 'erro'); return; }
    salvandoRef.current = true; setSalvando(true);
    try {
      const sx = await garantirSessao();
      const linha = { sessao_id: sx.id, aluna_id: perfil.id, treino_item_id: item.id, exercicio_id: exId, numero: l.numero, carga: aerobico ? null : carga, reps: reps == null ? null : Math.round(reps), aquecimento: l.aquecimento };
      if (l.preparatoria) linha.preparatoria = true;
      if (!l.aquecimento && lerNum(l.rir) != null) linha.rir = lerNum(l.rir); // RIR real que a aluna sentiu
      const [salva] = await api.ins('series', linha);
      const antes = historico.filter((h) => h.exercicio_id === exId && !h.aquecimento && h.carga != null);
      const maxAntes = antes.length ? Math.max(...antes.map((h) => h.carga)) : null;
      setHistorico([...historico, salva]);
      const novas = ls.map((y, i) => (i === s ? { ...y, id: salva.id } : y));
      setLinhas((x) => ({ ...x, [item.id]: novas }));
      setSel((x) => ({ ...x, [item.id]: proximaPendente(novas) }));
      if (!l.aquecimento && carga != null && maxAntes != null && carga > maxAntes) toast(`Novo recorde em ${exNome(exId)}: ${num(carga, 1)} kg`, 'recorde');
      // bi-set e circuito: nas séries válidas passa direto para o próximo do grupo que ainda tem série e só descansa no fim da volta
      const grupo = METODOS_GRUPO.includes(item.metodo) ? itens.map((x, i) => [x, i]).filter(([x]) => METODOS_GRUPO.includes(x.metodo) && String(x.grupo || 1) === String(item.grupo || 1)) : [];
      const pos = grupo.findIndex(([, i]) => i === idx);
      const pendentes = (x) => (x.id === item.id ? novas : linhas[x.id]).some((y) => !y.id && !y.aquecimento) && !pulados[x.id];
      if (grupo.length > 1 && !l.aquecimento) {
        const seguinte = grupo.slice(pos + 1).find(([x]) => pendentes(x));
        if (seguinte) { setIdx(seguinte[1]); return; }
      }
      const seg = item.descanso_tipo === 'livre' ? 0 : l.aquecimento ? Math.min(60, item.descanso || 0) : item.descanso || 0;
      iniciarDescanso(seg);
      if (grupo.length > 1 && !l.aquecimento) { const volta = grupo.find(([x]) => pendentes(x)); if (volta) { setIdx(volta[1]); return; } }
      if (novas.every((y) => y.id)) { toast(`${exNome(exId)} concluído`, 'ok'); const prox = itens.findIndex((x, i) => i > idx && !feitoEx(x)); if (prox >= 0) setIdx(prox); }
    } catch (err) { toast(err.message, 'erro'); } finally { salvandoRef.current = false; setSalvando(false); }
  };
  const desfazer = async () => {
    try {
      await api.del('series', l.id);
      setHistorico(historico.filter((h) => h.id !== l.id));
      setLinhas((x) => ({ ...x, [item.id]: x[item.id].map((y, i) => (i === s ? { ...y, id: null } : y)) }));
    } catch (err) { toast(err.message, 'erro'); }
  };
  const ir2 = (n) => { const i = Math.min(itens.length - 1, Math.max(0, n)); setIdx(i); };
  const marcarFeito = () => {
    if (feitoEx(item)) { setPulados((x) => ({ ...x, [item.id]: false })); return; }
    setPulados((x) => ({ ...x, [item.id]: true }));
    const prox = itens.findIndex((x, i) => i > idx && !feitoEx(x)); if (prox >= 0) setIdx(prox);
  };

  // ---------- troca de exercício (aparelho ocupado) ----------
  const subs = (exDe(item.exercicio_id).substitutos || []).filter((id) => exercicios.some((x) => x.id === id));
  const trocar = async (novoId, lembrar) => {
    const original = novoId === item.exercicio_id;
    setTrocas((t) => ({ ...t, [item.id]: original ? undefined : novoId })); setJanela(null);
    const g = guardado(chaveTrocas(perfil.id), {});
    if (lembrar && !original) g[item.id] = novoId; else delete g[item.id];
    guardar(chaveTrocas(perfil.id), g);
    // a carga sugerida era do exercício original: limpa o que ainda não foi feito
    setLinhas((x) => ({ ...x, [item.id]: x[item.id].map((y) => (y.id ? y : { ...y, carga: '' })) }));
    if (original || novoId === exId) return;
    try { await api.ins('alertas_coach', { aluna_id: perfil.id, titulo: 'Troca de exercício', texto: `Trocou ${exNome(item.exercicio_id)} por ${exNome(novoId)} no ${treino.nome}.`, severidade: 'info' }); }
    catch (err) { /* aviso é opcional */ }
  };

  // ---------- vídeo da série para o treinador corrigir ----------
  const enviarVideo = async (ev) => {
    const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast('Vídeo muito grande (máximo 50 MB). Grave um trecho mais curto.', 'erro'); return; }
    try { if (!(await podeImagem(perfil.id))) { toast('Para enviar vídeos, autorize fotos e vídeos em Perfil > Privacidade.', 'erro'); return; } }
    catch (err) { toast(err.message, 'erro'); return; }
    const comentario = prompt('Quer deixar uma dúvida ou comentário para o treinador? (opcional)') || null;
    setEnviandoVideo(true);
    try {
      const caminho = `${perfil.id}/videos/${Date.now()}.${(f.name.split('.').pop() || 'mp4').toLowerCase()}`;
      await api.subirArquivo(caminho, f);
      await api.ins('videos_execucao', { aluna_id: perfil.id, exercicio_id: exId, treino_item_id: item.id, sessao_id: sessaoRef.current ? sessaoRef.current.id : null, caminho, comentario });
      toast('Vídeo enviado. A correção aparece aqui no exercício.', 'ok');
    } catch (err) { toast(err.message, 'erro'); } finally { setEnviandoVideo(false); }
  };

  // ---------- observações da aluna ----------
  const salvarNota = async (texto) => {
    const nv = { ...notas, [item.id]: texto.trim() || undefined };
    // sem série concluída ainda não há sessão: a nota fica guardada e vai junto quando a 1ª série for salva
    if (!sessaoRef.current) { setNotas(nv); setJanela(null); toast('Observação guardada. Ela é salva com a sua primeira série.', 'ok'); return; }
    try {
      await api.upd('sessoes', sessaoRef.current.id, { notas: nv });
      setNotas(nv); setJanela(null); toast('Observação salva', 'ok');
    } catch (err) { toast(err.message, 'erro'); }
  };

  // ---------- cancelar o treino de hoje ----------
  const cancelar = async () => {
    if (!sessao) { ir(''); return; }
    if (!confirm('Cancelar o treino? As séries que você registrou agora neste treino serão apagadas.')) return;
    try {
      await api.del('sessoes', sessao.id);   // as séries vão junto (on delete cascade)
      toast('Treino cancelado', 'ok'); ir('');
    } catch (err) { toast(err.message, 'erro'); }
  };

  // ---------- relógio de descanso e cronômetro ----------
  const resta = descanso ? Math.max(0, Math.ceil((descanso.fim - agora) / 1000)) : 0;
  const avisou = useRef(null);
  useEffect(() => {
    if (descanso && resta === 0 && avisou.current !== descanso.fim) {
      avisou.current = descanso.fim;
      try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (err) { /* */ }
      toast('Descanso acabou. Bora pra próxima!', 'ok');
      setTimeout(() => setDescanso((x) => (x && x.fim === avisou.current ? null : x)), 1500);
    }
  }, [resta]);
  const cronoSeg = crono.acumulado + (crono.inicio ? (agora - crono.inicio) / 1000 : 0);
  const prescrito = item.descanso_tipo === 'livre' ? 0 : item.descanso || 0;

  const cont = { aquec: ls.filter((x) => tipoSerie(x) === 'aquec').length, prep: ls.filter((x) => tipoSerie(x) === 'prep').length, valida: ls.filter((x) => tipoSerie(x) === 'valida').length };
  const correcao = d.videos.filter((v) => v.exercicio_id === exId && v.correcao).pop();
  const perfilR = PERFIS.find(([k]) => k === exDe(exId).perfil_resistencia);
  const ult = ultimaVez(historico, exId, sessao, aerobico);
  const metaRir = l.metaRir != null ? l.metaRir : null;
  const par = METODOS_GRUPO.includes(item.metodo) ? itens.filter((x) => x.id !== item.id && METODOS_GRUPO.includes(x.metodo) && String(x.grupo || 1) === String(item.grupo || 1)) : [];

  return html`<div class="arena">
    <div class="arena-barra">
      <button class="btn mini" onClick=${() => ir('')}>‹ Voltar</button>
      <div class="arena-tempo"><small>Tempo total</small><b>${relogio(tempoTotal)}</b></div>
      <button class="btn-texto perigo" onClick=${cancelar}>Cancelar treino</button>
    </div>

    <div class="arena-trilha" role="tablist" aria-label="Exercícios do treino">
      ${itens.map((it, i) => html`<button role="tab" aria-selected=${i === idx} aria-label=${`Exercício ${i + 1}: ${exNome(exAtual(it))}`}
        class=${'arena-passo' + (i === idx ? ' on' : '') + (feitoEx(it) ? ' feito' : '')} onClick=${() => ir2(i)}>${i + 1}</button>`)}
    </div>

    ${d.semana && html`<p class=${'semana-banner' + (d.semana.alvo.deload ? ' deload' : '')}><b>Semana ${d.semana.n} de ${d.semana.total}.</b> ${d.semana.alvo.deload
      ? 'Semana de deload: metade das séries e carga uns 10% menor. É a semana que o corpo usa para crescer.'
      : `Meta da semana: RIR ${d.semana.alvo.rir}, ou seja, terminar cada série sentindo que ainda sairiam ${d.semana.alvo.rir} repetição(ões).`}</p>`}

    <section class="arena-ex">
      <p class="arena-n">Exercício ${idx + 1} de ${itens.length}</p>
      <h1>${exNome(exId)}</h1>
      ${exId !== item.exercicio_id && html`<small class="trocado">no lugar de ${exNome(item.exercicio_id)}</small>`}
      ${par.length > 0 && html`<small class=${'grupo-tag g' + (item.grupo || 1)}>(${item.grupo || 1}) ${nomeMetodo(item.metodo)} com ${par.map((x) => exNome(exAtual(x))).join(' e ')}</small>`}
      <div class="arena-links">
        ${subs.length > 0 && html`<button class="btn-texto" onClick=${() => setJanela('trocar')}><${Icone} nome="trocar" tam=${15}/> Substituir exercício</button>`}
        ${exDe(exId).video_url && html`<a class="btn-texto" href=${exDe(exId).video_url} target="_blank" rel="noopener"><${Icone} nome="video" tam=${15}/> Ver vídeo do exercício</a>`}
        <button class="btn-texto" onClick=${() => setJanela('desempenho')}><${Icone} nome="trofeu" tam=${15}/> Seu desempenho</button>
      </div>

      <div class="arena-contagem">
        ${cont.aquec > 0 && html`<span><i class="ponto aquec"></i>Aquecimento <b>${cont.aquec}</b></span>`}
        ${cont.prep > 0 && html`<span><i class="ponto prep"></i>Preparatória <b>${cont.prep}</b></span>`}
        <span><i class="ponto valida"></i>Válidas <b>${cont.valida}</b></span>
        <span class="arena-resumo">${resumoItem(item)}</span>
      </div>

      <label class="arena-feito"><input type="checkbox" checked=${feitoEx(item)} onChange=${marcarFeito}/> Exercício concluído · ${ls.filter((x) => x.id).length}/${ls.length}</label>

      ${correcao && html`<p class="nota correcao"><b>Correção do seu treinador (${dataBR(correcao.corrigido_em || correcao.created_at)}):</b> ${correcao.correcao}</p>`}
      ${item.obs && html`<p class="nota">${item.obs}</p>`}

      <div class="arena-painel">
        <div class="arena-series">
          ${ls.map((x, i) => html`<button class=${'serie-chip ' + tipoSerie(x) + (i === s ? ' on' : '') + (x.id ? ' feita' : '')}
            aria-label=${`${{ aquec: 'Aquecimento', prep: 'Preparatória', valida: 'Série válida' }[tipoSerie(x)]} ${x.numero}${x.id ? ', concluída' : ''}`}
            onClick=${() => setSel({ ...sel, [item.id]: i })}>${x.id ? '✓ ' : ''}${x.numero}ª</button>`)}
        </div>
        <p class="arena-tipo">${{ aquec: 'Aquecimento: carga leve, poucas reps, longe da falha.', prep: 'Preparatória: carga perto da de trabalho, poucas reps, sem cansar.', valida: aerobico ? `Tempo prescrito: ${item.duracao ? item.duracao + ' min' : 'combine com o treinador'}` : `Série válida ${l.numero} de ${cont.valida}${l.metaReps ? ` · meta ${l.metaReps} reps` : ''}` }[tipoSerie(l)]}</p>
        ${!l.aquecimento && !aerobico && html`<div class="arena-rir">
          <span>Repetições na reserva${metaRir != null ? html` <small>(meta ${metaRir})</small>` : ''}</span>
          <div class="chips">${[0, 1, 2, 3, 4, 5].map((r) => html`<button class=${'chip' + (String(l.rir) === String(r) ? ' on' : '')} disabled=${!!l.id} onClick=${() => muda('rir', String(l.rir) === String(r) ? '' : String(r))}>${r}</button>`)}</div>
        </div>`}
        <div class="arena-campos">
          ${!aerobico && html`<label class="arena-campo"><small>Peso</small>
            <input inputmode="decimal" placeholder="—" value=${l.carga} disabled=${!!l.id} onInput=${(ev) => muda('carga', ev.target.value)} aria-label="Peso em kg"/><small>kg</small></label>`}
          <label class="arena-campo"><small>${aerobico ? 'Tempo feito' : 'Reps feitas'}</small>
            <input inputmode="numeric" placeholder=${aerobico ? String(item.duracao || '—') : String(l.metaReps || '—')} value=${l.reps} disabled=${!!l.id} onInput=${(ev) => muda('reps', ev.target.value)} aria-label=${aerobico ? 'Minutos' : 'Repetições feitas'}/><small>${aerobico ? 'min' : 'reps'}</small></label>
        </div>
        ${l.id ? html`<button class="btn grande feita" onClick=${desfazer}>✓ Série concluída · toque para desfazer</button>`
          : html`<button class="btn primario grande" disabled=${salvando} onClick=${concluir}>${salvando ? 'Salvando…' : '✓ Concluir série'}</button>`}
        ${ult && html`<p class="ultima">Última vez: ${ult}</p>`}
      </div>

      <div class="arena-nav">
        <button class="icone grande" aria-label="Exercício anterior" disabled=${idx === 0} onClick=${() => ir2(idx - 1)}><span class="vira"><${Icone} nome="seta" tam=${24}/></span></button>
        <div class="arena-extras">
          <button class=${'btn mini' + (notas[item.id] ? ' on' : '')} onClick=${() => setJanela('notas')}><${Icone} nome="comentario" tam=${15}/> Minhas observações</button>
          ${!aerobico && html`<label class="btn mini"><${Icone} nome="video" tam=${15}/> ${enviandoVideo ? 'Enviando…' : 'Enviar vídeo'}<input type="file" accept="video/*" capture="environment" hidden onChange=${enviarVideo}/></label>`}
        </div>
        <button class="icone grande" aria-label="Próximo exercício" disabled=${idx === itens.length - 1} onClick=${() => ir2(idx + 1)}><${Icone} nome="seta" tam=${24}/></button>
      </div>

      ${(exDe(exId).instrucoes || perfilR) && html`<details class="instr"><summary>Como executar</summary>${exDe(exId).instrucoes && html`<p>${exDe(exId).instrucoes}</p>`}${perfilR && html`<p><b>${perfilR[1]}:</b> ${perfilR[2].toLowerCase()}</p>`}</details>`}
    </section>

    <section class="arena-relogio">
      <div class="seg-chips"><button class=${modo === 'timer' ? 'on' : ''} onClick=${() => setModo('timer')}>Descanso</button><button class=${modo === 'cronometro' ? 'on' : ''} onClick=${() => setModo('cronometro')}>Cronômetro</button></div>
      ${modo === 'timer' ? html`
        <div class=${'relogio-grande' + (descanso ? ' ativo' : '')}>${descanso ? relogio(resta) : prescrito ? relogio(prescrito) : 'livre'}</div>
        ${descanso && html`<div class="progresso"><div style=${`width:${(resta / descanso.total) * 100}%`}></div></div>`}
        <div class="acoes centro">
          ${descanso ? html`<button class="btn mini" onClick=${() => setDescanso({ ...descanso, fim: descanso.fim + 15000, total: descanso.total + 15 })}>+15s</button>
            <button class="btn mini" onClick=${() => setDescanso(null)}>Pular descanso</button>`
          : prescrito ? html`<button class="btn mini" onClick=${() => iniciarDescanso(prescrito)}><${Icone} nome="relogio" tam=${15}/> Iniciar descanso</button>`
          : html`<small class="suave">Descanso livre: descanse o quanto precisar.</small>`}
        </div>` : html`
        <div class=${'relogio-grande' + (crono.inicio ? ' ativo' : '')}>${relogio(cronoSeg)}</div>
        <div class="acoes centro">
          <button class="btn mini" onClick=${() => setCrono(crono.inicio ? { inicio: null, acumulado: cronoSeg } : { ...crono, inicio: Date.now() })}>${crono.inicio ? 'Pausar' : 'Iniciar'}</button>
          <button class="btn mini" onClick=${() => setCrono({ inicio: null, acumulado: 0 })}><${Icone} nome="girar" tam=${15}/> Zerar</button>
        </div>`}
    </section>

    <div class="arena-fim">
      <p class="suave">${validasFeitas} de ${validasTotal} séries válidas</p>
      <div class="progresso"><div style=${`width:${(validasFeitas / Math.max(1, validasTotal)) * 100}%`}></div></div>
      <button class="btn grande" onClick=${() => (sessao && historico.some((h) => h.sessao_id === sessao.id) ? setJanela('finalizar') : toast('Conclua pelo menos uma série antes de finalizar.', 'erro'))}>Finalizar treino</button>
    </div>

    ${janela === 'trocar' && html`<${ModalTroca} item=${item} atual=${exId} opcoes=${[item.exercicio_id, ...subs]} exNome=${exNome} lembrado=${!(item.id in trocas) || !!guardado(chaveTrocas(perfil.id), {})[item.id]} onFechar=${() => setJanela(null)} onAplicar=${trocar}/>`}
    ${janela === 'desempenho' && html`<${Desempenho} exId=${exId} nome=${exNome(exId)} series=${historico} sessoes=${d.sessoes.concat(sessao && !d.sessoes.some((x) => x.id === sessao.id) ? [sessao] : [])} exercicios=${exercicios} aerobico=${aerobico} onFechar=${() => setJanela(null)}/>`}
    ${janela === 'notas' && html`<${ModalNota} titulo=${exNome(exId)} texto=${notas[item.id] || ''} onFechar=${() => setJanela(null)} onSalvar=${salvarNota}/>`}
    ${janela === 'finalizar' && html`<${Finalizar} sessao=${sessao} feitas=${validasFeitas} total=${validasTotal} onFechar=${() => setJanela(null)} onFeito=${() => { toast('Treino registrado. Bom trabalho!', 'ok'); ir('evolucao'); }}/>`}
    ${janela === 'tour' && html`<${Tour} onFim=${() => { guardar(CHAVE_TOUR, true); setJanela(null); }}/>`}
  </div>`;
}

function ModalTroca({ atual, opcoes, exNome, lembrado, onFechar, onAplicar }) {
  const [esc, setEsc] = useState(atual);
  const [lembrar, setLembrar] = useState(lembrado);
  return html`<${Modal} titulo="Substituir exercício" onFechar=${onFechar}><div class="pilha">
    <p class="suave">Escolha o exercício e toque em Aplicar. As séries e repetições prescritas continuam valendo, e o registro vai para o histórico do exercício que você fizer. Seu treinador é avisado quando você troca.</p>
    <div class="radio-lista">${opcoes.map((id, i) => html`<label class=${'radio-linha' + (esc === id ? ' on' : '')}>
      <input type="radio" name="troca" checked=${esc === id} onChange=${() => setEsc(id)}/> ${exNome(id)}${i === 0 ? html` <small>· prescrito</small>` : ''}</label>`)}</div>
    <label class="toggle consentir"><input type="checkbox" checked=${lembrar} onChange=${(ev) => setLembrar(ev.target.checked)}/>
      <span>Lembrar minha escolha<small class="suave"> · nos próximos treinos este exercício já vem trocado (só neste aparelho). Desligado, o treino sempre abre com o prescrito.</small></span></label>
    <div class="acoes"><button class="btn" onClick=${onFechar}>Cancelar</button><button class="btn primario" onClick=${() => onAplicar(esc, lembrar)}>Aplicar</button></div>
  </div><//>`;
}

function ModalNota({ titulo, texto, onFechar, onSalvar }) {
  const [t, setT] = useState(texto);
  return html`<${Modal} titulo="Minhas observações" onFechar=${onFechar}><div class="pilha">
    <p class="suave">${titulo}. Anote o que quiser: ajuste do aparelho, como se sentiu, dor. O treinador vê junto com o treino.</p>
    <textarea class="input" rows="4" maxlength="1000" value=${t} onInput=${(ev) => setT(ev.target.value)}></textarea>
    <button class="btn primario grande" onClick=${() => onSalvar(t)}>Salvar</button>
  </div><//>`;
}

// ---------- Seu desempenho: recorde e últimas execuções do exercício ----------
export function Desempenho({ exId, nome, series, sessoes, exercicios, aerobico, onFechar }) {
  const doEx = series.filter((x) => x.exercicio_id === exId);
  const rec = recordes(doEx, exercicios)[0];
  const sessaoDe = Object.fromEntries(sessoes.map((x) => [x.id, x]));
  const porSessao = {};
  doEx.filter((x) => !x.aquecimento).forEach((x) => { (porSessao[x.sessao_id] = porSessao[x.sessao_id] || []).push(x); });
  const datas = Object.keys(porSessao).map((id) => ({ id, s: sessaoDe[id], lista: porSessao[id].sort((a, b) => a.numero - b.numero) }))
    .sort((a, b) => ((a.s && a.s.data) || '') < ((b.s && b.s.data) || '') ? 1 : -1);
  const dataRec = rec && sessaoDe[rec.sessao_id] ? sessaoDe[rec.sessao_id].data : rec && rec.created_at;
  return html`<${Modal} titulo="Seu desempenho" onFechar=${onFechar}><div class="pilha desempenho">
    <h3 class="desempenho-nome">${nome}</h3>
    ${rec && !aerobico ? html`<div class="recorde-card"><span class="recorde-icone"><${Icone} nome="trofeu" tam=${26}/></span>
      <div><small>Recorde pessoal</small><b>${num(rec.carga, 1)} <small>kg</small></b><span class="suave">${rec.reps ?? '·'} reps · ${dataBR(dataRec)}</span></div></div>`
      : !datas.length ? html`<${Vazio} titulo="Primeira vez neste exercício" texto="Conclua as séries e o seu histórico começa a aparecer aqui."/>` : null}
    ${datas.length > 0 && html`<div class="card-topo"><h3>Últimas execuções</h3><small>${datas.length} treino(s)</small></div>`}
    ${datas.slice(0, 10).map((x) => html`<div class="execucao-dia">
      <div class="execucao-dia-topo"><b>${x.s ? dataBR(x.s.data) : '·'}</b><small>${(x.s && x.s.treino_nome) || ''}</small></div>
      <table class="tabela-series"><thead><tr><th>Série</th>${!aerobico && html`<th>Carga</th>`}<th>${aerobico ? 'Tempo' : 'Reps'}</th><th>RIR</th></tr></thead>
        <tbody>${x.lista.map((y) => html`<tr><td>${y.numero}ª</td>${!aerobico && html`<td>${y.carga == null ? 'sem peso' : num(y.carga, 1) + ' kg'}</td>`}<td>${y.reps ?? '·'}${aerobico ? ' min' : ''}</td><td>${y.rir ?? '·'}</td></tr>`)}</tbody></table>
    </div>`)}
  </div><//>`;
}

function Finalizar({ sessao, feitas, total, onFechar, onFeito }) {
  const [esforco, setEsforco] = useState(null);
  const [coment, setComent] = useState('');
  const salvar = async () => {
    try { await api.upd('sessoes', sessao.id, { concluida_em: new Date().toISOString(), esforco, comentario: coment || null }); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo="Finalizar treino" onFechar=${onFechar}>
    <div class="pilha">
      <p>${feitas} de ${total} séries válidas concluídas.${feitas < total ? ' Tudo bem, o que ficou registrado conta.' : ''}</p>
      <${Campo} rotulo="Quão pesado foi o treino? (1 = leve, 10 = máximo)"><${Escala} valor=${esforco} onMuda=${setEsforco} min=${1} max=${10}/><//>
      <${Campo} rotulo="Algo para me contar? (dor, máquina ocupada, carga que subiu)"><textarea class="input" rows="3" value=${coment} onInput=${(ev) => setComent(ev.target.value)}></textarea><//>
      <button class="btn primario grande" onClick=${salvar}>Concluir treino</button>
    </div><//>`;
}

// ---------- apresentação da tela na primeira vez ----------
const PASSOS_TOUR = [
  ['Conclua a série e descanse', 'Coloque o peso e as repetições e toque em "Concluir série". O descanso começa sozinho, com o intervalo que o treinador passou. Errou? Toque na série concluída e depois em "Série concluída" para desfazer.'],
  ['Séries e exercícios', 'As bolinhas mostram as séries: vermelho é aquecimento, amarelo é preparatória e verde são as séries válidas, as que contam para a sua evolução. As setas e os números lá em cima levam a outro exercício.'],
  ['Aparelho ocupado?', 'Em "Substituir exercício" você escolhe um equivalente que o treinador deixou cadastrado. Se quiser, o app lembra a troca neste aparelho.'],
  ['Acompanhe a sua evolução', 'Em "Seu desempenho" você vê o seu recorde e as últimas vezes que fez o exercício. Em "Minhas observações" você anota o que quiser para o treinador.'],
];
function Tour({ onFim }) {
  const [p, setP] = useState(0);
  const [t, txt] = PASSOS_TOUR[p];
  return html`<${Modal} titulo="Nova tela de treino" onFechar=${onFim}><div class="pilha tour">
    <h3>${t}</h3><p class="suave">${txt}</p>
    <div class="tour-pontos">${PASSOS_TOUR.map((x, i) => html`<i class=${i === p ? 'on' : ''}></i>`)}<small>${p + 1} de ${PASSOS_TOUR.length}</small></div>
    <div class="acoes"><button class="btn" onClick=${onFim}>Pular</button>
      <button class="btn primario" onClick=${() => (p < PASSOS_TOUR.length - 1 ? setP(p + 1) : onFim())}>${p < PASSOS_TOUR.length - 1 ? 'Próximo' : 'Começar'}</button></div>
  </div><//>`;
}
