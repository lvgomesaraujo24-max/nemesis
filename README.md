# Nemesis

App de consultoria de treino: o treinador monta a ficha, acompanha evolução, check-ins, avaliações, inscrições e financeiro. A aluna treina pelo celular, registra as cargas e manda o check-in da semana.

Funciona como app instalável no celular (PWA). Não precisa de loja de aplicativos.

## O que tem

**Treinador**
- Painel com o que precisa de atenção: check-ins sem resposta, planos vencendo, parcelas em atraso, alunas sem treinar há 7 dias, inscrições novas
- Alunas: ficha de treino (treinos A, B, C..., séries de aquecimento, reps, descanso, técnica, observação, treino opcional), copiar ficha de outra aluna, evolução, check-ins, avaliações, anamnese, financeiro e dados
- Avaliação física com 7 dobras (Jackson & Pollock + Siri), circunferências e comparação com a anterior
- Check-ins: responder pelo app ou mandar no WhatsApp, lembrete para quem não enviou
- Inscrições do formulário da bio, com status (novo, contatado, fechado, perdido) e botão de WhatsApp
- Financeiro: planos (Ágora, Delfos, Ítaca, Olimpo), parcelas geradas mês a mês, despesas, saldo do mês, atrasos e renovações
- Biblioteca de exercícios com link de vídeo e instruções

**Aluna**
- Treinos da semana, com o próximo treino destacado
- Execução: carga e reps por série, "última vez" de cada exercício, cronômetro de descanso, aviso de recorde
- Evolução: gráfico de carga por exercício, recordes, peso, % de gordura, tonelagem acumulada
- Check-in semanal (peso, sono, energia, estresse, fome, dor, alimentação) e a sua resposta
- Anamnese com PAR-Q no primeiro acesso

**Formulário de inscrição** (`form.html`): o link para colocar na bio. Cai direto na aba Inscrições.

## Como publicar (uma vez só, uns 20 minutos)

### 1. Banco de dados (Supabase)
1. Entre em supabase.com e clique em **Start your project**. Dá para entrar com a sua conta do GitHub.
2. **New project**. Nome: `nemesis`. Crie uma senha forte para o banco e guarde. Região: **South America (São Paulo)**.
3. Quando o projeto terminar de criar, vá em **SQL Editor > New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Tem que aparecer "Success".
4. Vá em **Project Settings > API** e copie o **Project URL** e a chave **anon public**.
5. Abra o arquivo `config.js` e cole os dois valores entre as aspas.

### 2. Código e endereço do app (GitHub Pages)
1. No GitHub, crie um repositório novo chamado `nemesis` (pode ser privado só se você tiver GitHub Pro; no plano grátis, o Pages exige repositório público).
2. Envie todos os arquivos desta pasta (arraste para **Add file > Upload files**).
3. Em **Settings > Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`, e salve.
4. Em 1 ou 2 minutos o app fica no ar em `https://SEU-USUARIO.github.io/nemesis/`.

### 3. Ajustes finais no Supabase
1. Em **Authentication > URL Configuration**, coloque o endereço do app em **Site URL** e também em **Redirect URLs**. Sem isso, o link de confirmação de e-mail e o de "esqueci a senha" não voltam para o app.
2. **Crie a sua conta primeiro.** A primeira conta criada no app vira TREINADOR. Todas as outras viram aluna.
3. Opcional: em **Authentication > Providers > Email**, desligue **Confirm email** se não quiser que a aluna tenha que confirmar o e-mail antes de entrar.

Pronto. Mande o link para as alunas pelo botão **Convidar aluna**.

## Modo demonstração
Com o `config.js` vazio, o app abre com dados de exemplo guardados só no navegador, com botões para entrar como treinador ou como aluna. Serve para testar antes de ligar o banco.

## Como a segurança funciona
A chave do `config.js` é pública por natureza. Quem protege os dados são as regras do banco (RLS) no `schema.sql`:
- cada aluna só vê e registra o que é dela
- aluna não edita ficha, avaliação nem plano, e não consegue virar treinadora
- financeiro e inscrições só o treinador vê
- o formulário público só consegue **enviar** inscrição, nunca ler

## Publicar uma versão nova
Troque os arquivos no GitHub e mude o número em `sw.js` (`nemesis-v1` para `nemesis-v2`), para os celulares buscarem a versão nova.

## Estrutura
```
index.html        app (treinador e aluna)
form.html         formulário de inscrição
config.js         endereço e chave do Supabase
supabase/schema.sql  banco completo (tabelas, segurança, planos, exercícios)
js/app.js         entrada, login e rotas
js/coach.js       telas do treinador
js/aluna.js       telas da aluna
js/comum.js       evolução, anamnese e avaliação (usadas pelos dois lados)
js/api.js         conexão com o Supabase
js/demo.js        modo demonstração
js/util.js        datas, números, gráficos, componentes
css/              visual
lib/              Preact, Supabase e fontes (tudo local, abre sem internet)
```
Sem etapa de build: o que está no repositório é exatamente o que roda.
