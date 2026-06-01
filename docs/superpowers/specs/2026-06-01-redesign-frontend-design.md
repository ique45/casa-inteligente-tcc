# Redesign Frontend — Casa Inteligente

**Data:** 2026-06-01  
**Escopo:** Redesign visual e de UX de todas as 5 páginas do frontend  
**Objetivo:** Interface mais bonita, profissional e acessível para público idoso/com dificuldade visual

---

## 1. Princípios de Design

- **Clean & Minimal + Alto Contraste** — sem decoração excessiva, fundo mais escuro, bordas nítidas
- **Acessibilidade primeiro** — fonte 16px base, texto branco puro, status em MAIÚSCULAS, toggles grandes, áreas de toque generosas
- **Linguagem clara** — sem jargões técnicos, textos descritivos por extenso (ex: "Quando: você falar X" / "O sistema vai: ligar Y")

---

## 2. Sistema de Cores (app.css — variáveis)

| Variável | Valor atual | Novo valor |
|---|---|---|
| `--bg` | `#0d0d1a` | `#050510` |
| `--bg-card` | `#1a1a2e` | `#0d0d1f` |
| `--bg-card2` | `#16213e` | `#0a0a18` |
| `--text` | `#e2e8f0` | `#ffffff` |
| `--text-muted` | `#94a3b8` | `#94a3b8` (mantém) |
| `--border` | `#2d2d4e` | `#2a2a50` |
| `--purple` | `#7c3aed` | `#7c3aed` (mantém) |
| `--purple-light` | `#a78bfa` | `#a78bfa` (mantém) |
| `--purple-glow` | `rgba(124,58,237,0.25)` | `rgba(124,58,237,0.12)` |
| `--border-active` | *(novo)* | `#7c3aed` |
| `--radius` | `12px` | `12px` (mantém) |

---

## 3. Tipografia

- **Fonte:** Segoe UI, system-ui (mantém — boa legibilidade nativa)
- **Base:** `16px` (atual era implicitamente ~14px)
- **Títulos de página:** `18–22px`, `font-weight: 800`
- **Labels e status:** `10–11px`, `UPPERCASE`, `letter-spacing: 1px`
- **Corpo do card:** `14–15px`, `font-weight: 600–700` para nomes, `400–500` para descrições
- **Texto muted:** `#94a3b8`, `12–13px`

---

## 4. Layout Global — Sidebar

Todas as páginas autenticadas (dashboard, automações, histórico, perfil) substituem o `app-header` por uma **sidebar fixa à esquerda**.

**Estrutura da sidebar:**
- Largura: `160px`
- Background: `#0a0a1e`
- Borda direita: `2px solid #2a2a50`
- Padding: `20px 12px`

**Conteúdo da sidebar:**
```
[dot roxo] CASA
           INTELIGENTE   ← logo (uppercase, bold)

[🏠] Dashboard           ← item ativo: bg #7c3aed, texto branco bold
[⚡] Automações          ← item inativo: texto #94a3b8
[📋] Histórico
[👤] Perfil

─── (margin-top: auto) ───

[🚪] Sair               ← borda: 1px solid rgba(239,68,68,0.2), texto #ef4444
```

**Item ativo:** `background: #7c3aed; border-radius: 10px; color: #fff; font-weight: 700`  
**Item inativo hover:** `background: rgba(124,58,237,0.08)`

**Status do Arduino** (apenas sidebar do dashboard):
```
● ARDUINO
Online          ← fundo rgba(34,197,94,0.08), borda rgba(34,197,94,0.25)
```

---

## 5. Componentes globais atualizados

### Botão primário
```
padding: 13px 24px
background: #7c3aed
border: 2px solid #a78bfa
border-radius: 10px
font-size: 15px; font-weight: 700
color: #fff
```

### Botão secundário
```
background: transparent
border: 2px solid #2a2a50
color: #a78bfa
```

### Toggle (dispositivo)
```
width: 52px; height: 28px; border-radius: 14px
ON:  background #7c3aed, border 2px solid #a78bfa, thumb à direita
OFF: background #1a1a35, border 2px solid #2a2a50, thumb #475569 à esquerda
```

### Toggle (perfil — ativar função)
```
width: 48px; height: 26px (ligeiramente menor)
mesma lógica ON/OFF
```

### Inputs / campos de formulário
```
background: #0a0a18
border: 2px solid #2a2a50
border-radius: 10px
padding: 13px 16px
font-size: 14px
Labels: uppercase, 11px, letter-spacing 1px, cor #94a3b8
```

### Chips de seleção (automações)
```
ON:  border 2px solid #7c3aed, bg rgba(124,58,237,0.2), cor #a78bfa, font-weight 700
OFF: border 2px solid #2a2a50, bg #0a0a18, cor #64748b
```

---

## 6. Página: Login

**Layout:** Centralizado, sem sidebar (pré-autenticação)  
**Max-width do card:** `360px`

**Estrutura:**
1. Logo: ícone 🏠 em box `56x56px` com `border: 2px solid #7c3aed`, `border-radius: 16px`
2. Título: "Casa Inteligente" — `20px, font-weight: 800`
3. Subtítulo: "Automação para acessibilidade" — `13px, #64748b`
4. Card com `border: 2px solid #2a2a50, border-radius: 14px, padding: 28px 24px`
5. Campos com labels em UPPERCASE
6. Botão Entrar com `border: 2px solid #a78bfa`
7. Divisor "ou"
8. Botão Google (mantém branco)
9. Link "Não tem conta? Criar minha conta"

---

## 7. Página: Perfil

**Mudança de comportamento (além do visual):** O perfil passa a ser apenas uma **etiqueta de identidade**. Os toggles de funções ficam todos sempre visíveis e o usuário escolhe livremente o que ativar — independente do perfil selecionado.

**Mudança no `profile.js`:** Remover a função `updateTogglesFromProfiles()` e a lógica que pré-seleciona toggles com base nos perfis. Todos os toggles aparecem sempre que pelo menos um perfil estiver selecionado, todos começam desligados por padrão (exceto se já salvos no Firestore).

**Perfis (dados atualizados):**

| ID | Ícone | Nome | Descrição nova |
|---|---|---|---|
| mobilidade | ♿ | Mobilidade Reduzida | Dificuldade de movimento ou locomoção |
| visual | 👁️ | Deficiência Visual | Baixa visão ou dificuldade de leitura |
| idoso | 🏠 | Idoso | Prefere interface simples e clara |

**Layout dos cards de perfil:** Lista vertical (não grid), com:
- Ícone 44x44px em box roxa
- Nome `15px, font-weight: 700`
- Descrição `12px, #64748b`
- Radio button visual à direita (círculo com ponto interno quando selecionado)
- Selecionado: `border: 2px solid #7c3aed, bg: rgba(124,58,237,0.12)`

**Seção de toggles:** Aparece abaixo dos cards assim que um perfil é selecionado. Container com `border: 2px solid #2a2a50, border-radius: 12px`. Cada toggle-row: label + hint `11px #64748b` + toggle switch.

---

## 8. Página: Dashboard

**Estrutura:**
```
[Sidebar] | [Título + subtítulo]
          | [Cards de dispositivos]
          | [Botão de voz]
          | [Ativações recentes]
```

**Card de dispositivo ativo:**
```
padding: 16px 18px; border-radius: 12px
background: rgba(124,58,237,0.12)
border: 2px solid #7c3aed
ícone: 26px
nome: 16px, font-weight: 700, cor #fff
status: 11px, UPPERCASE, letter-spacing 1px, cor #a78bfa (ON) / #475569 (OFF)
toggle: 52x28px (especificação acima)
```

**Card de dispositivo inativo:**
```
background: rgba(255,255,255,0.03)
border: 2px solid #2a2a50
status: cor #475569
```

**Botão de voz:**
```
Ícone circular 42x42px com border: 2px solid #7c3aed
Texto: "Ativar microfone" + subtítulo "Clique e fale um comando"
Container: border: 2px solid #2a2a50, border-radius: 12px
```

**Ativações recentes:** Usa o mesmo card do histórico (ver seção 10), sem a coluna de filtros.

---

## 9. Página: Automações

**Cards de automação existentes:**

```
[Card]
  ┌─ Header: [ícone 22px] [nome 15px bold] [badge ATIVA/DESLIGADA] [toggle] [🗑]
  └─ Body:   "Quando: [descrição do gatilho]"
             "O sistema vai: [ligar/desligar] o [dispositivo] automaticamente"
```

**Badge ATIVA:** `bg: rgba(34,197,94,0.12), border: 1px solid rgba(34,197,94,0.3), cor: #22c55e, texto: "⚡ ATIVA"`  
**Badge DESLIGADA:** `bg: rgba(100,116,139,0.1), border: 1px solid rgba(100,116,139,0.2), cor: #64748b, texto: "● DESLIGADA"`  
**Card desligado:** `opacity: 0.65`

**Formulário nova automação:** Mantém a lógica de steps com chips, mas com o novo visual (chips ON/OFF conforme especificação, steps numerados com círculo roxo).

---

## 10. Página: Histórico

**Cards de registro:**

```
[Card]
  ┌─ Header: [ícone 20px] [nome 14px bold] [data/hora] [badge LIGOU/DESLIGOU/etc]
  └─ Body:   "Ativado por: [descrição completa do gatilho]"
```

**Formato de data/hora:** `"Hoje, 01/06 · 14h32"` / `"Ontem, 31/05 · 08h00"` / `"29/05 · 10h00"` (para datas mais antigas)  
**Cor da data/hora:** `#e2e8f0`, `13px, font-weight: 600`

**Badges de estado:**
- LIGOU / ATIVOU / ABRIU: `bg rgba(34,197,94,0.12), border rgba(34,197,94,0.3), cor #22c55e`
- DESLIGOU / DESATIVOU / FECHOU: `bg rgba(239,68,68,0.12), border rgba(239,68,68,0.3), cor #ef4444`

**Filtros:** Duas fileiras de chips — Gatilho e Período — com o mesmo estilo de chip (ativo em roxo).

**"Ativado por" — descrições:**
| Gatilho | Texto |
|---|---|
| voz | 🎤 Voz — "[comando falado]" |
| botao | 🔘 Botão no dashboard |
| presenca | 👁️ Sensor de presença detectou movimento |
| horario | ⏰ Agendamento de horário programado |
| temperatura | 🌡️ Temperatura [subiu acima / baixou abaixo] de X°C |

---

## 11. Arquivos a modificar

| Arquivo | O que muda |
|---|---|
| `css/app.css` | Reescrever: novas variáveis, novo `.sidebar`, novos componentes (device-card, toggle, btn, chip, badge) |
| `login.html` | Novo layout centralizado com logo + card |
| `profile.html` | Lista vertical de perfis + novo comportamento de toggles |
| `dashboard.html` | Substituir header por sidebar, novos device cards, novo botão de voz |
| `automation.html` | Substituir header por sidebar, novos cards com "Quando/O sistema vai", novo formulário |
| `history.html` | Substituir header por sidebar, novos cards com data/hora e "Ativado por" |
| `js/profile.js` | Remover `updateTogglesFromProfiles()`, todos os toggles sempre visíveis |
| `js/history.js` | Atualizar formatação de timestamp para "Hoje, DD/MM · HHhMM" |
| `js/automation.js` | Atualizar renderização dos cards com novo formato |

---

## 12. O que NÃO muda

- Toda a lógica de negócio (Firebase, autenticação, sincronização com Arduino)
- Os dados dos perfis (IDs, triggers — apenas descrições visuais mudam)
- A estrutura de steps do formulário de automação
- O backend e o protocolo Arduino↔Backend
