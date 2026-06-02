const DEVICES = [
  { id: 'luz',        name: 'Luz',        icon: '💡', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' } },
  { id: 'ventilador', name: 'Ventilador', icon: '🌀', labelOn: 'Ligado',  labelOff: 'Desligado', labelTransition: { on: 'Ligando...',   off: 'Desligando...' } },
  { id: 'portao',     name: 'Portão',     icon: '🚪', labelOn: 'Aberto',  labelOff: 'Fechado',   labelTransition: { on: 'Abrindo...',   off: 'Fechando...'   } },
  { id: 'alarme',     name: 'Alarme',     icon: '🔔', labelOn: 'Armado',  labelOff: 'Desarmado', labelTransition: { on: 'Armando...',   off: 'Desarmando...' } }
];
const DEVICE_ICONS = Object.fromEntries(DEVICES.map(d => [d.id, d.icon]));
