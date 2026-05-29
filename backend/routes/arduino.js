const express  = require('express');
const { rtdb } = require('../firebase');
const { executeAutomations } = require('../services/automation');
const { logHistory }         = require('../services/history');

const router = express.Router();

const VALID_DEVICES  = ['luz', 'ventilador', 'portao', 'alarme'];
const VALID_TRIGGERS = ['presenca', 'temperatura', 'horario'];
const DEVICE_NAMES   = { luz: 'Luz', ventilador: 'Ventilador', portao: 'Portão', alarme: 'Alarme' };

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/sync', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'body JSON obrigatório' });
  }
  const { uid, token, online = true } = req.body;
  const devices = (req.body.devices !== null && typeof req.body.devices === 'object' && !Array.isArray(req.body.devices)) ? req.body.devices : {};
  const events  = Array.isArray(req.body.events) ? req.body.events : [];

  if (!uid)                                return res.status(400).json({ error: 'uid obrigatório' });
  if (token !== process.env.ARDUINO_SECRET) return res.status(401).json({ error: 'token inválido' });

  try {
    // 1. Atualiza status do Arduino no RTDB
    await rtdb.ref(`arduino_status/${uid}`).update({
      online,
      lastSeen: Date.now()
    });

    // 2. Grava estado real de cada dispositivo informado pelo Arduino
    for (const [deviceId, state] of Object.entries(devices)) {
      if (!VALID_DEVICES.includes(deviceId)) continue;
      await rtdb.ref(`devices/${uid}/${deviceId}`).update({ state: !!state });
    }

    // 3. Executa automações disparadas pelos eventos do sensor
    const automationCommands = [];
    for (const event of events) {
      if (VALID_TRIGGERS.includes(event)) {
        const results = await executeAutomations(uid, event);
        automationCommands.push(...results);
      }
    }

    // 4. Lê comandos pendentes que o site enfileirou (dashboard.js)
    const commandsSnap = await rtdb.ref(`commands/${uid}`).once('value');
    const rawCommands  = commandsSnap.val() || {};

    const siteCommands = Object.entries(rawCommands)
      .filter(([deviceId]) => VALID_DEVICES.includes(deviceId))
      .map(([deviceId, val]) => ({
        device: deviceId,
        state: !!(val && typeof val === 'object' ? val.state : val)
      }));

    // 5. Limpa todos os commands lidos (válidos e inválidos), preservando os adicionados após este snapshot
    // O histórico já é gravado pelo dashboard.js no momento do clique
    const keysToRemove = Object.keys(rawCommands);
    if (keysToRemove.length > 0) {
      await Promise.allSettled(keysToRemove.map(k => rtdb.ref(`commands/${uid}/${k}`).remove()));
    }

    // Combina comandos, site-commands têm prioridade — deduplica por dispositivo
    const seen = new Set();
    const commands = [...siteCommands, ...automationCommands].filter(cmd => {
      if (seen.has(cmd.device)) return false;
      seen.add(cmd.device);
      return true;
    });

    res.json({ commands });

  } catch (err) {
    console.error('[/arduino/sync] erro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
