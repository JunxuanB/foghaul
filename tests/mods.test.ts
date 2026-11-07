import { describe, expect, it } from 'vitest';
import { G } from '../src/art/grid';
import { OBJ_DEFS } from '../src/config/buildings';
import { setLang, t } from '../src/i18n';
import { createGame } from '../src/sim/create';
import { LOADED_MODS, ModError, registerMod } from '../src/mod/registry';

describe('mod registry (reserved for plugins)', () => {
  it('adds namespaced sprites, objects and strings, and records the mod in new saves', () => {
    registerMod({
      id: 'test-mod',
      name: 'Test',
      version: '1.0.0',
      content: {
        sprites: { 'test-mod:rock': () => new G(4, 4).rect(0, 0, 4, 4, 's2').outline() },
        objects: { 'test-mod:rock': { kind: 'decor', foot: { x: -2, y: -2, w: 4, h: 2 } } },
        strings: { zh: { 'test-mod:hello': '你好' }, en: { 'test-mod:hello': 'Hello' } },
      },
    });
    expect(OBJ_DEFS['test-mod:rock'].kind).toBe('decor');
    setLang('en', false);
    expect(t('test-mod:hello')).toBe('Hello');
    setLang('zh', false);
    expect(t('test-mod:hello')).toBe('你好');
    expect(createGame(1).mods).toEqual(['test-mod@1.0.0']);
  });

  it('refuses ids without the mod prefix, duplicates and mismatched strings, and adds nothing then', () => {
    const before = LOADED_MODS.length;
    expect(() => registerMod({ id: 'bad', name: '', version: '1', content: { objects: { tree: { kind: 'decor' } } } })).toThrow(ModError);
    expect(() => registerMod({ id: 'Bad Id', name: '', version: '1' })).toThrow(ModError);
    expect(() => registerMod({ id: 'test-mod', name: '', version: '2' })).toThrow(ModError);
    expect(() =>
      registerMod({ id: 'half', name: '', version: '1', content: { strings: { zh: { 'half:a': '甲' }, en: {} } } }),
    ).toThrow(ModError);
    expect(LOADED_MODS.length).toBe(before);
    expect(OBJ_DEFS.tree.kind).toBe('tree');
  });
});
