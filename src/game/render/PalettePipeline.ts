// 换色后处理：场景按白天调色板画好以后，每个像素换回 0–11 号色，
// 按当前时段（两行换色表之间用 4×4 Bayer 过渡）查表上色；灯光遮罩里读白天那一行。
import Phaser from 'phaser';
import { BR, rgb, type PhaseMix } from '../../art/palette';
import { BAYER } from '../../art/noise';
import { PHASES } from '../../config/visual';

const frag = `
precision mediump float;
uniform sampler2D uMainSampler;
uniform sampler2D uMask;
uniform vec3 uPal[12];
uniform float uTA[12];
uniform float uTB[12];
uniform float uBayer[16];
uniform float uLevel;
uniform float uUseMask;
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
  vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
  float bi = p.y * 4.0 + p.x;
  float b = 0.0;
  for (int i = 0; i < 16; i++) if (abs(float(i) - bi) < 0.5) b = uBayer[i];
  float ta = 0.0;
  float tb = 0.0;
  for (int i = 0; i < 12; i++) if (abs(float(i) - idx) < 0.5) { ta = uTA[i]; tb = uTB[i]; }
  float outIdx = b < uLevel ? tb : ta;
  if (uUseMask > 0.5) {
    float lit = texture2D(uMask, vec2(outTexCoord.x, 1.0 - outTexCoord.y)).a;
    if (lit > 0.5) outIdx = idx;
  }
  gl_FragColor = vec4(palAt(outIdx), 1.0);
}
`;

export class PalettePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  mix: PhaseMix = { a: 'day', b: 'day', m: 0, s: 0 };
  mask: Phaser.Textures.CanvasTexture | null = null;
  useMask = false;
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
    this.set1fv('uTA', PHASES[this.mix.a].t);
    this.set1fv('uTB', PHASES[this.mix.b].t);
    this.set1fv('uBayer', this.bayer);
    this.set1f('uLevel', Math.round(this.mix.m * 16));
    this.set1f('uUseMask', this.useMask && this.mask ? 1 : 0);
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
