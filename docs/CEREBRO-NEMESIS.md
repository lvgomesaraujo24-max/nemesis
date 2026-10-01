# NEMESIS · Cérebro do projeto

> Fonte primária do app Nemesis. Reúne o que o app é, como foi construído, onde cada coisa mora, todas as regras de cálculo ("inteligência") e o plano daqui para frente.
> Dono do produto: **Luiz (LV TEAM · LV Coach)**. Repositório: `github.com/lvgomesaraujo24-max/nemesis`. Endereço do app: `https://lvgomesaraujo24-max.github.io/nemesis/`.
> Versão deste documento: **01/10/2026**. Descreve o código do PR #2 (cache `nemesis-v11`, banco até a `atualizacao-12.sql`).

### Status real (leia antes de tudo)

| Onde | Versão | Banco |
|---|---|---|
| **Produção** (branch `main`, o que as alunas usam hoje) | `nemesis-v6` | até a `atualizacao-6.sql` |
| **PR #2** (branch `claude/compassionate-mccarthy-3py13z`, consolidado, aguardando merge) | `nemesis-v11` | até a `atualizacao-12.sql` |

Enquanto o PR #2 não for juntado ao `main` e as atualizações 7 a 11 não forem rodadas no Supabase, **o que este documento descreve além da v6 não está no ar.** O PR #3 (relatório com deusa, missão e card de Stories) foi incorporado ao PR #2; a migração dele virou a `atualizacao-10.sql`. O branch `claude/happy-lovelace-qmbtuq` (CLAUDE.md, `.claude/` e checagem) também foi incorporado, atualizado para a v10.

---

## 0. Como usar este arquivo

**Para retomar o projeto em outra IA**, cole o bloco abaixo e anexe este arquivo:

```text
Você vai assumir o desenvolvimento do app Nemesis. O arquivo CEREBRO-NEMESIS.md é a fonte primária.
Regras:
1. Leia o arquivo inteiro antes de mexer em qualquer coisa.
2. Siga a arquitetura, a linguagem, o banco e as convenções descritas nele. Não troque de stack.
3. As fórmulas e os limites da seção 6 são um contrato. Não altere nenhum número, peso ou regra sem
   pedido explícito do Luiz. Se achar que uma regra está errada, explique e pergunte antes.
4. Mudança no banco sempre vira um arquivo novo supabase/atualizacao-N.sql, que pode rodar mais de uma vez.
5. Escreva em português do Brasil, com os nomes do universo grego do app (glossário na seção 1).
6. Depois de cada entrega, atualize este arquivo na seção que mudou.
```

**Se o computador der problema:** tudo o que importa está em dois lugares na nuvem: o código no GitHub e os dados no Supabase. A seção 14 explica como recuperar os dois.

---

## 1. O produto

**O que é:** app de consultoria de treino online para mulheres. O treinador monta a ficha, acompanha execução, check-ins, avaliações, formulários, finanças e agenda. A aluna treina pelo celular, registra carga e repetições, manda o check-in semanal (Oráculo) e acompanha a própria evolução.

**Dois lados, um app:**
- **Treinador (coach):** usa mais no computador, com menu lateral. Existe um único treinador: a primeira conta criada vira treinador, todas as outras viram aluna.
- **Aluna (student):** usa no celular, com menu inferior.

**Referência de mercado:** HypeFit, na visão do coach. O Nemesis copia o que ele faz bem (prescrição, volume, tempo, ficha 360, financeiro) e acrescenta o que ele não tem: autorregulação no check-in com semáforo, ciclo menstrual, dossiê imutável, metas com causa raiz, testes aeróbicos e radar de evasão.

### Glossário (a linguagem do app)

| Nome no app | O que é |
|---|---|
| **Acrópole** | Painel inicial do treinador (KPIs, Fila do dia, notificações, agenda de hoje) |
| **Templo · Fila do dia** | Bloco da Acrópole: check-ins sem resposta, vídeos para corrigir, alunas no vermelho, revisões de hoje |
| **Chamado de Asclépio** | Faixa de alerta com os casos críticos (dor forte, recuperação crítica) |
| **Radar da Guerreira** | Quem precisa de atenção: sinal vermelho, sem check-in, sem treinar, ficha velha, plano vencendo |
| **Oráculo** | Check-in semanal da aluna (formulário vivo) |
| **Alistamento** | Anamnese / formulário de entrada da aluna |
| **Forja** | Editor de ficha e modelos de treino |
| **Arena** | Execução do treino pela aluna |
| **Prova** | Avaliação física |
| **Olimpo** | Galeria de recordes (também é o nome do plano de 12 meses) |
| **Crônica · Estrada** | Linha do tempo da aluna (estrada de pedras) |
| **Dossiê** | Anotações privadas do treinador. Imutável: toda edição vira versão. Aberto pelo **Selo Ω** |
| **Chronos** | Agenda com camadas automáticas |
| **Tesouro** | Financeiro |
| **Guerreira** | A aluna ("Guerreira desde jul/2026") |
| **Planos** | Ágora (1 mês, R$ 247), Delfos (3 meses, R$ 647), Ítaca (6 meses, R$ 1.197), Olimpo (12 meses, R$ 1.997): valores iniciais, editáveis no Tesouro |

---

## 2. Decisões fundamentais (a stack)

| Tema | Decisão | Por quê |
|---|---|---|
| Tipo de app | **Web app instalável (PWA)**: abre no navegador e vira ícone na tela do celular ("Adicionar à tela de início") | Sem loja, sem taxa, atualiza na hora para todas |
| Linguagem | **JavaScript (ES Modules)**, sem TypeScript | Roda direto no navegador, sem compilar |
| Interface | **Preact + htm** (React leve, com templates em string), arquivo local `lib/preact-htm.js` | Sem etapa de build: o que está no repositório é o que roda |
| Estilo | **CSS puro** com variáveis (tokens) em `css/app.css` | Simples e rápido |
| Banco de dados | **Supabase** (PostgreSQL + Auth + Storage + Realtime), região São Paulo | Banco relacional de verdade, login pronto, regras de segurança por linha (RLS) |
| Regras pesadas | **Funções SQL (RPC) no Postgres** para a Acrópole e os formulários vivos; o resto é calculado no aparelho | Uma chamada monta o painel inteiro; o resto fica leve |
| Hospedagem | **GitHub Pages** (branch `main`, pasta raiz) | Grátis, deploy automático a cada merge |
| Código-fonte | **GitHub**, repositório `lvgomesaraujo24-max/nemesis` | Histórico completo e backup |
| Offline | **Service worker** (`sw.js`) guarda os arquivos no aparelho | Abre rápido e sem internet |
| Bibliotecas externas | Tudo local em `lib/` (Preact, Supabase JS, fontes Inter e Playfair Display) | Não depende de CDN |
| Idioma | Português do Brasil em tudo: interface, código, nomes de variáveis, banco e commits | Coerência para o dono do produto |
| Modo demonstração | Com `config.js` vazio o app roda com dados de exemplo no navegador (`js/demo.js`) | Testar sem banco |

---

## 3. Arquitetura

```
 Celular / computador (navegador ou PWA instalado)
 ┌───────────────────────────────────────────────────────────┐
 │ index.html ── config.js (URL + chave pública do Supabase) │
 │     │                                                     │
 │ js/app.js  → login, rota (#/...), escolhe o lado          │
 │   ├─ js/coach.js  (treinador) ─┐                          │
 │   └─ js/aluna.js  (aluna)     ─┤ módulos por área          │
 │                                │                          │
 │ js/api.js  ← única porta para o banco                     │
 │   └─ js/demo.js (mesma interface, dados no navegador)     │
 │ sw.js      ← cache offline (versão nemesis-vN)            │
 └───────────────┬───────────────────────────────────────────┘
                 │ HTTPS (supabase-js)
 ┌───────────────▼───────────────────────────────────────────┐
 │ Supabase                                                  │
 │  Auth (e-mail e senha) → trigger cria o perfil            │
 │  Postgres: 38 tabelas + RLS + funções RPC                 │
 │  Storage: bucket privado "arquivos" (pasta = id da aluna) │
 │  Realtime: alertas_coach, envios, checkins                │
 └───────────────────────────────────────────────────────────┘
 form.html (público) → grava inscrição em "leads" (só insere, nunca lê)
```

### Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Casca do app: carrega `config.js`, `lib/supabase.js` e `js/app.js` |
| `form.html` + `js/form.js` + `css/form.css` | Formulário público de inscrição (link da bio), 3 passos, grava em `leads` |
| `config.js` | `SUPABASE_URL` e `SUPABASE_ANON_KEY` (chave pública; a segurança vem do RLS) |
| `manifest.json` | PWA: nome, ícones, cor `#1a1a1a`, retrato, standalone |
| `sw.js` | Service worker. **Trocar `VERSAO` a cada publicação** |
| `js/app.js` | Entrada, login, criar conta, esqueci a senha, convite por link, roteador |
| `js/api.js` | Camada do banco: `q`, `um`, `ins`, `enviar`, `upd`, `ups`, `del`, `rpc`, arquivos (`subirArquivo`, `linkArquivo`, `apagarArquivo`), tempo real (`aoInserir`) e tradução de erros |
| `js/demo.js` | Mesma interface do `api.js`, com dados no `localStorage` (chave `nemesis-demo-v2`) |
| `js/util.js` | Datas, números, moeda, componentes base (Modal, Campo, Abas, Estado, gráficos Linha/Barras), avaliação física, semáforo, recordes |
| `js/coach.js` | Casca do treinador (menu), Alunas, ficha 360 da aluna, Oráculo do treinador, Inscrições, Painel antigo, Convite |
| `js/aluna.js` | Casca da aluna, Início, Execução (Arena), Oráculo, Perfil |
| `js/comando.js` | Acrópole: KPIs, Fila do dia, notificações (RPC `centro_de_comando`), agenda de hoje |
| `js/radar.js` | Engajamento, Progressão, risco de evasão, Radar da Guerreira |
| `js/ficha.js` | Forja: editor de treino (prescrição, presets, volume ao vivo, séries detalhadas, importar/salvar modelo) |
| `js/musculos.js` | Músculos, regras de reconhecimento, volume, faixas por nível, tempo estimado, métodos, cadência, descanso |
| `js/corpo.js` | Mapa do corpo em SVG (frente e costas) |
| `js/modelos.js` | Modelos de ficha |
| `js/biblioteca.js` | Biblioteca de exercícios (etiquetas, perfil de resistência, substitutos) |
| `js/comum.js` | Telas dos dois lados: Evolução, Olimpo, Alistamento, Avaliações (nova, comparação, gráficos, autoavaliação) |
| `js/relatorio.js` | Relatório de evolução (mês, ficha ou período) e PDF |
| `js/aluna360.js` | Formulários da aluna, Arquivos e fotos lado a lado, Crônica, Vídeos |
| `js/formularios.js` | Construtor de formulários vivos (perguntas, dicas, aberturas, atribuições, pendências, respostas, prévia) |
| `js/vivo.js` | Resposta do formulário vivo pela aluna, pendências da aluna |
| `js/motor.js` | Motor de regras (espelho do `avaliar_regra` do banco), regiões do corpo, escala RIR, fases do ciclo |
| `js/dossie.js` | Dossiê e Selo Ω |
| `js/extras.js` | Mesociclo e progressão, cardio, testes aeróbicos, metas |
| `js/tesouro.js` | Tesouro: métricas, planos como pacote de entregas, parcelas, taxas |
| `js/chronos.js` | Agenda: semana, mês, fila, camadas automáticas, rituais |
| `js/icones.js` | Ícones SVG de linha |
| `supabase/schema.sql` | Banco base (rodar primeiro) |
| `supabase/atualizacao-2.sql` … `-9.sql` | Atualizações do banco, em ordem |

### Padrões de código

- Um arquivo por área. Componentes em função (`function Nome({ props })`) com `html\`...\``.
- Carregamento de dados: `useCarregar(async () => ..., [deps])` + `<${Estado} e=${e}>${(dados) => ...}<//>`.
- Todo acesso ao banco passa por `api.*`. Nunca chamar o Supabase direto numa tela.
- Todo recurso novo precisa funcionar também no modo demonstração (`demo.js` tem a mesma interface).
- Campos novos do banco só vão no salvar quando preenchidos ou alterados, para o app não quebrar antes de o SQL novo ser rodado.
- Erro de coluna ou tabela inexistente vira a mensagem "rode as atualizações 5 a 12" (`traduzErro` em `api.js`).

---

## 4. Rotas

Roteamento por hash: `#/base/id/sub`.

### Treinador

| Rota | Tela |
|---|---|
| `#/` | Acrópole |
| `#/alunas` | Lista de alunas com Radar, busca, ordenação (nome, menor engajamento, menor progressão, maior risco) e **+ Convidar aluna** |
| `#/aluna/:id/:aba` | Ficha 360 da aluna (padrão: `geral`) |
| `#/checkins` | Oráculo do treinador: responder check-ins, lembrar quem não enviou |
| `#/agenda` | Chronos |
| `#/financeiro` | Tesouro (Resumo, Lançamentos, Planos) |
| `#/modelos` · `#/modelos/:id` | Modelos de ficha |
| `#/exercicios` | Biblioteca de exercícios |
| `#/formularios` · `#/formularios/:id/:aba` | Formulários vivos. Abas: `perguntas`, `dicas`, `aberturas`, `atribuicoes`, `pendencias`, `respostas`, `previa` |
| `#/leads` | Inscrições (novo, contatado, fechado, perdido) |
| `#/painel` | Painel antigo (mantido) |

**Abas da ficha da aluna** (`#/aluna/:id/...`): `geral` (Dossiê + Estrada lado a lado), `ficha`, `evolucao`, `relatorio`, `avaliacoes`, `checkins` (Oráculo), `formularios`, `atividades` (Crônica), `videos`, `dossie`, `arquivos`, `metas`, `cardio`, `testes`, `anamnese` (Alistamento), `financeiro`, `dados`.

**Cabeçalho da ficha:** nome, idade, objetivo, status (Ativa/Pausada), "Guerreira desde mês/ano", sinal do último check-in, Copiar link, WhatsApp e os três selos: Engajamento, Progressão e Evasão.

### Aluna

| Rota | Tela |
|---|---|
| `#/` | Início: treinos da semana (próximo em destaque), pendências de formulário com prazo, relatório |
| `#/treino/:id` | Arena (execução) |
| `#/form/:formularioId/:atribuicaoId` | Responder formulário |
| `#/evolucao` · `#/relatorio` | Evolução, Olimpo e relatório |
| `#/checkin` | Oráculo |
| `#/perfil` | Abas: Dados, Metas, Avaliações (e autoavaliação), Fotos e arquivos, Testes, Alistamento, Privacidade |
| `#/cardio` | Cardio |

Antes de tudo, a aluna sem o aceite da versão atual dos termos e do consentimento de saúde vê a tela de consentimento (seção 7.1). Um formulário com "bloqueia o app" (ex.: Alistamento) aparece antes de qualquer tela até ser respondido.

### Público (sem login)

| Endereço | O que faz |
|---|---|
| `form.html` | Inscrição da bio → tabela `leads` |
| `legal.html#privacidade` · `legal.html#termos` | Política de Privacidade e Termos de Uso (públicos, linkados no login e no formulário) |
| `#/convite/:token` | Criar conta pelo convite (token de 32 caracteres hexadecimais, válido por 7 dias, uso único) |

---

## 5. Banco de dados (Supabase / PostgreSQL)

### Ordem de instalação

1. `supabase/schema.sql` (base)
2. `atualizacao-2.sql` até `atualizacao-12.sql`, **nessa ordem**. Todas podem rodar mais de uma vez (testado num Postgres 16 simulando o Supabase: o conjunto inteiro rodou duas vezes seguidas sem erro). **Não rode uma atualização antiga depois de uma nova**: a 2 recria funções que a 11 protege.

| Arquivo | O que liga |
|---|---|
| `schema.sql` | Perfis, exercícios, treinos, execução, check-in, anamnese, avaliação, inscrições, planos, assinaturas, lançamentos, RLS |
| `atualizacao-2` | Formulários vivos, dicas condicionais, mapa de dor, ciclo menstrual, Dossiê imutável, metas com causa raiz, cardio, testes aeróbicos, alertas ao treinador |
| `atualizacao-3` | Acrópole (`centro_de_comando`), mesociclos, agenda, estado das notificações, realtime |
| `atualizacao-4` | Estresse do Oráculo de 0 a 10, treinador marca envio como lido |
| `atualizacao-5` | Prescrição completa da ficha (tipo, método, cadência, descanso, esforço, aeróbico, músculos) |
| `atualizacao-6` | Formato das repetições, nível da aluna, presets, modelos, progressão do mesociclo, etiquetas da biblioteca, entregas do plano, tipos de agenda |
| `atualizacao-7` | Protocolo e diâmetros da avaliação, arquivos da aluna, bucket `arquivos` |
| `atualizacao-8` | Cadência por tipo, grupos de método, séries detalhadas, RIR real, vídeos de execução, todos os protocolos, autoavaliação, dia de revisão, combo nutri, aulas presenciais |
| `atualizacao-9` | Modelos com objetivo/frequência/duração, prazo nos formulários, pose das fotos, convites |
| `atualizacao-10` | Relatório: palavra do treinador e missão do mês salvas no banco (`relatorio_notas`) |
| `atualizacao-12` | LGPD: consentimentos sem edição, pedidos da aluna, exclusão completa (`eliminar_aluna`), foto e vídeo só com consentimento de imagem, aluna apaga os próprios arquivos |
| `atualizacao-11` | Correções da auditoria: cadastro sem convite aguardando aprovação, leitura da metodologia só por aluna ativa, limites contra robôs no formulário público |

### Tabelas (42)

**Pessoas e acesso**
- `profiles`: um por conta (id = `auth.users.id`). `role` (coach/student), `nome`, `email`, `telefone`, `nascimento`, `sexo` (F/M), `objetivo`, `ativo`, `anamnese_ok`, `alistada_em`, `treinos_semana_alvo`, `nivel` (iniciante/intermediaria/avancada), `ciclo_rastrear`, `ciclo_duracao_media`, `contracepcao`, `dia_revisao` (0 = domingo … 6), `combo_nutri`.
- `convites`: `token`, `nome`, `email`, `telefone`, `objetivo`, `expira_em`, `usado_em`, `aluna_id`.
- `profiles.aguardando`: conta criada sem convite, pausada até o treinador liberar.

**Treino**
- `exercicios`: biblioteca. `nome`, `grupo`, vídeo, instruções, `musculos` {primarios, secundarios}, `equipamento`, `articulacao`, `perfil_resistencia`, `substitutos[]`.
- `treinos`: treino A, B, C… De uma aluna (`aluna_id`) **ou** de um modelo (`modelo_id`). `nome`, `ordem`, `opcional`, `ativo`, `observacoes`.
- `treino_itens`: linha de prescrição. `tipo` (aquecimento/aerobico/musculacao/crossfit), `series`, `reps`, `reps_tipo`, `aquecimento`, `metodo`, `grupo`, `cadencia_exc/con/tipo/texto`, `descanso`, `descanso_tipo`, `descanso_max`, `esforco_tipo` (rir/rpe), `esforco_alvo`, `duracao`, `intensidade`, `series_detalhe` (meta por série), `obs`.
- `modelos`: `nome`, `nivel`, `descricao`, `objetivo`, `frequencia_semanal`, `duracao_semanas`.
- `presets_linha`: prescrições prontas ("Glúteo força: 4×6-8, RIR 2, 2s excêntrica, 120s").
- `mesociclos`: validade da ficha. `inicio`, `fim`, `status` (planejado/ativo/encerrado), `progressao` ([{rir:3},{rir:2},{rir:1},{deload:true}]).
- `sessoes`: um treino feito. `data`, `treino_nome`, `iniciada_em`, `concluida_em`, `esforco`, `comentario`.
- `series`: cada série registrada. `carga`, `reps`, `rir`, `aquecimento`, `numero`, `exercicio_id`, `treino_item_id`.
- `videos_execucao`: vídeo da aluna + `correcao` do treinador.

**Acompanhamento**
- `checkins`: resumo semanal (uma linha por aluna e semana): `peso`, `sono`, `energia`, `estresse` (1–5), `estresse10` (0–10), `fome`, `dieta`, `dor`, `dor_muscular`, `dor_articular`, `dor_local`, `insonia`, `treinos_feitos`, `comentario`, `resposta`, `respondido_em`.
- `anamneses`: Alistamento antigo + PAR-Q.
- `avaliacoes`: `data`, `idade`, `peso`, `altura`, `dobras` {}, `medidas` {}, `diametros` {}, `percentual_gordura`, `protocolo` (jp7, jp3, weltman, tran, slaughter, perimetria), `autoavaliacao`, `obs`.
- `metas`: `tipo` (carga, peso, gordura, medida, vo2, livre), alvo, prazo, `status` (ativa/batida/nao_batida/cancelada), causa raiz (`causa_categoria`, `causa_descricao` com 20+ caracteres, `acao_corretiva`, `analisada_em`).
- `testes_aerobicos`, `cardio_prescricoes`, `cardio_registros`.
- `ciclo_registros`: início de cada menstruação.
- `dor_relatos`: região, lado, intensidade 0–10, quando dói.
- `arquivos_aluna`: `nome`, `caminho` no Storage, `tipo`, `categoria` (foto, exame, documento, outro), `pose` (frente, lado, costas), `tamanho`.

**Formulários vivos**
- `formularios` (tipo: oraculo, alistamento, livre; `versao`), `perguntas` (tipos: escala, multipla, caixas, sim_nao, numero, texto_curto, texto_longo, data, mapa_corporal, rir, ciclo; `mostrar_se`, `titulo_variantes`), `dicas_condicionais`, `mensagens_abertura`, `atribuicoes` (quando: agora, programado, recorrente; `entrega`: manual ou fim_treino; `bloqueia_app`; `prazo`), `envios`, `respostas`, `dica_exibicoes`, `alertas_coach`.

**Treinador**
- `consentimentos`: cada aceite da aluna (versão dos textos, termos, saúde, imagem, menor e dados do responsável), com a hora do servidor. Só se acrescenta: nunca se edita nem se apaga (prova do consentimento, art. 8º, §2º).
- `solicitacoes_privacidade`: pedidos da aluna (acesso, correção, exclusão, revogação), com status e resposta. Fica depois da exclusão, sem a aluna, como prova do atendimento.
- `registro_eliminacoes`: data e motivo de cada exclusão feita, sem nenhum dado pessoal.
- `relatorio_notas`: palavra do treinador e missão (até 3 focos) por aluna e período do relatório; a aluna lê, só o treinador escreve.
- `dossie` (tags: lesao, pausa, psicologia, ajuste_rota) e `dossie_versoes`: só o treinador vê, ninguém apaga, toda edição vira versão.
- `agenda`: `tipo` (video, presencial, avaliacao, ritual, lembrete, outro), `inicio`, `feito`, `link`, recorrência.
- `visoes_estado`: o que foi visto, resolvido, adiado ou feito na Acrópole.
- `leads`: inscrições (`status`: novo, contatado, fechado, perdido).

**Financeiro**
- `planos`: `nome`, `meses`, `valor`, `ativo`, `entregas` (pacote).
- `assinaturas`: plano da aluna. `inicio`, `fim`, `valor`, `forma_pagamento`, `presenciais`.
- `lancamentos`: receitas e despesas. `vencimento`, `pago_em`, `categoria`.

### Funções no banco (RPC e gatilhos)

| Função | O que faz |
|---|---|
| `is_coach()` | Diz se quem está logado é o treinador (base de todas as regras de acesso) |
| `handle_new_user()` (gatilho) | Cria o perfil no cadastro. Primeira conta = treinador. Com convite válido: aluna ativa com nome, WhatsApp e objetivo, e o convite é marcado como usado (depois de o perfil existir). Sem convite: aluna **pausada aguardando aprovação** |
| `protege_perfil()` (gatilho) | Aluna não altera `role`, `ativo`, `aguardando`, `treinos_semana_alvo`, `alistada_em`, `nivel`, `dia_revisao`, `combo_nutri` |
| `is_aluna_ativa()` | Diz se quem está logado é aluna ativa (base da leitura da metodologia) |
| `leads_limites()` (gatilho) | Formulário público: nome de 2 a 120 letras, WhatsApp de 10 a 15 dígitos, até 3 inscrições por WhatsApp por hora e até 20 inscrições no total a cada 10 minutos |
| `eliminar_aluna(aluna, motivo)` | Só o treinador. Desliga os lançamentos financeiros da aluna, apaga o perfil (e tudo o que depende dele, Dossiê inclusive) e o login, e grava em `registro_eliminacoes`. Os arquivos do Storage são apagados pelo app antes |
| `consentiu_imagem(aluna)` | Último consentimento de imagem da aluna (regra de envio de foto e vídeo) |
| `ver_convite(token)` | Tela de entrada lê nome, e-mail e validade de um convite sem estar logada |
| `montar_formulario(formulario, aluna?)` | Monta o pacote do formulário vivo com o contexto da aluna (seção 6.11). Só treinador ou aluna ativa; a lógica fica em `montar_formulario_base`, fechada para chamada direta |
| `enviar_formulario(...)` | Grava o envio, as respostas, as dores, o ciclo, as dicas mostradas e os alertas ao treinador. No Oráculo, também grava o `checkins` da semana |
| `avaliar_regra(regra, fonte)` | Motor de regras no banco (igual ao `motor.js`) |
| `fase_ciclo(aluna, dia)` | Fase estimada do ciclo menstrual (seção 6.12) |
| `nome_regiao(regiao, lado)` | "joelho direito", "coxa esquerda (trás)" |
| `dossie_carimba` / `dossie_audita` (gatilhos) | Dossiê imutável com histórico de versões |
| `centro_de_comando(dia)` | Uma chamada monta a Acrópole: `fichas`, `sem_ficha`, `sinais`, `alertas`, `adesao`, `adesao_alunas`, `marcos`, `agenda`, `oraculos`, `metas`, `estados` |
| `cc_fichas`, `cc_sinais_clinicos`, `cc_adesao_base`, `cc_adesao`, `cc_adesao_alunas`, `cc_marcos` | Partes da Acrópole (seção 6.10) |

### Storage

Bucket privado **`arquivos`**. Caminho: `{id_da_aluna}/{arquivo}` e `{id_da_aluna}/videos/{arquivo}`. O treinador acessa tudo. A aluna lê e envia apenas na própria pasta. Os arquivos abrem por **link assinado de 1 hora**, nunca público. Limite do app: 20 MB por arquivo.

### Tempo real

`alertas_coach`, `envios` e `checkins` avisam a Acrópole na hora em que entra uma linha nova.

---

## 6. Inteligência do sistema: CONTRATO

> **Tudo nesta seção é regra de negócio desenhada pelo Luiz. Nenhum número, peso, limite ou fórmula muda sem pedido explícito dele.** Uma IA que assumir o projeto pode propor mudança, mas não aplicar por conta própria.

### 6.1 Volume de treino

- Conta **só** exercícios do tipo `musculacao` e `crossfit`. Aquecimento e aeróbico não contam.
- **Músculo principal = 1 série. Músculo auxiliar = 0,5 série.** Um músculo que é principal não soma de novo como auxiliar.
- Os músculos do exercício vêm do cadastro (`exercicios.musculos`). Sem cadastro, o nome do exercício é reconhecido por regras de texto (`REGRAS` em `musculos.js`, a primeira que casa vence). Se nenhuma casar, entra o `grupo` do exercício.
  - Exemplos: elevação pélvica → glúteo máximo (auxiliar: posteriores); abdutora → glúteo médio (aux.: glúteo máximo); stiff → posteriores (aux.: glúteo máximo e eretores); búlgaro/afundo → quadríceps e glúteo máximo (aux.: adutores, glúteo médio); agachamento/leg press/hack → quadríceps (aux.: glúteo máximo, adutores); puxada → latíssimo (aux.: bíceps, romboides, deltoide posterior).
- **Grupos da barra de volume:** glúteo, quadríceps, posteriores, adutores, panturrilha, costas, lombar, peito, ombros, bíceps, tríceps, core. No grupo, soma 1 se algum principal é do grupo, senão 0,5 se algum auxiliar é.
- **Faixas de séries semanais por nível** [mínimo, máximo]:

| Grupo | Iniciante | Intermediária | Avançada |
|---|---|---|---|
| Glúteo | 9–12 | 12–16 | 18–24 |
| Grandes (quadríceps, posteriores, costas, peito, ombros) | 6–10 | 10–14 | 14–20 |
| Pequenos (adutores, panturrilha, lombar, bíceps, tríceps, core) | 4–8 | 6–10 | 10–14 |

- Status: abaixo da faixa / na faixa / acima da faixa. Nível padrão: intermediária.
- Escala do mapa do corpo: 0–4 baixo, 5–9 moderado, 10–14 alto, 15 ou mais altíssimo.

### 6.2 Tempo estimado do treino

- Segundos por repetição: cadência padrão = excêntrica + concêntrica (padrão 2 s + 0 s, mínimo 1). Americana (ex.: "3-1-1-0") = soma dos dígitos. Simplificada: lenta 5 s, moderada 3 s, rápida 2 s, explosiva 1 s.
- Por série: isometria "30s" = 30 s. Máximas, até a falha ou na reserva = 10 reps. Faixa "8-12" = média (10). Sem número = 10.
- Descanso: exato = valor; faixa = média de mínimo e máximo; livre = 90 s.
- **Tempo do exercício = séries × tempo da série + (séries − 1) × descanso + séries de aquecimento × (0,8 × tempo da série + 45 s).**
- Aeróbico = duração em minutos × 60.
- **Tempo do treino = soma dos exercícios + um descanso entre um exercício e o próximo** (menos depois de aeróbico). Conferido com o HypeFit: 3 min 48 s no mesmo exemplo.

### 6.3 Mesociclo e progressão semanal

- Toda ficha tem validade (mesociclo), padrão de **6 semanas**. Nova ficha encerra a anterior.
- Progressões prontas: 4 semanas RIR 3 → 2 → 1 → deload; 5 semanas RIR 3 → 2 → 2 → 1 → deload; 6 semanas RIR 3 → 3 → 2 → 2 → 1 → deload. Cada semana pode ser editada.
- Semana atual = ⌊dias desde o início ÷ 7⌋ + 1 (limitada à última).
- A meta de RIR da semana vale para todos os exercícios de musculação.
- **Deload: metade das séries (arredondando para cima, mínimo 1)** e orientação de carga cerca de 10% menor.
- Ficha que vence em até 7 dias entra na Acrópole ("Fichas no limite").

### 6.4 Arena (execução)

- Cada série registra carga, repetições e RIR real (opcional).
- **Recorde:** série de trabalho (não aquecimento) com carga maior que a maior carga anterior daquele exercício → aviso "Novo recorde".
- **Descanso automático** depois da série: tempo prescrito; em série de aquecimento, no máximo 60 s; descanso livre não abre cronômetro. Botão +15 s.
- "Última vez": mostra o que a aluna fez no exercício na sessão anterior.
- **Troca de exercício pela aluna** (aparelho ocupado): só por um substituto cadastrado; o treinador recebe um alerta "Troca de exercício".
- Vídeo da execução vai para o Storage; o treinador corrige e a aluna vê a correção no treino.

### 6.5 Semáforo do check-in (Oráculo)

```
soma = (6 − sono) + (6 − energia) + estresse + dor
```
- As quatro escalas vão de 1 a 5, todas no sentido "quanto maior, pior". Dor = `dor` ou, se não houver, a maior entre `dor_muscular` e `dor_articular`.
- **4 a 9 = verde ("Recuperando bem") · 10 a 14 = amarelo ("Atenção") · 15 a 20 = vermelho ("Sinal vermelho").**
- Só o treinador vê. O vermelho entra no Radar e soma 10 pontos no risco de evasão.

### 6.6 Engajamento (0 a 100)

Janela: **últimos 28 dias**. Comparação (tendência): os 28 dias anteriores.
```
engajamento = 0,60 × min(1, treinos feitos ÷ treinos previstos)
            + 0,25 × min(1, check-ins feitos ÷ check-ins previstos)
            + 0,15 × (formulários respondidos no prazo ÷ formulários atribuídos)
```
- Treinos previstos = frequência semanal × semanas da janela. Frequência = `treinos_semana_alvo` da aluna, senão o número de treinos obrigatórios (não opcionais) ativos da ficha. **Sem ficha, o componente de treinos sai da conta.**
- Semanas da janela = mínimo entre 4 e (dias acompanhados ÷ 7). Aluna que entrou há pouco tem a meta proporcional.
- Check-ins previstos = semanas da janela arredondado (mínimo 1).
- Formulários: só atribuições não recorrentes e que não sejam o Oráculo, liberadas dentro da janela. No prazo = respondido até o `prazo` ou, sem prazo, até 3 dias depois de liberado.
- **Componente que não se aplica sai e o peso é redistribuído** entre os outros (divide pela soma dos pesos usados).
- Menos de 7 dias de acompanhamento = **"--"**.
- Faixas: **80–100 verde, 50–79 amarelo, abaixo de 50 vermelho.**
- Tendência: seta ↑ se subiu 5 pontos ou mais, ↓ se caiu 5 ou mais, → se ficou estável.

### 6.7 Progressão (0 a 100)

- 1RM estimado por **Epley: carga × (1 + reps ÷ 30)**. Séries acima de 20 repetições não entram.
- Por exercício: o melhor 1RM das **últimas 4 semanas** contra o melhor das **4 semanas anteriores**. Variação = atual ÷ anterior − 1.
- Índice = **mediana** das variações, em escala linear: **+5% ou mais = 100 · 0% = 50 · −5% ou menos = 0** (índice = 50 + variação × 1000, limitado entre 0 e 100).
- **Precisa de pelo menos 3 exercícios** com dados nas duas janelas, senão "--".
- Tendência: o mesmo cálculo deslocado 4 semanas para trás, com a mesma regra de ±5 pontos.
- Mesmas faixas de cor do engajamento.

### 6.8 Risco de evasão (0 a 100)

Soma de pontos, limitada a 100:

| Condição | Pontos |
|---|---|
| Aderência (treinos das últimas 4 semanas ÷ meta × 4) abaixo de 50% | +35 |
| Aderência entre 50% e 75% | +15 |
| Sem treinar há 7 dias ou mais (ou nunca treinou) | +20 |
| Sem treinar há 14 dias ou mais | +10 (a mais) |
| Sem check-in nas últimas 2 semanas | +15 |
| Plano vence em até 7 dias | +15 |
| Progressão negativa | +10 |
| Sem ficha ativa | +15 |
| Último check-in com semáforo vermelho | +10 |

**50 ou mais = risco alto · 25 a 49 = médio · abaixo de 25 = baixo.** Na aderência, meta sem ficha = 3 treinos por semana.

### 6.9 Radar da Guerreira (grupos)

1. Sinal vermelho no Oráculo · 2. Sem check-in esta semana · 3. Sem treinar há 7 dias ou mais · 4. Ficha há mais de 4 semanas (ou sem ficha) · 5. Plano vence em até 7 dias.
Cada grupo mostra até 6 nomes, com mensagem de WhatsApp pronta.

### 6.10 Acrópole (funções do banco)

**Níveis e peso na ordenação:** crítica 100 (▲), atenção 60 (●), tarefa 40 (◆), façanha/glória 20 (★).

**Sinais clínicos** (Oráculos dos últimos 7 dias; histórico de dor de 60 dias):
- Dor **crítica**: intensidade ≥ 7, ou maior que o relato anterior da mesma região e lado.
- Dor **atenção**: intensidade ≥ 4, ou ≥ 3 com o relato anterior também ≥ 3 (dor persistente).
- Recuperação **crítica**: estresse ≥ 9 (de 10) e sono ≤ 2 (de 5).
- Recuperação **atenção**: menos de 5 h de sono e estresse ≥ 7.
- Cada sinal traz a fase do ciclo menstrual, quando a aluna rastreia.

**Adesão:**
- Semana a semana, nas últimas 8 semanas fechadas mais a atual. Por aluna: min(treinos feitos, meta) ÷ meta. Semanas em **pausa** registradas no Dossiê não contam.
- Meta = `treinos_semana_alvo`, senão os treinos obrigatórios, senão 3. Alunas com menos de 7 dias de casa ficam de fora.
- Semana em curso: o esperado é proporcional aos dias já passados.
- **Falha sistêmica:** a média de todas caiu 15 pontos ou mais contra a média das 4 semanas anteriores (precisa de 5 semanas fechadas).
- **Aluna em atenção:** 2 semanas seguidas abaixo de 60%, ou 10 dias ou mais sem treinar.

**Fichas:** vencem em até 7 dias (ou já venceram) e não há ficha mais nova.

**Oráculo sem resposta:** aparece como tarefa depois de **48 h**.

**Marcos automáticos (hoje e amanhã):**
- Treino redondo: 10, 25, 50, 100, 150, 200, 300, 400, 500 (avisa quando falta 1 e quando completa).
- Tonelagem do mês: 25, 50, 75 e 100 toneladas.
- Aniversário de Alistamento: 3, 6, 12 e 24 meses.
- Aniversário da aluna.
- Reavaliação: 8 semanas (56 dias) desde a última avaliação física ou teste aeróbico.
- Prazo de meta, fim de ficha e plano que vence em até 3 dias.

Cada item pode ser marcado como visto, resolvido, feito ou adiado (3 dias), e some da lista.

**Fila do dia (Templo):** check-ins sem resposta (últimas 2 semanas), vídeos sem correção, alunas cujo último check-in está no vermelho e alunas com dia de revisão igual a hoje.

### 6.11 Formulários vivos

**Motor de regras** (`motor.js` e `avaliar_regra` no banco fazem a mesma coisa):
- Formato: `{ "todas": [...] }`, `{ "alguma": [...] }`, `{ "nao": regra }` ou `{ "campo", "op", "valor" }`.
- Campos: `resp.*` (resposta atual), `ctx.*` (histórico da aluna), `aluna.*` (perfil). O valor também pode apontar para outro campo (ex.: `"ctx.alvo_semana"`).
- Operadores: `=`, `!=`, `<`, `<=`, `>`, `>=`, `entre`, `em`, `contem`, `respondida`, `vazia`, `subiu`, `caiu`.
- **Regra mal escrita ou operador desconhecido = falso.** A tela nunca quebra por causa de uma regra.
- Textos vivos: `{{ctx.ultima_dor.intensidade}}` é trocado pelo valor.
- Pergunta com `mostrar_se` só aparece quando a regra é verdadeira. `titulo_variantes` troca o título conforme o contexto.

**Contexto (`ctx`) que o banco monta para cada aluna:** respostas do envio anterior do mesmo tipo e a data dele; dores dos últimos 21 dias (a mais recente de cada região, da mais forte para a mais fraca) e `ultima_dor`; metas ativas com prazo em até 14 dias ou não batidas já analisadas; treinos da semana passada e da atual; `alvo_semana`; fase do ciclo; dicas em cooldown.

**Dicas condicionais** (mostradas à aluna ou viram alerta para o treinador; cada uma tem prioridade e cooldown):

| Público | Regra | Título | Severidade |
|---|---|---|---|
| aluna | sono_horas < 5 | Noite curta (cooldown 3 dias) | atenção |
| aluna | sono ≤ 2 e estresse ≥ 7 | Semana puxada | atenção |
| aluna | dores_max ≥ 7 | Dor forte | alerta |
| aluna | dor_evolucao subiu vs. última dor | A dor aumentou | alerta |
| aluna | dor_evolucao caiu vs. última dor | Está melhorando | info |
| aluna | rir_principal ≥ 9,5 | Na falha toda semana? (cooldown 14 dias) | info |
| aluna | sintomas contém cólica | Cólica | info |
| aluna | treinos_feitos < alvo da semana | Semana abaixo do planejado | info |
| treinador | última dor ≥ 3 e dor_evolucao ≥ 3 | Dor persistente | alerta |
| treinador | dores_max ≥ 7 | Dor forte relatada | alerta |
| treinador | sono_horas < 5 e estresse ≥ 7 | Recuperação comprometida | atenção |

**Oráculo → tabela `checkins`** (para o resumo semanal, a Crônica e o Painel):
- Estresse do Oráculo é de **0 a 10**. O resumo guarda o original em `estresse10` e o convertido em `estresse` = arredondar(estresse ÷ 2), entre 1 e 5.
- `dor_articular` = arredondar para cima(maior dor do mapa ÷ 2), entre 1 e 5. Sem dor, 1.
- `dor_local` = nome da região da maior dor. `insonia` = dormiu menos de 5 h.

**Status de uma atribuição:** pausada; agendado (antes de liberar); respondido (ou "fora do prazo"); com prazo: pendente até o prazo e atrasado depois; sem prazo: pendente por 3 dias e atrasado depois. Recorrente: "respondido esta semana" ou "pendente esta semana".

### 6.12 Ciclo menstrual (`fase_ciclo`)

- Só com `ciclo_rastrear` ligado. Com contracepção hormonal (pílula combinada, DIU hormonal, implante, injetável, anel) → "hormonal", sem estimativa.
- Duração = **mediana dos últimos 6 intervalos válidos (21 a 45 dias)**. Com menos de 2 intervalos, usa a duração informada, senão 28. Sangramento padrão: 5 dias.
- Dia do ciclo > duração + 7 → "atrasado".
- Ovulação no dia (duração − 14).
- **Fases:** menstrual (até o fim do sangramento) · folicular (até 2 dias antes da ovulação) · ovulatória (ovulação ±1 dia) · lútea (até duração − 5) · lútea tardia (restante).
- Confiança **média** com 3 ou mais intervalos e desvio de até 3 dias; senão **baixa**.

### 6.13 Avaliação física (Prova)

**Medidas:** 9 dobras em mm (tríceps, subescapular, bíceps, peitoral, axilar média, suprailíaca, abdominal, coxa média, panturrilha medial); 20 perímetros em cm (pescoço, braços relaxado e contraído D/E, antebraços D/E, ombros, tórax, cintura, abdômen, quadril, coxas proximal/média/distal D/E, panturrilhas D/E); diâmetros ósseos em mm (punho, úmero, fêmur). A idade é calculada na data da avaliação.

**Protocolos de % de gordura:**
- **Siri:** %G = (495 ÷ DC) − 450.
- **Pollock 7** (peitoral, axilar, tríceps, subescapular, abdominal, suprailíaca, coxa), S = soma:
  - Mulher: DC = 1,097 − 0,00046971·S + 0,00000056·S² − 0,00012828·idade
  - Homem: DC = 1,112 − 0,00043499·S + 0,00000055·S² − 0,00028826·idade
- **Pollock 3** (mulher: tríceps, suprailíaca, coxa · homem: peitoral, abdominal, coxa):
  - Mulher: DC = 1,0994921 − 0,0009929·S + 0,0000023·S² − 0,0001392·idade
  - Homem: DC = 1,10938 − 0,0008267·S + 0,0000016·S² − 0,0002574·idade
- **Weltman** (sobrepeso):
  - Mulher (1988): %G = 0,11077·abdômen − 0,17666·altura + 0,14354·peso + 51,03301
  - Homem (1987): %G = 0,31457·abdômen − 0,10969·peso + 10,8336
- **Tran & Weltman 1989** (mulheres acima de 51 anos): DC = 1,168297 − 0,002824·AB + 0,0000122098·AB² − 0,000733128·quadril + 0,000510477·altura − 0,000216161·idade, depois Siri.
- **Slaughter 1988** (menores de 18 anos), S = tríceps + panturrilha: menino 0,735·S + 1,0; menina 0,610·S + 5,1.
- **Só perimetria:** sem % de gordura (autoavaliação feita pela aluna, com fotos de frente, lado e costas).
- **Protocolo sugerido:** menor de 18 → Slaughter; mulher acima de 51 → Tran & Weltman; demais → Pollock 7.
- **Petroski NÃO está implementado.** Aguardando a equação exata do Luiz.

**Composição corporal (4 componentes):** massa gorda = peso × %G; massa magra = peso − gorda; massa óssea (Von Döbeln/Rocha) = 3,02 × (altura² × punho × fêmur × 400)^0,712 (altura em m e diâmetros em m); residual (Würch) = peso × 0,209 (mulher) ou 0,241 (homem); muscular = peso − gorda − óssea − residual. **IMC** = peso ÷ altura². **RCQ** = cintura ÷ quadril.

**Comparação:** diferença entre a primeira e a última avaliação selecionadas, em valor e em %. Cores pelo objetivo da aluna:
- Menor é melhor, sempre: % de gordura, massa gorda, soma das dobras, cintura, abdômen, RCQ.
- Maior é melhor, sempre: massa magra e massa muscular.
- Peso e IMC: melhor para baixo se o objetivo é perder, para cima se é ganhar, neutro na recomposição.
- Braços, antebraços, coxas, panturrilhas, quadril, ombros e tórax: maior é melhor quando o objetivo é ganhar ou recomposição.
- Objetivo lido do texto livre: emagrecer/perder/secar/definir/reduzir = perder; massa/hipertrofia/ganhar/glúteo/volume/crescer = ganhar; os dois juntos (ex.: "glúteo e definição") = recomposição.
- **Protocolos diferentes geram aviso**, e a soma das dobras só é comparada dentro do mesmo protocolo.

### 6.14 Testes aeróbicos

- **FCmáx: Tanaka = 208 − 0,7 × idade.** (Pendente: o Luiz vai decidir entre Tanaka e Shargal.)
- Cooper 12 min: VO2 = (distância − 504,9) ÷ 44,73.
- Rockport 1 milha: VO2 = 132,853 − 0,0769·peso(lb) − 0,3877·idade + 6,315·(homem = 1) − 3,2649·tempo − 0,1565·FC final.
- Bruce: homem 14,8 − 1,379t + 0,451t² − 0,012t³; mulher 4,38t − 3,9.
- Åstrand-Ryhming (bike) com fator de idade; TC6 (distância em metros); valor manual.
- Regra de leitura: comparar a aluna com ela mesma, no mesmo protocolo.

### 6.15 Olimpo (recordes) e relatório

- **Recorde por exercício:** maior carga; empate na carga, mais repetições. Séries de aquecimento não contam.
- **1RM estimado no Olimpo e no relatório:** Epley com teto de 12 repetições. No Olimpo, séries acima de 12 reps contam para a maior carga, mas não para o 1RM estimado; no relatório, contam como 12 reps. No índice de Progressão o teto é 20 (seção 6.7). As regras estão assim no código hoje.
- Troféu "novo" = recorde dos últimos 7 dias.
- **Deusa do período** (capa do relatório): a primeira regra que a aluna cumpre escolhe a deusa.
  1. **Nike** (vitória): 5 ou mais recordes e aderência de 75% ou mais.
  2. **Ártemis** (constância): 4 treinos ou mais e aderência de 90% ou mais.
  3. **Sekhmet** (força): o exercício de maior ganho subiu 8% ou mais de força estimada.
  4. **Atena** (estratégia): aderência de 70% ou mais.
  5. **Héstia** (chama acesa): todos os outros casos, inclusive período sem treino.
- **Páginas do relatório:** capa com a deusa, o mês em uma página (calendário, momentos, semana a semana), comparativo com o período anterior, carga e força, recordes e volume, frequência, mapa do corpo, bem-estar × desempenho e dor, avaliação física (20 medidas), metas e conquistas, jornada mês a mês, missão do próximo mês com a palavra do treinador e card 9:16 para os Stories (assinatura em `config.js`, campo `ASSINATURA`).
- **Relatório** (mês, ficha/mesociclo ou período livre): treinos feitos contra previstos (meta × semanas), duração e esforço médios, tonelagem (carga × reps), séries efetivas, séries por grupamento, recordes (a melhor série de cada sessão contra tudo o que veio antes), força estimada (referência antes do período contra o melhor do período; destaques acima de +0,5%), peso, última avaliação contra a anterior e médias de bem-estar dos check-ins. Exporta PDF e envia pelo WhatsApp.

### 6.16 Crônica (Estrada)

Eventos: treinos, recordes (os do mesmo dia viram uma pedra só), ficha nova, início de mesociclo, check-ins, formulários respondidos, avaliações e autoavaliações, metas criadas e batidas, fotos, plano iniciado, arquivos e trocas de exercício. **Marcos destacados:** ficha nova com vários treinos, início de mesociclo, avaliação e meta batida. Períodos de 7, 30 ou 90 dias, com camadas que se ligam e desligam.

### 6.17 Tesouro

- **MRR** = soma de (valor do plano ÷ meses do plano) das assinaturas vigentes de alunas ativas.
- **Renovações:** vigentes que vencem em até 15 dias e ainda não têm plano seguinte.
- **Taxa de renovação:** dos planos que acabaram nos últimos 90 dias, quantos têm plano seguinte (começando até 20 dias antes do fim).
- **LTV** = média do total pago por aluna. **Inadimplência** = receitas vencidas e não pagas.
- **Taxas padrão:** Pix 0%; cartão 3,99% + R$ 0,39 por parcela; boleto R$ 1,99; dinheiro 0%. Editáveis na hora de registrar.
- **Plano = pacote de entregas** que monta a agenda do ciclo sozinho: call mensal de metas (19h, todo mês), avaliação a cada X semanas (9h), lembrete de relatório no fim de cada mês (10h) e conversa de renovação X dias antes do fim (10h). Padrões: Ágora = check-in semanal e renovação 7 dias antes; Delfos = + call mensal e avaliação a cada 8 semanas; Ítaca e Olimpo = + relatório mensal, renovação 10 dias antes.
- Parcelas geradas mês a mês a partir do início; a primeira pode entrar como paga.
- Aulas presenciais do plano: usadas = compromissos do tipo "presencial" marcados como feitos dentro do período do plano.
- Máscara de moeda: os dígitos entram como centavos.

### 6.18 Chronos (camadas automáticas)

Compromissos · check-in semanal (no dia configurado) · reavaliação (última avaliação + intervalo do plano, padrão 8 semanas; se atrasada, aparece hoje) · fim de ficha · vencimento de plano · aniversários · prazos de metas · dia de revisão de cada aluna. Visões: semana, mês e fila de 14 dias. Rituais prontos (ex.: café da tarde semanal).

### 6.19 Metas com causa raiz

Tipos: carga, peso, % de gordura, medida, VO2máx e livre. Meta vencida e não batida **exige análise de causa raiz** (categoria + descrição com pelo menos 20 caracteres + ação corretiva) para ser encerrada. O banco garante isso.

### 6.20 Dossiê

Tags: lesão/desconforto (região, lado, dor EVA, mecanismo), pausa (início e fim, **tira a semana do cálculo de adesão**), psicologia e ajuste de rota. Só o treinador vê. Nenhuma nota é apagada (só arquivada) e toda edição gera versão. O Selo Ω registra em 10 segundos de qualquer tela.

### 6.21 Convite

Link `#/convite/{token}`, com token de 128 bits aleatórios em hexadecimal, **válido por 7 dias** e de **uso único**. A conta criada já recebe nome, WhatsApp e objetivo e entra ativa.

### 6.22 Cadastro sem convite (decisão do Luiz, 01/10/2026)

Quem cria conta sem convite válido fica **pausada e aguardando aprovação**: vê a tela "Cadastro recebido" e não lê exercícios, formulários nem perguntas. O treinador vê o aviso na Acrópole e libera ou recusa na lista de Alunas ("Liberar" ativa a conta e marca hoje como dia do Alistamento; "Recusar" deixa a conta nas inativas).

### 6.23 Formulário público contra robôs

No aparelho: campo-isca invisível ("Empresa") e tempo mínimo de 5 segundos desde que a página abriu; se o robô cair na isca, a tela mostra sucesso e nada é gravado. No banco: os limites do gatilho `leads_limites` (seção 5).

---

## 7. Segurança e privacidade

- A chave do `config.js` é **pública por natureza**. Quem protege os dados é o **RLS** (regras por linha no Postgres).
- A aluna só lê e escreve o que é dela: execução, check-in, respostas, própria pasta de arquivos, autoavaliação (só protocolo "perimetria") e vídeos.
- A aluna **não** edita ficha, avaliação do treinador, plano, financeiro nem os campos protegidos do perfil, e não vira treinadora.
- Biblioteca de exercícios, formulários, perguntas, aberturas e dicas: só treinador e **aluna ativa** (conta pausada ou aguardando não lê).
- Dossiê, financeiro, inscrições, convites, presets e modelos: só o treinador.
- O formulário público só **insere** em `leads`, nunca lê.
- Arquivos: bucket privado com link assinado de 1 hora.
### 7.1 LGPD (atualização 12, textos em `js/legal.js`)

> **Os textos são rascunho escrito a partir da Lei 13.709/2018 e não passaram por advogado.** O Luiz decidiu seguir assim e assume a responsabilidade pelo conteúdo e pelo cumprimento (`docs/decisoes.md`, 01/10/2026).

**Bases legais:** dados de saúde, ciclo, fotos e vídeos = consentimento específico e destacado (art. 11, I); cadastro, treino e plano = execução de contrato (art. 7º, V); pagamentos = obrigação legal (art. 7º, II); inscrição = consentimento (art. 7º, I).

**Consentimento (a aluna só usa o app depois):** três aceites separados, nunca um "aceito tudo" genérico (art. 8º, §4º):
1. Termos de Uso e Política de Privacidade (obrigatório).
2. Dados de saúde, em destaque (obrigatório: sem ele o acompanhamento não é possível, art. 9º, §3º).
3. Fotos e vídeos (opcional; sem ele, o banco recusa foto, imagem e vídeo enviados pela aluna, e o app também não deixa o treinador subir foto de corpo dela).
Menor de 18 anos (pela data de nascimento ou pela resposta): nome, parentesco e contato do responsável e a declaração dele (art. 14, §1º). Cada aceite fica em `consentimentos` com a versão (`VERSAO_TERMOS`) e a hora do servidor; ninguém edita nem apaga (só a exclusão da aluna). **Subir a versão faz todas aceitarem de novo.**

**Trava desligada até preencher `LEGAL`:** fora do modo demonstração, a tela de consentimento só aparece depois que `config.js` > `LEGAL` tiver nome e e-mail do responsável (CNPJ e CREF são opcionais) (ninguém aceita texto com campo em branco). Enquanto isso, sem consentimento registrado, o banco (com a atualização 12) recusa foto e vídeo enviados pela aluna. Se a leitura do consentimento falhar (rede, sessão), o app não abre: mostra "Tentar de novo".

**Pastas no Storage:** `<aluna>/fotos/` (fotos de corpo, imagens e vídeos da aba Arquivos, fotos da autoavaliação) e `<aluna>/videos/` (vídeos de execução) exigem o consentimento de imagem para a aluna enviar. Exames e documentos ficam em `<aluna>/`.

**Direitos da aluna (Perfil > Privacidade):** ver o que autorizou; autorizar ou retirar fotos e vídeos (retirar abre um pedido para o treinador apagar as que ele guardou e oferece apagar na hora as que ela enviou); revogar o consentimento de saúde (o app trava até ela autorizar de novo e o treinador é avisado); baixar os próprios dados em JSON; pedir acesso completo, correção ou exclusão; apagar os arquivos que ela mesma enviou (o que o treinador enviou ela pede por um pedido). Com a saúde revogada ou com o acesso pausado, a Privacidade continua acessível (baixar dados e fazer pedidos).

**O que o Luiz se compromete a cumprir (está escrito na política):**

| Compromisso | Onde o app ajuda |
|---|---|
| Responder pedidos em até **15 dias** (art. 19, II) | Aviso na Acrópole com os dias do pedido mais antigo; Atendido/Recusar na aba Dados da aluna |
| Pedido de acesso completo: enviar a cópia com o Dossiê | "Baixar cópia completa dos dados" na aba Dados |
| Excluir a pedido | "Excluir todos os dados da aluna" (digita o nome para confirmar): o banco apaga primeiro (perfil, convites, inscrição pelo WhatsApp, nome nos lançamentos), depois o app apaga a pasta dela no Storage |
| Excluir **12 meses** depois do fim do último plano (ou do cadastro, se nunca teve plano) | Etiqueta "guarda vencida" na lista de Alunas |
| Apagar inscrições não convertidas em **6 meses** | Aviso e botão "Apagar agora" em Inscrições |
| Guardar registros de pagamento por 5 anos, sem saúde | A exclusão mantém os lançamentos sem o vínculo com a aluna |
| Não usar fotos e vídeos em divulgação sem autorização separada e por escrito | Fora do app |
| Comunicar incidente de segurança à ANPD e às alunas (art. 48) | Fora do app |
| Preencher os dados do controlador | `config.js` > `LEGAL`; a Acrópole avisa enquanto estiver vazio |

**Dossiê × direito de eliminação:** durante o acompanhamento o Dossiê continua imutável (ninguém apaga pelo app). Na exclusão da aluna ele é apagado inteiro, com as versões, pela função `eliminar_aluna`.

---

## 8. Design e tom de voz

- **Tema escuro minimalista** (inspirado no HypeFit). Tokens em `:root` de `css/app.css`:
  - fundo `#1a1a1a` · superfície `#242424` · superfície 2 `#2e2e2e` · linha `#333333` · texto `#f2f2f2` · suave `#9c9c9c` · lateral `#141414`
  - roxo `#7b1fa2` · roxo forte `#8e2cc0` · roxo claro `#c38bea`
  - ok `#5fd4a0` · atenção `#f2c14e` · perigo `#ff6b81`
  - raio 16 px
- **Fontes:** Inter (texto) e Playfair Display (títulos), locais em `lib/fontes`.
- **Layout:** treinador com menu lateral recolhível (desktop) e gaveta (celular); aluna com menu inferior. KPIs grandes, painéis em 3 colunas, estados vazios que ensinam ("Como funciona" em passos).
- **Tom:** português do Brasil, segunda pessoa, feminino para a aluna ("bem-vinda", "Guerreira"), frases curtas, sem jargão para a aluna. Mensagens de WhatsApp prontas em tom próximo.
- Pendente: a especificação da ficha pediu fundo `#121212`; hoje é `#1a1a1a`.

---

## 9. Infraestrutura e configuração

### GitHub
- Repositório `lvgomesaraujo24-max/nemesis`. Branch de produção: **`main`**.
- **GitHub Pages:** Settings > Pages > Deploy from a branch > `main` > `/ (root)`. No plano grátis, o Pages exige repositório público.

### Supabase
- Projeto em **South America (São Paulo)**. URL do projeto em `config.js`.
- **Authentication > URL Configuration:** Site URL e Redirect URLs = endereço do app (sem isso, confirmação de e-mail e "esqueci a senha" não voltam para o app).
- **Authentication > Providers > Email:** "Confirm email" pode ser desligado se a aluna não precisar confirmar.
- **E-mails:** o SMTP embutido do Supabase tem limite baixo de envios por hora. Para uso real, configurar um SMTP próprio (seção 12).
- Senha do banco: **fica só com o Luiz** (guardar num gerenciador de senhas). Não está no repositório.

### Publicar uma versão nova (checklist)
1. Código no branch de trabalho → Pull Request → merge no `main`.
2. Trocar `VERSAO` em `sw.js` (`nemesis-v11` → `nemesis-v12`) para os celulares baixarem a versão nova.
3. Se houver SQL novo, rodar `supabase/atualizacao-N.sql` no SQL Editor.
4. Em 1 ou 2 minutos o GitHub Pages atualiza. No celular, fechar e abrir o app.

---

## 10. Convenções de trabalho

**Regras para o Claude Code (no próprio repositório, valem em toda sessão)**

| Arquivo | Para que serve |
|---|---|
| `CLAUDE.md` | Lido sozinho a cada sessão: stack, comandos, onde fica cada coisa, regras obrigatórias e o que é proibido |
| `docs/decisoes.md` | Cada decisão com o porquê e as alternativas descartadas. Mudou de ideia: entrada nova, sem apagar a antiga |
| `.claude/skills/nemesis-banco` | Carregada ao mexer em tabela, política, função ou `api.*`: padrões de RLS, migração idempotente, testes do SQL |
| `.claude/skills/nemesis-regras` | Carregada ao mexer em qualquer conta: aponta para a §6 e para onde cada fórmula já existe no código |
| `.claude/skills/nemesis-visual` | Carregada ao mexer em tela ou CSS: variáveis de cor, componentes existentes, vocabulário grego e tom |
| `.claude/agents/revisor.md` | Subagente que revisa a branch antes do merge, por gravidade (bloqueia / corrigir / sugestão) |
| `.claude/commands/nova-tela.md` · `mudar-banco.md` · `publicar.md` | Atalhos `/nova-tela`, `/mudar-banco`, `/publicar`: planejam e param para aprovação antes de mexer |
| `.claude/hooks/checar-js.mjs` + `.claude/settings.json` | Depois de cada edição de `.js`, confere a sintaxe e devolve o erro na hora. Bloqueia `push --force` e push direto na `main` |
| `ferramentas/checar.mjs` | `node ferramentas/checar.mjs`: sintaxe de todo JS, lista do `sw.js`, imports quebrados, RLS em toda tabela, nenhuma `service_role` |

**Fluxo de cada funcionalidade:** branch própria → `/nova-tela` ou `/mudar-banco` (plano aprovado antes do código) → `node ferramentas/checar.mjs` → teste no navegador → subagente `revisor` ou `/review` (e `/security-review` se mexeu em banco, login ou dados de saúde) → PR → o Luiz faz o merge.


**Commits**
- Em português, título curto que nomeia a entrega e as áreas (ex.: "Ficha da aluna: índices com tendência, convite com link, fotos lado a lado").
- Corpo em tópicos com o que mudou para quem usa, e a menção ao SQL novo quando houver.
- Um commit por entrega coerente. Nunca commitar arquivos temporários ou zip.

**Branches e PRs**
- Trabalho em branch próprio (hoje: `claude/compassionate-mccarthy-3py13z`), PR para o `main`, merge pelo botão do GitHub.
- PR com seções: o que entra, banco de dados (quais atualizações rodar) e testes.

**Banco**
- **Nunca editar uma atualização já publicada.** Mudança nova = `supabase/atualizacao-N.sql` com o próximo número.
- Todo SQL pode rodar mais de uma vez: `create table if not exists`, `add column if not exists`, `drop constraint if exists` antes de `add constraint`, `create or replace function`, `drop policy if exists` antes de `create policy`, `on conflict do nothing` nos dados iniciais.
- Terminar com `notify pgrst, 'reload schema';`.
- Toda tabela nova com RLS ligado e política explícita.

**Código**
- Sem etapa de build. Arquivo novo em `js/` precisa entrar na lista `ARQUIVOS` do `sw.js`.
- Cada recurso novo funciona no modo demonstração.
- Nomes em português (`carregarRadar`, `saudeDa`, `semaforo`).

**Testes**
- Servidor local: `python3 -m http.server 8765` na pasta do projeto.
- Playwright abre o app em modo demonstração (sobrescrevendo `config.js` com `window.NEMESIS_CONFIG={}`), entra como treinador e como aluna, percorre todas as rotas e abas e falha se aparecer erro no console.
- Ainda não há testes automáticos no GitHub (seção 13).

---

## 11. Web app ou mobile?

### Hoje: PWA (web app instalável)
- Funciona em qualquer celular pelo navegador. A aluna toca em "Adicionar à tela de início" e o app vira ícone, abre em tela cheia e funciona offline (service worker).
- **Vantagens:** custo zero de loja, uma base de código, atualização instantânea.
- **Limites:** no iPhone, notificações push só com o app adicionado à tela de início (iOS 16.4 ou mais novo); sem presença na App Store e na Play Store; acesso limitado a recursos nativos (saúde, widgets).

### Rota recomendada para lojas: Capacitor (mesmo código)
O Capacitor empacota o app web atual num app nativo para iOS e Android **sem reescrever**. Tudo o que foi desenhado (telas, regras, banco) continua igual.

| Etapa | O que fazer |
|---|---|
| 1. Preparar | `npm init` + `@capacitor/core` e `@capacitor/cli`; `webDir` apontando para a pasta do app; trocar caminhos para relativos (já são) |
| 2. Plataformas | `npx cap add android` e `npx cap add ios` |
| 3. Recursos nativos | Push (Firebase Cloud Messaging + APNs), câmera nativa para vídeos e fotos de avaliação, vibração no fim do descanso, links profundos (`nemesis://convite/...`) |
| 4. Login | Adicionar o esquema do app nas Redirect URLs do Supabase |
| 5. Lojas | Conta Apple Developer e Google Play Console; ícones, prints, política de privacidade, formulário de dados de saúde |
| 6. Revisão | A Apple recusa "site embrulhado" sem função nativa (diretriz 4.2). Push, câmera e offline resolvem |

- Para gerar o app de iPhone é preciso um Mac ou um serviço de build na nuvem (ex.: Codemagic, Ionic Appflow).
- O PWA continua no ar em paralelo: quem não quiser baixar da loja usa o link.

### Alternativa (só se o Capacitor não bastar): app nativo reescrito
React Native (Expo) ou Flutter. Custa uma reescrita das telas (as regras da seção 6 e o banco se mantêm). Só vale se surgir necessidade forte de desempenho ou de integração profunda (Apple Saúde, relógio).

---

## 12. Custos

> Valores de referência de 2025/2026, sem impostos, sujeitos a mudança. Conferir nos sites antes de contratar. Dólar a converter no dia.

### Fase atual (PWA, até ~50 alunas)

| Item | Custo | Observação |
|---|---|---|
| GitHub (repositório + Pages) | **US$ 0** | Pages grátis exige repositório público; privado com Pages = GitHub Pro (~US$ 4/mês) |
| Supabase Free | **US$ 0** | ~500 MB de banco, ~1 GB de arquivos, ~50 mil usuários/mês. **Pausa o projeto após 7 dias sem uso** e não tem backup automático |
| Domínio próprio (opcional, ex.: nemesis.com.br) | ~R$ 40/ano | Registro.br; aponta para o GitHub Pages |
| SMTP para e-mails (confirmação, senha) | US$ 0 a ~US$ 20/mês | Ex.: Resend ou Brevo têm plano grátis para poucos milhares de e-mails por mês |
| WhatsApp | R$ 0 | Hoje são links `wa.me` (a mensagem sai do seu WhatsApp) |
| **Total** | **~R$ 0 a R$ 150/mês** | |

### Fase de produção (recomendado ao passar de ~20 alunas pagantes)

| Item | Custo | Por quê |
|---|---|---|
| Supabase Pro | **~US$ 25/mês** | Não pausa, backup diário, ~8 GB de banco e ~100 GB de arquivos. Os **vídeos de execução** são o que mais consome espaço |
| Armazenamento extra de vídeo | variável | Estimativa: 100 alunas × 4 vídeos/mês × 20 MB ≈ 8 GB por mês. Definir uma regra de guarda (ex.: apagar vídeos corrigidos há mais de 90 dias) |
| Domínio + SMTP | ~R$ 40/ano + até ~US$ 20/mês | |
| **Total** | **~R$ 150 a R$ 300/mês** | |

### Fase lojas (Capacitor)

| Item | Custo |
|---|---|
| Apple Developer Program | **US$ 99/ano** |
| Google Play Console | **US$ 25 uma vez** |
| Build de iOS na nuvem (sem Mac próprio) | US$ 0 no plano grátis limitado de serviços como Codemagic; planos pagos a partir de ~US$ 50/mês |
| Push (Firebase Cloud Messaging) | US$ 0 |
| **Total inicial** | **~US$ 125 + ~US$ 99/ano** |

### Futuro (opcional)

| Item | Custo |
|---|---|
| Cobrança automática (Pix/cartão por gateway: Asaas, Mercado Pago, Stripe) | taxa por transação, conferir no contrato |
| WhatsApp Business API (mensagens automáticas) | cobrança por conversa pela Meta, mais a plataforma intermediária |
| IA no app (ex.: resumo do Oráculo, sugestão de ajuste de ficha) | custo por uso da API do modelo |

---

## 13. Prazos (roadmap)

> Estimativas com o ritmo atual (desenvolvimento com IA e aprovação do Luiz por etapa).

| Fase | Prazo | Entregas |
|---|---|---|
| **0. Colocar no ar o que já foi feito** | 1 a 3 dias | Merge do PR #2; rodar `atualizacao-7` a `-12`, em ordem; preencher `LEGAL` no `config.js`; conferir Auth URLs; configurar SMTP próprio; testar com 2 ou 3 alunas reais |
| **1. Piloto** | semanas 1 e 2 | Uso real com a turma; correções; responder as decisões pendentes (seção 15) |
| **2. Robustez** | semanas 3 a 6 | Supabase Pro com backup; domínio próprio; LGPD (consentimento no Alistamento, política de privacidade, exclusão de dados); testes automáticos no GitHub Actions; regra de guarda dos vídeos |
| **3. Lojas (Capacitor)** | semanas 6 a 10 | Empacotar; push; câmera; links profundos; contas nas lojas; enviar para revisão (Apple leva de dias a 2 semanas) |
| **4. Automação e receita** | após a semana 10 | Cobrança automática; lembretes automáticos (WhatsApp/push); Petroski e outros protocolos; recursos de IA |

---

## 14. Backup e recuperação (se o computador der problema)

O computador não guarda nada essencial. Tudo está na nuvem:

1. **Código:** GitHub. Para baixar: repositório > Code > Download ZIP, ou `git clone https://github.com/lvgomesaraujo24-max/nemesis.git`.
2. **Dados:** Supabase. No plano Pro há backup diário automático. Para ter uma cópia própria:
   - Supabase CLI: `supabase db dump --db-url "<connection string>" -f backup.sql` (a connection string está em Project Settings > Database), ou
   - Table Editor > cada tabela > Export CSV.
3. **Arquivos e vídeos:** Storage > bucket `arquivos` (download pelo painel ou pela CLI).
4. **Acessos:** e-mail do GitHub, e-mail do Supabase, senha do banco. **Guardar num gerenciador de senhas**, fora do computador.
5. **Este documento:** está em `docs/CEREBRO-NEMESIS.md` no repositório, então também fica salvo no GitHub.

**Reconstruir do zero em outro lugar:** novo projeto Supabase → rodar `schema.sql` e as atualizações 2 a 12 → importar o backup → trocar URL e chave no `config.js` → publicar no GitHub Pages → ajustar as Auth URLs.

---

## 15. Decisões pendentes (perguntar ao Luiz)

1. **Petroski:** equação exata (feminina e masculina) para implementar.
2. **FCmáx:** manter Tanaka (208 − 0,7 × idade) ou trocar por Shargal.
3. **Semáforo:** confirmar a soma (6 − sono) + (6 − energia) + estresse + dor.
4. ~~Cadastro~~: decidido em 01/10/2026, sem convite fica aguardando aprovação (seção 6.22).
5. **Fundo:** escurecer de `#1a1a1a` para `#121212`.
6. **Crônica:** mostrar também para a aluna ou manter só com o treinador.
7. **Formulários:** recorrência quinzenal e mensal (hoje só semanal); pergunta com envio de imagem; link público genérico para qualquer formulário.
8. **Guarda de vídeos:** por quanto tempo manter vídeos já corrigidos.

---

## 15b. Auditoria técnica externa (AF Tecnologia, 30/09/2026)

| Achado | Situação |
|---|---|
| Produção na v6, v9 em branches não publicados | Verdadeiro. PR #2 consolidado com o PR #3; falta o merge e rodar as atualizações 7 a 11 |
| Duas "atualização-7" conflitantes | Verdadeiro. Resolvido: a do relatório virou `atualizacao-10.sql` |
| Banco sem backup e com pausa (Supabase Free) | Verdadeiro. Depende de contratar o Supabase Pro |
| Cadastro aberto lê a metodologia | Verdadeiro. Resolvido na `atualizacao-11.sql` |
| Aluna edita a própria meta e nível | **Falso**: meta protegida desde a atualização 2 e nível desde a 6 |
| Formulário público sem anti-robô | Verdadeiro. Resolvido (isca, tempo mínimo e limites no banco) |
| E-mails limitados | Verdadeiro. Depende de configurar SMTP próprio |
| "Primeira conta vira treinador" | Verdadeiro, risco só numa reconstrução do banco. Não alterado |
| Sem monitoramento, publicação manual, código público | Verdadeiros. Não alterados |
| Testes automáticos não estão no repositório | Verdadeiro. Os testes rodam no ambiente de desenvolvimento, fora do repositório |
| LGPD (consentimento, privacidade, exclusão, menores, Dossiê imutável × eliminação) | Verdadeiros. Implementado na atualização 12 (seção 7.1); textos sem validação de advogado, por decisão do Luiz |

**Achado da própria correção:** o cadastro pelo convite falhava no banco (o convite apontava para um perfil que ainda não existia). Corrigido na `atualizacao-9.sql` e na `atualizacao-11.sql`, antes de ir para produção.

## 16. Histórico

| Data | Marco |
|---|---|
| Início | Base: ficha, execução, check-in, avaliação, inscrições, financeiro (`schema.sql`) |
| — | Atualizações 2 a 4: formulários vivos, Dossiê, Acrópole, ciclo, metas com causa raiz, estresse 0–10 |
| — | Relatório de evolução; painel minimalista estilo HypeFit; Forja (prescrição, tempo, volume, mapa do corpo) |
| — | Modelos, presets, mesociclo com progressão; Tesouro, Chronos, biblioteca nível 3, Radar (PR #1, merge) |
| 30/09/2026 | Ficha 360; Arena, Prova, Oráculo com semáforo, Olimpo, Crônica, Templo; índices 0–100 com tendência; convite com link; fotos lado a lado (PR #2, atualizações 8 e 9) |
| 30/09/2026 | Relatório com deusa, missão e card de Stories (PR #3, outra sessão) |
| 01/10/2026 | LGPD: consentimento em três partes, menores com responsável, Privacidade da aluna, exclusão completa, prazos de guarda (atualização 12) |
| 01/10/2026 | Auditoria técnica externa; PR #3 incorporado ao PR #2 (atualização 10); cadastro com aprovação e anti-robô (atualização 11); correção do convite |

**Números do código (01/10/2026, PR #2):** 28 arquivos JS (~7.000 linhas), CSS ~1.230 linhas, 13 arquivos SQL (~2.000 linhas), 42 tabelas.
