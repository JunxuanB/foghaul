// 剧情文字都在 src/i18n 的词典里；这里只记录条数与提示目标。
import type { Role } from './recipes';

export const OPENING_LINES = 4;
export const CLUE_COUNT = 10;
export const LATE_CRATE_COUNT = 2;
export const WHISPER_COUNT = 3;
export const FLIGHT_LINES = 5;
export const ENDING_LINES = 3;
export const NATIVE_NAME_COUNT = 16;

/** 救出乘客后，对白会提示下一个目标的方向 */
export const RESCUE_HINT_TARGET: Partial<Record<Role, string>> = {
  engineer: 'forestIsle',
  lumberjack: 'nativeA',
  fisher: 'village1',
  farmer: 'village2',
  doctor: 'pilotIsle',
};
