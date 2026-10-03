const express       = require('express');
const { db, rtdb } = require('../firebase');
const { executeAutomations } = require('../services/automation');
const { logHistory } = require('../services/history');

const router = express.Router();

const VALID_DEVICES  = ['luz', 'luz_externa', 'alarme_armado', 'alarme'];
const VALID_TRIGGERS = ['presenca', 'botao_fisico', 'luminosidade'];

const MUDADOS_PELA_PLACA = {
  alarme:      { device: 'Alarme',      trigger: 'presenca' },
  luz_externa: { device: 'Luz externa', trigger: 'luminosidade' }
};

// Monitor serial no site: o firmware manda as linhas novas a cada sync e o
// painel mostra as últimas LOG_MAX, em arduino_status/{uid}/log (o dono da
// conta já tem leitura nesse caminho pelas regras do RTDB).
const LOG_MAX           = 60;
const LOG_MAX_POR_SYNC  = 30;
const LOG_MAX_CARACTERES = 160;

function linhasDeLog(log) {
  if (!Array.isArray(log)) return [];
  return log
    .filter(l => typeof l === 'string' && l.trim())
    .slice(-LOG_MAX_POR_SYNC)
    .map(l => l.slice(0, LOG_MAX_CARACTERES));
}

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
    // 1. Atualiza status do Arduino no RTDB, com as linhas novas do serial
    const agora = Date.now();
    const statusUpdate = { online, lastSeen: agora };
    const novas = linhasDeLog(req.body.log);
    if (novas.length) {
      const anteriorSnap = await rtdb.ref(`arduino_status/${uid}/log`).once('value');
      const anterior = Array.isArray(anteriorSnap.val()) ? anteriorSnap.val() : [];
      statusUpdate.log = [...anterior, ...novas.map(m => ({ t: agora, m }))].slice(-LOG_MAX);
    }
    await rtdb.ref(`arduino_status/${uid}`).update(statusUpdate);

    // 2. Grava estado real de cada dispositivo informado pelo Arduino
    for (const [deviceId, state] of Object.entries(devices)) {
      if (!VALID_DEVICES.includes(deviceId)) continue;
      // Alarme (PIR) e luz externa (LDR) são ligados pela própria placa, sem
      // passar por automação, então o histórico deles nasce aqui, a cada
      // mudança de estado.
      const daPlaca = MUDADOS_PELA_PLACA[deviceId];
      if (daPlaca) {
        const antes = (await rtdb.ref(`devices/${uid}/${deviceId}`).once('value')).val();
        if (antes && typeof antes === 'object' && antes.state !== !!state) {
          await logHistory(uid, { deviceId, device: daPlaca.device, trigger: daPlaca.trigger, state: !!state });
        }
      }
      await rtdb.ref(`devices/${uid}/${deviceId}`).update({ state: !!state });
    }

    // Se offline, não processa commands (evita perda quando Arduino desliga)
    if (!online) {
      res.json({ commands: [] });
      return;
    }

    // 3. Lê configurações do usuário (activeToggles)
    const userSnap      = await db.collection('users').doc(uid).get();
    const userData      = userSnap.exists ? userSnap.data() : {};
    const activeToggles = userData.activeToggles || {};

    // 4. Executa automações disparadas pelos eventos do sensor
    //    Respeita activeToggles: pula se o usuário desativou aquele tipo de gatilho
    const automationCommands = [];
    for (const event of events) {
      if (VALID_TRIGGERS.includes(event) && activeToggles[event] !== false) {
        const results = await executeAutomations(uid, event);
        automationCommands.push(...results);
      }
    }

    // 5. Lê comandos pendentes que o site enfileirou (dashboard.js)
    const commandsSnap = await rtdb.ref(`commands/${uid}`).once('value');
    const rawCommands  = commandsSnap.val() || {};

    const siteCommands = Object.entries(rawCommands)
      .filter(([deviceId]) => VALID_DEVICES.includes(deviceId))
      .map(([deviceId, val]) => ({
        device: deviceId,
        state: !!(val && typeof val === 'object' ? val.state : val)
      }));

    // 6. Limpa todos os commands lidos (válidos e inválidos), preservando os adicionados após este snapshot
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
