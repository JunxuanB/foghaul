import { BALANCE } from '../config/balance';
import { dispatch } from '../sim/actions';
import { advance } from '../sim/advance';
import { createGame } from '../sim/create';
import { clearStorage, loadFromStorage, saveToStorage } from '../sim/save';
import type { Command, GameState, Result } from '../sim/types';

type Listener = () => void;

/** 实时循环、自动存档、订阅。模拟逻辑都在 sim/ 里，这里只负责驱动。 */
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
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private lastSave = 0;

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
    if (this.timer) return;
    this.last = performance.now();
    this.lastSave = this.last;
    this.timer = setInterval(() => this.tick(), 200);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.save);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.save);
  }

  private onVisibility = () => {
    if (document.hidden) this.save();
    this.last = performance.now();
  };

  /** 是否在跑时间：页面可见、未暂停、没有过场 */
  get running(): boolean {
    return !this.paused && this.holds.size === 0 && !document.hidden && !this.state.cutscene;
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(now - this.last, BALANCE.time.maxRealStepMs);
    this.last = now;
    if (!this.running) return;
    const minutes = ((dt / 1000) / BALANCE.time.realSecondsPerGameHour) * 60 * this.speed;
    advance(this.state, minutes);
    if (now - this.lastSave > BALANCE.save.autosaveSeconds * 1000) {
      this.save();
      this.lastSave = now;
    }
    this.bump();
  }

  dispatch = (cmd: Command): Result => {
    const r = dispatch(this.state, cmd);
    this.bump();
    return r;
  };

  save = () => {
    saveToStorage(this.state);
  };

  /** 按理由暂停/恢复时间 */
  hold(reason: string, on: boolean) {
    const had = this.holds.has(reason);
    if (on === had) return;
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    this.last = performance.now();
    this.bump();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
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
