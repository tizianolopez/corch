import type { MetadataRoute } from 'next'

/**
 * Genera el archivo robots.txt con directivas para rastreadores web.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://corchetes.es'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/auth/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
