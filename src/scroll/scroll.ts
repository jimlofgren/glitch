export interface ScrollState {
  indexA: number
  indexB: number
  mix: number
  position: number
}

export class ScrollTracker {
  private position = 0
  private initialized = false
  private readonly sectionCount: number
  private readonly transitionFraction: number
  private readonly damping: number

  constructor(sectionCount: number, transitionFraction: number, damping: number) {
    this.sectionCount = sectionCount
    this.transitionFraction = transitionFraction
    this.damping = damping
  }

  private target(): number {
    const sectionHeight = document.documentElement.scrollHeight / this.sectionCount
    return sectionHeight > 0 ? window.scrollY / sectionHeight : 0
  }

  update(dt: number): ScrollState {
    const target = this.target()
    if (!this.initialized) {
      this.position = target
      this.initialized = true
    } else {
      this.position += (target - this.position) * (1 - Math.exp(-this.damping * dt))
    }
    const last = this.sectionCount - 1
    const indexA = Math.min(last, Math.max(0, Math.floor(this.position)))
    const indexB = Math.min(last, indexA + 1)
    const fraction = this.position - indexA
    const start = 1 - this.transitionFraction
    const mix = indexA === indexB ? 0 : smoothstep(start, 1, fraction)
    return { indexA, indexB, mix, position: this.position }
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
