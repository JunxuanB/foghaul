// 启动：把程序生成的精灵按白天调色板烘焙成纹理（昼夜由换色着色器负责）。
import Phaser from 'phaser';
import { allSprites, gridCanvas } from '../../art/draw';
import { G } from '../../art/grid';
import { OBJ_DEFS } from '../../config/buildings';

/** 只保留描边、换成灯芯色：选中时叠在物体上 */
function highlight(g: G): G {
  const h = new G(g.w, g.h);
  for (let i = 0; i < g.d.length; i++) if (g.d[i] === 'o') h.d[i] = 'hl';
  return h;
}

/** 引导箭头（朝下）和“!” */
function arrow(): G {
  const g = new G(9, 8);
  for (let y = 0; y < 5; y++) g.rect(y, 1 + y, 9 - y * 2, 1, y < 2 ? 'y1' : 'y0');
  g.rect(3, 0, 3, 1, 'y1');
  return g.outline();
}
function bang(): G {
  const g = new G(5, 11);
  g.rect(1, 1, 3, 6, 'y1');
  g.rect(1, 8, 3, 2, 'y1');
  return g.outline();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const S = allSprites();
    for (const [name, g] of Object.entries(S)) {
      if (!this.textures.exists(name)) this.textures.addCanvas(name, gridCanvas(g));
      const def = OBJ_DEFS[name];
      if (def && def.kind !== 'decor' && !this.textures.exists(name + '_hl')) this.textures.addCanvas(name + '_hl', gridCanvas(highlight(g)));
    }
    if (!this.textures.exists('ui_arrow')) this.textures.addCanvas('ui_arrow', gridCanvas(arrow()));
    if (!this.textures.exists('ui_bang')) this.textures.addCanvas('ui_bang', gridCanvas(bang()));
    this.scene.start('island');
  }
}
