// 画面和界面之间的临时状态（不存档）：开着哪个面板、人物面前选中了什么、头顶提示、初见介绍卡、
// 正在做的动作、快捷栏选中格。每帧都会变的位置（人物在屏幕上的坐标）放在 anchors 里，不触发重绘。
import type { ObjKind } from '../config/buildings';
import type { ItemId } from '../config/items';
import type { Msg } from '../sim/msg';

export type PanelId = 'inventory' | 'craft' | 'chest' | 'lighthouse' | 'wreck' | 'journal' | 'help' | 'menu';

/** 打开时暂停时间的面板（菜单、帮助） */
export const PAUSING_PANELS: PanelId[] = ['menu', 'help'];

export interface Prompt {
  key: string;
  label: Msg;
  ok: boolean;
  reason?: Msg;
  warn?: boolean;
}

export interface Pop {
  id: number;
  item: ItemId | null;
  text: string;
  x: number;
  y: number;
  born: number;
}

export interface ViewState {
  panel: PanelId | null;
  /** 面前选中的物体 */
  focus: { id: string; kind: ObjKind } | null;
  prompts: Prompt[];
  /** 初见介绍卡 */
  intro: { kind: ObjKind; until: number } | null;
  /** 正在做的动作（采集） */
  action: { label: Msg; start: number; end: number } | null;
  hotbar: number;
  pops: Pop[];
  /** 世界里的东西在屏幕上的位置（游戏像素） */
  anchors: {
    player: { x: number; y: number };
    /** 选中的东西在人物上方时，按键提示放到脚下，不挡住它 */
    promptBelow: boolean;
    intro: { x: number; y: number; below: boolean; side: number } | null;
    /** 引导目标不在屏幕里时，指向它的边缘箭头 */
    edge: { x: number; y: number; angle: number; dist: number } | null;
    /** 引导高亮的界面元素 */
    uiTarget: string | null;
  };
  /** 画面放大倍数 */
  k: number;
  /** 调试：手动指定的时刻（分钟） */
  debugMinute: number | null;
}

type Listener = () => void;

export class ViewStore {
  s: ViewState = {
    panel: null,
    focus: null,
    prompts: [],
    intro: null,
    action: null,
    hotbar: 0,
    pops: [],
    anchors: { player: { x: 0, y: 0 }, promptBelow: false, intro: null, edge: null, uiTarget: null },
    k: 2,
    debugMinute: null,
  };
  version = 0;
  private listeners = new Set<Listener>();
  private popSeq = 1;

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  set(patch: Partial<ViewState>) {
    Object.assign(this.s, patch);
    this.version++;
    for (const l of this.listeners) l();
  }

  /** 只有内容变了才通知（每帧调用的 prompts / focus 用） */
  setIfChanged<K extends keyof ViewState>(key: K, v: ViewState[K]) {
    if (JSON.stringify(this.s[key]) === JSON.stringify(v)) return;
    this.set({ [key]: v } as Partial<ViewState>);
  }

  pop(item: ItemId | null, text: string, x: number, y: number) {
    const p: Pop = { id: this.popSeq++, item, text, x, y, born: performance.now() };
    this.set({ pops: [...this.s.pops.slice(-4), p] });
  }
}
