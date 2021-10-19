export const remap = /* glsl */ `
  float remap(float value, float low1, float high1, float low2, float high2) {
    return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
  }
`

export const clampWrapped = /* glsl */ `
  float clampWrapped(float x, float minVal, float maxVal) {
    return mod(x - minVal, maxVal - minVal) + minVal;
  }
`
