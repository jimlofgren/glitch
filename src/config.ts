import scene1 from './shaders/scene1.glsl?raw'
import scene2 from './shaders/scene2.glsl?raw'
import scene3 from './shaders/scene3.glsl?raw'
import scene4 from './shaders/scene4.glsl?raw'
import scene5 from './shaders/scene5.glsl?raw'
import { audioUrl } from './assets'

export interface FrameSet {
  set: string
  invert?: boolean
  text?: { cols: number; rows: number }
}

export type SliderKind = 'color' | 'filter' | 'size' | 'trail' | 'zoom'

export interface SongConfig {
  title: string
  src: string
  start?: number
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
  zoom: 0.2,
}

export type TransitionMode = 'crossfade' | 'dissolve' | 'glitch'


export const sky: FrameSet = { set: 'e', text: { cols: 120, rows: 49 } }

export const songs: SongConfig[] = [
  { title: 'THIS_JIM_26_05_11', src: audioUrl('5.mp3'), shader: scene5, frames: sky, slider: 'zoom' },
  { title: 'THIS_JIM_26_08_24', src: audioUrl('1.mp3'), start: 7, shader: scene3, frames: { set: 'a' }, slider: 'color', pointerGlitch: true },
  { title: 'THIS_JIM_26_10_15', src: audioUrl('2.mp3'), shader: scene1, frames: { set: 'b' }, slider: 'filter' },
  { title: 'THIS_JIM_26_07_31', src: audioUrl('3.mp3'), shader: scene2, frames: { set: 'c' }, slider: 'size', pointerHunt: true },
  { title: 'THIS_JIM_26_05_18', src: audioUrl('4.mp3'), start: 16, shader: scene4, frames: { set: 'd' }, slider: 'trail', feedback: true },
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



export const frameResolution = { width: 1280, height: 720 }

export const network = {
  clusters: 1,
  nodesPerCluster: 8,
}
