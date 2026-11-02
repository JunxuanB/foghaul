import type { GameState, LogTone } from './types';
import { m, type Msg, type Param } from './msg';

const MAX_LOG = 300;

/** 写一条日志。文字模板里可以用 <g>…</g>（获得）、<b>…</b>（损失）、<h>…</h>（线索）、<w>…</w>（警告）高亮。 */
export function say(state: GameState, msg: Msg | string, p?: Record<string, Param> | LogTone, c?: LogTone): void {
  let mm: Msg;
  let tone: LogTone | undefined;
  if (typeof msg === 'string') {
    if (typeof p === 'string') {
      mm = m(msg);
      tone = p;
    } else {
      mm = m(msg, p);
      tone = c;
    }
  } else {
    mm = msg;
    tone = typeof p === 'string' ? p : c;
  }
  state.log.push(tone ? { at: state.time, m: mm, c: tone } : { at: state.time, m: mm });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function fail(k: string, p?: Record<string, Param>): { ok: false; msg: Msg } {
  return { ok: false, msg: m(k, p) };
}

export const OK = { ok: true } as const;
