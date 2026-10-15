import type { SliderKind } from '../config'
import { element } from './dom'

const BAR_HEIGHT = 56

export class Hud {
  onSlider: (value: number) => void = () => undefined
  onGlitch: (value: number) => void = () => undefined
  onPlay: () => void = () => undefined
  private readonly root = element<HTMLElement>('hud')
  private readonly slider = element<HTMLInputElement>('slider')
  private readonly glitchSlider = element<HTMLInputElement>('glitch')
  private readonly bars = Array.from(element<HTMLElement>('levels').querySelectorAll('i')) as HTMLElement[]
  private readonly playButton = element<HTMLButtonElement>('play')
  private readonly playIcon = element<HTMLElement>('play-icon')
  private readonly pauseIcon = element<HTMLElement>('pause-icon')
  private readonly title = element<HTMLElement>('title')

  constructor() {
    void this.fitTitle()
    this.slider.addEventListener('input', () => this.onSlider(Number(this.slider.value)))
    this.glitchSlider.addEventListener('input', () => this.onGlitch(Number(this.glitchSlider.value)))
    this.playButton.addEventListener('click', () => {
      this.playButton.blur()
      this.onPlay()
    })
  }

  get sliderFocused(): boolean {
    return document.activeElement === this.slider || document.activeElement === this.glitchSlider
  }

  setGlitch(value: number): void {
    this.glitchSlider.value = String(value)
  }

  hide(): void {
    this.root.hidden = true
  }

  setIdle(idle: boolean): void {
    this.root.classList.toggle('idle', idle)
  }

  setPlaying(playing: boolean): void {
    this.playIcon.toggleAttribute('hidden', playing)
    this.pauseIcon.toggleAttribute('hidden', !playing)
    this.playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play')
  }

  setLevels(bass: number, mid: number, treble: number): void {
    this.setBar(0, bass)
    this.setBar(1, mid)
    this.setBar(2, treble)
  }

  private async fitTitle(): Promise<void> {
    await document.fonts.ready
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    const family = getComputedStyle(this.title).fontFamily
    const probe = 100
    ctx.font = `${probe}px ${family}`
    const metrics = ctx.measureText('H')
    if (!metrics.actualBoundingBoxAscent) return
    const fontSize = (BAR_HEIGHT * probe) / metrics.actualBoundingBoxAscent
    const scale = fontSize / probe
    const descent = metrics.fontBoundingBoxDescent * scale
    const ascent = metrics.fontBoundingBoxAscent * scale
    const baselineFromBottom = (fontSize - ascent - descent) / 2 + descent
    this.title.style.fontSize = `${fontSize.toFixed(2)}px`
    this.title.style.transform = `translateY(${baselineFromBottom.toFixed(2)}px)`
  }

  showTitle(text: string): void {
    this.title.textContent = text
    this.title.classList.add('show')
  }

  setSlider(kind: SliderKind | undefined, value: number): void {
    this.slider.value = String(value)
    this.slider.classList.toggle('inactive', !kind)
    this.slider.setAttribute('aria-label', kind ?? 'Slider')
  }

  private setBar(index: number, value: number): void {
    this.bars[index].style.transform = `scaleY(${(0.1 + value * 0.9).toFixed(3)})`
  }
}
