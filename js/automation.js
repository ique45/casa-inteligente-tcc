const TRIGGERS_BY_DEVICE = {
  luz:        ['voz', 'botao', 'presenca'],
  // Sem "presenca": um portão não deve abrir sozinho só porque detectou
  // alguém por perto — risco de segurança.
  portao:     ['voz', 'botao'],
  ventilador: ['voz', 'botao', 'temperatura', 'horario'],
  alarme:     ['botao', 'presenca', 'horario']
};

// TRIGGER_INFO, ACTIONS_DEFAULT, ACTIONS_BY_DEVICE e getActions() vêm de
// js/devices.js — compartilhados com o dashboard, que também precisa
// descrever automações sem reimplementar o formulário inteiro.

const VOICE_SUGGESTIONS = {
  luz:        ['Ligar luz', 'Acender luz', 'Apagar luz', 'Desligar luz'],
  portao:     ['Abrir portão', 'Fechar portão'],
  ventilador: ['Ligar ventilador', 'Desligar ventilador'],
  alarme:     ['Armar alarme', 'Desarmar alarme', 'Ativar alarme', 'Desativar alarme']
};

let currentUser = null;
let form = { device: null, name: '', trigger: null, voiceCommand: '', action: null };
let editingId = null;
let _autoInitialized = false;
let _automationsListUnsubscribe = null;
let _automationsCache = {};

auth.onAuthStateChanged(user => {
  if (!user) {
    _autoInitialized = false;
    if (_automationsListUnsubscribe) { _automationsListUnsubscribe(); _automationsListUnsubscribe = null; }
    window.location.href = 'login.html';
    return;
  }
  if (_autoInitialized) return;
  _autoInitialized = true;
  currentUser = user;
  form = { device: null, name: '', trigger: null, voiceCommand: '', action: null };
  const _inputName  = document.getElementById('input-name');
  const _inputVoice = document.getElementById('input-voice');
  if (_inputName)  _inputName.value  = '';
  if (_inputVoice) _inputVoice.value = '';
  renderDeviceChips();
  renderActionChips();
  loadAutomations();

  // Chegou pelo botao "Editar" do dashboard: automation.html?edit=<id>
  const editParam = new URLSearchParams(window.location.search).get('edit');
  if (editParam) openEditWhenLoaded(editParam);
});

// A automacao pode ainda nao estar no cache no primeiro snapshot (a query
// do Firestore ainda esta em voo), entao esperamos ela aparecer.
function openEditWhenLoaded(id, tentativas) {
  tentativas = tentativas || 0;
  if (_automationsCache[id]) {
    enterEditMode(id);
    history.replaceState(null, '', 'automation.html');
    return;
  }
  if (tentativas > 20) return;
  setTimeout(() => openEditWhenLoaded(id, tentativas + 1), 150);
}

// ---- Renderização do formulário ----

function renderDeviceChips() {
  const wrap = document.getElementById('device-chips');
  wrap.innerHTML = DEVICES.map(d => `
    <button type="button" class="chip" data-id="${d.id}" aria-pressed="false">
      <span aria-hidden="true">${d.icon}</span> ${escapeHtml(d.name)}
    </button>
  `).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => selectDevice(c.dataset.id));
  });
}

function selectDevice(id) {
  form = { device: id, name: '', trigger: null, voiceCommand: '', action: null };
  document.querySelectorAll('#device-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === id;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });
  document.getElementById('input-name').value = '';
  document.getElementById('step-name').style.display = 'block';
  hideFrom('step-trigger');
  renderActionChips();
  updatePreview();
}

function getTriggerNote(triggerId, deviceId) {
  if (triggerId === 'botao') {
    const porDispositivo = {
      portao: 'O botão no dashboard sempre alterna o estado: abre se estiver fechado, fecha se estiver aberto.',
      alarme: 'O botão no dashboard sempre alterna o estado: arma se estiver desarmado, desarma se estiver armado.'
    };
    return porDispositivo[deviceId] || 'O botão no dashboard sempre alterna o estado do dispositivo: liga se estiver desligado, desliga se estiver ligado.';
  }
  const NOTAS = {
    presenca:    'Requer sensor de presença (PIR) conectado ao Arduino. Sem o sensor físico, essa automação não vai disparar.',
    temperatura: 'Requer sensor de temperatura conectado ao Arduino. O limite é definido no código — não é possível ajustar aqui.',
    horario:     'O horário é definido no código do Arduino. Para alterar, peça ao responsável pela configuração do dispositivo.'
  };
  return NOTAS[triggerId] || null;
}

function showTriggerNote(triggerId, deviceId) {
  let noteEl = document.getElementById('trigger-note');
  if (!noteEl) {
    noteEl = document.createElement('p');
    noteEl.id = 'trigger-note';
    noteEl.className = 'trigger-note';
    document.getElementById('trigger-chips').after(noteEl);
  }
  const texto = getTriggerNote(triggerId, deviceId);
  if (texto) {
    noteEl.textContent = texto;
    noteEl.style.display = 'block';
  } else {
    noteEl.style.display = 'none';
  }
}

function renderTriggerChips() {
  const triggers = TRIGGERS_BY_DEVICE[form.device] || [];
  const wrap = document.getElementById('trigger-chips');
  wrap.innerHTML = triggers.map(t => {
    const info = TRIGGER_INFO[t];
    const escolhido = form.trigger === t;
    return `<button type="button" class="chip ${escolhido ? 'selected' : ''}" data-id="${t}" aria-pressed="${escolhido}">${info.icon} ${escapeHtml(info.label)}</button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => selectTrigger(c.dataset.id));
  });
}

function selectTrigger(id) {
  form.trigger = id;
  form.voiceCommand = '';
  document.querySelectorAll('#trigger-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === id;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  showTriggerNote(id, form.device);

  if (id === 'voz') {
    renderVoiceSuggestions();
    document.getElementById('input-voice').value = '';
    document.getElementById('step-voice').style.display = 'block';
    document.getElementById('action-step-num').textContent = '5';
  } else {
    document.getElementById('step-voice').style.display = 'none';
    document.getElementById('action-step-num').textContent = '4';
  }

  if (id === 'botao') {
    form.action = 'toggle';
    document.getElementById('step-action').style.display = 'none';
  } else {
    document.getElementById('step-action').style.display = 'block';
    document.querySelectorAll('#action-chips .chip').forEach(c => {
      c.classList.remove('selected');
      c.setAttribute('aria-pressed', 'false');
    });
    form.action = null;
  }
  updatePreview();
}

function renderVoiceSuggestions() {
  const suggestions = VOICE_SUGGESTIONS[form.device] || [];
  const wrap = document.getElementById('voice-suggestions');
  wrap.innerHTML = suggestions.map(s =>
    `<button type="button" class="suggestion-chip">${escapeHtml(s)}</button>`
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
  wrap.innerHTML = actions.map(a => {
    const escolhido = form.action === a.id;
    return `
    <button type="button" class="chip chip-with-desc ${escolhido ? 'selected' : ''}" data-id="${a.id}" aria-pressed="${escolhido}">
      <span class="chip-main">${a.icon} ${escapeHtml(a.label)}</span>
      <span class="chip-desc">${escapeHtml(a.desc)}</span>
    </button>`;
  }).join('');
  wrap.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      form.action = c.dataset.id;
      document.querySelectorAll('#action-chips .chip').forEach(x => {
        x.classList.remove('selected');
        x.setAttribute('aria-pressed', 'false');
      });
      c.classList.add('selected');
      c.setAttribute('aria-pressed', 'true');
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

// ---- Editar automação existente ----
// Reaproveita o mesmo formulario de criacao, mas populado com os dados
// salvos, sem passar pelos handlers de clique (que resetariam o form).

function enterEditMode(id) {
  const d = _automationsCache[id];
  if (!d) return;
  editingId = id;
  form = {
    device: d.deviceType,
    name: d.deviceName,
    trigger: d.trigger,
    voiceCommand: d.voiceCommand || '',
    action: d.action
  };

  document.getElementById('form-wrap').style.display = 'block';
  document.getElementById('btn-new-auto').textContent = '✕ Cancelar';

  document.querySelectorAll('#device-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === form.device;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  document.getElementById('input-name').value = form.name;
  document.getElementById('step-name').style.display = 'block';

  renderActionChips();
  document.getElementById('step-trigger').style.display = 'block';
  renderTriggerChips();
  showTriggerNote(form.trigger, form.device);

  if (form.trigger === 'voz') {
    renderVoiceSuggestions();
    document.getElementById('input-voice').value = form.voiceCommand;
    document.getElementById('step-voice').style.display = 'block';
    document.getElementById('action-step-num').textContent = '5';
  } else {
    document.getElementById('step-voice').style.display = 'none';
    document.getElementById('action-step-num').textContent = '4';
  }

  document.getElementById('step-action').style.display = form.trigger === 'botao' ? 'none' : 'block';

  document.getElementById('btn-save-auto').textContent = 'Salvar alterações';
  updatePreview();
  document.getElementById('form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const TOGGLE_DESC = { portao: 'abre se estiver fechado, fecha se estiver aberto', alarme: 'arma se estiver desarmado, desarma se estiver armado', luz: 'liga se estiver desligada, desliga se estiver ligada', ventilador: 'liga se estiver desligado, desliga se estiver ligado' };
    const toggleDesc = TOGGLE_DESC[form.device] || 'liga se estiver desligado, desliga se estiver ligado';
    text = `Ao clicar no botão do dashboard, o dispositivo <strong>${escapeHtml(name)}</strong> vai alternar (${toggleDesc})`;
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
  if (!form.device || !form.trigger || form.action == null || !form.name.trim()) return;
  if (form.trigger === 'voz' && !form.voiceCommand.trim()) return;
  const btn = document.getElementById('btn-save-auto');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const data = {
    deviceType: form.device,
    deviceName: form.name.trim(),
    trigger: form.trigger,
    action: form.action
  };
  if (form.trigger === 'voz') data.voiceCommand = form.voiceCommand.trim();
  else if (editingId) data.voiceCommand = firebase.firestore.FieldValue.delete();

  const errEl = document.getElementById('auto-error-msg');
  try {
    if (editingId) {
      await db.collection('automations').doc(currentUser.uid)
        .collection('items').doc(editingId).update(data);
    } else {
      data.enabled = true;
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('automations').doc(currentUser.uid)
        .collection('items').add(data);
    }
    if (errEl) errEl.style.display = 'none';
    resetForm();
    document.getElementById('form-wrap').style.display = 'none';
    document.getElementById('btn-new-auto').textContent = '+ Nova automação';
  } catch (err) {
    console.error(err);
    const msg = editingId ? 'Erro ao salvar alterações. Verifique sua conexão.' : 'Erro ao salvar. Verifique sua conexão.';
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Salvar alterações' : 'Salvar automação';
  }
});

function resetForm() {
  form = { device: null, name: '', trigger: null, voiceCommand: '', action: null };
  editingId = null;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('input-name').value = '';
  document.getElementById('input-voice').value = '';
  document.getElementById('step-name').style.display = 'none';
  hideFrom('step-trigger');
  const noteEl = document.getElementById('trigger-note');
  if (noteEl) noteEl.style.display = 'none';
  document.getElementById('btn-save-auto').textContent = 'Salvar automação';
}

// ---- Carregar lista de automações ----

function loadAutomations() {
  if (_automationsListUnsubscribe) _automationsListUnsubscribe();
  _automationsListUnsubscribe = db.collection('automations').doc(currentUser.uid)
    .collection('items')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const list = document.getElementById('automations-list');
      if (snap.empty) {
        list.innerHTML = '<div class="empty-msg">Nenhuma automação cadastrada ainda.</div>';
        return;
      }
      _automationsCache = {};
      snap.docs.forEach(doc => { _automationsCache[doc.id] = doc.data(); });

      list.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const device = DEVICES.find(x => x.id === d.deviceType);
        const isEnabled = d.enabled !== false;
        const { whenText, thenText } = describeAutomation(d);

        const badgeClass = isEnabled ? 'badge badge-active' : 'badge badge-disabled';
        const badgeText = isEnabled ? '⚡ ATIVA' : '● DESLIGADA';

        return `
          <div class="automation-card ${isEnabled ? '' : 'disabled'}">
            <div class="automation-card-header">
              <span class="automation-card-icon" aria-hidden="true">${device?.icon || '⚙️'}</span>
              <div class="automation-card-name">${escapeHtml(d.deviceName)}</div>
              <span class="${badgeClass}">${badgeText}</span>
              <button type="button" class="toggle-switch ${isEnabled ? 'on' : ''}" data-id="${doc.id}" role="switch" aria-checked="${isEnabled}"></button>
              <button class="btn-edit" data-id="${doc.id}" aria-label="Editar automação" title="Editar">✏️</button>
              <button class="btn-delete" data-id="${doc.id}" aria-label="Excluir automação" title="Excluir">🗑️</button>
            </div>
            <div class="automation-card-body">
              <div class="automation-card-when"><span style="color:var(--text-muted);font-weight:600">Quando: </span>${whenText}</div>
              <div class="automation-card-then"><span style="color:var(--text-muted);font-weight:600">O sistema vai: </span>${thenText}</div>
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
      list.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => enterEditMode(btn.dataset.id));
      });
    });
}

async function toggleEnabled(id, enabled) {
  if (!currentUser) return;
  try {
    await db.collection('automations').doc(currentUser.uid)
      .collection('items').doc(id).update({ enabled });
  } catch (err) {
    console.error('Erro ao atualizar automação:', err);
    showListError('Erro ao salvar. Verifique sua conexão.');
  }
}

async function deleteAutomation(id) {
  if (!currentUser) return;
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

// ---- Tooltips ----
// Abrem no clique e nao no hover: quem usa teclado consegue abrir, e quem
// usa toque nao precisa passar o cursor por cima. Esc fecha e devolve o foco.

document.addEventListener('click', (e) => {
  const alvo = e.target.closest('.tooltip-icon');
  document.querySelectorAll('.tooltip-icon[aria-expanded="true"]').forEach(t => {
    if (t !== alvo) t.setAttribute('aria-expanded', 'false');
  });
  if (alvo) {
    const aberto = alvo.getAttribute('aria-expanded') === 'true';
    alvo.setAttribute('aria-expanded', aberto ? 'false' : 'true');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.tooltip-icon[aria-expanded="true"]').forEach(t => {
    t.setAttribute('aria-expanded', 'false');
    t.focus();
  });
});
