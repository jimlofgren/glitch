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
