import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import type { Material } from '@babylonjs/core/Materials/material';
import type { MaterialDefines } from '@babylonjs/core/Materials/materialDefines';
import type { UniformBuffer } from '@babylonjs/core/Materials/uniformBuffer';

/**
 * Sways vertices in the wind on the GPU: offset grows with the square of the vertex's height in its model,
 * so a tree bends from the root and a grass blade from its base. Two out-of-phase sine gusts that vary
 * across the world keep neighbours from moving in lockstep. Works on PBR and Standard materials.
 * shortcut: shadow maps use their own shader, so shadows stay still; fine for these small amplitudes.
 */
class WindPlugin extends MaterialPluginBase {
  constructor(
    material: Material,
    private strength: number,
  ) {
    super(material, 'Wind', 200, { WIND: false });
    this._enable(true);
  }

  override prepareDefines(defines: MaterialDefines) {
    defines.WIND = true;
  }

  override getClassName() {
    return 'WindPlugin';
  }

  override getUniforms() {
    return {
      ubo: [
        { name: 'windTime', size: 1, type: 'float' },
        { name: 'windStrength', size: 1, type: 'float' },
      ],
      vertex: `#ifdef WIND
        uniform float windTime;
        uniform float windStrength;
      #endif`,
    };
  }

  override bindForSubMesh(ubo: UniformBuffer) {
    ubo.updateFloat('windTime', performance.now() / 1000);
    ubo.updateFloat('windStrength', this.strength);
  }

  override getCustomCode(shaderType: string) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `#ifdef WIND
        float windH = max(positionUpdated.y, 0.0);
        float gust = sin(windTime * 1.1 + worldPos.x * 0.21 + worldPos.z * 0.17) * 0.7
                   + sin(windTime * 2.7 + worldPos.x * 0.63 - worldPos.z * 0.41) * 0.3;
        worldPos.xz += vec2(0.8, 0.6) * gust * windStrength * windH * windH;
      #endif`,
    };
  }
}

/** Adds wind to a material; `strength` is metres of sway per (model unit of height)². */
export const addWind = (material: Material, strength: number) => new WindPlugin(material, strength);

// Kit materials (Quaternius MegaKit names) and how much they move: trees bend gently over their
// 7-12 m, low plants flutter.
const KIT_WIND: [RegExp, number][] = [
  [/^Bark_DeadTree/, 0.0012],
  [/^(Bark_NormalTree|Leaves_NormalTree|Leaves_Pine)/, 0.0022],
  [/^(Leaves|Grass|Flowers)(_glow)?$/, 0.05],
];

export function windForKit(material: Material) {
  const match = KIT_WIND.find(([re]) => re.test(material.name));
  if (match) addWind(material, match[1]);
}
