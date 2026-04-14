const loaded = new Set<string>()

function linkId(family: string) {
  return `gf-${family.replace(/[^a-zA-Z0-9]+/g, '-')}`
}

export function loadGoogleFontFamily(family: string): void {
  const trimmed = family.trim()
  if (!trimmed) return
  if (loaded.has(trimmed)) return

  const id = linkId(trimmed)
  if (document.getElementById(id)) {
    loaded.add(trimmed)
    return
  }

  loaded.add(trimmed)
  const q = encodeURIComponent(trimmed).replace(/%20/g, '+')
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${q}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

export function isGoogleFontLoaded(family: string): boolean {
  return loaded.has(family.trim())
}
