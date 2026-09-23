'use strict';
// Backup e limpeza das automações de teste (formato antigo, com
// voiceCommand/action escolhida). Uso:
//   node tools/limpar-automacoes.js <pasta-de-backup>            -> só lista e salva backup
//   node tools/limpar-automacoes.js <pasta-de-backup> --apagar   -> salva backup e apaga
// A pasta de backup deve ficar FORA do repositório.
const fs = require('fs');
const path = require('path');
const admin = require('../backend/node_modules/firebase-admin');

const RAIZ = path.join(__dirname, '..');
const chave = fs.readdirSync(RAIZ).find(f => /firebase-adminsdk.*\.json$/.test(f));
if (!chave) { console.error('Service account não encontrada na raiz do repo.'); process.exit(1); }

const pastaBackup = process.argv[2];
const apagar = process.argv.includes('--apagar');
if (!pastaBackup || pastaBackup.startsWith('--')) {
  console.error('Informe a pasta de backup (fora do repo).'); process.exit(1);
}
if (path.resolve(pastaBackup).startsWith(path.resolve(RAIZ))) {
  console.error('A pasta de backup não pode ficar dentro do repositório.'); process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(path.join(RAIZ, chave))) });
const db = admin.firestore();

(async () => {
  const donos = await db.collection('automations').listDocuments();
  const backup = {};
  let total = 0;
  for (const dono of donos) {
    const snap = await dono.collection('items').get();
    backup[dono.id] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    total += snap.size;
    console.log(`${dono.id}: ${snap.size} automação(ões)`);
  }
  fs.mkdirSync(pastaBackup, { recursive: true });
  const arquivo = path.join(pastaBackup, `automacoes-backup-${Date.now()}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(backup, null, 2));
  console.log(`Backup de ${total} automação(ões) em ${arquivo}`);

  if (!apagar) { console.log('Nada apagado (rode com --apagar para apagar).'); return; }
  for (const dono of donos) {
    const snap = await dono.collection('items').get();
    for (const d of snap.docs) await d.ref.delete();
  }
  console.log(`Apagadas ${total} automação(ões).`);
})().catch(err => { console.error(err); process.exit(1); });
