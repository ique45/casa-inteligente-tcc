let currentUser = null;
let deviceStates = {};
let automationNames = {};
let automationsList = [];
let _dashboardInitialized = false;
let _rtdbDevicesRef = null;
let _rtdbStatusRef  = null;
let _automationsUnsubscribe = null;
let _historyUnsubscribe = null;

// O primeiro snapshot do RTDB entrega o estado dos 4 dispositivos de uma vez
// ao abrir a pagina. Sem esta trava, o app anunciaria os quatro em sequencia
// a cada carregamento. So libera a fala depois de processar esse snapshot.
let _falaLiberada = false;

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

// O rótulo "Armando..." só sai quando o ESP8266 confirma o novo estado em
// devices/{uid}. Sem placa ligada essa confirmação nunca chega, e o botão
// ficava preso em "Armando..." para sempre. Damos o dobro da cadência de
// sync (~10s) antes de desistir de esperar e mostrar o estado real.
const CONFIRMACAO_TIMEOUT_MS = 20000;
const _esperandoConfirmacao = {};   // deviceId -> id do setTimeout

function _teardownListeners() {
  if (_rtdbDevicesRef)  { _rtdbDevicesRef.off('value');  _rtdbDevicesRef  = null; }
  if (_rtdbStatusRef)   { _rtdbStatusRef.off('value');   _rtdbStatusRef   = null; }
  if (_arduinoStatusTimer) { clearInterval(_arduinoStatusTimer); _arduinoStatusTimer = null; }
  Object.keys(_esperandoConfirmacao).forEach(_pararEspera);
  _arduinoStatus = null;
  if (_automationsUnsubscribe) { _automationsUnsubscribe(); _automationsUnsubscribe = null; }
  if (_historyUnsubscribe)     { _historyUnsubscribe();     _historyUnsubscribe     = null; }
  deviceStates    = {};
  automationNames = {};
  automationsList = [];
  voiceControl.setAutomacoes([]);
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

    listenAutomations();
    listenDeviceStates();
    listenArduinoStatus();
    loadHistory();
  } catch (err) {
    console.error('Erro ao carregar dashboard:', err);
    document.getElementById('automations-grid').innerHTML =
      '<p style="color:var(--text-muted)">Erro ao carregar. Verifique sua conexão e recarregue a página.</p>';
  }
});

function renderAutomations() {
  const grid = document.getElementById('automations-grid');
  if (!automationsList.length) {
    grid.innerHTML = `<p class="empty-msg">
      Nenhuma automação cadastrada ainda.
      <span style="color:var(--purple-light);cursor:pointer" onclick="window.location.href='automation.html'">
        Criar a primeira automação →
      </span>
    </p>`;
    return;
  }

  grid.innerHTML = automationsList.map(item => {
    const d = item.data;
    const device = DEVICES.find(x => x.id === d.deviceType);
    const isEnabled = d.enabled !== false;
    const { whenText, thenText } = describeAutomation(d);

    // Só a automação de gatilho "botão" tem um dispositivo físico pra
    // acionar de verdade — vira o botão grande do card. As outras (voz,
    // presença, horário...) não têm essa ação, só o interruptor pequeno.
    let primaryBtnHtml = '';
    if (d.trigger === 'botao' && device) {
      const isOn = deviceStates[d.deviceType] === true;
      const label = isOn ? device.labelOn.toUpperCase() : device.labelOff.toUpperCase();
      primaryBtnHtml = `
        <div class="automation-card-primary-wrap">
          <button type="button" class="automation-card-primary-btn${isOn ? ' on' : ''}" id="acionar-${item.id}"
            data-automation-id="${item.id}" data-device-id="${d.deviceType}"
            aria-pressed="${isOn}" ${isEnabled ? '' : 'disabled'}
            title="${isEnabled ? 'Ligar ou desligar agora' : 'Ative a automação para poder acionar'}">
            <span id="acionar-label-${item.id}">${label}</span>
          </button>
        </div>`;
    }

    return `
      <div class="automation-card ${isEnabled ? '' : 'disabled'}">
        <div class="automation-card-header">
          <span class="automation-card-icon" aria-hidden="true">${device?.icon || '⚙️'}</span>
          <div class="automation-card-name">${escapeHtml(d.deviceName)}</div>
          <button type="button" class="toggle-switch ${isEnabled ? 'on' : ''}" data-id="${item.id}" role="switch" aria-checked="${isEnabled}" aria-label="Ativar ou desativar automação ${escapeHtml(d.deviceName)}"></button>
          <button class="btn-edit" data-id="${item.id}" aria-label="Editar automação ${escapeHtml(d.deviceName)}" title="Editar">✏️</button>
        </div>
        ${primaryBtnHtml}
        <div class="automation-card-body">
          <div class="automation-card-when"><span style="color:var(--text-muted);font-weight:600">Quando: </span>${whenText}</div>
          <div class="automation-card-then"><span style="color:var(--text-muted);font-weight:600">O sistema vai: </span>${thenText}</div>
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.toggle-switch').forEach(sw => {
    sw.addEventListener('click', () => toggleAutomationEnabled(sw.dataset.id, !sw.classList.contains('on')));
  });
  grid.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => { window.location.href = `automation.html?edit=${btn.dataset.id}`; });
  });
  grid.querySelectorAll('.automation-card-primary-btn').forEach(btn => {
    btn.addEventListener('click', () => acionarDispositivo(btn.dataset.automationId, btn.dataset.deviceId));
  });
}

async function acionarDispositivo(automationId, deviceId) {
  if (!currentUser) return;
  if (deviceStates[deviceId] === undefined) return;
  const item = automationsList.find(x => x.id === automationId);
  if (!item) return;
  const d = DEVICES.find(x => x.id === deviceId);
  const prevState = deviceStates[deviceId] === true;
  const newState = !prevState;   // toda automação alterna

  const btn = document.getElementById(`acionar-${automationId}`);
  const label = document.getElementById(`acionar-label-${automationId}`);

  if (d?.labelTransition) {
    if (label) label.textContent = (newState ? d.labelTransition.on : d.labelTransition.off).toUpperCase();
    if (btn) btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));
    if (!currentUser) { if (btn) btn.disabled = false; return; }
  }

  try {
    await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: newState, ts: Date.now() });
    await logHistory(deviceId, 'botao', newState);
    aguardarConfirmacao(deviceId, newState);
  } catch (err) {
    console.error('Erro ao acionar dispositivo:', err);
    if (label) label.textContent = (prevState ? d.labelOn : d.labelOff).toUpperCase();
    speech.falar(`Não foi possível ${newState ? 'ligar' : 'desligar'} ${d ? d.name.toLowerCase() : 'o dispositivo'}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Chamada depois de gravar um comando (botão ou voz): espera o ESP8266
// confirmar em devices/{uid} ou avisa que a casa não respondeu.
function aguardarConfirmacao(deviceId, newState) {
  _pararEspera(deviceId);
  // Mesmo estado de antes: o Firebase não dispara mudança, então não há
  // confirmação a esperar.
  if (newState === (deviceStates[deviceId] === true)) mostrarEstadoReal(deviceId);
  else if (!arduinoOnline()) avisarSemPlaca(deviceId);
  else _esperandoConfirmacao[deviceId] = setTimeout(() => avisarSemPlaca(deviceId), CONFIRMACAO_TIMEOUT_MS);
}

function _pararEspera(deviceId) {
  clearTimeout(_esperandoConfirmacao[deviceId]);
  delete _esperandoConfirmacao[deviceId];
}

function arduinoOnline() {
  const data = _arduinoStatus || {};
  return !!data.online && !!data.lastSeen && (Date.now() - data.lastSeen) < ARDUINO_TIMEOUT_MS;
}

// Volta os rótulos dos botões deste dispositivo para o último estado
// confirmado, sem anunciar por voz (nada mudou de fato na casa).
function mostrarEstadoReal(deviceId) {
  const d = DEVICES.find(x => x.id === deviceId);
  if (!d) return;
  const isOn = deviceStates[deviceId] === true;
  automationsList.forEach(item => {
    if (item.data.trigger !== 'botao' || item.data.deviceType !== deviceId) return;
    const label = document.getElementById(`acionar-label-${item.id}`);
    if (label) label.textContent = (isOn ? d.labelOn : d.labelOff).toUpperCase();
  });
}

function avisarSemPlaca(deviceId) {
  _pararEspera(deviceId);
  mostrarEstadoReal(deviceId);
  speech.falar('A casa não respondeu. O comando ficou salvo e será feito quando a placa estiver ligada.');
}

async function toggleAutomationEnabled(id, enabled) {
  if (!currentUser) return;
  try {
    await db.collection('automations').doc(currentUser.uid)
      .collection('items').doc(id).update({ enabled });
  } catch (err) {
    console.error('Erro ao atualizar automação:', err);
  }
}

function listenDeviceStates() {
  _rtdbDevicesRef = rtdb.ref(`devices/${currentUser.uid}`);
  _rtdbDevicesRef.on('value', snap => {
    const data = snap.val() || {};
    // Só o dispositivo que mudou: updateDeviceUI encerra a espera pela
    // confirmação e anuncia o estado por voz. Chamada para todos, a escrita
    // do ventilador cancelava a espera do portão, e como cada fala corta a
    // anterior, só o último da lista era ouvido.
    DEVICES.forEach(d => {
      const isOn = data[d.id]?.state === true;
      if (deviceStates[d.id] === isOn) return;
      deviceStates[d.id] = isOn;
      updateDeviceUI(d.id, isOn);
    });
    _falaLiberada = true;
  });
}

// Atualiza os botoes "acionar" das automacoes de gatilho botao que
// controlam este dispositivo, e anuncia por voz toda mudanca de estado
// confirmada pelo Firebase — venha do proprio botao, da voz ou do ESP8266.
function updateDeviceUI(deviceId, isOn) {
  const d = DEVICES.find(x => x.id === deviceId);
  if (!d) return;
  _pararEspera(deviceId);
  automationsList.forEach(item => {
    if (item.data.trigger !== 'botao' || item.data.deviceType !== deviceId) return;
    const btn = document.getElementById(`acionar-${item.id}`);
    const label = document.getElementById(`acionar-label-${item.id}`);
    if (btn && !btn.disabled) {
      btn.classList.toggle('on', isOn);
      btn.setAttribute('aria-pressed', String(isOn));
    }
    if (label) label.textContent = isOn ? d.labelOn.toUpperCase() : d.labelOff.toUpperCase();
  });
  if (_falaLiberada) speech.falar(frasePara(deviceId, isOn));
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

function listenAutomations() {
  if (_automationsUnsubscribe) _automationsUnsubscribe();
  _automationsUnsubscribe = db.collection('automations').doc(currentUser.uid)
    .collection('items').orderBy('createdAt', 'desc').onSnapshot(snap => {
      automationNames = {};
      automationsList = snap.docs.map(doc => {
        const d = doc.data();
        if (!automationNames[d.deviceType]) automationNames[d.deviceType] = d.deviceName;
        return { id: doc.id, data: d };
      });
      voiceControl.setAutomacoes(automationsList);
      renderAutomations();
    });
}

async function logHistory(deviceId, trigger, state, nome) {
  const device = DEVICES.find(d => d.id === deviceId);
  if (!device) return;
  const deviceName = nome || automationNames[deviceId] || device.name;
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

// Mostra na dica um comando que o usuário salvou, se houver algum ativo.
function exemploDeComando() {
  const voz = automationsList.find(a => a.data.trigger === 'voz' && a.data.enabled !== false && a.data.voiceOn);
  return voz ? voz.data.voiceOn : 'acender luz';
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

  voiceControl.onResult = async ({ command, deviceId, action, automationName, frase, desativada }) => {
    if (desativada) {
      _voiceResultHandled = true;
      status.textContent = `A automação "${automationName}" está desativada. Ative-a para usar este comando.`;
      setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 5000);
    } else if (deviceId && action !== null) {
      try {
        if (!currentUser) return;
        _voiceResultHandled = true;
        await rtdb.ref(`commands/${currentUser.uid}/${deviceId}`).set({ state: action, ts: Date.now() });
        await logHistory(deviceId, 'voz', action, automationName);
        aguardarConfirmacao(deviceId, action);
        status.textContent = `Comando reconhecido: "${frase || command}"`;
        setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 3000);
      } catch (err) {
        console.error('Erro ao enviar comando de voz:', err);
        status.textContent = 'Erro ao enviar comando. Verifique sua conexão.';
        setTimeout(() => { status.textContent = 'Clique para falar um comando'; }, 5000);
      }
    } else {
      // Sem isto o onEnd, que chega logo depois, apagava a mensagem.
      _voiceResultHandled = true;
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
      status.textContent = `Fale um comando (ex: "${exemploDeComando()}")`;
    }
  });
}

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
