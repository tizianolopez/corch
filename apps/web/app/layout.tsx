import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google'
import { ServiceWorkerRegistration } from '../src/components/ServiceWorkerRegistration'
import { JsonLd } from '../src/components/JsonLd'
import './globals.css'

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Corchetes — El juego de reconstrucción léxica',
  description:
    'El pasatiempo diario que se resuelve de dentro hacia afuera. Reconstruye citas célebres de la literatura en español descifrando pistas jerárquicas anidadas entre corchetes.',
  authors: [{ name: 'Corchetes' }],
  keywords: ['juego de palabras', 'pasatiempo', 'literatura', 'crucigrama', 'corchetes'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://corchetes.es'),
  openGraph: {
    title: 'Corchetes — El juego de reconstrucción léxica',
    description:
      'El pasatiempo diario que se resuelve de dentro hacia afuera. Reconstruye citas célebres de la literatura en español descifrando pistas jerárquicas anidadas entre corchetes.',
    url: 'https://corchetes.es',
    siteName: 'Corchetes',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/api/og/today',
        width: 1200,
        height: 630,
        alt: 'Corchetes — Ficha hemerográfica de la edición diaria',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Corchetes — El juego de reconstrucción léxica',
    description:
      'El pasatiempo diario que se resuelve de dentro hacia afuera. Reconstruye citas célebres de la literatura en español.',
    images: ['/api/og/today'],
  },
  manifest: '/manifest.webmanifest',
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Corchetes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F4EF' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
}

/**
 * Script inline para determinar el tema día/noche según la hora real del reloj
 * (< 20:00 h = día, >= 20:00 h = noche) evitando el parpadeo de hidratación (FOUC).
 */
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('corchetes_theme');
    if (stored === 'day' || stored === 'night') {
      document.documentElement.setAttribute('data-theme', stored);
      return;
    }
    var hour = new Date().getHours();
    var isNight = hour >= 20 || hour < 7;
    document.documentElement.setAttribute('data-theme', isNight ? 'night' : 'day');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'day');
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <JsonLd />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
