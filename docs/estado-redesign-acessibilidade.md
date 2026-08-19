# Redesign de acessibilidade — estado atual

**Casa Inteligente — TCC 3 AMS Desenvolvimento de Sistemas**
Branch `redesign-acessibilidade` · atualizado em 19/08/2026

---

## O problema que motivou a segunda rodada

O redesign anterior (junho/2026) escolheu **tema escuro** em nome de "alto contraste": fundo `#050510`, texto branco puro. A intenção estava certa, a execução não.

**Alto contraste e fundo escuro não são a mesma coisa.** Em olhos com catarata ou opacidade de cristalino — comuns acima dos 65 anos, que é exatamente o público-alvo do projeto — texto claro sobre fundo escuro espalha luz dentro do olho e borra a borda das letras. O efeito se chama *halation*. Diretrizes de baixa visão recomendam o inverso: fundo claro, texto escuro.

Fundo escuro serve a outro grupo: quem tem fotofobia ou sensibilidade à luz. Por isso ele não foi eliminado — virou opção.

## Decisões de projeto

| Decisão | Justificativa |
|---|---|
| Tema **claro por padrão**, escuro por botão | Atende o público principal por padrão, sem excluir quem precisa do escuro |
| **Ignorar `prefers-color-scheme`** do sistema | Contraria a convenção deliberadamente: segui-la entregaria o modo pior por padrão a um idoso cujo celular está no escuro |
| Alvo de contraste **7:1 (AAA)**, não 4.5:1 (AA) | O nível AAA existe para o público deste projeto; o mínimo AA não é suficiente aqui |
| Medir contra os **três fundos** (página, card e card interno) | Um texto legível sobre o corpo da página pode reprovar dentro de um card |
| Tudo em **`rem`**, raiz em `100%` | Permite escalar a interface inteira mudando um valor; e `100%` respeita o tamanho de fonte que a pessoa já configurou no navegador |
| Cor **nunca sozinha** | Todo estado carrega texto (`LIGADO`/`DESLIGADO`); ~8% dos homens têm alguma daltonia |

## O que já está pronto e verificado

**1. Verificação automatizada de contraste** — `tools/check-contrast.js`

Mede todos os pares texto/fundo dos dois temas e reprova o que fica abaixo de 7:1 (3:1 para contornos). Também acusa qualquer cor literal que escape dos blocos de tema. 13 testes próprios.

```
node tools/check-contrast.js
node --test tools/*.test.js
```

Isso é o que permite dizer que a acessibilidade foi **medida**, não alegada.

**2. Sistema de cores em tokens semânticos** — `css/app.css`

Os tokens nomeiam função (`--text`, `--surface`, `--accent`, `--danger`), não cor. Dois blocos: `:root` traz o tema claro, `:root[data-theme="dark"]` o escuro. Nenhuma cor literal fora deles.

**3. Escala tipográfica e alvos de toque**

Piso de 14px (nada menor em lugar nenhum — antes havia texto de 10px), corpo em 18px, `line-height 1.5`, alvos de toque de no mínimo 44×44px. Tudo em `rem`, inclusive as dimensões dos controles, para escalar junto.

O ponto de quebra do celular usa `em` em vez de `px`: quando o usuário amplia o texto, a tela adota o layout de celular sozinha, sem precisar prever cada combinação de largura e escala.

## O que falta

| Item | Situação |
|---|---|
| Barra de acessibilidade (botão de tema + A- A A+) | Especificada, não implementada — hoje o tema só muda por atributo |
| Chips operáveis por teclado | **O defeito mais grave.** O editor de automações e os filtros do histórico são `<div>`/`<span>` com clique em JS: inoperáveis sem mouse |
| Semântica (`<h1>`, `<main>`, `aria-*`, pular para conteúdo) | Nenhuma página do app tem `<h1>` ou `<main>`, e o app inteiro tem zero atributos `aria-*` |
| Confirmação falada das ações | Especificada, não implementada |
| Site institucional (`index.html`) | Recebe só os tokens novos; redesign próprio fica para depois |

Plano completo em `docs/superpowers/plans/2026-08-19-redesign-acessibilidade-app.md`, spec em `docs/superpowers/specs/2026-08-19-redesign-acessibilidade-app-design.md`.

## Como demonstrar

```bash
node server.js
```

Abrir **`http://localhost:8080/login.html`** — nunca `127.0.0.1`, porque o login com Google só aceita domínio autorizado.

Para alternar o tema enquanto a barra não existe, no console do navegador:

```js
document.documentElement.setAttribute('data-theme','dark')   // escuro
document.documentElement.removeAttribute('data-theme')       // claro
```

Para simular o controle de tamanho de texto:

```js
document.documentElement.setAttribute('data-textsize','maior')   // 140%
```

## Limitações declaradas

Registradas de propósito, para não serem descobertas numa pergunta:

- **Não houve teste com leitor de tela real** (NVDA/VoiceOver) nem com pessoa idosa do público-alvo. Os atributos de acessibilidade são boa prática aplicada com cuidado, não comportamento medido.
- A verificação em navegador cobriu a tela de login nos dois temas. As telas internas exigem autenticação e ainda não foram conferidas visualmente.
- O trabalho está em branch separada. O `master` segue intocado e funcional.

## Um achado que vale contar

O verificador automatizado passava com 100% de aprovação enquanto o título "Casa Inteligente" da tela de login estava **branco sobre fundo branco — invisível**.

O motivo: o script varre `css/app.css`, mas as páginas têm blocos `<style>` próprios, que ficaram fora do alcance dele. Havia ali seis referências a tokens que já não existiam e duas cores fixas.

Só apareceu ao renderizar a página de verdade. É um bom lembrete de que verificação automatizada mede o que você mandou medir — e o que ficou fora do alcance dela não fica correto por isso.
