// 面板的“画面零件”：用图标格、碗、星、头像、建筑图代替句子（AGENTS.md “界面”规范）。
// 所有面板都用这些零件，同一种信息在哪里都长一样。
import type { ReactNode } from 'react';
import { charURL, iconURL, spriteURL } from '../../art/draw';
import { BALANCE } from '../../config/balance';
import type { ItemId } from '../../config/items';
import { plain, t, tm } from '../../i18n';
import { costAvailable } from '../../sim/inventory';
import type { Msg } from '../../sim/msg';
import type { GameState, Island, Stock } from '../../sim/types';

/** 一个图标（物品或 ui_ 图标），size 是游戏内像素 */
export function Icon({ id, size = 16, title }: { id: string; size?: number; title?: string }) {
  return <img className="k-ic" src={iconURL(id)} alt={title ?? ''} title={title} style={{ ['--s' as string]: size }} />;
}

/**
 * 一个“有 / 要”格：图标，下面是数字。够了亮、不够暗并用警告色。
 * have 省略时只显示数量（产出、收益）。
 */
export function Cell({ id, need, have, label, tone }: { id: string; need?: number; have?: number; label?: ReactNode; tone?: 'ok' | 'lack' | 'dim' }) {
  const lack = tone === 'lack' || (have != null && need != null && have < need);
  const cls = 'k-cell' + (lack ? ' lack' : '') + (tone === 'ok' ? ' ok' : '') + (tone === 'dim' ? ' dim' : '');
  const name = id.startsWith('ui_') ? undefined : t('item.' + id);
  return (
    <span className={cls} title={name}>
      <span className="k-box">
        <img src={iconURL(id)} alt={name ?? ''} />
        {have != null && need != null && have >= need && <img className="k-tick" src={iconURL('ui_check')} alt="" />}
      </span>
      <span className="k-num">{label ?? (have != null && need != null ? `${Math.min(have, 999)}/${need}` : need != null ? `×${need}` : '')}</span>
    </span>
  );
}

/** 一份花费：每种材料一个格，数字是“背包 + 货舱 + 本岛仓库 / 要多少” */
export function CostGrid({ g, cost, src }: { g: GameState; cost: Stock; src?: Island }) {
  const ids = Object.keys(cost) as ItemId[];
  return (
    <span className="k-cells">
      {ids.map((id) => (
        <Cell key={id} id={id} have={costAvailable(g, src, id)} need={cost[id] ?? 0} />
      ))}
    </span>
  );
}

/** 产出：每种一个格，数字是“×n” */
export function Yield({ items }: { items: [string, number][] }) {
  return (
    <span className="k-cells">
      {items.map(([id, n]) => (
        <Cell key={id} id={id} need={n} />
      ))}
    </span>
  );
}

/** n 个碗：前 lit 个吃饱 */
export function Bowls({ lit, total }: { lit: number; total: number }) {
  return (
    <span className="k-row tight" aria-label={`${lit}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Icon key={i} id={i < lit ? 'ui_bowl' : 'ui_bowlEmpty'} size={12} />
      ))}
    </span>
  );
}

/** 等级星 */
export function Stars({ lv, max }: { lv: number; max: number }) {
  return (
    <span className="k-row tight" aria-label={t('ui.facilityLevel', { lv })}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} id={i < lv ? 'ui_star' : 'ui_starEmpty'} size={8} />
      ))}
    </span>
  );
}

/** 人物头像（精灵上半身）；char 省略时是空位 */
export function Portrait({ char, name, dim, big }: { char?: string; name?: string; dim?: boolean; big?: boolean }) {
  const cls = 'k-face' + (char ? '' : ' empty') + (dim ? ' dim' : '') + (big ? ' big' : '');
  return (
    <span className={cls} title={name}>
      {char ? <img src={charURL(char)} alt={name ?? ''} /> : <img src={iconURL('ui_personEmpty')} alt="" className="slot" />}
    </span>
  );
}

/** 建筑 / 物体的图（精灵放大到放得下的整数倍；太大的按比例缩进框里），放在面板左边的“图卡”里 */
export function Picture({ sprite, scale = 2, children }: { sprite: string; scale?: number; children?: ReactNode }) {
  const s = spriteURL(sprite);
  const room = BALANCE.ui.picture;
  const fit = Math.min(scale, room / Math.max(1, s.w), room / Math.max(1, s.h));
  const f = fit >= 1 ? Math.floor(fit) : fit;
  return (
    <div className="k-pic">
      <div className="k-pic-frame">{s.url && <img src={s.url} alt="" style={{ ['--w' as string]: s.w * f, ['--h' as string]: s.h * f }} />}</div>
      {children}
    </div>
  );
}

/** 一条状态：图标 + 短词。tone 决定颜色 */
export function Chip({ icon, children, tone }: { icon?: string; children: ReactNode; tone?: 'ok' | 'warn' | 'dim' }) {
  return (
    <span className={'k-chip' + (tone ? ' ' + tone : '')}>
      {icon && <Icon id={icon} size={8} />}
      {children}
    </span>
  );
}

/** 条：value / max，旁边可以放图标和数字 */
export function Meter({ value, max, icon, label }: { value: number; max: number; icon?: string; label?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <span className={'k-meter' + (value >= max ? ' full' : '')}>
      {icon && <Icon id={icon} size={8} />}
      <i style={{ ['--v' as string]: v }} />
      <span>{label ?? `${Math.floor(value)}/${max}`}</span>
    </span>
  );
}

/** 一张有标题的小卡（面板里分块用） */
export function Card({ title, icon, right, children, cls }: { title?: ReactNode; icon?: string; right?: ReactNode; children: ReactNode; cls?: string }) {
  return (
    <div className={'k-card' + (cls ? ' ' + cls : '')}>
      {(title || right) && (
        <div className="k-card-head">
          <span className="k-card-title">
            {icon && <Icon id={icon} size={8} />}
            {title}
          </span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/** 键帽 */
export function Key({ k }: { k: string }) {
  return <span className="u-key">{k}</span>;
}

/** 规则层的原因（Msg）在界面上的短写法：只用纯文字，缺材料统一写“材料不足”（材料格已经画出来了） */
export function reasonText(msg: Msg | null | undefined): string {
  if (!msg) return '';
  if (msg.k === 'err.missing') return t('ui.lack');
  return plain(tm(msg)).replace(/[。.]$/, '');
}

/** 名字一类的 Msg（人名、设施名）在界面上的纯文字 */
export function label(msg: Msg | null | undefined): string {
  return plain(tm(msg));
}
