import { clampWrapped, snoise } from './lib.glsl'

export const computePosition = /* glsl */ `
uniform float delta;

${clampWrapped}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 texelPosition = texture2D( texturePosition, uv );
  vec4 texelVelocity = texture2D( textureVelocity, uv );

  float time = texelPosition.w;
  float nextTime = fract(time + delta * 0.4);

  vec3 newPosition = texelPosition.xyz + texelVelocity.xyz * delta;

  gl_FragColor = vec4(newPosition, nextTime);
}
`

export const computeVelocity = /* glsl */ `
  uniform float delta;

  ${snoise}
  
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelVelocity = texture2D( textureVelocity, uv );
    vec3 pos = texelPosition.xyz;
    vec3 vel = texelVelocity.xyz;

    vec3 accel = vec3(
      snoise(pos + vec3(0.0)),
      snoise(pos + vec3(1000.0)),
      snoise(pos + vec3(2000.0))
    ) - (pos);

    vec3 newVelocity = vel + accel * delta;

    gl_FragColor = vec4(newVelocity, 1.0);
  }
`
