// 小粒子：采集时掉的叶子、木屑，捞鱼时的水花。世界坐标，画在屏幕特效层上。
import { px } from '../../art/draw';
import type { Pal } from '../../art/palette';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 重力（像素/秒²） */
  g: number;
  /** 落到这个 y 就停住（地面） */
  floor: number;
  age: number;
  life: number;
  role: string;
}

export class Particles {
  list: Particle[] = [];

  add(p: Omit<Particle, 'age'>): void {
    if (this.list.length > 120) this.list.shift();
    this.list.push({ ...p, age: 0 });
  }

  /** 一把：n 个粒子从 (x, y) 向四周散开 */
  burst(n: number, x: number, y: number, roles: string[], o: { speed: number; up: number; g: number; floor: number; life: number }, rnd: () => number): void {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const sp = o.speed * (0.4 + rnd() * 0.6);
      this.add({
        x: x + (rnd() - 0.5) * 4,
        y,
        vx: Math.cos(a) * sp,
        vy: -o.up * (0.5 + rnd() * 0.5),
        g: o.g,
        floor: o.floor,
        life: o.life * (0.7 + rnd() * 0.6),
        role: roles[(rnd() * roles.length) | 0],
      });
    }
  }

  step(dt: number): void {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= p.floor) {
        p.y = p.floor;
        p.vx *= 0.5;
        p.vy = 0;
      }
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(c: CanvasRenderingContext2D, P: Pal, cx: number, cy: number): void {
    for (const p of this.list) {
      // 最后三分之一闪烁消失
      if (p.age > p.life * 0.66 && Math.floor(p.age * 20) % 2) continue;
      px(c, P, p.role, Math.round(p.x - cx), Math.round(p.y - cy));
    }
  }
}
