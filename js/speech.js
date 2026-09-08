// Saída falada das confirmações. O app já tem entrada por voz (voice.js);
// isto fecha o ciclo para quem não enxerga o estado na tela.
const speech = (() => {
  let vozPtBr = null;
  let procurou = false;

  function procurarVoz() {
    if (!('speechSynthesis' in window)) return;
    const vozes = window.speechSynthesis.getVoices();
    if (!vozes.length) return;            // Chrome responde vazio na 1ª chamada
    vozPtBr = vozes.find(v => /^pt[-_]BR/i.test(v.lang)) || null;
    procurou = true;
  }

  if ('speechSynthesis' in window) {
    procurarVoz();
    window.speechSynthesis.addEventListener('voiceschanged', procurarVoz);
  }

  return {
    // Só é "disponível" quando existe voz pt-BR — falar português com voz
    // inglesa fica ininteligível, que é pior que ficar em silêncio.
    disponivel() {
      if (!procurou) procurarVoz();
      return !!vozPtBr;
    },

    ativa() {
      return localStorage.getItem('ci-fala') === 'on';
    },

    falar(texto) {
      if (!this.ativa() || !this.disponivel() || !texto) return;
      // Realimentação: se o microfone está escutando, o reconhecimento
      // capta a própria voz do app. Não falar enquanto ele estiver ativo.
      if (typeof voiceControl !== 'undefined' && voiceControl.isListening()) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      u.voice = vozPtBr;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }
  };
})();
