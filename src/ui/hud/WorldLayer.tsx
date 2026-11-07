// 世界里的字：人物头顶的按键提示和动作进度、初见介绍卡、“+1”、屏幕边缘指向目标的箭头。
// 位置每帧变（画面层写进 view.anchors），这里用 requestAnimationFrame 直接改样式，不重渲染。
import { useEffect, useRef } from 'react';
import { iconURL } from '../../art/draw';
import { ANIM } from '../../config/visual';
import { t, tm } from '../../i18n';
import { useView, useViewStore } from '../../store/hooks';

export function WorldLayer() {
  const v = useView();
  const vs = useViewStore();
  const promptRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const popRefs = useRef(new Map<number, HTMLDivElement>());
  const labelRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = vs.s;
      const k = s.k;
      const a = s.anchors;
      if (promptRef.current) {
        promptRef.current.style.left = a.player.x * k + 'px';
        promptRef.current.style.top = (a.promptBelow ? a.player.y + 4 : a.player.y - 34) * k + 'px';
        promptRef.current.style.transform = a.promptBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
      }
      if (introRef.current && a.intro) {
        introRef.current.style.left = a.intro.x * k + 'px';
        introRef.current.style.top = (a.intro.below ? a.intro.y : a.intro.y - 4) * k + 'px';
        introRef.current.style.transform = a.intro.below ? (a.intro.side > 0 ? 'translate(0, 0)' : 'translate(-100%, 0)') : 'translate(-50%, -100%)';
      }
      const e = edgeRef.current;
      if (e) {
        e.style.display = a.edge ? '' : 'none';
        if (a.edge) {
          e.style.left = a.edge.x * k + 'px';
          e.style.top = a.edge.y * k + 'px';
          const i = e.querySelector('i') as HTMLElement | null;
          if (i) i.style.transform = `rotate(${a.edge.angle}rad)`;
          const sp = e.querySelector('span');
          if (sp) sp.textContent = t('ui.tiles', { n: a.edge.dist });
        }
      }
      if (barRef.current && s.action) {
        const p = (performance.now() - s.action.start) / (s.action.end - s.action.start);
        barRef.current.style.width = Math.max(0, Math.min(1, p)) * 100 + '%';
      }
      for (const [id, el] of labelRefs.current) {
        const p = a.labels[id];
        el.style.display = p ? '' : 'none';
        if (p) {
          el.style.left = p.x * k + 'px';
          el.style.top = p.y * k + 'px';
        }
      }
      const now = performance.now();
      for (const p of s.pops) {
        const el = popRefs.current.get(p.id);
        if (!el) continue;
        const age = (now - p.born) / 1000 / ANIM.popSeconds;
        el.style.display = age > 1 ? 'none' : '';
        el.style.left = a.player.x * k + 'px';
        el.style.top = (a.player.y - 36 - age * 10) * k + 'px';
        el.style.visibility = age > 0.75 && Math.floor(now / 60) % 2 ? 'hidden' : 'visible';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [vs]);

  const showPrompts = !v.panel && (v.prompts.length > 0 || v.action);
  return (
    <>
      {v.labels.map((l) => (
        <div
          key={l.id}
          className={'w-label' + (l.dim ? ' dim' : '')}
          ref={(el) => {
            if (el) labelRefs.current.set(l.id, el);
            else labelRefs.current.delete(l.id);
          }}
        >
          {t('island.' + l.id)}
        </div>
      ))}
      {showPrompts && (
        <div className="w-prompts" ref={promptRef}>
          {v.action ? (
            <>
              <div className="w-chip">{tm(v.action.label)}</div>
              <div className="w-bar">
                <i ref={barRef} />
              </div>
            </>
          ) : (
            v.prompts.slice(0, 3).map((p, i) => (
              <div key={i} className={'w-chip' + (p.ok ? '' : ' off') + (p.warn ? ' warn' : '')}>
                <b>{p.key}</b>
                {tm(p.label)}
                {!p.ok && p.reason && <span>（{tm(p.reason)}）</span>}
              </div>
            ))
          )}
        </div>
      )}
      {v.intro && !v.panel && (
        <div className="u-panel w-intro" ref={introRef}>
          <b>{t('thing.' + v.intro.kind)}</b>
          <p>{t('intro2d.' + v.intro.kind)}</p>
        </div>
      )}
      <div className="w-edge" ref={edgeRef} style={{ display: 'none' }}>
        <i />
        <span />
      </div>
      {v.pops.map((p) => (
        <div
          key={p.id}
          className="w-pop"
          ref={(el) => {
            if (el) popRefs.current.set(p.id, el);
            else popRefs.current.delete(p.id);
          }}
        >
          {p.item && <img src={iconURL(p.item)} alt="" />}
          {p.text}
        </div>
      ))}
    </>
  );
}
