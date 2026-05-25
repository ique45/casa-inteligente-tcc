# Casa Inteligente — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um web app funcional + firmware para automação residencial acessível — controle de dispositivos físicos por botão no site, voz ou sensores.

**Architecture:** Firebase gerencia auth, estado dos dispositivos (Realtime DB) e dados (Firestore) diretamente pelo browser via SDK. O backend Node.js/Express no Railway registra histórico e serve como API para gatilhos externos. O ESP8266 faz ponte WiFi/Firebase → Arduino Mega que controla os GPIOs.

**Tech Stack:** HTML/CSS/JS + Firebase JS SDK (compat v10) + Node.js/Express + Firebase Admin SDK + Arduino IDE (C++)

---

## Mapa de Arquivos

```
TCC/
├── index.html           (existente — NÃO modificar)
├── styles.css           (existente — NÃO modificar)
├── script.js            (existente — NÃO modificar)
├── login.html
├── profile.html
├── dashboard.html
├── automation.html
├── history.html
├── css/
│   └── app.css          (tema escuro compartilhado por todas as páginas do app)
├── js/
│   ├── firebase-config.js   (inicialização Firebase — compartilhado)
│   ├── auth.js              (login, cadastro, Google auth, redirect guard)
│   ├── profile.js           (cards de perfil + toggles)
│   ├── dashboard.js         (estado dos dispositivos, controles rápidos, histórico recente)
│   ├── automation.js        (formulário editor, campos condicionais, salvar no Firestore)
│   ├── history.js           (tabela, filtros por data e tipo)
│   └── voice.js             (Web Speech API + matching de comandos)
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── firebase-admin.js
│   ├── routes/
│   │   └── devices.js
│   ├── Procfile
│   ├── .env.example
│   └── __tests__/
│       └── devices.test.js
└── firmware/
    ├── esp8266/
    │   └── esp8266.ino
    └── arduino/
        └── arduino.ino
```

---

## Task 1: Configuração do Firebase (Manual)

**Files:**
- Create: `js/firebase-config.js`

- [ ] **Step 1: Criar projeto no Firebase**

  1. Acesse https://console.firebase.google.com
  2. Clique em "Adicionar projeto" → nome: `casa-inteligente-tcc`
  3. Desabilite Google Analytics → Criar projeto

- [ ] **Step 2: Ativar Firebase Authentication**

  Console → Authentication → "Começar"
  - Ative **Email/senha**
  - Ative **Google** (configure nome do app + email de suporte)

- [ ] **Step 3: Criar Firestore**

  Console → Firestore Database → "Criar banco de dados" → Modo de teste (regras abertas por 30 dias)

  Região: `southamerica-east1`

- [ ] **Step 4: Criar Realtime Database**

  Console → Realtime Database → "Criar banco de dados" → Modo de teste

  Região: `us-central1` (padrão)

- [ ] **Step 5: Pegar credenciais**

  Console → Configurações do projeto (engrenagem) → Seus apps → `</>` Web

  Nome: `casa-inteligente-web` → Registrar

  Copie o objeto `firebaseConfig` que aparece na tela.

- [ ] **Step 6: Criar `js/firebase-config.js`**

```javascript
const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "casa-inteligente-tcc.firebaseapp.com",
  databaseURL: "https://casa-inteligente-tcc-default-rtdb.firebaseio.com",
  projectId: "casa-inteligente-tcc",
  storageBucket: "casa-inteligente-tcc.appspot.com",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
```

- [ ] **Step 7: Commit**

```bash
git add js/firebase-config.js
git commit -m "feat: add Firebase config"
```

---

## Task 2: CSS Compartilhado

**Files:**
- Create: `css/app.css`

- [ ] **Step 1: Criar `css/app.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d0d1a;
  --bg-card: #1a1a2e;
  --bg-card2: #16213e;
  --purple: #7c3aed;
  --purple-light: #a78bfa;
  --purple-glow: rgba(124, 58, 237, 0.25);
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --border: #2d2d4e;
  --success: #22c55e;
  --danger: #ef4444;
  --radius: 12px;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}
.app-header .logo { font-size: 1.1rem; font-weight: 700; color: var(--purple-light); }
.app-header .user-menu { cursor: pointer; color: var(--text-muted); font-size: 0.85rem; }

.page-body { max-width: 900px; margin: 0 auto; padding: 24px 16px; }

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  transition: border-color 0.2s;
}
.card.selected { border-color: var(--purple); background: var(--bg-card2); }

/* Buttons */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 10px 20px; border-radius: 8px; font-size: 0.9rem;
  font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
}
.btn-primary { background: var(--purple); color: #fff; }
.btn-primary:hover { background: #6d28d9; }
.btn-secondary { background: transparent; color: var(--purple-light); border: 1px solid var(--purple); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Form */
.form-group { margin-bottom: 16px; }
.form-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;
}
.form-input, .form-select {
  width: 100%; padding: 10px 14px; background: var(--bg-card2);
  border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 0.95rem;
}
.form-input:focus, .form-select:focus { outline: none; border-color: var(--purple); }
.form-input::placeholder { color: var(--text-muted); }

/* Toggle */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid var(--border);
}
.toggle-label { font-size: 0.9rem; }
.toggle-switch {
  position: relative; width: 44px; height: 24px;
  background: var(--border); border-radius: 12px;
  cursor: pointer; transition: background 0.2s;
}
.toggle-switch.on { background: var(--purple); }
.toggle-switch::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
}
.toggle-switch.on::after { transform: translateX(20px); }

/* Status badge */
.badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
.badge-online { background: rgba(34,197,94,0.15); color: var(--success); }
.badge-offline { background: rgba(239,68,68,0.15); color: var(--danger); }

/* Tooltip */
.tooltip-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--border); color: var(--text-muted);
  font-size: 0.7rem; cursor: pointer; position: relative;
}
.tooltip-icon .tooltip-text {
  display: none; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
  background: #1e293b; color: var(--text); padding: 8px 12px; border-radius: 8px;
  font-size: 0.8rem; white-space: normal; z-index: 10; min-width: 200px;
  border: 1px solid var(--border);
}
.tooltip-icon:hover .tooltip-text { display: block; }

/* Error */
.error-msg { color: var(--danger); font-size: 0.85rem; margin-top: 8px; }

/* Section title */
.section-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 16px; }

/* Device control button */
.device-btn {
  display: flex; flex-direction: column; align-items: center;
  padding: 16px; background: var(--bg-card2);
  border: 1px solid var(--border); border-radius: var(--radius);
  cursor: pointer; transition: all 0.2s; min-width: 100px;
}
.device-btn.on { border-color: var(--purple); background: var(--purple-glow); }
.device-btn .device-icon { font-size: 1.8rem; margin-bottom: 6px; }
.device-btn .device-name { font-size: 0.8rem; color: var(--text-muted); }
.device-btn .device-state { font-size: 0.75rem; font-weight: 600; margin-top: 4px; }
.device-btn.on .device-state { color: var(--purple-light); }
```

- [ ] **Step 2: Verificação visual**

  Crie um `login.html` vazio (só com a tag `<link rel="stylesheet" href="css/app.css">`) e abra no browser — fundo deve estar escuro (#0d0d1a).

- [ ] **Step 3: Commit**

```bash
git add css/app.css
git commit -m "feat: add shared app CSS (dark purple theme)"
```

---

## Task 3: Tela de Login

**Files:**
- Create: `login.html`
- Create: `js/auth.js`

- [ ] **Step 1: Criar `login.html`**

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
      min-height: 100vh; padding: 20px;
    }
    .login-box {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 36px 32px; width: 100%; max-width: 420px;
    }
    .login-logo { font-size: 1.4rem; font-weight: 800; color: var(--purple-light); margin-bottom: 8px; }
    .login-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 28px; }
    .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--text-muted); font-size: 0.8rem; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
    .btn-google {
      width: 100%; padding: 10px; background: #fff; color: #333; border-radius: 8px;
      border: none; font-size: 0.9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-google:hover { background: #f1f1f1; }
    .toggle-mode { text-align: center; margin-top: 16px; font-size: 0.85rem; color: var(--text-muted); }
    .toggle-mode a { color: var(--purple-light); cursor: pointer; text-decoration: underline; }
    #btn-submit { width: 100%; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-box">
      <div class="login-logo">Casa Inteligente</div>
      <p class="login-subtitle">Automação residencial para acessibilidade</p>

      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" id="input-email" class="form-input" placeholder="seu@email.com"/>
      </div>
      <div class="form-group">
        <label class="form-label">Senha</label>
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
        <a id="toggle-link">Cadastrar</a>
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

- [ ] **Step 2: Criar `js/auth.js`**

```javascript
// Redireciona para dashboard se já logado
auth.onAuthStateChanged(user => {
  if (user && window.location.pathname.includes('login.html')) {
    window.location.href = 'profile.html';
  }
});

let isSignup = false;

document.getElementById('toggle-link').addEventListener('click', () => {
  isSignup = !isSignup;
  document.getElementById('btn-submit').textContent = isSignup ? 'Cadastrar' : 'Entrar';
  document.getElementById('toggle-text').textContent = isSignup ? 'Já tem conta? ' : 'Não tem conta? ';
  document.getElementById('toggle-link').textContent = isSignup ? 'Entrar' : 'Cadastrar';
  hideError();
});

document.getElementById('btn-submit').addEventListener('click', async () => {
  const email = document.getElementById('input-email').value.trim();
  const senha = document.getElementById('input-senha').value;
  if (!email || !senha) return showError('Preencha email e senha.');

  try {
    if (isSignup) {
      const cred = await auth.createUserWithEmailAndPassword(email, senha);
      await db.collection('users').doc(cred.user.uid).set({
        email,
        name: email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        activeProfiles: [],
        activeToggles: {}
      });
    } else {
      await auth.signInWithEmailAndPassword(email, senha);
    }
    window.location.href = 'profile.html';
  } catch (err) {
    showError(translateError(err.code));
  }
});

document.getElementById('btn-google').addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const cred = await auth.signInWithPopup(provider);
    const userDoc = db.collection('users').doc(cred.user.uid);
    const snap = await userDoc.get();
    if (!snap.exists) {
      await userDoc.set({
        email: cred.user.email,
        name: cred.user.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        activeProfiles: [],
        activeToggles: {}
      });
    }
    window.location.href = 'profile.html';
  } catch (err) {
    showError(translateError(err.code));
  }
});

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error-msg').style.display = 'none';
}

function translateError(code) {
  const msgs = {
    'auth/user-not-found': 'Email não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/email-already-in-use': 'Email já cadastrado.',
    'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
    'auth/invalid-email': 'Email inválido.',
    'auth/popup-closed-by-user': 'Login cancelado.'
  };
  return msgs[code] || 'Erro ao autenticar. Tente novamente.';
}
```

- [ ] **Step 3: Testar no Chrome**

  Abra `login.html`. Verifique:
  - Fundo escuro, botão roxo ✓
  - Alternar entre Entrar/Cadastrar ✓
  - Cadastro cria usuário no Firebase Console → Authentication ✓
  - Login redireciona para `profile.html` (página em branco por enquanto — normal) ✓

- [ ] **Step 4: Commit**

```bash
git add login.html js/auth.js
git commit -m "feat: add login/signup page with Firebase Auth"
```

---

## Task 4: Seleção de Perfil

**Files:**
- Create: `profile.html`
- Create: `js/profile.js`

- [ ] **Step 1: Criar `profile.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Perfil</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .profiles-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px; margin-bottom: 32px;
    }
    .profile-card {
      padding: 20px 16px; cursor: pointer; text-align: center;
      border: 2px solid var(--border); border-radius: var(--radius);
      background: var(--bg-card); transition: all 0.2s;
    }
    .profile-card:hover { border-color: var(--purple-light); }
    .profile-card.selected { border-color: var(--purple); background: var(--purple-glow); }
    .profile-card .icon { font-size: 2.2rem; margin-bottom: 10px; }
    .profile-card .name { font-weight: 700; margin-bottom: 6px; }
    .profile-card .desc { font-size: 0.78rem; color: var(--text-muted); }
    .profile-card .triggers { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
    .trigger-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 99px; background: var(--border); color: var(--text-muted); }
    .profile-card.selected .trigger-tag { background: rgba(124,58,237,0.3); color: var(--purple-light); }

    .toggles-list { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .toggles-list .toggle-row { padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .toggles-list .toggle-row:last-child { border-bottom: none; }

    #btn-save { margin-top: 24px; width: 100%; }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="logo">Casa Inteligente</div>
    <div class="user-menu" id="btn-logout">Sair</div>
  </header>

  <div class="page-body">
    <h2 class="section-title">Selecione seu perfil</h2>
    <p style="color:var(--text-muted);margin-bottom:20px;font-size:0.9rem">
      Escolha um ou mais perfis para configurar as funções disponíveis.
    </p>

    <div class="profiles-grid" id="profiles-grid"></div>

    <div id="toggles-section" style="display:none">
      <h3 class="section-title">Ajuste fino das funções</h3>
      <div class="toggles-list" id="toggles-list"></div>
    </div>

    <button class="btn btn-primary" id="btn-save">Salvar e continuar</button>
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

- [ ] **Step 2: Criar `js/profile.js`**

```javascript
const PROFILES = [
  {
    id: 'mobilidade',
    name: 'Mobilidade Reduzida',
    icon: '♿',
    desc: 'Controle por voz e botões acessíveis',
    triggers: ['voz', 'botao']
  },
  {
    id: 'visual',
    name: 'Deficiência Visual',
    icon: '👁️',
    desc: 'Automação por sensor de presença e voz',
    triggers: ['voz', 'presenca']
  },
  {
    id: 'idoso',
    name: 'Idoso',
    icon: '🏠',
    desc: 'Automações por horário e temperatura',
    triggers: ['botao', 'horario', 'temperatura']
  }
];

const ALL_TOGGLES = [
  { id: 'voz',         label: '🎤 Controle por voz' },
  { id: 'botao',       label: '🔘 Botão no site/app' },
  { id: 'presenca',    label: '👁️ Sensor de presença' },
  { id: 'horario',     label: '⏰ Agendamento por horário' },
  { id: 'temperatura', label: '🌡️ Sensor de temperatura' }
];

let selectedProfiles = new Set();
let toggleStates = {};
let currentUser = null;

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;

  const snap = await db.collection('users').doc(user.uid).get();
  if (snap.exists) {
    const data = snap.data();
    (data.activeProfiles || []).forEach(p => selectedProfiles.add(p));
    toggleStates = data.activeToggles || {};
  }

  renderProfiles();
  renderToggles();
});

function renderProfiles() {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = PROFILES.map(p => `
    <div class="profile-card ${selectedProfiles.has(p.id) ? 'selected' : ''}" data-id="${p.id}">
      <div class="icon">${p.icon}</div>
      <div class="name">${p.name}</div>
      <div class="desc">${p.desc}</div>
      <div class="triggers">${p.triggers.map(t => `<span class="trigger-tag">${t}</span>`).join('')}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (selectedProfiles.has(id)) { selectedProfiles.delete(id); }
      else { selectedProfiles.add(id); }
      card.classList.toggle('selected');
      updateTogglesFromProfiles();
      renderToggles();
    });
  });
}

function updateTogglesFromProfiles() {
  const profileTriggers = new Set();
  PROFILES.filter(p => selectedProfiles.has(p.id))
    .forEach(p => p.triggers.forEach(t => profileTriggers.add(t)));
  profileTriggers.forEach(t => {
    if (toggleStates[t] === undefined) toggleStates[t] = true;
  });
}

function renderToggles() {
  const section = document.getElementById('toggles-section');
  const list = document.getElementById('toggles-list');

  if (selectedProfiles.size === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const profileTriggers = new Set();
  PROFILES.filter(p => selectedProfiles.has(p.id))
    .forEach(p => p.triggers.forEach(t => profileTriggers.add(t)));

  ALL_TOGGLES.forEach(t => {
    if (toggleStates[t.id] === undefined) toggleStates[t.id] = profileTriggers.has(t.id);
  });

  list.innerHTML = ALL_TOGGLES.map(t => {
    const isOn = toggleStates[t.id] === true;
    return `
      <div class="toggle-row">
        <span class="toggle-label">${t.label}</span>
        <div class="toggle-switch ${isOn ? 'on' : ''}" data-id="${t.id}"></div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => {
      toggleStates[sw.dataset.id] = !sw.classList.contains('on');
      sw.classList.toggle('on');
    });
  });
}

document.getElementById('btn-save').addEventListener('click', async () => {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).update({
    activeProfiles: [...selectedProfiles],
    activeToggles: toggleStates
  });
  window.location.href = 'dashboard.html';
});

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 3: Testar**

  1. Faça login → deve redirecionar para `profile.html`
  2. Clique nos cards — ficam roxos com seleção visual ✓
  3. Ao selecionar perfil, toggles aparecem ✓
  4. Clique "Salvar e continuar" → vai para `dashboard.html`
  5. Firebase Console → Firestore → `users/{uid}` → confirme `activeProfiles` e `activeToggles` salvos ✓

- [ ] **Step 4: Commit**

```bash
git add profile.html js/profile.js
git commit -m "feat: add profile selection page with cards and toggles"
```

---

## Task 5: Dashboard

**Files:**
- Create: `dashboard.html`
- Create: `js/dashboard.js`
- Create: `js/voice.js` (stub — implementação completa na Task 8)

- [ ] **Step 1: Criar `dashboard.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Dashboard</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .status-row {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
      padding: 14px 16px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: var(--radius);
    }
    .status-row .status-label { color: var(--text-muted); font-size: 0.85rem; }
    .status-row .sync-time { margin-left: auto; font-size: 0.78rem; color: var(--text-muted); }

    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .section-header a { font-size: 0.82rem; color: var(--purple-light); text-decoration: none; }

    .devices-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }

    .voice-btn {
      width: 100%; padding: 14px; background: var(--bg-card2);
      border: 2px dashed var(--border); border-radius: var(--radius);
      color: var(--text-muted); font-size: 0.9rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.2s; margin-bottom: 24px;
    }
    .voice-btn.listening { border-color: var(--purple); color: var(--purple-light); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.6 } }

    .history-list { display: flex; flex-direction: column; gap: 8px; }
    .history-item {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; font-size: 0.85rem;
    }
    .history-item .h-icon { font-size: 1rem; }
    .history-item .h-name { flex: 1; }
    .history-item .h-time { color: var(--text-muted); font-size: 0.78rem; }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="logo">Casa Inteligente</div>
    <div style="display:flex;gap:16px;align-items:center">
      <a href="automation.html" style="color:var(--purple-light);font-size:0.85rem;text-decoration:none">+ Nova automação</a>
      <a href="history.html" style="color:var(--text-muted);font-size:0.85rem;text-decoration:none">Histórico</a>
      <div class="user-menu" id="btn-logout">Sair</div>
    </div>
  </header>

  <div class="page-body">
    <!-- Status Arduino -->
    <div class="status-row">
      <span id="arduino-badge" class="badge badge-offline">Offline</span>
      <span class="status-label">Arduino</span>
      <span class="sync-time" id="sync-time">—</span>
    </div>

    <!-- Controles rápidos -->
    <div class="section-header">
      <h2 class="section-title" style="margin:0">Controles rápidos</h2>
    </div>
    <div class="devices-grid" id="devices-grid">
      <p style="color:var(--text-muted);font-size:0.85rem">
        Nenhuma automação cadastrada.
        <a href="automation.html" style="color:var(--purple-light)">Criar automação</a>
      </p>
    </div>

    <!-- Voz -->
    <button class="voice-btn" id="btn-voice">🎤 Clique para ativar comando de voz</button>

    <!-- Histórico recente -->
    <div class="section-header">
      <h2 class="section-title" style="margin:0">Ativações recentes</h2>
      <a href="history.html">Ver tudo</a>
    </div>
    <div class="history-list" id="history-list">
      <p style="color:var(--text-muted);font-size:0.85rem">Nenhuma ativação ainda.</p>
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

- [ ] **Step 2: Criar `js/voice.js` (stub)**

```javascript
// Stub — implementação completa na Task 8
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-voice');
  if (btn) btn.addEventListener('click', () => {
    btn.textContent = '🎤 Reconhecimento de voz — disponível em breve';
  });
});
```

- [ ] **Step 3: Criar `js/dashboard.js`**

```javascript
const TRIGGER_ICONS = {
  voz: '🎤', botao: '🔘', presenca: '👁️', horario: '⏰', temperatura: '🌡️', site: '🖥️'
};

let currentUser = null;

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  listenArduinoStatus();
  await loadDevices();
  loadRecentHistory();
});

function listenArduinoStatus() {
  rtdb.ref(`devices/${currentUser.uid}/arduino`).on('value', snap => {
    const val = snap.val() || {};
    const badge = document.getElementById('arduino-badge');
    const syncEl = document.getElementById('sync-time');
    if (val.status === 'online') {
      badge.textContent = 'Online';
      badge.className = 'badge badge-online';
    } else {
      badge.textContent = 'Offline';
      badge.className = 'badge badge-offline';
    }
    if (val.lastSeen) {
      syncEl.textContent = 'Último sync: ' + new Date(val.lastSeen).toLocaleTimeString('pt-BR');
    }
  });
}

async function loadDevices() {
  const snap = await db.collection('automations').doc(currentUser.uid)
    .collection('items').where('trigger', '==', 'botao').get();
  if (snap.empty) return;

  const grid = document.getElementById('devices-grid');
  grid.innerHTML = '';

  snap.forEach(doc => {
    const auto = { id: doc.id, ...doc.data() };
    const btn = document.createElement('div');
    btn.className = 'device-btn';
    btn.innerHTML = `
      <div class="device-icon">${deviceIcon(auto.deviceType)}</div>
      <div class="device-name">${auto.deviceName}</div>
      <div class="device-state">—</div>
    `;
    grid.appendChild(btn);

    rtdb.ref(`devices/${currentUser.uid}/${auto.id}/state`).on('value', snap => {
      const state = snap.val();
      const stateEl = btn.querySelector('.device-state');
      if (state === 'on') { btn.classList.add('on'); stateEl.textContent = 'Ligado'; }
      else { btn.classList.remove('on'); stateEl.textContent = 'Desligado'; }
    });

    btn.addEventListener('click', () => toggleDevice(auto));
  });
}

async function toggleDevice(auto) {
  const stateSnap = await rtdb.ref(`devices/${currentUser.uid}/${auto.id}/state`).get();
  const current = stateSnap.val();
  let newState;
  if (auto.action === 'on') newState = 'on';
  else if (auto.action === 'off') newState = 'off';
  else newState = current === 'on' ? 'off' : 'on';

  await rtdb.ref(`devices/${currentUser.uid}/${auto.id}`).update({
    state: newState,
    lastUpdated: Date.now()
  });

  await db.collection('history').doc(currentUser.uid).collection('events').add({
    automationId: auto.id,
    deviceName: auto.deviceName,
    deviceType: auto.deviceType,
    triggeredBy: 'botao',
    action: newState,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function loadRecentHistory() {
  db.collection('history').doc(currentUser.uid).collection('events')
    .orderBy('timestamp', 'desc').limit(5)
    .onSnapshot(snap => {
      const list = document.getElementById('history-list');
      if (snap.empty) return;
      list.innerHTML = snap.docs.map(doc => {
        const e = doc.data();
        const ts = e.timestamp?.toDate ? e.timestamp.toDate().toLocaleString('pt-BR') : '—';
        return `
          <div class="history-item">
            <span class="h-icon">${TRIGGER_ICONS[e.triggeredBy] || '•'}</span>
            <span class="h-name">${e.deviceName} — <strong>${e.action === 'on' ? 'Ligado' : 'Desligado'}</strong></span>
            <span class="h-time">${ts}</span>
          </div>
        `;
      }).join('');
    });
}

function deviceIcon(type) {
  return { luz: '💡', portao: '🚪', ventilador: '🌀', alarme: '🔔' }[type] || '⚙️';
}

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 4: Testar**

  1. Abra `dashboard.html` — badge "Offline", lista vazia ✓
  2. Firebase Console → Realtime DB → crie manualmente `devices/{uid}/arduino/status = "online"` → badge muda para verde em tempo real ✓
  3. Crie automação com gatilho "Botão" em `automation.html` → volte ao dashboard → botão aparece ✓
  4. Clique no botão → Realtime DB atualiza → botão fica roxo ✓

- [ ] **Step 5: Commit**

```bash
git add dashboard.html js/dashboard.js js/voice.js
git commit -m "feat: add dashboard with realtime device controls and history"
```

---

## Task 6: Editor de Automação

**Files:**
- Create: `automation.html`
- Create: `js/automation.js`

- [ ] **Step 1: Criar `automation.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Nova Automação</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .editor-steps { display: flex; flex-direction: column; gap: 20px; }
    .step-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); padding: 20px;
    }
    .step-card.hidden { display: none; }
    .step-number {
      font-size: 0.75rem; color: var(--purple-light); font-weight: 700;
      text-transform: uppercase; margin-bottom: 12px;
      display: flex; align-items: center; gap: 6px;
    }

    .device-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .device-option {
      padding: 14px; text-align: center; cursor: pointer;
      border: 2px solid var(--border); border-radius: 8px; transition: all 0.2s;
    }
    .device-option:hover { border-color: var(--purple-light); }
    .device-option.selected { border-color: var(--purple); background: var(--purple-glow); }
    .device-option .d-icon { font-size: 1.6rem; margin-bottom: 6px; }
    .device-option .d-name { font-size: 0.85rem; font-weight: 600; }

    .trigger-options, .action-options { display: flex; flex-wrap: wrap; gap: 8px; }
    .trigger-chip, .action-chip {
      padding: 8px 16px; border-radius: 99px; cursor: pointer;
      border: 1px solid var(--border); font-size: 0.85rem; transition: all 0.2s;
    }
    .trigger-chip:hover, .action-chip:hover { border-color: var(--purple-light); }
    .trigger-chip.selected, .action-chip.selected {
      background: var(--purple); border-color: var(--purple); color: #fff;
    }

    .voice-suggestions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .voice-suggestion {
      padding: 5px 12px; border-radius: 99px; background: var(--bg-card2);
      border: 1px solid var(--border); font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
    }
    .voice-suggestion:hover { border-color: var(--purple-light); }

    .preview-box {
      background: var(--bg-card2); border: 1px solid var(--border);
      border-radius: 8px; padding: 14px 16px; font-size: 0.88rem;
      color: var(--text-muted); margin-top: 8px; min-height: 44px;
    }
    .preview-box strong { color: var(--text); }

    #btn-save { width: 100%; margin-top: 8px; }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="logo">
      <a href="dashboard.html" style="color:inherit;text-decoration:none">← Dashboard</a>
    </div>
    <div class="user-menu" id="btn-logout">Sair</div>
  </header>

  <div class="page-body">
    <h2 class="section-title">Nova automação</h2>

    <div class="editor-steps">
      <!-- Passo 1 -->
      <div class="step-card" id="step-device">
        <div class="step-number">1 — Dispositivo</div>
        <div class="device-options">
          <div class="device-option" data-type="luz"><div class="d-icon">💡</div><div class="d-name">Luz</div></div>
          <div class="device-option" data-type="portao"><div class="d-icon">🚪</div><div class="d-name">Portão</div></div>
          <div class="device-option" data-type="ventilador"><div class="d-icon">🌀</div><div class="d-name">Ventilador</div></div>
          <div class="device-option" data-type="alarme"><div class="d-icon">🔔</div><div class="d-name">Alarme</div></div>
        </div>
      </div>

      <!-- Passo 2 -->
      <div class="step-card hidden" id="step-name">
        <div class="step-number">
          2 — Nome
          <span class="tooltip-icon">ⓘ
            <span class="tooltip-text">Nome para identificar no dashboard e histórico. Ex: "Luz Cozinha", "Portão Principal".</span>
          </span>
        </div>
        <input type="text" id="input-name" class="form-input" placeholder="Ex: Luz Cozinha"/>
      </div>

      <!-- Passo 3 -->
      <div class="step-card hidden" id="step-trigger">
        <div class="step-number">3 — Gatilho</div>
        <div class="trigger-options" id="trigger-options"></div>
      </div>

      <!-- Passo 4 (condicional — só para voz) -->
      <div class="step-card hidden" id="step-voice">
        <div class="step-number">
          4 — Comando de voz
          <span class="tooltip-icon">ⓘ
            <span class="tooltip-text">Frase exata que você vai falar. Ex: "Acender luz da cozinha". Escolha uma sugestão ou escreva a sua.</span>
          </span>
        </div>
        <div class="voice-suggestions" id="voice-suggestions"></div>
        <input type="text" id="input-voice-cmd" class="form-input" placeholder="Ex: Acender luz da cozinha"/>
      </div>

      <!-- Passo 5 -->
      <div class="step-card hidden" id="step-action">
        <div class="step-number">5 — Ação</div>
        <div class="action-options">
          <div class="action-chip" data-action="toggle">Alternar</div>
          <div class="action-chip" data-action="on">Só ligar</div>
          <div class="action-chip" data-action="off">Só desligar</div>
        </div>
      </div>

      <!-- Prévia -->
      <div class="step-card">
        <div class="step-number">Prévia</div>
        <div class="preview-box" id="preview-text">Selecione um dispositivo para começar.</div>
        <button class="btn btn-primary" id="btn-save" disabled>Salvar automação</button>
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

- [ ] **Step 2: Criar `js/automation.js`**

```javascript
const TRIGGERS_BY_DEVICE = {
  luz:        ['voz', 'botao', 'presenca'],
  portao:     ['voz', 'botao', 'presenca'],
  ventilador: ['voz', 'botao', 'temperatura', 'horario'],
  alarme:     ['botao', 'presenca', 'horario']
};

const TRIGGER_LABELS = {
  voz: '🎤 Voz', botao: '🔘 Botão', presenca: '👁️ Presença',
  temperatura: '🌡️ Temperatura', horario: '⏰ Horário'
};

const VOICE_SUGGESTIONS = {
  luz:        ['Acender luz', 'Ligar luz', 'Apagar luz'],
  portao:     ['Abrir portão', 'Fechar portão'],
  ventilador: ['Ligar ventilador', 'Desligar ventilador'],
  alarme:     ['Ativar alarme', 'Desativar alarme']
};

const state = { device: null, name: '', trigger: null, voiceCmd: '', action: null };
let currentUser = null;

auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
});

// Passo 1: Dispositivo
document.querySelectorAll('.device-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.device-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    state.device = opt.dataset.type;
    state.trigger = null; state.voiceCmd = ''; state.action = null;
    show('step-name');
    hide('step-trigger'); hide('step-voice'); hide('step-action');
    updatePreview();
  });
});

// Passo 2: Nome
document.getElementById('input-name').addEventListener('input', e => {
  state.name = e.target.value.trim();
  if (state.name) { renderTriggers(); show('step-trigger'); }
  else { hide('step-trigger'); }
  updatePreview();
});

// Passo 3: Gatilho
function renderTriggers() {
  const opts = TRIGGERS_BY_DEVICE[state.device] || [];
  document.getElementById('trigger-options').innerHTML = opts.map(t =>
    `<div class="trigger-chip" data-t="${t}">${TRIGGER_LABELS[t]}</div>`
  ).join('');

  document.querySelectorAll('.trigger-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.trigger-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.trigger = chip.dataset.t;
      state.voiceCmd = '';
      if (state.trigger === 'voz') { renderVoiceSuggestions(); show('step-voice'); }
      else { hide('step-voice'); document.getElementById('input-voice-cmd').value = ''; }
      show('step-action');
      updatePreview();
    });
  });
}

// Passo 4: Comando de voz
function renderVoiceSuggestions() {
  const suggestions = VOICE_SUGGESTIONS[state.device] || [];
  document.getElementById('voice-suggestions').innerHTML = suggestions.map(s =>
    `<div class="voice-suggestion">${s}</div>`
  ).join('');

  document.querySelectorAll('.voice-suggestion').forEach(s => {
    s.addEventListener('click', () => {
      document.getElementById('input-voice-cmd').value = s.textContent;
      state.voiceCmd = s.textContent;
      updatePreview();
    });
  });
}

document.getElementById('input-voice-cmd').addEventListener('input', e => {
  state.voiceCmd = e.target.value.trim();
  updatePreview();
});

// Passo 5: Ação
document.querySelectorAll('.action-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.action-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    state.action = chip.dataset.action;
    updatePreview();
  });
});

// Prévia em tempo real
function updatePreview() {
  const el = document.getElementById('preview-text');
  const btn = document.getElementById('btn-save');
  const { device, name, trigger, voiceCmd, action } = state;

  if (!device) { el.innerHTML = 'Selecione um dispositivo para começar.'; btn.disabled = true; return; }

  const icons = { luz: '💡', portao: '🚪', ventilador: '🌀', alarme: '🔔' };
  const actionLabel = { toggle: 'alternar', on: 'ligar', off: 'desligar' }[action] || '…';
  const triggerLabel = TRIGGER_LABELS[trigger] || '…';
  const nameLabel = name || '…';
  const voicePart = trigger === 'voz' && voiceCmd ? ` ao ouvir "<strong>${voiceCmd}</strong>"` : '';

  el.innerHTML = `${icons[device] || '⚙️'} <strong>${nameLabel}</strong> — vai <strong>${actionLabel}</strong> via <strong>${triggerLabel}</strong>${voicePart}.`;

  const isComplete = device && name && trigger && action && (trigger !== 'voz' || voiceCmd);
  btn.disabled = !isComplete;
}

// Salvar
document.getElementById('btn-save').addEventListener('click', async () => {
  const { device, name, trigger, voiceCmd, action } = state;
  const doc = { deviceType: device, deviceName: name, trigger, action, enabled: true };
  if (trigger === 'voz') doc.voiceCommand = voiceCmd;

  await db.collection('automations').doc(currentUser.uid).collection('items').add(doc);
  window.location.href = 'dashboard.html';
});

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});

function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
```

- [ ] **Step 3: Testar**

  1. Abra `automation.html`
  2. Clique "Luz" → campo Nome aparece ✓
  3. Digite "Luz Cozinha" → gatilhos aparecem ✓
  4. Selecione "Voz" → campo de comando aparece, sugestões visíveis ✓
  5. Selecione "Acender luz" → preenche o campo automaticamente ✓
  6. Selecione "Alternar" → botão Salvar ativa ✓
  7. Clique Salvar → Firebase Console → `automations/{uid}/items` → documento criado ✓
  8. Repita o teste com gatilho "Botão" — campo de comando NÃO deve aparecer ✓

- [ ] **Step 4: Commit**

```bash
git add automation.html js/automation.js
git commit -m "feat: add automation editor with conditional fields and realtime preview"
```

---

## Task 7: Histórico

**Files:**
- Create: `history.html`
- Create: `js/history.js`

- [ ] **Step 1: Criar `history.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Casa Inteligente — Histórico</title>
  <link rel="stylesheet" href="css/app.css"/>
  <style>
    .filters { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .filters input, .filters select {
      padding: 8px 12px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); font-size: 0.85rem;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left; padding: 10px 14px; background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;
    }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border); font-size: 0.88rem; }
    tr:hover td { background: var(--bg-card); }
    .empty-msg { text-align: center; padding: 40px; color: var(--text-muted); }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="logo">
      <a href="dashboard.html" style="color:inherit;text-decoration:none">← Dashboard</a>
    </div>
    <div class="user-menu" id="btn-logout">Sair</div>
  </header>

  <div class="page-body">
    <h2 class="section-title">Histórico de ativações</h2>

    <div class="filters">
      <input type="date" id="filter-date"/>
      <select id="filter-type">
        <option value="">Todos os tipos</option>
        <option value="voz">🎤 Voz</option>
        <option value="botao">🔘 Botão</option>
        <option value="presenca">👁️ Presença</option>
        <option value="horario">⏰ Horário</option>
        <option value="temperatura">🌡️ Temperatura</option>
      </select>
    </div>

    <table>
      <thead>
        <tr>
          <th>Dispositivo</th>
          <th>Ação</th>
          <th>Disparado por</th>
          <th>Data/Hora</th>
        </tr>
      </thead>
      <tbody id="history-body"></tbody>
    </table>
    <p id="empty-msg" class="empty-msg" style="display:none">Nenhuma ativação encontrada.</p>
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

- [ ] **Step 2: Criar `js/history.js`**

```javascript
const TRIGGER_LABELS = {
  voz: '🎤 Voz', botao: '🔘 Botão', presenca: '👁️ Presença',
  horario: '⏰ Horário', temperatura: '🌡️ Temperatura', site: '🖥️ Site'
};

let allEvents = [];
let currentUser = null;

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  loadHistory();
});

async function loadHistory() {
  const snap = await db.collection('history').doc(currentUser.uid).collection('events')
    .orderBy('timestamp', 'desc').limit(100).get();
  allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderTable(allEvents);
}

function renderTable(events) {
  const tbody = document.getElementById('history-body');
  const empty = document.getElementById('empty-msg');

  if (events.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = events.map(e => {
    const ts = e.timestamp?.toDate ? e.timestamp.toDate().toLocaleString('pt-BR') : '—';
    const action = e.action === 'on' ? '🟢 Ligado' : '🔴 Desligado';
    return `
      <tr>
        <td>${e.deviceName}</td>
        <td>${action}</td>
        <td>${TRIGGER_LABELS[e.triggeredBy] || e.triggeredBy}</td>
        <td>${ts}</td>
      </tr>
    `;
  }).join('');
}

function applyFilters() {
  const dateFilter = document.getElementById('filter-date').value;
  const typeFilter = document.getElementById('filter-type').value;

  const filtered = allEvents.filter(e => {
    const ts = e.timestamp?.toDate ? e.timestamp.toDate() : null;
    if (dateFilter && ts) {
      const d = ts.toISOString().split('T')[0];
      if (d !== dateFilter) return false;
    }
    if (typeFilter && e.triggeredBy !== typeFilter) return false;
    return true;
  });

  renderTable(filtered);
}

document.getElementById('filter-date').addEventListener('change', applyFilters);
document.getElementById('filter-type').addEventListener('change', applyFilters);
document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
```

- [ ] **Step 3: Testar**

  1. Clique em um botão no dashboard para gerar uma ativação
  2. Abra `history.html` → ativação aparece na tabela ✓
  3. Filtro por tipo "Botão" → só entradas de botão ficam visíveis ✓
  4. Filtro por data → selecione hoje → mesmo resultado, dias anteriores some ✓

- [ ] **Step 4: Commit**

```bash
git add history.html js/history.js
git commit -m "feat: add history page with date and type filters"
```

---

## Task 8: Controle de Voz (Web Speech API)

**Files:**
- Modify: `js/voice.js` (substituir o stub)

- [ ] **Step 1: Substituir `js/voice.js` com implementação completa**

```javascript
let voiceEnabled = false;
let recognition = null;
let userAutomations = [];
let voiceUser = null;

auth.onAuthStateChanged(async user => {
  if (!user) return;
  voiceUser = user;
  const snap = await db.collection('automations').doc(user.uid)
    .collection('items').where('trigger', '==', 'voz').get();
  userAutomations = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
});

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Seu browser não suporta reconhecimento de voz. Use o Chrome.');
    return null;
  }
  const r = new SpeechRecognition();
  r.lang = 'pt-BR';
  r.continuous = false;
  r.interimResults = false;
  r.onresult = async event => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    console.log('Voz detectada:', transcript);
    await matchAndTrigger(transcript);
  };
  r.onerror = () => setVoiceBtn(false);
  r.onend = () => setVoiceBtn(false);
  return r;
}

async function matchAndTrigger(transcript) {
  const match = userAutomations.find(a =>
    a.voiceCommand && transcript.includes(a.voiceCommand.toLowerCase())
  );
  if (!match) { console.log('Nenhuma automação correspondeu:', transcript); return; }

  const stateSnap = await rtdb.ref(`devices/${voiceUser.uid}/${match.id}/state`).get();
  const current = stateSnap.val();
  let newState;
  if (match.action === 'on') newState = 'on';
  else if (match.action === 'off') newState = 'off';
  else newState = current === 'on' ? 'off' : 'on';

  await rtdb.ref(`devices/${voiceUser.uid}/${match.id}`).update({
    state: newState, lastUpdated: Date.now()
  });

  await db.collection('history').doc(voiceUser.uid).collection('events').add({
    automationId: match.id, deviceName: match.deviceName, deviceType: match.deviceType,
    triggeredBy: 'voz', action: newState,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function setVoiceBtn(listening) {
  const btn = document.getElementById('btn-voice');
  if (!btn) return;
  voiceEnabled = listening;
  if (listening) {
    btn.textContent = '🎤 Ouvindo… (clique para parar)';
    btn.classList.add('listening');
  } else {
    btn.textContent = '🎤 Clique para ativar comando de voz';
    btn.classList.remove('listening');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-voice');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (voiceEnabled) { recognition?.stop(); setVoiceBtn(false); return; }
    recognition = initVoiceRecognition();
    if (!recognition) return;
    recognition.start();
    setVoiceBtn(true);
  });
});
```

- [ ] **Step 2: Testar no Chrome**

  1. Crie automação: Luz → "Luz Cozinha" → Voz → "Acender luz" → Alternar
  2. Dashboard → clique no botão de voz
  3. Chrome pede permissão de microfone → clique Permitir
  4. Fale "Acender luz"
  5. Console do browser: `Voz detectada: acender luz` ✓
  6. Realtime DB: estado do dispositivo muda ✓
  7. Histórico: entrada com ícone 🎤 ✓

  > Funciona apenas no Chrome (desktop e Android). Firefox/Safari não suportam.

- [ ] **Step 3: Commit**

```bash
git add js/voice.js
git commit -m "feat: add Web Speech API voice command recognition"
```

---

## Task 9: Backend Node.js

**Files:**
- Create: `backend/package.json`
- Create: `backend/server.js`
- Create: `backend/firebase-admin.js`
- Create: `backend/routes/devices.js`
- Create: `backend/Procfile`
- Create: `backend/.env.example`
- Create: `backend/__tests__/devices.test.js`

- [ ] **Step 1: Criar `backend/package.json`**

```json
{
  "name": "casa-inteligente-backend",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "test": "jest --forceExit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "firebase-admin": "^12.0.0"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.3.0"
  }
}
```

- [ ] **Step 2: Instalar dependências**

  No terminal dentro de `backend/`:
  ```bash
  npm install
  ```
  Saída esperada: `added X packages`

- [ ] **Step 3: Criar `backend/.env.example`**

```
PORT=3000
FIREBASE_PROJECT_ID=casa-inteligente-tcc
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@casa-inteligente-tcc.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://casa-inteligente-tcc-default-rtdb.firebaseio.com
```

  > Para obter as credenciais: Firebase Console → Configurações do projeto → Contas de serviço → "Gerar nova chave privada" → copie os valores para `backend/.env` (não commite o arquivo `.env`!).

- [ ] **Step 4: Criar `backend/firebase-admin.js`**

```javascript
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();
const rtdb = admin.database();

module.exports = { admin, db, rtdb };
```

- [ ] **Step 5: Criar `backend/routes/devices.js`**

```javascript
const express = require('express');
const router = express.Router();

let db, rtdb, admin;
function init(deps) { db = deps.db; rtdb = deps.rtdb; admin = deps.admin; }

// POST /api/command — ativa dispositivo via gatilho externo (sensor, automação)
router.post('/command', async (req, res) => {
  const { userId, automationId, triggeredBy } = req.body;
  if (!userId || !automationId || !triggeredBy) {
    return res.status(400).json({ error: 'userId, automationId, triggeredBy são obrigatórios' });
  }

  try {
    const autoSnap = await db.collection('automations').doc(userId)
      .collection('items').doc(automationId).get();
    if (!autoSnap.exists) return res.status(404).json({ error: 'Automação não encontrada' });

    const auto = autoSnap.data();
    const stateSnap = await rtdb.ref(`devices/${userId}/${automationId}/state`).get();
    const current = stateSnap.val();

    let newState;
    if (auto.action === 'on') newState = 'on';
    else if (auto.action === 'off') newState = 'off';
    else newState = current === 'on' ? 'off' : 'on';

    await rtdb.ref(`devices/${userId}/${automationId}`).update({
      state: newState, lastUpdated: Date.now()
    });

    await db.collection('history').doc(userId).collection('events').add({
      automationId, deviceName: auto.deviceName, deviceType: auto.deviceType,
      triggeredBy, action: newState,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, state: newState });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/history/:userId — últimos 50 eventos
router.get('/history/:userId', async (req, res) => {
  try {
    const snap = await db.collection('history').doc(req.params.userId)
      .collection('events').orderBy('timestamp', 'desc').limit(50).get();
    res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = { router, init };
```

- [ ] **Step 6: Criar `backend/server.js`**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { admin, db, rtdb } = require('./firebase-admin');
const deviceRoutes = require('./routes/devices');

deviceRoutes.init({ admin, db, rtdb });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', deviceRoutes.router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
```

- [ ] **Step 7: Criar `backend/Procfile`**

```
web: node server.js
```

- [ ] **Step 8: Escrever os testes — `backend/__tests__/devices.test.js`**

```javascript
const request = require('supertest');

jest.mock('../firebase-admin', () => ({
  admin: { firestore: { FieldValue: { serverTimestamp: () => null } } },
  db: null,
  rtdb: null
}));

const deviceRoutes = require('../routes/devices');
const express = require('express');

const app = express();
app.use(express.json());

const mockAuto = { deviceName: 'Luz Cozinha', deviceType: 'luz', action: 'toggle' };
const mockDb = {
  collection: () => ({ doc: () => ({ collection: () => ({
    doc: () => ({ get: async () => ({ exists: true, data: () => mockAuto }) }),
    add: jest.fn(async () => ({}))
  }) }) })
};
const mockRtdb = {
  ref: () => ({
    get: async () => ({ val: () => 'off' }),
    update: jest.fn(async () => {})
  })
};

deviceRoutes.init({
  admin: { firestore: { FieldValue: { serverTimestamp: () => null } } },
  db: mockDb,
  rtdb: mockRtdb
});
app.use('/api', deviceRoutes.router);

describe('POST /api/command', () => {
  it('retorna 400 quando campos estão faltando', async () => {
    const res = await request(app).post('/api/command').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('retorna 200 e alterna estado off→on', async () => {
    const res = await request(app).post('/api/command').send({
      userId: 'user1', automationId: 'auto1', triggeredBy: 'botao'
    });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('on');
  });
});

describe('GET /api/history/:userId', () => {
  it('retorna 200 com array', async () => {
    const dbWithHistory = {
      collection: () => ({ doc: () => ({ collection: () => ({
        orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) })
      }) }) })
    };
    deviceRoutes.init({
      admin: { firestore: { FieldValue: { serverTimestamp: () => null } } },
      db: dbWithHistory,
      rtdb: mockRtdb
    });
    const res = await request(app).get('/api/history/user1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 9: Rodar os testes**

  Na pasta `backend/`:
  ```bash
  npm test
  ```

  Saída esperada:
  ```
  PASS __tests__/devices.test.js
    POST /api/command
      ✓ retorna 400 quando campos estão faltando
      ✓ retorna 200 e alterna estado off→on
    GET /api/history/:userId
      ✓ retorna 200 com array
  Test Suites: 1 passed, 1 total
  ```

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat: add Node.js/Express backend with device command and history routes"
```

---

## Task 10: Deploy no Railway

- [ ] **Step 1: Criar conta no Railway**

  Acesse https://railway.app → "Login with GitHub"

- [ ] **Step 2: Instalar Railway CLI**

  ```bash
  npm install -g @railway/cli
  railway login
  ```

- [ ] **Step 3: Inicializar projeto Railway dentro de `backend/`**

  ```bash
  cd backend
  railway init
  ```

  Nome sugerido: `casa-inteligente-backend`

- [ ] **Step 4: Configurar variáveis de ambiente**

  Railway Dashboard → seu projeto → "Variables" → adicione cada variável do `.env.example` com os valores reais.

  Ou via CLI:
  ```bash
  railway variables set FIREBASE_PROJECT_ID=casa-inteligente-tcc
  railway variables set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
  railway variables set "FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  railway variables set FIREBASE_DATABASE_URL=https://casa-inteligente-tcc-default-rtdb.firebaseio.com
  ```

- [ ] **Step 5: Deploy**

  ```bash
  railway up
  ```

  Saída esperada: URL pública tipo `https://casa-inteligente-backend-production.up.railway.app`

- [ ] **Step 6: Testar endpoint de saúde**

  ```bash
  curl https://SEU-DOMINIO.up.railway.app/health
  ```

  Saída esperada: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: add Railway deployment config"
```

---

## Task 11: Firmware ESP8266

**Files:**
- Create: `firmware/esp8266/esp8266.ino`

- [ ] **Step 1: Instalar bibliotecas no Arduino IDE**

  Arduino IDE → Sketch → Include Library → Manage Libraries → instale:
  - `Firebase ESP Client` by Mobizt
  - `ArduinoJson` by Benoit Blanchon

- [ ] **Step 2: Criar `firmware/esp8266/esp8266.ino`**

```cpp
#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <ArduinoJson.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ---- CONFIGURAR ANTES DE FAZER UPLOAD ----
#define WIFI_SSID     "SEU_WIFI"
#define WIFI_PASSWORD "SUA_SENHA"
#define API_KEY       "SUA_FIREBASE_API_KEY"
#define DATABASE_URL  "https://casa-inteligente-tcc-default-rtdb.firebaseio.com"
#define USER_EMAIL    "EMAIL_DO_USUARIO"
#define USER_PASSWORD "SENHA_DO_USUARIO"
#define USER_ID       "UID_DO_USUARIO"
// ------------------------------------------

FirebaseData fbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

const int MAX_DEVICES = 8;
String deviceIds[MAX_DEVICES];
int deviceCount = 0;
String lastStates[MAX_DEVICES];
unsigned long lastHeartbeat = 0;

void setup() {
  Serial.begin(9600);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  fbConfig.api_key = API_KEY;
  fbConfig.database_url = DATABASE_URL;
  fbAuth.user.email = USER_EMAIL;
  fbAuth.user.password = USER_PASSWORD;
  fbConfig.token_status_callback = tokenStatusCallback;

  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectNetwork(true);

  Firebase.RTDB.setString(&fbdo, String("devices/") + USER_ID + "/arduino/status", "online");
  Firebase.RTDB.setInt(&fbdo, String("devices/") + USER_ID + "/arduino/lastSeen", millis());

  loadDeviceIds();
}

void loadDeviceIds() {
  // Lê lista de IDs de automações do RTDB: devices/{userId}/deviceList (string separada por vírgula)
  if (Firebase.RTDB.getString(&fbdo, String("devices/") + USER_ID + "/deviceList")) {
    String list = fbdo.stringData();
    deviceCount = 0;
    int start = 0;
    for (int i = 0; i <= (int)list.length() && deviceCount < MAX_DEVICES; i++) {
      if (i == (int)list.length() || list[i] == ',') {
        String id = list.substring(start, i);
        id.trim();
        if (id.length() > 0) deviceIds[deviceCount++] = id;
        start = i + 1;
      }
    }
  }
}

void loop() {
  if (!Firebase.ready()) return;

  for (int i = 0; i < deviceCount; i++) {
    String path = String("devices/") + USER_ID + "/" + deviceIds[i] + "/state";
    if (Firebase.RTDB.getString(&fbdo, path)) {
      String state = fbdo.stringData();
      if (state != lastStates[i]) {
        lastStates[i] = state;
        sendCommandToArduino(deviceIds[i], state);
      }
    }
  }

  if (millis() - lastHeartbeat > 30000) {
    lastHeartbeat = millis();
    Firebase.RTDB.setString(&fbdo, String("devices/") + USER_ID + "/arduino/status", "online");
    Firebase.RTDB.setInt(&fbdo, String("devices/") + USER_ID + "/arduino/lastSeen", millis());
  }

  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("{")) processArduinoEvent(line);
  }

  delay(500);
}

void sendCommandToArduino(String deviceId, String state) {
  StaticJsonDocument<128> doc;
  doc["cmd"] = "relay";
  doc["id"] = deviceId;
  doc["state"] = (state == "on") ? 1 : 0;
  String out;
  serializeJson(doc, out);
  Serial.println(out);
}

void processArduinoEvent(String jsonStr) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, jsonStr)) return;

  String event = doc["event"].as<String>();
  String sensor = doc["sensor"].as<String>();
  float value = doc["value"].as<float>();

  String path = String("sensors/") + USER_ID + "/" + sensor;
  Firebase.RTDB.setFloat(&fbdo, path + "/value", value);
  Firebase.RTDB.setInt(&fbdo, path + "/lastUpdated", millis());

  if (event == "presence") {
    Firebase.RTDB.setBool(&fbdo, String("triggers/") + USER_ID + "/presence", value > 0);
  }
}
```

- [ ] **Step 3: Upload para o ESP8266**

  1. Preencha as 7 constantes no topo com suas credenciais
  2. Arduino IDE → Ferramentas → Placa → "NodeMCU 1.0 (ESP-12E Module)"
  3. Conecte ESP8266 via USB → selecione a porta COM
  4. Upload (→)

- [ ] **Step 4: Verificar no Serial Monitor (9600 baud)**

  Saída esperada após conectar:
  ```
  Token info: type = id token, status = on request
  Token info: type = id token, status = ready
  ```

  Firebase Console → Realtime DB → `devices/{uid}/arduino/status` deve mostrar `"online"` ✓

- [ ] **Step 5: Commit**

```bash
git add firmware/esp8266/
git commit -m "feat: add ESP8266 firmware (WiFi + Firebase bridge)"
```

---

## Task 12: Firmware Arduino Mega

**Files:**
- Create: `firmware/arduino/arduino.ino`

- [ ] **Step 1: Criar `firmware/arduino/arduino.ino`**

```cpp
#include <ArduinoJson.h>

// Mapeamento de dispositivos → pinos
// Substitua os IDs pelos IDs reais do Firestore após criar as automações
struct Device {
  const char* id;
  int pin;
  bool state;
};

Device devices[] = {
  { "AUTOMATION_ID_LUZ",       2, false },
  { "AUTOMATION_ID_PORTAO",    3, false },
  { "AUTOMATION_ID_VENTILADOR",4, false },
  { "AUTOMATION_ID_ALARME",    5, false }
};
const int DEVICE_COUNT = 4;

const int PIR_PIN = 7;
unsigned long lastSensorRead = 0;
int tempReadCount = 0;

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < DEVICE_COUNT; i++) {
    pinMode(devices[i].pin, OUTPUT);
    digitalWrite(devices[i].pin, LOW);
  }
  pinMode(PIR_PIN, INPUT);
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("{")) processCommand(line);
  }

  if (millis() - lastSensorRead > 5000) {
    lastSensorRead = millis();
    readSensors();
  }
}

void processCommand(String jsonStr) {
  StaticJsonDocument<128> doc;
  if (deserializeJson(doc, jsonStr)) return;

  String cmd = doc["cmd"].as<String>();
  String deviceId = doc["id"].as<String>();
  int state = doc["state"].as<int>();

  if (cmd == "relay") {
    for (int i = 0; i < DEVICE_COUNT; i++) {
      if (deviceId == devices[i].id) {
        devices[i].state = (state == 1);
        digitalWrite(devices[i].pin, devices[i].state ? HIGH : LOW);
        return;
      }
    }
  }
}

void readSensors() {
  // Sensor PIR de presença
  if (digitalRead(PIR_PIN) == HIGH) {
    StaticJsonDocument<64> doc;
    doc["event"] = "presence";
    doc["sensor"] = "pir1";
    doc["value"] = 1;
    String out;
    serializeJson(doc, out);
    Serial.println(out);
  }

  // Temperatura (substitua por leitura real do DHT11/DHT22 com a biblioteca DHT)
  // Exemplo com valor fixo para testar o pipeline:
  if (++tempReadCount >= 6) { // ~30s
    tempReadCount = 0;
    StaticJsonDocument<64> doc;
    doc["event"] = "temperature";
    doc["sensor"] = "dht1";
    doc["value"] = 25.0; // <- substituir por: dht.readTemperature()
    String out;
    serializeJson(doc, out);
    Serial.println(out);
  }
}
```

- [ ] **Step 2: Upload para o Arduino Mega**

  > **Atenção:** desconecte o fio do ESP8266 antes de fazer upload. O Serial do ESP8266 interfere no upload.

  1. Arduino IDE → Ferramentas → Placa → "Arduino Mega or Mega 2560"
  2. Selecione a porta COM do Arduino (diferente da do ESP8266)
  3. Upload (→)

- [ ] **Step 3: Substituir os IDs dos dispositivos**

  Após criar automações em `automation.html`, abra Firebase Console → Firestore → `automations/{uid}/items` → copie os IDs dos documentos → cole em `devices[].id` no Arduino e faça upload novamente.

  Também adicione os IDs em `devices/{uid}/deviceList` no Realtime DB (separados por vírgula) para o ESP8266 monitorar.

- [ ] **Step 4: Commit**

```bash
git add firmware/arduino/
git commit -m "feat: add Arduino Mega firmware (GPIO control + sensor reading)"
```

---

## Task 13: Teste End-to-End

Verifique os 3 fluxos obrigatórios para a apresentação do TCC.

- [ ] **Fluxo 1: Botão no site → dispositivo físico**

  1. Dashboard → clique no botão "Luz Cozinha"
  2. Realtime DB: `devices/{uid}/{autoId}/state` muda para `"on"` ✓
  3. Serial Monitor do Arduino: `{"cmd":"relay","id":"...","state":1}` aparece ✓
  4. Relé/LED no pino 2 acende ✓
  5. Badge do Arduino no dashboard: "Online" ✓
  6. Histórico mostra "Luz Cozinha — Ligado 🔘" ✓

- [ ] **Fluxo 2: Comando de voz → dispositivo físico**

  1. Dashboard → clique no botão de voz
  2. Fale "Acender luz"
  3. Console do Chrome: `Voz detectada: acender luz` ✓
  4. Realtime DB atualiza ✓
  5. Relé acende ✓
  6. Histórico mostra "Luz Cozinha — Ligado 🎤" ✓

- [ ] **Fluxo 3: Sensor → histórico**

  1. Passe a mão na frente do sensor PIR
  2. Arduino envia `{"event":"presence","sensor":"pir1","value":1}` via Serial
  3. ESP8266 recebe e escreve em `triggers/{uid}/presence = true` no Realtime DB ✓
  4. Abra Realtime DB no Firebase Console — valor aparece em tempo real ✓

- [ ] **Step final: Commit**

```bash
git add .
git commit -m "chore: all end-to-end flows verified and working"
```
