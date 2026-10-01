---
name: nemesis-regras
description: Use ao mexer em qualquer conta ou regra de treino e acompanhamento do Nemesis: semáforo do check-in (Oráculo), sinais de dor e recuperação, ciclo menstrual, FCmáx (Tanaka), testes aeróbicos (Cooper, Rockport, Bruce, Åstrand, TC6), % de gordura (Pollock 7 e 3, Weltman, Tran & Weltman, Slaughter, Siri) e composição corporal, força estimada (Epley), recordes, volume semanal por músculo, tempo estimado do treino, mesociclo e deload, RIR/RPE, engajamento, progressão e risco de evasão, deusa do relatório, métricas do Tesouro.
---

# Regras de negócio do Nemesis

A fonte da verdade é a **§6 do `docs/CEREBRO-NEMESIS.md`** (contrato). Leia a subseção do assunto antes de escrever código. Nenhum número, peso ou limiar muda sem pedido explícito do Luiz.

## Regras
1. **Não inventar.** Fórmula, limiar, peso de pontuação ou faixa que não está no documento: pare e pergunte ao treinador, sugerindo a referência científica (autor, ano). Não "chutar" um valor razoável.
2. **Uma implementação por fórmula.** Antes de escrever, procure se ela já existe:
   - `percentualGordura`, `percentualJP7`, `percentualJP3`, `composicao`, `protocoloSugerido`, `idadeEm`, `semaforo`, `umRM`, `recordes`, `tonelagem` em `js/util.js`
   - `e1rm` do relatório (Epley, reps limitadas a 12) em `js/relatorio.js`; `e1rm` do índice de Progressão (séries acima de 20 reps não entram) em `js/radar.js`
   - `deusaDe` (deusa do período) em `js/relatorio-paginas.js`
   - `direcaoObjetivo` (cores da comparação de avaliações) em `js/comum.js`
   - `volumePorMusculo`, `volumePorGrupo`, `faixaGrupo`, `nivelVolume`, `tempoTreino` em `js/musculos.js`
   - `FC_TANAKA`, `PROTOCOLOS` (testes aeróbicos), `PROGRESSOES` e `semanaDoMeso` (mesociclo) em `js/extras.js`
   - `saudeDa` (engajamento 0–100, progressão 0–100, tendências, risco de evasão) em `js/radar.js`
   - `metricas`, `TAXAS`, `agendaDoCiclo` em `js/tesouro.js`
   - `fase_ciclo` e as funções `cc_*` da Acrópole no banco (`supabase/atualizacao-2.sql`, `-3.sql`, `-4.sql`)
   - `RIR` (Zourdos 2016) e `avaliar` (regras dos formulários) em `js/motor.js`
   - sinais do Oráculo em `cc_sinais_clinicos` (`supabase/atualizacao-4.sql`)
   Importe a existente; não copie a fórmula para outro arquivo.
3. **Código e documento juntos.** Mudou uma conta (com o ok do Luiz), atualize a §6 do `docs/CEREBRO-NEMESIS.md` no mesmo commit e registre o motivo em `docs/decisoes.md`.
4. **Dado faltando não vira zero.** Sem idade, sem dobra, sem FC: devolva `null` e mostre `·` com uma frase dizendo o que cadastrar (como `TestesAluna` faz com a data de nascimento).
5. **Unidades explícitas**: kg, cm, mm, bpm, ml/kg/min, minutos. Uma casa decimal em resultados fisiológicos.
6. **Mesma aluna, mesmo protocolo.** Comparações de teste aeróbico só entre testes do mesmo protocolo.

## Pontos de atenção
- Existem duas coisas diferentes, não misture: o **semáforo do check-in** (soma `(6 − sono) + (6 − energia) + estresse + dor`, 4–9 verde, 10–14 amarelo, 15–20 vermelho, §6.5) e os **sinais clínicos da Acrópole** (dor e recuperação, crítico/atenção, §6.10). A soma do semáforo ainda aguarda confirmação do Luiz (§15).
- O estresse do Oráculo vai de 0 a 10 (desde a atualização 4); a tabela antiga `checkins` usa 1 a 5. Não misturar escalas.
- Sexo padrão é `F`; fórmulas com versão masculina e feminina usam `aluna.sexo`.
- Série de aquecimento não entra em tonelagem, recorde, volume nem e1RM.
