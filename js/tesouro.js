// TESOURO · financeiro do treinador.
// Plano = pacote de entregas: ao registrar o plano da aluna, a agenda do ciclo se monta sozinha.
import { html, useState } from '../lib/preact-htm.js';
import { api } from './api.js';
import { useCarregar, Estado, Vazio, Modal, Campo, Abas, Barras, toast, brl, dataBR, hoje, somaDias, somaMeses, diasEntre, mesNome } from './util.js';

// ---------- dinheiro ----------
// máscara de moeda: os dígitos entram como centavos ("19700" vira R$ 197,00)
export function InputMoeda({ valor, onValor, ...resto }) {
  return html`<input class="input" inputmode="numeric" value=${brl(valor || 0)} ...${resto}
    onInput=${(ev) => { const d = ev.target.value.replace(/\D/g, ''); const n = Number(d || 0) / 100; onValor(n); ev.target.value = brl(n); }}/>`;
}
// taxa padrão por forma de pagamento (editável na hora de registrar)
export const TAXAS = { Pix: { pct: 0, fixo: 0 }, Cartão: { pct: 3.99, fixo: 0.39 }, Boleto: { pct: 0, fixo: 1.99 }, Dinheiro: { pct: 0, fixo: 0 } };
export function estimativa(valor, parcelas, taxa) {
  const bruto = Number(valor || 0);
  const t = bruto * (Number(taxa.pct || 0) / 100) + Number(taxa.fixo || 0) * parcelas;
  return { bruto, taxa: t, liquido: bruto - t, parcela: parcelas ? bruto / parcelas : bruto };
}

// ---------- entregas do plano ----------
export const ENTREGAS_PADRAO = { checkin_semanal: true, call_mensal: false, avaliacao_semanas: null, relatorio_mensal: false, lembrete_renovacao_dias: 7 };
export const entregasDe = (p) => ({ ...ENTREGAS_PADRAO, ...((p && p.entregas) || {}) });
export function textoEntregas(e) {
  return [e.checkin_semanal && 'check-in semanal', e.call_mensal && 'call mensal de metas', e.avaliacao_semanas && `avaliação a cada ${e.avaliacao_semanas} semanas`,
    e.relatorio_mensal && 'relatório do mês', e.lembrete_renovacao_dias && `conversa de renovação ${e.lembrete_renovacao_dias} dias antes`].filter(Boolean);
}
// compromissos que o ciclo do plano gera na agenda
export function agendaDoCiclo(e, inicio, fim, aluna) {
  const l = [];
  const quando = (dia, hora = '19:00') => new Date(`${dia}T${hora}:00`).toISOString();
  const nome = (aluna.nome || '').split(' ')[0];
  if (e.call_mensal) for (let d = somaMeses(inicio, 1); d < fim; d = somaMeses(d, 1)) l.push({ aluna_id: aluna.id, titulo: `Call mensal de metas · ${nome}`, tipo: 'video', inicio: quando(d) });
  if (e.avaliacao_semanas) for (let d = somaDias(inicio, e.avaliacao_semanas * 7); d < fim; d = somaDias(d, e.avaliacao_semanas * 7)) l.push({ aluna_id: aluna.id, titulo: `Avaliação física · ${nome}`, tipo: 'avaliacao', inicio: quando(d, '09:00') });
  if (e.relatorio_mensal) for (let d = somaDias(somaMeses(inicio, 1), -1); d <= fim; d = somaDias(somaMeses(somaDias(d, 1), 1), -1)) l.push({ aluna_id: aluna.id, titulo: `Enviar relatório do mês · ${nome}`, tipo: 'lembrete', inicio: quando(d, '10:00') });
  if (e.lembrete_renovacao_dias) { const d = somaDias(fim, -e.lembrete_renovacao_dias); if (d > inicio) l.push({ aluna_id: aluna.id, titulo: `Conversa de renovação · ${nome}`, tipo: 'lembrete', inicio: quando(d, '10:00') }); }
  return l;
}

// ---------- métricas ----------
const mesesDe = (a) => Math.max(1, Math.round(diasEntre(a.inicio, a.fim) / 30.4));
export function metricas({ assinaturas, lanc, alunas }) {
  const hj = hoje();
  const ativasIds = new Set(alunas.filter((a) => a.ativo).map((a) => a.id));
  const vigentes = assinaturas.filter((a) => a.inicio <= hj && a.fim >= hj && ativasIds.has(a.aluna_id));
  const mrr = vigentes.reduce((t, a) => t + Number(a.valor) / mesesDe(a), 0);
  const temSeguinte = (a) => assinaturas.some((b) => b.id !== a.id && b.aluna_id === a.aluna_id && b.inicio >= somaDias(a.fim, -20));
  const renovar = vigentes.filter((a) => diasEntre(hj, a.fim) <= 15 && !temSeguinte(a));
  const encerradas = assinaturas.filter((a) => a.fim < hj && a.fim >= somaDias(hj, -90));
  const renovadas = encerradas.filter(temSeguinte);
  const pagos = lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.aluna_id);
  const porAluna = {}; pagos.forEach((l) => { porAluna[l.aluna_id] = (porAluna[l.aluna_id] || 0) + Number(l.valor); });
  const ltv = Object.values(porAluna); const atrasadas = lanc.filter((l) => l.tipo === 'receita' && !l.pago_em && l.vencimento < hj);
  return { mrr, ativas: new Set(vigentes.map((a) => a.aluna_id)).size, vigentes, renovar, taxaRenovacao: encerradas.length ? renovadas.length / encerradas.length : null,
    encerradas: encerradas.length, ltv: ltv.length ? ltv.reduce((a, b) => a + b, 0) / ltv.length : 0, atrasadas, inadimplencia: atrasadas.reduce((t, l) => t + Number(l.valor), 0) };
}

// ============================================================
// TELA
// ============================================================
export function Financeiro() {
  const [aba, setAba] = useState('resumo');
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [modal, setModal] = useState(null);
  const e = useCarregar(async () => {
    const [lanc, alunas, assinaturas, planos] = await Promise.all([api.q('lancamentos', { order: 'vencimento' }), api.q('profiles', { eq: { role: 'student' }, order: 'nome' }), api.q('assinaturas', {}), api.q('planos', { order: 'meses' })]);
    return { lanc, alunas, assinaturas, planos };
  }, []);
  const pagar = async (l) => { try { await api.upd('lancamentos', l.id, { pago_em: l.pago_em ? null : hoje() }); e.recarregar(); } catch (err) { toast(err.message, 'erro'); } };
  const feito = () => { setModal(null); e.recarregar(); };
  return html`<div class="pilha">
    <div class="titulo-acoes"><h1 class="titulo">Tesouro</h1><button class="btn primario" onClick=${() => setModal({ tipo: 'lanc' })}>+ Lançamento</button></div>
    <${Abas} abas=${[['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['planos', 'Planos']]} atual=${aba} onMuda=${setAba}/>
    <${Estado} e=${e}>${({ lanc, alunas, assinaturas, planos }) => {
      const m = metricas({ assinaturas, lanc, alunas });
      const soma = (l) => l.reduce((t, x) => t + Number(x.valor), 0);
      const ativas = alunas.filter((a) => a.ativo);
      const nome = (id) => (alunas.find((a) => a.id === id) || {}).nome || 'Aluna';
      let corpo;
      if (aba === 'resumo') {
        const mesAtual = hoje().slice(0, 7);
        const recebido = soma(lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.pago_em.slice(0, 7) === mesAtual));
        const seis = [...Array(6)].map((_, i) => somaMeses(mesAtual + '-15', i - 5).slice(0, 7)).map((x) => ({ x: mesNome(x).split(' ')[0], v: soma(lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.pago_em.slice(0, 7) === x)) }));
        const porPlano = {}; m.vigentes.forEach((a) => { porPlano[a.plano_nome || 'Outro'] = (porPlano[a.plano_nome || 'Outro'] || 0) + Number(a.valor) / mesesDe(a); });
        const semPlano = ativas.filter((a) => !m.vigentes.some((v) => v.aluna_id === a.id));
        corpo = html`
          <div class="kpis tesouro">
            <div class="kpi-t"><span>MRR</span><b>${brl(m.mrr)}</b><small>receita recorrente por mês</small></div>
            <div class="kpi-t"><span>Alunas ativas</span><b>${m.ativas}</b><small>com plano vigente${semPlano.length ? ` · ${semPlano.length} sem plano` : ''}</small></div>
            <div class=${'kpi-t' + (m.renovar.length ? ' atencao' : '')}><span>Renovações</span><b>${m.renovar.length}</b><small>vencem nos próximos 15 dias</small></div>
            <div class="kpi-t destaque"><span>Taxa de renovação</span><b>${m.taxaRenovacao == null ? '·' : Math.round(m.taxaRenovacao * 100) + '%'}</b><small>${m.encerradas ? `de ${m.encerradas} plano(s) que acabaram em 90 dias` : 'sem planos encerrados em 90 dias'}</small></div>
          </div>
          <div class="stats">
            <div class="stat"><b>${brl(recebido)}</b><span>recebido em ${mesNome(mesAtual)}</span></div>
            <div class="stat"><b>${brl(m.ltv)}</b><span>LTV médio por aluna</span></div>
            <div class=${'stat' + (m.inadimplencia ? ' neg' : '')}><b>${brl(m.inadimplencia)}</b><span>em atraso (${m.atrasadas.length})</span></div>
            <div class="stat"><b>${brl(m.mrr * 12)}</b><span>receita anual no ritmo atual</span></div>
          </div>
          <div class="paineis dois">
            <section class="card"><h3>Recebido nos últimos 6 meses</h3><${Barras} dados=${seis}/></section>
            <section class="card"><h3>Origem da receita recorrente</h3>
              ${Object.keys(porPlano).length ? html`<ul class="lista">${Object.entries(porPlano).sort((a, b) => b[1] - a[1]).map(([p, v]) => html`<li class="linha"><div><b>${p}</b><small>${Math.round((v / m.mrr) * 100)}% do MRR</small></div><span class="valor">${brl(v)}/mês</span></li>`)}</ul>`
                : html`<p class="suave">Registre os planos das alunas para ver de onde vem a receita.</p>`}</section>
          </div>
          <section class="card"><div class="card-topo"><h3>Monitor de alertas</h3><span class="tag">${m.renovar.length + m.atrasadas.length + semPlano.length}</span></div>
            ${!m.renovar.length && !m.atrasadas.length && !semPlano.length ? html`<p class="suave">Nada precisando de atenção.</p>` : html`<ul class="lista">
              ${m.renovar.map((a) => { const d = diasEntre(hoje(), a.fim); return html`<li class="linha"><div><b>${nome(a.aluna_id)}</b><small>${a.plano_nome} ${d === 0 ? 'vence hoje' : `vence em ${d} dia(s)`}</small></div>
                <button class="btn mini" onClick=${() => setModal({ tipo: 'plano', aluna: alunas.find((x) => x.id === a.aluna_id) })}>Renovar</button></li>`; })}
              ${m.atrasadas.map((l) => html`<li class="linha"><div><b>${l.descricao}</b><small>venceu ${dataBR(l.vencimento)}</small></div>
                <div class="mini-acoes"><span class="valor">${brl(l.valor)}</span><button class="btn-texto" onClick=${() => pagar(l)}>Recebido</button></div></li>`)}
              ${semPlano.map((a) => html`<li class="linha"><div><b>${a.nome}</b><small>ativa sem plano registrado</small></div><button class="btn mini" onClick=${() => setModal({ tipo: 'plano', aluna: a })}>Registrar plano</button></li>`)}
            </ul>`}</section>`;
      } else if (aba === 'lancamentos') {
        const doMes = lanc.filter((l) => l.vencimento.slice(0, 7) === mes);
        const recebido = soma(lanc.filter((l) => l.tipo === 'receita' && l.pago_em && l.pago_em.slice(0, 7) === mes));
        const aReceber = soma(doMes.filter((l) => l.tipo === 'receita' && !l.pago_em));
        const despesas = soma(lanc.filter((l) => l.tipo === 'despesa' && (l.pago_em || l.vencimento).slice(0, 7) === mes));
        corpo = html`
          <div class="mes-nav"><button class="icone" aria-label="Mês anterior" onClick=${() => setMes(somaMeses(mes + '-15', -1).slice(0, 7))}>‹</button><b>${mesNome(mes)}</b><button class="icone" aria-label="Próximo mês" onClick=${() => setMes(somaMeses(mes + '-15', 1).slice(0, 7))}>›</button></div>
          <div class="stats">
            <div class="stat"><b>${brl(recebido)}</b><span>recebido</span></div>
            <div class="stat"><b>${brl(aReceber)}</b><span>a receber no mês</span></div>
            <div class="stat"><b>${brl(despesas)}</b><span>despesas</span></div>
            <div class=${'stat' + (recebido - despesas < 0 ? ' neg' : '')}><b>${brl(recebido - despesas)}</b><span>saldo do mês</span></div>
          </div>
          <section class="card">${doMes.length ? html`<ul class="lista">${doMes.map((l) => html`<li class=${'linha lanc ' + l.tipo}>
              <button class=${'check' + (l.pago_em ? ' on' : '')} aria-label=${l.pago_em ? 'Marcar como não pago' : 'Marcar como pago'} onClick=${() => pagar(l)}>✓</button>
              <div class="lanc-info"><b>${l.descricao}</b><small>${l.categoria || (l.tipo === 'receita' ? 'Receita' : 'Despesa')} · vence ${dataBR(l.vencimento)}${l.pago_em ? ' · pago ' + dataBR(l.pago_em) : ''}</small></div>
              <span class="valor">${l.tipo === 'despesa' ? '−' : ''}${brl(l.valor)}</span>
              <button class="icone" aria-label="Editar" onClick=${() => setModal({ tipo: 'lanc', lanc: l })}>✎</button></li>`)}</ul>`
            : html`<p class="suave">Nenhum lançamento neste mês.</p>`}</section>`;
      } else {
        corpo = html`<div class="titulo-acoes"><p class="suave">Cada plano é um pacote de entregas. Ao registrar o plano da aluna, a agenda do ciclo se monta sozinha.</p>
            <button class="btn" onClick=${() => setModal({ tipo: 'editarPlano', plano: {} })}>+ Novo plano</button></div>
          <div class="planos-grade">${planos.map((p) => { const en = entregasDe(p); const qtd = m.vigentes.filter((a) => a.plano_id === p.id).length;
            return html`<button class=${'card plano-card' + (p.ativo ? '' : ' apagado')} onClick=${() => setModal({ tipo: 'editarPlano', plano: p })}>
              <div class="card-topo"><b>${p.nome}</b><span class="tag">${p.meses} ${p.meses > 1 ? 'meses' : 'mês'}</span></div>
              <span class="plano-valor">${brl(p.valor)}</span><small>${brl(p.valor / p.meses)}/mês · ${qtd} aluna(s) agora</small>
              <ul class="entregas">${textoEntregas(en).map((t) => html`<li>✓ ${t}</li>`)}</ul></button>`; })}</div>`;
      }
      return html`${corpo}
        ${modal && modal.tipo === 'lanc' && html`<${ModalLancamento} lanc=${modal.lanc} alunas=${ativas} onFechar=${() => setModal(null)} onFeito=${feito}/>`}
        ${modal && modal.tipo === 'plano' && html`<${NovaAssinatura} aluna=${modal.aluna} planos=${planos} anterior=${assinaturas.filter((x) => x.aluna_id === modal.aluna.id).sort((x, y) => (x.fim < y.fim ? 1 : -1))[0]} onFechar=${() => setModal(null)} onFeito=${feito}/>`}
        ${modal && modal.tipo === 'editarPlano' && html`<${ModalPlano} plano=${modal.plano} onFechar=${() => setModal(null)} onFeito=${feito}/>`}`;
    }}<//>
  </div>`;
}

function ModalLancamento({ lanc, alunas, onFechar, onFeito }) {
  const [f, setF] = useState(lanc ? { ...lanc, valor: Number(lanc.valor), categoria: lanc.categoria || '', aluna_id: lanc.aluna_id || '', pago: !!lanc.pago_em }
    : { tipo: 'despesa', descricao: '', categoria: '', valor: 0, vencimento: hoje(), aluna_id: '', pago: true });
  const salvar = async (ev) => {
    ev.preventDefault();
    if (!f.descricao.trim() || !f.valor) { toast('Preencha descrição e valor.', 'erro'); return; }
    const linha = { tipo: f.tipo, descricao: f.descricao.trim(), categoria: f.categoria || null, valor: f.valor, vencimento: f.vencimento, aluna_id: f.aluna_id || null, pago_em: f.pago ? (lanc && lanc.pago_em) || hoje() : null };
    try { if (lanc) await api.upd('lancamentos', lanc.id, linha); else await api.ins('lancamentos', linha); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  const apagar = async () => { if (!confirm('Apagar este lançamento?')) return; await api.del('lancamentos', lanc.id); onFeito(); };
  return html`<${Modal} titulo=${lanc ? 'Editar lançamento' : 'Novo lançamento'} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <div class="chips">${[['receita', 'Receita'], ['despesa', 'Despesa']].map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
      <${Campo} rotulo="Descrição"><input class="input" value=${f.descricao} onInput=${(ev) => setF({ ...f, descricao: ev.target.value })}/><//>
      <div class="grade2">
        <${Campo} rotulo="Valor"><${InputMoeda} valor=${f.valor} onValor=${(v) => setF((x) => ({ ...x, valor: v }))}/><//>
        <${Campo} rotulo="Vencimento"><input class="input" type="date" value=${f.vencimento} onInput=${(ev) => setF({ ...f, vencimento: ev.target.value })}/><//>
      </div>
      <${Campo} rotulo="Categoria" dica="Ex.: Consultoria, Marketing, Ferramentas, Presencial"><input class="input" value=${f.categoria} onInput=${(ev) => setF({ ...f, categoria: ev.target.value })}/><//>
      <${Campo} rotulo="Aluna (opcional)"><select class="input" value=${f.aluna_id} onChange=${(ev) => setF({ ...f, aluna_id: ev.target.value })}><option value="">Nenhuma</option>${alunas.map((a) => html`<option value=${a.id} selected=${f.aluna_id === a.id}>${a.nome}</option>`)}</select><//>
      <label class="toggle"><input type="checkbox" checked=${f.pago} onChange=${(ev) => setF({ ...f, pago: ev.target.checked })}/> Já foi pago</label>
      <button class="btn primario grande">Salvar</button>
      ${lanc && html`<button type="button" class="btn-texto perigo" onClick=${apagar}>Apagar</button>`}
    </form><//>`;
}

function Estimativa({ valor, parcelas, taxa, meses }) {
  const x = estimativa(valor, parcelas, taxa);
  return html`<div class="estimativa">
    <div><span>Bruto</span><b>${brl(x.bruto)}</b></div>
    <div><span>Taxa (${String(taxa.pct).replace('.', ',')}% + ${brl(taxa.fixo)}${parcelas > 1 ? ' por parcela' : ''})</span><b class="neg">− ${brl(x.taxa)}</b></div>
    <div class="liq"><span>Líquido</span><b>${brl(x.liquido)}</b></div>
    <small>${parcelas > 1 ? `${parcelas}x de ${brl(x.parcela)}` : 'à vista'}${meses ? ` · equivale a ${brl(x.bruto / meses)}/mês no MRR` : ''}</small>
  </div>`;
}

export function NovaAssinatura({ aluna, planos, anterior, onFechar, onFeito }) {
  const ativos = planos.filter((p) => p.ativo);
  const inicio0 = anterior && anterior.fim >= somaDias(hoje(), -15) ? anterior.fim : hoje();
  const [f, setF] = useState({ plano_id: (ativos[0] || {}).id, inicio: inicio0, valor: ativos[0] ? Number(ativos[0].valor) : 0, parcelas: 1, forma: 'Pix', primeiraPaga: true, taxa: TAXAS.Pix, gerarAgenda: true });
  const plano = planos.find((p) => p.id === f.plano_id) || {};
  const escolhe = (id) => { const p = planos.find((x) => x.id === id); setF({ ...f, plano_id: id, valor: Number(p.valor) }); };
  const fim = plano.meses ? somaMeses(f.inicio, plano.meses) : f.inicio;
  const agenda = plano.id ? agendaDoCiclo(entregasDe(plano), f.inicio, fim, aluna) : [];
  const salvar = async (ev) => {
    ev.preventDefault();
    const valor = f.valor || 0; const parcelas = f.parcelas;
    try {
      const [a] = await api.ins('assinaturas', { aluna_id: aluna.id, plano_id: plano.id, plano_nome: plano.nome, inicio: f.inicio, fim, valor, forma_pagamento: parcelas > 1 ? `${f.forma} ${parcelas}x` : f.forma });
      const vp = Math.round((valor / parcelas) * 100) / 100;
      const linhas = [...Array(parcelas)].map((_, i) => ({ tipo: 'receita', descricao: `${plano.nome} · ${aluna.nome}${parcelas > 1 ? ` (${i + 1}/${parcelas})` : ''}`, categoria: 'Consultoria',
        valor: i === parcelas - 1 ? Math.round((valor - vp * (parcelas - 1)) * 100) / 100 : vp, vencimento: somaMeses(f.inicio, i), pago_em: i === 0 && f.primeiraPaga ? hoje() : null, aluna_id: aluna.id, assinatura_id: a.id }));
      await api.ins('lancamentos', linhas);
      if (f.gerarAgenda && agenda.length) { try { await api.ins('agenda', agenda); } catch (err) { toast('Plano salvo, mas a agenda não foi gerada: ' + err.message, 'erro'); } }
      toast(f.gerarAgenda && agenda.length ? `Plano registrado e ${agenda.length} compromisso(s) na agenda` : 'Plano registrado', 'ok'); onFeito();
    } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${'Plano · ' + aluna.nome} onFechar=${onFechar}>
    <form class="pilha" onSubmit=${salvar}>
      <div class="chips">${ativos.map((p) => html`<button type="button" class=${f.plano_id === p.id ? 'chip on' : 'chip'} onClick=${() => escolhe(p.id)}>${p.nome} · ${p.meses}m</button>`)}</div>
      <div class="grade2">
        <${Campo} rotulo="Início"><input class="input" type="date" value=${f.inicio} onInput=${(ev) => setF({ ...f, inicio: ev.target.value })}/><//>
        <${Campo} rotulo="Valor total"><${InputMoeda} valor=${f.valor} onValor=${(v) => setF((x) => ({ ...x, valor: v }))}/><//>
        <${Campo} rotulo="Parcelas"><select class="input" onChange=${(ev) => setF({ ...f, parcelas: +ev.target.value })}>${[...Array(12)].map((_, i) => html`<option value=${i + 1} selected=${f.parcelas === i + 1}>${i + 1}x</option>`)}</select><//>
        <${Campo} rotulo="Forma"><select class="input" onChange=${(ev) => setF({ ...f, forma: ev.target.value, taxa: TAXAS[ev.target.value] })}>${Object.keys(TAXAS).map((o) => html`<option value=${o} selected=${f.forma === o}>${o}</option>`)}</select><//>
        <${Campo} rotulo="Taxa (%)"><input class="input" inputmode="decimal" value=${String(f.taxa.pct).replace('.', ',')} onInput=${(ev) => setF({ ...f, taxa: { ...f.taxa, pct: Number(ev.target.value.replace(',', '.')) || 0 } })}/><//>
        <${Campo} rotulo="Taxa fixa por parcela"><${InputMoeda} valor=${f.taxa.fixo} onValor=${(v) => setF((x) => ({ ...x, taxa: { ...x.taxa, fixo: v } }))}/><//>
      </div>
      <${Estimativa} valor=${f.valor} parcelas=${f.parcelas} taxa=${f.taxa} meses=${plano.meses}/>
      <p class="suave">Vai de ${dataBR(f.inicio)} até ${plano.meses ? dataBR(fim) : '·'}.${f.parcelas > 1 ? ` Parcelas lançadas mês a mês.` : ''}</p>
      <label class="toggle"><input type="checkbox" checked=${f.primeiraPaga} onChange=${(ev) => setF({ ...f, primeiraPaga: ev.target.checked })}/> ${f.parcelas > 1 ? 'Primeira parcela já foi paga' : 'Já foi pago'}</label>
      ${agenda.length > 0 && html`<label class="toggle"><input type="checkbox" checked=${f.gerarAgenda} onChange=${(ev) => setF({ ...f, gerarAgenda: ev.target.checked })}/>
        Montar a agenda do ciclo: ${agenda.length} compromisso(s) (${[...new Set(agenda.map((x) => x.titulo.split(' · ')[0].toLowerCase()))].join(', ')})</label>`}
      <button class="btn primario grande">Registrar plano</button>
    </form><//>`;
}

function ModalPlano({ plano, onFechar, onFeito }) {
  const novo = !plano.id;
  const [f, setF] = useState({ nome: plano.nome || '', meses: plano.meses || 3, valor: Number(plano.valor || 0), ativo: plano.id ? plano.ativo : true, entregas: entregasDe(plano) });
  const en = f.entregas; const setEn = (k, v) => setF({ ...f, entregas: { ...en, [k]: v } });
  const salvar = async (ev) => {
    ev.preventDefault(); if (!f.nome.trim() || !f.valor) { toast('Preencha nome e valor.', 'erro'); return; }
    const linha = { nome: f.nome.trim(), meses: Number(f.meses) || 1, valor: f.valor, ativo: f.ativo, entregas: f.entregas };
    try { if (novo) await api.ins('planos', linha); else await api.upd('planos', plano.id, linha); onFeito(); } catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${novo ? 'Novo plano' : `Plano ${plano.nome}`} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <div class="grade2">
      <${Campo} rotulo="Nome"><input class="input" value=${f.nome} onInput=${(ev) => setF({ ...f, nome: ev.target.value })}/><//>
      <${Campo} rotulo="Duração"><select class="input" onChange=${(ev) => setF({ ...f, meses: +ev.target.value })}>${[1, 2, 3, 6, 12].map((n) => html`<option value=${n} selected=${Number(f.meses) === n}>${n} ${n > 1 ? 'meses' : 'mês'}</option>`)}</select><//>
      <${Campo} rotulo="Valor total"><${InputMoeda} valor=${f.valor} onValor=${(v) => setF((x) => ({ ...x, valor: v }))}/><//>
      <div class="campo"><span class="rotulo">Por mês</span><p class="valor-mes">${brl(f.valor / (Number(f.meses) || 1))}</p></div>
    </div>
    <div class="campo"><span class="rotulo">Entregas do plano</span><small>O que a aluna recebe. Ao registrar o plano dela, vira compromisso na agenda.</small>
      <label class="toggle"><input type="checkbox" checked=${en.checkin_semanal} onChange=${(ev) => setEn('checkin_semanal', ev.target.checked)}/> Check-in semanal (aparece como camada na agenda)</label>
      <label class="toggle"><input type="checkbox" checked=${en.call_mensal} onChange=${(ev) => setEn('call_mensal', ev.target.checked)}/> Call mensal de metas</label>
      <label class="toggle"><input type="checkbox" checked=${!!en.avaliacao_semanas} onChange=${(ev) => setEn('avaliacao_semanas', ev.target.checked ? 8 : null)}/> Avaliação física a cada
        <input class="input curto" inputmode="numeric" value=${en.avaliacao_semanas || 8} disabled=${!en.avaliacao_semanas} onInput=${(ev) => setEn('avaliacao_semanas', Number(ev.target.value) || null)}/> semanas</label>
      <label class="toggle"><input type="checkbox" checked=${en.relatorio_mensal} onChange=${(ev) => setEn('relatorio_mensal', ev.target.checked)}/> Relatório de evolução no fim de cada mês</label>
      <label class="toggle"><input type="checkbox" checked=${!!en.lembrete_renovacao_dias} onChange=${(ev) => setEn('lembrete_renovacao_dias', ev.target.checked ? 7 : null)}/> Conversa de renovação
        <input class="input curto" inputmode="numeric" value=${en.lembrete_renovacao_dias || 7} disabled=${!en.lembrete_renovacao_dias} onInput=${(ev) => setEn('lembrete_renovacao_dias', Number(ev.target.value) || null)}/> dias antes do fim</label>
    </div>
    <${Estimativa} valor=${f.valor} parcelas=${1} taxa=${TAXAS.Cartão} meses=${Number(f.meses)}/>
    <label class="toggle"><input type="checkbox" checked=${f.ativo} onChange=${(ev) => setF({ ...f, ativo: ev.target.checked })}/> Plano à venda</label>
    <button class="btn primario grande">Salvar plano</button></form><//>`;
}

export function FinanceiroAluna({ aluna }) {
  const e = useCarregar(async () => {
    const [ass, lanc, planos] = await Promise.all([api.q('assinaturas', { eq: { aluna_id: aluna.id }, order: 'inicio', asc: false }), api.q('lancamentos', { eq: { aluna_id: aluna.id }, order: 'vencimento' }), api.q('planos', { order: 'meses' })]);
    return { ass, lanc, planos };
  }, [aluna.id]);
  const [novo, setNovo] = useState(false);
  const pagar = async (l) => { await api.upd('lancamentos', l.id, { pago_em: l.pago_em ? null : hoje() }); e.recarregar(); };
  return html`<${Estado} e=${e}>${({ ass, lanc, planos }) => { const total = lanc.filter((l) => l.pago_em).reduce((t, l) => t + Number(l.valor), 0);
    return html`<div class="pilha">
      <button class="btn primario" onClick=${() => setNovo(true)}>${ass.length ? 'Renovar plano' : '+ Registrar plano'}</button>
      ${ass.length ? ass.map((a) => { const d = diasEntre(hoje(), a.fim); const p = planos.find((x) => x.id === a.plano_id);
        return html`<section class="card"><div class="card-topo"><h3>${a.plano_nome}</h3>
          <span class=${'tag' + (d < 0 ? '' : d <= 10 ? ' atencao' : ' roxo')}>${d < 0 ? 'encerrado' : `${d} dias restantes`}</span></div>
          <p class="suave">${dataBR(a.inicio)} a ${dataBR(a.fim)} · ${brl(a.valor)}${a.forma_pagamento ? ' · ' + a.forma_pagamento : ''}</p>
          ${p && html`<small>Entregas: ${textoEntregas(entregasDe(p)).join(', ')}</small>`}
          <ul class="lista">${lanc.filter((l) => l.assinatura_id === a.id).map((l) => html`<li class="linha lanc">
            <button class=${'check' + (l.pago_em ? ' on' : '')} aria-label="Alternar pago" onClick=${() => pagar(l)}>✓</button>
            <div class="lanc-info"><b>${brl(l.valor)}</b><small>vence ${dataBR(l.vencimento)}${l.pago_em ? ' · pago' : l.vencimento < hoje() ? ' · em atraso' : ''}</small></div></li>`)}</ul>
          <button class="btn-texto perigo" onClick=${async () => { if (confirm('Apagar este plano e as parcelas dele?')) { await api.del('assinaturas', a.id); e.recarregar(); } }}>Apagar plano</button>
        </section>`; }) : html`<${Vazio} titulo="Nenhum plano registrado"/>`}
      ${total > 0 && html`<p class="suave">Total já recebido desta aluna (LTV): ${brl(total)}</p>`}
      ${novo && html`<${NovaAssinatura} aluna=${aluna} planos=${planos} anterior=${ass[0]} onFechar=${() => setNovo(false)} onFeito=${() => { setNovo(false); e.recarregar(); }}/>`}
    </div>`; }}<//>`;
}
