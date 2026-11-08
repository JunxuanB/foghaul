import { BALANCE } from '../config/balance';
import { dispatch } from '../sim/actions';
import { play, soundFor } from '../audio/sfx';

/** 成功以后在人物身边放一把亮片的命令（大事） */
const CELEBRATE = ['upgradeIsland', 'repairPlane', 'buyUpgrade', 'report'];
/** 失败也不出声的命令（画面层每帧发的、自动的） */
const SILENT = ['sail', 'move', 'seeIntro', 'ackGuide', 'dismissTip', 'seenRecipes'];
import { advance } from '../sim/advance';
import { createGame } from '../sim/create';
import { updateUnlocks } from '../sim/tutorial';
import { clearStorage, loadFromStorage, saveToStorage } from '../sim/save';
import type { Command, GameState, Result } from '../sim/types';

type Listener = () => void;

/** 时间推进、自动存档、订阅。模拟逻辑都在 sim/ 里，这里只负责驱动。2D 版由画面层每帧调用 frame()。 */
export class GameStore {
  state: GameState;
  version = 0;
  paused = false;
  /** 调试用时间倍率 */
  speed = 1;
  /** 暂停时间的理由（欢迎页、聚焦引导、新配方弹窗……），任何一个存在时间就停 */
  private holds = new Set<string>();
  /** 启动时本地是否已有存档 */
  readonly hadSave: boolean;
  private listeners = new Set<Listener>();
  private started = false;
  private lastSave = 0;
  /** 累计的游戏分钟，满 1 分钟才交给 sim 推进 */
  private pending = 0;

  constructor(state?: GameState) {
    const saved = state ?? loadFromStorage();
    this.hadSave = !!saved;
    this.state = saved ?? createGame();
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = () => this.version;

  bump() {
    this.version++;
    for (const l of this.listeners) l();
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastSave = performance.now();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.save);
  }

  stop() {
    this.started = false;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.save);
  }

  private onVisibility = () => {
    if (document.hidden) this.save();
  };

  /** 是否在跑时间：页面可见、未暂停、没有过场 */
  get running(): boolean {
    return !this.paused && this.holds.size === 0 && !document.hidden && !this.state.cutscene;
  }

  /** 画面层每帧调用：dtMs 为现实毫秒。返回这一帧有没有推进时间 */
  frame(dtMs: number): boolean {
    if (!this.running) return false;
    const dt = Math.min(dtMs, BALANCE.time.maxRealStepMs);
    this.pending += ((dt / 1000) / BALANCE.time.realSecondsPerGameHour) * 60 * this.speed;
    const now = performance.now();
    if (now - this.lastSave > BALANCE.save.autosaveSeconds * 1000) {
      this.save();
      this.lastSave = now;
    }
    if (this.pending < 1) return false;
    const whole = Math.floor(this.pending);
    this.pending -= whole;
    const day = this.state.report?.day;
    const died = this.state.lastDeath;
    advance(this.state, whole);
    if (this.state.report && this.state.report.day !== day) play('morning');
    if (this.state.lastDeath && this.state.lastDeath !== died) play('hurt');
    updateUnlocks(this.state);
    this.bump();
    return true;
  }

  dispatch = (cmd: Command): Result => {
    const before = this.state.joined.length;
    const r = dispatch(this.state, cmd);
    // 音效：成功按命令放；有人加入是大事；失败（按钮之外的操作，比如按 E 时条件不够）一声低音
    if (r.ok) {
      const snd = this.state.joined.length > before ? 'fanfare' : soundFor(cmd);
      if (snd) play(snd);
      if (this.state.joined.length > before || CELEBRATE.includes(cmd.t)) this.emit('celebrate');
    } else if (!SILENT.includes(cmd.t)) play('err');
    this.bump();
    return r;
  };

  /** 画面层订阅的一次性事件（庆祝的粒子） */
  private fx = new Set<(e: string) => void>();
  onFx(fn: (e: string) => void): () => void {
    this.fx.add(fn);
    return () => this.fx.delete(fn);
  }
  private emit(e: string): void {
    for (const f of this.fx) f(e);
  }

  save = () => {
    saveToStorage(this.state);
  };

  /** 按理由暂停/恢复时间 */
  hold(reason: string, on: boolean) {
    const had = this.holds.has(reason);
    if (on === had) return;
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    this.bump();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.bump();
  }

  replace(state: GameState) {
    this.state = state;
    this.save();
    this.bump();
  }

  newGame(seed?: number) {
    clearStorage();
    this.replace(createGame(seed));
  }
}
