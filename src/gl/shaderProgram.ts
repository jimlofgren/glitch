export const VERTEX_SOURCE = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

export const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision mediump sampler2D;
precision mediump sampler2DArray;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uScroll;
uniform float uReducedMotion;
uniform float uBeat;
uniform float uBeatCount;
uniform float uGlitchAmount;
uniform float uGlitchScale;
uniform float uGrain;
uniform float uMix;
uniform int uMode;
uniform float uSnap;
uniform float uSnapCount;
uniform float uTouch;
uniform float uColor;
uniform float uSlider;
uniform vec2 uPointer;
uniform float uPointerFocus;
uniform sampler2DArray uFrames;
uniform float uFrameCount;
uniform vec4 uBoxes[8];
uniform int uBoxCount;
out vec4 shadertoy_out_color;
`

const FOOTER = `
void main() {
  shadertoy_out_color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(shadertoy_out_color, gl_FragCoord.xy);
}
`

const HEADER_LINES = HEADER.split('\n').length - 1

export interface ShaderError {
  line: number
  message: string
}

export class ShaderProgram {
  readonly program: WebGLProgram
  private readonly gl: WebGL2RenderingContext
  private readonly locations = new Map<string, WebGLUniformLocation | null>()

  private constructor(gl: WebGL2RenderingContext, program: WebGLProgram) {
    this.gl = gl
    this.program = program
  }

  static fromShadertoy(
    gl: WebGL2RenderingContext,
    source: string,
  ): { program?: ShaderProgram; errors: ShaderError[] } {
    const fragmentSource = HEADER + source + FOOTER
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertex.shader || !fragment.shader) {
      return { errors: [...vertex.errors, ...fragment.errors] }
    }
    const program = gl.createProgram()
    if (!program) return { errors: [{ line: 0, message: 'createProgram failed' }] }
    gl.attachShader(program, vertex.shader)
    gl.attachShader(program, fragment.shader)
    gl.linkProgram(program)
    gl.deleteShader(vertex.shader)
    gl.deleteShader(fragment.shader)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) ?? 'link failed'
      gl.deleteProgram(program)
      return { errors: [{ line: 0, message }] }
    }
    return { program: new ShaderProgram(gl, program), errors: [] }
  }

  use(): void {
    this.gl.useProgram(this.program)
  }

  location(name: string): WebGLUniformLocation | null {
    let loc = this.locations.get(name)
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name)
      this.locations.set(name, loc)
    }
    return loc
  }

  set1f(name: string, x: number): void {
    this.gl.uniform1f(this.location(name), x)
  }

  set1i(name: string, x: number): void {
    this.gl.uniform1i(this.location(name), x)
  }

  set2f(name: string, x: number, y: number): void {
    this.gl.uniform2f(this.location(name), x, y)
  }

  set3f(name: string, x: number, y: number, z: number): void {
    this.gl.uniform3f(this.location(name), x, y, z)
  }

  set4f(name: string, x: number, y: number, z: number, w: number): void {
    this.gl.uniform4f(this.location(name), x, y, z, w)
  }

  set3fv(name: string, values: Float32Array): void {
    this.gl.uniform3fv(this.location(name), values)
  }

  set1fv(name: string, values: Float32Array): void {
    this.gl.uniform1fv(this.location(name), values)
  }

  set4fv(name: string, values: Float32Array): void {
    this.gl.uniform4fv(this.location(name), values)
  }

  dispose(): void {
    this.gl.deleteProgram(this.program)
  }
}

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): { shader?: WebGLShader; errors: ShaderError[] } {
  const shader = gl.createShader(type)
  if (!shader) return { errors: [{ line: 0, message: 'createShader failed' }] }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return { shader, errors: [] }
  const log = gl.getShaderInfoLog(shader) ?? ''
  gl.deleteShader(shader)
  const offset = type === gl.FRAGMENT_SHADER ? HEADER_LINES : 0
  return { errors: parseErrors(log, offset) }
}

function parseErrors(log: string, offset: number): ShaderError[] {
  const errors: ShaderError[] = []
  for (const line of log.split('\n')) {
    const match = /^ERROR:\s*\d+:(\d+):\s*(.*)$/.exec(line.trim())
    if (match) {
      errors.push({ line: Number(match[1]) - offset, message: match[2] })
    } else if (line.trim()) {
      errors.push({ line: 0, message: line.trim() })
    }
  }
  return errors
}
