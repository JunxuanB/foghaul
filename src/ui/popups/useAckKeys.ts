import { useEffect } from 'react';

/** 弹窗开着时 Esc / Enter / E 都算“知道了”，不让按键漏到游戏里（游戏的键盘监听在 window 上） */
export function useAckKeys(show: boolean, ack: () => void): void {
  useEffect(() => {
    if (!show) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.code !== 'Enter' && e.code !== 'KeyE') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      ack();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [show, ack]);
}
