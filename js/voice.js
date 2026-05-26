// Web Speech API — comandos mapeados para dispositivos
// Expandir quando as automações forem configuradas pelo usuário
const voiceControl = (() => {
  const COMMANDS = [
    { pattern: /ligar?\s+(?:a\s+)?luz/i,            deviceId: 'luz',        action: true  },
    { pattern: /desligar?\s+(?:a\s+)?luz/i,         deviceId: 'luz',        action: false },
    { pattern: /acend[ae]r?\s+(?:a\s+)?luz/i,       deviceId: 'luz',        action: true  },
    { pattern: /apag(?:ar?|ue)\s+(?:a\s+)?luz/i,    deviceId: 'luz',        action: false },
    { pattern: /ligar?\s+(?:o\s+)?ventilador/i,     deviceId: 'ventilador', action: true  },
    { pattern: /desligar?\s+(?:o\s+)?ventilador/i,  deviceId: 'ventilador', action: false },
    { pattern: /abrir?\s+(?:o\s+)?port[ãa]o/i,      deviceId: 'portao',     action: true  },
    { pattern: /fechar?\s+(?:o\s+)?port[ãa]o/i,     deviceId: 'portao',     action: false },
    { pattern: /ligar?\s+(?:o\s+)?alarme/i,         deviceId: 'alarme',     action: true  },
    { pattern: /desligar?\s+(?:o\s+)?alarme/i,      deviceId: 'alarme',     action: false },
    { pattern: /armar?\s+(?:o\s+)?alarme/i,         deviceId: 'alarme',     action: true  },
    { pattern: /desarmar?\s+(?:o\s+)?alarme/i,      deviceId: 'alarme',     action: false },
    { pattern: /ativar?\s+(?:o\s+)?alarme/i,        deviceId: 'alarme',     action: true  },
    { pattern: /desativar?\s+(?:o\s+)?alarme/i,     deviceId: 'alarme',     action: false }
  ];

  let recognition = null;
  let listening = false;

  const api = {
    onResult: null,
    onEnd: null,

    isListening() { return listening; },

    start() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        if (api.onError) api.onError('not-supported');
        return;
      }

      recognition = new SR();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e) => {
        const command = e.results[0][0].transcript.trim();
        const match = COMMANDS.find(c => c.pattern.test(command));
        if (api.onResult) {
          api.onResult({
            command,
            deviceId: match?.deviceId || null,
            action: match !== undefined ? match.action : null
          });
        }
      };

      recognition.onerror = (e) => {
        listening = false;
        if (api.onError) api.onError(e.error);
        // onEnd não chamado aqui: onError já trata o reset da UI
      };

      recognition.onend = () => {
        listening = false;
        if (api.onEnd) api.onEnd();
      };

      recognition.start();
      listening = true;
    },

    stop() {
      if (recognition) recognition.stop();
      listening = false;
    }
  };

  return api;
})();
