import { ITEM_ORDER, type ItemId } from '../config/items';
import type { Msg, Param } from '../sim/msg';
import en from './en';
import zh from './zh';
import { MOD_STRINGS } from '../mod/registry';

export type Lang = 'zh' | 'en';
export const LANGS: Lang[] = ['zh', 'en'];
const DICTS: Record<Lang, Record<string, string>> = { zh, en };
const LANG_KEY = 'foghaul.lang';

function detect(): Lang {
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    /* ignore */
  }
  const nav = (globalThis.navigator?.language ?? 'zh').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

let current: Lang = detect();

export function getLang(): Lang {
  return current;
}

/** 切换语言；persist 为 true 时记住玩家的选择 */
export function setLang(l: Lang, persist = true): void {
  current = l;
  if (persist) {
    try {
      globalThis.localStorage?.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }
  if (globalThis.document) document.documentElement.lang = l === 'zh' ? 'zh-Hans' : 'en';
}

export function hasKey(k: string): boolean {
  return k in DICTS[current] || k in zh || k in MOD_STRINGS[current];
}

function sep(): string {
  return current === 'zh' ? '、' : ', ';
}

function renderParam(p: Param): string {
  if (typeof p === 'number') return String(Math.round(p * 100) / 100);
  if (typeof p === 'string') return p;
  if ('stock' in p) {
    const entries = ITEM_ORDER.filter((id) => (p.stock[id as ItemId] ?? 0) > 0).map((id) =>
      t('qty', { item: { k: 'item.' + id }, n: p.stock[id as ItemId] ?? 0 }),
    );
    return entries.length ? entries.join(sep()) : t('none');
  }
  if ('list' in p) return p.list.map(tm).join(sep());
  return tm(p);
}

/** 按当前语言渲染一个键 */
export function t(k: string, params?: Record<string, Param>): string {
  if (!k) return '';
  const tpl = DICTS[current][k] ?? MOD_STRINGS[current][k] ?? zh[k as keyof typeof zh] ?? k;
  if (!params) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? renderParam(params[name]) : `{${name}}`));
}

export function tm(msg: Msg | null | undefined): string {
  if (!msg) return '';
  return t(msg.k, msg.p);
}

/** 带高亮标记的文字拆成片段：<g>获得</g> <b>损失</b> <h>线索</h> <w>警告</w> */
export interface Seg {
  text: string;
  tone?: 'g' | 'b' | 'h' | 'w';
}

export function segments(s: string): Seg[] {
  const out: Seg[] = [];
  const re = /<(g|b|h|w)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(s))) {
    if (mt.index > last) out.push({ text: s.slice(last, mt.index) });
    out.push({ text: mt[2], tone: mt[1] as Seg['tone'] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** 去掉高亮标记的纯文字 */
export function plain(s: string): string {
  return s.replace(/<\/?[gbhw]>/g, '');
}
