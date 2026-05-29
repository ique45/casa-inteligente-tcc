const { db, rtdb } = require('../firebase');
const { logHistory } = require('./history');

/**
 * Resolve o estado final para uma ação dado o estado atual.
 * @param {'toggle'|'on'|'off'} action
 * @param {boolean} currentState
 * @returns {boolean|null}
 */
function resolveAction(action, currentState) {
  if (action === 'toggle') return !currentState;
  if (action === 'on')     return true;
  if (action === 'off')    return false;
  return null;
}

/**
 * Busca automações ativas do usuário para um gatilho específico
 * e executa cada uma: atualiza RTDB + grava histórico.
 * @param {string} uid
 * @param {'presenca'|'temperatura'|'horario'} trigger
 */
async function executeAutomations(uid, trigger) {
  const snap = await db
    .collection('automations').doc(uid)
    .collection('items')
    .where('trigger', '==', trigger)
    .where('enabled', '==', true)
    .get();

  if (snap.empty) return [];

  const devicesSnap = await rtdb.ref(`devices/${uid}`).once('value');
  const devicesData = devicesSnap.val() || {};

  const results = [];

  for (const doc of snap.docs) {
    const auto         = doc.data();
    const currentState = (devicesData[auto.deviceType] || {}).state === true;
    const newState     = resolveAction(auto.action, currentState);

    if (newState === null) continue;

    const deviceRef = rtdb.ref(`devices/${uid}/${auto.deviceType}`);
    await deviceRef.update({ state: newState });
    await logHistory(uid, {
      deviceId: auto.deviceType,
      device:   auto.deviceName,
      trigger,
      state:    newState
    });

    devicesData[auto.deviceType] = { ...devicesData[auto.deviceType], state: newState };
    results.push({ device: auto.deviceType, state: newState });
  }

  return results;
}

module.exports = { resolveAction, executeAutomations };
