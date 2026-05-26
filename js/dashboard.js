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
let automationNames = {}; // deviceId → primeiro nome de automação configurado

auth.onAuthStateChanged(async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;

  const snap = await db.collection('users').doc(user.uid).get();
  const toggles = (snap.data() || {}).activeToggles || {};

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
});

function renderDevices() {
  const grid = document.getElementById('devices-grid');
  grid.innerHTML = DEVICES.map(d => `
    <button class="device-btn" id="btn-${d.id}" data-id="${d.id}">
      <span class="device-icon">${d.icon}</span>
      <span class="device-name">${escapeHtml(d.name)}</span>
      <span class="device-state" id="state-${d.id}">${d.labelOff}</span>
    </button>
  `).join('');

  grid.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDevice(btn.dataset.id));
  });
}

function listenDeviceStates() {
  rtdb.ref(`devices/${currentUser.uid}`).on('value', snap => {
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
  if (!btn || !stateEl || !d) return;
  btn.classList.toggle('on', isOn);
  stateEl.textContent = isOn ? d.labelOn : d.labelOff;
}

function listenArduinoStatus() {
  rtdb.ref(`arduino_status/${currentUser.uid}`).on('value', snap => {
    const data = snap.val() || {};
    const badge = document.getElementById('arduino-badge');
    const lastSeen = document.getElementById('last-seen');
    if (data.online) {
      badge.className = 'badge badge-online';
      badge.textContent = 'Online';
      lastSeen.textContent = '';
    } else {
      badge.className = 'badge badge-offline';
      badge.textContent = 'Offline';
      const ts = data.lastSeen ? `Última vez: ${new Date(data.lastSeen).toLocaleString('pt-BR')} · ` : '';
      lastSeen.textContent = `${ts}Dispositivos físicos não estão respondendo no momento.`;
    }
  });
}

async function toggleDevice(deviceId) {
  if (!currentUser) return;
  const d = DEVICES.find(x => x.id === deviceId);
  const newState = !deviceStates[deviceId];

  const btn = document.getElementById(`btn-${deviceId}`);
  const stateEl = document.getElementById(`state-${deviceId}`);

  if (d?.labelTransition) {
    if (stateEl) stateEl.textContent = newState ? d.labelTransition.on : d.labelTransition.off;
    if (btn) btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));
  }

  try {
    await rtdb.ref(`devices/${currentUser.uid}/${deviceId}`).set({ state: newState });
    await logHistory(deviceId, 'botao', newState);
  } catch (err) {
    console.error('Erro ao acionar dispositivo:', err);
    updateDeviceUI(deviceId, deviceStates[deviceId]);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function listenAutomationNames() {
  db.collection('automations').doc(currentUser.uid)
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
  db.collection('users').doc(currentUser.uid)
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
        const ts = d.timestamp ? new Date(d.timestamp.toMillis()).toLocaleString('pt-BR') : '—';
        const stateLabels = { portao: ['Aberto','Fechado'], alarme: ['Armado','Desarmado'] };
        const [labelOn, labelOff] = stateLabels[d.deviceId] || ['Ligado','Desligado'];
        const stateLabel = d.state ? labelOn : labelOff;
        const TRIGGER_ICONS  = { voz:'🎤', botao:'🔘', presenca:'👁️', horario:'⏰', temperatura:'🌡️' };
        const TRIGGER_LABELS = { voz:'Voz', botao:'Botão', presenca:'Presença', horario:'Horário', temperatura:'Temperatura' };
        return `
          <div class="history-item">
            <span class="history-device">${escapeHtml(d.device)}</span>
            <span class="history-trigger">${TRIGGER_ICONS[d.trigger] || ''} ${TRIGGER_LABELS[d.trigger] || escapeHtml(d.trigger)}</span>
            <span class="history-state ${d.state ? 'on' : 'off'}">${stateLabel}</span>
            <span class="history-time">${ts}</span>
          </div>
        `;
      }).join('');
    });
}

function initVoice() {
  const btn = document.getElementById('btn-mic');
  const status = document.getElementById('mic-status');

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
      await rtdb.ref(`devices/${currentUser.uid}/${deviceId}`).set({ state: action });
      await logHistory(deviceId, 'voz', action);
      status.textContent = `Comando reconhecido: "${command}"`;
      setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 3000);
    } else {
      status.textContent = `Não entendi: "${command}"`;
      setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 3000);
    }
  };

  voiceControl.onEnd = () => {
    btn.classList.remove('listening');
    btn.textContent = '🎤 Ativar voz';
    status.textContent = 'Clique para falar um comando';
  };

  btn.addEventListener('click', () => {
    if (voiceControl.isListening()) {
      voiceControl.stop();
    } else {
      voiceControl.start();
      btn.classList.add('listening');
      btn.textContent = '🎙️ Ouvindo...';
      status.textContent = 'Fale um comando (ex: "ligar luz", "abrir portão")';
    }
  });
}

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
document.getElementById('btn-profile').addEventListener('click', () => {
  window.location.href = 'profile.html';
});
document.getElementById('btn-automations').addEventListener('click', () => {
  window.location.href = 'automation.html';
});
document.getElementById('btn-history-page').addEventListener('click', () => {
  window.location.href = 'history.html';
});
