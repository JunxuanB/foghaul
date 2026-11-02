import { BALANCE } from '../config/balance';

const T = BALANCE.time;

export function dayOf(time: number): number {
  return Math.floor(time / 1440) + 1;
}

export function minuteOfDay(time: number): number {
  return ((Math.floor(time) % 1440) + 1440) % 1440;
}

export type Phase = 'day' | 'dusk' | 'night';

export function phaseOf(time: number): Phase {
  const m = minuteOfDay(time);
  if (m >= T.dayStart && m < T.duskStart) return 'day';
  if (m >= T.duskStart && m < T.nightStart) return 'dusk';
  return 'night';
}

export function isNight(time: number): boolean {
  return phaseOf(time) === 'night';
}

function pad(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

export function clockParts(time: number): { day: number; hh: string; mm: string } {
  const m = minuteOfDay(time);
  return { day: dayOf(time), hh: pad(Math.floor(m / 60)), mm: pad(m % 60) };
}

/** 时长：交给词典 ui.hm 渲染 */
export function hmParts(minutes: number): { h: number; m: number } {
  const v = Math.max(0, Math.round(minutes));
  return { h: Math.floor(v / 60), m: v % 60 };
}

/** 距离入夜的分钟数（已入夜返回 0） */
export function untilNight(time: number): number {
  const m = minuteOfDay(time);
  if (isNight(time)) return 0;
  return T.nightStart - m;
}

/** 到下一个 06:00 的分钟数 */
export function untilMorning(time: number): number {
  const m = minuteOfDay(time);
  const d = T.dayStart - m;
  return d > 0 ? d : d + 1440;
}

/** 昼夜条上的位置（从 06:00 开始的比例） */
export function dayBarPos(time: number): number {
  const m = minuteOfDay(time);
  return (((m - T.dayStart + 1440) % 1440) / 1440) * 100;
}

export function canSleepNow(time: number): boolean {
  const m = minuteOfDay(time);
  return m >= T.sleepAllowedFrom || m < T.dayStart;
}
