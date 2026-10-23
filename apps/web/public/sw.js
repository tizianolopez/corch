/**
 * Service Worker oficial de Corchetes — PWA y soporte offline.
 *
 * Estrategias de caché:
 * - Shell y recursos estáticos: Stale-While-Revalidate.
 * - Puzle del día (/api/puzzle/today): Network-First con fallback a caché (offline mid-game).
 * - Navegaciones HTML: Network-First con fallback a la shell '/'.
 */

const CACHE_NAME = 'corchetes-shell-v1'
const DAILY_PUZZLE_CACHE = 'corchetes-daily-v1'

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
]

// ── 1. Instalación: precachear recursos mínimos ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // En caso de que algún recurso falle en build time, continuar
        console.warn('[SW] Error en precache:', err)
      }),
  )
})

// ── 2. Activación: limpiar cachés obsoletas y tomar control inmediato ────────
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, DAILY_PUZZLE_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (!currentCaches.includes(name)) {
              return caches.delete(name)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// ── 3. Interceptación de peticiones (Fetch) ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar peticiones que no sean GET (como POST /api/session/*)
  if (request.method !== 'GET') {
    return
  }

  // Ignorar peticiones a extensiones de Chrome u otros orígenes incompatibles
  if (!url.protocol.startsWith('http')) {
    return
  }

  // ── A. Puzle del día (/api/puzzle/today): Network First con fallback a caché
  if (url.pathname.includes('/api/puzzle/today')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone()
            caches.open(DAILY_PUZZLE_CACHE).then((cache) => {
              cache.put(request, clone)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          // Sin conexión: buscar la última edición diaria guardada en caché
          const cachedResponse = await caches.match(request)
          if (cachedResponse) {
            return cachedResponse
          }

          // Si ni la red ni la caché tienen el payload, intentar buscar cualquier puzle previo
          const dailyCache = await caches.open(DAILY_PUZZLE_CACHE)
          const keys = await dailyCache.keys()
          if (keys.length > 0 && keys[0]) {
            const fallback = await dailyCache.match(keys[0])
            if (fallback) return fallback
          }

          // Respuesta JSON offline de emergencia
          return new Response(
            JSON.stringify({
              error: 'Offline',
              message: 'Sin conexión a la hemeroteca. Conéctate a internet para cargar el puzle de hoy.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }),
    )
    return
  }

  // ── B. Navegación (HTML Pages): Network First con fallback a shell '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        return (await caches.match('/')) || Response.error()
      }),
    )
    return
  }

  // ── C. Recursos estáticos (_next/static, fuentes, svg): Stale-While-Revalidate
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
            }
            return networkResponse
          })
          .catch(() => cachedResponse)

        return cachedResponse || fetchPromise
      }),
    )
    return
  }
})
