// LGPD: textos legais, consentimento da aluna, privacidade (aluna e treinador) e exclusão de dados.
// Os textos são um RASCUNHO escrito a partir da Lei 13.709/2018 (LGPD) e NÃO foram validados por advogado:
// o responsável pelos dados assume o conteúdo e se compromete a cumpri-lo (docs/decisoes.md, 01/10/2026).
// Mudou um texto de forma relevante? Suba VERSAO_TERMOS: todas as alunas aceitam de novo ao abrir o app.
import { html, useState } from '../lib/preact-htm.js';
import { api, DEMO } from './api.js';
import { useCarregar, Estado, Modal, Campo, toast, dataBR, idadeDe, relativo } from './util.js';

export const VERSAO_TERMOS = '2026-10-01';

// dados do responsável pelos dados (controlador), preenchidos em config.js > LEGAL
const L = (window.NEMESIS_CONFIG || {}).LEGAL || {};
export const CONTROLADOR = {
  nome: L.controlador || '[nome do responsável]', email: L.email || '[e-mail de contato]',
  // opcionais: só entram no texto se estiverem preenchidos (a LGPD pede identificação e contato, art. 9º, III)
  documento: L.documento ? `, ${L.documento}` : '', cref: L.cref ? ` (${L.cref})` : '', cidade: L.cidade ? `, em ${L.cidade}` : '',
};
export const legalPreenchido = () => !!(L.controlador && L.email);

// ============================================================
// TEXTOS (cada documento: [título da seção, [parágrafos]]; parágrafo que começa com "• " vira item de lista)
// ============================================================
const C = CONTROLADOR;
export const POLITICA = [
  ['1. Quem cuida dos seus dados', [
    `O responsável pelos seus dados (controlador, LGPD art. 5º, VI) é ${C.nome}${C.documento}, profissional de educação física${C.cref}${C.cidade}.`,
    `Qualquer assunto sobre os seus dados: ${C.email} ou, no app, em Perfil > Privacidade. Esse é o canal de atendimento ao titular (art. 41).`]],
  ['2. Quais dados o Nemesis guarda', [
    '• Cadastro: nome, e-mail, WhatsApp, data de nascimento, sexo e objetivo.',
    '• Alistamento (anamnese e PAR-Q): rotina, experiência, sono, estresse, alimentação, lesões, cirurgias, condições de saúde, medicamentos e regularidade do ciclo menstrual.',
    '• Oráculo (check-in semanal): peso, sono, energia, estresse, fome, alimentação e dores com o lugar do corpo. Se você ativar, também o registro do ciclo menstrual e o método contraceptivo.',
    '• Treinos: cargas, repetições, repetições de reserva (RIR), esforço, comentários, observações por exercício e trocas de exercício.',
    '• Água: quanto você bebeu em cada dia e a sua meta, se você usar esse controle.',
    '• Avaliação física: peso, altura, medidas, dobras cutâneas, diâmetros ósseos, composição corporal e testes aeróbicos (inclui frequência cardíaca).',
    '• Fotos e vídeos: fotos de avaliação e de evolução e vídeos de execução dos exercícios, só com a sua autorização.',
    '• Metas, formulários respondidos e mensagens trocadas com o treinador.',
    '• Anotações do treinador sobre o seu acompanhamento (lesões, pausas e ajustes de rota).',
    '• Plano e pagamentos: plano contratado, valores, vencimentos e forma de pagamento.',
    '• Inscrição pelo formulário da bio: nome, WhatsApp, Instagram, idade, objetivo e respostas sobre a sua rotina.',
    'Dados de saúde, do ciclo menstrual e fotos do corpo são dados pessoais sensíveis (art. 5º, II) e têm proteção reforçada.']],
  ['3. Para que os dados são usados', [
    '• Montar, acompanhar e ajustar o seu treino.',
    '• Acompanhar evolução, recuperação e sinais de alerta (dor, sono, estresse).',
    '• Gerar os seus relatórios de evolução.',
    '• Falar com você sobre o acompanhamento.',
    '• Cobrança e obrigações fiscais.',
    '• Segurança e funcionamento do app.',
    'Os seus dados não são vendidos, não são usados para publicidade e não são usados para nenhuma outra finalidade sem avisar você antes (art. 6º, I, e art. 8º, §6º).']],
  ['4. Com base em que a lei permite (bases legais)', [
    '• Dados de saúde, do ciclo menstrual, fotos e vídeos: o seu consentimento específico e destacado (art. 11, I), dado na tela de consentimento do app.',
    '• Cadastro, treinos e plano: a execução do contrato de consultoria (art. 7º, V).',
    '• Pagamentos: o cumprimento de obrigação legal e fiscal (art. 7º, II).',
    '• Inscrição pelo formulário da bio: o seu consentimento ao enviar (art. 7º, I).']],
  ['5. Com quem os dados são compartilhados', [
    '• Só o treinador responsável acessa os seus dados. Outras alunas não veem nada seu.',
    '• Fornecedores de tecnologia que fazem o app funcionar, só para prestar esse serviço: Supabase (banco de dados, login e arquivos), Resend (envia os e-mails de cadastro e de troca de senha) e o GitHub Pages (hospeda os arquivos do app e, como qualquer site, recebe o endereço IP de quem acessa; não guarda os seus dados de treino ou saúde). Eles são operadores (art. 5º, VII) e só tratam os dados seguindo as instruções do controlador.',
    '• Alguns desses fornecedores são empresas estrangeiras. Quando houver transferência de dados para fora do Brasil, ela segue as regras do art. 33 da LGPD.',
    '• WhatsApp, quando você ou o treinador escolhem conversar por lá.',
    '• Nutricionista ou outro profissional, só a seu pedido ou com a sua autorização.',
    '• Autoridades, quando a lei obrigar.']],
  ['6. Por quanto tempo', [
    '• Enquanto você for aluna, os dados ficam guardados para o acompanhamento.',
    '• Depois que o seu último plano acabar, os dados de treino, saúde, fotos e vídeos ficam guardados por até 12 meses (para o caso de você voltar) e então são eliminados (art. 15 e 16).',
    '• Inscrições que não viraram matrícula são apagadas em até 6 meses. A inscrição de quem virou aluna é apagada junto com os dados dela.',
    '• Registros de pagamento (valores e datas) ficam pelo prazo da legislação tributária (5 anos), sem o seu nome e sem nenhum dado de saúde (art. 16, I).',
    '• Você pode pedir a exclusão antes disso, a qualquer momento.']],
  ['7. Seus direitos', [
    'A LGPD (art. 18) garante que você pode:',
    '• confirmar se tratamos dados seus e acessar esses dados;',
    '• corrigir dados incompletos, errados ou desatualizados;',
    '• pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desacordo com a lei;',
    '• receber os seus dados em formato aberto (portabilidade);',
    '• pedir a eliminação dos dados tratados com o seu consentimento;',
    '• saber com quem os seus dados são compartilhados;',
    '• saber o que acontece se você não der o consentimento;',
    '• revogar o consentimento a qualquer momento (art. 8º, §5º).',
    'Como pedir: no app, em Perfil > Privacidade, ou pelo e-mail acima. A resposta completa vem em até 15 dias (art. 19, II).',
    'Em Perfil > Privacidade você também baixa um arquivo com os seus registros (treinos, check-ins, avaliações, formulários e autorizações), com a lista das suas fotos e vídeos. Os arquivos de foto e vídeo ficam em Perfil > Fotos e arquivos. A cópia completa, com as anotações do treinador, você pede por lá.',
    'Sem o consentimento de saúde não é possível fazer o acompanhamento pelo app, porque o treino depende desses dados (art. 9º, §3º). Sem o consentimento de imagem o app continua funcionando, só sem fotos e vídeos.',
    'Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).']],
  ['8. Menores de 18 anos', [
    'Alunas com menos de 18 anos só usam o app com o consentimento específico e em destaque da mãe, do pai ou do responsável legal, registrado no app com o nome e o contato de quem autorizou. A regra segue o art. 14 da LGPD (melhor interesse de crianças e adolescentes, e consentimento de um dos pais para crianças, §1º) e o Código Civil (arts. 3º e 4º: menores de 18 anos são representados ou assistidos pelos pais). Os dados são usados só para o acompanhamento, no melhor interesse da aluna.']],
  ['9. Segurança', [
    'Conexão criptografada; regras de acesso no próprio banco de dados (cada aluna só acessa o que é dela); arquivos privados, abertos só por link temporário de 1 hora; a senha fica com o serviço de login e o treinador não tem acesso a ela (art. 46).',
    'Se acontecer um incidente de segurança que possa trazer risco ou dano relevante a você, a ANPD e você serão avisadas (art. 48).']],
  ['10. O que fica guardado no seu aparelho', [
    'O app guarda no seu celular uma cópia dos próprios arquivos e algumas preferências, para abrir rápido e funcionar sem internet. Não há cookies de publicidade nem rastreamento.']],
  ['11. Mudanças nesta política', [
    `Versão de ${dataBR(VERSAO_TERMOS)}. Se algo importante mudar, o app pede o seu aceite de novo antes de continuar.`]],
];

export const TERMOS = [
  ['1. O que é o Nemesis', [
    `O Nemesis é o app da consultoria de treino online de ${C.nome}, profissional de educação física${C.cref}. Pelo app você recebe a sua ficha de treino, registra treinos, check-ins e avaliações e acompanha a sua evolução.`]],
  ['2. Sua conta', [
    '• A conta é pessoal: não compartilhe a senha.',
    '• Use dados verdadeiros: o treino é montado a partir deles.',
    '• Conta criada sem convite fica aguardando a aprovação do treinador.']],
  ['3. Saúde e responsabilidade', [
    '• Exercício físico tem riscos. Responda o PAR-Q com sinceridade. Se alguma resposta for "sim", procure um médico antes de começar ou de continuar.',
    '• Pare o treino e procure atendimento se sentir dor no peito, falta de ar fora do normal, tontura, desmaio ou dor forte.',
    '• A consultoria não substitui atendimento médico, fisioterapêutico ou nutricional.',
    '• Percentual de gordura, força máxima estimada, VO2máx e outros números do app são estimativas feitas por equações científicas e têm margem de erro.',
    '• Avise o treinador sobre dor, lesão, gravidez, mudança de medicamento ou de condição de saúde.',
    '• Faça os exercícios como foi orientado e com cargas que você controla.']],
  ['4. Plano e pagamento', [
    'O plano, o valor, a forma de pagamento e as regras de cancelamento são os combinados na contratação. Com pagamento em atraso, o acesso pode ser pausado até a regularização.']],
  ['5. Conteúdo', [
    'Fichas, métodos, textos e materiais do app são do treinador e são para o seu uso pessoal. Não compartilhe nem revenda.']],
  ['6. Uso correto', [
    'Não tente acessar dados de outras pessoas nem atrapalhar o funcionamento do app.']],
  ['7. Fim do acesso', [
    'O acesso termina com o fim do plano ou se estes termos forem descumpridos. Os seus dados seguem a Política de Privacidade, inclusive os prazos de guarda e de eliminação.']],
  ['8. Lei aplicável', [
    'Valem as leis brasileiras, inclusive o Código de Defesa do Consumidor e a LGPD. O foro é o do seu domicílio.']],
  ['9. Contato', [
    `${C.nome} · ${C.email}`]],
];

export const TEXTO_SAUDE = 'Autorizo o tratamento dos meus dados de saúde: respostas do Alistamento e do PAR-Q, dores, sono, estresse, peso, medidas, dobras e composição corporal, testes físicos e, se eu ativar, o ciclo menstrual e o método contraceptivo. Eles serão usados só para montar, acompanhar e ajustar o meu treino e para identificar sinais de alerta à minha saúde. Sei que posso revogar quando quiser, em Perfil > Privacidade, e que sem esta autorização o acompanhamento pelo app não é possível.';
export const TEXTO_IMAGEM = 'Autorizo o envio e a guarda de fotos do meu corpo (avaliação e evolução) e de vídeos de execução dos exercícios, vistos só pelo treinador, para avaliar a minha evolução e corrigir a técnica. Nada disso será publicado nem usado em divulgação sem uma autorização separada e por escrito.';

// ============================================================
// COMPONENTES
// ============================================================
export function TextoLegal({ doc }) {
  return html`<div class="texto-legal">${doc.map(([t, ps]) => html`<section><h3>${t}</h3>${agrupar(ps).map((b) => (Array.isArray(b)
    ? html`<ul>${b.map((i) => html`<li>${i}</li>`)}</ul>` : html`<p>${b}</p>`))}</section>`)}</div>`;
}
// junta os itens "• " seguidos numa lista
function agrupar(ps) {
  const out = [];
  ps.forEach((p) => { if (p.startsWith('• ')) { const ult = out[out.length - 1]; if (Array.isArray(ult)) ult.push(p.slice(2)); else out.push([p.slice(2)]); } else out.push(p); });
  return out;
}

// último consentimento da aluna: o registro, false (nenhum) ou null (o banco ainda não tem a atualização 12).
// Qualquer outro erro (rede, sessão vencida) sobe: a trava não pode abrir o app por falha.
const SEM_TABELA = /precisa das atualizações|does not exist|schema cache|Could not find the table/i;
export const consentimentoAtual = (alunaId) => api.q('consentimentos', { eq: { aluna_id: alunaId }, order: 'criado_em', asc: false, limit: 1 })
  .then((l) => l[0] || false).catch((err) => { if (SEM_TABELA.test(err.message || '')) return null; throw err; });
// precisa da tela de consentimento: sem aceite, versão antiga ou saúde revogada.
// Enquanto o responsável pelos dados não preencher config.js > LEGAL, a trava fica desligada (ninguém aceita texto incompleto).
export const precisaConsentir = (c) => (DEMO || legalPreenchido()) && (c === false || !!(c && (c.versao !== VERSAO_TERMOS || !c.termos || !c.saude)));
// pode enviar foto ou vídeo desta aluna? (sem a atualização 12 no banco, segue como antes)
export async function podeImagem(alunaId) { const c = await consentimentoAtual(alunaId); return c === null || !!(c && c.imagem); }

const novoConsentimento = (aluna, base, muda) => api.ins('consentimentos', {
  aluna_id: aluna.id, versao: VERSAO_TERMOS, termos: base.termos, saude: base.saude, imagem: base.imagem, menor: base.menor,
  responsavel_nome: base.menor ? base.responsavel_nome : null, responsavel_parentesco: base.menor ? base.responsavel_parentesco : null,
  responsavel_contato: base.menor ? base.responsavel_contato : null, criado_em: new Date().toISOString(), ...muda }); // o banco troca pela hora do servidor

// tela que a aluna vê antes de usar o app (primeiro acesso, versão nova dos textos ou saúde revogada)
export function TelaConsentimento({ perfil, atual, onFeito }) {
  const idade = idadeDe(perfil.nascimento);
  const menorPeloCadastro = idade != null && idade < 18;
  const [f, setF] = useState({ termos: false, saude: false, imagem: atual ? !!atual.imagem : false, maior: menorPeloCadastro ? 'nao' : atual && atual.menor ? 'nao' : '',
    responsavel_nome: (atual && atual.responsavel_nome) || '', responsavel_parentesco: (atual && atual.responsavel_parentesco) || '', responsavel_contato: (atual && atual.responsavel_contato) || '', declaro: false });
  const [ler, setLer] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [verDados, setVerDados] = useState(false);
  const revogou = !!(atual && atual.termos && !atual.saude);
  const menor = f.maior === 'nao';
  const pronto = f.termos && f.saude && f.maior && (!menor || (f.responsavel_nome.trim().length >= 3 && f.responsavel_contato.trim().length >= 5 && f.responsavel_parentesco && f.declaro));
  const confirmar = async () => {
    if (!pronto) { toast('Marque os itens obrigatórios para continuar.', 'erro'); return; }
    setSalvando(true);
    try {
      await api.ins('consentimentos', { aluna_id: perfil.id, versao: VERSAO_TERMOS, termos: true, saude: true, imagem: f.imagem, menor,
        responsavel_nome: menor ? f.responsavel_nome.trim() : null, responsavel_parentesco: menor ? f.responsavel_parentesco : null, responsavel_contato: menor ? f.responsavel_contato.trim() : null, criado_em: new Date().toISOString() });
      onFeito();
    } catch (err) { toast(err.message, 'erro'); setSalvando(false); }
  };
  const chk = (k, texto) => html`<label class="toggle consentir"><input type="checkbox" checked=${f[k]} onChange=${(ev) => setF({ ...f, [k]: ev.target.checked })}/><span>${texto}</span></label>`;
  return html`<div class="tela"><header class="topo"><span class="marca">NEMESIS</span></header><main class="conteudo pilha consentimento-tela">
    <div class="boas-vindas"><p class="sobre">Seus dados, suas regras</p><h1>Antes de começar</h1>
      <p class="suave">${atual && atual.versao !== VERSAO_TERMOS ? `Os termos foram atualizados em ${dataBR(VERSAO_TERMOS)}. ` : ''}O Nemesis guarda dados de saúde para montar o seu treino. Pela Lei Geral de Proteção de Dados, você precisa autorizar isso de forma clara. Leva um minuto.</p></div>

    ${revogou && html`<section class="card pilha">
      <p class="nota">Você revogou a autorização dos dados de saúde em ${dataBR(atual.criado_em)}. Enquanto não autorizar de novo, o acompanhamento pelo app fica parado. Seus dados continuam seus: você pode baixar tudo ou pedir a exclusão da conta.</p>
      <button class="btn" onClick=${() => setVerDados(!verDados)}>${verDados ? 'Fechar' : 'Baixar meus dados ou fazer um pedido'}</button>
      ${verDados && html`<${PrivacidadeAluna} perfil=${perfil} onMudou=${onFeito}/>`}
    </section>`}

    <section class="card pilha">
      <div class="acoes"><button class="btn" onClick=${() => setLer('politica')}>Ler a Política de Privacidade</button><button class="btn" onClick=${() => setLer('termos')}>Ler os Termos de Uso</button></div>
      ${chk('termos', 'Li e aceito os Termos de Uso e a Política de Privacidade.')}
    </section>

    <section class="card pilha destaque-legal">
      <h3>Dados de saúde <span class="tag atencao">obrigatório</span></h3>
      <p class="suave">${TEXTO_SAUDE}</p>
      ${chk('saude', 'Autorizo o tratamento dos meus dados de saúde para o meu acompanhamento.')}
    </section>

    <section class="card pilha">
      <h3>Fotos e vídeos <span class="tag">opcional</span></h3>
      <p class="suave">${TEXTO_IMAGEM}</p>
      ${chk('imagem', 'Autorizo fotos de avaliação e vídeos de execução.')}
      <small>Sem esta autorização o app funciona normalmente, só sem fotos e vídeos. Dá para mudar depois em Perfil > Privacidade.</small>
    </section>

    <section class="card pilha">
      <h3>Idade</h3>
      ${menorPeloCadastro ? html`<p class="suave">Pela data de nascimento do seu cadastro, você tem menos de 18 anos.</p>`
        : html`<${Campo} rotulo="Você tem 18 anos ou mais?"><div class="chips">${[['sim', 'Sim'], ['nao', 'Não']].map(([k, r]) => html`<button type="button" class=${f.maior === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, maior: k })}>${r}</button>`)}</div><//>`}
      ${menor && html`<div class="pilha">
        <p class="nota">Menores de 18 anos precisam da autorização da mãe, do pai ou do responsável legal (LGPD art. 14 e Código Civil). Peça para ele ou ela preencher esta parte com você.</p>
        <${Campo} rotulo="Nome completo do responsável"><input class="input" autocomplete="off" value=${f.responsavel_nome} onInput=${(ev) => setF({ ...f, responsavel_nome: ev.target.value })}/><//>
        <${Campo} rotulo="Você é"><div class="chips">${['Mãe', 'Pai', 'Responsável legal'].map((r) => html`<button type="button" class=${f.responsavel_parentesco === r ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, responsavel_parentesco: r })}>${r}</button>`)}</div><//>
        <${Campo} rotulo="WhatsApp ou e-mail do responsável"><input class="input" value=${f.responsavel_contato} onInput=${(ev) => setF({ ...f, responsavel_contato: ev.target.value })}/><//>
        ${chk('declaro', `Sou ${f.responsavel_parentesco ? f.responsavel_parentesco.toLowerCase() : 'responsável'} de ${perfil.nome || 'a aluna'} e dou as autorizações marcadas acima em nome dela.`)}
      </div>`}
    </section>

    <button class="btn primario grande" disabled=${!pronto || salvando} onClick=${confirmar}>${salvando ? 'Salvando…' : 'Concordo e quero continuar'}</button>
    <button class="btn-texto" onClick=${() => api.sair()}>Agora não (sair)</button>
    ${ler && html`<${Modal} titulo=${ler === 'politica' ? 'Política de Privacidade' : 'Termos de Uso'} onFechar=${() => setLer(null)} largo=${true}><${TextoLegal} doc=${ler === 'politica' ? POLITICA : TERMOS}/><//>`}
  </main></div>`;
}

// ---------- exportar os dados de uma aluna (portabilidade e acesso, art. 18, II e V) ----------
const TABELAS_ALUNA = ['consentimentos', 'solicitacoes_privacidade', 'anamneses', 'avaliacoes', 'checkins', 'sessoes', 'series', 'metas', 'testes_aerobicos',
  'cardio_prescricoes', 'cardio_registros', 'dor_relatos', 'ciclo_registros', 'envios', 'arquivos_aluna', 'videos_execucao', 'assinaturas', 'treinos',
  'treino_itens', 'mesociclos', 'relatorio_notas', 'agua_registros'];
const TABELAS_TREINADOR = ['dossie', 'lancamentos', 'alertas_coach', 'agenda'];
export async function exportarDados(aluna, completo) {
  const pega = (t, o) => api.q(t, o).catch(() => []);
  const saida = { gerado_em: new Date().toISOString(), versao_termos: VERSAO_TERMOS, perfil: await api.um('profiles', { id: aluna.id }).catch(() => aluna) };
  const todos = (t, o) => api.todos(t, o).catch(() => []);
  for (const t of [...TABELAS_ALUNA, ...(completo ? TABELAS_TREINADOR : [])]) saida[t] = await todos(t, { eq: { aluna_id: aluna.id } });
  saida.respostas = [];
  for (const e of saida.envios || []) saida.respostas.push(...(await pega('respostas', { eq: { envio_id: e.id } })));
  if (completo) { saida.dossie_versoes = []; for (const n of saida.dossie || []) saida.dossie_versoes.push(...(await pega('dossie_versoes', { eq: { nota_id: n.id } }))); }
  const nome = `nemesis-dados-${(aluna.nome || 'aluna').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(saida, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nome;
}

export const TIPOS_PEDIDO = [['acesso', 'Cópia completa dos meus dados'], ['correcao', 'Corrigir dados'], ['exclusao', 'Excluir minha conta e meus dados'], ['outro', 'Outro assunto']];
const nomePedido = (k) => (TIPOS_PEDIDO.find(([x]) => x === k) || [null, k === 'revogacao' ? 'Revogação de consentimento' : k === 'portabilidade' ? 'Portabilidade' : k])[1];
const STATUS_PEDIDO = { aberta: ['atencao', 'em aberto'], atendida: ['ok', 'atendido'], recusada: ['', 'recusado'] };

// apaga as fotos e vídeos que a própria aluna enviou (arquivo no Storage primeiro, depois o registro)
async function apagarMinhasImagens(perfil) {
  const [arqs, vids] = await Promise.all([api.q('arquivos_aluna', { eq: { aluna_id: perfil.id } }), api.q('videos_execucao', { eq: { aluna_id: perfil.id } }).catch(() => [])]);
  const minhas = arqs.filter((x) => x.enviado_por === perfil.id && (x.categoria === 'foto' || /^(image|video)\//.test(x.tipo || '')));
  for (const x of minhas) { await api.apagarArquivo(x.caminho); await api.del('arquivos_aluna', x.id); }
  for (const x of vids) { await api.apagarArquivo(x.caminho); await api.del('videos_execucao', x.id); }
  return minhas.length + vids.length;
}

// ---------- aba Privacidade da aluna ----------
export function PrivacidadeAluna({ perfil, onMudou }) {
  const e = useCarregar(async () => {
    const [cons, pedidos] = await Promise.all([api.q('consentimentos', { eq: { aluna_id: perfil.id }, order: 'criado_em', asc: false }).catch(() => []),
      api.q('solicitacoes_privacidade', { eq: { aluna_id: perfil.id }, order: 'criada_em', asc: false }).catch(() => [])]);
    return { cons, pedidos };
  }, [perfil.id]);
  const [pedido, setPedido] = useState(null);
  const [ler, setLer] = useState(null);
  const [baixando, setBaixando] = useState(false);
  const baixar = async () => { setBaixando(true); try { const n = await exportarDados(perfil, false); toast(`Arquivo ${n} baixado`, 'ok'); } catch (err) { toast(err.message, 'erro'); } finally { setBaixando(false); } };
  return html`<${Estado} e=${e}>${({ cons, pedidos }) => { const atual = cons[0];
    const mudar = async (muda, aviso) => {
      try {
        await novoConsentimento(perfil, atual, muda);
        if (muda.saude === false) await api.ins('solicitacoes_privacidade', { aluna_id: perfil.id, tipo: 'revogacao', detalhe: 'Revogou o consentimento de dados de saúde pelo app.' }).catch(() => {});
        if (muda.imagem === false) {
          await api.ins('solicitacoes_privacidade', { aluna_id: perfil.id, tipo: 'revogacao', detalhe: 'Retirou a autorização de fotos e vídeos pelo app. Apagar as fotos e vídeos dela que o treinador guardou.' }).catch(() => {});
          if (confirm('Quer apagar agora as fotos e os vídeos que você mesma enviou? As fotos enviadas pelo treinador ele apaga a partir do seu pedido.')) {
            const n = await apagarMinhasImagens(perfil);
            toast(`${n} foto(s) e vídeo(s) apagados`, 'ok');
          }
        }
        toast(aviso, 'ok'); e.recarregar(); onMudou && onMudou();
      } catch (err) { toast(err.message, 'erro'); }
    };
    return html`<div class="pilha">
      <section class="card pilha"><div class="card-topo"><h3>O que você autorizou</h3>${atual && html`<small>em ${dataBR(atual.criado_em)} · versão ${dataBR(atual.versao)}</small>`}</div>
        ${atual ? html`<ul class="lista">
          <li class="linha"><div><b>Termos de Uso e Política de Privacidade</b></div><span class=${'tag ' + (atual.termos ? 'ok' : '')}>${atual.termos ? 'aceitos' : 'não aceitos'}</span></li>
          <li class="linha"><div><b>Dados de saúde</b><small>Necessário para o acompanhamento</small></div><span class=${'tag ' + (atual.saude ? 'ok' : 'perigo')}>${atual.saude ? 'autorizado' : 'revogado'}</span></li>
          <li class="linha"><div><b>Fotos e vídeos</b><small>Opcional</small></div>
            <div class="mini-acoes"><span class=${'tag ' + (atual.imagem ? 'ok' : '')}>${atual.imagem ? 'autorizado' : 'não autorizado'}</span>
              <button class="btn-texto" onClick=${() => mudar({ imagem: !atual.imagem }, atual.imagem ? 'Autorização de fotos e vídeos retirada' : 'Fotos e vídeos autorizados')}>${atual.imagem ? 'Retirar' : 'Autorizar'}</button></div></li>
          ${atual.menor && html`<li class="linha"><div><b>Autorizado por</b><small>${atual.responsavel_nome} (${(atual.responsavel_parentesco || '').toLowerCase()}) · ${atual.responsavel_contato}</small></div></li>`}
        </ul>` : html`<p class="suave">Nenhuma autorização registrada.</p>`}
        ${atual && atual.saude && html`<button class="btn-texto perigo" onClick=${() => { if (confirm('Revogar a autorização dos dados de saúde? Sem ela não é possível continuar o acompanhamento pelo app até você autorizar de novo. O treinador será avisado.')) mudar({ saude: false }, 'Autorização de saúde revogada'); }}>Revogar autorização de dados de saúde</button>`}
      </section>

      <section class="card pilha"><h3>Seus dados</h3>
        <p class="suave">Baixe um arquivo com tudo o que você registrou no app (treinos, check-ins, avaliações, formulários e autorizações).</p>
        <div class="acoes"><button class="btn" disabled=${baixando} onClick=${baixar}>${baixando ? 'Gerando…' : 'Baixar meus dados'}</button>
          <button class="btn" onClick=${() => setPedido({ tipo: 'acesso', detalhe: '' })}>Fazer um pedido</button></div>
        <small>Pedidos são respondidos em até 15 dias. A cópia completa, com as anotações do treinador, você pede por aqui.</small>
      </section>

      ${pedidos.length > 0 && html`<section class="card pilha"><h3>Seus pedidos</h3><ul class="lista">${pedidos.map((p) => html`<li class="linha">
        <div><b>${nomePedido(p.tipo)}</b><small>${dataBR(p.criada_em)}${p.resposta ? ' · ' + p.resposta : ''}</small></div>
        <span class=${'tag ' + (STATUS_PEDIDO[p.status] || STATUS_PEDIDO.aberta)[0]}>${(STATUS_PEDIDO[p.status] || STATUS_PEDIDO.aberta)[1]}</span></li>`)}</ul></section>`}

      <div class="acoes"><button class="btn-texto" onClick=${() => setLer('politica')}>Política de Privacidade</button><button class="btn-texto" onClick=${() => setLer('termos')}>Termos de Uso</button></div>
      ${ler && html`<${Modal} titulo=${ler === 'politica' ? 'Política de Privacidade' : 'Termos de Uso'} onFechar=${() => setLer(null)} largo=${true}><${TextoLegal} doc=${ler === 'politica' ? POLITICA : TERMOS}/><//>`}
      ${pedido && html`<${ModalPedido} perfil=${perfil} inicial=${pedido} onFechar=${() => setPedido(null)} onFeito=${() => { setPedido(null); e.recarregar(); }}/>`}
    </div>`; }}<//>`;
}

function ModalPedido({ perfil, inicial, onFechar, onFeito }) {
  const [f, setF] = useState(inicial);
  const enviar = async (ev) => {
    ev.preventDefault();
    if (f.tipo === 'exclusao' && !confirm('Pedir a exclusão da sua conta e de todos os seus dados? Depois de feita, não dá para desfazer.')) return;
    try { await api.ins('solicitacoes_privacidade', { aluna_id: perfil.id, tipo: f.tipo, detalhe: f.detalhe.trim() || null }); toast('Pedido enviado ao treinador', 'ok'); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo="Pedido sobre os seus dados" onFechar=${onFechar}><form class="pilha" onSubmit=${enviar}>
    <div class="chips">${TIPOS_PEDIDO.map(([k, r]) => html`<button type="button" class=${f.tipo === k ? 'chip on' : 'chip'} onClick=${() => setF({ ...f, tipo: k })}>${r}</button>`)}</div>
    ${f.tipo === 'exclusao' && html`<p class="nota">Tudo é apagado: treinos, check-ins, avaliações, fotos, vídeos e anotações. Ficam só os valores e as datas dos pagamentos, pelo prazo da lei, sem o seu nome e sem dados de saúde.</p>`}
    <${Campo} rotulo=${f.tipo === 'correcao' ? 'O que precisa ser corrigido?' : 'Quer explicar algo? (opcional)'}><textarea class="input" rows="3" maxlength="2000" value=${f.detalhe} onInput=${(ev) => setF({ ...f, detalhe: ev.target.value })}></textarea><//>
    <button class="btn primario grande">Enviar pedido</button>
  </form><//>`;
}

// ---------- privacidade da aluna na visão do treinador (aba Dados) ----------
export function PrivacidadeCoach({ aluna, ir }) {
  const e = useCarregar(async () => {
    const [cons, pedidos] = await Promise.all([api.q('consentimentos', { eq: { aluna_id: aluna.id }, order: 'criado_em', asc: false }).catch(() => null),
      api.q('solicitacoes_privacidade', { eq: { aluna_id: aluna.id }, order: 'criada_em', asc: false }).catch(() => [])]);
    return { cons, pedidos };
  }, [aluna.id]);
  const [excluir, setExcluir] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [responder, setResponder] = useState(null);
  const baixar = async () => { setBaixando(true); try { await exportarDados(aluna, true); } catch (err) { toast(err.message, 'erro'); } finally { setBaixando(false); } };
  return html`<section class="card pilha"><div class="card-topo"><h3>Privacidade (LGPD)</h3></div>
    <${Estado} e=${e}>${({ cons, pedidos }) => { const atual = cons && cons[0];
      return html`
        ${cons === null ? html`<p class="nota">Rode a atualização 12 do banco para registrar os consentimentos.</p>`
          : atual ? html`<p class="suave">Aceite em ${dataBR(atual.criado_em)} (versão ${dataBR(atual.versao)}): saúde <b>${atual.saude ? 'autorizada' : 'revogada'}</b> · fotos e vídeos <b>${atual.imagem ? 'autorizados' : 'não autorizados'}</b>${atual.menor ? html` · menor de idade, autorizado por <b>${atual.responsavel_nome}</b> (${(atual.responsavel_parentesco || '').toLowerCase()}, ${atual.responsavel_contato})` : ''}.</p>
            ${!atual.saude && html`<p class="nota atencao">A aluna revogou o consentimento de saúde: o app fica bloqueado para ela até autorizar de novo. Não use os dados de saúde dela enquanto isso.</p>`}`
          : html`<p class="suave">Ainda não aceitou os termos: o aceite aparece na próxima vez que ela abrir o app.</p>`}
        ${pedidos.length > 0 && html`<ul class="lista">${pedidos.map((p) => html`<li class="linha"><div><b>${nomePedido(p.tipo)}</b><small>${dataBR(p.criada_em)} · ${relativo(p.criada_em)}${p.detalhe ? ' · "' + p.detalhe + '"' : ''}${p.resposta ? ' · resposta: ' + p.resposta : ''}</small></div>
          ${p.status === 'aberta' ? html`<div class="mini-acoes"><button class="btn mini" onClick=${() => setResponder({ p, status: 'atendida' })}>Atendido</button><button class="btn-texto" onClick=${() => setResponder({ p, status: 'recusada' })}>Recusar</button></div>`
            : html`<span class=${'tag ' + (STATUS_PEDIDO[p.status] || STATUS_PEDIDO.aberta)[0]}>${(STATUS_PEDIDO[p.status] || STATUS_PEDIDO.aberta)[1]}</span>`}</li>`)}</ul>`}
        <div class="acoes"><button class="btn" disabled=${baixando} onClick=${baixar}>${baixando ? 'Gerando…' : 'Baixar cópia completa dos dados'}</button>
          ${cons !== null && html`<button class="btn-texto perigo" onClick=${() => setExcluir(true)}>Excluir todos os dados da aluna</button>`}</div>
        <small>Pedido de acesso: baixe a cópia completa (inclui o Dossiê) e envie para a aluna. Prazo da lei: 15 dias.</small>`; }}<//>
    ${excluir && html`<${ModalExcluir} aluna=${aluna} onFechar=${() => setExcluir(false)} onFeito=${() => { setExcluir(false); ir('alunas'); }}/>`}
    ${responder && html`<${ModalResposta} p=${responder.p} status=${responder.status} onFechar=${() => setResponder(null)} onFeito=${() => { setResponder(null); e.recarregar(); }}/>`}
  </section>`;
}

function ModalResposta({ p, status, onFechar, onFeito }) {
  const [txt, setTxt] = useState('');
  const salvar = async (ev) => {
    ev.preventDefault();
    try { await api.upd('solicitacoes_privacidade', p.id, { status, resposta: txt.trim() || null, atendida_em: new Date().toISOString() }); onFeito(); }
    catch (err) { toast(err.message, 'erro'); }
  };
  return html`<${Modal} titulo=${status === 'atendida' ? 'Marcar como atendido' : 'Recusar pedido'} onFechar=${onFechar}><form class="pilha" onSubmit=${salvar}>
    <p class="suave">${nomePedido(p.tipo)} · pedido de ${dataBR(p.criada_em)}${p.detalhe ? ` · "${p.detalhe}"` : ''}</p>
    <${Campo} rotulo=${status === 'atendida' ? 'O que foi feito (a aluna vê)' : 'Motivo da recusa (a aluna vê)'}><textarea class="input" rows="3" maxlength="2000" value=${txt} onInput=${(ev) => setTxt(ev.target.value)}></textarea><//>
    <button class="btn primario grande">${status === 'atendida' ? 'Marcar como atendido' : 'Recusar'}</button>
  </form><//>`;
}

export function ModalExcluir({ aluna, motivo = 'pedido', onFechar, onFeito }) {
  const [texto, setTexto] = useState('');
  const [indo, setIndo] = useState(false);
  const primeiro = (aluna.nome || '').split(' ')[0] || 'EXCLUIR';
  const excluir = async () => {
    setIndo(true);
    try {
      // anota os arquivos antes; o banco exclui primeiro; só então o Storage (se o banco falhar, nada some)
      const [arqs, vids] = await Promise.all([api.q('arquivos_aluna', { eq: { aluna_id: aluna.id } }).catch(() => []), api.q('videos_execucao', { eq: { aluna_id: aluna.id } }).catch(() => [])]);
      const r = await api.rpc('eliminar_aluna', { p_aluna: aluna.id, p_motivo: motivo });
      const pasta = await api.listarArquivos(aluna.id).catch(() => []);
      for (const c of new Set([...arqs, ...vids].map((x) => x.caminho).concat(pasta))) await api.apagarArquivo(c).catch(() => {});
      toast(r && r.conta_autenticacao_apagada === false ? 'Dados excluídos. Apague também o login dela em Supabase > Authentication > Users.' : 'Dados da aluna excluídos', 'ok');
      onFeito();
    } catch (err) { toast(err.message, 'erro'); setIndo(false); }
  };
  return html`<${Modal} titulo=${'Excluir os dados de ' + (aluna.nome || 'aluna')} onFechar=${onFechar}><div class="pilha">
    <p class="nota atencao">Apaga de vez o perfil, o login, treinos, check-ins, avaliações, Oráculo, dores, ciclo, metas, fotos, vídeos, consentimentos, o Dossiê, o convite e a inscrição da bio. Os lançamentos financeiros ficam só com valores e datas, sem o vínculo e sem o nome dela, pelo prazo da lei. Não dá para desfazer.</p>
    <p class="suave">Antes, se a aluna pediu acesso, baixe a cópia completa dos dados.</p>
    <${Campo} rotulo=${`Para confirmar, digite ${primeiro}`}><input class="input" value=${texto} onInput=${(ev) => setTexto(ev.target.value)}/><//>
    <button class="btn grande perigo" disabled=${texto.trim().toLowerCase() !== primeiro.toLowerCase() || indo} onClick=${excluir}>${indo ? 'Excluindo…' : 'Excluir tudo'}</button>
  </div><//>`;
}
