import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google'
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
      </head>
      <body>{children}</body>
    </html>
  )
}
