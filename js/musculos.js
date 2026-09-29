// Músculos, volume semanal, tempo estimado e opções de prescrição da ficha.
// O volume conta séries válidas: músculo principal vale 1 série, músculo auxiliar vale 0,5.

export const MUSCULOS = {
  peitoral_maior: { nome: 'Peitoral maior', grupo: 'Peito' },
  latissimo: { nome: 'Latíssimo do dorso', grupo: 'Costas' },
  romboides: { nome: 'Romboides', grupo: 'Costas' },
  trapezio: { nome: 'Trapézio', grupo: 'Costas' },
  eretores: { nome: 'Eretores da espinha', grupo: 'Costas' },
  deltoide_anterior: { nome: 'Deltoide anterior', grupo: 'Ombros' },
  deltoide_lateral: { nome: 'Deltoide lateral', grupo: 'Ombros' },
  deltoide_posterior: { nome: 'Deltoide posterior', grupo: 'Ombros' },
  biceps: { nome: 'Bíceps braquial', grupo: 'Braços' },
  triceps: { nome: 'Tríceps braquial', grupo: 'Braços' },
  antebraco: { nome: 'Antebraço', grupo: 'Braços' },
  reto_abdominal: { nome: 'Reto abdominal', grupo: 'Core' },
  obliquos: { nome: 'Oblíquos', grupo: 'Core' },
  quadriceps: { nome: 'Quadríceps', grupo: 'Perna' },
  adutores: { nome: 'Adutores', grupo: 'Perna' },
  gluteo_maximo: { nome: 'Glúteo máximo', grupo: 'Perna' },
  gluteo_medio: { nome: 'Glúteo médio', grupo: 'Perna' },
  biceps_femoral: { nome: 'Bíceps femoral', grupo: 'Perna' },
  semitendineo: { nome: 'Semitendíneo', grupo: 'Perna' },
  panturrilha: { nome: 'Panturrilha', grupo: 'Perna' },
};
export const GRUPOS_MUSC = ['Peito', 'Costas', 'Ombros', 'Braços', 'Core', 'Perna'];

const sem = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const IS = ['biceps_femoral', 'semitendineo'];
// a ordem importa: a primeira regra que casa com o nome vence
const REGRAS = [
  [/esteira|bicicleta|bike|escada|eliptico|corrida|caminhada|remo ergometro|cardio|pular corda/, [], []],
  [/triceps|frances|testa|mergulho|paralela|dips/, ['triceps'], []],
  [/elevacao pelvica|hip thrust|ponte/, ['gluteo_maximo'], IS],
  [/coice|kickback|4 apoios|quatro apoios|gluteo na polia/, ['gluteo_maximo'], IS],
  [/abdutora|abducao|abdução/, ['gluteo_medio'], ['gluteo_maximo']],
  [/adutora|aducao/, ['adutores'], []],
  [/stiff|terra romeno|rdl|good morning/, IS, ['gluteo_maximo', 'eretores']],
  [/levantamento terra|deadlift|\bterra\b/, ['gluteo_maximo', 'eretores'], ['quadriceps', ...IS, 'trapezio']],
  [/flexora|nordic|flexao de joelho/, IS, []],
  [/bulgaro|afundo|passada|avanco|lunge|split|step ?up|subida no banco/, ['quadriceps', 'gluteo_maximo'], ['adutores', 'gluteo_medio']],
  [/sumo/, ['adutores', 'gluteo_maximo'], ['quadriceps']],
  [/agachamento|squat|hack|leg press|pendulo|smith/, ['quadriceps'], ['gluteo_maximo', 'adutores']],
  [/extensora/, ['quadriceps'], []],
  [/panturrilha|gemeos|soleo|calf/, ['panturrilha'], []],
  [/pullover/, ['latissimo'], ['peitoral_maior', 'triceps']],
  [/puxada|pulldown|pull ?down|barra fixa|pull ?up|pulley|graviton/, ['latissimo'], ['biceps', 'romboides', 'deltoide_posterior']],
  [/remada|row|serrote/, ['latissimo', 'romboides'], ['trapezio', 'deltoide_posterior', 'biceps']],
  [/lombar|hiperextensao|banco romano|superman/, ['eretores'], ['gluteo_maximo']],
  [/encolhimento|shrug/, ['trapezio'], []],
  [/crucifixo inverso|voador invertido|face pull|deltoide posterior|reverse fly/, ['deltoide_posterior'], ['romboides', 'trapezio']],
  [/crossover|crucifixo|peck deck|voador|fly/, ['peitoral_maior'], ['deltoide_anterior']],
  [/supino|chest press|flexao de braco|push ?up/, ['peitoral_maior'], ['deltoide_anterior', 'triceps']],
  [/elevacao lateral|lateral raise/, ['deltoide_lateral'], ['trapezio']],
  [/elevacao frontal|front raise/, ['deltoide_anterior'], []],
  [/desenvolvimento|militar|arnold|overhead|shoulder press/, ['deltoide_anterior', 'deltoide_lateral'], ['triceps']],
  [/rosca|curl|biceps/, ['biceps'], ['antebraco']],
  [/cross|obliqu|russian|lenhador|pallof|rotacao/, ['obliquos'], ['reto_abdominal']],
  [/prancha|abdominal|crunch|infra|elevacao de pernas|dead bug|roda abdominal|hollow/, ['reto_abdominal'], ['obliquos']],
  [/antebraco|punho|farmer/, ['antebraco'], []],
];
const POR_GRUPO = {
  'gluteos': [['gluteo_maximo'], ['gluteo_medio']], 'quadriceps': [['quadriceps'], []], 'posteriores': [IS, ['gluteo_maximo']],
  'adutores': [['adutores'], []], 'panturrilha': [['panturrilha'], []], 'costas': [['latissimo'], ['romboides', 'biceps']],
  'lombar': [['eretores'], []], 'peito': [['peitoral_maior'], ['triceps']], 'ombros': [['deltoide_lateral', 'deltoide_anterior'], []],
  'biceps': [['biceps'], []], 'triceps': [['triceps'], []], 'core': [['reto_abdominal'], ['obliquos']],
};

// { primarios: [...], secundarios: [...], auto: true|false }
export function musculosDe(ex) {
  if (!ex) return { primarios: [], secundarios: [], auto: true };
  const m = ex.musculos;
  if (m && ((m.primarios || []).length || (m.secundarios || []).length)) return { primarios: m.primarios || [], secundarios: m.secundarios || [], auto: false };
  const n = sem(ex.nome);
  for (const [re, p, s] of REGRAS) if (re.test(n)) return { primarios: p, secundarios: s, auto: true };
  const g = POR_GRUPO[sem(ex.grupo)];
  return g ? { primarios: g[0], secundarios: g[1], auto: true } : { primarios: [], secundarios: [], auto: true };
}

// tipos de exercício da ficha
export const TIPOS = {
  aquecimento: { nome: 'Aquecimento', sub: 'Preparação física', cor: '#e08a3c' },
  aerobico: { nome: 'Aeróbico', sub: 'Cardio e resistência', cor: '#4fc27d' },
  musculacao: { nome: 'Musculação', sub: 'Exercícios de força', cor: '#5b8def' },
  crossfit: { nome: 'Crossfit', sub: 'Treino funcional', cor: '#a764d6' },
};
const contaVolume = (it) => (it.tipo || 'musculacao') === 'musculacao' || it.tipo === 'crossfit';

export function tipoDoTreino(itens) {
  const tipos = [...new Set(itens.map((i) => i.tipo || 'musculacao'))];
  if (!tipos.length) return 'Vazio';
  return tipos.length === 1 ? TIPOS[tipos[0]].nome : 'Modular';
}

export const METODOS = [['padrao', 'Padrão'], ['biset', 'Bi-set'], ['triset', 'Tri-set'], ['superset', 'Super-set'], ['dropset', 'Drop-set'],
  ['restpause', 'Rest-pause'], ['cluster', 'Cluster'], ['piramide', 'Pirâmide'], ['myoreps', 'Myo-reps'], ['fst7', 'FST-7'],
  ['isometria', 'Isometria'], ['parciais', 'Parciais'], ['gvt', 'GVT (10×10)'], ['amrap', 'AMRAP'], ['emom', 'EMOM']];
export const METODOS_AEROBICO = [['continuo', 'Contínuo'], ['intervalado', 'Intervalado'], ['hiit', 'HIIT'], ['fartlek', 'Fartlek']];
export const nomeMetodo = (k) => ([...METODOS, ...METODOS_AEROBICO].find(([x]) => x === k) || [null, 'Padrão'])[1];

export const DESCANSOS = [['exato', 'Descanso exato (s)'], ['faixa', 'Descanso faixa (s)'], ['livre', 'Descanso livre']];

// "8-12" <-> {min, max}; "15" -> {min:15,max:15}; "30s" fica como texto
export function lerFaixa(reps) {
  const t = String(reps || '').trim();
  const m = t.match(/^(\d+)\s*(?:-|a|–|até)\s*(\d+)$/);
  if (m) return { min: m[1], max: m[2] };
  if (/^\d+$/.test(t)) return { min: t, max: '' };
  return { min: t, max: '' };
}
export const juntarFaixa = (min, max) => { const a = String(min || '').trim(), b = String(max || '').trim(); return a && b && a !== b ? `${a}-${b}` : a || b; };

export const textoCadencia = (it) => (it.cadencia_exc == null && it.cadencia_con == null ? '' : `Excêntrica ${fmt(it.cadencia_exc)}s / Concêntrica ${fmt(it.cadencia_con)}s`);
export const textoDescanso = (it) => {
  const t = it.descanso_tipo || 'exato';
  if (t === 'livre') return 'descanso livre';
  if (t === 'faixa' && it.descanso_max) return `descanso ${it.descanso || 0}–${it.descanso_max}s`;
  return `descanso ${it.descanso || 0}s`;
};
export const textoEsforco = (it) => (it.esforco_alvo == null ? '' : `${(it.esforco_tipo || 'rir').toUpperCase()} ${fmt(it.esforco_alvo)}`);
const fmt = (v) => (v == null || v === '' ? '0' : String(v).replace('.', ','));

// ---------- tempo estimado ----------
const descansoMedio = (it) => {
  const t = it.descanso_tipo || 'exato';
  if (t === 'livre') return 90;
  if (t === 'faixa' && it.descanso_max) return (Number(it.descanso || 0) + Number(it.descanso_max)) / 2;
  return Number(it.descanso || 0);
};
export function tempoItem(it) {
  if (it.tipo === 'aerobico') return Number(it.duracao || 0) * 60;
  const reps = String(it.reps || '').trim();
  // cadência padrão: excêntrica 2s, concêntrica 0s
  const porRep = Math.max(1, Number(it.cadencia_exc ?? 2) + Number(it.cadencia_con ?? 0));
  let porSerie;
  const seg = reps.match(/^(\d+)\s*s/);
  if (seg) porSerie = Number(seg[1]);
  else { const f = lerFaixa(reps); const a = Number(f.min) || 0, b = Number(f.max) || a; porSerie = ((a + b) / 2 || 10) * porRep; }
  const series = Number(it.series || 0), aq = Number(it.aquecimento || 0);
  const desc = descansoMedio(it);
  return series * porSerie + Math.max(0, series - 1) * desc + aq * (porSerie * 0.8 + 45);
}
export function tempoTreino(itens) {
  const l = [...itens].sort((a, b) => a.ordem - b.ordem);
  // entre um exercício e o próximo também há um descanso
  return l.reduce((t, it, i) => t + tempoItem(it) + (i < l.length - 1 && it.tipo !== 'aerobico' ? descansoMedio(it) : 0), 0);
}
export function fmtTempo(seg) {
  seg = Math.round(seg);
  if (seg <= 0) return '0min';
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}min`;
  return s && m < 10 ? `${m}min ${String(s).padStart(2, '0')}s` : `${m}min`;
}

// ---------- volume ----------
export function volumePorMusculo(itens, exercicios) {
  const v = {};
  for (const it of itens) {
    if (!contaVolume(it)) continue;
    const ex = exercicios.find((e) => e.id === it.exercicio_id);
    const { primarios, secundarios } = musculosDe(ex);
    const n = Number(it.series || 0);
    primarios.forEach((m) => { v[m] = (v[m] || 0) + n; });
    secundarios.forEach((m) => { if (!primarios.includes(m)) v[m] = (v[m] || 0) + n * 0.5; });
  }
  return v;
}
export const seriesValidas = (itens) => itens.filter(contaVolume).reduce((t, i) => t + Number(i.series || 0), 0);
export const REF_VOLUME = 15;
export function nivelVolume(v) {
  if (v >= 15) return ['altissimo', 'Altíssimo'];
  if (v >= 10) return ['alto', 'Alto'];
  if (v >= 5) return ['moderado', 'Moderado'];
  return ['baixo', 'Baixo'];
}
