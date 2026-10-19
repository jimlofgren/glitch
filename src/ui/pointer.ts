export interface Point {
  x: number
  y: number
}

export class Pointer {
  x = 0
  y = 0
  clickX = 0
  clickY = 0
  down = false
  hover: Point | null = null
  lastMove = 0
  private readonly scale: () => number

  constructor(scale: () => number) {
    this.scale = scale
    window.addEventListener('pointerdown', (e) => {
      this.down = true
      this.setPixel(e)
      this.clickX = this.x
      this.clickY = this.y
    })
    window.addEventListener('pointermove', (e) => {
      this.hover = { x: e.clientX / window.innerWidth, y: 1 - e.clientY / window.innerHeight }
      this.lastMove = performance.now()
      if (this.down) this.setPixel(e)
    })
    window.addEventListener('pointerup', () => {
      this.down = false
    })
    document.addEventListener('pointerout', (e) => {
      if (e.relatedTarget === null) this.hover = null
    })
  }

  private setPixel(e: PointerEvent): void {
    const scale = this.scale()
    this.x = e.clientX * scale
    this.y = (window.innerHeight - e.clientY) * scale
  }
}

export function wander(time: number): Point {
  const x = 0.5 + 0.34 * Math.sin(time * 0.21 + 1.3) * Math.cos(time * 0.067) + 0.08 * Math.sin(time * 0.53)
  const y = 0.5 + 0.3 * Math.sin(time * 0.17 + 0.4) * Math.sin(time * 0.083 + 2.0) + 0.07 * Math.cos(time * 0.47)
  return { x, y }
}
