import { describe, expect, it } from 'vitest';
import { STEPS } from '../src/sim/bot';
import { createGame } from '../src/sim/create';
import { objectives } from '../src/sim/objectives';
import { setLang, tm } from '../src/i18n';

describe('full playthrough via real commands', () => {
  for (const seed of [1, 42, 2026, 99991]) {
    it(`reaches the bureau (seed ${seed})`, async () => {
      const s = createGame(seed);
      for (const step of STEPS) {
        step.run(s);
        const o = objectives(s).find((x) => x.id === step.id);
        if (o) expect(o.done, `objective ${step.id}`).toBe(true);
      }
      expect(s.flags.planeRepaired).toBe(true);
      expect(s.flags.flightDone).toBe(true);
      expect(s.flags.reported).toBe(true);
      expect(s.player.at).toBe('bureau');
      // 所有引导功能都应该在通关途中出现过
      const { FEATURES } = await import('../src/sim/tutorial');
      for (const f of FEATURES) expect(s.unlocks, `feature ${f.id}`).toContain(f.id);
      // 所有日志在两种语言下都能完整渲染
      for (const lang of ['zh', 'en'] as const) {
        setLang(lang);
        for (const l of s.log) {
          const txt = tm(l.m);
          expect(txt, JSON.stringify(l.m)).not.toMatch(/\{\w+\}/);
          expect(txt, JSON.stringify(l.m)).not.toMatch(/^[a-z]+\.[A-Za-z0-9.]+$/);
        }
      }
      setLang('zh');
    });
  }
});
