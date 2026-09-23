// Formulário público de inscrição (link da bio). Grava na tabela "leads".
import { html, render, useState, useEffect } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { Campo, Toasts, toast, brl, soDigitos } from './util.js';

const OBJETIVOS = ['Glúteo e pernas', 'Definir o corpo', 'Emagrecer', 'Ganhar massa', 'Força e saúde'];
const EXPERIENCIA = ['Nunca treinei', 'Menos de 6 meses', '6 meses a 1 ano', 'Mais de 1 ano', 'Voltando depois de uma pausa'];
const DIAS = ['2', '3', '4', '5', '6'];
const LOCAL = ['Academia completa', 'Academia de condomínio', 'Em casa'];

function Form() {
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState({ nome: '', whatsapp: '', instagram: '', idade: '', objetivo: '', experiencia: '', dias_semana: '', local_treino: '', plano_interesse: '', mensagem: '', ok: false });
  const [planos, setPlanos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);
  useEffect(() => { api.q('planos', { eq: { ativo: true }, order: 'meses' }).then(setPlanos).catch(() => {}); }, []);
  const muda = (k, v) => setF({ ...f, [k]: v });
  const chips = (k, ops) => html`<div class="chips">${ops.map((o) => html`<button type="button" class=${f[k] === o ? 'chip on' : 'chip'} onClick=${() => muda(k, o)}>${o}</button>`)}</div>`;

  const valida = () => {
    if (passo === 0) {
      if (f.nome.trim().length < 2) return 'Digite o seu nome.';
      if (soDigitos(f.whatsapp).length < 10) return 'Digite o WhatsApp com DDD.';
    }
    if (passo === 1 && (!f.objetivo || !f.experiencia || !f.dias_semana || !f.local_treino)) return 'Escolha uma opção em cada pergunta.';
    if (passo === 2 && !f.ok) return 'Marque a autorização de contato para enviar.';
    return null;
  };
  const avancar = async (ev) => {
    ev.preventDefault();
    const erro = valida(); if (erro) { toast(erro, 'erro'); return; }
    if (passo < 2) { setPasso(passo + 1); window.scrollTo(0, 0); return; }
    setEnviando(true);
    try {
      const { ok, ...dados } = f;
      await api.enviar('leads', { ...dados, nome: dados.nome.trim(), idade: dados.idade ? parseInt(dados.idade, 10) || null : null, instagram: dados.instagram ? '@' + dados.instagram.replace(/^@/, '').trim() : null, status: 'novo' });
      setFeito(true);
    } catch (e) { toast(e.message, 'erro'); } finally { setEnviando(false); }
  };

  if (feito) return html`<div class="form-pagina"><div class="card feito"><div class="selo">✓</div><h2>Recebi a sua inscrição</h2>
    <p class="suave">Vou te chamar no WhatsApp em até 24 horas para entender melhor a sua rotina. Fica de olho!</p></div></div>`;

  return html`<form class="form-pagina" onSubmit=${avancar}>
    ${DEMO && html`<div class="faixa-demo">Modo demonstração · a inscrição fica só neste navegador</div>`}
    <div class="form-cab"><span class="sobre">Consultoria online</span>
      <h1>Vamos montar o <em>seu</em> treino.</h1>
      <p class="suave">Três passos rápidos. Com isso eu já chego na conversa sabendo o que você precisa.</p>
      <div class="passos">${[0, 1, 2].map((i) => html`<span class=${i <= passo ? 'on' : ''}></span>`)}</div></div>
    ${passo === 0 && html`<section class="card pilha"><h3>Sobre você</h3>
      <${Campo} rotulo="Nome"><input class="input" autocomplete="name" value=${f.nome} onInput=${(ev) => muda('nome', ev.target.value)}/><//>
      <${Campo} rotulo="WhatsApp (com DDD)"><input class="input" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" value=${f.whatsapp} onInput=${(ev) => muda('whatsapp', ev.target.value)}/><//>
      <div class="grade2">
        <${Campo} rotulo="Instagram"><input class="input" placeholder="@seuperfil" value=${f.instagram} onInput=${(ev) => muda('instagram', ev.target.value)}/><//>
        <${Campo} rotulo="Idade"><input class="input" inputmode="numeric" value=${f.idade} onInput=${(ev) => muda('idade', ev.target.value)}/><//>
      </div></section>`}
    ${passo === 1 && html`<section class="card pilha"><h3>Seu treino hoje</h3>
      <${Campo} rotulo="Qual o seu principal objetivo?">${chips('objetivo', OBJETIVOS)}<//>
      <${Campo} rotulo="Há quanto tempo você treina?">${chips('experiencia', EXPERIENCIA)}<//>
      <${Campo} rotulo="Quantos dias por semana você consegue treinar?">${chips('dias_semana', DIAS)}<//>
      <${Campo} rotulo="Onde você treina?">${chips('local_treino', LOCAL)}<//>
    </section>`}
    ${passo === 2 && html`<section class="card pilha"><h3>Quase lá</h3>
      <${Campo} rotulo="Tem interesse em algum plano?"><div class="chips">
        ${planos.map((p) => html`<button type="button" class=${f.plano_interesse === p.nome ? 'chip on' : 'chip'} onClick=${() => muda('plano_interesse', p.nome)}>${p.nome} · ${p.meses} ${p.meses > 1 ? 'meses' : 'mês'} · ${brl(p.valor).replace(',00', '')}</button>`)}
        <button type="button" class=${f.plano_interesse === 'Ainda não sei' ? 'chip on' : 'chip'} onClick=${() => muda('plano_interesse', 'Ainda não sei')}>Ainda não sei</button></div><//>
      <${Campo} rotulo="Qual a sua maior dificuldade hoje? (opcional)"><textarea class="input" rows="3" value=${f.mensagem} onInput=${(ev) => muda('mensagem', ev.target.value)}></textarea><//>
      <label class="toggle consentimento"><input type="checkbox" checked=${f.ok} onChange=${(ev) => muda('ok', ev.target.checked)}/> Autorizo o contato pelo WhatsApp sobre a consultoria. Meus dados não serão compartilhados com ninguém.</label>
    </section>`}
    <div class="form-rodape">
      ${passo > 0 && html`<button type="button" class="btn grande" onClick=${() => setPasso(passo - 1)}>Voltar</button>`}
      <button class="btn primario grande" disabled=${enviando}>${passo < 2 ? 'Continuar' : enviando ? 'Enviando...' : 'Enviar inscrição'}</button>
    </div>
  </form><${Toasts}/>`;
}

render(html`<${Form}/>`, document.getElementById('app'));
