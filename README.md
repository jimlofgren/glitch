# Scroll Scenes

Fullscreen scroll-driven audio-visual page. Three songs, each with its own
Shadertoy-compatible fragment shader. Scrolling crossfades audio and visuals.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:5173, press the play button in the bottom-right corner,
then scroll.

## Swapping in your songs

Audio lives in `public/audio/` as `song1.mp3` to `song5.mp3`. Different file
names or formats (wav, m4a, ogg) work too: point `src` at them in
`src/config.ts`. Only the song being played is streamed; once playback has
started, the remaining songs are downloaded one at a time in page order and
swapped in from memory, so scrolling ahead never waits on the network.
A file that fails to load shows a red message at the top of the page.

Band levels are auto-normalized against a slowly decaying running peak, so
quiet or ambient tracks still drive the visuals through the full 0 to 1 range.

## Dropping in a Shadertoy shader

Paste the shader's Image tab code into `src/shaders/sceneN.glsl`. It must
define `void mainImage(out vec4 fragColor, in vec2 fragCoord)`. Available:

- `iResolution`, `iTime`, `iTimeDelta`, `iFrame`, `iFrameRate`, `iMouse`,
  `iDate`, `iSampleRate`, `iChannelResolution[4]`, `iChannelTime[4]`
- `iChannel0`: 512x2 audio texture, row y=0.25 is FFT, row y=0.75 is waveform
- `iChannel1..3`: black 1x1 textures (no multipass yet)
- Extra: `uBass`, `uMid`, `uTreble`, `uBeat` (1 on a detected beat, decays),
  `uBeatCount`, `uScroll`, `uReducedMotion` (0 or 1)

Every frame goes through `src/gl/post.glsl` after the scene (and transition)
render: band tearing, block corruption, RGB split, spectrum bars, glyph noise,
scanlines and grain, all scaled by `uBeat`.

Compile errors show in a red overlay with line numbers relative to your code.

## Mozayk frames

Each song has its own folder of SVG frames under `public/svg/` (`song1`,
`song2`, `song3`), named `mozayk-frame000.svg` upwards. Set the folder and
frame count per song in `src/config.ts`. Frames are rasterized once at load
time (luminance only) into a texture array and exposed to that song's shader as
`uFrames` (a `sampler2DArray`, sample with `texture(uFrames, vec3(uv, layer)).r`)
plus `uFrameCount`.

## Node network (scene 2)

`src/sim/nodeNetwork.ts` runs a small agent system: clusters of nodes that
drift, bounce and get kicked on beats. Shaders receive the clusters' bounding
boxes as `uBoxes[8]` (x0, y0, x1, y1 in 0 to 1 screen space) and `uBoxCount`.
Cluster and node counts live in `network` in `src/config.ts`. Hovering a box
freezes it and sets `uTouch` to 1. `uSnap` is a fast-decaying treble transient
detector, separate from `uBeat`.

## Pointer

Per-song flags in `src/config.ts`: `pointerGlitch` makes the post pass
concentrate its block corruption around the cursor, `pointerHunt` makes the
tracking box steer toward the cursor (hovering inside it freezes it red). The
Mozayk scene always pushes symbols away from the cursor via `uPointer`, which
every shader receives in 0 to 1 screen space, or (-1, -1) when there is none.

## Feedback scenes

A song with `feedback: true` renders into a ping-pong buffer and receives its
own previous frame as `iChannel1` (screen resolution). Scenes 4 (smear) and
5 (scanner) use it. Each song's slider value also reaches its shader as
`uSlider` for kinds the JavaScript side does not handle (`trail`, `fade`).

## Sliders

The short slider scales every glitch source at once (`uGlitchScale`): the post
pass, per-scene tears and flashes, snap displacements, plasma pixelation and the
glitch transition. Each song can also declare a `slider` in `src/config.ts`: `color` blends scene 3
from monochrome to color (`uColor`), `filter` sweeps a resonant lowpass on that
song's audio, `size` scales the tracking box. Defaults are in `sliderDefaults`.

Dev helpers on `window`: `engine` (after pressing play) and `stepFrame()`,
which renders one frame even when the tab is in the background.

## Config

`src/config.ts`:

- `transitionMode`: `'crossfade'`, `'dissolve'` or `'glitch'` (block datamosh)
- `glitch.amount`: strength of the post-process glitch pass at full slider
- `glitch.grain`: film grain level
- `glitch.defaultScale`: starting position of the glitch slider (0 is none, 1 is full)
- `transitionFraction`: how much of each section is used for the transition
- `scrollDamping`: higher is snappier scroll smoothing
- `maxDevicePixelRatio`: DPR cap for performance

## Controls

- Space or the corner button: play/pause
- `m`: mute
- Click and drag: `iMouse`

## Deploy

`vite.config.ts` uses a relative base path, so the built `dist/` folder works
from any subdirectory. `.github/workflows/deploy.yml` builds and publishes to
GitHub Pages on every push to `main`: in the repository settings, set Pages to
"GitHub Actions" as the source once and it takes care of the rest.

`public/` (audio and SVG frames) is copied as-is into `dist/`, so never store
originals in `dist/`; it is wiped on every build.
