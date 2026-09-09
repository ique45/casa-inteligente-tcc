const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligada',  speechOff: 'desligada'  },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' }, speechOn: 'ligado',  speechOff: 'desligado'  },
  { id: 'portao',     name: 'Portão',     icon: '🚪', labelOn: 'Aberto',  labelOff: 'Fechado',   labelTransition: { on: 'Abrindo...',   off: 'Fechando...'   }, speechOn: 'aberto',  speechOff: 'fechado'    },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔', labelOn: 'Armado',  labelOff: 'Desarmado', labelTransition: { on: 'Armando...',   off: 'Desarmando...' }, speechOn: 'armado',  speechOff: 'desarmado'  }
];

// "Luz ligada", não "Luz ligado" — os rótulos visuais (labelOn) não concordam
// em gênero com o nome do dispositivo, então não servem para a fala.
function frasePara(deviceId, isOn) {
  const d = DEVICES.find(x => x.id === deviceId);
  if (!d) return null;
  return `${d.name} ${isOn ? d.speechOn : d.speechOff}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// Inerte no navegador, onde `module` não existe; só o Node (testes) usa isto.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEVICES, escapeHtml, formatRelativeTime, frasePara };
}
