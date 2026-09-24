const TRIGGERS_BY_DEVICE = {
  luz:        ['voz', 'botao', 'presenca'],
  // Sem "presenca": um portão não deve abrir sozinho só porque detectou
  // alguém por perto — risco de segurança.
  portao:     ['voz', 'botao'],
  ventilador: ['voz', 'botao', 'temperatura', 'horario'],
  alarme:     ['botao', 'presenca', 'horario']
};

// TRIGGER_INFO, VOICE_VERBS, montarComandos() e describeAutomation() vêm de
// js/devices.js — compartilhados com o dashboard, que também precisa
// descrever automações e reconhecer os comandos de voz.

// par: índice em VOICE_VERBS[device] que gerou as frases (null = nenhum).
// editadoOn/Off: o usuário mexeu no campo à mão; aí renomear não o sobrescreve.
function formVazio(device) {
  return { device: device || null, name: '', trigger: null,
           voiceOn: '', voiceOff: '', par: null, editadoOn: false, editadoOff: false };
}

let currentUser = null;
let form = formVazio();
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
  form = formVazio();
  const _inputName = document.getElementById('input-name');
  if (_inputName) _inputName.value = '';
  limparCamposVoz();
  renderDeviceChips();
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
  form = formVazio(id);
  document.querySelectorAll('#device-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === id;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });
  document.getElementById('input-name').value = '';
  document.getElementById('step-name').style.display = 'block';
  hideFrom('step-trigger');
  updatePreview();
}

function getTriggerNote(triggerId, deviceId) {
  if (triggerId === 'botao') {
    return `O botão no dashboard sempre alterna o estado: ${descAlternar(deviceId)}.`;
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
  // Tocar de novo no gatilho já escolhido (fácil no celular) não pode
  // apagar os comandos que a pessoa escreveu.
  if (form.trigger === id) return;
  form.trigger = id;
  document.querySelectorAll('#trigger-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === id;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  showTriggerNote(id, form.device);

  if (id === 'voz') {
    // Já entra com o primeiro par escolhido: as frases aparecem prontas.
    escolherPar(0);
    document.getElementById('step-voice').style.display = 'block';
  } else {
    limparCamposVoz();
    document.getElementById('step-voice').style.display = 'none';
  }
  updatePreview();
}

function limparCamposVoz() {
  form.voiceOn = ''; form.voiceOff = '';
  form.par = null; form.editadoOn = false; form.editadoOff = false;
  const on = document.getElementById('input-voice-on');
  const off = document.getElementById('input-voice-off');
  if (on) on.value = '';
  if (off) off.value = '';
}

function renderVoiceVerbs() {
  const pares = VOICE_VERBS[form.device] || [];
  const wrap = document.getElementById('voice-verbs');
  wrap.innerHTML = pares.map((p, i) => {
    const escolhido = form.par === i;
    return `<button type="button" class="suggestion-chip${escolhido ? ' selected' : ''}" data-par="${i}" aria-pressed="${escolhido}">${escapeHtml(p.on)} / ${escapeHtml(p.off)}</button>`;
  }).join('');
  wrap.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => { escolherPar(Number(chip.dataset.par)); updatePreview(); });
  });
}

// Escolher um par sempre reescreve as duas frases e esquece edições à mão.
function escolherPar(i) {
  form.par = i;
  form.editadoOn = false;
  form.editadoOff = false;
  recalcularComandos();
  renderVoiceVerbs();
}

// Refaz as frases a partir do par e do nome, poupando o campo editado à mão.
function recalcularComandos() {
  const par = (VOICE_VERBS[form.device] || [])[form.par];
  if (!par) return;
  const { voiceOn, voiceOff } = montarComandos(par, form.name);
  if (!form.editadoOn) {
    form.voiceOn = voiceOn;
    document.getElementById('input-voice-on').value = voiceOn;
  }
  if (!form.editadoOff) {
    form.voiceOff = voiceOff;
    document.getElementById('input-voice-off').value = voiceOff;
  }
}

function hideFrom(stepId) {
  const steps = ['step-trigger', 'step-voice', 'preview-wrap', 'btn-save-auto'];
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
  form = formVazio(d.deviceType);
  form.name = d.deviceName;
  form.trigger = d.trigger;
  form.voiceOn = d.voiceOn || '';
  form.voiceOff = d.voiceOff || '';
  // A frase que ainda é a gerada pelo par continua sendo recalculada ao
  // renomear; a que o usuário escreveu fica como está.
  Object.assign(form, detectarPar(VOICE_VERBS[form.device] || [], form.name, form.voiceOn, form.voiceOff));

  document.getElementById('form-wrap').style.display = 'block';
  document.getElementById('btn-new-auto').textContent = '✕ Cancelar';

  document.querySelectorAll('#device-chips .chip').forEach(c => {
    const escolhido = c.dataset.id === form.device;
    c.classList.toggle('selected', escolhido);
    c.setAttribute('aria-pressed', String(escolhido));
  });

  document.getElementById('input-name').value = form.name;
  document.getElementById('step-name').style.display = 'block';

  document.getElementById('step-trigger').style.display = 'block';
  renderTriggerChips();
  showTriggerNote(form.trigger, form.device);

  if (form.trigger === 'voz') {
    renderVoiceVerbs();
    document.getElementById('input-voice-on').value = form.voiceOn;
    document.getElementById('input-voice-off').value = form.voiceOff;
    document.getElementById('step-voice').style.display = 'block';
  } else {
    document.getElementById('step-voice').style.display = 'none';
  }

  document.getElementById('btn-save-auto').textContent = 'Salvar alterações';
  updatePreview();
  document.getElementById('form-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---- Preview em tempo real ----

function _listaCache() {
  return Object.keys(_automationsCache).map(id => ({ id, data: _automationsCache[id] }));
}

// Mensagem que impede salvar (null = ok) e aviso que só informa.
function validarVoz() {
  if (form.trigger !== 'voz') return { erro: null, aviso: null };
  const on = form.voiceOn.trim(), off = form.voiceOff.trim();
  const erro = validarComandos(on, off);
  if (erro) return { erro, aviso: null };
  const repetida = comandoJaUsado(on, _listaCache(), editingId) || comandoJaUsado(off, _listaCache(), editingId);
  const aviso = repetida
    ? `Atenção: a automação "${repetida.data.deviceName}" já usa um desses comandos. Só uma delas vai responder.`
    : null;
  return { erro: null, aviso };
}

function updatePreview() {
  const previewWrap = document.getElementById('preview-wrap');
  const previewBox = document.getElementById('preview-box');
  const saveBtn = document.getElementById('btn-save-auto');
  const avisoEl = document.getElementById('voice-aviso');

  const d = DEVICES.find(x => x.id === form.device);
  if (!d) { previewWrap.style.display = 'none'; return; }
  previewWrap.style.display = 'block';

  const name = form.name.trim() || d.name;
  const nome = `<strong>${escapeHtml(name)}</strong>`;
  const alternar = `vai alternar o dispositivo ${nome} (${descAlternar(form.device)})`;
  const trigger = form.trigger;

  let text;
  if (trigger === 'voz') {
    const on = escapeHtml(form.voiceOn.trim() || '…');
    const off = escapeHtml(form.voiceOff.trim() || '…');
    text = `Ao falar "<strong>${on}</strong>", liga ${nome}; ao falar "<strong>${off}</strong>", desliga.`;
  } else if (trigger === 'botao') {
    text = `Ao clicar no botão do dashboard, ${alternar}`;
  } else if (trigger === 'presenca') {
    text = `Ao detectar presença, ${alternar}`;
  } else if (trigger === 'temperatura') {
    text = `Quando o sensor de temperatura disparar, ${alternar}`;
  } else if (trigger === 'horario') {
    text = `No horário programado no Arduino, ${alternar}`;
  } else {
    text = `<strong>${escapeHtml(d.name)}</strong> — escolha o gatilho`;
  }
  previewBox.innerHTML = text;

  const { erro, aviso } = validarVoz();
  const mensagem = erro || aviso;
  avisoEl.textContent = mensagem || '';
  avisoEl.style.display = mensagem ? 'block' : 'none';

  const isReady = !!(trigger && form.name.trim() && !erro);
  previewBox.classList.toggle('ready', isReady);
  saveBtn.style.display = isReady ? 'inline-flex' : 'none';
}

// ---- Eventos de input ----

document.getElementById('input-name').addEventListener('input', e => {
  form.name = e.target.value;
  if (form.name.trim()) {
    document.getElementById('step-trigger').style.display = 'block';
    renderTriggerChips();
    // Apagar o nome esconde também a etapa de voz, mas mantém o gatilho
    // escolhido; ao digitar de novo ela precisa voltar junto com o gatilho.
    // Sem isso "Voz" aparecia marcado, o toque nele era ignorado e o botão
    // Salvar surgia com comandos que a pessoa não via.
    if (form.trigger === 'voz') {
      document.getElementById('step-voice').style.display = 'block';
      renderVoiceVerbs();
    }
  } else {
    hideFrom('step-trigger');
  }
  if (form.trigger === 'voz') recalcularComandos();
  updatePreview();
});

document.getElementById('input-voice-on').addEventListener('input', e => {
  form.voiceOn = e.target.value;
  form.editadoOn = true;
  updatePreview();
});

document.getElementById('input-voice-off').addEventListener('input', e => {
  form.voiceOff = e.target.value;
  form.editadoOff = true;
  updatePreview();
});

// ---- Salvar automação ----

document.getElementById('btn-save-auto').addEventListener('click', async () => {
  if (!currentUser) return;
  if (!form.device || !form.trigger || !form.name.trim()) return;
  if (validarVoz().erro) return;
  const btn = document.getElementById('btn-save-auto');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  const data = {
    deviceType: form.device,
    deviceName: form.name.trim(),
    trigger: form.trigger,
    action: 'toggle'
  };
  if (form.trigger === 'voz') {
    data.voiceOn = form.voiceOn.trim();
    data.voiceOff = form.voiceOff.trim();
  } else if (editingId) {
    data.voiceOn = firebase.firestore.FieldValue.delete();
    data.voiceOff = firebase.firestore.FieldValue.delete();
  }

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
  form = formVazio();
  editingId = null;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  document.getElementById('input-name').value = '';
  limparCamposVoz();
  document.getElementById('step-name').style.display = 'none';
  hideFrom('step-trigger');
  const noteEl = document.getElementById('trigger-note');
  if (noteEl) noteEl.style.display = 'none';
  const avisoEl = document.getElementById('voice-aviso');
  if (avisoEl) avisoEl.style.display = 'none';
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
