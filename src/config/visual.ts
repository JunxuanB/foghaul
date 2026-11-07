// =====================================================================
// 画面配置：调色板、昼夜换色表、灯光、雾、动画节奏。只影响画面，不影响规则。
// 详见 docs/2d-design.md 第 10 节、design/2d-美术设计稿-B.html。
// =====================================================================

/** 原生分辨率 */
export const VIEW = { w: 480, h: 270 } as const;

/** B 方案 12 色：0–7 冷色画世界，8–11 暖色只给人造的东西和火光 */
export const PALETTE = [
  '#0d151e', // 0 深渊
  '#18283a', // 1 夜海
  '#24394a', // 2 深水
  '#34525f', // 3 礁影
  '#4f7676', // 4 浅湾
  '#7d9e8f', // 5 苔雾
  '#b4c5ac', // 6 海雾
  '#e3dfc8', // 7 月白
  '#56302a', // 8 锈木
  '#9a5538', // 9 赭土
  '#d6914f', // 10 灯火
  '#f4d08a', // 11 灯芯
] as const;

export type PhaseId = 'dawn' | 'day' | 'gold' | 'dusk' | 'night';

/** 每个视觉时段：第 i 号色显示成 t[i] 号色；s 为灯光强度 */
export const PHASES: Record<PhaseId, { t: number[]; s: number }> = {
  dawn: { t: [0, 0, 1, 2, 3, 3, 4, 5, 1, 8, 9, 10], s: 0.45 },
  day: { t: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], s: 0 },
  gold: { t: [0, 1, 2, 3, 4, 5, 6, 11, 8, 9, 10, 11], s: 0.35 },
  dusk: { t: [0, 1, 1, 2, 3, 4, 5, 10, 8, 8, 9, 11], s: 0.7 },
  night: { t: [0, 0, 0, 1, 2, 2, 3, 4, 0, 8, 9, 11], s: 1 },
};

/** 时段的到达时刻（当天分钟）；到达前 transitionMinutes 分钟开始点阵过渡 */
export const PHASE_KEYS: [number, PhaseId][] = [
  [270, 'dawn'],
  [360, 'day'],
  [1050, 'gold'],
  [1170, 'dusk'],
  [1320, 'night'],
];
export const PHASE_TRANSITION_MINUTES = 60;

/** 灯光半径（像素，乘灯光强度）；圆外再有一圈 edge 像素的棋盘格 */
export const LIGHTS = {
  lighthouse: 13,
  window: 12,
  doorLamp: 10,
  fire: 26,
  fireFlicker: 1.4,
  lantern: 7,
  edge: 4,
  beam: { length: 320, halfAngle: 0.1, secondsPerTurn: 9, minStrength: 0.3 },
  /** 灯光强度高于此值时画亮着的窗 */
  windowGlowFrom: 0.2,
  /** 灯光强度低于此值时不画遮罩 */
  maskFrom: 0.05,
};

/** 雾：飘动速度（像素/秒）与阈值。飘得慢、两层同向（layer2 为第二层的相对速度），走动时不晕 */
export const FOG = { driftX: 2, driftY: 0.6, layer2: 0.6, gain: 1.35, noise: 0.85, bias: -0.18, on: 0.22, onBayer: 0.5, dense: 0.3, denseBayer: 0.3 };

/** 海上：岛在海图比例下的大小（像素）和浅水宽度；雾从浓到能进的过渡宽度（格） */
export const SEA_ART = {
  island: {
    home: { rx: 44, ry: 30 },
    bureau: { rx: 30, ry: 22 },
    recipeVillage: { rx: 26, ry: 18 },
    laborVillage: { rx: 26, ry: 18 },
    passenger: { rx: 22, ry: 15 },
    native: { rx: 20, ry: 14 },
    islet: { rx: 12, ry: 8 },
  } as Record<string, { rx: number; ry: number }>,
  /** 高度系数：越大海岸越陡、浅水越窄 */
  k: 26,
  noise: 7,
  /** 雾的过渡要多久（秒）：修好灯塔时雾当场退开 */
  fogRecede: 1.6,
  /** 木筏尾迹点数和消失时间（秒） */
  wakePoints: 16,
  wakeSeconds: 1.2,
};

/** 动画节奏 */
export const ANIM = {
  /** 行走动画：每走多少像素换一帧（60 像素/秒时约 7.5 帧/秒） */
  walkStride: 8,
  /** 浪花往岸上推的速度（弧度/秒）；sparkle 为浪尖闪烁的速度 */
  surfPhase: 1.6,
  surfSparkle: 0.8,
  glintPeriod: 1.8,
  fireFps: 10,
  gullFps: 4,
  /** 采集类动作的现实时长（秒） */
  actionSeconds: { branch: 1.0, chop: 1.2, shoreFish: 1.2, herb: 0.8, craft: 0.9 } as Record<string, number>,
  /** 采集动作的节奏：每隔多久摇一下、掉一把叶子 / 浮漂沉一下（秒） */
  gatherBeat: 0.35,
  /** 浅滩钓点水纹一圈的时长（秒） */
  rippleSeconds: 2.4,
  /** 头顶“+1”飘起的时长（秒） */
  popSeconds: 1.1,
  /** 点阵过渡的时长（秒）：睡觉、复活 */
  fadeSeconds: 0.4,
  /** 世界和画面的重画间隔（秒）：浪花、雾、灯光遮罩 */
  fxInterval: 1 / 30,
};
