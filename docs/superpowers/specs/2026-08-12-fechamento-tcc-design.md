# Fechamento do TCC para Apresentação — Design Spec

**Data:** 2026-08-12
**Objetivo:** Deixar o projeto Casa Inteligente apresentável e compreensível para o professor avaliador.

---

## Contexto

O projeto está funcionalmente completo nas camadas de software (frontend redesenhado, backend Node/Express deployado no Railway com 15 testes passando), mas tem pontas soltas que atrapalham a avaliação:

- A pasta `firmware/` está vazia, apesar do spec do firmware estar completo desde 2026-05-29
- Não existe README — não há porta de entrada no repositório
- A credencial de service account do Firebase está na raiz do projeto, fora do `.gitignore`
- O site institucional (`index.html`) não tem nenhum link para o sistema (`login.html`)
- 24 screenshots soltos na raiz enterram o código
- O último commit foi em 2026-06-03

## Restrições e decisões tomadas

| Questão | Decisão |
|---|---|
| Hardware disponível | Nenhum. O NodeMCU ESP8266 não foi comprado. |
| Escopo da avaliação | Checkpoint de software e documentação |
| Como o professor acessa | Apresentação presencial na máquina do aluno |
| Escrever o `.ino` mesmo sem hardware | Sim |
| Simulador de firmware para a demo | **Não.** Avaliado e recusado pelo usuário. |
| Deploy do frontend | Fora de escopo — a apresentação é local |
| Mudanças no backend | Fora de escopo — está funcionando e testado |

### Consequência aceita da ausência de simulador

Sem ESP8266 e sem simulador, a cadeia de comandos não fecha durante a demo:

- `arduino_status/{uid}` nunca é escrito, então o dashboard exibe estado offline (`js/dashboard.js:144-155`)
- Comandos enfileirados em `commands/{uid}` nunca são consumidos (`backend/routes/arduino.js:60-75`)
- `devices/{uid}/{id}.state` nunca é confirmado pelo hardware

O usuário optou por explicar isso verbalmente na apresentação. A Seção 5 mitiga o impacto visual ajustando a mensagem de offline para um tom informativo em vez de erro.

---

## Seção 1 — Segurança e higiene do repositório

**Entregas:**

1. Acrescentar ao `.gitignore`:
   - `*firebase-adminsdk*.json` — credencial de service account
   - `.playwright-mcp/` — artefatos de ferramenta
   - `/*.png` — screenshots na raiz (apenas raiz, não subpastas)

2. Commitar arquivos que estão fora do git e deveriam estar versionados:
   - `backend/package-lock.json` — garante instalação reproduzível das dependências
   - `docs/superpowers/plans/2026-05-27-backend-railway.md` — plano do backend

3. Mover os 24 screenshots da raiz para `docs/screenshots/`.

**Verificação:** `git check-ignore -v <arquivo-credencial>` deve retornar a regra que o ignora. A credencial nunca foi commitada (histórico verificado), então não há necessidade de reescrever histórico.

---

## Seção 2 — README na raiz

Arquivo novo: `README.md`. É a porta de entrada do professor no repositório.

**Estrutura:**

1. **Título e resumo** — o que é e para quem: automação residencial voltada a acessibilidade, para idosos e pessoas com mobilidade reduzida
2. **Arquitetura** — diagrama em texto: `Site (HTML/CSS/JS) → Firebase (Auth/Firestore/RTDB) → Backend (Railway) → ESP8266`
3. **Tabela de tecnologias por camada**
4. **Como rodar** — passo a passo em 2 comandos (ver Seção 5)
5. **Mapa de pastas** — o que é cada diretório
6. **Estado atual** — tabela honesta do que está pronto e do que falta
7. **Limitações conhecidas** — inclui o gatilho por horário, que o frontend permite criar mas nenhuma camada dispara (documentado no spec do firmware, seção "Fora do escopo")
8. **Equipe** — os 6 integrantes

**Critério de sucesso:** alguém que nunca viu o projeto entende o que ele faz e consegue rodá-lo sem perguntar nada.

---

## Seção 3 — Firmware ESP8266

Arquivo novo: `firmware/esp8266/casa_inteligente.ino`, implementando o spec `2026-05-29-firmware-esp8266-design.md` sem desvios.

**Estrutura, conforme o spec aprovado:**

```
[ BLOCO DE CONFIGURAÇÃO ]   ← WIFI_SSID, BACKEND_URL, UID, TOKEN, pinos, RELAY_ON/OFF
[ BIBLIOTECAS + GLOBAIS ]   ← ESP8266WiFi, ESP8266HTTPClient, ArduinoJson, DHT
[ setup() ]                 ← conecta WiFi, inicializa pinos e DHT
[ loop() ]                  ← a cada 2s: lê sensores → monta JSON → POST → aplica comandos
[ funções ]                 ← connectWiFi / readSensors / syncWithBackend / applyCommand
```

**Requisitos específicos:**

- Comentários em português — este código será lido, não executado
- Debounce do PIR com `PIR_COOLDOWN_MS` (10s) para não spammar eventos de presença
- Reconexão de WiFi sem bloquear o `loop()`
- Polaridade do relé isolada em `RELAY_ON` / `RELAY_OFF`, já que o modelo do módulo ainda é desconhecido
- Sem hardware para testar: o critério de aceitação é conformidade com o spec e clareza de leitura, não execução

**`firmware/arduino/`:** a pasta está vazia e sem propósito no design atual (a decisão de arquitetura foi NodeMCU ESP8266, não Arduino Uno). A remoção foi proposta e **recusada pelo usuário** — a pasta permanece como está, sem alterações. Como o Git não versiona diretórios vazios, ela continua existindo apenas no disco local e não aparece no repositório.

---

## Seção 4 — Integrar site institucional ao sistema

O `index.html` é a página de apresentação do TCC (seções INÍCIO, PROJETO, DESENVOLVIMENTO, GRUPO, REFERÊNCIA) e hoje não contém nenhum link para `login.html`.

**Entrega:** botão "ACESSAR O SISTEMA" apontando para `login.html`, em dois pontos:
- na navbar (`index.html:12-26`), como item de destaque
- ao final da seção de apresentação do projeto, como chamada para ação

Estilo consistente com o `styles.css` existente do site institucional — não importar `css/app.css`, que pertence ao app.

---

## Seção 5 — Preparar a demo

1. **Commitar o `server.js` da raiz.** Ele já existe (não versionado) e serve os arquivos estáticos em `http://127.0.0.1:8080`. É necessário de verdade: o Firebase Auth não opera sob o protocolo `file://`, então abrir o HTML diretamente quebra o login. Documentar no README como o comando de inicialização.

2. **Ajustar a mensagem de offline.** Hoje `dashboard.html:81-83` exibe, em vermelho de erro:
   > ⚠️ Arduino offline — o último estado definido aqui será aplicado assim que a conexão for restabelecida.

   Trocar por um tom informativo, já que a ausência de hardware é esperada nesta etapa:
   > Hardware ainda não conectado — os comandos ficam salvos e serão aplicados quando o ESP8266 for integrado.

   Ajustar também o estilo de `.offline-hint` (`dashboard.html:28-33`), trocando o vermelho de erro pela paleta informativa já existente em `css/app.css`:

   | Propriedade | De | Para |
   |---|---|---|
   | `color` | `var(--danger)` | `var(--purple-light)` |
   | `background` | `rgba(239,68,68,0.08)` | `var(--purple-glow)` |
   | `border-left` | `3px solid var(--danger)` | `3px solid var(--purple)` |

   O `--purple-light` (#a78bfa) sobre o fundo `--bg` (#050510) mantém o contraste alto exigido pelo público-alvo do projeto. O indicador de status na sidebar permanece vermelho — ele reflete um fato real do sistema.

3. **Roteiro de demonstração no README** — sequência de telas para apresentar o sistema em cerca de 5 minutos: login → seleção de perfil → dashboard → criação de automação → histórico.

---

## Fora de escopo

- Deploy do frontend (GitHub Pages, Netlify) — a apresentação é local
- Simulador de firmware — avaliado e recusado
- Qualquer alteração em `backend/` além do que já está commitado
- Refatorações não relacionadas ao objetivo da apresentação
- Implementação do gatilho por horário — será apenas documentada como limitação conhecida

## Critério de conclusão

- `git status` limpo, sem credenciais rastreáveis
- README responde "o que é", "como rodo" e "o que falta" sem ajuda externa
- `firmware/esp8266/casa_inteligente.ino` existe e corresponde ao spec
- `index.html` leva ao sistema em um clique
- `node server.js` sobe a demo, e a tela do dashboard não parece defeituosa
- Os 15 testes do backend continuam passando
