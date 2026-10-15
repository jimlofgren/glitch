const vec2 GRID = vec2(32.0, 18.0);

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float frameAt(vec2 uv, float layer) {
  return texture(uFrames, vec3(fract(uv), layer)).r;
}

vec2 coverUv(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float screenAspect = iResolution.x / iResolution.y;
  float frameAspect = 16.0 / 9.0;
  if (screenAspect > frameAspect) {
    uv.y = (uv.y - 0.5) * (frameAspect / screenAspect) + 0.5;
  } else {
    uv.x = (uv.x - 0.5) * (screenAspect / frameAspect) + 0.5;
  }
  return uv;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float calm = uReducedMotion;
  float g = uGlitchScale;
  float beat = uBeat * g * mix(1.0, 0.5, calm);
  float count = max(uFrameCount, 1.0);
  float baseFrame = mod(uBeatCount, count);
  float tick = floor(iTime * mix(4.0, 2.0, calm));

  vec2 uv = coverUv(fragCoord);
  float zoom = 1.0 + uBass * 0.02 * (1.0 - calm);
  uv = (uv - 0.5) / zoom + 0.5;

  float near = 0.0;
  if (uPointer.x >= 0.0) {
    vec2 screen = fragCoord / iResolution.xy;
    vec2 d = (screen - uPointer) * vec2(iResolution.x / iResolution.y, 1.0);
    float dist = length(d);
    near = exp(-dist * dist * 25.0);
    vec2 push = d / max(dist, 1e-4) * near * (3.0 + beat * 3.0);
    vec2 cellPush = floor(push * (1.0 - calm * 0.5) + 0.5);
    uv += cellPush / GRID;
  }

  vec2 cell = floor(uv * GRID);
  float rowShiftOn = step(0.985 - beat * 0.2, hash21(vec2(cell.y, tick))) * step(1.0 - g, hash21(vec2(cell.y, tick + 77.0)));
  float rowShift = rowShiftOn * (floor(hash21(vec2(cell.y, tick + 1.0)) * 7.0) - 3.0) / GRID.x;
  uv.x += rowShift;

  float driftRow = step(0.93, hash21(vec2(cell.y, 42.0)));
  float driftDir = sign(hash21(vec2(cell.y, 7.0)) - 0.5);
  float driftSpeed = (mix(0.4, 0.1, calm) + uTreble * 1.5 * (1.0 - calm)) * g;
  uv.x += driftRow * driftDir * floor(iTime * driftSpeed) / GRID.x;

  cell = floor(uv * GRID);
  float cellRand = hash21(cell + tick * 0.13);
  float mixAmount = (0.012 + beat * 0.22 + uTreble * 0.03) * g + near * 0.5;
  float altOn = step(1.0 - mixAmount, cellRand);
  float altFrame = mod(baseFrame + 1.0 + floor(hash21(cell + tick) * (count - 1.0)), count);
  float layer = mix(baseFrame, altFrame, altOn);
  vec2 cellOffset = altOn * (floor(hash22(cell + tick + 3.0) * 7.0) - 3.0) / GRID;
  vec2 suv = uv + cellOffset;

  float slice = floor(fragCoord.y / 3.0);
  float sliceOn = step(0.997 - uTreble * 0.01, hash21(vec2(slice, tick))) * step(1.0 - g, hash21(vec2(slice, tick + 31.0)));
  suv.x += sliceOn * (hash21(vec2(slice, tick + 5.0)) - 0.5) * 0.08 * (1.0 - calm);

  float split = (0.0005 + beat * 0.005) * (1.0 - calm) * g;
  vec3 col = vec3(
    frameAt(suv + vec2(split, 0.0), layer),
    frameAt(suv, layer),
    frameAt(suv - vec2(split, 0.0), layer)
  );

  float flashOn = step(0.997 - beat * 0.03, hash21(cell + tick + 9.0)) * (1.0 - calm) * step(1.0 - g, hash21(cell + tick + 53.0));
  col = mix(col, 1.0 - col, flashOn);

  vec3 dark = vec3(0.015, 0.015, 0.025);
  vec3 warm = vec3(1.0, 0.45, 0.2);
  vec3 cool = vec3(0.85, 0.87, 0.95);
  vec3 light = mix(cool, warm, smoothstep(0.3, 0.9, uMid) * 0.7);
  col = mix(dark, light, col);

  vec2 c = uv - 0.5;
  col += (1.0 - col.g) * uBass * 0.06 * exp(-dot(c, c) * 6.0);
  col += near * near * warm * 0.08;

  fragColor = vec4(col, 1.0);
}
