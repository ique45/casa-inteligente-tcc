function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

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

const TRIGGER_LABELS_PROFILE = {
  voz:         '🎤 Voz',
  botao:       '🔘 Botão',
  presenca:    '👁️ Presença',
  horario:     '⏰ Horário',
  temperatura: '🌡️ Temperatura'
};

const ALL_TOGGLES = [
  { id: 'voz',         label: '🎤 Controle por voz',              hint: 'Ativa o microfone no site.' },
  { id: 'botao',       label: '🔘 Botão no dashboard',             hint: 'Permite acionar dispositivos pelos botões do dashboard.' },
  { id: 'presenca',    label: '👁️ Sensor de presença (Arduino)',  hint: 'O Arduino detecta presença e aciona dispositivos.' },
  { id: 'horario',     label: '⏰ Agendamento por horário (Arduino)', hint: 'O Arduino liga/desliga dispositivos em horários programados.' },
  { id: 'temperatura', label: '🌡️ Sensor de temperatura (Arduino)', hint: 'O Arduino age conforme a temperatura ambiente.' }
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
  document.getElementById('loading-msg').style.display = 'none';
  updateSaveBtn();
});

function renderProfiles() {
  const grid = document.getElementById('profiles-grid');
  grid.innerHTML = PROFILES.map(p => `
    <div class="profile-card ${selectedProfiles.has(p.id) ? 'selected' : ''}" data-id="${p.id}">
      <div class="icon">${p.icon}</div>
      <div class="name">${escapeHtml(p.name)}</div>
      <div class="desc">${escapeHtml(p.desc)}</div>
      <div class="triggers">${p.triggers.map(t => `<span class="trigger-tag">${TRIGGER_LABELS_PROFILE[t] || t}</span>`).join('')}</div>
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
      updateSaveBtn();
    });
  });
}

function updateSaveBtn() {
  const btn = document.getElementById('btn-save');
  const hint = document.getElementById('profile-hint');
  if (selectedProfiles.size === 0) {
    btn.disabled = true;
    if (hint) hint.style.display = 'block';
  } else {
    btn.disabled = false;
    if (hint) hint.style.display = 'none';
  }
}

function updateTogglesFromProfiles() {
  const profileTriggers = new Set();
  PROFILES.filter(p => selectedProfiles.has(p.id))
    .forEach(p => p.triggers.forEach(t => profileTriggers.add(t)));
  ALL_TOGGLES.forEach(t => {
    if (profileTriggers.has(t.id)) {
      if (toggleStates[t.id] === undefined) toggleStates[t.id] = true;
    } else {
      toggleStates[t.id] = false;
    }
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
        <div>
          <span class="toggle-label">${t.label}</span>
          ${t.hint ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${t.hint}</div>` : ''}
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

document.getElementById('btn-save').addEventListener('click', async () => {
  if (!currentUser) return;
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  try {
    await db.collection('users').doc(currentUser.uid).set({
      activeProfiles: [...selectedProfiles],
      activeToggles: toggleStates
    }, { merge: true });
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Erro ao salvar perfil:', err);
    const el = document.getElementById('error-msg') || document.createElement('p');
    el.textContent = 'Erro ao salvar. Verifique sua conexão e tente novamente.';
    el.style.display = 'block';
    btn.disabled = false;
  }
});

document.getElementById('btn-dashboard').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});
document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
