// MODO DEMONSTRAÇÃO: imita o Supabase com dados de exemplo guardados no navegador.
// Serve para ver e testar o app antes de ligar o banco de verdade.
const CHAVE = 'nemesis-demo-v1';
let memoria = null;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const segunda = (d) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return iso(x); };

function semear() {
  const db = { profiles: [], exercicios: [], treinos: [], treino_itens: [], sessoes: [], series: [], checkins: [],
    anamneses: [], avaliacoes: [], leads: [], planos: [], assinaturas: [], lancamentos: [] };
  const coach = { id: 'coach-demo', role: 'coach', nome: 'Luiz Victor', email: 'treinador@demo', sexo: 'M', ativo: true, anamnese_ok: true, created_at: diasAtras(120).toISOString() };
  const alunas = [
    { id: 'aluna-ana', nome: 'Ana Beatriz', email: 'ana@demo', telefone: '11999990001', nascimento: '1998-04-12', objetivo: 'Glúteo e definição' },
    { id: 'aluna-carol', nome: 'Carolina Mendes', email: 'carol@demo', telefone: '11999990002', nascimento: '1993-09-02', objetivo: 'Emagrecimento com força' },
    { id: 'aluna-bia', nome: 'Beatriz Lopes', email: 'bia@demo', telefone: '11999990003', nascimento: '2001-01-20', objetivo: 'Ganhar massa' },
  ].map((a) => ({ role: 'student', sexo: 'F', ativo: true, anamnese_ok: true, created_at: diasAtras(80).toISOString(), ...a }));
  db.profiles.push(coach, ...alunas);

  const nomes = [['Elevação pélvica na máquina', 'Glúteos'], ['Stiff com barra', 'Posteriores'], ['Cadeira abdutora 45°', 'Glúteos'],
    ['Mesa flexora', 'Posteriores'], ['Agachamento búlgaro no Smith', 'Quadríceps'], ['Leg press 45°', 'Quadríceps'],
    ['Cadeira extensora', 'Quadríceps'], ['Puxada barra anatômica', 'Costas'], ['Remada baixa', 'Costas'],
    ['Supino reto com halteres', 'Peito'], ['Elevação lateral com halteres', 'Ombros'], ['Desenvolvimento com halteres', 'Ombros'],
    ['Rosca martelo', 'Bíceps'], ['Tríceps na polia (corda)', 'Tríceps'], ['Abdução de quadril com elástico', 'Glúteos'],
    ['Prancha', 'Core'], ['Cadeira adutora', 'Adutores'], ['Crucifixo inverso', 'Ombros']];
  const ex = {};
  for (const [nome, grupo] of nomes) { const e = { id: uid(), nome, grupo, video_url: '', instrucoes: '' }; ex[nome] = e; db.exercicios.push(e); }

  const fichas = [
    ['A · Inferior posterior', false, [['Abdução de quadril com elástico', 0, 2, '15-20', 45], ['Elevação pélvica na máquina', 1, 3, '8-12', 120], ['Stiff com barra', 1, 3, '8-12', 120], ['Mesa flexora', 0, 3, '10-12', 90], ['Cadeira abdutora 45°', 0, 3, '12-15', 60]]],
    ['B · Superior', false, [['Puxada barra anatômica', 1, 3, '8-12', 90], ['Remada baixa', 0, 3, '8-12', 90], ['Supino reto com halteres', 0, 3, '8-12', 90], ['Elevação lateral com halteres', 0, 4, '12-15', 60], ['Rosca martelo', 0, 3, '10-12', 60], ['Tríceps na polia (corda)', 0, 3, '10-12', 60]]],
    ['C · Inferior anterior', false, [['Agachamento búlgaro no Smith', 1, 3, '8-10', 120], ['Leg press 45°', 0, 3, '10-12', 120], ['Cadeira extensora', 0, 3, '12-15', 60], ['Cadeira adutora', 0, 3, '12-15', 60], ['Prancha', 0, 3, '30-45s', 45]]],
    ['D · Superior + glúteo (opcional)', true, [['Elevação pélvica na máquina', 0, 3, '12-15', 90], ['Crucifixo inverso', 0, 3, '12-15', 60], ['Desenvolvimento com halteres', 0, 3, '8-12', 90]]],
  ];
  for (const a of alunas) {
    fichas.forEach(([nome, opcional, itens], i) => {
      const t = { id: uid(), aluna_id: a.id, nome, ordem: i, opcional, observacoes: '', ativo: true };
      db.treinos.push(t);
      itens.forEach(([n, aq, s, r, d], j) => db.treino_itens.push({ id: uid(), treino_id: t.id, aluna_id: a.id, exercicio_id: ex[n].id, ordem: j, aquecimento: aq, series: s, reps: r, descanso: d, tecnica: '', obs: '' }));
    });
  }

  // histórico de 10 semanas da Ana (carga subindo aos poucos)
  const base = { 'Elevação pélvica na máquina': 40, 'Stiff com barra': 20, 'Mesa flexora': 20, 'Cadeira abdutora 45°': 35, 'Puxada barra anatômica': 25, 'Remada baixa': 25, 'Supino reto com halteres': 8, 'Elevação lateral com halteres': 4, 'Rosca martelo': 6, 'Tríceps na polia (corda)': 12, 'Agachamento búlgaro no Smith': 10, 'Leg press 45°': 80, 'Cadeira extensora': 25, 'Cadeira adutora': 30 };
  const treinosAna = db.treinos.filter((t) => t.aluna_id === 'aluna-ana' && !t.opcional);
  for (const alunaId of ['aluna-ana', 'aluna-carol']) {
    const ts = db.treinos.filter((t) => t.aluna_id === alunaId && !t.opcional);
    const fator = alunaId === 'aluna-ana' ? 1 : 0.8;
    for (let sem = 10; sem >= 0; sem--) {
      [5, 3, 1].forEach((offset, k) => {
        const dias = sem * 7 + offset;
        if (dias < 1) return;
        if (alunaId === 'aluna-carol' && sem < 2) return; // Carol sumiu nas últimas 2 semanas
        const t = ts[(10 - sem + k) % ts.length];
        const d = diasAtras(dias);
        const s = { id: uid(), aluna_id: alunaId, treino_id: t.id, treino_nome: t.nome, data: iso(d), iniciada_em: d.toISOString(), concluida_em: d.toISOString(), esforco: 7 + (k % 2), comentario: '' };
        db.sessoes.push(s);
        db.treino_itens.filter((i) => i.treino_id === t.id).forEach((i) => {
          const e = db.exercicios.find((x) => x.id === i.exercicio_id);
          const b = base[e.nome];
          for (let n = 1; n <= i.series; n++) {
            const carga = b == null ? null : Math.round((b * fator + (10 - sem) * b * 0.025) * 2) / 2;
            db.series.push({ id: uid(), sessao_id: s.id, aluna_id: alunaId, treino_item_id: i.id, exercicio_id: i.exercicio_id, numero: n, carga, reps: 10 + ((n + sem) % 3) - 1, aquecimento: false, created_at: d.toISOString() });
          }
        });
      });
    }
  }
  void treinosAna;

  // check-ins
  for (let sem = 6; sem >= 1; sem--) {
    db.checkins.push({ id: uid(), aluna_id: 'aluna-ana', semana: segunda(diasAtras(sem * 7)), peso: 63.8 - (6 - sem) * 0.2, sono: 3 + (sem % 2), energia: 4, estresse: 2 + (sem % 3 === 0 ? 1 : 0), fome: 3, dor: 1, dieta: 4, treinos_feitos: 3, comentario: sem === 1 ? 'Semana boa, senti o glúteo bem mais no stiff.' : '', resposta: sem === 1 ? null : 'Ótima semana, segue assim.', respondido_em: sem === 1 ? null : diasAtras(sem * 7 - 1).toISOString(), created_at: diasAtras(sem * 7 - 6).toISOString() });
  }
  db.checkins.push({ id: uid(), aluna_id: 'aluna-bia', semana: segunda(diasAtras(7)), peso: 54.7, sono: 2, energia: 2, estresse: 3, fome: 2, dor: 2, dieta: 3, treinos_feitos: 4, comentario: 'Muito cansada, o aquecimento está me matando.', resposta: null, respondido_em: null, created_at: diasAtras(2).toISOString() });

  db.anamneses.push({ aluna_id: 'aluna-ana', respostas: { objetivo: 'Glúteo mais projetado e braço mais definido', experiencia: '1 a 3 anos', dias_semana: '4', tempo_sessao: '60 min', local_treino: 'Academia completa', rotina_trabalho: 'Sentada a maior parte do dia', sono_horas: '7', lesoes: 'Nenhuma', parq: { p1: 'Não', p2: 'Não', p3: 'Não', p4: 'Não', p5: 'Não', p6: 'Não', p7: 'Não' } }, updated_at: diasAtras(80).toISOString() });

  db.avaliacoes.push(
    { id: uid(), aluna_id: 'aluna-ana', data: iso(diasAtras(75)), idade: 27, peso: 64.9, altura: 165, dobras: { peitoral: 12, axilar: 11, triceps: 20, subescapular: 14, abdominal: 22, suprailiaca: 18, coxa: 28 }, medidas: { cintura: 72, quadril: 100, coxa: 58, braco: 28 }, percentual_gordura: 25.1, obs: '' },
    { id: uid(), aluna_id: 'aluna-ana', data: iso(diasAtras(12)), idade: 27, peso: 63.4, altura: 165, dobras: { peitoral: 10, axilar: 10, triceps: 18, subescapular: 12, abdominal: 18, suprailiaca: 15, coxa: 25 }, medidas: { cintura: 69, quadril: 101, coxa: 58.5, braco: 27.5 }, percentual_gordura: 22.4, obs: 'Cintura caiu 3 cm, quadril subiu.' });

  db.planos.push({ id: 'p1', nome: 'Ágora', meses: 1, valor: 247, ativo: true }, { id: 'p2', nome: 'Delfos', meses: 3, valor: 647, ativo: true }, { id: 'p3', nome: 'Ítaca', meses: 6, valor: 1197, ativo: true }, { id: 'p4', nome: 'Olimpo', meses: 12, valor: 1997, ativo: true });

  const somaMes = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const assinar = (alunaId, plano, inicio, parcelas, pagas) => {
    const a = { id: uid(), aluna_id: alunaId, plano_id: plano.id, plano_nome: plano.nome, inicio: iso(inicio), fim: iso(somaMes(inicio, plano.meses)), valor: plano.valor, forma_pagamento: parcelas > 1 ? `Cartão ${parcelas}x` : 'Pix', obs: '' };
    db.assinaturas.push(a);
    for (let i = 0; i < parcelas; i++) {
      const v = somaMes(inicio, i);
      db.lancamentos.push({ id: uid(), tipo: 'receita', descricao: `${plano.nome} · ${db.profiles.find((p) => p.id === alunaId).nome}` + (parcelas > 1 ? ` (${i + 1}/${parcelas})` : ''), categoria: 'Consultoria', valor: Math.round((plano.valor / parcelas) * 100) / 100, vencimento: iso(v), pago_em: i < pagas ? iso(v) : null, aluna_id: alunaId, assinatura_id: a.id });
    }
  };
  assinar('aluna-ana', db.planos[1], diasAtras(80), 3, 3);
  assinar('aluna-carol', db.planos[0], diasAtras(24), 1, 1);
  assinar('aluna-bia', db.planos[2], diasAtras(40), 6, 1);
  db.lancamentos.push(
    { id: uid(), tipo: 'despesa', descricao: 'Ferramenta de edição de vídeo', categoria: 'Ferramentas', valor: 49.9, vencimento: iso(diasAtras(10)), pago_em: iso(diasAtras(10)), aluna_id: null, assinatura_id: null },
    { id: uid(), tipo: 'despesa', descricao: 'Anúncio Instagram', categoria: 'Marketing', valor: 150, vencimento: iso(diasAtras(3)), pago_em: iso(diasAtras(3)), aluna_id: null, assinatura_id: null });

  db.leads.push(
    { id: uid(), nome: 'Juliana Rocha', whatsapp: '11988887777', instagram: '@ju.rocha', idade: 29, objetivo: 'Glúteo e perna', experiencia: 'Menos de 6 meses', dias_semana: '3', local_treino: 'Academia completa', plano_interesse: 'Delfos', mensagem: 'Nunca sei se estou fazendo certo.', status: 'novo', created_at: diasAtras(1).toISOString() },
    { id: uid(), nome: 'Marina Alves', whatsapp: '11977776666', instagram: '@mari.alves', idade: 34, objetivo: 'Emagrecer', experiencia: 'Voltando depois de uma pausa', dias_semana: '4', local_treino: 'Academia de condomínio', plano_interesse: 'Ainda não sei', mensagem: '', status: 'contatado', created_at: diasAtras(5).toISOString() });
  return db;
}

function carregar() {
  if (memoria) return memoria;
  try { const s = localStorage.getItem(CHAVE); if (s) memoria = JSON.parse(s); } catch (e) { /* sem storage */ }
  if (!memoria) memoria = { db: semear(), usuario: null };
  return memoria;
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(memoria)); } catch (e) { /* sem storage */ } }
const copia = (x) => JSON.parse(JSON.stringify(x));
const espera = () => new Promise((r) => setTimeout(r, 60));

export function criarDemo() {
  const ouvintes = [];
  const avisar = () => { const u = carregar().usuario; ouvintes.forEach((f) => f(u)); };
  return {
    demo: true,
    async sessao() { return carregar().usuario; },
    async entrarComo(id) { const m = carregar(); const p = m.db.profiles.find((x) => x.id === id); m.usuario = { id: p.id, email: p.email }; salvar(); avisar(); },
    async entrar() { throw new Error('No modo demonstração use os botões "Entrar como treinador" ou "Entrar como aluna".'); },
    async cadastrar() { throw new Error('Cadastro fica disponível quando o banco (Supabase) estiver ligado.'); },
    async recuperar() { throw new Error('Disponível quando o banco estiver ligado.'); },
    async sair() { carregar().usuario = null; salvar(); avisar(); },
    aoMudarSessao(fn) { ouvintes.push(fn); },
    reiniciar() { memoria = { db: semear(), usuario: carregar().usuario }; salvar(); },
    async q(tabela, { eq = {}, order, asc = true, gte, lte, limit } = {}) {
      await espera();
      let l = (carregar().db[tabela] || []).filter((r) => Object.entries(eq).every(([k, v]) => (v === null ? r[k] == null : r[k] === v)));
      if (gte) l = l.filter((r) => Object.entries(gte).every(([k, v]) => r[k] >= v));
      if (lte) l = l.filter((r) => Object.entries(lte).every(([k, v]) => r[k] <= v));
      if (order) l = l.slice().sort((a, b) => (a[order] > b[order] ? 1 : a[order] < b[order] ? -1 : 0) * (asc ? 1 : -1));
      if (limit) l = l.slice(0, limit);
      return copia(l);
    },
    async um(tabela, eq) { const l = await this.q(tabela, { eq, limit: 1 }); return l[0] || null; },
    async ins(tabela, linha) {
      await espera();
      const m = carregar(); const linhas = (Array.isArray(linha) ? linha : [linha]).map((r) => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
      if (tabela === 'leads') linhas.forEach((r) => { r.status = r.status || 'novo'; });
      (m.db[tabela] = m.db[tabela] || []).push(...linhas); salvar(); return copia(linhas);
    },
    async enviar(tabela, linha) { await this.ins(tabela, linha); },
    async upd(tabela, id, patch, chave = 'id') {
      await espera();
      const m = carregar(); const out = [];
      (m.db[tabela] || []).forEach((r) => { if (r[chave] === id) { Object.assign(r, patch); out.push(r); } });
      salvar(); return copia(out);
    },
    async ups(tabela, linha, conflito) {
      const m = carregar(); const ks = conflito.split(',');
      const ex = (m.db[tabela] || []).find((r) => ks.every((k) => r[k] === linha[k]));
      if (ex) { Object.assign(ex, linha); salvar(); return copia([ex]); }
      return this.ins(tabela, linha);
    },
    async del(tabela, id) {
      await espera();
      const m = carregar(); m.db[tabela] = (m.db[tabela] || []).filter((r) => r.id !== id);
      if (tabela === 'treinos') m.db.treino_itens = m.db.treino_itens.filter((r) => r.treino_id !== id);
      if (tabela === 'sessoes') m.db.series = m.db.series.filter((r) => r.sessao_id !== id);
      if (tabela === 'assinaturas') m.db.lancamentos = m.db.lancamentos.filter((r) => r.assinatura_id !== id);
      salvar();
    },
    async rpc() { throw new Error('Esta parte (Acrópole, formulários vivos) só funciona com o banco ligado.'); },
    aoInserir() { return () => {}; },
  };
}
