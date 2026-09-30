# Arquitetura

## Visão geral
```
celular / navegador
  index.html ── config.js (URL + chave anon do Supabase)
     │          lib/supabase.js (cliente oficial, local)
     └─ js/app.js (módulo ES) ── Preact + htm (lib/preact-htm.js)
          ├─ js/coach.js   telas do treinador
          ├─ js/aluna.js   telas da aluna
          └─ js/api.js ──► Supabase (Postgres com RLS, Auth, Realtime)
                     └──► js/demo.js (sem config: dados no localStorage)
form.html ── js/form.js ──► insere em public.leads (anônimo, só escrita)
sw.js: guarda os arquivos no aparelho (rede primeiro, cache se offline)
```
Não existe servidor próprio. Toda regra de acesso mora no banco (RLS e funções `security definer`). O front só mostra e envia.

## Camadas
| Camada | Onde | Regra |
|---|---|---|
| Tela | `js/coach.js`, `js/aluna.js`, `js/ficha.js`, `js/tesouro.js`... | Componentes Preact escritos com `html\`...\``. Recebem `ir` para navegar. |
| Componentes base | `js/util.js`, `js/icones.js`, `js/corpo.js` | `Modal`, `Campo`, `Abas`, `Estado`, `Vazio`, `Escala`, `Linha`, `Barras`, `toast`, `Icone`. Reusar antes de criar. |
| Regras de negócio | `js/musculos.js`, `js/radar.js`, `js/relatorio.js`, `js/extras.js`, `js/motor.js`, `js/util.js` | Funções puras. Fórmulas documentadas em `docs/regras-de-negocio.md`. |
| Dados | `js/api.js` | Única porta para o Supabase. Traduz erros para português. |
| Demonstração | `js/demo.js` | Mesma interface da `api`, com dados de exemplo no navegador. |
| Banco | `supabase/*.sql` | Tabelas, RLS, gatilhos e funções (`rpc`). |

## Rotas
Hash simples (`#/alunas`, `#/aluna/<id>/ficha`). `js/app.js` lê a rota, decide entre treinador e aluna pelo `profiles.role` e passa `rota` e `ir` para `AppCoach` ou `AppAluna`, que fazem o `if/else` das telas.

## Carregar dados numa tela
```js
const e = useCarregar(() => api.q('checkins', { eq: { aluna_id: aluna.id }, order: 'semana', asc: false }), [aluna.id]);
return html`<${Estado} e=${e}>${(lista) => html`...`}<//>`;
```
`Estado` mostra carregando, erro ou o conteúdo. Depois de salvar, `e.recarregar()`.

## Perfis
- `coach`: a primeira conta criada (gatilho `handle_new_user`). Vê e edita tudo.
- `student`: todas as outras. Vê o que é dela, registra treino, check-in e anamnese. O gatilho `protege_perfil` impede que mude `role`, `ativo`, `nivel` e metas de frequência.

## Publicação
GitHub Pages serve a branch `main`. Toda publicação com mudança de arquivo precisa subir `VERSAO` no `sw.js`. Mudanças de banco saem como `supabase/atualizacao-N.sql`, rodado à mão no SQL Editor.

## Vocabulário do app
| Nome no app | O que é | Código |
|---|---|---|
| Acrópole | Início do treinador (centro de comando) | `js/comando.js`, `centro_de_comando()` |
| Oráculo | Check-in semanal da aluna | `formularios.tipo = 'oraculo'`, `checkins` |
| Alistamento | Formulário de entrada (anamnese/PAR-Q) | `formularios.tipo = 'alistamento'` |
| Radar da Guerreira | Saúde da carteira: engajamento, progressão, evasão | `js/radar.js` |
| Forja | Editor de ficha e modelos | `js/ficha.js`, `js/modelos.js` |
| Tesouro | Financeiro | `js/tesouro.js` |
| Chronos | Agenda | `js/chronos.js` |
| Dossiê | Notas clínicas do treinador (com histórico) | `js/dossie.js`, `dossie` |
| Olimpo | Recordes da aluna e o plano de 12 meses | `js/comum.js`, `planos` |
| Ágora, Delfos, Ítaca, Olimpo | Planos de 1, 3, 6 e 12 meses | `planos` |
| Façanhas | Conquistas que aparecem na Acrópole | `js/comando.js` (`gloria`) |
