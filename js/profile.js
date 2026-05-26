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
        <div class="toggle-switch ${isOn ? 'on' : ''}" role="switch" aria-checked="${isOn}" tabindex="0" data-id="${t.id}"></div>
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

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
