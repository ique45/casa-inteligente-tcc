// Web Speech API — comandos mapeados para dispositivos
// \b garante que 'desligar' não case no padrão de 'ligar' (substring)
const voiceControl = (() => {
  const COMMANDS = [
    { pattern: /\bligar?\s+(?:a\s+)?luz/i,            deviceId: 'luz',        action: true  },
    { pattern: /\bdesligar?\s+(?:a\s+)?luz/i,         deviceId: 'luz',        action: false },
    { pattern: /\bacend[ae]r?\s+(?:a\s+)?luz/i,       deviceId: 'luz',        action: true  },
    { pattern: /\bapag(?:ar?|ue)\s+(?:a\s+)?luz/i,    deviceId: 'luz',        action: false },
    { pattern: /\bligar?\s+(?:o\s+)?ventilador/i,     deviceId: 'ventilador', action: true  },
    { pattern: /\bdesligar?\s+(?:o\s+)?ventilador/i,  deviceId: 'ventilador', action: false },
    { pattern: /\babrir?\s+(?:o\s+)?port[ãa]o/i,      deviceId: 'portao',     action: true  },
    { pattern: /\bfechar?\s+(?:o\s+)?port[ãa]o/i,     deviceId: 'portao',     action: false },
    { pattern: /\bligar?\s+(?:o\s+)?alarme/i,         deviceId: 'alarme',     action: true  },
    { pattern: /\bdesligar?\s+(?:o\s+)?alarme/i,      deviceId: 'alarme',     action: false },
    { pattern: /\barmar?\s+(?:o\s+)?alarme/i,         deviceId: 'alarme',     action: true  },
    { pattern: /\bdesarmar?\s+(?:o\s+)?alarme/i,      deviceId: 'alarme',     action: false },
    { pattern: /\bativar?\s+(?:o\s+)?alarme/i,        deviceId: 'alarme',     action: true  },
    { pattern: /\bdesativar?\s+(?:o\s+)?alarme/i,     deviceId: 'alarme',     action: false }
  ];

  let recognition = null;
  let listening = false;
  let _sessionCounter = 0;

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

      let _hadError = false;
      const _sessionId = ++_sessionCounter;

      recognition.onresult = (e) => {
        if (_sessionId !== _sessionCounter) return;
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
        if (_sessionId !== _sessionCounter) return;
        listening = false;
        _hadError = true;
        if (api.onError) api.onError(e.error);
      };

      recognition.onend = () => {
        if (_sessionId !== _sessionCounter) return;
        listening = false;
        recognition = null;
        if (!_hadError && api.onEnd) api.onEnd();
        _hadError = false;
      };

      recognition.start();
      listening = true;
    },

    stop() {
      if (recognition) { recognition.stop(); recognition = null; }
      listening = false;
    }
  };

  return api;
})();
