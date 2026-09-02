let currentUser = null;
let deviceStates = {};
let automationNames = {};
let buttonAutomations = {};
let activeToggles = {};
let _dashboardInitialized = false;
let _rtdbDevicesRef = null;
let _rtdbStatusRef  = null;
let _automationNamesUnsubscribe = null;
let _historyUnsubscribe = null;

// Sem isto o status ficaria "Online" para sempre depois que o aparelho
// parasse, porque quem para de sincronizar não avisa que parou — só some.
//
// O firmware espera 2s entre ciclos, mas o ciclo inteiro custa bem mais:
// o handshake TLS domina o tempo. Medido em simulação, a cadência real
// ficou em ~10s por sync. Um limite apertado faria o status piscar entre
// Online e Offline o tempo todo, então damos folga de cerca de 3x.
const ARDUINO_TIMEOUT_MS = 30000;
let _arduinoStatus = null;   // último valor lido de arduino_status/{uid}
let _arduinoStatusTimer = null;

function _teardownListeners() {
  if (_rtdbDevicesRef)  { _rtdbDevicesRef.off('value');  _rtdbDevicesRef  = null; }
  if (_rtdbStatusRef)   { _rtdbStatusRef.off('value');   _rtdbStatusRef   = null; }
  if (_arduinoStatusTimer) { clearInterval(_arduinoStatusTimer); _arduinoStatusTimer = null; }
  _arduinoStatus = null;
  if (_automationNamesUnsubscribe) { _automationNamesUnsubscribe(); _automationNamesUnsubscribe = null; }
  if (_historyUnsubscribe)         { _historyUnsubscribe();         _historyUnsubscribe         = null; }
  deviceStates      = {};
  automationNames   = {};
  buttonAutomations = {};
  activeToggles     = {};
  currentUser       = null;
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
  grid.innerHTML = DEVICES.map(d => {
    const auto = buttonAutomations[d.id];
    const isOn = deviceStates[d.id] === true;
    const statusLabel = isOn ? d.labelOn.toUpperCase() : d.labelOff.toUpperCase();
    if (auto) {
      return `
        <button class="device-card${isOn ? ' on' : ''}" id="btn-${d.id}" data-id="${d.id}" aria-pressed="${isOn ? 'true' : 'false'}">
          <span class="device-card-icon" aria-hidden="true">${d.icon}</span>
          <div class="device-card-info">
            <div class="device-card-name">${escapeHtml(d.name)}</div>
            <div class="device-card-status" id="state-${d.id}">${statusLabel}</div>
          </div>
          <div class="device-toggle${isOn ? ' on' : ''}" id="toggle-${d.id}">
            <div class="toggle-thumb"></div>
          </div>
        </button>`;
    }
    return `
      <div class="device-card device-card--readonly" id="btn-${d.id}">
        <span class="device-card-icon" aria-hidden="true">${d.icon}</span>
        <div class="device-card-info">
          <div class="device-card-name">${escapeHtml(d.name)}</div>
          <div class="device-card-status" id="state-${d.id}">${statusLabel}</div>
        </div>
        <span class="device-card-hint">Sem automação</span>
      </div>`;
  }).join('');

  grid.querySelectorAll('button.device-card').forEach(btn => {
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
    if (btn.tagName === 'BUTTON') {
      btn.classList.toggle('on', isOn);
      // O leitor de tela le o estado por aqui; a classe .on so pinta.
      btn.setAttribute('aria-pressed', String(isOn));
      if (toggleEl) toggleEl.classList.toggle('on', isOn);
    }
    stateEl.textContent = isOn ? d.labelOn.toUpperCase() : d.labelOff.toUpperCase();
  }
}

function listenArduinoStatus() {
  _rtdbStatusRef = rtdb.ref(`arduino_status/${currentUser.uid}`);
  _rtdbStatusRef.on('value', snap => {
    _arduinoStatus = snap.val() || {};
    renderArduinoStatus();
  });

  // O listener acima só dispara quando o valor muda no banco. Um aparelho
  // que trava ou perde a rede não escreve nada, então precisamos reavaliar
  // sozinhos de tempos em tempos para o status não ficar preso em "Online".
  if (_arduinoStatusTimer) clearInterval(_arduinoStatusTimer);
  _arduinoStatusTimer = setInterval(renderArduinoStatus, 3000);
}

function renderArduinoStatus() {
    const data = _arduinoStatus || {};
    // O status vive na barra de acessibilidade desde a Task 4; antes havia
    // uma copia no rodape da sidebar e outra na topbar do celular.
    const caixa = document.getElementById('arduino-status');
    const statusText = document.getElementById('arduino-status-text');
    const offlineHint = document.getElementById('offline-hint');

    // Idade negativa acontece se o relógio do computador estiver atrasado
    // em relação ao servidor; nesse caso tratamos como contato recente.
    const idade  = Date.now() - (data.lastSeen || 0);
    const recente = !!data.lastSeen && idade < ARDUINO_TIMEOUT_MS;

    if (data.online && recente) {
      if (caixa) caixa.className = 'a11y-arduino';
      if (statusText) statusText.textContent = 'Online';
      if (offlineHint) offlineHint.style.display = 'none';
    } else {
      if (caixa) caixa.className = 'a11y-arduino offline';
      if (statusText) statusText.textContent = 'Offline';
      if (offlineHint) offlineHint.style.display = 'block';
    }
}

async function toggleDevice(deviceId) {
  if (!currentUser) return;
  if (deviceStates[deviceId] === undefined) return;
  const d = DEVICES.find(x => x.id === deviceId);
  const prevState = deviceStates[deviceId];
  const auto = buttonAutomations[deviceId];
  const action = auto?.action || 'toggle';
  const newState = action === 'on' ? true : action === 'off' ? false : !prevState;

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
      automationNames   = {};
      buttonAutomations = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!automationNames[d.deviceType]) automationNames[d.deviceType] = d.deviceName;
        if (d.trigger === 'botao' && d.enabled !== false && !buttonAutomations[d.deviceType]) {
          buttonAutomations[d.deviceType] = { action: d.action || 'toggle' };
        }
      });
      renderDevices();
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
        const deviceEntry = DEVICES.find(x => x.id === d.deviceId);
        const stateLabel = deviceEntry
          ? (d.state ? deviceEntry.labelOn : deviceEntry.labelOff).toUpperCase()
          : (d.state ? 'LIGADO' : 'DESLIGADO');
        const stateClass = d.state ? 'badge-state-on' : 'badge-state-off';
        const deviceIcon = deviceEntry?.icon || '⚙️';
        return `
          <div class="history-card">
            <div class="history-card-header">
              <span class="history-card-icon" aria-hidden="true">${deviceIcon}</span>
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

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
