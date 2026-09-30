---
name: nemesis-regras
description: Use ao mexer em qualquer conta ou regra de treino e acompanhamento do Nemesis: pontuação e semáforo do check-in (Oráculo), sinais de dor e recuperação, FCmáx (Tanaka), testes aeróbicos (Cooper, Rockport, Bruce, Åstrand, TC6), % de gordura (Jackson & Pollock + Siri), força estimada (Epley), volume semanal por músculo, tempo estimado do treino, RIR/RPE, score e risco de evasão do Radar.
---

# Regras de negócio do Nemesis

A fonte da verdade é `docs/regras-de-negocio.md`. Leia a seção do assunto antes de escrever código.

## Regras
1. **Não inventar.** Fórmula, limiar, peso de pontuação ou faixa que não está no documento: pare e pergunte ao treinador, sugerindo a referência científica (autor, ano). Não "chutar" um valor razoável.
2. **Uma implementação por fórmula.** Antes de escrever, procure se ela já existe:
   - `percentualJP7`, `tonelagem`, `recordes` em `js/util.js`
   - `e1rm` (Epley, reps limitadas a 12) em `js/relatorio.js` e `js/radar.js`
   - `volumePorMusculo`, `volumePorGrupo`, `faixaGrupo`, `nivelVolume`, `tempoTreino` em `js/musculos.js`
   - `FC_TANAKA`, `PROTOCOLOS` (testes aeróbicos) em `js/extras.js`
   - `saudeDa` (engajamento, progressão, risco) em `js/radar.js`
   - `RIR` (Zourdos 2016) e `avaliar` (regras dos formulários) em `js/motor.js`
   - sinais do Oráculo em `cc_sinais_clinicos` (`supabase/atualizacao-4.sql`)
   Importe a existente; não copie a fórmula para outro arquivo.
3. **Código e documento juntos.** Mudou uma conta, atualize `docs/regras-de-negocio.md` no mesmo commit e registre o motivo em `docs/decisoes.md`.
4. **Dado faltando não vira zero.** Sem idade, sem dobra, sem FC: devolva `null` e mostre `·` com uma frase dizendo o que cadastrar (como `TestesAluna` faz com a data de nascimento).
5. **Unidades explícitas**: kg, cm, mm, bpm, ml/kg/min, minutos. Uma casa decimal em resultados fisiológicos.
6. **Mesma aluna, mesmo protocolo.** Comparações de teste aeróbico só entre testes do mesmo protocolo.

## Pontos de atenção
- Semáforo do check-in: vermelho = sinal crítico, amarelo = atenção, verde = nenhum. Os limiares estão no documento; o mapeamento de cores ainda precisa de aprovação do treinador antes de virar tela.
- O estresse do Oráculo vai de 0 a 10 (desde a atualização 4); a tabela antiga `checkins` usa 1 a 5. Não misturar escalas.
- Sexo padrão é `F`; fórmulas com versão masculina e feminina usam `aluna.sexo`.
- Série de aquecimento não entra em tonelagem, recorde, volume nem e1RM.
