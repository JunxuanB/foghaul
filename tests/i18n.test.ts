import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import zh from '../src/i18n/zh';
import en from '../src/i18n/en';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}

describe('i18n', () => {
  it('zh and en have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  });
  it('every literal key used in source exists', () => {
    const missing: string[] = [];
    const re = /(?:\bt\(|\bm\(|\bsay\(\w+, |\bfail\(|k=|k: |title: m\()'([a-z]+\.[A-Za-z0-9_.]+[A-Za-z0-9_])'/g;
    const re2 = /k="([a-z]+\.[A-Za-z0-9_.]+)"/g;
    for (const f of files('src')) {
      if (f.includes('i18n')) continue;
      const src = readFileSync(f, 'utf8');
      for (const r of [re, re2]) {
        let mt: RegExpExecArray | null;
        while ((mt = r.exec(src))) if (!(mt[1] in zh)) missing.push(`${f}: ${mt[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
  it('templates use the same placeholders in both languages', () => {
    const bad: string[] = [];
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().filter((v, i, a) => a.indexOf(v) === i).join(',');
    for (const k of Object.keys(zh) as (keyof typeof zh)[]) if (ph(zh[k]) !== ph(en[k])) bad.push(k);
    expect(bad).toEqual([]);
  });
});
