import { runUntil } from './bot';
import type { GameState } from './types';

/** 调试面板的里程碑预设：用脚本玩家从新游戏跑到对应进度 */
export const PRESETS: { id: string; step: string | null }[] = [
  { id: 'start', step: null },
  { id: 'M1 engineer', step: 'engineer' },
  { id: 'M1 lumberjack', step: 'lumberjack' },
  { id: 'M2 lighthouse', step: 'lighthouse1' },
  { id: 'M2 bread', step: 'bread' },
  { id: 'M3 pilot home', step: 'pilot' },
  { id: 'M3 first route', step: 'route' },
  { id: 'M4 all parts', step: 'parts' },
  { id: 'M4 bureau', step: 'report' },
];

export function applyPreset(id: string, seed: number): GameState {
  const p = PRESETS.find((x) => x.id === id)!;
  return runUntil(seed, p.step);
}
