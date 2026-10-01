// Página pública com a Política de Privacidade e os Termos de Uso (legal.html#privacidade, legal.html#termos).
import { html, render, useState, useEffect } from '../lib/preact-htm.js';
import { POLITICA, TERMOS, TextoLegal, VERSAO_TERMOS, CONTROLADOR } from './legal.js';
import { dataBR } from './util.js';

const qual = () => (location.hash === '#termos' ? 'termos' : 'privacidade');
function Pagina() {
  const [doc, setDoc] = useState(qual());
  useEffect(() => { const f = () => setDoc(qual()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return html`<main class="conteudo pilha legal-pagina">
    <p class="sobre">NEMESIS · ${CONTROLADOR.nome}</p>
    <div class="abas"><a class=${doc === 'privacidade' ? 'on' : ''} href="#privacidade">Política de Privacidade</a><a class=${doc === 'termos' ? 'on' : ''} href="#termos">Termos de Uso</a></div>
    <h1 class="titulo">${doc === 'termos' ? 'Termos de Uso' : 'Política de Privacidade'}</h1>
    <p class="suave">Versão de ${dataBR(VERSAO_TERMOS)}.</p>
    <${TextoLegal} doc=${doc === 'termos' ? TERMOS : POLITICA}/>
  </main>`;
}
render(html`<${Pagina}/>`, document.getElementById('app'));
