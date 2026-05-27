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

auth.onAuthStateChanged(user => {
  if (!user) { window.location.href = 'login.html'; return; }
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

async function loadHistory(reset) {
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

    if (reset && docs.length === 0) {
      if (snap.docs.length === PAGE_SIZE && activeFilters.trigger !== 'todos') {
        // Primeira página cheia mas sem resultados filtrados — avança para a próxima
        lastDoc = snap.docs[snap.docs.length - 1];
        loadHistory(true);
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
      const icon = TRIGGER_ICONS[d.trigger] || '⚙️';
      const triggerLabel = TRIGGER_LABELS[d.trigger] || d.trigger;
      const ts = d.timestamp ? new Date(d.timestamp.toMillis()) : null;
      const timeStr = ts ? formatTime(ts) : '—';
      const stateLabel = stateText(d.deviceId, d.state);
      const stateClass = d.state ? 'state-on' : 'state-off';

      table.insertAdjacentHTML('beforeend', `
        <div class="history-row">
          <div class="history-info">
            <div class="history-device-name">${escapeHtml(d.device)}</div>
            <div class="history-sub">${icon} ${escapeHtml(triggerLabel)}</div>
          </div>
          <span class="history-state-badge ${stateClass}">${stateLabel}</span>
          <span class="history-time">${timeStr}</span>
        </div>
      `);
    });

    if (snap.docs.length === PAGE_SIZE) {
      lastDoc = snap.docs[snap.docs.length - 1];
      if (docs.length === 0 && activeFilters.trigger !== 'todos') {
        // Página cheia mas nenhum doc passou o filtro de gatilho — avança automaticamente
        loadHistory(false);
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

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Hoje, ${time}`;
  if (isYesterday) return `Ontem, ${time}`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + `, ${time}`;
}

document.getElementById('btn-load-more').addEventListener('click', () => {
  if (!allLoaded) loadHistory(false);
});

// ---- Navegação ----

document.getElementById('btn-logout').addEventListener('click', () => {
  auth.signOut().then(() => window.location.href = 'login.html');
});
document.getElementById('btn-dashboard').addEventListener('click', () => {
  window.location.href = 'dashboard.html';
});
document.getElementById('btn-automations').addEventListener('click', () => {
  window.location.href = 'automation.html';
});
document.getElementById('btn-profile').addEventListener('click', () => {
  window.location.href = 'profile.html';
});
