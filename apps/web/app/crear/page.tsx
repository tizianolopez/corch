import type { Metadata } from 'next'
import { CrearRetoClient } from './CrearRetoClient'

export const metadata: Metadata = {
  title: 'Creador de Retos Literarios — Corchetes',
  description:
    'Taller de composición y linotipia. Escribe tu propia cita con pistas anidadas entre corchetes y compártela con la comunidad de lectores.',
  openGraph: {
    title: 'Creador de Retos Literarios — Corchetes',
    description:
      'Compón tu propio enigma léxico con corchetes anidados y compártelo con otros lectores.',
    url: 'https://corchetes.es/crear',
    images: ['/api/og/today'],
  },
}

export default function CrearRetoPage() {
  return <CrearRetoClient />
}
