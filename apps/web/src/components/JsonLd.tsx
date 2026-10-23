import React, { type ReactElement } from 'react'

/**
 * Marcado estructurado Schema.org en formato JSON-LD.
 * Define la aplicación como WebApplication y Game para mejorar el SEO y visibilidad en buscadores.
 */
export function JsonLd(): ReactElement {
  const schemaData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': 'https://corchetes.es/#webapp',
        name: 'Corchetes',
        url: 'https://corchetes.es',
        description:
          'El pasatiempo diario que se resuelve de dentro hacia afuera. Reconstruye citas célebres de la literatura en español descifrando pistas jerárquicas anidadas entre corchetes.',
        applicationCategory: 'GameApplication',
        genre: ['Juego de palabras', 'Pasatiempo', 'Literatura', 'Puzle léxico'],
        inLanguage: 'es',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
        },
      },
      {
        '@type': 'WebSite',
        '@id': 'https://corchetes.es/#website',
        url: 'https://corchetes.es',
        name: 'Corchetes — El juego de reconstrucción léxica',
        inLanguage: 'es',
        publisher: {
          '@type': 'Organization',
          name: 'Corchetes',
          url: 'https://corchetes.es',
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
    />
  )
}
