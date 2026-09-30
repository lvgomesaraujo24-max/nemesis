# Regras de negócio e fórmulas

Fonte da verdade das contas do Nemesis. Se o código e este arquivo discordarem, é bug: corrija um dos dois no mesmo commit. Fórmula nova só entra com referência.

## Avaliação física
**% de gordura: Jackson & Pollock 7 dobras + Siri** (`percentualJP7` em `js/util.js`)
- Dobras (mm): peitoral, axilar média, tríceps, subescapular, abdominal, suprailíaca, coxa. S = soma das 7.
- Densidade mulher: `1,097 − 0,00046971·S + 0,00000056·S² − 0,00012828·idade`
- Densidade homem: `1,112 − 0,00043499·S + 0,00000055·S² − 0,00028826·idade`
- Siri: `%G = 495 / D − 450`, uma casa decimal. Sem idade ou com dobra faltando: não calcula.

## Força e carga
- **Força estimada (Epley)**: `e1RM = carga × (1 + reps/30)`, reps limitadas a 12 (acima disso a fórmula perde precisão). `js/relatorio.js`, `js/radar.js`.
- **Tonelagem**: soma de `carga × reps` das séries, sem séries de aquecimento. `tonelagem` em `js/util.js`.
- **Recorde**: maior carga do exercício; empate de carga decide por mais reps. Aquecimento não conta.
- **Escala RIR** (Zourdos et al., 2016): `RIR` em `js/motor.js`.

## Volume e tempo da ficha (`js/musculos.js`)
- Conta volume: exercícios do tipo musculação e crossfit. Aquecimento e aeróbico não.
- Série de músculo principal vale 1; de músculo auxiliar vale 0,5 (se não for principal no mesmo exercício).
- Nível do volume semanal por músculo: `< 5` baixo, `5–9` moderado, `10–14` alto, `≥ 15` altíssimo.
- Faixa semanal por grupo e nível da aluna (séries):

| Grupo | Iniciante | Intermediária | Avançada |
|---|---|---|---|
| Glúteo | 9–12 | 12–16 | 18–24 |
| Grandes (quadríceps, posteriores, costas, peito, ombros) | 6–10 | 10–14 | 14–20 |
| Pequenos (adutores, panturrilha, lombar, bíceps, tríceps, core) | 4–8 | 6–10 | 10–14 |

- **Tempo estimado**: por repetição = cadência excêntrica + concêntrica (padrão 2 s + 0 s, mínimo 1 s). Reps em faixa usam a média; "máxima/falha/reserva" contam 10 reps; "30s" conta 30 s. Descanso livre = 90 s; em faixa = média. Série de aquecimento = 80% de uma série + 45 s. Entre exercícios soma um descanso. Aeróbico = duração.

## Cardio
- **FCmáx estimada (Tanaka)**: `208 − 0,7 × idade`, arredondada. Sem nascimento cadastrado: não calcula.
- **Testes aeróbicos** (`PROTOCOLOS` em `js/extras.js`), resultado em VO2máx ml/kg/min:

| Protocolo | Modalidade | Equação |
|---|---|---|
| Cooper 12 min | Campo | `(distância_m − 504,9) / 44,73` |
| Rockport 1 milha | Caminhada (campo/esteira) | `132,853 − 0,0769·peso_lb − 0,3877·idade + 6,315·(homem) − 3,2649·tempo_min − 0,1565·FC_final` |
| Bruce | Esteira | mulher `4,38·t − 3,9`; homem `14,8 − 1,379·t + 0,451·t² − 0,012·t³` |
| Åstrand-Ryhming | Bike submáximo | VO2 (L/min) pela carga (W × 6,12 kgm) e FC estável, corrigido pelo fator de idade, × 1000 / peso |
| TC6 | Sem equipamento | resultado é a distância em metros (sem VO2) |
| Manual | Qualquer | valor medido digitado |

Compare a aluna com ela mesma, no mesmo protocolo. Estimativa por equação tem erro maior que ergoespirometria.

## Oráculo (check-in semanal)
Sinais clínicos calculados no banco (`cc_sinais_clinicos`, `supabase/atualizacao-4.sql`), olhando os envios dos últimos 7 dias:

| Sinal | Crítico | Atenção |
|---|---|---|
| Dor (0–10, por região e lado) | intensidade ≥ 7, ou subiu em relação ao relato anterior da mesma região | intensidade ≥ 4, ou ≥ 3 duas vezes seguidas |
| Recuperação | estresse ≥ 9 **e** sono ≤ 2 | menos de 5 h de sono **e** estresse ≥ 7 |

**Semáforo do check-in** (como mostrar para o treinador): vermelho = algum sinal crítico; amarelo = algum sinal de atenção; verde = nenhum sinal. *A confirmar pelo treinador antes de virar tela; hoje o app mostra "Crítica" e "Atenção" na Acrópole.*

## Radar da Guerreira (`js/radar.js`)
- **Aderência**: treinos concluídos nos últimos 28 dias ÷ (meta semanal × 4), máximo 1. Meta = `treinos_semana_alvo` da aluna, ou nº de treinos ativos não opcionais, ou 3.
- **Engajamento** (0–100): `70% aderência + 30% check-ins` (check-ins das últimas 4 semanas ÷ 4). Selo: ≥ 75 bom, ≥ 50 médio, abaixo ruim.
- **Progressão**: média da variação da melhor e1RM por exercício, últimas 4 semanas contra as 4 anteriores. > +0,5% bom, < −0,5% ruim.
- **Risco de evasão** (0–100, soma e limita em 100):

| Condição | Pontos |
|---|---|
| aderência < 50% (ou < 75%) | 35 (ou 15) |
| sem treinar há 7 dias ou mais (ou nunca treinou) | 20 |
| sem treinar há 14 dias ou mais | +10 |
| sem check-in na semana atual nem na anterior | 15 |
| plano vence em até 7 dias | 15 |
| progressão negativa | 10 |
| sem ficha ativa | 15 |

Nível: ≥ 50 alto, ≥ 25 médio, abaixo baixo.

## Financeiro
Planos padrão (`schema.sql`): Ágora 1 mês R$ 247, Delfos 3 meses R$ 647, Ítaca 6 meses R$ 1.197, Olimpo 12 meses R$ 1.997. O treinador pode editar valores no app; as parcelas são geradas mês a mês.
