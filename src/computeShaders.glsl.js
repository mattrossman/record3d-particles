import { clampWrapped } from './lib.glsl'

export const computePosition = /* glsl */ `
uniform float delta;

${clampWrapped}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 prev = texture2D( texturePosition, uv );

  float time = prev.w;
  float nextTime = fract(time + delta * 0.4);

  gl_FragColor = vec4(prev.xyz, nextTime);
}
`
