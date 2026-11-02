import { segments, t, tm } from '../../i18n';
import type { Msg, Param } from '../../sim/msg';

/** 渲染带 <g>/<b>/<h>/<w> 高亮标记的文字 */
export function Rich({ s }: { s: string }) {
  return (
    <>
      {segments(s).map((seg, i) =>
        seg.tone ? (
          <span key={i} className={'tone-' + seg.tone}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

export function M({ m }: { m: Msg | null | undefined }) {
  return <Rich s={tm(m)} />;
}

export function T({ k, p }: { k: string; p?: Record<string, Param> }) {
  return <Rich s={t(k, p)} />;
}
