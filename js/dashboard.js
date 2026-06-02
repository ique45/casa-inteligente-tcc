function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' } },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' } },
  { id: 'portao',     name: 'Portão',     icon: '🚪', labelOn: 'Aberto',  labelOff: 'Fechado',   labelTransition: { on: 'Abrindo...',   off: 'Fechando...'   } },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔', labelOn: 'Armado',  labelOff: 'Desarmado', labelTransition: { on: 'Armando...',   off: 'Desarmando...' } }
];

let currentUser = null;
let deviceStates = {};
let automationNames = {};
let activeToggles = {};
let _dashboardInitialized = false;
let _rtdbDevicesRef = null;
let _rtdbStatusRef  = null;
let _automationNamesUnsubscribe = null;
let _historyUnsubscribe = null;

function _teardownListeners() {
  if (_rtdbDevicesRef)  { _rtdbDevicesRef.off('value');  _rtdbDevicesRef  = null; }
  if (_rtdbStatusRef)   { _rtdbStatusRef.off('value');   _rtdbStatusRef   = null; }
  if (_automationNamesUnsubscribe) { _automationNamesUnsubscribe(); _automationNamesUnsubscribe = null; }
  if (_historyUnsubscribe)         { _historyUnsubscribe();         _historyUnsubscribe         = null; }
  deviceStates    = {};
  automationNames = {};
  activeToggles   = {};
  currentUser     = null;
}

auth.onAuthStateChanged(async user => {
  if (!user) { _dashboardInitialized = false; _teardownListeners(); window.location.href = 'login.html'; return; }
  if (_dashboardInitialized) return;
  _dashboardInitialized = true;
  currentUser = user;

  try {
    const snap = await db.collection('users').doc(user.uid).get();
    const toggles = (snap.data() || {}).activeToggles || {};
    activeToggles = toggles;

    const voiceSection = document.getElementById('voice-section');
    if (toggles.voz) {
      voiceSection.style.display = 'block';
      initVoice();
    } else {
      voiceSection.style.display = 'block';
      voiceSection.innerHTML = `
        <h2 class="section-title">Controle por voz</h2>
        <p style="color:var(--text-muted);font-size:0.875rem">
          Controle por voz desativado.
          <span style="color:var(--purple-light);cursor:pointer" onclick="window.location.href='profile.html'">
            Ativar nas configurações de perfil →
          </span>
        </p>
      `;
    }

    listenAutomationNames();
    renderDevices();
    listenDeviceStates();
    listenArduinoStatus();
    loadHistory();
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    document.getElementById('devices-grid').innerHTML =
      '<p style="color:var(--text-muted)">Erro ao carregar. Verifique sua conexão e recarregue a página.</p>';
  }
});

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

function listenDeviceStates() {
  _rtdbDevicesRef = rtdb.ref(`devices/${currentUser.uid}`);
  _rtdbDevicesRef.on('value', snap => {
    const data = snap.val() || {};
    DEVICES.forEach(d => {
      const isOn = data[d.id]?.state === true;
      deviceStates[d.id] = isOn;
      updateDeviceUI(d.id, isOn);
    });
  });
}

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

function listenArduinoStatus() {
  _rtdbStatusRef = rtdb.ref(`arduino_status/${currentUser.uid}`);
  _rtdbStatusRef.on('value', snap => {
    const data = snap.val() || {};
    const sidebar = document.getElementById('arduino-sidebar');
    const statusText = document.getElementById('arduino-status-text');
    const offlineHint = document.getElementById('offline-hint');
    const mobileTopbar = document.getElementById('mobile-topbar');
    const mobileText = document.getElementById('mobile-arduino-text');
    if (data.online) {
      if (sidebar) sidebar.className = 'sidebar-footer';
      if (statusText) statusText.textContent = 'Online';
      if (offlineHint) offlineHint.style.display = 'none';
      if (mobileTopbar) mobileTopbar.className = 'mobile-topbar';
      if (mobileText) mobileText.textContent = 'Online';
    } else {
      if (sidebar) sidebar.className = 'sidebar-footer offline';
      if (statusText) statusText.textContent = 'Offline';
      if (offlineHint) offlineHint.style.display = 'block';
      if (mobileTopbar) mobileTopbar.className = 'mobile-topbar offline';
      if (mobileText) mobileText.textContent = 'Offline';
    }
  });
}

async function toggleDevice(deviceId) {
  if (!currentUser) return;
  if (deviceStates[deviceId] === undefined) return;
  const d = DEVICES.find(x => x.id === deviceId);
  const prevState = deviceStates[deviceId];
  const newState = !prevState;

  const btn = document.getElementById(`btn-${deviceId}`);
  const stateEl = document.getElementById(`state-${deviceId}`);

  if (d?.labelTransition) {
    if (stateEl) stateEl.textContent = newState ? d.labelTransition.on : d.labelTransition.off;
    if (btn) btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));
    if (!currentUser) { if (btn) btn.disabled = false; return; }
  }

  let rtdbOk = false;
  try {
    await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: newState, ts: Date.now() });
    rtdbOk = true;
    await logHistory(deviceId, 'botao', newState);
  } catch (err) {
    console.error('Erro ao acionar dispositivo:', err);
    if (!rtdbOk) updateDeviceUI(deviceId, prevState);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function listenAutomationNames() {
  if (_automationNamesUnsubscribe) _automationNamesUnsubscribe();
  _automationNamesUnsubscribe = db.collection('automations').doc(currentUser.uid)
    .collection('items').onSnapshot(snap => {
      automationNames = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!automationNames[d.deviceType]) automationNames[d.deviceType] = d.deviceName;
      });
    });
}

async function logHistory(deviceId, trigger, state) {
  const device = DEVICES.find(d => d.id === deviceId);
  if (!device) return;
  const deviceName = automationNames[deviceId] || device.name;
  await db.collection('users').doc(currentUser.uid)
    .collection('history').add({
      device: deviceName,
      deviceId,
      trigger,
      state,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

function loadHistory() {
  if (_historyUnsubscribe) _historyUnsubscribe();
  _historyUnsubscribe = db.collection('users').doc(currentUser.uid)
    .collection('history')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .onSnapshot(snap => {
      const list = document.getElementById('history-list');
      if (snap.empty) {
        list.innerHTML = '<div class="empty-msg">Nenhuma ativação ainda.</div>';
        return;
      }
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
    });
}

function initVoice() {
  const btn = document.getElementById('btn-mic');
  const status = document.getElementById('mic-status');
  let _voiceResultHandled = false;

  const ERROR_MSGS = {
    'not-allowed':  'Permissão do microfone negada. Clique no cadeado na barra de endereço e permita o microfone.',
    'not-supported':'Controle por voz não disponível. Use o Google Chrome.',
    'no-speech':    'Nenhuma fala detectada. Tente novamente.',
    'audio-capture':'Microfone não encontrado. Verifique se está conectado.'
  };

  voiceControl.onError = (code) => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Ativar voz';
    status.textContent = ERROR_MSGS[code] || 'Erro ao usar o microfone. Tente novamente.';
  };

  voiceControl.onResult = async ({ command, deviceId, action }) => {
    if (deviceId && action !== null) {
      try {
        if (!currentUser) return;
        _voiceResultHandled = true;
        await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: action, ts: Date.now() });
        await logHistory(deviceId, 'voz', action);
        status.textContent = `Comando reconhecido: "${command}"`;
        setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 3000);
      } catch (err) {
        console.error('Erro ao enviar comando de voz:', err);
        status.textContent = 'Erro ao enviar comando. Verifique sua conexão.';
        setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 5000);
      }
    } else {
      status.textContent = `Não entendi: "${command}"`;
      setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 3000);
    }
  };

  voiceControl.onEnd = () => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Ativar voz';
    if (!_voiceResultHandled) {
      status.textContent = 'Clique para falar um comando';
    }
    _voiceResultHandled = false;
  };

  btn.addEventListener('click', () => {
    if (voiceControl.isListening()) {
      voiceControl.stop();
    } else {
      try {
        voiceControl.start();
      } catch (err) {
        status.textContent = 'Erro ao iniciar o microfone. Tente novamente.';
        return;
      }
      btn.classList.add('listening');
      btn.textContent = '🎙️ Ouvindo...';
      status.textContent = 'Fale um comando (ex: "ligar luz", "abrir portão", "armar alarme")';
    }
  });
}

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

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
