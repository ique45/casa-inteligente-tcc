function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const TRIGGER_ICONS = {
  voz:         '🎤',
  botao:       '🔘',
  presenca:    '👁️',
  horario:     '⏰',
  temperatura: '🌡️'
};

const TRIGGER_LABELS = {
  voz:         'Voz',
  botao:       'Botão',
  presenca:    'Presença',
  horario:     'Horário',
  temperatura: 'Temperatura'
};

const STATE_LABELS = {
  portao: { on: 'Aberto',  off: 'Fechado'   },
  alarme: { on: 'Armado',  off: 'Desarmado' }
};

function stateText(deviceId, state) {
  const labels = STATE_LABELS[deviceId];
  if (labels) return state ? labels.on : labels.off;
  return state ? 'Ligado' : 'Desligado';
}

const PAGE_SIZE = 20;

let currentUser = null;
let activeFilters = { trigger: 'todos', period: 'todos' };
let lastDoc = null;
let allLoaded = false;
let _historyGen = 0;
let _historyInitialized = false;

auth.onAuthStateChanged(user => {
  if (!user) { _historyInitialized = false; window.location.href = 'login.html'; return; }
  if (_historyInitialized) return;
  _historyInitialized = true;
  currentUser = user;
  loadHistory(true);
});

// ---- Filtros ----

document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const filter = chip.dataset.filter;
    document.querySelectorAll(`.filter-chip[data-filter="${filter}"]`).forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilters[filter] = chip.dataset.value;
    loadHistory(true);
  });
});

// ---- Carregamento ----

function buildActivatedBy(d) {
  if (d.trigger === 'voz')         return `🎤 Comando de voz`;
  if (d.trigger === 'botao')       return `🔘 Botão no dashboard`;
  if (d.trigger === 'presenca')    return `👁️ Sensor de presença detectou movimento`;
  if (d.trigger === 'horario')     return `⏰ Agendamento de horário programado`;
  if (d.trigger === 'temperatura') return `🌡️ Sensor de temperatura disparou`;
  return `⚙️ ${escapeHtml(d.trigger)}`;
}

const ACTION_LABELS = {
  portao: { on: 'ABRIU',    off: 'FECHOU'    },
  alarme: { on: 'ARMOU',    off: 'DESARMOU'  }
};

function actionText(deviceId, state) {
  const labels = ACTION_LABELS[deviceId];
  if (labels) return state ? labels.on : labels.off;
  return state ? 'LIGOU' : 'DESLIGOU';
}

async function loadHistory(reset, _depth = 0) {
  if (!currentUser) return;
  const myGen = reset ? ++_historyGen : _historyGen;
  if (_depth > 50) {
    if (reset) {
      document.getElementById('history-table').innerHTML =
        '<div class="empty-msg">Nenhuma ativação encontrada para esse filtro.</div>';
    }
    allLoaded = true;
    document.getElementById('btn-load-more').style.display = 'none';
    return;
  }
  if (reset) {
    lastDoc = null;
    allLoaded = false;
    document.getElementById('history-table').innerHTML = '<div class="empty-msg">Carregando...</div>';
    document.getElementById('btn-load-more').style.display = 'none';
  }

  try {
    let query = db.collection('users').doc(currentUser.uid)
      .collection('history')
      .orderBy('timestamp', 'desc');

    // Filtro de período
    const now = new Date();
    if (activeFilters.period === 'hoje') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      query = query.where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start));
    } else if (activeFilters.period === '7dias') {
      const start = new Date(now - 7 * 24 * 60 * 60 * 1000);
      query = query.where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start));
    } else if (activeFilters.period === '30dias') {
      const start = new Date(now - 30 * 24 * 60 * 60 * 1000);
      query = query.where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(start));
    }

    if (lastDoc) query = query.startAfter(lastDoc);
    query = query.limit(PAGE_SIZE);

    const snap = await query.get();
    const table = document.getElementById('history-table');

    // Filtragem por gatilho (client-side, evita índice composto no Firestore)
    let docs = snap.docs;
    if (activeFilters.trigger !== 'todos') {
      docs = docs.filter(d => d.data().trigger === activeFilters.trigger);
    }

    if (myGen !== _historyGen) return;

    if (reset && docs.length === 0) {
      if (snap.docs.length === PAGE_SIZE && activeFilters.trigger !== 'todos') {
        // Primeira página cheia mas sem resultados filtrados — avança para a próxima
        lastDoc = snap.docs[snap.docs.length - 1];
        loadHistory(false, _depth + 1);
        return;
      }
      const hasFilter = activeFilters.trigger !== 'todos' || activeFilters.period !== 'todos';
      const msg = hasFilter
        ? 'Nenhuma ativação encontrada.<br><span style="font-size:0.8rem">Tente mudar os filtros acima.</span>'
        : 'Nenhuma ativação ainda.';
      table.innerHTML = `<div class="empty-msg">${msg}</div>`;
      return;
    }

    if (reset) table.innerHTML = '';

    docs.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp ? formatTime(new Date(d.timestamp.toMillis())) : '—';
      const deviceIcon = DEVICE_ICONS[d.deviceId] || '⚙️';
      const label = actionText(d.deviceId, d.state);
      const stateClass = d.state ? 'badge-state-on' : 'badge-state-off';
      const activatedBy = buildActivatedBy(d);

      table.insertAdjacentHTML('beforeend', `
        <div class="history-card">
          <div class="history-card-header">
            <span class="history-card-icon">${deviceIcon}</span>
            <div class="history-card-name">${escapeHtml(d.device)}</div>
            <div class="history-card-time">${ts}</div>
            <span class="badge ${stateClass}">${label}</span>
          </div>
          <div class="history-card-body">
            <span class="activated-label">Ativado por: </span>${activatedBy}
          </div>
        </div>
      `);
    });

    if (snap.docs.length === PAGE_SIZE) {
      lastDoc = snap.docs[snap.docs.length - 1];
      if (docs.length === 0 && activeFilters.trigger !== 'todos') {
        // Página cheia mas nenhum doc passou o filtro de gatilho — avança automaticamente
        loadHistory(false, _depth + 1);
        return;
      }
      document.getElementById('btn-load-more').style.display = 'block';
    } else {
      allLoaded = true;
      document.getElementById('btn-load-more').style.display = 'none';
    }
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    document.getElementById('history-table').innerHTML =
      '<div class="empty-msg">Erro ao carregar o histórico. Verifique sua conexão e tente novamente.</div>';
    document.getElementById('btn-load-more').style.display = 'none';
  }
}

function formatTime(date) {
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

document.getElementById('btn-load-more').addEventListener('click', () => {
  if (!allLoaded) {
    document.getElementById('btn-load-more').style.display = 'none';
    loadHistory(false);
  }
});

// ---- Navegação ----

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
