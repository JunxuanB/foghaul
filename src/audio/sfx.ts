// 音效播放：Web Audio 合成（config/audio.ts 的 SOUNDS）。第一次按键 / 点击之后才能出声（浏览器的规定）。
// 音量是每个玩家自己的偏好，存在 localStorage（读写失败就用默认值）。
import { AUDIO, CMD_SOUND, SOUNDS, type Note } from '../config/audio';
import type { Command } from '../sim/types';

const KEY = 'foghaul2d.volume';
let ctx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let volume = AUDIO.volume;
const last: Record<string, number> = {};

try {
  const v = localStorage.getItem(KEY);
  if (v !== null && !Number.isNaN(+v)) volume = Math.max(0, Math.min(1, +v));
} catch {
  /* 隐私模式之类：用默认音量 */
}

export function getVolume(): number {
  return volume;
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  try {
    localStorage.setItem(KEY, String(volume));
  } catch {
    /* 存不了就算了 */
  }
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  // 固定的伪随机噪声（不用 Math.random，结果每次一样）
  let x = 12345;
  for (let i = 0; i < d.length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (x / 0x7fffffff) * 2 - 1;
  }
  return ctx;
}

/** 第一次有用户操作时调用，解开浏览器的自动播放限制 */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

function note(c: AudioContext, n: Note, t0: number): void {
  const g = c.createGain();
  const v = n.vol * volume;
  const t = t0 + (n.at ?? 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
  g.connect(c.destination);
  if (n.noise && noiseBuf) {
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(n.f, t);
    if (n.f2) f.frequency.exponentialRampToValueAtTime(n.f2, t + n.dur);
    src.connect(f).connect(g);
    src.start(t);
    src.stop(t + n.dur + 0.02);
    return;
  }
  const o = c.createOscillator();
  o.type = n.wave ?? 'square';
  o.frequency.setValueAtTime(n.f, t);
  if (n.f2) o.frequency.exponentialRampToValueAtTime(n.f2, t + n.dur);
  o.connect(g);
  o.start(t);
  o.stop(t + n.dur + 0.02);
}

export function play(id: string): void {
  if (volume <= 0) return;
  const notes = SOUNDS[id];
  const c = ctx;
  if (!notes || !c || c.state !== 'running') return;
  const now = c.currentTime;
  if (now - (last[id] ?? -1) < AUDIO.minGap) return;
  last[id] = now;
  for (const n of notes) note(c, n, now);
}

/** 一条命令成功以后放什么音效 */
export function soundFor(cmd: Command): string | null {
  if (cmd.t === 'gather') return cmd.what === 'shoreFish' ? 'splash' : cmd.what === 'herb' ? 'rustle' : 'chop';
  if (cmd.t === 'consume') return cmd.item === 'water' || cmd.item === 'bottledWater' ? 'drink' : 'eat';
  return CMD_SOUND[cmd.t] ?? null;
}
