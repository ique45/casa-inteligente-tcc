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

// Sugestões de acessibilidade por perfil. Recalculadas do zero a cada
// clique a partir dos perfis atualmente marcados — desmarcar volta ao
// padrão (texto normal, tema claro, fala desligada). Mobilidade Reduzida
// não aparece aqui: a dificuldade é motora, não visual, então não sugere
// nada além do padrão.
const ACCESSIBILITY_SUGGESTIONS = {
  visual: { textsize: 'maior', theme: 'escuro', fala: true },
  idoso:  { textsize: 'grande', fala: true }
};
const TEXTSIZE_RANK = { normal: 0, grande: 1, maior: 2 };

function aplicarSugestoesAcessibilidade() {
  let textsize = 'normal';
  let tema = 'claro';
  let fala = false;

  selectedProfiles.forEach(id => {
    const s = ACCESSIBILITY_SUGGESTIONS[id];
    if (!s) return;
    if (s.textsize && TEXTSIZE_RANK[s.textsize] > TEXTSIZE_RANK[textsize]) textsize = s.textsize;
    if (s.theme === 'escuro') tema = 'escuro';
    if (s.fala) fala = true;
  });

  if (window.a11y) {
    if (window.a11y.getTamanho() !== textsize) window.a11y.aplicarTamanho(textsize, true);
    if (window.a11y.getTema() !== tema) window.a11y.aplicarTema(tema, true);
  }

  const falaAtual = localStorage.getItem('ci-fala') === 'on';
  if (falaAtual !== fala) {
    localStorage.setItem('ci-fala', fala ? 'on' : 'off');
    const toggleFala = document.getElementById('toggle-fala');
    if (toggleFala && !toggleFala.disabled) {
      toggleFala.classList.toggle('on', fala);
      toggleFala.setAttribute('aria-checked', String(fala));
    }
  }
}

const ALL_TOGGLES = [
  { id: 'voz', label: '🎤 Ativar o microfone', hint: 'Ativa o microfone no site.' }
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
  list.innerHTML = PROFILES.map(p => {
    const sel = selectedProfiles.has(p.id);
    return `
    <button type="button" class="profile-card ${sel ? 'selected' : ''}" data-id="${p.id}" aria-pressed="${sel}">
      <div class="profile-card-icon" aria-hidden="true">${p.icon}</div>
      <div class="profile-card-info">
        <div class="profile-card-name">${escapeHtml(p.name)}</div>
        <div class="profile-card-desc">${escapeHtml(p.desc)}</div>
      </div>
      <div class="profile-radio ${sel ? 'selected' : ''}" aria-hidden="true"></div>
    </button>
  `;
  }).join('');

  list.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      if (selectedProfiles.has(id)) { selectedProfiles.delete(id); }
      else { selectedProfiles.add(id); }
      aplicarSugestoesAcessibilidade();
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
        <button type="button" class="toggle-switch ${isOn ? 'on' : ''}" role="switch" aria-checked="${isOn}" data-id="${t.id}"></button>
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

// Confirmação falada — mora no localStorage como o tema e o tamanho do texto
// (ci-theme, ci-textsize), não no Firestore: é ajuste de acessibilidade, não
// de conta. Nasce desligada: som inesperado assusta, e o navegador bloqueia
// fala antes da primeira interação do usuário.
(function initFala() {
  const toggleFala = document.getElementById('toggle-fala');
  const btnTestar  = document.getElementById('btn-testar-fala');
  const hint       = document.getElementById('fala-hint');
  if (!toggleFala || !btnTestar) return;

  function pintar() {
    const on = localStorage.getItem('ci-fala') === 'on';
    toggleFala.classList.toggle('on', on);
    toggleFala.setAttribute('aria-checked', String(on));
  }

  function aplicarDisponibilidade() {
    const ok = speech.disponivel();
    toggleFala.disabled = !ok;
    btnTestar.disabled  = !ok;
    hint.textContent = ok
      ? 'O app fala o que aconteceu, ex.: "Luz ligada".'
      : 'Não disponível neste navegador (sem voz em português).';
  }

  toggleFala.addEventListener('click', () => {
    if (toggleFala.disabled) return;
    localStorage.setItem('ci-fala', localStorage.getItem('ci-fala') === 'on' ? 'off' : 'on');
    pintar();
  });

  btnTestar.addEventListener('click', () => {
    // Fala mesmo com o interruptor desligado, só para o usuário ouvir como é.
    const anterior = localStorage.getItem('ci-fala');
    localStorage.setItem('ci-fala', 'on');
    speech.falar('Luz ligada');
    localStorage.setItem('ci-fala', anterior || 'off');
  });

  pintar();
  aplicarDisponibilidade();
  // getVoices() volta vazio na 1ª chamada do Chrome; reavalia quando carregam.
  if ('speechSynthesis' in window) {
    window.speechSynthesis.addEventListener('voiceschanged', aplicarDisponibilidade);
  }
})();
