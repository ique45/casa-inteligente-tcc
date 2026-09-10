const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  // '.json' fica de fora de propósito: .json não está na allowlist (é o que
  // bloqueia a chave de service account do Firebase), então nunca chegaria aqui.
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

  // --- Dados de exemplo (só existem no modo preview) ---------------------
  var now = Date.now();
  var ts = function(ms) { return { toMillis: function(){ return ms; }, toDate: function(){ return new Date(ms); } }; };
  var SEED = {
    // db.collection('users').doc(uid).get()
    users: [{ id: 'preview-uid', data: {
      name: 'Dona Maria',
      activeProfiles: ['idoso'],
      activeToggles: { voz: true, botao: true, presenca: true, horario: false, temperatura: false }
    } }],
    // db.collection('users').doc(uid).collection('history')
    history: [
      { id: 'h1', data: { device: 'Luz da sala', deviceId: 'luz',        trigger: 'botao',       state: true,  timestamp: ts(now - 12 * 60 * 1000) } },
      { id: 'h2', data: { device: 'Ventilador',   deviceId: 'ventilador', trigger: 'temperatura', state: true,  timestamp: ts(now - 55 * 60 * 1000) } },
      { id: 'h3', data: { device: 'Portão',       deviceId: 'portao',     trigger: 'voz',         state: false, timestamp: ts(now - 3 * 60 * 60 * 1000) } },
      { id: 'h4', data: { device: 'Alarme',       deviceId: 'alarme',     trigger: 'presenca',    state: true,  timestamp: ts(now - 26 * 60 * 60 * 1000) } },
      { id: 'h5', data: { device: 'Luz da sala',  deviceId: 'luz',        trigger: 'botao',       state: false, timestamp: ts(now - 28 * 60 * 60 * 1000) } }
    ],
    // db.collection('automations').doc(uid).collection('items')
    items: [
      { id: 'a1', data: { deviceType: 'luz',        deviceName: 'Luz da sala',        trigger: 'botao',       action: 'toggle', enabled: true,  voiceCommand: '',               createdAt: ts(now - 7 * 86400000) } },
      { id: 'a2', data: { deviceType: 'ventilador', deviceName: 'Ventilador do quarto', trigger: 'botao',     action: 'toggle', enabled: true,  voiceCommand: '',               createdAt: ts(now - 7 * 86400000) } },
      { id: 'a3', data: { deviceType: 'portao',     deviceName: 'Portão da garagem',  trigger: 'botao',       action: 'toggle', enabled: true,  voiceCommand: '',               createdAt: ts(now - 6 * 86400000) } },
      { id: 'a4', data: { deviceType: 'alarme',     deviceName: 'Alarme da entrada',  trigger: 'botao',       action: 'toggle', enabled: true,  voiceCommand: '',               createdAt: ts(now - 6 * 86400000) } },
      { id: 'a5', data: { deviceType: 'luz',        deviceName: 'Luz da sala',        trigger: 'presenca',    action: 'on',     enabled: true,  voiceCommand: '',               createdAt: ts(now - 4 * 86400000) } },
      { id: 'a6', data: { deviceType: 'ventilador', deviceName: 'Ventilador do quarto', trigger: 'temperatura', action: 'on',   enabled: true,  voiceCommand: '',               createdAt: ts(now - 3 * 86400000) } },
      { id: 'a7', data: { deviceType: 'portao',     deviceName: 'Portão da garagem',  trigger: 'voz',         action: 'off',    enabled: true,  voiceCommand: 'fechar o portão', createdAt: ts(now - 2 * 86400000) } },
      { id: 'a8', data: { deviceType: 'alarme',     deviceName: 'Alarme da entrada',  trigger: 'horario',     action: 'on',     enabled: false, voiceCommand: '',               createdAt: ts(now - 1 * 86400000) } }
    ]
  };
  var RTDB_SEED = {
    devices: { luz: { state: true }, ventilador: { state: true }, portao: { state: false }, alarme: { state: false } },
    arduino_status: { online: true, lastSeen: now, temperature: 24 }
  };

  // --- Firestore falso, encadeável -------------------------------------
  function snapList(docs) {
    var wrapped = (docs || []).map(function(d) { return { id: d.id, exists: true, data: function(){ return d.data; } }; });
    return { empty: wrapped.length === 0, size: wrapped.length, docs: wrapped, forEach: function(fn){ wrapped.forEach(fn); } };
  }
  function fakeQuery(name) {
    var q = {
      where: function(){ return q; }, orderBy: function(){ return q; },
      limit: function(){ return q; }, startAfter: function(){ return q; },
      get: function(){ return Promise.resolve(snapList(SEED[name])); },
      onSnapshot: function(cb){ cb(snapList(SEED[name])); return function(){}; },
      add: function(){ return Promise.resolve({ id: 'novo-' + Date.now() }); },
      doc: function(){ return fakeDoc(name); }
    };
    return q;
  }
  function fakeDoc(name) {
    var first = (SEED[name] && SEED[name][0]) ? SEED[name][0].data : {};
    return {
      get: function(){ return Promise.resolve({ exists: true, data: function(){ return first; } }); },
      set: function(){ return Promise.resolve(); },
      update: function(){ return Promise.resolve(); },
      delete: function(){ return Promise.resolve(); },
      onSnapshot: function(cb){ cb({ exists: true, data: function(){ return first; } }); return function(){}; },
      collection: function(sub){ return fakeQuery(sub); }
    };
  }
  window.__previewMode = true;
  window.__fakeFirebaseAuth = {
    onAuthStateChanged: function(cb) { setTimeout(() => cb(fakeUser), 0); return () => {}; },
    signInWithEmailAndPassword: () => Promise.resolve({ user: fakeUser }),
    signInWithPopup: () => Promise.resolve({ user: fakeUser }),
    createUserWithEmailAndPassword: () => Promise.resolve({ user: fakeUser }),
    signOut: () => Promise.resolve()
  };
  window.__fakeFirebaseDb = { collection: function(name){ return fakeQuery(name); } };
  window.__fakeFirebaseRtdb = { ref: function(path){
    var key = String(path).split('/')[0];
    return {
      on: function(ev, cb){ if (ev === 'value') cb({ val: function(){ return RTDB_SEED[key] || {}; } }); return cb; },
      off: function(){},
      set: () => Promise.resolve()
    };
  } };
  // Substitui firebase.auth/firestore/database por mocks. O wrapping acontece no
  // getter, não no setter: firebase-app-compat.js atribui window.firebase antes de
  // auth/firestore/database-compat.js adicionarem seus métodos, então no momento do
  // set só .auth (ou nem isso) existe. O getter re-tenta a cada acesso até os três
  // estarem presentes, o que ocorre bem antes de dashboard.js rodar.
  Object.defineProperty(window, 'firebase', {
    configurable: true,
    get: function() {
      var real = window.__realFirebase;
      if (!real || real.__previewDone) return real;
      var done = true;
      if (real.auth && !real.auth.__pw) {
        var origAuth = real.auth.bind(real);
        real.auth = function() {
          var a = origAuth();
          Object.assign(a, window.__fakeFirebaseAuth);
          return a;
        };
        real.auth.__pw = true;
      } else if (!real.auth) { done = false; }
      if (real.firestore && !real.firestore.__pw) {
        var fs = function() { return window.__fakeFirebaseDb; };
        Object.assign(fs, real.firestore); // preserva FieldValue, Timestamp
        fs.__pw = true;
        real.firestore = fs;
      } else if (!real.firestore) { done = false; }
      if (real.database && !real.database.__pw) {
        real.database = function() { return window.__fakeFirebaseRtdb; };
        real.database.__pw = true;
      } else if (!real.database) { done = false; }
      if (done) real.__previewDone = true;
      return real;
    },
    set: function(v) { window.__realFirebase = v; }
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
  // Lowercase aqui (uma unica vez) para que a busca no MIME e o teste
  // === '.html' abaixo enxerguem o mesmo valor que isPathAllowed usa
  // internamente — sem isso, /index.HTML passava na allowlist mas caia
  // no branch generico (application/octet-stream) e pulava o serveHtml.
  const ext = path.extname(filePath).toLowerCase();

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
}).listen(8080, '127.0.0.1', () => console.log('Serving at http://localhost:8080'));
