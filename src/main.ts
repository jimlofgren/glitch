import './style.css'
import { inject } from '@vercel/analytics'
import {
  frameResolution,
  glitch,
  maxDevicePixelRatio,
  network,
  scrollDamping,
  sliderDefaults,
  songs,
  transitionFraction,
  transitionMode,
} from './config'
import { AudioEngine, type Levels } from './audio/engine'
import { AudioTexture, AUDIO_TEXTURE_HEIGHT, AUDIO_TEXTURE_WIDTH } from './audio/texture'
import { Renderer } from './gl/renderer'
import { FrameArray } from './gl/frameArray'
import { frameUrls } from './assets'
import { FeedbackBuffer } from './gl/feedback'
import { ShaderProgram } from './gl/shaderProgram'
import { NodeNetwork } from './sim/nodeNetwork'
import { ScrollTracker } from './scroll/scroll'
import { Hud } from './ui/hud'
import { Pointer } from './ui/pointer'
import { element } from './ui/dom'
import { formatShaderErrors, reportProblem } from './ui/problems'
import transitionSource from './gl/transition.glsl?raw'
import postSource from './gl/post.glsl?raw'

interface Scene {
  program: ShaderProgram | null
  frames: FrameArray
  feedback: FeedbackBuffer | null
  audioTexture: AudioTexture
  time: number
  frame: number
}

interface FrameContext {
  dt: number
  scrollPosition: number
  pointerFocus: number
  date: [number, number, number, number]
}

const FRAME_UNIT = 4
const TRANSITION_MODES: Record<typeof transitionMode, number> = { crossfade: 0, dissolve: 1, glitch: 2 }
const SILENT: Levels = { bass: 0, mid: 0, treble: 0, beat: 0, snap: 0 }

const hud = new Hud()
const fallback = element<HTMLElement>('fallback')
const fpsLabel = element<HTMLElement>('fps')
const sectionsRoot = element<HTMLElement>('sections')
for (let i = 0; i < songs.length; i++) {
  const section = document.createElement('section')
  section.className = 'section'
  sectionsRoot.append(section)
}

function showFallback(message: string): never {
  fallback.textContent = message
  fallback.hidden = false
  hud.hide()
  throw new Error(message)
}

let renderer: Renderer
try {
  renderer = new Renderer(element<HTMLCanvasElement>('gl'), maxDevicePixelRatio, () => {
    cancelAnimationFrame(rafId)
    fallback.textContent = 'The graphics context was lost. Reload the page to continue.'
    fallback.hidden = false
  })
} catch {
  showFallback('This page needs WebGL2, which your browser does not seem to support.')
}
const gl = renderer.gl

function compile(name: string, source: string): ShaderProgram | null {
  const result = ShaderProgram.fromShadertoy(gl, source)
  if (result.errors.length) reportProblem(formatShaderErrors(name, result.errors))
  return result.program ?? null
}

const frameSets = new Map<string, FrameArray>()
function frameSet(name: string): FrameArray {
  let set = frameSets.get(name)
  if (!set) {
    set = new FrameArray(gl, frameResolution.width, frameResolution.height, frameUrls(name).length)
    frameSets.set(name, set)
  }
  return set
}

const scenes: Scene[] = songs.map((song, i) => ({
  program: compile(`scene ${i + 1}`, song.shader),
  frames: frameSet(song.frames.set),
  feedback: song.feedback ? new FeedbackBuffer(gl) : null,
  audioTexture: new AudioTexture(gl),
  time: 0,
  frame: 0,
}))
const transition = compile('transition', transitionSource)
const post = compile('post', postSource)

const loaded = new Set<string>()
void songs.reduce(async (previous, song) => {
  await previous
  const urls = frameUrls(song.frames.set)
  if (urls.length === 0 || loaded.has(song.frames.set)) return
  loaded.add(song.frames.set)
  await frameSet(song.frames.set).load(urls, reportProblem, { invert: song.frames.invert, text: song.frames.text })
}, Promise.resolve())

const nodeNetwork = new NodeNetwork(network.clusters, network.nodesPerCluster)
const scroll = new ScrollTracker(songs.length, transitionFraction, scrollDamping)
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const pointer = new Pointer(() => renderer.dpr)
const sliderValues = songs.map((song) => (song.slider ? sliderDefaults[song.slider] : 0))
const audioChannelResolution = new Float32Array([AUDIO_TEXTURE_WIDTH, AUDIO_TEXTURE_HEIGHT, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
const screenChannelResolution = new Float32Array(12)
const channelTime = new Float32Array(4)

let engine: AudioEngine | null = null
let colorAmount = 0
let glitchScale = glitch.defaultScale
let hudIndex = -1
let globalTime = 0
let lastFrameTime = performance.now()
let rafId = 0
let fpsFrames = 0
let fpsElapsed = 0

function applySlider(index: number): void {
  const value = sliderValues[index]
  switch (songs[index].slider) {
    case 'color':
      colorAmount = value
      break
    case 'filter':
      engine?.setFilter(index, value)
      break
    case 'size':
      nodeNetwork.sizeScale = 0.4 + value * 1.2
      break
    default:
      break
  }
}

function setCommonUniforms(program: ShaderProgram, scene: Scene | null, sceneIndex: number, ctx: FrameContext): void {
  const frames = scenes[sceneIndex].frames
  program.set3f('iResolution', renderer.width, renderer.height, 1)
  program.set1f('iTime', scene ? scene.time : globalTime)
  program.set1f('iTimeDelta', ctx.dt)
  program.set1f('iFrameRate', ctx.dt > 0 ? 1 / ctx.dt : 60)
  program.set1i('iFrame', scene ? scene.frame : 0)
  program.set4f(
    'iMouse',
    pointer.x,
    pointer.y,
    pointer.down ? pointer.clickX : -pointer.clickX,
    pointer.down ? pointer.clickY : -pointer.clickY,
  )
  program.set4f('iDate', ...ctx.date)
  program.set1f('iSampleRate', engine?.context.sampleRate ?? 44100)
  program.set1fv('iChannelTime', channelTime)
  for (let i = 0; i < 4; i++) program.set1i(`iChannel${i}`, i)
  program.set1f('uScroll', ctx.scrollPosition)
  program.set1f('uReducedMotion', reducedMotion.matches ? 1 : 0)
  program.set1f('uGlitchAmount', glitch.amount)
  program.set1f('uGlitchScale', glitchScale)
  program.set1f('uGrain', glitch.grain)
  program.set1f('uColor', colorAmount)
  program.set1f('uSlider', sliderValues[sceneIndex])
  program.set1f('uTouch', nodeNetwork.touch)
  program.set2f('uPointer', pointer.hover?.x ?? -1, pointer.hover?.y ?? -1)
  program.set1f('uPointerFocus', ctx.pointerFocus)
  program.set4fv('uBoxes', nodeNetwork.boxes)
  program.set1i('uBoxCount', nodeNetwork.clusterCount)
  renderer.bindTextureArray(FRAME_UNIT, frames.texture)
  program.set1i('uFrames', FRAME_UNIT)
  program.set1f('uFrameCount', frames.count)
}

function setLevelUniforms(program: ShaderProgram, index: number): void {
  const song = engine?.songs[index]
  const levels = song?.levels ?? SILENT
  program.set1f('uBass', levels.bass)
  program.set1f('uMid', levels.mid)
  program.set1f('uTreble', levels.treble)
  program.set1f('uBeat', levels.beat)
  program.set1f('uBeatCount', song?.beatCount ?? 0)
  program.set1f('uSnap', levels.snap)
  program.set1f('uSnapCount', song?.snapCount ?? 0)
}

function bindBlack(from: number): void {
  for (let i = from; i < 4; i++) renderer.bindTexture(i, renderer.blackTexture)
}

function renderScene(index: number, ctx: FrameContext): void {
  const scene = scenes[index]
  const destination = renderer.currentFramebuffer
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  if (!scene.program) return
  scene.time += ctx.dt * (reducedMotion.matches ? 0.5 : 1)
  scene.frame += 1
  const song = engine?.songs[index]
  if (song) scene.audioTexture.update(song.frequency, song.waveform)

  scene.program.use()
  renderer.bindTexture(0, scene.audioTexture.texture)
  if (scene.feedback) {
    scene.feedback.bindNext(renderer.width, renderer.height)
    renderer.bindTexture(1, scene.feedback.previous)
    bindBlack(2)
    screenChannelResolution.set([AUDIO_TEXTURE_WIDTH, AUDIO_TEXTURE_HEIGHT, 1, renderer.width, renderer.height, 1])
    scene.program.set3fv('iChannelResolution', screenChannelResolution)
  } else {
    bindBlack(1)
    scene.program.set3fv('iChannelResolution', audioChannelResolution)
  }
  channelTime.fill(scene.time)
  setCommonUniforms(scene.program, scene, index, ctx)
  setLevelUniforms(scene.program, index)
  renderer.draw()
  if (scene.feedback) scene.feedback.blitTo(destination)
}

function renderTransition(indexA: number, indexB: number, mix: number, ctx: FrameContext): void {
  if (!transition) return
  const activeIndex = mix > 0.5 ? indexB : indexA
  transition.use()
  renderer.bindTexture(0, renderer.framebuffer(0).texture)
  renderer.bindTexture(1, renderer.framebuffer(1).texture)
  bindBlack(2)
  screenChannelResolution.set([renderer.width, renderer.height, 1, renderer.width, renderer.height, 1])
  transition.set3fv('iChannelResolution', screenChannelResolution)
  channelTime.fill(globalTime)
  setCommonUniforms(transition, null, activeIndex, ctx)
  setLevelUniforms(transition, activeIndex)
  transition.set1f('uMix', mix)
  transition.set1i('uMode', TRANSITION_MODES[transitionMode])
  renderer.draw()
}

function renderPost(sourceIndex: number, sceneIndex: number, ctx: FrameContext): void {
  if (!post) return
  const scene = scenes[sceneIndex]
  post.use()
  renderer.bindTexture(0, renderer.framebuffer(sourceIndex).texture)
  renderer.bindTexture(1, scene.audioTexture.texture)
  bindBlack(2)
  screenChannelResolution.set([renderer.width, renderer.height, 1, AUDIO_TEXTURE_WIDTH, AUDIO_TEXTURE_HEIGHT, 1])
  post.set3fv('iChannelResolution', screenChannelResolution)
  channelTime.fill(globalTime)
  setCommonUniforms(post, null, sceneIndex, ctx)
  setLevelUniforms(post, sceneIndex)
  renderer.draw()
}

function updateHud(activeIndex: number, levels: Levels): void {
  if (activeIndex !== hudIndex) {
    hudIndex = activeIndex
    hud.setSlider(songs[activeIndex].slider, sliderValues[activeIndex])
    hud.showTitle(songs[activeIndex].title)
  }
  if (!engine) return
  const audible = engine.isPlaying && !engine.isMuted
  hud.setLevels(audible ? levels.bass : 0, audible ? levels.mid : 0, audible ? levels.treble : 0)
}

function updateFps(dt: number): void {
  if (!import.meta.env.DEV) return
  fpsFrames += 1
  fpsElapsed += dt
  if (fpsElapsed >= 0.5) {
    fpsLabel.textContent = `${Math.round(fpsFrames / fpsElapsed)} fps`
    fpsLabel.hidden = false
    fpsFrames = 0
    fpsElapsed = 0
  }
}

function renderFrame(now: number): void {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000))
  lastFrameTime = now
  globalTime += dt

  renderer.resize()
  const state = scroll.update(dt)
  const activeIndex = state.mix > 0.5 ? state.indexB : state.indexA
  if (engine) {
    engine.setMix(state.indexA, state.indexB, state.mix)
    engine.update(dt)
  }
  const activeSong = engine?.songs[activeIndex]
  const levels = activeSong?.levels ?? SILENT
  nodeNetwork.update(
    dt,
    levels,
    activeSong?.beatCount ?? 0,
    renderer.width / renderer.height,
    reducedMotion.matches,
    pointer.hover,
    songs[activeIndex].pointerHunt === true,
  )

  const date = new Date()
  const ctx: FrameContext = {
    dt,
    scrollPosition: state.position,
    pointerFocus: songs[activeIndex].pointerGlitch ? 1 : 0,
    date: [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000,
    ],
  }

  const mix = state.mix < 0.001 ? 0 : state.mix > 0.999 ? 1 : state.mix
  let sourceIndex = 0
  if (mix === 0 || mix === 1 || !transition) {
    renderer.bindFramebuffer(0)
    renderScene(activeIndex, ctx)
  } else {
    renderer.bindFramebuffer(0)
    renderScene(state.indexA, ctx)
    renderer.bindFramebuffer(1)
    renderScene(state.indexB, ctx)
    renderer.bindFramebuffer(2)
    renderTransition(state.indexA, state.indexB, mix, ctx)
    sourceIndex = 2
  }
  renderer.bindScreen()
  renderPost(sourceIndex, activeIndex, ctx)

  updateHud(activeIndex, levels)
  updateFps(dt)
}

function frame(now: number): void {
  renderFrame(now)
  rafId = requestAnimationFrame(frame)
}

function startLoop(): void {
  cancelAnimationFrame(rafId)
  lastFrameTime = performance.now()
  rafId = requestAnimationFrame(frame)
}

async function togglePlayback(): Promise<void> {
  if (!engine) {
    engine = new AudioEngine(songs.map((song) => song.src), reportProblem)
    if (import.meta.env.DEV) Object.assign(window, { engine })
    hud.setIdle(false)
    songs.forEach((_, i) => applySlider(i))
    await engine.start()
  } else {
    engine.setPlaying(!engine.isPlaying)
  }
  hud.setPlaying(engine.isPlaying)
}

hud.setGlitch(glitchScale)
hud.onGlitch = (value) => {
  glitchScale = value
}
hud.onPlay = () => void togglePlayback()
hud.onSlider = (value) => {
  if (hudIndex < 0) return
  sliderValues[hudIndex] = value
  applySlider(hudIndex)
}

window.addEventListener('keydown', (e) => {
  if (hud.sliderFocused) return
  if (e.code === 'Space') {
    e.preventDefault()
    void togglePlayback()
  } else if (e.key === 'm' && engine) {
    engine.setMuted(!engine.isMuted)
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId)
  } else {
    startLoop()
  }
})

if (import.meta.env.DEV) Object.assign(window, { stepFrame: () => renderFrame(performance.now()) })

if (import.meta.env.PROD) inject()

startLoop()
