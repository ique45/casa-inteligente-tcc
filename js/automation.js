function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡' },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀' },
  { id: 'portao',     name: 'Portão',     icon: '🚪' },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔' }
];

const TRIGGERS_BY_DEVICE = {
  luz:        ['voz', 'botao', 'presenca'],
  portao:     ['voz', 'botao', 'presenca'],
  ventilador: ['voz', 'botao', 'temperatura', 'horario'],
  alarme:     ['botao', 'presenca', 'horario']
};

const TRIGGER_INFO = {
  voz:         { label: 'Voz',           icon: '🎤' },
  botao:       { label: 'Botão no dashboard', icon: '🔘' },
  presenca:    { label: 'Presença',      icon: '👁️' },
  temperatura: { label: 'Temperatura',   icon: '🌡️' },
  horario:     { label: 'Horário',       icon: '⏰' }
};

const VOICE_SUGGESTIONS = {
  luz:        ['Ligar luz', 'Acender luz', 'Apagar luz', 'Desligar luz'],
  portao:     ['Abrir portão', 'Fechar portão'],
  ventilador: ['Ligar ventilador', 'Desligar ventilador'],
  alarme:     ['Armar alarme', 'Desarmar alarme', 'Ativar alarme', 'Desativar alarme']
};

const ACTIONS_DEFAULT = [
  { id: 'toggle', label: 'Alternar',    icon: '🔄', desc: 'Liga se desligado, desliga se ligado' },
  { id: 'on',     label: 'Só ligar',    icon: '✅', desc: 'Sempre liga o dispositivo' },
  { id: 'off',    label: 'Só desligar', icon: '❌', desc: 'Sempre desliga o dispositivo' }
];

const ACTIONS_BY_DEVICE = {
  alarme: [
    { id: 'toggle', label: 'Alternar',  icon: '🔄', desc: 'Arma se desarmado, desarma se armado' },
    { id: 'on',     label: 'Armar',     icon: '🔒', desc: 'Sempre ativa o alarme' },
    { id: 'off',    label: 'Desarmar',  icon: '🔓', desc: 'Sempre desativa o alarme' }
  ],
  portao: [
    { id: 'toggle', label: 'Alternar', icon: '🔄', desc: 'Abre se fechado, fecha se aberto' },
    { id: 'on',     label: 'Abrir',    icon: '🟢', desc: 'Sempre abre o portão' },
    { id: 'off',    label: 'Fechar',   icon: '🔴', desc: 'Sempre fecha o portão' }
  ]
};

function getActions(deviceId) {
  return ACTIONS_BY_DEVICE[deviceId] || ACTIONS_DEFAULT;
}

const TRIGGER_ICONS = { voz:'🎤', botao:'🔘', presenca:'👁️', temperatura:'🌡️', horario:'⏰' };

let currentUser = null;
let form = { device: null, name: '', trigger: null, voiceCommand: '', action: null };

auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'login.html'; return; }
  currentUser = user;
  renderDeviceChips();
  renderActionChips();
  loadAutomations();
});

// ---- Renderização do formulário ----

function renderDeviceChips() {
  const wrap = document.getElementById('device-chips');
  wrap.innerHTML = DEVICES.map(d => `
    <div class="chip" data-id="${d.id}">
      <span>${d.icon}</span> ${escapeHtml(d.name)}
    </div>
  `).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => selectDevice(c.dataset.id));
  });
}

function selectDevice(id) {
  form = { device: id, name: '', trigger: null, voiceCommand: '', action: null };
  document.querySelectorAll('#device-chips .chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });
  document.getElementById('input-name').value = '';
  document.getElementById('step-name').style.display = 'block';
  hideFrom('step-trigger');
  renderActionChips();
  updatePreview();
}

function renderTriggerChips() {
  const triggers = TRIGGERS_BY_DEVICE[form.device] || [];
  const wrap = document.getElementById('trigger-chips');
  wrap.innerHTML = triggers.map(t => {
    const info = TRIGGER_INFO[t];
    return `<div class="chip ${form.trigger === t ? 'selected' : ''}" data-id="${t}">${info.icon} ${escapeHtml(info.label)}</div>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => selectTrigger(c.dataset.id));
  });
}

function selectTrigger(id) {
  form.trigger = id;
  form.voiceCommand = '';
  document.querySelectorAll('#trigger-chips .chip').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === id);
  });

  const TRIGGER_NOTES = {
    botao:       'O botão do dashboard sempre alterna o estado do dispositivo. A ação escolhida abaixo é usada pelo Arduino quando ele recebe o sinal do botão.',
    presenca:    'Requer sensor de presença (PIR) conectado ao Arduino. Sem o sensor físico, essa automação não vai disparar.',
    temperatura: 'Requer sensor de temperatura conectado ao Arduino. O limite é definido no código — não é possível ajustar aqui.',
    horario:     'O horário é definido no código do Arduino. Para alterar, peça ao responsável pela configuração do dispositivo.'
  };
  let noteEl = document.getElementById('trigger-note');
  if (!noteEl) {
    noteEl = document.createElement('p');
    noteEl.id = 'trigger-note';
    noteEl.className = 'trigger-note';
    document.getElementById('trigger-chips').after(noteEl);
  }
  if (TRIGGER_NOTES[id]) {
    noteEl.textContent = TRIGGER_NOTES[id];
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }

  if (id === 'voz') {
    renderVoiceSuggestions();
    document.getElementById('input-voice').value = '';
    document.getElementById('step-voice').style.display = 'block';
    document.getElementById('action-step-num').textContent = '5';
  } else {
    document.getElementById('step-voice').style.display = 'none';
    document.getElementById('action-step-num').textContent = '4';
  }

  document.getElementById('step-action').style.display = 'block';
  document.querySelectorAll('#action-chips .chip').forEach(c => c.classList.remove('selected'));
  form.action = null;
  updatePreview();
}

function renderVoiceSuggestions() {
  const suggestions = VOICE_SUGGESTIONS[form.device] || [];
  const wrap = document.getElementById('voice-suggestions');
  wrap.innerHTML = suggestions.map(s =>
    `<span class="suggestion-chip">${escapeHtml(s)}</span>`
  ).join('');
  wrap.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('input-voice').value = chip.textContent;
      form.voiceCommand = chip.textContent;
      updatePreview();
    });
  });
}

function renderActionChips() {
  const actions = getActions(form.device);
  const wrap = document.getElementById('action-chips');
  wrap.innerHTML = actions.map(a => `
    <div class="chip chip-with-desc" data-id="${a.id}">
      <span class="chip-main">${a.icon} ${escapeHtml(a.label)}</span>
      <span class="chip-desc">${escapeHtml(a.desc)}</span>
    </div>
  `).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      form.action = c.dataset.id;
      document.querySelectorAll('#action-chips .chip').forEach(x => x.classList.remove('selected'));
      c.classList.add('selected');
      updatePreview();
    });
  });
}

function hideFrom(stepId) {
  const steps = ['step-trigger', 'step-voice', 'step-action', 'preview-wrap', 'btn-save-auto'];
  let hide = false;
  steps.forEach(id => {
    if (id === stepId) hide = true;
    if (hide) document.getElementById(id).style.display = 'none';
  });
}

// ---- Preview em tempo real ----

function updatePreview() {
  const previewWrap = document.getElementById('preview-wrap');
  const previewBox = document.getElementById('preview-box');
  const saveBtn = document.getElementById('btn-save-auto');

  const d = DEVICES.find(x => x.id === form.device);
  const name = form.name.trim() || (d ? d.name : '?');
  const trigger = form.trigger;
  const action = form.action;
  const voiceCmd = form.voiceCommand.trim();

  if (!d) { previewWrap.style.display = 'none'; return; }
  previewWrap.style.display = 'block';

  let text = '';
  const actionObj = getActions(form.device).find(a => a.id === action);
  const actionLabel = actionObj ? actionObj.label.toLowerCase() : '…';

  if (trigger === 'voz') {
    const cmd = voiceCmd || '…';
    text = `Ao falar "<strong>${escapeHtml(cmd)}</strong>", vai ${actionLabel} o dispositivo <strong>${escapeHtml(name)}</strong>`;
  } else if (trigger === 'botao') {
    text = `Ao clicar no botão do dashboard, vai ${actionLabel} o dispositivo <strong>${escapeHtml(name)}</strong>`;
  } else if (trigger === 'presenca') {
    text = `Ao detectar presença, vai ${actionLabel} o dispositivo <strong>${escapeHtml(name)}</strong>`;
  } else if (trigger === 'temperatura') {
    text = `Quando o sensor de temperatura disparar, vai ${actionLabel} o dispositivo <strong>${escapeHtml(name)}</strong>`;
  } else if (trigger === 'horario') {
    text = `No horário programado no Arduino, vai ${actionLabel} o dispositivo <strong>${escapeHtml(name)}</strong>`;
  } else {
    text = `<strong>${escapeHtml(d.name)}</strong> — escolha o gatilho e a ação`;
  }

  previewBox.innerHTML = text;
  const isReady = d && trigger && action && (trigger !== 'voz' || voiceCmd) && form.name.trim();
  previewBox.classList.toggle('ready', isReady);
  saveBtn.style.display = isReady ? 'inline-flex' : 'none';
}

// ---- Eventos de input ----

document.getElementById('input-name').addEventListener('input', e => {
  form.name = e.target.value;
  if (form.name.trim()) {
    document.getElementById('step-trigger').style.display = 'block';
    renderTriggerChips();
  } else {
    hideFrom('step-trigger');
  }
  updatePreview();
});

document.getElementById('input-voice').addEventListener('input', e => {
  form.voiceCommand = e.target.value;
  updatePreview();
});

// ---- Salvar automação ----

document.getElementById('btn-save-auto').addEventListener('click', async () => {
  if (!currentUser) return;
  const btn = document.getElementById('btn-save-auto');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const data = {
    deviceType: form.device,
    deviceName: form.name.trim(),
    trigger: form.trigger,
    action: form.action,
    enabled: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (form.trigger === 'voz') data.voiceCommand = form.voiceCommand.trim();

  const errEl = document.getElementById('auto-error-msg');
  try {
    await db.collection('automations').doc(currentUser.uid)
      .collection('items').add(data);
    if (errEl) errEl.style.display = 'none';
    resetForm();
    document.getElementById('form-wrap').style.display = 'none';
    document.getElementById('btn-new-auto').textContent = '+ Nova automação';
  } catch (err) {
    console.error(err);
    if (errEl) { errEl.textContent = 'Erro ao salvar. Verifique sua conexão.'; errEl.style.display = 'block'; }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar automação';
  }
});

function resetForm() {
  form = { device: null, name: '', trigger: null, voiceCommand: '', action: null };
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  document.getElementById('input-name').value = '';
  document.getElementById('input-voice').value = '';
  document.getElementById('step-name').style.display = 'none';
  hideFrom('step-trigger');
}

// ---- Carregar lista de automações ----

function loadAutomations() {
  db.collection('automations').doc(currentUser.uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('automations-list');
      if (snap.empty) {
        list.innerHTML = '<div class="empty-msg">Nenhuma automação cadastrada ainda.</div>';
        return;
      }
      list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const device = DEVICES.find(x => x.id === d.deviceType);
        const tInfo = TRIGGER_INFO[d.trigger] || {};
        const actionObj = getActions(d.deviceType).find(a => a.id === d.action);
        const actionLabel = actionObj ? actionObj.label : d.action;
        const detail = d.trigger === 'voz'
          ? `Voz: "${escapeHtml(d.voiceCommand || '')}"`
          : d.trigger === 'botao'
            ? `Botão no dashboard (sempre alterna)`
            : `${tInfo.label || d.trigger} → ${actionLabel}`;
        return `
          <div class="automation-card">
            <span class="auto-icon">${device?.icon || '⚙️'}</span>
            <div class="auto-info">
              <div class="auto-name">${escapeHtml(d.deviceName)}</div>
              <div class="auto-detail">${detail}</div>
            </div>
            <span class="auto-trigger">${tInfo.icon || ''} ${escapeHtml(tInfo.label || d.trigger)}</span>
            <div class="auto-actions">
              <div class="toggle-switch ${d.enabled ? 'on' : ''}" data-id="${doc.id}" role="switch" aria-checked="${d.enabled}" tabindex="0"></div>
              <span class="auto-status ${d.enabled ? 'on' : ''}">${d.enabled ? 'Ativo' : 'Pausado'}</span>
              <button class="btn-delete" data-id="${doc.id}" aria-label="Excluir automação" title="Excluir">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('.toggle-switch').forEach(sw => {
        sw.addEventListener('click', () => toggleEnabled(sw.dataset.id, !sw.classList.contains('on')));
      });
      list.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteAutomation(btn.dataset.id));
      });
    });
}

async function toggleEnabled(id, enabled) {
  try {
    await db.collection('automations').doc(currentUser.uid)
      .collection('items').doc(id).update({ enabled });
  } catch (err) {
    console.error('Erro ao atualizar automação:', err);
    showListError('Erro ao salvar. Verifique sua conexão.');
  }
}

async function deleteAutomation(id) {
  if (!confirm('Excluir essa automação?')) return;
  try {
    await db.collection('automations').doc(currentUser.uid)
      .collection('items').doc(id).delete();
  } catch (err) {
    console.error('Erro ao excluir automação:', err);
    showListError('Erro ao excluir. Verifique sua conexão.');
  }
}

function showListError(msg) {
  let el = document.getElementById('list-error-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'list-error-msg';
    el.className = 'error-msg';
    document.getElementById('automations-list').after(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ---- Botão nova automação ----

document.getElementById('btn-new-auto').addEventListener('click', () => {
  const wrap = document.getElementById('form-wrap');
  const btn = document.getElementById('btn-new-auto');
  const isOpen = wrap.style.display !== 'none';
  if (isOpen) {
    wrap.style.display = 'none';
    btn.textContent = '+ Nova automação';
    resetForm();
  } else {
    wrap.style.display = 'block';
    btn.textContent = '✕ Cancelar';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// ---- Navegação ----

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
document.getElementById('btn-dashboard').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});
document.getElementById('btn-profile').addEventListener('click', () => {
  window.location.href = 'profile.html';
});
document.getElementById('btn-history-page').addEventListener('click', () => {
  window.location.href = 'history.html';
});
