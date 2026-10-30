const CACHE_NAME = 'unseen-ai-shell-v2'
const MODEL_CACHE_NAME = 'unseen-ai-model-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']
// Heavy on-demand assets (ONNX WASM, transformers, 3D, PDF) are excluded from
// the versioned shell cache so they don't evict/lock the app shell. Local-AI
// model/WASM files go in a separate cache that survives shell updates.
const HEAVY_ASSET = /\.(wasm|mjs)$|\/(ort|transformers|WallVisualization3D|jspdf|html2canvas)[^/]*\.js$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME && key !== MODEL_CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html')),
    )
    return
  }

  if (HEAVY_ASSET.test(url.pathname)) {
    // Cache-first in the dedicated model cache; on miss, plain network fetch
    // (server sends immutable headers) without bloating the shell cache.
    event.respondWith(
      caches.open(MODEL_CACHE_NAME).then((cache) => cache.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
      })),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
      return response
    })),
  )
})
