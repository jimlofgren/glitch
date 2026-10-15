export interface Levels {
  bass: number
  mid: number
  treble: number
  beat: number
  snap: number
}

export interface SongAudio {
  src: string
  element: HTMLAudioElement
  prefetched: boolean
  filter: BiquadFilterNode
  gain: GainNode
  analyser: AnalyserNode
  frequency: Uint8Array<ArrayBuffer>
  waveform: Uint8Array<ArrayBuffer>
  levels: Levels
  peaks: Levels
  targetGain: number
  bassFlux: FluxTracker
  trebleFlux: FluxTracker
  lastBeatTime: number
  lastSnapTime: number
  beatCount: number
}

interface FluxTracker {
  previous: Float32Array
  average: number
}

const FFT_SIZE = 1024
const FILTER_OPEN_HZ = 20000
const FILTER_CLOSED_HZ = 140
const AUDIBLE_THRESHOLD = 0.001
const PREFETCH_DELAY_MS = 1500
const ATTACK = 0.04
const RELEASE = 0.35
const PEAK_DECAY = 6
const PEAK_FLOOR = 0.06
const FLUX_AVERAGE_WINDOW = 1.0
const FLUX_THRESHOLD_RATIO = 1.5
const FLUX_MIN = 0.02
const BEAT_MIN_INTERVAL = 0.3
const BEAT_DECAY = 0.25
const SNAP_THRESHOLD_RATIO = 1.8
const SNAP_MIN = 0.015
const SNAP_MIN_INTERVAL = 0.12
const SNAP_DECAY = 0.08

export class AudioEngine {
  readonly context: AudioContext
  readonly songs: SongAudio[]
  private readonly master: GainNode
  private playing = true
  private muted = false
  readonly onError: (message: string) => void

  constructor(sources: string[], onError: (message: string) => void = () => undefined) {
    this.onError = onError
    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.connect(this.context.destination)
    this.songs = sources.map((src) => this.createSong(src))
  }

  private createSong(src: string): SongAudio {
    const element = new Audio(src)
    element.loop = true
    element.preload = 'metadata'
    element.crossOrigin = 'anonymous'
    element.addEventListener('error', () => {
      const code = element.error?.code ?? 0
      const reason = code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED ? 'not found or unsupported format' : `media error ${code}`
      this.onError(`Could not load ${src} (${reason})`)
    })

    const source = this.context.createMediaElementSource(element)
    const filter = this.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = FILTER_OPEN_HZ
    filter.Q.value = 0.7
    const analyser = this.context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    analyser.smoothingTimeConstant = 0.6
    const gain = this.context.createGain()
    gain.gain.value = 0

    source.connect(filter)
    filter.connect(analyser)
    analyser.connect(gain)
    gain.connect(this.master)

    return {
      src,
      element,
      prefetched: false,
      filter,
      gain,
      analyser,
      frequency: new Uint8Array(analyser.frequencyBinCount),
      waveform: new Uint8Array(analyser.fftSize),
      levels: { bass: 0, mid: 0, treble: 0, beat: 0, snap: 0 },
      peaks: { bass: PEAK_FLOOR, mid: PEAK_FLOOR, treble: PEAK_FLOOR, beat: 0, snap: 0 },
      targetGain: 0,
      bassFlux: { previous: new Float32Array(0), average: 0 },
      trebleFlux: { previous: new Float32Array(0), average: 0 },
      lastBeatTime: 0,
      lastSnapTime: 0,
      beatCount: 0,
    }
  }

  async start(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume()
    window.setTimeout(() => void this.prefetch(), PREFETCH_DELAY_MS)
  }

  private async prefetch(): Promise<void> {
    for (const song of this.songs) {
      if (song.prefetched || song.targetGain > AUDIBLE_THRESHOLD || !song.element.paused) continue
      try {
        const response = await fetch(song.src)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        if (song.targetGain > AUDIBLE_THRESHOLD || !song.element.paused) continue
        song.element.src = URL.createObjectURL(blob)
        song.prefetched = true
      } catch (error) {
        this.onError(`Could not prefetch ${song.src} (${error instanceof Error ? error.message : String(error)})`)
      }
    }
  }

  get isPlaying(): boolean {
    return this.playing
  }

  get isMuted(): boolean {
    return this.muted
  }

  setPlaying(playing: boolean): void {
    this.playing = playing
    this.applyPlayback()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.03)
  }

  setFilter(index: number, amount: number): void {
    const song = this.songs[index]
    if (!song) return
    const frequency = FILTER_OPEN_HZ * Math.pow(FILTER_CLOSED_HZ / FILTER_OPEN_HZ, amount)
    const now = this.context.currentTime
    song.filter.frequency.setTargetAtTime(frequency, now, 0.03)
    song.filter.Q.setTargetAtTime(0.7 + amount * 6, now, 0.03)
  }

  setMix(indexA: number, indexB: number, mix: number): void {
    const gainA = Math.cos(mix * Math.PI * 0.5)
    const gainB = Math.sin(mix * Math.PI * 0.5)
    const now = this.context.currentTime
    this.songs.forEach((song, i) => {
      let target = 0
      if (i === indexA) target += gainA
      if (i === indexB) target += gainB
      target = Math.min(1, target)
      if (target !== song.targetGain) {
        song.targetGain = target
        song.gain.gain.setTargetAtTime(target, now, 0.05)
      }
    })
    this.applyPlayback()
  }

  private applyPlayback(): void {
    for (const song of this.songs) {
      const shouldPlay = this.playing && song.targetGain > AUDIBLE_THRESHOLD
      if (shouldPlay && song.element.paused) {
        song.element.play().catch(() => undefined)
      } else if (!shouldPlay && !song.element.paused) {
        song.element.pause()
      }
    }
  }

  update(dt: number): void {
    const binHz = this.context.sampleRate / FFT_SIZE
    const bassEnd = Math.round(250 / binHz)
    const midEnd = Math.round(4000 / binHz)
    const trebleEnd = Math.round(12000 / binHz)
    for (const song of this.songs) {
      if (song.element.paused) {
        decayLevels(song.levels, dt)
        song.frequency.fill(0)
        song.waveform.fill(128)
        continue
      }
      song.analyser.getByteFrequencyData(song.frequency)
      song.analyser.getByteTimeDomainData(song.waveform)
      const bass = normalize(song.peaks, 'bass', average(song.frequency, 1, bassEnd), dt)
      smooth(song.levels, 'bass', bass, dt)
      this.detectBeat(song, bassEnd, dt)
      this.detectSnap(song, midEnd, trebleEnd, dt)
      smooth(song.levels, 'mid', normalize(song.peaks, 'mid', average(song.frequency, bassEnd, midEnd), dt), dt)
      smooth(song.levels, 'treble', normalize(song.peaks, 'treble', average(song.frequency, midEnd, trebleEnd), dt), dt)
    }
  }

  private detectSnap(song: SongAudio, from: number, to: number, dt: number): void {
    const flux = spectralFlux(song.trebleFlux, song.frequency, from, to)
    const now = this.context.currentTime
    const isOnset =
      flux > song.trebleFlux.average * SNAP_THRESHOLD_RATIO + SNAP_MIN && now - song.lastSnapTime > SNAP_MIN_INTERVAL
    song.trebleFlux.average += (flux - song.trebleFlux.average) * (1 - Math.exp(-dt / FLUX_AVERAGE_WINDOW))
    if (isOnset) {
      song.lastSnapTime = now
      song.levels.snap = 1
    } else {
      song.levels.snap *= Math.exp(-dt / SNAP_DECAY)
    }
  }

  private detectBeat(song: SongAudio, bassEnd: number, dt: number): void {
    const flux = spectralFlux(song.bassFlux, song.frequency, 1, bassEnd)
    const now = this.context.currentTime
    const isOnset = flux > song.bassFlux.average * FLUX_THRESHOLD_RATIO + FLUX_MIN && now - song.lastBeatTime > BEAT_MIN_INTERVAL
    song.bassFlux.average += (flux - song.bassFlux.average) * (1 - Math.exp(-dt / FLUX_AVERAGE_WINDOW))
    if (isOnset) {
      song.lastBeatTime = now
      song.beatCount += 1
      song.levels.beat = 1
    } else {
      song.levels.beat *= Math.exp(-dt / BEAT_DECAY)
    }
  }
}

function spectralFlux(tracker: FluxTracker, frequency: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, frequency.length)
  const count = end - from
  if (tracker.previous.length !== count) tracker.previous = new Float32Array(count)
  let flux = 0
  for (let i = 0; i < count; i++) {
    const value = frequency[from + i]
    flux += Math.max(0, value - tracker.previous[i])
    tracker.previous[i] = value
  }
  return flux / (count * 255)
}

function average(data: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, data.length)
  if (end <= from) return 0
  let sum = 0
  for (let i = from; i < end; i++) sum += data[i]
  return sum / ((end - from) * 255)
}

function normalize(peaks: Levels, key: keyof Levels, value: number, dt: number): number {
  const decayed = peaks[key] - (peaks[key] - PEAK_FLOOR) * (1 - Math.exp(-dt / PEAK_DECAY))
  peaks[key] = Math.max(decayed, value)
  return Math.min(1, value / peaks[key])
}

function smooth(levels: Levels, key: keyof Levels, value: number, dt: number): void {
  const current = levels[key]
  const rate = value > current ? ATTACK : RELEASE
  const k = 1 - Math.exp(-dt / rate)
  levels[key] = current + (value - current) * k
}

function decayLevels(levels: Levels, dt: number): void {
  smooth(levels, 'bass', 0, dt)
  smooth(levels, 'mid', 0, dt)
  smooth(levels, 'treble', 0, dt)
  levels.beat *= Math.exp(-dt / BEAT_DECAY)
  levels.snap *= Math.exp(-dt / SNAP_DECAY)
}
