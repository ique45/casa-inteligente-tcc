# Redesign Frontend — Casa Inteligente

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar visualmente as 5 páginas do frontend com estilo Clean & Alto Contraste, sidebar de navegação e acessibilidade para público idoso/com dificuldade visual.

**Architecture:** CSS reescrito primeiro (Task 1), depois cada página HTML atualizada individualmente. Mudanças de JS são cirúrgicas — apenas funções de renderização e formatação. Lógica de negócio (Firebase, auth, sync Arduino) não é tocada.

**Tech Stack:** HTML5, CSS3, JavaScript vanilla, Firebase compat SDK 10.12.0

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `css/app.css` | Reescrita completa: novas variáveis, sidebar, device-card, badges, history-card, automation-card |
| `login.html` | Novo layout centralizado com logo + card com borda |
| `profile.html` | Lista vertical de perfis; sem tags de gatilho |
| `js/profile.js` | Novas descrições dos perfis; remover `updateTogglesFromProfiles()` |
| `dashboard.html` | Sidebar + novo HTML de device cards + nova seção de voz |
| `js/dashboard.js` | `renderDevices()`, `updateDeviceUI()`, `listenArduinoStatus()`, `loadHistory()`, `formatRelativeTime()` |
| `automation.html` | Sidebar; remover nav listeners do HTML |
| `js/automation.js` | `loadAutomations()` — novo card "Quando/O sistema vai" |
| `history.html` | Sidebar; remover nav listeners do HTML |
| `js/history.js` | `formatTime()` com data + `loadHistory()` com novo card |

---

## Task 1: Reescrever css/app.css

**Files:**
- Modify: `css/app.css`

- [ ] **Step 1: Substituir todo o conteúdo de app.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #050510;
  --bg-card: #0d0d1f;
  --bg-card2: #0a0a18;
  --purple: #7c3aed;
  --purple-light: #a78bfa;
  --purple-glow: rgba(124, 58, 237, 0.12);
  --text: #ffffff;
  --text-muted: #94a3b8;
  --border: #2a2a50;
  --border-active: #7c3aed;
  --success: #22c55e;
  --danger: #ef4444;
  --radius: 12px;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-size: 16px;
}

/* ─── LAYOUT ─────────────────────────────── */

.app-layout { display: flex; min-height: 100vh; }

/* ─── SIDEBAR ────────────────────────────── */

.sidebar {
  width: 160px;
  background: #0a0a1e;
  border-right: 2px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 28px;
  padding: 0 6px;
}

.sidebar-logo-dot {
  width: 10px; height: 10px;
  background: var(--purple);
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(124, 58, 237, 0.6);
}

.sidebar-logo-text {
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.5px;
  line-height: 1.3;
}

.sidebar-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.sidebar-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; border-radius: 10px;
  cursor: pointer; text-decoration: none;
  font-size: 13px; font-weight: 500;
  color: var(--text-muted);
  background: none; border: none;
  width: 100%; text-align: left;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}

.sidebar-item:hover { background: var(--purple-glow); color: var(--text); }
.sidebar-item.active { background: var(--purple); color: #fff; font-weight: 700; }

.sidebar-item-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }

.sidebar-item-danger {
  margin-top: auto;
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.sidebar-item-danger:hover { background: rgba(239,68,68,0.08); color: var(--danger); }

.sidebar-footer {
  margin-top: 16px; padding: 10px 12px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.25);
  border-radius: 8px;
}
.sidebar-footer-label { color: #22c55e; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
.sidebar-footer-value { color: #22c55e; font-size: 11px; font-weight: 600; margin-top: 2px; }
.sidebar-footer.offline { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); }
.sidebar-footer.offline .sidebar-footer-label,
.sidebar-footer.offline .sidebar-footer-value { color: var(--danger); }

/* ─── MAIN CONTENT ───────────────────────── */

.page-body { flex: 1; padding: 28px 32px; overflow-y: auto; }

/* ─── BUTTONS ────────────────────────────── */

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 13px 24px; border-radius: 10px;
  font-size: 15px; font-weight: 700;
  cursor: pointer; border: none; transition: all 0.2s;
  font-family: inherit;
}
.btn-primary { background: var(--purple); color: #fff; border: 2px solid var(--purple-light); }
.btn-primary:hover { background: #6d28d9; }
.btn-secondary { background: transparent; color: var(--purple-light); border: 2px solid var(--border); }
.btn-secondary:hover { background: var(--purple-glow); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--purple-light); outline-offset: 2px; }

/* ─── FORM ───────────────────────────────── */

.form-group { margin-bottom: 18px; }

.form-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  color: var(--text-muted); letter-spacing: 1px;
  text-transform: uppercase; margin-bottom: 8px;
}

.form-input, .form-select {
  width: 100%; padding: 13px 16px;
  background: var(--bg-card2); border: 2px solid var(--border);
  border-radius: 10px; color: var(--text); font-size: 14px;
  font-family: inherit;
}
.form-input:focus, .form-select:focus {
  outline: none; border-color: var(--purple);
  box-shadow: 0 0 0 3px var(--purple-glow);
}
.form-input::placeholder { color: var(--text-muted); }

/* ─── DEVICE TOGGLE ──────────────────────── */

.device-toggle {
  width: 52px; height: 28px;
  background: #1a1a35; border-radius: 14px;
  position: relative; flex-shrink: 0;
  border: 2px solid var(--border);
  transition: background 0.2s, border-color 0.2s;
  pointer-events: none;
}
.device-toggle.on { background: var(--purple); border-color: var(--purple-light); }
.device-toggle .toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #475569; transition: transform 0.2s, background 0.2s;
}
.device-toggle.on .toggle-thumb { transform: translateX(24px); background: #fff; }

/* ─── PROFILE TOGGLE ─────────────────────── */

.toggle-switch {
  position: relative; width: 48px; height: 26px;
  background: var(--border); border-radius: 13px;
  cursor: pointer; transition: background 0.2s;
  border: 2px solid transparent; flex-shrink: 0;
}
.toggle-switch.on { background: var(--purple); border-color: var(--purple-light); }
.toggle-switch::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #475569; transition: transform 0.2s, background 0.2s;
}
.toggle-switch.on::after { transform: translateX(22px); background: #fff; }
.toggle-switch:focus { outline: 2px solid var(--purple-light); outline-offset: 2px; }

/* ─── BADGES ─────────────────────────────── */

.badge {
  display: inline-block; padding: 4px 10px;
  border-radius: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
}
.badge-online  { background: rgba(34,197,94,0.12);  color: var(--success); border: 1px solid rgba(34,197,94,0.3); }
.badge-offline { background: rgba(239,68,68,0.12);  color: var(--danger);  border: 1px solid rgba(239,68,68,0.3); }
.badge-active  { background: rgba(34,197,94,0.12);  color: var(--success); border: 1px solid rgba(34,197,94,0.3); }
.badge-disabled{ background: rgba(100,116,139,0.1); color: var(--text-muted); border: 1px solid rgba(100,116,139,0.2); }
.badge-state-on { background: rgba(34,197,94,0.12); color: var(--success); border: 1px solid rgba(34,197,94,0.3); padding: 5px 12px; border-radius: 8px; }
.badge-state-off{ background: rgba(239,68,68,0.12); color: var(--danger);  border: 1px solid rgba(239,68,68,0.3); padding: 5px 12px; border-radius: 8px; }

/* ─── DEVICE CARDS ───────────────────────── */

.device-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: rgba(255,255,255,0.03);
  border: 2px solid var(--border); border-radius: var(--radius);
  cursor: pointer; transition: all 0.2s;
  width: 100%; text-align: left;
  color: var(--text); font-family: inherit;
}
.device-card.on { background: var(--purple-glow); border-color: var(--border-active); }
.device-card:hover:not(:disabled) { border-color: var(--purple-light); }
.device-card:disabled { opacity: 0.7; cursor: wait; }
.device-card-icon { font-size: 26px; flex-shrink: 0; }
.device-card-info { flex: 1; min-width: 0; }
.device-card-name { font-size: 16px; font-weight: 700; color: #fff; }
.device-card-status {
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  color: #475569; margin-top: 3px;
}
.device-card.on .device-card-status { color: var(--purple-light); }

/* ─── PROFILE CARDS ──────────────────────── */

.profile-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  background: rgba(255,255,255,0.03);
  border: 2px solid var(--border); border-radius: var(--radius);
  cursor: pointer; transition: all 0.2s;
}
.profile-card:hover { border-color: var(--purple-light); }
.profile-card.selected { background: var(--purple-glow); border-color: var(--border-active); }
.profile-card-icon {
  width: 44px; height: 44px;
  background: rgba(255,255,255,0.06); border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; flex-shrink: 0;
}
.profile-card.selected .profile-card-icon { background: rgba(124,58,237,0.3); }
.profile-card-info { flex: 1; }
.profile-card-name { font-size: 15px; font-weight: 700; color: #fff; }
.profile-card-desc { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.profile-card.selected .profile-card-desc { color: var(--purple-light); }
.profile-radio {
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--border); background: #1a1a35;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
}
.profile-radio.selected { background: var(--purple); border-color: var(--purple-light); }
.profile-radio.selected::after {
  content: ''; width: 8px; height: 8px; background: #fff; border-radius: 50%;
}

/* ─── TOGGLE ROW ─────────────────────────── */

.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px;
}
.toggle-row:last-child { border-bottom: none; }
.toggle-label { font-size: 14px; font-weight: 600; color: var(--text); }
.toggle-hint { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

/* ─── AUTOMATION CARDS ───────────────────── */

.automation-card {
  background: var(--bg-card); border: 2px solid var(--border);
  border-radius: var(--radius); overflow: hidden; transition: opacity 0.2s;
}
.automation-card.disabled { opacity: 0.65; }
.automation-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.automation-card-icon { font-size: 22px; flex-shrink: 0; }
.automation-card-name { flex: 1; font-size: 15px; font-weight: 700; color: #fff; }
.automation-card-body { padding: 12px 18px; background: rgba(255,255,255,0.02); }
.automation-card-when { font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
.automation-card-when strong { color: var(--purple-light); font-weight: 600; }
.automation-card-then { font-size: 12px; color: var(--text-muted); }
.automation-card-then .action-verb { color: var(--success); font-weight: 700; }

.btn-delete {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-size: 16px; padding: 4px; border-radius: 4px;
  transition: color 0.15s; flex-shrink: 0;
}
.btn-delete:hover { color: var(--danger); }

/* ─── HISTORY CARDS ──────────────────────── */

.history-card {
  background: var(--bg-card); border: 2px solid var(--border);
  border-radius: var(--radius); overflow: hidden;
}
.history-card-header {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.05);
}
.history-card-icon { font-size: 20px; flex-shrink: 0; }
.history-card-name { flex: 1; font-size: 14px; font-weight: 700; color: #fff; }
.history-card-time { font-size: 13px; font-weight: 600; color: #e2e8f0; white-space: nowrap; }
.history-card-body {
  padding: 10px 16px; background: rgba(255,255,255,0.02);
  font-size: 11px; color: var(--text-muted);
}
.history-card-body .activated-label { font-weight: 600; color: var(--text-muted); }

/* ─── CHIPS ──────────────────────────────── */

.chip-group { display: flex; flex-wrap: wrap; gap: 8px; }

.chip {
  padding: 10px 16px; border-radius: 10px;
  font-size: 14px; font-weight: 500;
  cursor: pointer; border: 2px solid var(--border);
  background: var(--bg-card2); color: var(--text-muted);
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.chip:hover { border-color: var(--purple-light); color: var(--text); }
.chip.selected { border-color: var(--purple); background: var(--purple-glow); color: var(--purple-light); font-weight: 700; }
.chip.chip-with-desc { flex-direction: column; align-items: flex-start; }
.chip .chip-main { display: flex; align-items: center; gap: 6px; }
.chip .chip-desc { font-size: 11px; color: var(--text-muted); font-weight: 400; }
.chip.selected .chip-desc { color: var(--purple-light); opacity: 0.8; }

.filter-chip {
  padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 500;
  cursor: pointer; border: 2px solid var(--border);
  background: var(--bg-card2); color: var(--text-muted); transition: all 0.15s;
}
.filter-chip:hover { border-color: var(--purple-light); color: var(--text); }
.filter-chip.active { border-color: var(--purple); background: var(--purple-glow); color: var(--purple-light); font-weight: 700; }

.suggestion-chip {
  padding: 5px 12px; border-radius: 99px; font-size: 12px;
  background: var(--border); color: var(--text-muted);
  cursor: pointer; transition: all 0.15s;
}
.suggestion-chip:hover { background: var(--purple-glow); color: var(--purple-light); }

/* ─── MISC ───────────────────────────────── */

.section-title { font-size: 18px; font-weight: 800; margin-bottom: 6px; color: #fff; }
.section-subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 20px; }
.error-msg { color: var(--danger); font-size: 13px; margin-top: 8px; }
.empty-msg { color: var(--text-muted); font-size: 14px; text-align: center; padding: 32px 0; }

.trigger-note {
  font-size: 12px; color: var(--text-muted); margin-top: 10px;
  padding: 10px 14px; background: var(--bg-card2);
  border-radius: 8px; border-left: 3px solid var(--purple);
}

.step-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;
}
.step-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 50%;
  background: var(--purple); color: #fff; font-size: 10px; font-weight: 800; flex-shrink: 0;
}

.preview-box {
  margin-top: 16px; padding: 14px 16px;
  background: var(--bg-card2); border: 2px solid var(--border);
  border-radius: 10px; font-size: 13px; color: var(--text-muted);
  min-height: 48px; transition: all 0.2s;
}
.preview-box.ready { border-color: var(--purple); color: var(--text); }
.preview-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; }

.tooltip-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--border); color: var(--text-muted); font-size: 10px;
  cursor: pointer; position: relative;
}
.tooltip-icon .tooltip-text {
  display: none; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
  background: var(--bg-card2); color: var(--text); padding: 8px 12px; border-radius: 8px;
  font-size: 12px; white-space: normal; z-index: 10; min-width: 200px; border: 1px solid var(--border);
}
.tooltip-icon:hover .tooltip-text { display: block; }

@media (max-width: 640px) {
  .sidebar { width: 56px; }
  .sidebar-item span:not(.sidebar-item-icon) { display: none; }
  .sidebar-logo-text { display: none; }
  .sidebar-footer { display: none; }
  .page-body { padding: 16px 12px; }
}
```

- [ ] **Step 2: Verificar visualmente**

Abra qualquer página do projeto no navegador. O fundo deve estar mais escuro (`#050510`). Não há sidebar ainda — isso é esperado. Verifique que não há erros de sintaxe CSS no DevTools.

- [ ] **Step 3: Commit**

```bash
git add css/app.css
git commit -m "style: reescreve app.css com novo sistema de design (alto contraste, sidebar, acessibilidade)"
```

---

## Task 2: Redesenhar login.html

**Files:**
- Modify: `login.html`

- [ ] **Step 1: Substituir o conteúdo de login.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Login</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .login-container {
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 24px;
    }
    .login-card {
      width: 100%; max-width: 380px;
    }
    .login-logo {
      text-align: center; margin-bottom: 32px;
    }
    .login-logo-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 56px; height: 56px;
      background: rgba(124,58,237,0.2); border: 2px solid var(--purple);
      border-radius: 16px; font-size: 28px; margin-bottom: 12px;
    }
    .login-logo-title {
      display: block; font-size: 20px; font-weight: 800;
      letter-spacing: 0.5px; color: #fff;
    }
    .login-logo-sub {
      display: block; font-size: 13px; color: var(--text-muted); margin-top: 4px;
    }
    .login-box {
      background: var(--bg-card); border: 2px solid var(--border);
      border-radius: 14px; padding: 28px 24px;
    }
    .divider {
      display: flex; align-items: center; gap: 12px;
      margin: 20px 0; color: var(--text-muted); font-size: 12px;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: var(--border);
    }
    .btn-google {
      width: 100%; padding: 13px; background: #fff; color: #333;
      border-radius: 10px; border: none; font-size: 14px; font-weight: 600;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 8px; font-family: inherit;
    }
    .btn-google:hover { background: #f1f1f1; }
    .toggle-mode {
      text-align: center; margin-top: 20px;
      font-size: 13px; color: var(--text-muted);
    }
    .toggle-mode a { color: var(--purple-light); cursor: pointer; font-weight: 700; text-decoration: underline; }
    #btn-submit { width: 100%; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo-icon">🏠</div>
        <span class="login-logo-title">Casa Inteligente</span>
        <span class="login-logo-sub">Automação para acessibilidade</span>
      </div>

      <div class="login-box">
        <div class="form-group">
          <label class="form-label" for="input-email">E-mail</label>
          <input type="email" id="input-email" class="form-input" placeholder="seu@email.com"/>
        </div>
        <div class="form-group">
          <label class="form-label" for="input-senha">Senha</label>
          <input type="password" id="input-senha" class="form-input" placeholder="••••••••"/>
        </div>

        <div id="error-msg" class="error-msg" style="display:none"></div>

        <button id="btn-submit" class="btn btn-primary">Entrar</button>

        <div class="divider">ou</div>

        <button class="btn-google" id="btn-google">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Entrar com Google
        </button>

        <div class="toggle-mode">
          <span id="toggle-text">Não tem conta? </span>
          <a id="toggle-link">Criar minha conta</a>
        </div>
      </div>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/auth.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verificar no navegador**

Abra `login.html`. Deve aparecer:
- Fundo `#050510` (quase preto)
- Ícone 🏠 centralizado com borda roxa
- Card com borda visível `#2a2a50`
- Labels dos campos em maiúsculas (E-MAIL, SENHA)
- Botão "Entrar" roxo com borda de contorno
- Botão Google branco
- Link "Criar minha conta" em roxo sublinhado

- [ ] **Step 3: Commit**

```bash
git add login.html
git commit -m "style: redesenha página de login com novo visual"
```

---

## Task 3: Redesenhar profile.html e profile.js

**Files:**
- Modify: `profile.html`
- Modify: `js/profile.js`

- [ ] **Step 1: Substituir profile.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Perfil</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .profiles-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    .toggles-container {
      border: 2px solid var(--border); border-radius: var(--radius); overflow: hidden;
      margin-bottom: 24px;
    }
    #btn-save { width: 100%; }
  </style>
</head>
<body>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-dot"></div>
        <span class="sidebar-logo-text">CASA<br>INTELIGENTE</span>
      </div>
      <div class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-item" id="btn-dashboard">
          <span class="sidebar-item-icon">🏠</span><span>Dashboard</span>
        </a>
        <a href="automation.html" class="sidebar-item" id="btn-automations">
          <span class="sidebar-item-icon">⚡</span><span>Automações</span>
        </a>
        <a href="history.html" class="sidebar-item" id="btn-history-page">
          <span class="sidebar-item-icon">📋</span><span>Histórico</span>
        </a>
        <a href="profile.html" class="sidebar-item active">
          <span class="sidebar-item-icon">👤</span><span>Perfil</span>
        </a>
        <button class="sidebar-item sidebar-item-danger" id="btn-logout">
          <span class="sidebar-item-icon">🚪</span><span>Sair</span>
        </button>
      </div>
    </nav>

    <div class="page-body">
      <h2 class="section-title">Selecione seu perfil</h2>
      <p class="section-subtitle">Escolha um ou mais que descrevem sua necessidade</p>

      <div class="profiles-list" id="profiles-grid"></div>

      <div id="toggles-section" style="display:none">
        <h3 class="section-title" style="font-size:16px;margin-bottom:12px">O que você quer usar?</h3>
        <div class="toggles-container" id="toggles-list"></div>
      </div>

      <p id="loading-msg" style="color:var(--text-muted);font-size:14px;margin-bottom:8px">Carregando suas configurações...</p>
      <p id="profile-hint" style="color:var(--text-muted);font-size:13px;margin-bottom:8px;display:none">Selecione pelo menos um perfil para continuar.</p>
      <p id="error-msg" class="error-msg" style="display:none"></p>
      <button class="btn btn-primary" id="btn-save" disabled>Salvar configurações</button>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/profile.js"></script>
</body>
</html>
```

- [ ] **Step 2: Atualizar PROFILES e remover auto-seleção em profile.js**

Substituir o bloco `const PROFILES = [...]` e a função `updateTogglesFromProfiles` e `renderProfiles`:

```javascript
const PROFILES = [
  {
    id: 'mobilidade',
    name: 'Mobilidade Reduzida',
    icon: '♿',
    desc: 'Dificuldade de movimento ou locomoção'
  },
  {
    id: 'visual',
    name: 'Deficiência Visual',
    icon: '👁️',
    desc: 'Baixa visão ou dificuldade de leitura'
  },
  {
    id: 'idoso',
    name: 'Idoso',
    icon: '🏠',
    desc: 'Prefere interface simples e clara'
  }
];
```

Substituir a função `renderProfiles`:

```javascript
function renderProfiles() {
  const list = document.getElementById('profiles-grid');
  list.innerHTML = PROFILES.map(p => `
    <div class="profile-card ${selectedProfiles.has(p.id) ? 'selected' : ''}" data-id="${p.id}">
      <div class="profile-card-icon">${p.icon}</div>
      <div class="profile-card-info">
        <div class="profile-card-name">${escapeHtml(p.name)}</div>
        <div class="profile-card-desc">${escapeHtml(p.desc)}</div>
      </div>
      <div class="profile-radio ${selectedProfiles.has(p.id) ? 'selected' : ''}"></div>
    </div>
  `).join('');

  list.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (selectedProfiles.has(id)) { selectedProfiles.delete(id); }
      else { selectedProfiles.add(id); }
      renderProfiles();
      renderToggles();
      updateSaveBtn();
    });
  });
}
```

Substituir a função `updateTogglesFromProfiles` pelo seguinte (não faz mais nada — toggles são independentes):

```javascript
function updateTogglesFromProfiles() {
  // Toggles são independentes do perfil — o usuário escolhe livremente.
}
```

Substituir a função `renderToggles` para mostrar todos os toggles sempre que houver perfil selecionado:

```javascript
function renderToggles() {
  const section = document.getElementById('toggles-section');
  const list = document.getElementById('toggles-list');

  if (selectedProfiles.size === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  ALL_TOGGLES.forEach(t => {
    if (toggleStates[t.id] === undefined) toggleStates[t.id] = false;
  });

  list.innerHTML = ALL_TOGGLES.map(t => {
    const isOn = toggleStates[t.id] === true;
    return `
      <div class="toggle-row">
        <div>
          <div class="toggle-label">${t.label}</div>
          ${t.hint ? `<div class="toggle-hint">${t.hint}</div>` : ''}
        </div>
        <div class="toggle-switch ${isOn ? 'on' : ''}" role="switch" aria-checked="${isOn}" tabindex="0" data-id="${t.id}"></div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      toggleStates[sw.dataset.id] = !sw.classList.contains('on');
      sw.classList.toggle('on');
      sw.setAttribute('aria-checked', String(sw.classList.contains('on')));
    });
  });
}
```

- [ ] **Step 3: Verificar no navegador**

Faça login e acesse `profile.html`. Deve aparecer:
- Sidebar à esquerda com item "Perfil" ativo (roxo)
- Cards de perfil em lista vertical com ícone + nome + descrição + radio button
- Ao selecionar um perfil: radio fica roxo, card fica com borda roxa
- Seção de toggles aparece com TODOS os 5 toggles — independente do perfil escolhido
- Toggles maiores (48x26px) com label em 14px

- [ ] **Step 4: Commit**

```bash
git add profile.html js/profile.js
git commit -m "style: redesenha página de perfil; toggles independentes do perfil selecionado"
```

---

## Task 4: Redesenhar dashboard.html e dashboard.js

**Files:**
- Modify: `dashboard.html`
- Modify: `js/dashboard.js`

- [ ] **Step 1: Substituir dashboard.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Dashboard</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .devices-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
    .voice-btn {
      display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; background: rgba(255,255,255,0.04);
      border: 2px solid var(--border); border-radius: var(--radius);
      cursor: pointer; transition: all 0.2s; width: 100%;
      font-family: inherit; color: var(--text); text-align: left;
      margin-bottom: 8px;
    }
    .voice-btn.listening { border-color: var(--purple); background: var(--purple-glow); }
    .voice-btn-icon {
      width: 42px; height: 42px; flex-shrink: 0;
      background: rgba(124,58,237,0.3); border: 2px solid var(--purple);
      border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px;
    }
    .voice-btn-title { font-size: 15px; font-weight: 700; }
    .voice-btn-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .mic-status { font-size: 13px; color: var(--text-muted); margin-bottom: 28px; display: block; }
    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .offline-hint {
      display: none; font-size: 13px; color: var(--danger);
      margin-bottom: 12px; padding: 10px 14px;
      background: rgba(239,68,68,0.08); border-radius: 8px;
      border-left: 3px solid var(--danger);
    }
    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
    }
    .link-ver-mais {
      font-size: 13px; color: var(--purple-light); cursor: pointer; font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-dot"></div>
        <span class="sidebar-logo-text">CASA<br>INTELIGENTE</span>
      </div>
      <div class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-item active" id="btn-dashboard">
          <span class="sidebar-item-icon">🏠</span><span>Dashboard</span>
        </a>
        <a href="automation.html" class="sidebar-item" id="btn-automations">
          <span class="sidebar-item-icon">⚡</span><span>Automações</span>
        </a>
        <a href="history.html" class="sidebar-item" id="btn-history-page">
          <span class="sidebar-item-icon">📋</span><span>Histórico</span>
        </a>
        <a href="profile.html" class="sidebar-item" id="btn-profile">
          <span class="sidebar-item-icon">👤</span><span>Perfil</span>
        </a>
        <button class="sidebar-item sidebar-item-danger" id="btn-logout">
          <span class="sidebar-item-icon">🚪</span><span>Sair</span>
        </button>
      </div>
      <div class="sidebar-footer" id="arduino-sidebar">
        <div class="sidebar-footer-label">● ARDUINO</div>
        <div class="sidebar-footer-value" id="arduino-status-text">Verificando...</div>
      </div>
    </nav>

    <div class="page-body">
      <h2 class="section-title">Seus dispositivos</h2>
      <p class="section-subtitle">Toque para ligar ou desligar</p>

      <p class="offline-hint" id="offline-hint">
        ⚠️ Arduino offline — o último estado definido aqui será aplicado assim que a conexão for restabelecida.
      </p>

      <div class="devices-list" id="devices-grid">
        <div class="empty-msg">Carregando dispositivos…</div>
      </div>

      <div id="voice-section" style="display:none">
        <h2 class="section-title">Controle por voz</h2>
        <button class="voice-btn" id="btn-mic">
          <div class="voice-btn-icon">🎤</div>
          <div>
            <div class="voice-btn-title">Ativar microfone</div>
            <div class="voice-btn-sub">Clique e fale um comando</div>
          </div>
        </button>
        <span class="mic-status" id="mic-status">Clique para falar um comando</span>
      </div>

      <div class="section-header">
        <h2 class="section-title" style="margin:0">Ativações recentes</h2>
        <a class="link-ver-mais" onclick="window.location.href='history.html'">Ver histórico completo →</a>
      </div>
      <div class="history-list" id="history-list">
        <div class="empty-msg">Nenhuma ativação ainda.</div>
      </div>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/voice.js"></script>
  <script src="js/dashboard.js"></script>
</body>
</html>
```

- [ ] **Step 2: Atualizar renderDevices() em dashboard.js**

```javascript
function renderDevices() {
  const grid = document.getElementById('devices-grid');
  if (activeToggles.botao === false) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:14px">
      Controle por botão desativado.
      <span style="color:var(--purple-light);cursor:pointer" onclick="window.location.href='profile.html'">
        Ativar nas configurações de perfil →
      </span>
    </p>`;
    return;
  }
  grid.innerHTML = DEVICES.map(d => `
    <button class="device-card" id="btn-${d.id}" data-id="${d.id}">
      <span class="device-card-icon">${d.icon}</span>
      <div class="device-card-info">
        <div class="device-card-name">${escapeHtml(d.name)}</div>
        <div class="device-card-status" id="state-${d.id}">${d.labelOff.toUpperCase()}</div>
      </div>
      <div class="device-toggle" id="toggle-${d.id}">
        <div class="toggle-thumb"></div>
      </div>
    </button>
  `).join('');

  grid.querySelectorAll('.device-card').forEach(btn => {
    btn.addEventListener('click', () => toggleDevice(btn.dataset.id));
  });
}
```

- [ ] **Step 3: Atualizar updateDeviceUI() em dashboard.js**

```javascript
function updateDeviceUI(deviceId, isOn) {
  const d = DEVICES.find(x => x.id === deviceId);
  const btn = document.getElementById(`btn-${deviceId}`);
  const stateEl = document.getElementById(`state-${deviceId}`);
  const toggleEl = document.getElementById(`toggle-${deviceId}`);
  if (!btn || !stateEl || !d) return;
  if (!btn.disabled) {
    btn.classList.toggle('on', isOn);
    if (toggleEl) toggleEl.classList.toggle('on', isOn);
    stateEl.textContent = isOn ? d.labelOn.toUpperCase() : d.labelOff.toUpperCase();
  }
}
```

- [ ] **Step 4: Atualizar listenArduinoStatus() em dashboard.js**

```javascript
function listenArduinoStatus() {
  _rtdbStatusRef = rtdb.ref(`arduino_status/${currentUser.uid}`);
  _rtdbStatusRef.on('value', snap => {
    const data = snap.val() || {};
    const sidebar = document.getElementById('arduino-sidebar');
    const statusText = document.getElementById('arduino-status-text');
    const offlineHint = document.getElementById('offline-hint');
    if (data.online) {
      if (sidebar) sidebar.className = 'sidebar-footer';
      if (statusText) statusText.textContent = 'Online';
      if (offlineHint) offlineHint.style.display = 'none';
    } else {
      if (sidebar) sidebar.className = 'sidebar-footer offline';
      if (statusText) statusText.textContent = 'Offline';
      if (offlineHint) offlineHint.style.display = 'block';
    }
  });
}
```

- [ ] **Step 5: Atualizar loadHistory() e formatRelativeTime() em dashboard.js**

Substituir `formatRelativeTime`:

```javascript
function formatRelativeTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now - 86400000);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (isToday) return `Hoje, ${dayMonth} · ${time}`;
  if (isYesterday) return `Ontem, ${dayMonth} · ${time}`;
  return `${dayMonth} · ${time}`;
}
```

Substituir o bloco de renderização dentro de `loadHistory()` (dentro de `snap.docs.map`):

```javascript
list.innerHTML = snap.docs.map(doc => {
  const d = doc.data();
  const ts = d.timestamp ? formatRelativeTime(new Date(d.timestamp.toMillis())) : '—';
  const stateLabels = { portao: ['Aberto','Fechado'], alarme: ['Armado','Desarmado'] };
  const [labelOn, labelOff] = stateLabels[d.deviceId] || ['Ligado','Desligado'];
  const stateLabel = d.state ? labelOn.toUpperCase() : labelOff.toUpperCase();
  const stateClass = d.state ? 'badge-state-on' : 'badge-state-off';
  const TRIGGER_ICONS = { voz:'🎤', botao:'🔘', presenca:'👁️', horario:'⏰', temperatura:'🌡️' };
  const DEVICE_ICONS = { luz:'💡', ventilador:'🌀', portao:'🚪', alarme:'🔔' };
  const deviceIcon = DEVICE_ICONS[d.deviceId] || '⚙️';
  return `
    <div class="history-card">
      <div class="history-card-header">
        <span class="history-card-icon">${deviceIcon}</span>
        <div class="history-card-name">${escapeHtml(d.device)}</div>
        <div class="history-card-time">${ts}</div>
        <span class="badge ${stateClass}">${stateLabel}</span>
      </div>
    </div>
  `;
}).join('');
```

- [ ] **Step 6: Remover listeners de navegação obsoletos do final de dashboard.js**

Apagar estas 4 linhas (os links `<a href>` no HTML já fazem a navegação):

```javascript
// REMOVER estas linhas:
document.getElementById('btn-profile').addEventListener('click', () => { window.location.href = 'profile.html'; });
document.getElementById('btn-automations').addEventListener('click', () => { window.location.href = 'automation.html'; });
document.getElementById('btn-history-page').addEventListener('click', () => { window.location.href = 'history.html'; });
```

Manter apenas:
```javascript
document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 7: Verificar no navegador**

Acesse `dashboard.html`. Verificar:
- Sidebar à esquerda com "Dashboard" ativo (roxo)
- Rodapé da sidebar mostra "● ARDUINO / Online" (verde) ou "Offline" (vermelho)
- Device cards em lista vertical: ícone 26px, nome 16px bold, status em maiúsculas
- Clicar num card: borda fica roxa, toggle desliza para a direita, status muda para LIGADO/ABERTO etc
- Seção de voz com botão circular de microfone
- Ativações recentes com o novo card (ícone + nome + hora + badge)

- [ ] **Step 8: Commit**

```bash
git add dashboard.html js/dashboard.js
git commit -m "style: redesenha dashboard com sidebar, device cards e histórico atualizados"
```

---

## Task 5: Redesenhar automation.html e automation.js

**Files:**
- Modify: `automation.html`
- Modify: `js/automation.js`

- [ ] **Step 1: Substituir automation.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Automações</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .automations-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    .form-card {
      background: var(--bg-card); border: 2px solid var(--border);
      border-radius: var(--radius); padding: 24px;
    }
    .form-step { margin-bottom: 20px; }
    .section-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-dot"></div>
        <span class="sidebar-logo-text">CASA<br>INTELIGENTE</span>
      </div>
      <div class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-item" id="btn-dashboard">
          <span class="sidebar-item-icon">🏠</span><span>Dashboard</span>
        </a>
        <a href="automation.html" class="sidebar-item active" id="btn-automations">
          <span class="sidebar-item-icon">⚡</span><span>Automações</span>
        </a>
        <a href="history.html" class="sidebar-item" id="btn-history-page">
          <span class="sidebar-item-icon">📋</span><span>Histórico</span>
        </a>
        <a href="profile.html" class="sidebar-item" id="btn-profile">
          <span class="sidebar-item-icon">👤</span><span>Perfil</span>
        </a>
        <button class="sidebar-item sidebar-item-danger" id="btn-logout">
          <span class="sidebar-item-icon">🚪</span><span>Sair</span>
        </button>
      </div>
    </nav>

    <div class="page-body">
      <div class="section-header">
        <div>
          <h2 class="section-title" style="margin:0">Minhas automações</h2>
          <p class="section-subtitle" style="margin:4px 0 0">Regras automáticas para seus dispositivos</p>
        </div>
        <button class="btn btn-primary" id="btn-new-auto">+ Nova automação</button>
      </div>

      <div class="automations-list" id="automations-list">
        <div class="empty-msg">Nenhuma automação cadastrada ainda.</div>
      </div>

      <div id="form-wrap" style="display:none">
        <div class="form-card">
          <div class="form-step">
            <div class="step-label"><span class="step-num">1</span> Dispositivo</div>
            <div class="chip-group" id="device-chips"></div>
          </div>

          <div class="form-step" id="step-name" style="display:none">
            <div class="form-group" style="margin:0">
              <label class="form-label" for="input-name">
                <span class="step-num">2</span> Nome
                <span class="tooltip-icon" tabindex="0">ⓘ<span class="tooltip-text">Nome para identificar essa automação. Aparece no histórico. Ex: "Luz Cozinha".</span></span>
              </label>
              <input type="text" id="input-name" class="form-input" placeholder="Ex: Luz Cozinha" maxlength="40"/>
            </div>
          </div>

          <div class="form-step" id="step-trigger" style="display:none">
            <div class="step-label">
              <span class="step-num">3</span> Gatilho
              <span class="tooltip-icon" tabindex="0">ⓘ<span class="tooltip-text">O que vai acionar essa automação: sua voz, um botão no site, sensor de presença, temperatura ou horário programado.</span></span>
            </div>
            <div class="chip-group" id="trigger-chips"></div>
          </div>

          <div class="form-step" id="step-voice" style="display:none">
            <div class="form-group" style="margin:0">
              <label class="form-label" for="input-voice">
                <span class="step-num">4</span> Comando de voz
                <span class="tooltip-icon" tabindex="0">ⓘ<span class="tooltip-text">A frase exata que você vai falar para ativar essa automação.</span></span>
              </label>
              <div class="chip-group" id="voice-suggestions" style="margin-bottom:10px"></div>
              <input type="text" id="input-voice" class="form-input" placeholder="Ex: Ligar luz da sala" maxlength="60"/>
            </div>
          </div>

          <div class="form-step" id="step-action" style="display:none">
            <div class="step-label"><span class="step-num" id="action-step-num">5</span> Ação</div>
            <div class="chip-group" id="action-chips"></div>
          </div>

          <div id="preview-wrap" style="display:none">
            <div class="preview-label">Como vai funcionar:</div>
            <div class="preview-box" id="preview-box">—</div>
          </div>

          <p id="auto-error-msg" class="error-msg" style="display:none;margin-top:12px"></p>
          <button class="btn btn-primary" id="btn-save-auto" style="display:none;margin-top:16px">Salvar automação</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/automation.js"></script>
</body>
</html>
```

- [ ] **Step 2: Atualizar loadAutomations() em automation.js**

Substituir o bloco `list.innerHTML = snap.docs.map(doc => { ... }).join('')` dentro de `loadAutomations()`:

```javascript
list.innerHTML = snap.docs.map(doc => {
  const d = doc.data();
  const device = DEVICES.find(x => x.id === d.deviceType);
  const isEnabled = d.enabled !== false;

  // Texto "Quando:"
  let whenText = '';
  if (d.trigger === 'voz') whenText = `você falar <strong>"${escapeHtml(d.voiceCommand || '')}"</strong>`;
  else if (d.trigger === 'botao') whenText = `você clicar no botão do dashboard`;
  else if (d.trigger === 'presenca') whenText = `o sensor detectar presença`;
  else if (d.trigger === 'temperatura') whenText = `o sensor de temperatura disparar`;
  else if (d.trigger === 'horario') whenText = `chegar o horário programado`;
  else whenText = escapeHtml(d.trigger);

  // Texto "O sistema vai:"
  const actionObj = getActions(d.deviceType).find(a => a.id === d.action);
  const actionVerb = escapeHtml(actionObj ? actionObj.label.toLowerCase() : (d.action || '?'));
  const thenText = `<span class="action-verb">${actionVerb}</span> o <strong>${escapeHtml(d.deviceName)}</strong> automaticamente`;

  const badgeClass = isEnabled ? 'badge badge-active' : 'badge badge-disabled';
  const badgeText = isEnabled ? '⚡ ATIVA' : '● DESLIGADA';

  return `
    <div class="automation-card ${isEnabled ? '' : 'disabled'}">
      <div class="automation-card-header">
        <span class="automation-card-icon">${device?.icon || '⚙️'}</span>
        <div class="automation-card-name">${escapeHtml(d.deviceName)}</div>
        <span class="${badgeClass}">${badgeText}</span>
        <div class="toggle-switch ${isEnabled ? 'on' : ''}" data-id="${doc.id}" role="switch" aria-checked="${isEnabled}" tabindex="0"></div>
        <button class="btn-delete" data-id="${doc.id}" aria-label="Excluir automação" title="Excluir">🗑️</button>
      </div>
      <div class="automation-card-body">
        <div class="automation-card-when"><span style="color:var(--text-muted);font-weight:600">Quando: </span>${whenText}</div>
        <div class="automation-card-then"><span style="color:var(--text-muted);font-weight:600">O sistema vai: </span>${thenText}</div>
      </div>
    </div>
  `;
}).join('');
```

- [ ] **Step 3: Remover listeners de navegação obsoletos do final de automation.js**

Apagar estas linhas (navegação já está nos links `<a href>`):

```javascript
// REMOVER:
document.getElementById('btn-dashboard').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
document.getElementById('btn-profile').addEventListener('click', () => { window.location.href = 'profile.html'; });
document.getElementById('btn-history-page').addEventListener('click', () => { window.location.href = 'history.html'; });
```

Manter apenas:
```javascript
document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 4: Verificar no navegador**

Acesse `automation.html`. Verificar:
- Sidebar com "Automações" ativo
- Cards existentes mostram "Quando: [texto]" e "O sistema vai: [ação]"
- Card com badge "⚡ ATIVA" (verde) ou "● DESLIGADA" (cinza)
- Card desligado tem opacidade reduzida
- Toggle no card ativa/desativa a regra (badge e opacidade mudam)
- Botão "+ Nova automação" abre o formulário com chips

- [ ] **Step 5: Commit**

```bash
git add automation.html js/automation.js
git commit -m "style: redesenha automações com cards Quando/O sistema vai e badge de status"
```

---

## Task 6: Redesenhar history.html e history.js

**Files:**
- Modify: `history.html`
- Modify: `js/history.js`

- [ ] **Step 1: Substituir history.html**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Histórico</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .filters { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
    .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .filter-label { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: var(--text-muted); min-width: 80px; text-transform: uppercase; }
    .history-table { display: flex; flex-direction: column; gap: 8px; }
    .btn-load-more { width: 100%; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="app-layout">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-dot"></div>
        <span class="sidebar-logo-text">CASA<br>INTELIGENTE</span>
      </div>
      <div class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-item" id="btn-dashboard">
          <span class="sidebar-item-icon">🏠</span><span>Dashboard</span>
        </a>
        <a href="automation.html" class="sidebar-item" id="btn-automations">
          <span class="sidebar-item-icon">⚡</span><span>Automações</span>
        </a>
        <a href="history.html" class="sidebar-item active" id="btn-history-page">
          <span class="sidebar-item-icon">📋</span><span>Histórico</span>
        </a>
        <a href="profile.html" class="sidebar-item" id="btn-profile">
          <span class="sidebar-item-icon">👤</span><span>Perfil</span>
        </a>
        <button class="sidebar-item sidebar-item-danger" id="btn-logout">
          <span class="sidebar-item-icon">🚪</span><span>Sair</span>
        </button>
      </div>
    </nav>

    <div class="page-body">
      <h2 class="section-title">Histórico de ativações</h2>
      <p class="section-subtitle">Tudo que aconteceu nos seus dispositivos</p>

      <div class="filters">
        <div class="filter-row">
          <span class="filter-label">Gatilho</span>
          <span class="filter-chip active" data-filter="trigger" data-value="todos">Todos</span>
          <span class="filter-chip" data-filter="trigger" data-value="voz">🎤 Voz</span>
          <span class="filter-chip" data-filter="trigger" data-value="botao">🔘 Botão</span>
          <span class="filter-chip" data-filter="trigger" data-value="presenca">👁️ Presença</span>
          <span class="filter-chip" data-filter="trigger" data-value="horario">⏰ Horário</span>
          <span class="filter-chip" data-filter="trigger" data-value="temperatura">🌡️ Temperatura</span>
        </div>
        <div class="filter-row">
          <span class="filter-label">Período</span>
          <span class="filter-chip active" data-filter="period" data-value="todos">Todos os dias</span>
          <span class="filter-chip" data-filter="period" data-value="hoje">Hoje</span>
          <span class="filter-chip" data-filter="period" data-value="7dias">7 dias</span>
          <span class="filter-chip" data-filter="period" data-value="30dias">30 dias</span>
        </div>
      </div>

      <div class="history-table" id="history-table">
        <div class="empty-msg">Carregando...</div>
      </div>

      <button class="btn btn-secondary btn-load-more" id="btn-load-more" style="display:none">
        Carregar mais registros
      </button>
    </div>
  </div>

  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js"></script>
  <script src="js/firebase-config.js"></script>
  <script src="js/history.js"></script>
</body>
</html>
```

- [ ] **Step 2: Atualizar formatTime() em history.js**

```javascript
function formatTime(date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now - 86400000);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const dayMonth = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (isToday) return `Hoje, ${dayMonth} · ${time}`;
  if (isYesterday) return `Ontem, ${dayMonth} · ${time}`;
  return `${dayMonth} · ${time}`;
}
```

- [ ] **Step 3: Adicionar DEVICE_ICONS e buildActivatedBy() em history.js** (antes de `loadHistory`)

```javascript
const DEVICE_ICONS = { luz: '💡', ventilador: '🌀', portao: '🚪', alarme: '🔔' };

function buildActivatedBy(d) {
  if (d.trigger === 'voz')         return `🎤 Comando de voz`;
  if (d.trigger === 'botao')       return `🔘 Botão no dashboard`;
  if (d.trigger === 'presenca')    return `👁️ Sensor de presença detectou movimento`;
  if (d.trigger === 'horario')     return `⏰ Agendamento de horário programado`;
  if (d.trigger === 'temperatura') return `🌡️ Sensor de temperatura disparou`;
  return `⚙️ ${escapeHtml(d.trigger)}`;
}

const ACTION_LABELS = {
  portao: { on: 'ABRIU',    off: 'FECHOU'    },
  alarme: { on: 'ARMOU',    off: 'DESARMOU'  }
};

function actionText(deviceId, state) {
  const labels = ACTION_LABELS[deviceId];
  if (labels) return state ? labels.on : labels.off;
  return state ? 'LIGOU' : 'DESLIGOU';
}
```

- [ ] **Step 4: Atualizar o bloco de renderização dentro de loadHistory() em history.js**

Substituir o `table.insertAdjacentHTML('beforeend', ...)` existente:

```javascript
docs.forEach(doc => {
  const d = doc.data();
  const ts = d.timestamp ? formatTime(new Date(d.timestamp.toMillis())) : '—';
  const deviceIcon = DEVICE_ICONS[d.deviceId] || '⚙️';
  const label = actionText(d.deviceId, d.state);
  const stateClass = d.state ? 'badge-state-on' : 'badge-state-off';
  const activatedBy = buildActivatedBy(d);

  table.insertAdjacentHTML('beforeend', `
    <div class="history-card">
      <div class="history-card-header">
        <span class="history-card-icon">${deviceIcon}</span>
        <div class="history-card-name">${escapeHtml(d.device)}</div>
        <div class="history-card-time">${ts}</div>
        <span class="badge ${stateClass}">${label}</span>
      </div>
      <div class="history-card-body">
        <span class="activated-label">Ativado por: </span>${activatedBy}
      </div>
    </div>
  `);
});
```

- [ ] **Step 5: Remover listeners de navegação obsoletos do final de history.js**

Apagar estas linhas:

```javascript
// REMOVER:
document.getElementById('btn-dashboard').addEventListener('click', () => { window.location.href = 'dashboard.html'; });
document.getElementById('btn-automations').addEventListener('click', () => { window.location.href = 'automation.html'; });
document.getElementById('btn-profile').addEventListener('click', () => { window.location.href = 'profile.html'; });
```

Manter apenas:
```javascript
document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 6: Verificar no navegador**

Acesse `history.html`. Verificar:
- Sidebar com "Histórico" ativo
- Filtros de gatilho e período com labels em maiúsculas
- Cada registro tem cabeçalho (ícone + nome + "Hoje, 01/06 · 14h32" + badge LIGOU/DESLIGOU/ABRIU etc)
- Linha de detalhe: "Ativado por: 🎤 Comando de voz"
- Badge verde para estado ON, vermelho para estado OFF

- [ ] **Step 7: Commit**

```bash
git add history.html js/history.js
git commit -m "style: redesenha histórico com cards expandidos, data completa e texto de gatilho"
```
