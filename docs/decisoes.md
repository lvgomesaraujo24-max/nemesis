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

## 2026-10-01 · LGPD sem validação de advogado
**Decisão**: os textos de Política de Privacidade, Termos de Uso e consentimentos (`js/legal.js`) foram escritos a partir da Lei 13.709/2018 e publicados sem revisão de advogado.
**Por quê**: decisão do Luiz, ciente de que sem validação jurídica ele assume a responsabilidade pelo conteúdo e se obriga a cumprir tudo o que os textos prometem (CEREBRO §7.1, tabela de compromissos).
**Consequências**: os prazos prometidos (15 dias para pedidos, 12 meses de guarda após o fim do plano, 6 meses para inscrições) passam a ser obrigação. O app avisa, mas quem executa é o treinador. Uma revisão jurídica futura pode mudar os textos; nesse caso, subir `VERSAO_TERMOS`.

## 2026-10-01 · Consentimento em três partes, não "aceito os termos"
**Decisão**: aceites separados para termos, dados de saúde (destacado, obrigatório) e fotos/vídeos (opcional), registrados sem edição com a hora do servidor.
**Por quê**: para dado sensível a LGPD exige consentimento específico e destacado (art. 11, I) e anula autorizações genéricas (art. 8º, §4º). O registro prova o consentimento (art. 8º, §2º).
**Alternativas descartadas**: uma caixa única "li e aceito os termos" (inválida para dado de saúde).

## 2026-10-01 · Menores de 18 com o responsável
**Decisão**: se a data de nascimento indicar menos de 18 anos ou a aluna disser que é menor, o aceite exige nome, parentesco e contato do responsável e a declaração dele.
**Por quê**: o app prevê avaliar menores (protocolo Slaughter) e a LGPD pede o consentimento de um dos pais ou do responsável (art. 14, §1º). Exigir para todo menor de 18, e não só para crianças, é o caminho mais seguro.

## 2026-10-01 · Dossiê imutável, mas eliminável
**Decisão**: o Dossiê segue sem edição destrutiva durante o acompanhamento, mas é apagado inteiro (com as versões) quando a aluna é excluída.
**Por quê**: a imutabilidade protege o histórico clínico; o direito de eliminação (art. 18, VI) prevalece quando a aluna pede ou o prazo de guarda vence.

## 2026-10-01 · Trava de consentimento só com o responsável preenchido
**Decisão**: fora do modo demonstração, a tela de consentimento fica desligada enquanto `config.js` > `LEGAL` não tiver nome e e-mail do responsável (CNPJ e CREF são opcionais) pelos dados. Se a leitura do consentimento falhar, o app não abre.
**Por quê**: um aceite dado sobre um texto com "[nome do responsável]" não identifica o controlador (art. 9º, III) e não vale como prova. E uma trava que abre o app quando a rede falha não protege nada.
**Consequências**: até preencher `LEGAL`, a aluna não consegue autorizar fotos e vídeos, e o banco recusa os envios dela. A Acrópole avisa o treinador.

## 2026-10-01 · Fotos e vídeos numa pasta própria do Storage
**Decisão**: fotos de corpo, imagens e vídeos enviados ficam em `<aluna>/fotos/` e vídeos de execução em `<aluna>/videos/`; a regra do Storage exige o consentimento de imagem para a aluna gravar nessas pastas.
**Por quê**: sem a pasta separada, a aluna (ou alguém com a sessão dela) podia gravar uma foto no Storage mesmo sem autorização, só pulando o registro na tabela.

## 2026-10-01 · Arena um exercício por vez (estrutura do treino.io)
**Decisão**: a execução do treino mostra um exercício por vez, no formato que as alunas já conhecem do treino.io (pedido do Luiz com prints), mas com as cores e o vocabulário do Nemesis. A tela antiga (lista rolando com todos os exercícios) saiu.
**Por quê**: na academia, com o celular na mão, a aluna precisa de campos grandes, um botão de concluir e o descanso automático na mesma tela.
**Fora por enquanto**: o feed "Comunidade" com fotos de outras alunas. Depende de consentimento de imagem para divulgação (hoje a autorização de imagem é só para o treinador ver) e de moderação.

## 2026-10-01 · Série preparatória gravada como aquecimento
**Decisão**: a preparatória é prescrita à parte (`treino_itens.preparatorias`), mas cada série feita é gravada com `aquecimento = true` e `preparatoria = true`. No tempo estimado ela conta como série de aquecimento.
**Por quê**: assim volume, recordes, tonelagem, engajamento e relatório continuam iguais, sem mudar nenhuma fórmula da §6: preparatória não é série de trabalho.

## 2026-10-01 · Meta de água sem cálculo automático
**Decisão**: a meta de água é digitada (pela aluna, combinada com o treinador ou a nutricionista); o app não calcula meta por peso.
**Por quê**: regra do projeto de não inventar fórmula sem pedido explícito e referência.

## 2026-10-01 · Política cita água e observações sem nova versão dos termos
**Decisão**: a seção 2 da Política de Privacidade passou a citar a água do dia e as observações por exercício, sem subir `VERSAO_TERMOS`.
**Por quê**: são dados comuns (não sensíveis), opcionais e usados na mesma finalidade já aceita (acompanhamento do treino). Pedir novo aceite a todas por isso seria desproporcional. Se um dia entrar dado sensível novo ou finalidade nova, sobe a versão.

## 2026-10-01 · Metas da semana dentro do Oráculo vivo
**Decisão**: as metas da semana são duas perguntas do próprio Oráculo (atualização 15), e não uma tabela nova. A semana seguinte usa o contexto `ctx.anterior` para lembrar a meta e perguntar como foi.
**Por quê**: pedido de quem testou o app ("no Oráculo faltou as metas para a semana"). Reaproveita o motor de formulários: o treinador edita o texto ou tira as perguntas sem mexer em código.
**Consequências**: o Oráculo fixo do modo demonstração (sem formulário vivo) não tem as metas.

## 2026-10-01 · Cores das linhas de série
**Decisão**: o gráfico de progressão por série usa quatro cores novas em `:root` (`--serie-1` a `--serie-4`: azul, laranja, verde-água e amarelo).
**Por quê**: o roxo da marca não serve para separar várias linhas. As quatro cores passaram pelo validador de paleta no fundo escuro do app: diferença para daltonismo ΔE ≥ 8 e contraste ≥ 3:1. Os tons de estado (`--ok`, `--atencao`, `--perigo`) continuam reservados para estado.

## 2026-10-01 · E-mails pelo Resend, com a marca do Nemesis
**Decisão**: os e-mails de login (confirmação, nova senha, troca de e-mail, código) saem pelo Resend via SMTP do Supabase, com modelos próprios em `supabase/emails/` no visual do app (escuro, roxo, logo, tom da §8).
**Por quê**: o SMTP embutido do Supabase manda poucos e-mails por hora e é só para teste; o Resend tem plano grátis para alguns milhares de e-mails por mês e deixa o remetente com o domínio da consultoria.
**Consequências**: precisa de um domínio próprio verificado no Resend. A chave da API fica só no painel do Supabase. A Política de Privacidade passou a citar o Resend pelo nome entre os operadores (antes dizia "o serviço que envia os e-mails"), sem nova versão dos termos.

