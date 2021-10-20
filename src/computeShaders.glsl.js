import { clampWrapped, snoise } from './lib.glsl'

export const computePosition = /* glsl */ `
uniform float delta;
uniform float time;

${clampWrapped}
${snoise}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 texelVelocity = texture2D( textureVelocity, uv );

  float respawn = texelVelocity.w;

  if (respawn == 1.0) {
    vec3 seed = vec3(gl_FragCoord.xy * 100.0, time);
    vec3 spawnPosition = vec3(
      snoise(seed + 100.),
      snoise(seed + 200.),
      0.
    );
    float spawnAge = 0.;
    gl_FragColor = vec4(spawnPosition, spawnAge);
  }
  else {
    vec4 texelPosition = texture2D( texturePosition, uv );
    float age = texelPosition.w;
    float nextAge = age + delta;
    vec3 nextPosition = texelPosition.xyz + texelVelocity.xyz * delta;
    gl_FragColor = vec4(nextPosition, nextAge);
  }
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

    float age = texelPosition.w;

    if (age > 2.) {
      // Flag for respawn
      gl_FragColor.w = 1.;
    }
    else {
      vec3 accel = vec3(
        snoise(10. * (pos + vec3(1000.0))),
        snoise(10. * (pos + vec3(2000.0))),
        snoise(10. * (pos + vec3(3000.0)))
      );
  
      vec3 newVelocity = vel + accel * delta * 0.1;
      // newVelocity *= (1.0 - delta * 0.1); // drag
      gl_FragColor = vec4(newVelocity, 0.0);
    }
  }
`

export const computeColor = /* glsl */ `
  uniform sampler2D map;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelColor = texture2D( textureColor, uv );
    float age = texelPosition.w;

    // Default to the existing color
    gl_FragColor = texelColor;

    // If the particle just spawned at a new position, lookup the new color
    if (age == 0.0) {
      // UV to look up in our image texture
      vec2 uvImage = texelPosition.xy * 0.5 + 0.5;
      gl_FragColor = texture2D(map, uvImage);
    }
  }
`
