const { resolveAction } = require('../services/automation');

describe('resolveAction', () => {
  test('toggle: estado false → retorna true', () => {
    expect(resolveAction('toggle', false)).toBe(true);
  });

  test('toggle: estado true → retorna false', () => {
    expect(resolveAction('toggle', true)).toBe(false);
  });

  test('on: sempre retorna true', () => {
    expect(resolveAction('on', false)).toBe(true);
    expect(resolveAction('on', true)).toBe(true);
  });

  test('off: sempre retorna false', () => {
    expect(resolveAction('off', true)).toBe(false);
    expect(resolveAction('off', false)).toBe(false);
  });

  test('ação desconhecida: retorna null', () => {
    expect(resolveAction('invalido', false)).toBeNull();
  });
});
