---
name: nemesis-visual
description: Use ao criar ou mudar qualquer tela, componente, texto de interface ou CSS do Nemesis (js/coach.js, js/aluna.js, js/*.js com html`...`, css/app.css), para manter o tema escuro com roxo, os componentes existentes e o vocabulário grego.
---

# Padrão visual do Nemesis

## Cores: sempre pelas variáveis de `css/app.css`
| Variável | Uso |
|---|---|
| `--fundo` #1a1a1a, `--sup` #242424, `--sup2` #2e2e2e, `--lateral` | fundo, cartões, campos, menu |
| `--linha` #333 | bordas |
| `--texto` #f2f2f2, `--suave` #9c9c9c | texto principal e secundário |
| `--roxo` #7b1fa2, `--roxo-forte`, `--roxo-claro` #c38bea, `--roxo-fundo` | marca: botão principal, links, abas ativas, destaque |
| `--ok` verde, `--atencao` amarelo, `--perigo` vermelho | estados (bom/médio/ruim, semáforo) |
| `--ouro`, `--lacre` | façanhas (ouro) e alerta crítico (lacre) na Acrópole |

Não escrever hexadecimal novo em tela ou CSS. Se faltar cor, criar variável em `:root` e justificar.
Fontes: `--sans` (Inter) para tudo; `--serif` (Playfair Display) só para marca, logo e títulos cerimoniais.
Raio `--raio` (16px) nos cartões. Tema só escuro (`color-scheme: dark`).

## Componentes e classes que já existem (reusar antes de criar)
- Estrutura: `.tela`, `.topo`, `.conteudo`, `.pilha` (coluna com espaço), `.grade2`, `.grade3`, `.titulo-acoes`, `.acoes`
- Cartões: `.card`, `.card.vazio`, `.card.alerta`, `.card.aviso`, `.card.pendencia`, `.card-topo`
- Botões: `.btn`, `.btn.primario` (uma ação principal por tela), `.btn.grande`, `.btn.mini`, `.btn.fantasma`, `.btn-texto`, `.btn-texto.perigo`
- Etiquetas: `.tag`, `.tag.roxo`, `.tag.atencao`, `.tag.perigo`
- Números: `.stats` + `.stat` (`<b>` valor, `<span>` rótulo), `.destaque`, `.valor`
- Texto: `.suave`, `.nota`, `.dica`
- De `js/util.js`: `Modal`, `Campo` (rótulo + dica), `Abas`, `Escala`, `Estado`, `Vazio`, `Linha`, `Barras`, `toast`
- Ícones: `Icone` de `js/icones.js`. Mapa do corpo: `js/corpo.js`.

Layout mobile primeiro (a aluna usa no celular, na academia): toque confortável, `.btn.grande` em formulário, `inputmode="decimal"` em número. Treinador também usa no computador (menu lateral a partir de 900px).

## Vocabulário grego (usar sempre estes nomes)
Acrópole (início do treinador), Oráculo (check-in semanal), Alistamento (formulário de entrada), Radar da Guerreira (saúde da carteira), Forja (fichas e modelos), Tesouro (financeiro), Chronos (agenda), Dossiê (notas do treinador), Olimpo (recordes), Façanhas (conquistas). Planos: Ágora, Delfos, Ítaca, Olimpo. Nos textos, a pessoa é "aluna"; "Guerreira" só aparece no nome do Radar.
Não inventar nome grego novo para uma função sem o treinador aprovar. Botões e mensagens comuns ficam em português direto ("Salvar", "Registrar teste", "Apagar").

## Textos
- Português do Brasil, frases curtas, 2ª pessoa com a aluna ("Seu treino de hoje"), sem jargão sem explicação.
- Datas com `dataBR`/`dataCurta`, números com `num`, dinheiro com `brl`. Vazio sem dado: `·`.
- Estado vazio sempre com `Vazio` e uma frase do que fazer.
- Erro para o usuário via `toast(msg, 'erro')`, em português.

## Antes de terminar
Abrir a tela no navegador (modo demonstração) em largura de celular (~390px) e de computador.
