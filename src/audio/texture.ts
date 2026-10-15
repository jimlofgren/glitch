export const AUDIO_TEXTURE_WIDTH = 512
export const AUDIO_TEXTURE_HEIGHT = 2

export class AudioTexture {
  readonly texture: WebGLTexture
  private readonly gl: WebGL2RenderingContext
  private readonly data = new Uint8Array(AUDIO_TEXTURE_WIDTH * AUDIO_TEXTURE_HEIGHT)

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Could not create audio texture')
    this.texture = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.data.fill(0, 0, AUDIO_TEXTURE_WIDTH)
    this.data.fill(128, AUDIO_TEXTURE_WIDTH)
    this.upload()
  }

  update(frequency: Uint8Array, waveform: Uint8Array): void {
    copyResampled(frequency, this.data, 0)
    copyResampled(waveform, this.data, AUDIO_TEXTURE_WIDTH)
    this.upload()
  }

  private upload(): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      AUDIO_TEXTURE_WIDTH,
      AUDIO_TEXTURE_HEIGHT,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      this.data,
    )
  }
}

function copyResampled(source: Uint8Array, target: Uint8Array, offset: number): void {
  if (source.length === AUDIO_TEXTURE_WIDTH) {
    target.set(source, offset)
    return
  }
  const step = source.length / AUDIO_TEXTURE_WIDTH
  for (let i = 0; i < AUDIO_TEXTURE_WIDTH; i++) {
    target[offset + i] = source[Math.floor(i * step)]
  }
}
