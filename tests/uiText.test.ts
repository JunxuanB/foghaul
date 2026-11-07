// 界面文字不能带标记（AGENTS.md “界面”规范）：<g>…</g> 只给剧情、日志、对白用（<Rich> 渲染）。
// 面板、按键提示、物品名、介绍卡用的键一律是纯文字；规则层的原因在界面上用 reasonText() 转成短的纯文字。
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import zh from '../src/i18n/zh';
import { setLang } from '../src/i18n';
import { reasonText } from '../src/ui/components/Kit';
import { m, stockP } from '../src/sim/msg';

const UI_KEY = /^(ui|act|reason|thing|work|item|itemdesc|recipe|role|fac)\.|^intro2d\.(?!quick)/;
const MARK = /<\/?[gbhw]>/;

describe('interface text', () => {
  for (const [lang, d] of [['zh', zh], ['en', en]] as const)
    it(`has no markup in interface keys (${lang})`, () => {
      const bad = Object.entries(d as Record<string, string>).filter(([k, v]) => UI_KEY.test(k) && MARK.test(v));
      expect(bad).toEqual([]);
    });

  it('turns rule messages into short plain text', () => {
    setLang('zh', false);
    expect(reasonText(m('err.missing', { list: stockP({ cup: 1 }) }))).toBe('材料不足');
    expect(reasonText(m('err.stockFull'))).not.toMatch(MARK);
    expect(reasonText(m('err.stockFull'))).not.toMatch(/。$/);
  });
});

describe('interface source', () => {
  it('never renders a rule message as raw text (use <Rich>, reasonText() or label())', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith('.tsx') ? [join(d, f)] : []));
    const bad: string[] = [];
    for (const f of walk('src/ui')) {
      if (f.endsWith('Kit.tsx') || f.endsWith('Text.tsx')) continue;
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\btm\(/.test(line) && !/<Rich s=\{tm\(/.test(line) && !/=\s*tm\(/.test(line)) bad.push(`${f}:${i + 1}`);
        });
    }
    expect(bad).toEqual([]);
  });
});
