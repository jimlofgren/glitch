const audio = import.meta.glob('./assets/audio/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const frames = import.meta.glob('./assets/frames/*/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export function audioUrl(file: string): string {
  const url = audio[`./assets/audio/${file}`]
  if (!url) throw new Error(`Unknown audio file ${file}`)
  return url
}

export function frameUrls(set: string): string[] {
  const prefix = `./assets/frames/${set}/`
  return Object.keys(frames)
    .filter((key) => key.startsWith(prefix))
    .sort()
    .map((key) => frames[key])
}
