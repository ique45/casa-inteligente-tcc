const { db, admin } = require('../firebase');

/**
 * Grava uma entrada no histórico de ativações do usuário.
 * @param {string} uid
 * @param {{ deviceId: string, device: string, trigger: string, state: boolean }} entry
 */
async function logHistory(uid, { deviceId, device, trigger, state }) {
  await db
    .collection('users').doc(uid)
    .collection('history').add({
      deviceId,
      device,
      trigger,
      state,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
}

module.exports = { logHistory };
