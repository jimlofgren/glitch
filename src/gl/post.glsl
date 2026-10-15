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

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float fft(float x) {
  return texture(iChannel1, vec2(x, 0.25)).x;
}

vec3 sampleSplit(vec2 p, float split) {
  return vec3(
    texture(iChannel0, p + vec2(split, 0.0)).r,
    texture(iChannel0, p).g,
    texture(iChannel0, p - vec2(split, 0.0)).b
  );
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float calm = uReducedMotion;
  float amount = uGlitchAmount * uGlitchScale * mix(1.0, 0.3, calm);
  float beat = uBeat * uGlitchScale * mix(1.0, 0.5, calm);
  float seedRate = mix(6.0 + 18.0 * beat, 2.0, calm);
  float seed = floor(iTime * seedRate) + uBeatCount * 13.0;
  float intensity = clamp(amount * (0.06 + beat * 0.9 + uTreble * 0.1), 0.0, 1.5);

  vec2 p = uv;

  float near = 0.0;
  if (uPointerFocus > 0.0 && uPointer.x >= 0.0) {
    vec2 d = (uv - uPointer) * vec2(iResolution.x / iResolution.y, 1.0);
    near = exp(-dot(d, d) * 60.0) * uPointerFocus;
  }
  float focusScale = mix(1.0, 0.15, uPointerFocus);

  float bandCount = mix(12.0, 48.0, hash11(seed + 3.0));
  float band = floor(uv.y * bandCount);
  float bandRand = hash21(vec2(band, seed));
  float bandNear = 0.0;
  if (uPointerFocus > 0.0 && uPointer.x >= 0.0) {
    float dy = (band + 0.5) / bandCount - uPointer.y;
    bandNear = exp(-dy * dy * 120.0) * uPointerFocus;
  }
  float bandOn = step(1.0 - intensity * 0.2 * focusScale - bandNear * 0.25, bandRand);
  float bandShift = (hash21(vec2(band, seed + 7.0)) - 0.5) * 0.25 * (0.4 + beat);
  p.x += bandOn * bandShift;

  vec2 cellCount = vec2(mix(6.0, 24.0, hash11(seed + 11.0)), mix(4.0, 16.0, hash11(seed + 17.0)));
  vec2 cell = floor(p * cellCount);
  float cellRand = hash21(cell + seed * 0.37);
  float corrupt = step(1.0 - intensity * 0.22 * focusScale - near * (0.35 + beat * 0.4), cellRand);
  vec2 blockOffset = (hash22(cell + seed) - 0.5) * 0.3 * corrupt;
  vec2 pq = p + blockOffset;
  float mosaicOn = corrupt * step(0.5, hash21(cell + seed + 5.0));
  vec2 mosaicCount = cellCount * 3.0;
  vec2 pm = mix(pq, (floor(pq * mosaicCount) + 0.5) / mosaicCount, mosaicOn);

  float split = (0.0015 + 0.012 * beat + 0.004 * uTreble) * amount * (1.0 + corrupt * 3.0);
  vec3 col = sampleSplit(pm, split);

  float swap = corrupt * step(0.6, hash21(cell + seed + 9.0));
  col = mix(col, col.gbr * 1.3, swap);
  float darken = corrupt * step(0.85, hash21(cell + seed + 21.0));
  col = mix(col, vec3(0.02), darken);

  float barCount = 180.0;
  float bx = floor(uv.x * barCount);
  float barTick = floor(iTime * 10.0) + uBeatCount;
  float barRand = hash21(vec2(bx, barTick));
  float barOn = step(1.0 - 0.004 - intensity * 0.05, barRand);
  float spectrum = fft(pow(hash21(vec2(bx, barTick + 1.0)), 2.0) * 0.5);
  float barBase = hash21(vec2(bx, seed + 4.0)) * 0.9;
  float barHeight = 0.03 + spectrum * 0.5 * hash21(vec2(bx, seed + 2.0));
  float within = step(barBase, uv.y) * step(uv.y, barBase + barHeight);
  float thin = step(fract(uv.x * barCount), 0.3);
  float bar = barOn * within * thin;
  vec3 barColor = mix(vec3(1.0), vec3(1.0, 0.12, 0.08), step(0.7, hash21(vec2(bx, seed + 6.0))));
  col = mix(col, barColor, bar * 0.9 * min(1.0, amount * 4.0));

  float px = max(2.0, floor(iResolution.y / 240.0));
  vec2 glyphSize = px * vec2(4.0, 6.0);
  vec2 g = fragCoord / glyphSize;
  vec2 gc = floor(g);
  vec2 bit = floor(fract(g) * vec2(4.0, 6.0));
  float rowOn = step(0.99, hash21(vec2(gc.y, floor(seed / 5.0))));
  float colOn = step(0.55, hash21(vec2(gc.x, gc.y + seed)));
  float glyph = hash21(gc + seed);
  float bitOn = step(0.5, hash21(vec2(glyph * 97.0, bit.x + bit.y * 4.0)));
  float inGlyph = step(bit.x, 2.0) * step(bit.y, 4.0);
  float text = rowOn * colOn * bitOn * inGlyph * clamp(intensity * 2.0, 0.0, 1.0);
  col = mix(col, vec3(0.95), text * 0.7);

  float scan = 0.9 + 0.1 * sin(fragCoord.y * 1.6 + iTime * 3.0);
  col *= mix(1.0, scan, amount * 0.8);

  float grain = hash21(fragCoord + fract(iTime * 7.0) * 311.0) - 0.5;
  col += grain * (0.05 + 0.12 * uGrain) * amount;

  col += beat * 0.06 * amount * (1.0 - calm) * vec3(1.0, 0.9, 0.8);

  vec2 v = uv * (1.0 - uv);
  col *= pow(v.x * v.y * 16.0, 0.12);

  fragColor = vec4(col, 1.0);
}
