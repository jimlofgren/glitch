import type { ShaderError } from '../gl/shaderProgram'
import { element } from './dom'

const overlay = element<HTMLPreElement>('shader-errors')
const problems: string[] = []

export function reportProblem(message: string): void {
  problems.push(message)
  overlay.textContent = problems.join('\n\n')
  overlay.hidden = false
}

export function formatShaderErrors(name: string, errors: ShaderError[]): string {
  const lines = errors.map((e) => (e.line > 0 ? `  line ${e.line}: ${e.message}` : `  ${e.message}`))
  return `${name}\n${lines.join('\n')}`
}
