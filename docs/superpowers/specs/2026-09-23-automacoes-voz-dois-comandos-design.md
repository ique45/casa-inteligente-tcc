# Automações sem escolha de ação e voz com dois comandos — Design

**Data:** 2026-09-23
**Status:** aprovado em conversa, aguardando revisão do arquivo

## Objetivo

O app passa a ser controlado principalmente pelo celular, e a voz é o caminho
de acessibilidade. Hoje criar uma automação de voz exige escolher uma ação
(Alternar / Só ligar / Só desligar) e digitar um único comando — e esse
comando salvo **nem é usado**: `js/voice.js` só reconhece frases fixas
("acender luz", "abrir portão"...).

Queremos:

1. Nenhuma automação pergunta mais a ação — todas alternam.
2. A automação de voz tem **dois comandos**: um liga, outro desliga.
3. O nome da automação entra sozinho no final do comando:
   nome "Luz Quarto" → sugestões **"Acender Luz Quarto"** / **"Apagar Luz Quarto"**.
4. O mesmo padrão vale para todos os dispositivos.
5. O microfone reconhece de verdade os comandos que o usuário salvou.

## O que o usuário decidiu

- Tirar a escolha de ação de **todos** os gatilhos (voz, botão, presença,
  temperatura, horário). Sensores passam a sempre alternar — aceito sabendo
  que presença pode apagar a luz quando alguém entra.
- Guardar as **duas frases completas** (não só o par de verbos), preenchidas
  automaticamente e editáveis.
- **Sem compatibilidade com automações antigas**: as existentes são de teste
  e serão apagadas.

## Fora do escopo

- Backend e firmware não mudam. `resolveAction('toggle', ...)` já existe.
- Continua havendo um dispositivo físico por tipo: "Luz Quarto" e "Luz Sala"
  acendem a mesma lâmpada. Não resolvemos isso aqui.

## Modelo de dados

Documento em `automations/{uid}/items/{id}`:

| Campo | Antes | Depois |
|---|---|---|
| `action` | `'toggle' \| 'on' \| 'off'` escolhido | sempre `'toggle'` |
| `voiceCommand` | 1 frase (só voz) | **removido** |
| `voiceOn` | — | frase que liga (só voz) |
| `voiceOff` | — | frase que desliga (só voz) |

`deviceType`, `deviceName`, `trigger`, `enabled`, `createdAt` não mudam.
As regras do Firestore (`firestore.rules`) só checam o dono do caminho e não
validam campos — não precisam mudar (conferido).

## Componentes

### `js/devices.js` — dados e funções puras (testáveis no Node)

- `VOICE_VERBS` por dispositivo, em pares `{ on, off }`:
  - luz: Acender/Apagar, Ligar/Desligar
  - ventilador: Ligar/Desligar
  - portão: Abrir/Fechar
  - alarme: Armar/Desarmar, Ativar/Desativar
- `montarComandos(par, nome)` → `{ voiceOn: 'Acender Luz Quarto', voiceOff: 'Apagar Luz Quarto' }`.
- `normalizarFrase(texto)` → minúsculas, sem acento, sem pontuação, sem
  artigos/preposições soltos (`o a os as do da dos das de no na`), espaços
  colapsados. "Acender a luz do quarto" e "acender luz quarto" viram a mesma
  coisa.
- `encontrarComando(fala, automacoes)` → `{ automation, state }` ou `null`.
  Compara a fala normalizada com `voiceOn`/`voiceOff` normalizados das
  automações de voz **ativas**. Casa se forem iguais ou se a fala contiver a
  frase inteira (a pessoa pode falar "por favor acender luz quarto").
  Se várias casarem, vence a frase mais longa (mais específica).
- `describeAutomation` para voz mostra os dois comandos:
  *você falar "Acender Luz Quarto" (liga) ou "Apagar Luz Quarto" (desliga)*;
  para os outros gatilhos o "O sistema vai" vira "alternar o <nome>".
- `ACTIONS_DEFAULT`/`ACTIONS_BY_DEVICE`/`getActions` deixam de ser usados
  pelo formulário. `describeAutomation` e a prévia usam o texto de
  alternância por dispositivo (hoje duplicado em `TOGGLE_DESC` e
  `getTriggerNote`) — centralizar em `devices.js`.

### `js/automation.js` + `automation.html` — formulário

- Remove a etapa "Ação" (`#step-action`) e a numeração dinâmica dela.
- Etapa de voz: chips com os pares de verbos do dispositivo (ex.:
  "Acender / Apagar"). Tocar num par preenche dois campos:
  - "Comando para ligar" (`#input-voice-on`)
  - "Comando para desligar" (`#input-voice-off`)
- Se o nome mudar depois, as frases são recalculadas — **exceto** o campo
  que o usuário editou à mão (flag por campo, zerada ao escolher outro par).
- Validação para salvar: dispositivo, nome, gatilho; se voz, as duas frases
  preenchidas e diferentes entre si.
- Prévia: *Ao falar "Acender Luz Quarto", liga Luz Quarto; ao falar
  "Apagar Luz Quarto", desliga.*
- Salva sempre `action: 'toggle'`; `voiceOn`/`voiceOff` só quando voz (na
  edição, apagados com `FieldValue.delete()` se o gatilho deixar de ser voz).
- Modo edição popula os dois campos a partir do documento.

### `js/voice.js` + `js/dashboard.js` — microfone

- `voice.js` continua dono do reconhecimento. O `onresult` passa a
  consultar primeiro `encontrarComando(fala, automacoesAtivas)`; se não
  achar, cai nos padrões fixos de hoje (a voz funciona mesmo sem nenhuma
  automação — segurança para a apresentação).
- O dashboard já mantém `automationsList` em tempo real; entrega essa lista
  ao `voiceControl` (ex.: `voiceControl.setAutomacoes(lista)` a cada snapshot).
- Resultado de um comando salvo leva `deviceId` e `state` como hoje, mais o
  nome da automação para a mensagem ("Comando reconhecido: Acender Luz
  Quarto").
- Depois de gravar o comando, `aguardarConfirmacao` (feito hoje) continua
  valendo.

## Erros e casos de borda

- Duas automações com a mesma frase: vence a primeira encontrada entre as de
  mesmo tamanho; o formulário avisa (sem bloquear) se a frase já existe em
  outra automação de voz.
- Automação desativada não responde por voz.
- Frase não reconhecida: mantém "Não entendi: ..." de hoje.

## Limpeza de dados

Depois de implementado e testado: exportar backup (JSON, fora do repo) e
apagar as automações de teste das contas via Admin SDK, com confirmação do
usuário antes de apagar. A conta de demo fica vazia; as automações da
apresentação são recriadas pelo formulário novo.

## Testes

Automáticos (`node --test tools/*.test.js`), novo `tools/voice-commands.test.js`:
- `montarComandos` com cada par e nomes com espaços/acentos.
- `normalizarFrase`: acentos, maiúsculas, artigos, pontuação.
- `encontrarComando`: frase exata, com artigos, com palavras extras,
  automação desativada ignorada, frase mais longa vence, sem match → `null`.

Manual no navegador (`localhost:8080`): criar automação de voz, conferir
preenchimento e renomear; editar; lista e dashboard mostram os dois
comandos; falar os dois comandos no celular.
