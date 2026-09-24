// Motor de regras dos formulários vivos (mesmo formato do avaliar_regra do banco).
// Regra: { todas: [...] } | { alguma: [...] } | { nao: regra } | { campo, op, valor }
// campo aponta para resp. (resposta atual), ctx. (histórico) ou aluna. (perfil).
// Operador desconhecido ou valor inválido devolve falso: regra mal escrita nunca quebra a tela.

export const pegar = (fonte, caminho) => String(caminho || '').split('.').reduce((o, k) => (o == null ? undefined : o[k]), fonte);
export const presente = (a) => a != null && a !== '' && !(Array.isArray(a) && a.length === 0);
const n = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
const igual = (a, b) => (typeof a === 'object' || typeof b === 'object' ? JSON.stringify(a) === JSON.stringify(b) : a === b);

const OPS = {
  '=': (a, b) => igual(a, b),
  '!=': (a, b) => !igual(a, b),
  '<': (a, b) => n(a) != null && n(b) != null && n(a) < n(b),
  '<=': (a, b) => n(a) != null && n(b) != null && n(a) <= n(b),
  '>': (a, b) => n(a) != null && n(b) != null && n(a) > n(b),
  '>=': (a, b) => n(a) != null && n(b) != null && n(a) >= n(b),
  entre: (a, b) => Array.isArray(b) && n(a) != null && n(a) >= n(b[0]) && n(a) <= n(b[1]),
  em: (a, b) => Array.isArray(b) && b.some((x) => igual(x, a)),
  contem: (a, b) => Array.isArray(a) && a.some((it) => (b && typeof b === 'object' ? Object.entries(b).every(([k, v]) => it && it[k] === v) : igual(it, b))),
  respondida: (a) => presente(a),
  vazia: (a) => !presente(a),
  subiu: (a, b) => n(a) != null && n(b) != null && n(a) > n(b),
  caiu: (a, b) => n(a) != null && n(b) != null && n(a) < n(b),
};
export const OPERADORES = Object.keys(OPS);

export function avaliar(regra, fonte) {
  try {
    if (!regra) return true;
    if (regra.todas) return regra.todas.every((r) => avaliar(r, fonte));
    if (regra.alguma) return regra.alguma.some((r) => avaliar(r, fonte));
    if (regra.nao) return !avaliar(regra.nao, fonte);
    const a = pegar(fonte, regra.campo);
    const b = typeof regra.valor === 'string' && /^(ctx|resp|aluna)\./.test(regra.valor) ? pegar(fonte, regra.valor) : regra.valor;
    const f = OPS[regra.op];
    return f ? !!f(a, b) : false;
  } catch (e) { return false; }
}

// "Você marcou dor {{ctx.ultima_dor.intensidade}}" -> "Você marcou dor 4"
export const preencher = (modelo, fonte) => String(modelo || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, c) => { const v = pegar(fonte, c); return v == null ? '' : String(v); });

// descrição em português simples de uma regra (usada no construtor)
const NOMES_OP = { '=': 'igual a', '!=': 'diferente de', '<': 'menor que', '<=': 'até', '>': 'maior que', '>=': 'a partir de', entre: 'entre', em: 'é um de', contem: 'contém', respondida: 'foi respondida', vazia: 'está vazia', subiu: 'subiu em relação a', caiu: 'caiu em relação a' };
export function descrever(regra) {
  if (!regra) return 'sempre';
  if (regra.todas) return regra.todas.map(descrever).join(' e ');
  if (regra.alguma) return '(' + regra.alguma.map(descrever).join(' ou ') + ')';
  if (regra.nao) return 'não (' + descrever(regra.nao) + ')';
  const v = ['respondida', 'vazia'].includes(regra.op) ? '' : ' ' + (Array.isArray(regra.valor) ? regra.valor.join(', ') : regra.valor);
  return `${regra.campo} ${NOMES_OP[regra.op] || regra.op}${v}`;
}

// ---------- mapa corporal ----------
export const REGIOES = [
  ['cervical', 'Coluna cervical', false], ['ombro', 'Ombro', true], ['cotovelo', 'Cotovelo', true], ['punho', 'Punho', true],
  ['toracica', 'Coluna torácica', false], ['lombar', 'Lombar', false], ['quadril', 'Quadril / glúteo', true], ['virilha', 'Virilha', true],
  ['coxa_anterior', 'Coxa (frente)', true], ['coxa_posterior', 'Coxa (trás)', true], ['joelho', 'Joelho', true],
  ['panturrilha', 'Panturrilha', true], ['tornozelo', 'Tornozelo', true],
];
// espelho de public.nome_regiao
export function nomeRegiao(regiao, lado) {
  const base = { cervical: 'coluna cervical', toracica: 'coluna torácica', coxa_anterior: 'coxa', coxa_posterior: 'coxa' }[regiao] || regiao;
  const fem = ['coxa_anterior', 'coxa_posterior', 'panturrilha'].includes(regiao);
  const l = !lado || lado === 'centro' ? '' : lado === 'D' ? (fem ? ' direita' : ' direito') : (fem ? ' esquerda' : ' esquerdo');
  const extra = regiao === 'coxa_anterior' ? ' (frente)' : regiao === 'coxa_posterior' ? ' (trás)' : '';
  return base + l + extra;
}

// escala RIR (Zourdos et al., 2016)
export const RIR = [
  [10, 'No limite: não sairia mais nenhuma repetição'], [9.5, 'Talvez saísse mais uma, com risco de falhar'],
  [9, 'Quase no limite: caberia mais 1'], [8.5, 'Caberiam 1, talvez 2'], [8, 'Pesado, mas caberiam mais 2'],
  [7, 'Firme e controlado, sobrariam 3'], [5.5, 'Moderado, daria para fazer bem mais'], [3, 'Leve, aquecimento'],
];

export const FASES = { menstrual: 'menstrual', folicular: 'folicular', ovulatoria: 'ovulatória', lutea: 'lútea', lutea_tardia: 'lútea tardia' };
export function textoCiclo(c) {
  if (!c || c.status !== 'ok') return c && c.status === 'atrasado' ? `ciclo atrasado (dia ${c.dia_ciclo})` : '';
  return `fase ${FASES[c.fase] || c.fase}, dia ${c.dia_ciclo} · estimativa ${c.confianca === 'media' ? 'média' : 'aproximada'}`;
}
