export interface LoadOptions {
  invert?: boolean
  text?: { cols: number; rows: number }
}

export class FrameArray {
  readonly texture: WebGLTexture
  readonly width: number
  readonly height: number
  readonly layers: number
  count = 0
  private readonly gl: WebGL2RenderingContext
  private readonly loaded: boolean[]

  constructor(gl: WebGL2RenderingContext, width: number, height: number, layers: number) {
    this.gl = gl
    this.width = width
    this.height = height
    this.layers = layers
    const texture = gl.createTexture()
    if (!texture) throw new Error('Could not create frame array texture')
    this.texture = texture
    this.loaded = new Array<boolean>(layers).fill(false)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture)
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.R8, width, height, Math.max(1, layers))
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  async load(urls: string[], onError: (message: string) => void, options: LoadOptions = {}): Promise<void> {
    await Promise.all(
      urls.slice(0, this.layers).map(async (url, layer) => {
        try {
          const pixels = options.text
            ? await rasterizeText(url, this.width, this.height, options.text.cols, options.text.rows)
            : await rasterize(url, this.width, this.height, options.invert === true)
          this.upload(layer, pixels)
        } catch (error) {
          onError(`Could not load ${url} (${error instanceof Error ? error.message : String(error)})`)
        }
      }),
    )
  }

  private upload(layer: number, pixels: Uint8Array): void {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, this.width, this.height, 1, gl.RED, gl.UNSIGNED_BYTE, pixels)
    this.loaded[layer] = true
    let prefix = 0
    while (prefix < this.loaded.length && this.loaded[prefix]) prefix += 1
    this.count = prefix
  }
}

function createContext(width: number, height: number, background: string): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2d context unavailable')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  return ctx
}

async function rasterize(url: string, width: number, height: number, invert: boolean): Promise<Uint8Array> {
  const image = new Image()
  image.src = url
  await image.decode()
  const ctx = createContext(width, height, invert ? '#fff' : '#000')
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * fit
  const drawHeight = image.naturalHeight * fit
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  return readLuminance(ctx, width, height, invert)
}

async function rasterizeText(url: string, width: number, height: number, cols: number, rows: number): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  const lines = text.replace(/\r/g, '').split('\n').slice(0, rows)
  const ctx = createContext(width, height, '#000')
  const fontSize = 16
  const lineHeight = fontSize * 1.2
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#fff'
  const charWidth = ctx.measureText('M').width
  ctx.scale(width / cols / charWidth, height / rows / lineHeight)
  lines.forEach((line, row) => {
    const clipped = line.slice(0, cols)
    for (let col = 0; col < clipped.length; col++) {
      const ch = clipped[col]
      if (ch !== ' ') ctx.fillText(ch, col * charWidth, row * lineHeight + fontSize * 0.1)
    }
  })
  return readLuminance(ctx, width, height, false)
}

function readLuminance(ctx: CanvasRenderingContext2D, width: number, height: number, invert: boolean): Uint8Array {
  const rgba = ctx.getImageData(0, 0, width, height).data
  const red = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    const sourceRow = y * width
    const targetRow = (height - 1 - y) * width
    for (let x = 0; x < width; x++) {
      const i = (sourceRow + x) * 4
      const luminance = Math.min(255, Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114))
      red[targetRow + x] = invert ? 255 - luminance : luminance
    }
  }
  return red
}
