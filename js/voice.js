// Web Speech API — comandos salvos nas automações de voz e, como reserva,
// frases fixas mapeadas para dispositivos.
// \b garante que 'desligar' não case no padrão de 'ligar' (substring)
const voiceControl = (() => {
  // A luz externa vem antes: o primeiro padrão que casa vence, e o padrão
  // da luz interna ("acender luz") também casaria em "acender luz externa".
  const COMMANDS = [
    { pattern: /\bligar?\s+(?:a\s+)?luz\s+(?:de\s+)?(?:externa|fora)/i,         deviceId: 'luz_externa', action: true  },
    { pattern: /\bdesligar?\s+(?:a\s+)?luz\s+(?:de\s+)?(?:externa|fora)/i,      deviceId: 'luz_externa', action: false },
    { pattern: /\bacend[ae]r?\s+(?:a\s+)?luz\s+(?:de\s+)?(?:externa|fora)/i,    deviceId: 'luz_externa', action: true  },
    { pattern: /\bapag(?:ar?|ue)\s+(?:a\s+)?luz\s+(?:de\s+)?(?:externa|fora)/i, deviceId: 'luz_externa', action: false },
    { pattern: /\bligar?\s+(?:a\s+)?luz/i,            deviceId: 'luz',        action: true  },
    { pattern: /\bdesligar?\s+(?:a\s+)?luz/i,         deviceId: 'luz',        action: false },
    { pattern: /\bacend[ae]r?\s+(?:a\s+)?luz/i,       deviceId: 'luz',        action: true  },
    { pattern: /\bapag(?:ar?|ue)\s+(?:a\s+)?luz/i,    deviceId: 'luz',        action: false }
  ];

  let recognition = null;
  let listening = false;
  let _sessionCounter = 0;
  // Automações do usuário, atualizadas pelo dashboard a cada snapshot.
  let _automacoes = [];

  const api = {
    onResult: null,
    onEnd: null,

    isListening() { return listening; },
    setAutomacoes(lista) { _automacoes = lista || []; },

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
        if (!api.onResult) return;
        // Primeiro os comandos que o usuário salvou; se nenhum casar, os
        // padrões fixos — assim a voz funciona mesmo sem automação cadastrada.
        const salvo = encontrarComando(command, _automacoes);
        if (salvo) {
          api.onResult({
            command,
            deviceId: salvo.automation.data.deviceType,
            action: salvo.state,
            automationName: salvo.automation.data.deviceName,
            frase: salvo.frase
          });
          return;
        }
        // Frase de uma automação desligada: avisar em vez de executar pelo
        // padrão fixo — desligar a automação tem que desligar o comando.
        const desligada = comandoDesativado(command, _automacoes);
        if (desligada) {
          api.onResult({
            command,
            deviceId: null,
            action: null,
            automationName: desligada.automation.data.deviceName,
            frase: desligada.frase,
            desativada: true
          });
          return;
        }
        const match = COMMANDS.find(c => c.pattern.test(command));
        api.onResult({
          command,
          deviceId: match?.deviceId || null,
          action: match !== undefined ? match.action : null,
          automationName: null,
          frase: null
        });
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
