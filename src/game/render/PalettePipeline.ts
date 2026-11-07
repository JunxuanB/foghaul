// 换色后处理：场景按白天调色板画好以后，每个像素换回 0–11 号色，
// 按当前时段的换色表上色（时段之间逐色换档，见 art/palette.ts 的 blendTable）；灯光遮罩里读白天那一行。
import Phaser from 'phaser';
import { BR, blendTable, rgb, type PhaseMix } from '../../art/palette';
import { BAYER } from '../../art/noise';
import { VIEW } from '../../config/visual';

const frag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform sampler2D uMask;
uniform vec3 uPal[12];
uniform float uTA[12];
uniform float uBayer[16];
uniform float uUseMask;
uniform float uFade;
uniform float uScale;
uniform vec2 uMaskOff;
uniform vec2 uView;
varying vec2 outTexCoord;

vec3 palAt(float k) {
  vec3 c = uPal[0];
  for (int i = 0; i < 12; i++) if (abs(float(i) - k) < 0.5) c = uPal[i];
  return c;
}

void main() {
  vec4 src = texture2D(uMainSampler, outTexCoord);
  float idx = 0.0;
  float best = 1e9;
  for (int i = 0; i < 12; i++) {
    vec3 d = src.rgb - uPal[i];
    float e = dot(d, d);
    if (e < best) { best = e; idx = float(i); }
  }
  // 画布按屏幕分辨率渲染：点阵按游戏像素（uScale 个屏幕像素）排
  vec2 p = mod(floor(gl_FragCoord.xy / uScale), 4.0);
  float bi = p.y * 4.0 + p.x;
  float b = 0.0;
  for (int i = 0; i < 16; i++) if (abs(float(i) - bi) < 0.5) b = uBayer[i];
  float outIdx = 0.0;
  for (int i = 0; i < 12; i++) if (abs(float(i) - idx) < 0.5) outIdx = uTA[i];
  if (uUseMask > 0.5) {
    // 遮罩按整游戏像素画（左上角 = 镜头左上角取整），这里加上镜头的小数偏移再读，灯光边缘不会随镜头闪
    vec2 g = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uView + uMaskOff;
    float lit = texture2D(uMask, (floor(g) + 0.5) / (uView + 1.0)).a;
    if (lit > 0.5) outIdx = idx;
  }
  // 点阵过渡（睡觉、死亡、切场景）：Bayer 阈值以下的像素变成深渊色
  if (b < uFade * 16.0) outIdx = 0.0;
  gl_FragColor = vec4(palAt(outIdx), 1.0);
}
`;

export class PalettePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  mix: PhaseMix = { a: 'day', b: 'day', m: 0, s: 0 };
  mask: Phaser.Textures.CanvasTexture | null = null;
  useMask = false;
  /** 点阵过渡 0–1 */
  fade = 0;
  /** 画面放大倍数 k */
  scale = 1;
  /** 镜头左上角的小数部分（游戏像素） */
  maskOff: [number, number] = [0, 0];
  private pal: number[] = [];
  private bayer: number[] = BAYER.map((v) => v);

  constructor(game: Phaser.Game) {
    super({ game, name: 'palette', fragShader: frag });
    for (const h of BR) {
      const [r, g, b] = rgb(h);
      this.pal.push(r / 255, g / 255, b / 255);
    }
  }

  onPreRender(): void {
    this.set3fv('uPal', this.pal);
    this.set1fv('uTA', blendTable(this.mix));
    this.set1fv('uBayer', this.bayer);
    this.set1f('uUseMask', this.useMask && this.mask ? 1 : 0);
    this.set1f('uFade', this.fade);
    this.set1f('uScale', this.scale);
    this.set2f('uMaskOff', this.maskOff[0], this.maskOff[1]);
    this.set2f('uView', VIEW.w, VIEW.h);
    this.set1i('uMask', 1);
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
    const gl = this.gl;
    if (this.useMask && this.mask) this.bindTexture(this.mask.source[0].glTexture!, 1);
    this.bindAndDraw(target);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
  }
}
