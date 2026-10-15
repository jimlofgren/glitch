import { readdirSync, renameSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const root = new URL('../src/assets/frames/', import.meta.url).pathname
for (const set of readdirSync(root)) {
  const dir = join(root, set)
  if (!statSync(dir).isDirectory()) continue
  const files = readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  files.forEach((name, index) => {
    const target = `${String(index).padStart(3, '0')}${extname(name).toLowerCase()}`
    if (name !== target) renameSync(join(dir, name), join(dir, target))
  })
  console.log(`${set}: ${files.length} files`)
}
