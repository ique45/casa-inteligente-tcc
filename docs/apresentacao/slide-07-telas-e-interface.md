# Slide 7 — Telas e interface (UI/UX)

Template do professor: "Telas e Interface (UI/UX)". Falar em ~1 min.

## Como montar o slide

Prints em `docs/apresentacao/` (app rodando em `node server.js` → `localhost:8080`,
modo `?preview=1`, tema claro "paleta4", 1440 px de largura).

| Posição no slide | Arquivo | O que mostra |
|---|---|---|
| Faixa de cima, 3 telas | `06-login.png` · `02-perfil.png` · `01-dashboard.png` | entrada → perfil de acessibilidade → tela principal |
| Faixa de baixo, 2 telas | `04-automacao-editor.png` · `05-historico.png` | criar automação passo a passo · histórico com filtros |
| Miniatura / balão | `07-dashboard-texto-maior.png` (ou `08-dashboard-tema-escuro.png`) | a barra de acessibilidade em ação: a interface inteira cresce / vira tema escuro |

Sugestão: sobrepor um recorte da `07` sobre a `01` com uma seta curta —
"mesma tela, botão A+ apertado".

## Texto do slide (pode colar)

**Fluxo — 5 telas**
- Login → Seleção de perfil de acessibilidade → Dashboard → Editor de automação → Histórico
- Barra de acessibilidade fixa no topo de todas as telas: tamanho do texto (A A A) e troca de tema

**Decisões de UX**
- Contraste WCAG AAA (7:1) em todo texto — verificado automaticamente a cada alteração de código
- Alvos de toque de 44 px e navegação 100% por teclado (todo controle é `<button>` com estado ARIA)
- Tema claro por padrão — decisão de projeto: fundo escuro espalha luz em olhos com catarata; o escuro fica como opção (fotofobia)
- Ampliar o texto redimensiona a interface inteira (layout em `rem`): raiz vai de 16 px a 22,4 px
- Confirmação falada das ações, em pt-BR, com concordância de gênero ("Luz ligada", "Portão aberto")
- Linguagem sem jargão: cada automação é lida como "Quando… / O sistema vai…", não "trigger/action"

## Fala (~1 min)

Se der para demonstrar ao vivo, é aqui: abrir o dashboard, apertar o "A+" na barra de
acessibilidade e mostrar a página inteira crescer junto; acionar uma luz e deixar a
confirmação falada tocar.

Contar a decisão do tema claro — é contraintuitivo ("a gente achava que acessível era
fundo preto") e mostra que a equipe pesquisou o usuário de verdade: alto contraste e
fundo escuro não são a mesma coisa.

Fechar no editor de automação: "o usuário nunca vê a palavra 'trigger'. Ele monta a
regra em passos e lê embaixo, em português, exatamente o que vai acontecer."

## Detalhe por tela (para ensaiar / responder à banca)

- **Login** — e-mail/senha e Google; a mesma barra de acessibilidade já aparece aqui, antes de existir sessão (as preferências ficam no navegador).
- **Perfil** — a pessoa marca um ou mais perfis (Mobilidade reduzida / Deficiência visual / Idoso) e liga só as formas de controle que vai usar (voz, botão, presença, horário, temperatura). "Confirmar ações em voz alta" tem botão **Testar**.
- **Dashboard** — 4 dispositivos (luz, ventilador, portão, alarme); cartão ligado fica lilás e diz o estado em MAIÚSCULAS; bloco de voz; "Ativações recentes". Estado do Arduino ("Online/Offline") no canto da barra.
- **Editor de automação** — passos: 1 Dispositivo · 2 Nome · 3 Gatilho · **4 Comando de voz (só aparece se o gatilho for Voz)** · 5 Ação; embaixo, "Como vai funcionar:" atualiza em tempo real. Ícones **ⓘ** clicáveis explicam cada conceito.
- **Histórico** — filtros por gatilho (Voz, Botão, Presença, Horário, Temperatura) e por período; cada linha diz "Ativado por:" e o resultado (LIGOU / FECHOU / ARMOU…).
- **Texto ampliado / Tema escuro** — mesma tela, a barra de acessibilidade muda a experiência sem recarregar nem entrar em configurações.
