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

// Verifica se um caminho pode ser servido (seguranca: bloqueia arquivos sensiveis e path traversal)
function isPathAllowed(filePath) {
  // Resolve para path absoluto
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(ROOT);

  // Containment check: garantir que o arquivo esta dentro de ROOT
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    return false;
  }

  // Denylist: arquivos sensiveis nao devem ser servidos
  const relativePath = path.relative(ROOT, resolvedPath);
  const basename = path.basename(relativePath);

  // Bloqueia .env e variantes (exceto .env.example que eh seguro)
  if (basename === '.env' || (basename.startsWith('.env.') && basename !== '.env.example')) {
    return false;
  }

  // Bloqueia chaves de Firebase
  if (basename.includes('firebase-adminsdk') && basename.endsWith('.json')) {
    return false;
  }
  if (basename === 'serviceAccountKey.json') {
    return false;
  }

  // Bloqueia diretorios sensiveis
  if (relativePath.startsWith('.git' + path.sep) || relativePath === '.git') {
    return false;
  }
  if (relativePath.startsWith('node_modules' + path.sep) || relativePath === 'node_modules') {
    return false;
  }
  if (relativePath.startsWith('.superpowers' + path.sep) || relativePath === '.superpowers') {
    return false;
  }

  return true;
}

http.createServer((req, res) => {
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const isPreview = qs.includes('preview=1');
  let filePath = path.join(ROOT, req.url.split('?')[0]);
  if (filePath === ROOT || filePath === ROOT + path.sep) filePath = path.join(ROOT, 'index.html');

  // Verifica seguranca antes de tentar ler
  if (!isPathAllowed(filePath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err && !ext) {
      const fallbackPath = filePath + '.html';
      // Verifica seguranca para a fallback path tambem
      if (!isPathAllowed(fallbackPath)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fallbackPath, (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not found'); return; }
        serveHtml(res, data2, isPreview);
      });
      return;
    }
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    if (ext === '.html') { serveHtml(res, data, isPreview); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(8080, '127.0.0.1', () => console.log('Serving at http://127.0.0.1:8080'));
