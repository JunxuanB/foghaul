// 音效：全部用 Web Audio 现场合成（没有音频文件），一个音效 = 几个音。数值都在这里，MOD 可以加新的。
// 每个音：波形、起始频率（Hz）、结束频率（滑音，可省略）、时长（秒）、音量（0–1）、延迟（秒）；noise 为白噪声（砍、溅水、沙沙声）。

export interface Note {
  wave?: OscillatorType;
  noise?: boolean;
  f: number;
  f2?: number;
  dur: number;
  vol: number;
  at?: number;
}

export const SOUNDS: Record<string, Note[]> = {
  // 采集
  chop: [{ noise: true, f: 900, dur: 0.07, vol: 0.5 }, { wave: 'square', f: 140, f2: 90, dur: 0.08, vol: 0.18 }],
  rustle: [{ noise: true, f: 2400, dur: 0.12, vol: 0.25 }],
  splash: [{ noise: true, f: 1400, f2: 500, dur: 0.25, vol: 0.35 }, { wave: 'sine', f: 600, f2: 300, dur: 0.12, vol: 0.12 }],
  // 收获：“+1”时一声轻响
  pickup: [{ wave: 'square', f: 660, dur: 0.05, vol: 0.12 }, { wave: 'square', f: 990, dur: 0.07, vol: 0.12, at: 0.05 }],
  // 制作、建造
  craft: [{ noise: true, f: 1200, dur: 0.05, vol: 0.35 }, { noise: true, f: 1200, dur: 0.05, vol: 0.35, at: 0.12 }, { wave: 'triangle', f: 523, dur: 0.12, vol: 0.18, at: 0.24 }],
  build: [{ noise: true, f: 700, dur: 0.06, vol: 0.4 }, { noise: true, f: 700, dur: 0.06, vol: 0.4, at: 0.14 }, { noise: true, f: 700, dur: 0.06, vol: 0.4, at: 0.28 }, { wave: 'triangle', f: 392, dur: 0.1, vol: 0.18, at: 0.4 }, { wave: 'triangle', f: 523, dur: 0.18, vol: 0.18, at: 0.5 }],
  // 吃、喝
  eat: [{ noise: true, f: 500, dur: 0.06, vol: 0.25 }, { noise: true, f: 450, dur: 0.06, vol: 0.25, at: 0.1 }],
  drink: [{ wave: 'sine', f: 300, f2: 520, dur: 0.12, vol: 0.18 }, { wave: 'sine', f: 320, f2: 560, dur: 0.12, vol: 0.15, at: 0.14 }],
  // 交付、出口
  give: [{ wave: 'triangle', f: 523, dur: 0.08, vol: 0.18 }, { wave: 'triangle', f: 659, dur: 0.08, vol: 0.18, at: 0.08 }, { wave: 'triangle', f: 784, dur: 0.14, vol: 0.18, at: 0.16 }],
  coin: [{ wave: 'square', f: 988, dur: 0.06, vol: 0.12 }, { wave: 'square', f: 1319, dur: 0.16, vol: 0.12, at: 0.06 }],
  // 大事：救人、升级、修好飞机
  fanfare: [
    { wave: 'triangle', f: 523, dur: 0.12, vol: 0.2 },
    { wave: 'triangle', f: 659, dur: 0.12, vol: 0.2, at: 0.12 },
    { wave: 'triangle', f: 784, dur: 0.12, vol: 0.2, at: 0.24 },
    { wave: 'triangle', f: 1047, dur: 0.35, vol: 0.22, at: 0.36 },
    { wave: 'square', f: 523, dur: 0.35, vol: 0.06, at: 0.36 },
  ],
  // 出海、靠岸、飞
  whoosh: [{ noise: true, f: 800, f2: 300, dur: 0.35, vol: 0.25 }],
  // 睡觉、新的一天
  sleep: [{ wave: 'sine', f: 392, dur: 0.3, vol: 0.15 }, { wave: 'sine', f: 330, dur: 0.3, vol: 0.15, at: 0.3 }, { wave: 'sine', f: 262, dur: 0.5, vol: 0.15, at: 0.6 }],
  morning: [{ wave: 'triangle', f: 659, dur: 0.12, vol: 0.14 }, { wave: 'triangle', f: 784, dur: 0.12, vol: 0.14, at: 0.12 }, { wave: 'triangle', f: 988, dur: 0.25, vol: 0.14, at: 0.24 }],
  // 界面
  open: [{ wave: 'square', f: 440, f2: 660, dur: 0.05, vol: 0.06 }],
  close: [{ wave: 'square', f: 660, f2: 440, dur: 0.05, vol: 0.06 }],
  err: [{ wave: 'square', f: 180, dur: 0.1, vol: 0.1 }, { wave: 'square', f: 140, dur: 0.12, vol: 0.1, at: 0.1 }],
  hurt: [{ wave: 'sawtooth', f: 220, f2: 80, dur: 0.5, vol: 0.15 }],
};

/** 命令成功时放哪个音效（gather 按采什么另算，见 audio/sfx.ts 的 soundFor） */
export const CMD_SOUND: Record<string, string> = {
  craft: 'craft',
  build: 'build',
  buildTransportRaft: 'build',
  repairPlane: 'fanfare',
  installPart: 'build',
  upgradeIsland: 'fanfare',
  train: 'give',
  learn: 'give',
  deliver: 'give',
  choose: 'give',
  transfer: 'pickup',
  collect: 'pickup',
  fillCup: 'drink',
  plant: 'rustle',
  harvest: 'pickup',
  export: 'coin',
  buyUpgrade: 'fanfare',
  sleep: 'sleep',
  dock: 'whoosh',
  leave: 'whoosh',
  fly: 'whoosh',
  fishSea: 'splash',
  drinkSea: 'drink',
  takeCrate: 'pickup',
  wake: 'give',
  pickUp: 'open',
  dropOff: 'close',
  createRoute: 'give',
  report: 'fanfare',
};

export const AUDIO = {
  /** 默认音量（0–1），玩家在菜单里调 */
  volume: 0.6,
  /** 同一个音效最短间隔（秒），免得连按时叠成一片 */
  minGap: 0.04,
};
