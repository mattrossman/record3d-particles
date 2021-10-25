import { clampWrapped, remap, snoise } from './lib.glsl'

export const computePosition = /* glsl */ `
  uniform float delta;
  uniform float time;

  ${clampWrapped}
  ${snoise}

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );
    // TODO: move these into else {} branch
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelVelocity = texture2D( textureVelocity, uv );

    bool respawn = bool(texelLifecycle.z);

    if (respawn ) {
      vec3 seed = vec3(gl_FragCoord.xy * 100.0, time);
      vec3 spawnPosition = vec3(uv * 2. - 1., 0. );
      gl_FragColor = vec4(spawnPosition, 1.0);
    }
    else {
      vec3 nextPosition = texelPosition.xyz + texelVelocity.xyz * delta;
      gl_FragColor = vec4(nextPosition, 1.0);
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
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );
    vec3 pos = texelPosition.xyz;
    vec3 vel = texelVelocity.xyz;

    bool respawn = bool(texelLifecycle.z);

    if (respawn) {
      gl_FragColor = vec4(0);
    }
    else {
      vec3 accel = vec3(
        snoise(5. * (pos + vec3(1000.0))),
        snoise(5. * (pos + vec3(2000.0))),
        snoise(5. * (pos + vec3(3000.0)))
      );
      vec3 newVelocity = vel + accel * delta * 0.5;
      // newVelocity *= (1.0 - delta * 0.1); // drag

      gl_FragColor = vec4(newVelocity, 1.0);
    }
  }
`

export const computeColor = /* glsl */ `
  uniform sampler2D map;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );
    vec4 texelColor = texture2D( textureColor, uv );
    float age = texelLifecycle.x;

    // Default to the existing color
    gl_FragColor = texelColor;

    // If the particle just spawned at a new position, lookup the new color
    if (age == 0.0) {
      vec2 uvImage = texelPosition.xy * 0.5 + 0.5;
      gl_FragColor = texture2D(map, uvImage);
    }
  }
`

export const computeLifecycle = /* glsl */ `
  uniform float delta;
  uniform float time;

  ${remap}

  float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );

    float age = texelLifecycle.x;
    float maxAge = texelLifecycle.y;
    bool respawn = bool(texelLifecycle.z);

    if (respawn) {
      age = 0.0;
      float randomVal = rand(uv * 231.7 + time);
      maxAge = remap(randomVal, 0., 1., 0.5, 1.);
      respawn = false;
    }
    else if (age >= maxAge) {
      respawn = true;
    }
    else {
      age += delta;
    }
    gl_FragColor = vec4(age, maxAge, float(respawn), 1.0);
  }
`
