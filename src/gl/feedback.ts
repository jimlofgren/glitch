import { createColorTexture, type Framebuffer } from './renderer'

export class FeedbackBuffer {
  private readonly gl: WebGL2RenderingContext
  private readonly targets: Framebuffer[]
  private current = 0
  private width = 0
  private height = 0

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.targets = [this.createTarget(), this.createTarget()]
  }

  get previous(): WebGLTexture {
    return this.targets[1 - this.current].texture
  }

  bindNext(width: number, height: number): void {
    const gl = this.gl
    if (width !== this.width || height !== this.height) this.resize(width, height)
    const target = this.targets[this.current]
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
    gl.viewport(0, 0, width, height)
  }

  blitTo(destination: WebGLFramebuffer | null): void {
    const gl = this.gl
    const source = this.targets[this.current]
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source.framebuffer)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, destination)
    gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination)
    this.current = 1 - this.current
  }

  private resize(width: number, height: number): void {
    const gl = this.gl
    this.width = width
    this.height = height
    for (const target of this.targets) {
      target.width = width
      target.height = height
      gl.bindTexture(gl.TEXTURE_2D, target.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }

  private createTarget(): Framebuffer {
    const gl = this.gl
    const texture = createColorTexture(gl)
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Could not create feedback framebuffer')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { framebuffer, texture, width: 1, height: 1 }
  }
}
