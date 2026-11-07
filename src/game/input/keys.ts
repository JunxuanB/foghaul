// 键盘：移动键按住状态 + 其他键的一次性事件。窗口级监听，画面层和界面层共用。
export type Action =
  | 'interact'
  | 'close'
  | 'inventory'
  | 'map'
  | 'journal'
  | 'help'
  | 'use'
  | 'fish'
  | 'drink'
  | 'grab'
  | 'slot1'
  | 'slot2'
  | 'slot3'
  | 'slot4'
  | 'slot5';

const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const ACTIONS: Record<string, Action> = {
  KeyE: 'interact',
  Escape: 'close',
  Tab: 'inventory',
  KeyM: 'map',
  KeyJ: 'journal',
  KeyH: 'help',
  KeyQ: 'use',
  KeyX: 'fish',
  KeyZ: 'drink',
  KeyF: 'grab',
  Digit1: 'slot1',
  Digit2: 'slot2',
  Digit3: 'slot3',
  Digit4: 'slot4',
  Digit5: 'slot5',
};

const held = new Set<string>();
const listeners = new Set<(a: Action) => void>();
/** 虚拟摇杆（手机） */
const stick = { x: 0, y: 0 };

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

let installed = false;
export function installKeys(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (MOVE[e.code]) {
      held.add(e.code);
      e.preventDefault();
      return;
    }
    const a = ACTIONS[e.code];
    if (!a) return;
    if (a === 'inventory' || a === 'interact') e.preventDefault();
    if (e.repeat) return;
    for (const l of listeners) l(a);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
}

export function onAction(fn: (a: Action) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 由按钮（手机、界面）触发同样的动作 */
export function fire(a: Action): void {
  for (const l of listeners) l(a);
}

export function setStick(x: number, y: number): void {
  stick.x = x;
  stick.y = y;
}

/** 当前移动方向（未归一化） */
export function moveDir(): [number, number] {
  let x = stick.x;
  let y = stick.y;
  for (const k of held) {
    x += MOVE[k][0];
    y += MOVE[k][1];
  }
  return [Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))];
}
