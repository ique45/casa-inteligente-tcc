const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ROOT = __dirname;

// Script injetado nas páginas protegidas quando ?preview=1 está na URL.
// Mocka o Firebase auth/db/rtdb para evitar redirect para login durante testes visuais.
const PREVIEW_SCRIPT = `
<script>
(function() {
  var fakeUser = { uid: 'preview-uid', email: 'preview@teste.com', displayName: 'Preview' };
  var fakeSnap = { exists: true, data: () => ({ name: 'Preview', activeProfiles: [], activeToggles: {} }), forEach: function(){} };
  var fakeDoc  = { get: () => Promise.resolve(fakeSnap), set: () => Promise.resolve(), update: () => Promise.resolve(), onSnapshot: (cb) => { cb(fakeSnap); return () => {}; } };
  var fakeCol  = { doc: () => fakeDoc, add: () => Promise.resolve({ id: 'fake-id' }), where: function(){ return this; }, orderBy: function(){ return this; }, limit: function(){ return this; }, get: () => Promise.resolve({ forEach: function(){}, docs: [] }), onSnapshot: (cb) => { cb({ forEach: function(){}, docs: [] }); return () => {}; } };
  var fakeRtdbRef = { on: function(ev, cb){ if(ev==='value') cb({ val: () => ({}) }); }, off: function(){}, set: () => Promise.resolve() };
  window.__previewMode = true;
  window.__fakeFirebaseAuth = {
    onAuthStateChanged: function(cb) { setTimeout(() => cb(fakeUser), 0); return () => {}; },
    signInWithEmailAndPassword: () => Promise.resolve({ user: fakeUser }),
    signOut: () => Promise.resolve()
  };
  window.__fakeFirebaseDb   = { collection: () => fakeCol };
  window.__fakeFirebaseRtdb = { ref: () => fakeRtdbRef };
  // Substitui firebase.auth/firestore/database antes de firebase-config.js rodar
  var _origInit;
  Object.defineProperty(window, 'firebase', {
    configurable: true,
    get: function() { return window.__realFirebase; },
    set: function(v) {
      window.__realFirebase = v;
      var origAuth = v.auth.bind(v);
      v.auth = function() {
        var a = origAuth();
        Object.assign(a, window.__fakeFirebaseAuth);
        return a;
      };
      var origFirestore = v.firestore ? v.firestore.bind(v) : null;
      if (origFirestore) v.firestore = function() { return window.__fakeFirebaseDb; };
      var origDatabase = v.database ? v.database.bind(v) : null;
      if (origDatabase) v.database = function() { return window.__fakeFirebaseRtdb; };
    }
  });
})();
</script>`;

function serveHtml(res, data, isPreview) {
  let html = data.toString();
  if (isPreview) {
    html = html.replace('<head>', '<head>' + PREVIEW_SCRIPT);
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Verifica se um caminho pode ser servido usando ALLOWLIST, nao DENYLIST.
// Allowlist eh muito mais seguro porque:
// 1. Nao requer enumerar todos os nomes perigosos possiveis
// 2. Windows eh case-insensitive, entao uppercase bypasses denylist
// 3. Nao perde com 8.3 short names (ex: CASA-I~1.JSON bypassa firebase-adminsdk check)
// 4. Novos arquivos secretos adicionados ao projeto serao automaticamente bloqueados
// A estrategia: servir APENAS css/, js/, e arquivos HTML/media na raiz. Tudo mais eh 403.
function isPathAllowed(filePath) {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(ROOT);

  // Containment check: garantir que o arquivo esta dentro de ROOT
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    return false;
  }

  // Allowlist: especificar exatamente o que pode ser servido
  const relativePath = path.relative(ROOT, resolvedPath).toLowerCase();
  const pathParts = relativePath.split(path.sep);
  const firstSegment = pathParts[0];


  // Permite arquivos em diretorios css/ e js/
  if (firstSegment === 'css' || firstSegment === 'js') {
    return true;
  }

  // Permite arquivos na raiz com extensoes seguras (HTML, media, stylesheets, scripts)
  if (pathParts.length === 1) {
    const ext = path.extname(relativePath);
    const allowedExts = ['.html', '.css', '.js', '.png', '.jpg', '.svg', '.ico'];
    if (allowedExts.includes(ext)) {
      return true;
    }
  }

  return false;
}

http.createServer((req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const isPreview = qs.includes('preview=1');
  let filePath = path.join(ROOT, req.url.split('?')[0]);
  if (filePath === ROOT || filePath === ROOT + path.sep) filePath = path.join(ROOT, 'index.html');

  // Branch por extensao: cada ramo checa allowlist antes de fs.readFile
  const ext = path.extname(filePath);

  if (ext) {
    // Arquivo com extensao: deve estar na allowlist, ou nao eh servido
    if (!isPathAllowed(filePath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const mime = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      if (ext === '.html') { serveHtml(res, data, isPreview); return; }
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  } else {
    // Sem extensao: UNICA coisa servida eh a pagina .html com esse nome
    const fallbackPath = filePath + '.html';
    if (!isPathAllowed(fallbackPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(fallbackPath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      serveHtml(res, data, isPreview);
    });
  }
}).listen(8080, '127.0.0.1', () => console.log('Serving at http://127.0.0.1:8080'));
