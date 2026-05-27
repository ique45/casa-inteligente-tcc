// Carrega .env antes de importar firebase.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

test('firebase exporta db e rtdb com métodos corretos', () => {
  jest.resetModules();
  const { db, rtdb } = require('../firebase');
  expect(db).toBeDefined();
  expect(rtdb).toBeDefined();
  expect(typeof db.collection).toBe('function');
  expect(typeof rtdb.ref).toBe('function');
});
