import scene1 from './shaders/scene1.glsl?raw'
import scene2 from './shaders/scene2.glsl?raw'
import scene3 from './shaders/scene3.glsl?raw'
import scene4 from './shaders/scene4.glsl?raw'
import scene5 from './shaders/scene5.glsl?raw'

export interface FrameSet {
  dir: string
  count: number
}

export type SliderKind = 'color' | 'filter' | 'size' | 'trail' | 'fade'

export interface SongConfig {
  src: string
  shader: string
  frames: FrameSet
  slider?: SliderKind
  pointerGlitch?: boolean
  pointerHunt?: boolean
  feedback?: boolean
}

export const sliderDefaults: Record<SliderKind, number> = {
  color: 0,
  filter: 0,
  size: 0.5,
  trail: 0.6,
  fade: 0.5,
}

export type TransitionMode = 'crossfade' | 'dissolve' | 'glitch'

const base = import.meta.env.BASE_URL

export const songs: SongConfig[] = [
  { src: `${base}audio/song3.mp3`, shader: scene3, frames: { dir: 'svg/song3', count: 0 }, slider: 'color', pointerGlitch: true },
  { src: `${base}audio/song1.mp3`, shader: scene1, frames: { dir: 'svg/song1', count: 23 }, slider: 'filter' },
  { src: `${base}audio/song2.mp3`, shader: scene2, frames: { dir: 'svg/song2', count: 16 }, slider: 'size', pointerHunt: true },
  { src: `${base}audio/song4.mp3`, shader: scene4, frames: { dir: 'svg/song1', count: 23 }, slider: 'trail', feedback: true },
  { src: `${base}audio/song5.mp3`, shader: scene5, frames: { dir: 'svg/song2', count: 16 }, slider: 'fade', feedback: true },
]

export const transitionMode: TransitionMode = 'glitch'

export const transitionFraction = 0.3

export const scrollDamping = 6

export const maxDevicePixelRatio = 2

export const glitch = {
  amount: 0.35,
  grain: 0.35,
  defaultScale: 0.5,
}

export function frameUrls(set: FrameSet): string[] {
  return Array.from({ length: set.count }, (_, i) => `${base}${set.dir}/mozayk-frame${String(i).padStart(3, '0')}.svg`)
}

export const frameResolution = { width: 1280, height: 720 }

export const network = {
  clusters: 1,
  nodesPerCluster: 8,
}
