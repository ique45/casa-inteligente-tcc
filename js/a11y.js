// Preferencias de acessibilidade — tamanho do texto e tema.
//
// Ficam em localStorage e nao no perfil do usuario de proposito: precisam
// valer na tela de login, antes de existir sessao. O <head> de cada pagina
// tem um script inline que le esses mesmos valores antes do CSS carregar,
// para a tela nao piscar no tema errado; aqui cuidamos da interacao.

(function () {
  var root = document.documentElement;
  var live = document.getElementById('a11y-live');

  function anunciar(msg) {
    if (live) live.textContent = msg;
  }

  // ---- Tamanho do texto ----
  // A raiz esta em 100%, entao mudar o tamanho dela escala a interface
  // inteira, que esta toda em rem.

  var NOMES = {
    normal: 'Texto normal',
    grande: 'Texto grande',
    maior:  'Texto muito grande'
  };
  var tamanhoAtual = localStorage.getItem('ci-textsize') || 'normal';

  function aplicarTamanho(size, anunciando) {
    if (!NOMES[size]) size = 'normal';
    tamanhoAtual = size;
    if (size === 'normal') root.removeAttribute('data-textsize');
    else root.setAttribute('data-textsize', size);
    localStorage.setItem('ci-textsize', size);
    document.querySelectorAll('.a11y-size').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
    if (anunciando) anunciar(NOMES[size]);
  }

  document.querySelectorAll('.a11y-size').forEach(function (b) {
    b.addEventListener('click', function () {
      aplicarTamanho(b.dataset.size, true);
    });
  });

  // ---- Tema ----

  var temaAtual = localStorage.getItem('ci-theme') === 'escuro' ? 'escuro' : 'claro';
  var btnTema = document.getElementById('btn-theme');
  var lblTema = document.getElementById('btn-theme-label');

  function aplicarTema(tema, anunciando) {
    temaAtual = tema;
    if (tema === 'escuro') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    localStorage.setItem('ci-theme', tema);

    // O botao nomeia a ACAO, nao o estado: quem esta no claro le "Tema escuro",
    // que e para onde o clique leva. Nomear o estado confunde.
    if (lblTema) lblTema.textContent = tema === 'escuro' ? 'Tema claro' : 'Tema escuro';
    if (btnTema && btnTema.firstElementChild) {
      btnTema.firstElementChild.textContent = tema === 'escuro' ? '☀️' : '🌙';
    }
    if (anunciando) anunciar(tema === 'escuro' ? 'Tema escuro ativado' : 'Tema claro ativado');
  }

  if (btnTema) {
    btnTema.addEventListener('click', function () {
      aplicarTema(temaAtual === 'escuro' ? 'claro' : 'escuro', true);
    });
  }

  aplicarTamanho(tamanhoAtual, false);
  aplicarTema(temaAtual, false);
})();
