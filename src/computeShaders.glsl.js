import { clampWrapped, remap, rgb2hue, snoise } from './lib.glsl'

export const computePosition = /* glsl */ `
  uniform float delta;
  uniform float time;
  uniform sampler2D map;
  uniform vec2 videoResolution;
  uniform vec2 range;
  uniform vec4 iK;
  uniform float filterRadius;
  uniform float filterThreshold;

  ${clampWrapped}
  ${snoise}
  ${rgb2hue}

  float rgb2depth(vec3 rgb) {
    float hue = rgb2hue( rgb );
    return 3.0 * hue;
  }

  float lookupDepth(vec2 uv) {
    vec4 texelRgbd = texture2D(map, uv * vec2(0.5, 1.0));
    return rgb2depth(texelRgbd.rgb);
  }

  bool shouldFilter(float centerDepth, vec2 uv) {
    // Filter around texture edges
    vec2 distanceFromEdge = 0.5 - abs(uv - 0.5);
    if (min(distanceFromEdge.x, distanceFromEdge.y) < filterRadius) return true;

    // Filter large changes in depth
    float delta_1 = abs(centerDepth - lookupDepth(uv + vec2(-1., 0.) * filterRadius));
    float delta_2 = abs(centerDepth - lookupDepth(uv + vec2(1., 0.) * filterRadius));
    float delta_3 = abs(centerDepth - lookupDepth(uv + vec2(0., 1.) * filterRadius));
    float delta_4 = abs(centerDepth - lookupDepth(uv + vec2(0., -1.) * filterRadius));
    float maxDelta = max(delta_1, max(delta_2, max(delta_3, delta_4)));
    return maxDelta > filterThreshold;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );

    bool respawn = bool(texelLifecycle.z);

    if (respawn ) {
      float depth = lookupDepth(uv);
      bool shouldDiscard = depth < range.x || depth > range.y || shouldFilter(depth, uv);
      float scale = 1.0;
      vec2 pt = uv * videoResolution * vec2(0.5, 1.0);
      vec3 ptPos = scale * vec3(
        (iK.x * float(pt.x) + iK.z) * depth,
        (iK.y * float(pt.y) + iK.w) * depth,
        -depth
      );
      vec3 pixelPosition = vec3(uv * videoResolution, 0.);
      vec3 spawnPosition = vec3(uv * 2. - 1., 0. );
      gl_FragColor = vec4(ptPos, float(shouldDiscard));
    }
    else {
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelVelocity = texture2D( textureVelocity, uv );
      vec3 nextPosition = texelPosition.xyz + texelVelocity.xyz * delta;
      gl_FragColor = vec4(nextPosition, 0.0);
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
    // TODO: remove texelPosition dependency 
    vec4 texelPosition = texture2D( texturePosition, uv );
    vec4 texelLifecycle = texture2D( textureLifecycle, uv );
    vec4 texelColor = texture2D( textureColor, uv );
    float age = texelLifecycle.x;

    // Default to the existing color
    gl_FragColor = texelColor;

    // If the particle just spawned at a new position, lookup the new color
    if (age == 0.0) {
      vec2 uvImage = uv;
      uvImage.x = uvImage.x * 0.5 + 0.5; // Use right half of the video
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
    vec4 texelPosition = texture2D( texturePosition, uv );

    float age = texelLifecycle.x;
    float maxAge = texelLifecycle.y;
    bool respawn = bool(texelLifecycle.z);
    bool shouldDiscard = bool(texelPosition.w);

    if (shouldDiscard) {
      respawn = true;
    }
    else if (respawn) {
      age = 0.0;
      float randomVal = rand(uv * 231.7 + time);
      maxAge = remap(randomVal, 0., 1., 0.1, 0.4);
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
