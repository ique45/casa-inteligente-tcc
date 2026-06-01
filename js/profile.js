function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

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
let _profileInitialized = false;

auth.onAuthStateChanged(async user => {
  if (!user) {
    _profileInitialized = false;
    selectedProfiles.clear();
    toggleStates = {};
    window.location.href = 'login.html';
    return;
  }
  if (_profileInitialized) return;
  _profileInitialized = true;
  currentUser = user;
  selectedProfiles.clear();
  toggleStates = {};

  try {
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
  } catch (err) {
    console.error('Erro ao carregar perfil:', err);
    document.getElementById('loading-msg').textContent = 'Erro ao carregar. Recarregue a página.';
  }
});

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
  // Toggles são independentes do perfil — o usuário escolhe livremente.
}

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

document.getElementById('btn-save').addEventListener('click', async () => {
  if (!currentUser) return;
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  try {
    await db.collection('users').doc(currentUser.uid).set({
      activeProfiles: [...selectedProfiles],
      activeToggles: { ...toggleStates }
    }, { merge: true });
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Erro ao salvar perfil:', err);
    let el = document.getElementById('error-msg');
    if (!el) {
      el = document.createElement('p');
      el.id = 'error-msg';
      el.className = 'error-msg';
      btn.insertAdjacentElement('afterend', el);
    }
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
