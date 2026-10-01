# Decisões do projeto

Cada decisão com o porquê. Para mudar uma delas, escreva uma entrada nova no fim (não apague a antiga) dizendo o que mudou e por quê.

Modelo:
```
## AAAA-MM-DD · Título
**Decisão**: ...
**Por quê**: ...
**Alternativas descartadas**: X (motivo), Y (motivo)
**Consequências**: o que fica mais fácil, o que fica mais difícil
```

---

## 2026-09 · Front-end sem build (Preact + htm em módulos ES)
**Decisão**: o app é HTML + JavaScript puro em módulos, com Preact e htm guardados em `lib/`. Sem npm, sem bundler.
**Por quê**: o treinador mantém o app sozinho e está aprendendo. Sem build, o que está no GitHub é o que roda: nada quebra por versão de pacote, e publicar é só subir arquivo. Preact dá componentes e estado em um arquivo de ~13 KB.
**Alternativas descartadas**: Next.js (exige build, servidor ou export estático e muita dependência para o tamanho do app); React Native e Flutter (loja de aplicativos, duas bases de código, curva de aprendizado maior); JavaScript sem framework (as telas ficariam difíceis de manter).
**Consequências**: não há TypeScript nem JSX; templates são `html\`...\``. Qualquer biblioteca nova precisa ser um arquivo único copiado para `lib/`.

## 2026-09 · Supabase como banco, login e regras de acesso
**Decisão**: Supabase (Postgres) com RLS em todas as tabelas; o front usa só a chave pública.
**Por quê**: não precisa de servidor próprio; a segurança fica no banco, onde não dá para burlar pelo navegador. Região São Paulo.
**Alternativas descartadas**: Firebase (regras de acesso menos expressivas para "aluna vê o dela, treinador vê tudo" e consultas de relatório); backend próprio (custo e manutenção).
**Consequências**: toda regra de acesso é SQL. Tabela sem RLS é vazamento de dado de saúde.

## 2026-09 · Mudanças de banco em `supabase/atualizacao-N.sql`, rodadas à mão
**Decisão**: cada mudança vira um arquivo numerado e idempotente, rodado no SQL Editor.
**Por quê**: não exige instalar a CLI do Supabase nem Docker; funciona direto do navegador. Idempotência deixa rodar de novo sem medo.
**Alternativas descartadas**: `supabase/migrations` com a CLI (mais robusto e com histórico automático, mas exige terminal, Docker e login da CLI).
**Consequências**: ninguém registra automaticamente o que já foi rodado; o README diz qual rodar. Se o projeto crescer, migrar para a CLI.

## 2026-09 · PWA no GitHub Pages
**Decisão**: app instalável pelo navegador, hospedado no GitHub Pages, com service worker de rede primeiro.
**Por quê**: sem loja, sem custo, atualização imediata. Funciona offline na academia.
**Consequências**: a cada publicação é preciso subir `VERSAO` no `sw.js`; arquivo fora de `ARQUIVOS` não abre offline.

## 2026-09 · Modo demonstração
**Decisão**: com `config.js` vazio, `js/demo.js` imita a `api` com dados no navegador.
**Por quê**: testar telas sem mexer no banco real e mostrar o app para interessadas.
**Consequências**: tela nova precisa funcionar (ou mostrar `Vazio`) no modo demonstração.

## 2026-09 · Regras dos formulários rodam no aparelho e no banco
**Decisão**: `js/motor.js` e `public.avaliar_regra` implementam o mesmo formato de regra.
**Por quê**: dica condicional aparece na hora, sem custo de servidor; o banco confere de novo ao gravar.
**Consequências**: mudar um operador exige mudar os dois lados.

## 2026-09-30 · Documento-cérebro como fonte única
**Decisão**: `docs/CEREBRO-NEMESIS.md` reúne arquitetura, rotas, banco, regras de cálculo, convenções, custos e roadmap. `CLAUDE.md`, as skills e o revisor apontam para as seções dele.
**Por quê**: um arquivo só pode ser colado em outra IA e serve de backup do conhecimento do projeto. Dois documentos sobre o mesmo assunto acabam discordando.
**Consequências**: toda mudança de rota, tabela ou fórmula atualiza o cérebro no mesmo commit.

## 2026-09-30 · Índices de Engajamento e Progressão de 0 a 100
**Decisão**: engajamento = 60% treinos + 25% check-ins + 15% formulários no prazo (peso redistribuído quando um não se aplica); progressão = mediana da variação do 1RM estimado em escala linear (+5% = 100, 0% = 50, −5% = 0, mínimo de 3 exercícios). Ambos com tendência contra as 4 semanas anteriores.
**Por quê**: especificação da ficha da aluna escrita pelo Luiz, a partir do HypeFit.
**Alternativas descartadas**: a fórmula anterior (70% aderência + 30% check-ins; média das variações), que não considerava formulários nem tinha escala comparável.

## 2026-09-30 · Semáforo do check-in por soma
**Decisão**: `(6 − sono) + (6 − energia) + estresse + dor`, escalas de 1 a 5; 4–9 verde, 10–14 amarelo, 15–20 vermelho.
**Por quê**: documento de escopo do Luiz. Fica separado dos sinais clínicos da Acrópole (dor e recuperação).
**Consequências**: a soma exata ainda aguarda confirmação do Luiz.

## 2026-10-01 · Migração do relatório renumerada para a atualização 10
**Decisão**: o PR #3 criou uma "atualização 7" (relatório) em paralelo à atualização 7 da Ficha 360. O PR #3 foi incorporado ao PR #2 e a migração dele virou `atualizacao-10.sql`.
**Por quê**: a auditoria técnica apontou que duas migrações com o mesmo número deixam o histórico do banco ambíguo.
**Consequências**: trabalho em paralelo em branches diferentes precisa combinar o número da próxima atualização antes de escrever SQL.

## 2026-10-01 · Cadastro sem convite fica aguardando aprovação
**Decisão**: conta criada sem convite válido nasce pausada (`aguardando = true`) e não lê exercícios, formulários, perguntas nem dicas até o treinador liberar.
**Por quê**: a auditoria mostrou que qualquer pessoa com o link criava conta e lia a metodologia. O Luiz escolheu aprovação em vez de bloquear o cadastro.
**Alternativas descartadas**: cadastro só com convite (quem perde o link fica sem acesso); manter aberto.

## 2026-10-01 · Formulário público com limites contra robôs
**Decisão**: campo-isca e tempo mínimo de 5 s no aparelho; no banco, até 3 inscrições por WhatsApp por hora e 20 no total a cada 10 minutos.
**Por quê**: a hospedagem (GitHub Pages) não tem firewall e o formulário aceita envio anônimo.
**Alternativas descartadas**: captcha de terceiros (dependência externa e atrito para a aluna).
