import type { MetadataRoute } from 'next'

/**
 * Manifiesto oficial PWA de Corchetes conforme a la especificación W3C Web App Manifest.
 * Proporciona instalación standalone en navegadores móviles y escritorio.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Corchetes — El juego de reconstrucción léxica',
    short_name: 'Corchetes',
    description:
      'El pasatiempo diario que se resuelve de dentro hacia afuera. Reconstruye citas célebres de la literatura en español descifrando pistas jerárquicas anidadas entre corchetes.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F4EF',
    theme_color: '#F7F4EF',
    lang: 'es',
    orientation: 'portrait',
    scope: '/',
    categories: ['games', 'education', 'news'],
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
