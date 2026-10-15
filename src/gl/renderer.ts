export interface Framebuffer {
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
}

export class Renderer {
  readonly gl: WebGL2RenderingContext
  readonly canvas: HTMLCanvasElement
  readonly blackTexture: WebGLTexture
  width = 1
  height = 1
  dpr = 1
  private readonly maxDpr: number
  private readonly vao: WebGLVertexArrayObject
  private readonly framebuffers: Framebuffer[] = []

  constructor(canvas: HTMLCanvasElement, maxDpr: number, onContextLost: () => void) {
    this.canvas = canvas
    this.maxDpr = maxDpr
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      onContextLost()
    })
    canvas.addEventListener('webglcontextrestored', () => window.location.reload())
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    this.gl = gl
    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Could not create VAO')
    this.vao = vao
    gl.bindVertexArray(vao)
    this.blackTexture = createColorTexture(gl)
    this.framebuffers.push(this.createFramebuffer(), this.createFramebuffer(), this.createFramebuffer())
    this.resize()
  }

  resize(): boolean {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    const width = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr))
    if (width === this.width && height === this.height && this.canvas.width === width) return false
    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height
    for (const fbo of this.framebuffers) this.resizeFramebuffer(fbo)
    return true
  }

  framebuffer(index: number): Framebuffer {
    return this.framebuffers[index]
  }

  get currentFramebuffer(): WebGLFramebuffer | null {
    return this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
  }

  bindScreen(): void {
    const gl = this.gl
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
  }

  bindFramebuffer(index: number): void {
    const gl = this.gl
    const fbo = this.framebuffers[index]
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer)
    gl.viewport(0, 0, fbo.width, fbo.height)
  }

  bindTexture(unit: number, texture: WebGLTexture): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
  }

  bindTextureArray(unit: number, texture: WebGLTexture): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture)
  }

  draw(): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private createFramebuffer(): Framebuffer {
    const gl = this.gl
    const texture = createColorTexture(gl)
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Could not create framebuffer')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { framebuffer, texture, width: 1, height: 1 }
  }

  private resizeFramebuffer(fbo: Framebuffer): void {
    const gl = this.gl
    fbo.width = this.width
    fbo.height = this.height
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fbo.width, fbo.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  }
}

export function createColorTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Could not create texture')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  return texture
}
