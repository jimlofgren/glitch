const vec3 GREEN = vec3(0.22, 1.0, 0.08);
const vec3 WHITE = vec3(1.0);
const vec3 RED = vec3(1.0, 0.1, 0.05);
const int DIGITS[10] = int[10](31599, 29850, 29671, 31207, 18925, 31183, 31695, 18727, 31727, 31215);

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
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

float frameAt(vec2 uv, float layer) {
  return texture(uFrames, vec3(fract(uv), layer)).r;
}

float sdBox(vec2 p, vec2 c, vec2 h) {
  vec2 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float line(float d, float w) {
  return 1.0 - smoothstep(w, w + 1.0, d);
}

float glyphBit(int mask, vec2 cellUv) {
  int bx = int(floor(cellUv.x * 4.0));
  int by = int(floor(cellUv.y * 6.0));
  if (bx > 2 || by < 1) return 0.0;
  int bit = (5 - by) * 3 + bx;
  return float((mask >> bit) & 1);
}

int digitMask(float value, float place) {
  int d = int(mod(floor(value / place), 10.0));
  return DIGITS[d];
}

float telemetry(vec2 fc, vec2 anchor, vec2 coord, float tick, float px) {
  vec2 local = (fc - anchor) / (px * vec2(4.0, 6.0));
  if (local.x < 0.0 || local.x >= 16.0 || local.y < 0.0 || local.y >= 1.0) return 0.0;
  int c = int(floor(local.x));
  int mask = 0;
  if (c < 4) {
    mask = digitMask(coord.x * 1920.0, pow(10.0, float(3 - c)));
  } else if (c >= 5 && c < 9) {
    mask = digitMask(coord.y * 1080.0, pow(10.0, float(8 - c)));
  } else if (c >= 10) {
    mask = int(hash21(vec2(float(c), tick + anchor.x)) * 32768.0);
  }
  return glyphBit(mask, fract(local));
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  float calm = uReducedMotion;
  float live = 1.0 - calm;
  vec2 res = iResolution.xy;
  float px = max(1.0, floor(res.y / 540.0));
  float snap = uSnap * live * uGlitchScale;
  float tick = floor(iTime * 20.0);
  float slowTick = floor(iTime * 6.0);

  vec2 fc = fragCoord;
  fc.x += snap * (hash11(tick) - 0.5) * 16.0;
  float band = floor(fragCoord.y / 12.0);
  float bandOn = step(1.0 - snap * 0.18, hash21(vec2(band, tick)));
  fc.x += bandOn * (hash21(vec2(band, tick + 1.0)) - 0.5) * 50.0;
  fc.x = mix(fc.x, floor(fc.x / 6.0) * 6.0, bandOn);

  vec2 uv = coverUv(fc);
  float layer = mod(uBeatCount, max(uFrameCount, 1.0));
  float feed = frameAt(uv, layer);
  vec3 col = feed * GREEN * 0.22;

  float dilation = uBeat * 6.0 * live;
  float strokeWidth = 0.35 + uBass * 0.9;
  for (int b = 0; b < 8; b++) {
    if (b >= uBoxCount) break;
    vec4 box = uBoxes[b];
    vec2 lo = box.xy * res - dilation;
    vec2 hi = box.zw * res + dilation;
    vec2 c = (lo + hi) * 0.5;
    vec2 h = (hi - lo) * 0.5;
    float sd = sdBox(fc, c, h);
    vec3 stroke = mix(WHITE, RED, uTouch);
    vec3 fill = mix(GREEN, RED, uTouch);
    col += line(abs(sd), strokeWidth + uTouch * 0.6) * stroke;
    float inside = step(sd, 0.0);
    col += inside * feed * fill * (0.45 + uTouch * 0.4);
    col += inside * uTouch * RED * 0.08;
    col += telemetry(fc, vec2(lo.x, hi.y + 4.0 * px), box.xy, slowTick, px) * stroke * 0.8;
  }

  float scan = 0.94 + 0.06 * step(0.5, fract(fc.y / (2.0 * px)));
  col *= scan;

  float invert = step(0.85, snap) * step(0.8, hash11(floor(iTime * 2.0))) * live;
  col = mix(col, 1.0 - col, invert);

  fragColor = vec4(col, 1.0);
}
