// =====================================================================
// 雾屿航线 · 数值配置
// 所有可调的数值都集中在这里。时间单位：游戏分钟（1 游戏小时 = 60）。
// =====================================================================

export const BALANCE = {
  // ---------------- 时间 ----------------
  time: {
    /** 1 游戏小时对应的现实秒数 */
    realSecondsPerGameHour: 37.5,
    /** 开局时刻：第 1 天 07:00 */
    startMinute: 7 * 60,
    dayStart: 6 * 60, // 06:00 白天开始
    duskStart: 19 * 60, // 19:00 黄昏
    nightStart: 22 * 60, // 22:00 夜晚
    /** 允许上床睡觉的时间（此后到早上 6 点之前） */
    sleepAllowedFrom: 18 * 60,
    /** 每走一格额外推进的游戏分钟 */
    moveMinutes: 7,
    /** 实时循环一次最多推进的现实毫秒（防止切回页面时一次跳太多） */
    maxRealStepMs: 1000,
  },

  // ---------------- 地图 ----------------
  map: {
    width: 60,
    height: 36,
    /** 开局主岛（自带一座小灯塔）照亮的半径 */
    homeLightRadius: 10,
    /** 灯塔照亮的半径，按岛等级 1/2/3；岛升级时灯塔照得更远 */
    lighthouseRadius: [11, 14, 17],
    /** 新的主线岛离灯塔所在岛的最小距离（最大为灯塔半径 - 1.5） */
    placeMinDistance: 6,
    /** 试飞后打开通往进出口局的航道半宽 */
    corridorHalfWidth: 1,
    /** 进出口局离主岛的距离范围，试飞后照亮的半径 */
    bureauMin: 14,
    bureauMax: 20,
    bureauLightRadius: 7,
    /** 玩家视野：走过的格子周围标记为已探索 */
    seenRadius: 2,
    /** 发现岛屿的距离 */
    discoverRadius: 3,
    /** 岛与岛之间至少相隔 */
    minSpacing: 7,
    /** 进出口局周围的浓雾半径（修好飞机前不可进入） */
    fogBankRadius: 3.5,
    zooms: [
      [15, 9],
      [25, 15],
      [35, 21],
    ] as [number, number][],
    defaultZoom: 1,
    /** 固定种子（null 表示每局随机） */
    fixedSeed: null as number | null,
  },

  // ---------------- 玩家生存 ----------------
  survival: {
    maxHp: 100,
    startHp: 100,
    startWater: 70,
    startFood: 60,
    maxWater: 100,
    maxFood: 100,
    waterPerHour: 3,
    foodPerHour: 2,
    sleepDrainFactor: 0.5,
    /** 水或食物见底时每小时掉血 */
    thirstHpPerHour: 4,
    hungerHpPerHour: 2,
    /** 夜晚在海上 / 在没床的岛上每小时掉血 */
    nightHpPerHourSea: 6,
    nightHpPerHourIsland: 3,
    /** 喝海水 */
    seaDrink: { water: 5, hp: -20, minutes: 5 },
    /** 跳海捕鱼 */
    seaFish: { minutes: 20, successChance: 0.65, jellyChance: 0.2, jellyHp: -8 },
    /** 死亡 */
    death: { holdLossRatio: 0.5, packLossRatio: 0.25, respawnHp: 50, minWater: 30, minFood: 30, minutes: 240 },
    /** 睡醒回满 */
    sleepHealTo: 100,
  },

  // ---------------- 主岛手动行动 ----------------
  home: {
    branch: { minutes: 20, wood: 1 },
    chop: { minutes: 30, wood: 3 }, // 伐木工获救后
    shoreFish: { minutes: 30, chance: 0.6 },
    herb: { minutes: 15 },
    farm: { plots: 3, plantMinutes: 15, growMinutes: 24 * 60, yield: 6 },
    /** 主岛仓库上限（每种物品） */
    stockCap: 99,
    /** 货舱加固：每次 +10，最多到 60 */
    holdUpgrade: { woodCosts: [20, 35, 50], step: 6 },
  },

  // ---------------- 2D：可刷新的采集点（只影响玩家手动采集，岛上的设施生产不受影响） ----------------
  forage: {
    /** 树：开局几棵、每天早上新长几棵、最多几棵；每棵能出几根木头（随机，含两端） */
    tree: { start: 10, perDay: 4, max: 14, yield: [3, 5] as [number, number], sprites: ['tree', 'tree2', 'stree'] },
    /** 草药丛：每丛能采几份 */
    herb: { start: 4, perDay: 2, max: 6, yield: [1, 2] as [number, number], sprites: ['herb'] },
    /** 采集点之间、离固定物体至少隔多远（像素） */
    spacing: { tree: 28, herb: 16 },
    /** 候选位置的网格间距（像素） */
    grid: 12,
    /** 离出生点、码头、小路至少多远（像素） */
    keepClear: { spawn: 28, path: 9 },
  },

  // ---------------- 背包与货舱 ----------------
  // 2D 版按格子算：每格放一种东西，按种类有堆叠上限。飞机零件不占格子。
  // 岛上仓库不按格子：每种物品各有上限（见 stockCap），满了生产会停。
  inventory: {
    /** 随身背包的格数 */
    packCap: 12,
    /** 木筏货舱的格数（加固后增加，见 home.holdUpgrade.step） */
    holdCap: 24,
    seats: 3,
    /** 每格的堆叠上限：能吃喝用的东西 / 其他原料 */
    stack: { consumable: 10, material: 20 },
  },

  // ---------------- 行动耗时 ----------------
  actions: {
    deliverMinutes: 10,
    trainMinutes: 60,
    learnMinutes: 120,
    wakeMinutes: 10,
    recruitMinutes: 20,
    flyMinutes: 60,
  },

  // ---------------- 建设 ----------------
  buildings: {
    /** 灯塔：第 n 座（不含主岛）用第 n 档成本，超出后用最后一档 */
    lighthouse: {
      costs: [{ wood: 8 }, { wood: 12 }, { wood: 16, fish: 4 }, { wood: 20, fish: 6 }, { wood: 25, fish: 6 }],
      minutes: 90,
    },
    bed: { cost: { wood: 15 }, minutes: 60 },
    depot: { cost: { wood: 10, cup: 4 }, minutes: 60, capBonus: 40 },
    helipad: { cost: { wood: 25, salt: 4 }, minutes: 120 },
  },

  // ---------------- 岛屿经济 ----------------
  economy: {
    /** 每名工人每小时的基础原料产量 */
    produceRate: { wood: 1.2, fish: 1.0, water: 1.5, wheat: 1.0, herb: 0.6 } as Record<string, number>,
    /** 加工建在绑定群系上的加成 */
    biomeBonus: 0.5,
    /** 岛等级：产能倍率、仓库上限、人数上限 */
    levels: [
      { mult: 1.0, cap: 40, people: 2 },
      { mult: 1.5, cap: 80, people: 3 },
      { mult: 2.0, cap: 120, people: 4 },
    ],
    /** 吃饭时刻（游戏分钟，一天内） */
    mealTimes: [6 * 60, 14 * 60, 22 * 60],
    /** 连续吃饱多少顿后可以升级（2D：在设施旁手动升级，见 upgradeCost） */
    mealsToUpgrade: 6,
    /** 岛升级的材料：第 i 项是从 i+1 级升到 i+2 级 */
    upgradeCost: [{ wood: 15, fish: 6 }, { wood: 30, bottledWater: 8 }] as Record<string, number>[],
    /** 升级花的时间（游戏分钟） */
    upgradeMinutes: 60,
    /** 三级岛每天早上生小孩的概率 */
    birthChance: 0.15,
    /** 出口前给居民留多少小时的口粮 */
    residentReserveHours: 24,
    /** 犯困：每座运转中的原住民岛每小时的基础概率；每级管理降低比例 */
    sleepyChancePerHour: 0.006,
    sleepyReducePerManageLevel: 0.12,
    /** 获救乘客岛的初始库存 */
    rescueStartStock: { water: 6, fish: 6 } as Record<string, number>,
    /** 培训、转岗消耗 */
    trainCost: {
      produce: { wood: 8, fish: 4 },
      process: { wood: 10, bottledWater: 4 },
      crew: { wood: 6, fish: 4, bottledWater: 4 },
    } as Record<'produce' | 'process' | 'crew', Record<string, number>>,
  },

  // ---------------- 经验与等级 ----------------
  progression: {
    /** 玩家：达到第 i+1 级所需的累计经验 */
    sail: [0, 40, 120, 250, 450, 700, 1000],
    attack: [0, 20, 60, 130, 250, 400, 600],
    manage: [0, 2, 5, 9, 14, 20, 28],
    /** 航行等级达到后一次走两格 */
    sailTwoStepLevel: 5,
    /** 生产型乘客：本工种全网累计产量 */
    passenger: [0, 50, 150, 350, 700, 1200, 2000],
    passengerBonusPerLevel: 0.15,
    /** 飞行员：运输总量 */
    pilot: [0, 40, 150, 400, 800, 1500, 2500],
    pilotSpeedPerLevel: 0.1,
    /** 运输设定的解锁等级 */
    unlockReserveLevel: 2,
    unlockTargetLevel: 3,
    unlockPriorityLevel: 4,
  },

  // ---------------- 海上事件与战斗 ----------------
  sea: {
    eventChancePerMove: 0.05,
    weights: { bees: 3, shark: 2, crate: 3, clue: 2 },
    sharkMinDistance: 8,
    bees: { strength: 4, drop: { honeycomb: [1, 2] } },
    shark: { baseStrength: 8, perDistance: 1 / 3, drop: { fish: [2, 4] } },
    combat: { baseForce: 5, forcePerLevel: 2, roll: 0.25, critFromLevel: 3, critBase: 0.05, critPerLevel: 0.05, lossBaseHp: 8 },
  },

  // ---------------- 运输 ----------------
  transport: {
    minutesPerTile: 30,
    dockMinutes: 30,
    capacity: 20,
    crewSupplyMax: 4,
    crewMealEveryMinutes: 8 * 60,
    noSupplySpeed: 0.4,
  },

  // ---------------- 飞机与终局 ----------------
  endgame: {
    repairCost: { wood: 30, medkit: 2 },
    orderEveryDays: 2,
    orderDurationDays: 3,
    orderRewardMultiplier: 2.5,
    upgrades: {
      speed: { name: '船速', per: 0.1, costs: [80, 160, 320, 640, 1280] },
      storage: { name: '仓库', per: 0.2, costs: [80, 160, 320, 640, 1280] },
      output: { name: '产能', per: 0.1, costs: [100, 200, 400, 800, 1600] },
    },
  },

  // ---------------- 存档 ----------------
  save: {
    key: 'foghaul2d.save.v1',
    autosaveSeconds: 10,
  },

  // ---------------- 2D：走路与互动 ----------------
  interact: {
    /** 人物脚下离物体互动范围多远以内可以互动（像素） */
    reach: 16,
    /** 规则层校验时多给的余量（画面层取前方最近一个，规则层只防作弊） */
    slack: 8,
    /** “走出 3 格”：引导第 1 步 */
    walkTilesForGoal: 3,
    /** 走路速度（像素/秒）。60 帧时每帧正好 1 像素，画面最顺 */
    walkSpeed: 60,
    /** 岛上按 Z 喝海水：离海多近（像素） */
    waterReach: 12,
    /** 初见介绍：离物体多近时出现（像素） */
    introRange: 40,
  },

  // ---------------- 2D：出海（自由航行） ----------------
  sail: {
    /** 海面一格的像素 */
    tile: 16,
    /** 木筏：加速度（像素/秒²）、最高速度（像素/秒）、航行每级 +5% */
    accel: 140,
    maxSpeed: 50,
    perSailLevel: 0.05,
    /** 松手后的阻力：速度每秒乘 e^-drag，约 1 秒停下 */
    drag: 3,
    /** 撞岸 / 撞雾反弹的比例 */
    bounce: 0.2,
    /** 每航行这么多像素推进一次时间（BALANCE.time.moveMinutes）并检定一次海上事件 */
    stepPixels: 16,
    /** 离岛中心几格以内可以靠岸 */
    dockTiles: 4,
    /** 离陆地多少像素以内显示“E 靠岸” */
    dockPixels: 18,
    /** 出海时木筏放在岛的南边，离岸多远（像素） */
    launchGap: 14,
    /** 漂流物：离木筏多近能捞（像素）、离多远就漂走了 */
    crateGrab: 20,
    crateRange: 80,
    /** 撞到浓雾后“雾太浓，过不去”显示多久（秒） */
    fogWarnSeconds: 1.6,
  },

  // ---------------- 2D：界面 ----------------
  ui: {
    /** 左下角最多显示几条日志 */
    hudLogLines: 3,
    /** 快捷栏格数（背包前几格） */
    hotbarSlots: 5,
    /** 初见介绍卡显示多久（毫秒） */
    introMs: 5000,
    /** 初见介绍卡放在物体上方时，物体顶部离画面上沿至少多少游戏像素（否则放旁边，免得挡住上面的 HUD） */
    introTopMin: 70,
    /** 海上战斗卡片显示多久（毫秒） */
    fightCardMs: 4500,
  },
};

export type Balance = typeof BALANCE;
