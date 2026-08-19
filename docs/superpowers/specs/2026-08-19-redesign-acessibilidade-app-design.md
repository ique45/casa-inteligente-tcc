# Redesign de Acessibilidade do App — Design Spec
**Data:** 2026-08-19  
**Projeto:** Casa Inteligente TCC  
**Status:** Aprovado

---

## Visão Geral

Segunda rodada de redesign do frontend, focada no público-alvo real do projeto: idosos e pessoas com baixa visão. A primeira rodada (2026-06-01) escolheu tema escuro em nome de "alto contraste"; este spec reverte essa escolha com base em como a visão envelhecida funciona, converte o sistema de estilos para tokens semânticos e unidades relativas, e adiciona dois controles de acessibilidade operados pelo usuário.

**Escopo:** apenas o app — `login.html`, `profile.html`, `dashboard.html`, `automation.html`, `history.html`, `css/app.css` e os JS correspondentes. O site institucional (`index.html` + `styles.css`) recebe apenas os tokens novos, para não destoar; seu redesign fica em spec próprio, depois da apresentação.

**Não faz parte deste spec:** mudança de fluxo ou de telas, alteração de backend, alteração de firmware. Os 18 testes de `backend/` devem continuar passando sem serem tocados.

---

## Seção 1 — Tokens e Paleta

### Arquitetura de tokens

Uma única camada de tokens **semânticos** — nomeiam função, não cor. (Uma camada extra de primitivas foi considerada e descartada: são ~16 tokens no total, e a indireção não se paga.)

```
Superfícies  --bg  --surface  --surface-2  --border  --border-strong
Texto        --text  --text-muted  --text-on-accent
Destaque     --accent  --accent-hover  --accent-weak
Estado       --success  --success-weak  --danger  --danger-weak
Foco         --focus-ring
```

`:root` define o tema claro. `:root[data-theme="dark"]` sobrescreve.

**Regra invariável:** nenhuma cor literal pode existir fora desses dois blocos. Hoje o `app.css` viola isso em dezenas de regras (`#fff`, `#475569`, `#1a1a35`, `rgba(255,255,255,0.03)`, `rgba(34,197,94,0.12)`). Converter essas ocorrências é o trabalho central desta seção — sem isso o tema claro sai manchado.

### Paleta clara (padrão)

| Token | Valor | Contraste sobre `--bg` | Nota |
|---|---|---|---|
| `--bg` | `#f8f8fb` | — | branco puro reflete; fundo levemente cinza |
| `--surface` | `#ffffff` | — | cards saltam por serem mais claros que o fundo |
| `--text` | `#14141f` | **16.5:1** | |
| `--text-muted` | `#464e5c` | **7.9:1** | medido sobre `--bg`; sobre `--surface-2` ainda dá 7.5:1 |
| `--accent` | `#5b21b6` | **9.0:1** | o `#7c3aed` atual dá 5.7:1 — passa em AA, reprova em AAA |
| `--success` | `#14532d` | **9.1:1** | o `#22c55e` atual dá 2.3:1 sobre branco |
| `--danger` | `#7f1d1d` | **10.1:1** | |

`--text-on-accent` é `#ffffff`. Sobre `--accent` (`#5b21b6`) mede **9.0:1** — é o par usado em botão primário, onde o texto fica sobre o preenchimento e não sobre o fundo da página.

**`--accent` e `--accent-text` são tokens distintos.** `--accent` é preenchimento, com `--text-on-accent` por cima; `--accent-text` é destaque em texto sobre a página. No tema claro coincidem (`#5b21b6`); no escuro divergem (`#6d28d9` para preenchimento, `#a78bfa` para texto), porque o mesmo roxo não atinge 7:1 nas duas situações.

Os valores de `--success` e `--danger` acima são mais escuros do que o mínimo exigido pelo fundo da página. O motivo é que eles também precisam atingir 7:1 sobre seus próprios preenchimentos fracos (`--success-weak`, `--danger-weak`), que é a restrição mais apertada das duas.

### Paleta escura (alternativa)

Mantém a identidade atual, que já mede 7.5:1 para texto secundário. Única exclusão: `#475569`, usado no status do dispositivo, que mede **2.6:1** e é substituído pelo token de texto secundário.

### Alvo de contraste

**AAA (7:1)**, não o mínimo AA de 4.5:1. O nível AAA existe justamente para o público deste projeto.

Medido contra **os três fundos** (`--bg`, `--surface`, `--surface-2`), não apenas o da página: um texto secundário legível sobre o corpo pode reprovar dentro de um card. É a restrição mais apertada dos três que vale.

### Decisões deliberadas

**Claro é o padrão, e o `prefers-color-scheme` do sistema é ignorado.** A convenção seria respeitar a preferência do sistema. Aqui isso entregaria o modo pior por padrão a um idoso cujo celular está em modo escuro. Texto claro sobre fundo escuro espalha luz em olhos com catarata ou opacidade de cristalino e borra a borda das letras — o oposto do que "alto contraste" sugere. O escuro permanece disponível pelo botão, para quem tem fotofobia ou sensibilidade à luz.

**Cor nunca sozinha.** Todo estado carrega texto junto (`LIGADO`/`DESLIGADO`). O design atual já faz isso; passa a ser regra explícita, porque ~8% dos homens têm alguma forma de daltonia.

### Aplicação sem piscar

Script inline de três linhas no `<head>` de cada página, antes de qualquer renderização, lê `localStorage` e aplica `data-theme` e `data-textsize` em `<html>`. Sem isso a tela pisca escura antes de virar clara.

**Persistência em `localStorage`, não no Firestore:** funciona na tela de login, antes de existir usuário autenticado, e não depende de rede.

---

## Seção 2 — Tipografia e Escala

### Base

```css
html { font-size: 100%; }   /* nunca um valor em px */
```

Cravar `16px` na raiz sobrescreve a preferência de fonte que a pessoa já configurou no próprio navegador. `100%` a respeita.

O controle A- A A+ multiplica essa base via `data-textsize` em `<html>`:

| Nível | Raiz |
|---|---|
| normal | 100% |
| grande | 120% |
| maior | 140% |

Com tudo em `rem`, mexer só na raiz escala texto, espaçamento e altura de alvos juntos. **A conversão `px`→`rem` não é cosmética — ela é o recurso.**

### Escala de tipos

| Token | Tamanho | Uso |
|---|---|---|
| `--fs-xs` | 0.875rem / 14px | metadado secundário, uso raro — **piso absoluto** |
| `--fs-sm` | 1rem / 16px | status, rótulos, legendas |
| `--fs-base` | 1.125rem / 18px | texto corrido |
| `--fs-lg` | 1.25rem / 20px | nome de dispositivo, título de card |
| `--fs-xl` | 1.5rem / 24px | título de seção |
| `--fs-2xl` | 2rem / 32px | título de página |

Efeito nos piores casos atuais: rótulo de formulário 11px → 16px, status de dispositivo 11px → 16px, badge 10px → 14px, item de sidebar 13px → 18px (sidebar acompanha: 160px → ~210px), rótulo da navegação mobile 10px → 14px.

### Ajustes que acompanham

- **`line-height: 1.5`** no corpo, `1.3` em títulos — requisito de espaçamento de texto do WCAG; o layout precisa sobreviver a isso.
- **Fim do maiúsculo em rótulos de formulário.** Caixa alta elimina o contorno da palavra e reduz a velocidade de leitura; a 11px com `letter-spacing` era a pior combinação do app. Vira caixa normal, 16px, negrito. O maiúsculo permanece em `LIGADO`/`DESLIGADO`: uma ou duas palavras, e a redundância com a cor é o que protege quem não distingue cores.
- **Alvo mínimo de 44×44px** em todo elemento interativo, medido na escala normal. Declarado em `rem` (2.75rem), de modo que os alvos crescem junto nos modos "grande" e "maior".

### Ponto de quebra em `em`

`@media (max-width: 640px)` → `@media (max-width: 40em)`.

Como `em` acompanha a raiz, no modo "maior" o ponto de quebra dispara a 896px em vez de 640px: a tela adota o layout de celular automaticamente assim que o texto cresce demais para a sidebar, sem precisar prever cada combinação de largura e escala.

---

## Seção 3 — Barra de Acessibilidade

### Posição

Barra fixa no topo de **todas** as páginas, incluindo `login.html`. O controle precisa estar visível antes de a pessoa precisar dele — quem não consegue ler a tela não vai encontrar um ajuste escondido dentro do Perfil. As preferências vivem em `localStorage`, então a barra funciona antes da autenticação.

### Consolidação

Hoje o status do Arduino aparece em dois lugares conforme a largura da tela: `.sidebar-footer` no desktop e `.mobile-topbar` no celular. Esse status passa para a barra nova.

**`.mobile-topbar` e `.sidebar-footer` deixam de existir.** O resultado é uma barra só, em qualquer largura — menos CSS do que antes, não mais.

### Conteúdo

Da esquerda para a direita: status do Arduino · `Tamanho do texto:` com três botões `A` · botão de tema. Abaixo de 320px quebra em duas linhas em vez de espremer.

### Comportamento

- **Os três `A` se auto-explicam:** cada botão é renderizado no tamanho que aplica, e o ativo recebe fundo sólido. O rótulo "Tamanho do texto" fica escrito ao lado — sem ícone a decifrar.
- **O botão de tema anuncia a ação, não o estado.** "🌙 Tema escuro" leva ao escuro; depois vira "☀️ Tema claro". Estado atual em botão (`aria-pressed`) é a convenção, mas ambíguo para quem não é técnico ("está escrito escuro, então está escuro?").
- **Toda mudança é anunciada** por região `aria-live="polite"` ("Texto grande", "Tema escuro"), para quem usa leitor de tela e não vê o resultado.

### Itens que vêm junto

- **Link "Pular para o conteúdo"**, visível apenas ao receber foco. A sidebar coloca 5 links à frente do conteúdo em toda página.
- **Anel de foco de 3px** via `--focus-ring` em `:focus-visible` para todo elemento interativo. O `.toggle-switch` atual usa `:focus`, que dispara também no clique de mouse.

---

## Seção 4 — Confirmação Falada

### Módulo

`js/speech.js` — invólucro fino sobre `speechSynthesis`, `lang='pt-BR'`.

### Ponto de integração

`updateDeviceUI()` em `js/dashboard.js:132`. É o ponto único por onde toda mudança de estado passa, venha de clique, de comando de voz ou do próprio ESP8266.

Falar ali significa confirmar o **estado confirmado pelo Firebase**, não o otimista que `toggleDevice()` pinta antes de saber o resultado. `toggleDevice()` reverte a UI quando a escrita falha — uma confirmação falada no caminho otimista mentiria.

### Quatro armadilhas conhecidas

1. **O primeiro snapshot dispara para os 4 dispositivos.** O listener entrega o estado inicial ao carregar a página; sem trava, o app anuncia os quatro em sequência a cada abertura do dashboard. A fala só começa a partir da segunda emissão.
2. **Português tem gênero.** Um particípio genérico produz "luz ligado". Cada dispositivo ganha seu par, em `js/devices.js`, junto da definição existente:

   | Dispositivo | Ligado | Desligado |
   |---|---|---|
   | luz | ligada | desligada |
   | ventilador | ligado | desligado |
   | portão | aberto | fechado |
   | alarme | armado | desarmado |

3. **Falar enquanto o microfone escuta gera realimentação** — o reconhecimento capta a própria voz do app. A fala só sai após o `onend` do reconhecimento (`js/voice.js:66`).
4. **Voz pt-BR pode não existir**, e `getVoices()` responde de forma assíncrona no Chrome (evento `voiceschanged`). Se não houver, o interruptor aparece desabilitado com "não disponível neste navegador", em vez de ficar ligado sem efeito.

### Erros também são falados

Se o comando falhar, sai "Não foi possível ligar a luz". Hoje esse caso só se manifesta visualmente.

### Onde mora o ajuste

Sexto interruptor da página **Perfil**, que já é uma lista de 5 — não na barra de acessibilidade, que ficaria cheia.

Nasce **desligado**: som inesperado assusta, e navegadores bloqueiam síntese de fala antes da primeira interação do usuário. Ao lado, um botão **"Testar"** que fala uma frase de exemplo imediatamente, para a pessoa entender o que está ativando antes de ativar.

---

## Seção 5 — Correções Independentes de Tema

### Defeito principal: nenhum `chip` é alcançável pelo teclado

Os filtros do histórico são `<span>` (`history.html:49-61`) e as escolhas do editor de automações são `<div>` (`js/automation.js:76,102,176`), ambos com clique em JS.

**Consequência:** o editor de automações inteiro e todos os filtros do histórico são inoperáveis sem mouse. Escolher dispositivo, gatilho e ação é impossível pelo Tab. Para quem navega por teclado ou usa leitor de tela, essas duas telas não existem.

**Correção:** `<div>`/`<span>` → `<button type="button">` com `aria-pressed`. Mecânica, sem mudança de fluxo. Toca `js/automation.js`, `js/history.js` e `history.html`.

### Tooltips

`automation.html:70,79,88` têm `tabindex="0"`, mas o CSS abre apenas no `:hover` — dá para focar e nada aparece. Passam a abrir por clique e a fechar no `Esc`.

### Demais correções verificadas

| Defeito | Correção |
|---|---|
| `#475569` no status do dispositivo — **2.6:1** | token de texto secundário (7.6:1) |
| `dashboard.html:103` — `<a>` com `onclick` e **sem `href`**, invisível ao Tab | link real |
| `.btn-delete` com ~24×24px | 44×44 |
| **Zero atributos `aria-*` no app inteiro** | `aria-pressed` em cards e chips; `aria-hidden` em emoji decorativo (senão o leitor narra "casa raio prancheta" na sidebar) |
| **Nenhuma página do app tem `<h1>` nem `<main>`** | ambos em cada tela; `<main>` é o destino do "Pular para o conteúdo" |
| `.toggle-switch:focus` | `:focus-visible` |

---

## Seção 6 — Verificação

O app não possui teste automatizado; os 18 testes de `npm test` são todos de backend. Este spec não monta infraestrutura de teste de frontend. Duas unidades, porém, são genuinamente testáveis e são escritas com teste antes:

### Automatizado

**`tools/check-contrast.js`** — lê os tokens de `css/app.css` e afirma que todo par texto/fundo dos dois temas atinge 7:1. Roda em segundos e pega regressão quando alguém "só ajusta uma cor".

**Mapa de particípios do `speech.js`** — lógica pura: tabela de entrada, string esperada na saída.

**`cd backend && npm test` continua em 18.** O backend não é tocado; qualquer quebra ali indica alteração indevida.

### Manual

Combinação limitada de propósito, em vez de fingir cobrir 6 telas × 2 temas × 3 escalas:

- As 6 telas em **claro / normal** — é o padrão e precisa estar impecável
- Dashboard e automações em **escuro / maior** — o extremo oposto, onde o layout quebra
- Passagem por **Tab** em cada tela: todo controle alcançável, foco sempre visível, editor de automações operável do início ao fim sem mouse
- **320px de largura** e **zoom de 400%** — requisito de refluxo do WCAG; é onde a sidebar de 210px disputa espaço com o conteúdo

### Limitações declaradas

Não haverá teste com leitor de tela real (NVDA/VoiceOver) nem com pessoa idosa do público-alvo. Os atributos `aria-*` são boa prática aplicada com cuidado, **não comportamento medido**.

Isto é registrado deliberadamente: se a banca perguntar "vocês testaram com o público-alvo?", a resposta honesta é não.

---

## Ordem de Implementação

1. `tools/check-contrast.js` com as asserções dos tokens (teste antes)
2. Tokens e paleta em `css/app.css` — conversão das cores literais
3. Conversão `px`→`rem` e escala de tipos
4. Barra de acessibilidade + script inline de tema nas 5 páginas; remoção de `.mobile-topbar` e `.sidebar-footer`
5. Correções da Seção 5 (chips, tooltips, `aria`, `<h1>`, `<main>`, alvos de toque)
6. `js/speech.js` + interruptor no Perfil (teste do mapa de particípios antes)
7. Tokens novos aplicados a `styles.css` do site institucional, apenas para não destoar
8. Verificação manual da Seção 6

---

## Riscos

| Risco | Mitigação |
|---|---|
| A conversão em massa de cores deixa alguma regra para trás, e ela some no tema claro | `check-contrast.js` + varredura por cor literal fora dos blocos de tema |
| Sidebar de 210px no modo "maior" espreme o conteúdo | ponto de quebra em `em` troca para layout mobile automaticamente |
| Conversão dos chips quebra o editor de automações | tela retestada por completo, incluindo criação de automação de ponta a ponta |
| Fala não disponível no navegador da apresentação | interruptor nasce desligado; botão "Testar" verifica antes de apresentar |

---

## Trabalho Futuro

- Redesign do site institucional (`index.html` + `styles.css`) — spec próprio, após a apresentação
- Teste com leitor de tela real e com pessoa do público-alvo
