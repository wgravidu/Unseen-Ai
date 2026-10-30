export function resolveApiBaseUrl(configuredUrl, locationLike) {
  const configured = typeof configuredUrl === 'string' ? configuredUrl.trim() : ''
  if (configured) return configured.replace(/\/+$/, '')
  const hostname = locationLike?.hostname
  if (hostname) {
    const protocol = locationLike.protocol === 'https:' ? 'https:' : 'http:'
    return `${protocol}//${hostname}:8000`
  }
  return 'http://localhost:8000'
}
