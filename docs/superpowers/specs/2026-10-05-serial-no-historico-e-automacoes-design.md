# Monitor serial no histórico e automações coerentes com a maquete

Data: 2026-10-05

## Objetivo

Na apresentação, qualquer pessoa entra com o login comum (`demo@casa.com`) e o
site conta a história certa do que a casa faz hoje, sem precisar configurar
nada. Duas mudanças:

1. O monitor serial sai do painel e fica no histórico, escondido atrás de um
   botão.
2. As automações passam a oferecer só o que faz sentido com a maquete atual.

Fora do escopo: cores, logo, fontes; firmware; backend; comportamento do botão
físico.

## Comportamento da casa (não muda)

Tudo abaixo já funciona assim e continua igual. Nada disso é automação:

| O quê | Como funciona |
|---|---|
| Escureceu (LDR) | A placa acende a luz externa; clareou, apaga. |
| Algo perto do ultrassom | Com o alarme armado, a placa toca o buzzer. |
| Voz, frases fixas | "acender/apagar luz", "armar/desarmar alarme" (`js/voice.js`). |
| Botão físico | Igual a hoje: a placa avisa o servidor, que roda as automações de gatilho "Botão físico". |

## Automações

Gatilhos oferecidos no formulário (`js/automation.js`, `TRIGGERS_BY_DEVICE`):

| Aparelho | Gatilhos |
|---|---|
| Luz interna (`luz`) | 🎤 Voz (frase própria), 🔲 Botão físico |
| Alarme (`alarme_armado`) | 🎤 Voz (frase própria), 🔲 Botão físico |

Saem do formulário:

- 🌙 Escureceu e 📏 Objeto perto: a placa já cuida da luz externa e da sirene
  sozinha; como gatilho da luz interna não fazem sentido para o projeto.
- 🔘 Botão no dashboard: os cartões de "Agora na casa" já ligam e desligam.
  Com isso o botão grande dos cartões de automação no painel
  (`d.trigger === 'botao'`, `acionarDispositivo` em `js/dashboard.js`) deixa de
  ter uso e é removido, junto com o ramo `'botao'` do formulário.

Nenhuma conta tem automações salvas hoje (conferido em 2026-10-05), então não
há migração. O backend continua aceitando `presenca` e `luminosidade` como
eventos: a placa manda esses eventos e o histórico deles nasce no backend.

## Voz pedindo a luz externa

Já existe tratamento (`js/dashboard.js`, ramo `somenteLeitura` do
`voiceControl.onResult`): não manda comando e responde na tela e pela voz de
confirmação. Muda só a frase, para os dois (tela e fala):

> A luz externa acende sozinha quando escurece.

A frase sai da descrição do dispositivo em `js/devices.js` (campo novo
`respostaVoz` na luz externa), para não ficar escrita no dashboard. A sirene
não tem frase de voz, então não precisa do campo.

## Telas e textos

### Painel (`dashboard.html`, `js/dashboard.js`)

- Remover a seção "Monitor serial" (HTML, CSS `.serial-*` e `renderSerial`).
  O painel continua ouvindo `arduino_status/{uid}` para o status Online/Offline,
  só deixa de desenhar o log.
- "Suas automações": subtítulo passa a ser
  *"Frases de voz suas e o que o botão da maquete faz"*.

### Histórico (`history.html`, `js/history.js`)

- No fim da página, botão **"Ver monitor serial"** (`aria-expanded`). Clicar
  abre o quadro com as linhas da placa, com o mesmo visual e formato que o
  painel tinha (hora + mensagem, linhas de alerta em destaque, `role="log"`).
  Clicar de novo fecha e o texto volta a "Ver monitor serial"; aberto, diz
  "Esconder monitor serial".
- O site só escuta `arduino_status/{uid}/log` enquanto o quadro está aberto
  (liga a assinatura ao abrir, desliga ao fechar e ao sair da conta).
- Filtros de gatilho não mudam: Voz, Botão, Botão físico, Objeto perto e
  Escureceu continuam aparecendo no histórico de verdade.

### Automações (`automation.html`, `js/automation.js`)

- Subtítulo: *"Crie suas próprias frases de voz ou escolha o que o botão da
  maquete faz"*.
- Só os gatilhos da tabela acima.

## Testes

- Testes que já existem (`tools/*.test.js`, `backend` com `npm test`) continuam
  passando; ajustar os que citam os gatilhos removidos.
- Navegador, logado em `demo@casa.com`:
  - painel sem monitor serial;
  - histórico: abrir e fechar o monitor, linhas chegando com a placa ligada;
  - formulário de automação oferecendo só Voz e Botão físico;
  - voz "acender a luz externa" mostra e fala a frase nova.
