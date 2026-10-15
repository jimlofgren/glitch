import type { Levels } from '../audio/engine'

interface Cluster {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  boost: number
}

interface Node {
  angle: number
  speed: number
  spread: number
  jitterX: number
  jitterY: number
}

const MARGIN = 0.22
const PADDING = 0.02
const HUNT_SPEED = 0.09

export class NodeNetwork {
  readonly nodes: Float32Array
  readonly boxes: Float32Array
  readonly clusterCount: number
  readonly nodesPerCluster: number
  touch = 0
  sizeScale = 1
  private readonly clusters: Cluster[]
  private readonly agents: Node[]
  private lastBeatCount = 0

  constructor(clusterCount: number, nodesPerCluster: number) {
    this.clusterCount = clusterCount
    this.nodesPerCluster = nodesPerCluster
    this.nodes = new Float32Array(clusterCount * nodesPerCluster * 2)
    this.boxes = new Float32Array(clusterCount * 4)
    this.clusters = Array.from({ length: clusterCount }, () => ({
      x: MARGIN + Math.random() * (1 - 2 * MARGIN),
      y: MARGIN + Math.random() * (1 - 2 * MARGIN),
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      radius: 0.2 + Math.random() * 0.06,
      boost: 0,
    }))
    this.agents = Array.from({ length: clusterCount * nodesPerCluster }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: (0.3 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1),
      spread: 0.6 + Math.random() * 0.6,
      jitterX: 0,
      jitterY: 0,
    }))
  }

  update(
    dt: number,
    levels: Levels,
    beatCount: number,
    aspect: number,
    calm: boolean,
    pointer: { x: number; y: number } | null,
    hunt: boolean,
  ): void {
    const touched = pointer !== null && this.isInsideAnyBox(pointer)
    this.touch += ((touched ? 1 : 0) - this.touch) * (1 - Math.exp(-dt / 0.12))
    const motion = (calm ? 0.35 : 1) * (1 - this.touch)
    const beatHit = beatCount !== this.lastBeatCount
    this.lastBeatCount = beatCount

    this.clusters.forEach((cluster, c) => {
      if (beatHit && !calm && !touched) {
        const angle = Math.random() * Math.PI * 2
        cluster.vx = Math.cos(angle) * 0.07
        cluster.vy = Math.sin(angle) * 0.07
        cluster.boost = 1
      }
      cluster.boost *= Math.exp(-dt / 0.4)
      if (hunt && pointer && !touched) {
        const dx = pointer.x - cluster.x
        const dy = pointer.y - cluster.y
        const distance = Math.hypot(dx, dy) || 1
        const steer = 1 - Math.exp(-dt / 0.6)
        cluster.vx += ((dx / distance) * HUNT_SPEED - cluster.vx) * steer
        cluster.vy += ((dy / distance) * HUNT_SPEED - cluster.vy) * steer
      }
      const speed = motion * (1 + cluster.boost * 3)
      cluster.x += cluster.vx * speed * dt
      cluster.y += cluster.vy * speed * dt
      if (cluster.x < MARGIN || cluster.x > 1 - MARGIN) {
        cluster.vx *= -1
        cluster.x = Math.min(1 - MARGIN, Math.max(MARGIN, cluster.x))
      }
      if (cluster.y < MARGIN || cluster.y > 1 - MARGIN) {
        cluster.vy *= -1
        cluster.y = Math.min(1 - MARGIN, Math.max(MARGIN, cluster.y))
      }

      const radius = cluster.radius * this.sizeScale * (1 + (levels.mid * 0.6 + levels.beat * 0.9) * motion)
      let minX = 1
      let minY = 1
      let maxX = 0
      let maxY = 0
      for (let i = 0; i < this.nodesPerCluster; i++) {
        const index = c * this.nodesPerCluster + i
        const agent = this.agents[index]
        agent.angle += agent.speed * dt * motion * (1 + levels.treble * 1.5)
        const jitter = levels.snap * 0.02 * motion
        agent.jitterX = (Math.random() - 0.5) * jitter
        agent.jitterY = (Math.random() - 0.5) * jitter
        const r = radius * agent.spread
        const x = cluster.x + (Math.cos(agent.angle) * r) / aspect + agent.jitterX
        const y = cluster.y + Math.sin(agent.angle) * r + agent.jitterY
        this.nodes[index * 2] = x
        this.nodes[index * 2 + 1] = y
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
      this.boxes[c * 4] = minX - PADDING / aspect
      this.boxes[c * 4 + 1] = minY - PADDING
      this.boxes[c * 4 + 2] = maxX + PADDING / aspect
      this.boxes[c * 4 + 3] = maxY + PADDING
    })
  }

  private isInsideAnyBox(point: { x: number; y: number }): boolean {
    for (let c = 0; c < this.clusterCount; c++) {
      const x0 = this.boxes[c * 4]
      const y0 = this.boxes[c * 4 + 1]
      const x1 = this.boxes[c * 4 + 2]
      const y1 = this.boxes[c * 4 + 3]
      if (point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1) return true
    }
    return false
  }
}
