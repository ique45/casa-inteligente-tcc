const express  = require('express');
const { rtdb } = require('../firebase');
const { executeAutomations } = require('../services/automation');
const { logHistory }         = require('../services/history');

const router = express.Router();

const VALID_DEVICES  = ['luz', 'ventilador', 'portao', 'alarme'];
const VALID_TRIGGERS = ['presenca', 'temperatura', 'horario'];

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

router.post('/sync', async (req, res) => {
  const { uid, token, devices = {}, events = [], online = true } = req.body;

  if (!uid)                                return res.status(400).json({ error: 'uid obrigatório' });
  if (token !== process.env.ARDUINO_SECRET) return res.status(401).json({ error: 'token inválido' });

  try {
    // 1. Atualiza status do Arduino no RTDB
    await rtdb.ref(`arduino_status/${uid}`).set({
      online,
      lastSeen: Date.now()
    });

    // 2. Grava estado real de cada dispositivo informado pelo Arduino
    for (const [deviceId, state] of Object.entries(devices)) {
      if (!VALID_DEVICES.includes(deviceId)) continue;
      await rtdb.ref(`devices/${uid}/${deviceId}`).set({ state: !!state });
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
      .map(([deviceId, val]) => ({ device: deviceId, state: !!val.state }));

    // 5. Limpa a fila e registra no histórico como acionado pelo site
    if (siteCommands.length > 0) {
      await rtdb.ref(`commands/${uid}`).remove();
      for (const cmd of siteCommands) {
        await logHistory(uid, {
          deviceId: cmd.device,
          device:   cmd.device,
          trigger:  'botao',
          state:    cmd.state
        });
      }
    }

    // Combina comandos do site + comandos de automações por sensor
    const commands = [...siteCommands, ...automationCommands];

    res.json({ commands });

  } catch (err) {
    console.error('[/arduino/sync] erro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
