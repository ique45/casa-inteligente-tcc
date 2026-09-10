# Slide 8 — Validação e Cobertura de Testes

Template do professor: título **"Validação e Cobertura de Testes"** + uma frase de
impacto com número. O modelo traz de exemplo:
*"A validação contínua garantiu que 95% dos requisitos funcionais fossem plenamente
atendidos antes da homologação final."*

Abaixo, a versão do nosso projeto — mesma estrutura (frase de abertura + 3 tópicos ▸),
com números reais conferidos em 10/09/2026.

---

## Frase de abertura (escolher uma)

> **A.** "Os 37 testes automatizados do projeto rodam a cada alteração de código e passam
> na íntegra; a bateria de testes de qualidade encontrou 3 defeitos de acessibilidade,
> todos corrigidos e reverificados antes da entrega final."

> **B.** "A validação cobriu as três frentes que sustentam o TCC — acionar dispositivos,
> proteger os dados de cada usuário e operar tudo pelo teclado — e todo defeito encontrado
> foi corrigido e reverificado antes da entrega final."

## Tópicos do slide (formato ▸, igual ao slide 7)

▸ **37 testes automatizados** — 19 no aplicativo (verificador de contraste próprio + rótulos
da confirmação falada) e 18 no backend (API de sincronização, automações e regras do
Firebase, com Jest); executados a cada alteração de código, todos passando.

▸ **Atividade de Qualidade e Teste de Software** — plano de testes formal + 19 casos
(5 positivos, 5 negativos, 9 de limite), acima do mínimo de 15; teste de caixa-preta em
4 camadas: interface (navegador automatizado), API (HTTP), persistência (SDK admin) e
firmware (compilação). 16 aprovados; os **3 reprovados eram a mesma família** — elementos
clicáveis sem semântica, invisíveis para o teclado — e foram **todos corrigidos**
(viraram `<button>` com estado ARIA) e reverificados. Merge em `master` em 09/09.

▸ **Cadeia ponta a ponta validada na simulação Wokwi (ESP32)** — do clique no painel ao
Firebase, ao backend na Railway e ao firmware: o LED acende e o status vira "Online".
Como o hardware ainda não está montado, a integração foi provada em simulador — mesmo
firmware, mesmo backend, mesmos comandos.

## Tabela opcional (se quiser mais que a frase única do modelo)

| Camada | Testes | Ferramenta | O que cobre |
|---|---|---|---|
| Aplicativo (frontend) | 19 | `node --test` | contraste 7:1 de cada par de cores; concordância de gênero da fala |
| Backend / API | 18 | Jest + Supertest | rota `/arduino/sync`, automações, regras do Firestore/RTDB |
| Qualidade (manual) | 19 casos | Playwright, cURL, Admin SDK, arduino-cli | login, proteção de rotas, exposição de segredos, contraste, teclado, build do firmware |
| Integração | 1 cadeia | Wokwi (ESP32) | clique → Firebase → Railway → firmware → LED |

## Fala (~1 min)

"Testamos em três frentes. Primeiro, 37 testes automatizados que rodam sozinhos a cada
mudança no código — o verificador de contraste, por exemplo, reprova qualquer cor que
não atinja o alvo 7:1. A acessibilidade é testada, não só pretendida.

Segundo, uma atividade de qualidade com plano de testes e 19 casos executados sobre o
sistema no ar. Ela encontrou três defeitos, todos do mesmo tipo: botões que funcionavam
no mouse mas não no teclado — justamente o pior problema para o nosso público. Os três
foram corrigidos e reverificados antes da entrega.

Terceiro, como a casa física ainda não está montada, a integração de ponta a ponta foi
validada no simulador Wokwi: o mesmo firmware, o mesmo backend, o clique no painel
acendendo o LED."

## Se a banca perguntar

- **"E o defeito crítico do relatório?"** — O relatório foi escrito em 02/09, no meio da
  correção. Os três defeitos (DEF-01 a 03) já estão corrigidos no `master` desde 09/09;
  a varredura final ainda achou e corrigiu mais 6 problemas de refluxo e foco, testando
  nos dois temas, com texto ampliado e de 320 a 1280 px de largura.
- **"Testaram com usuário idoso real?"** — Não. A acessibilidade foi medida por critérios
  objetivos (contraste, alvo de toque, operação por teclado). Observação com usuários
  reais está registrada como trabalho futuro.
- **"Cobertura de código em %?"** — Não medimos cobertura por linha; a estratégia foi
  caixa-preta pela interface pública de cada camada. Os 19 casos cobrem os requisitos
  das três frentes do projeto.

---

### Como reproduzir os números

```bash
# frontend — 19 testes
node --test tools/*.test.js

# backend — 18 testes
cd backend && npm test
```

Relatório completo da atividade de qualidade: `Relatorio_Testes_Casa_Inteligente.docx`
(raiz do repo) — 19 casos com passos, resultado esperado/obtido e evidência.
