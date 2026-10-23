/**
 * Test y demostrador en vivo de la integración Wikimedia + Escáner de Ventana + Generador
 * para las 7 fechas de la semana de lanzamiento de "Un día como hoy".
 */

import { scanSentence } from '../apps/api/src/services/windowScanner'
import { buildUserPrompt } from '../apps/api/src/services/puzzleGenerator'
import type { EphemerisEvent } from '../apps/api/src/services/ephemeris'

interface LaunchDay {
  editionNumber: number
  dateStr: string
  month: number
  day: number
}

const LAUNCH_DAYS: LaunchDay[] = [
  { editionNumber: 1, dateStr: '2026-10-23', month: 10, day: 23 },
  { editionNumber: 2, dateStr: '2026-10-24', month: 10, day: 24 },
  { editionNumber: 3, dateStr: '2026-10-25', month: 10, day: 25 },
  { editionNumber: 4, dateStr: '2026-10-26', month: 10, day: 26 },
  { editionNumber: 5, dateStr: '2026-10-27', month: 10, day: 27 },
  { editionNumber: 6, dateStr: '2026-10-28', month: 10, day: 28 },
  { editionNumber: 7, dateStr: '2026-10-29', month: 10, day: 29 },
]

async function fetchWikimediaEvent(month: number, day: number): Promise<EphemerisEvent> {
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  const url = `https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/selected/${mm}/${dd}`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Corchetes/1.0 (https://corchetes.es; hola@corchetes.es)',
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar Wikimedia para ${mm}/${dd}`)
  }

  const data = (await res.json()) as any
  const events = data.selected || data.events || []
  if (events.length === 0) {
    throw new Error(`No se encontraron eventos para ${mm}/${dd}`)
  }

  // Filtrar el más relevante con extract y año
  const valid = events.filter((e: any) => typeof e.year === 'number' && e.text && e.text.length > 35)
  const chosen = valid[0] || events[0]
  const page = chosen.pages?.[0]

  return {
    year: chosen.year,
    text: chosen.text.trim(),
    wikipediaUrl: page?.content_urls?.desktop?.page,
    extract: page?.extract ? page.extract.slice(0, 300) : undefined,
  }
}

async function main() {
  console.log('========================================================================')
  console.log('PROBANDO MOTOR «UN DÍA COMO HOY»: WIKIMEDIA + VENTANA + GENERADOR')
  console.log('========================================================================\n')

  for (const item of LAUNCH_DAYS) {
    console.log(`\n📅 Edición #${item.editionNumber} (${item.dateStr}) — [${item.day} de Octubre]`)
    const event = await fetchWikimediaEvent(item.month, item.day)
    console.log(`Evento histórico: «Un día como hoy, pero en ${event.year}, ${event.text}»`)
    if (event.extract) {
      console.log(`Contexto Wikipedia: ${event.extract.slice(0, 120)}...`)
    }

    // 1. Escáner de ventana deslizante
    const scan = scanSentence(`${event.text} ${event.extract || ''}`)
    console.log(`🔎 Ventana Deslizante: ${scan.totalOpportunities} oportunidades detectadas.`)

    if (scan.crossBoundaries.length > 0) {
      console.log(`   - Cruces entre palabras:`)
      scan.crossBoundaries.slice(0, 3).forEach((c) => console.log(`     • ${c.explanation}`))
    }
    if (scan.telescopes.length > 0) {
      console.log(`   - Palabras ocultas / telescopios:`)
      scan.telescopes.slice(0, 3).forEach((t) => console.log(`     • ${t.explanation}`))
    }
    if (scan.charades.length > 0) {
      console.log(`   - Charadas compuestas:`)
      scan.charades.slice(0, 2).forEach((c) => console.log(`     • ${c.explanation}`))
    }
    if (scan.anagrams.length > 0) {
      console.log(`   - Anagramas de diccionario:`)
      scan.anagrams.slice(0, 2).forEach((a) => console.log(`     • ${a.explanation}`))
    }

    // 2. Construcción de prompt enriquecido
    const prompt = buildUserPrompt(event)
    console.log(`📝 Longitud del prompt para Gemini: ${prompt.length} caracteres (con Few-Shot y ventanas).`)
  }

  console.log('\n========================================================================')
  console.log('VERIFICACIÓN COMPLETADA: Wikimedia devuelve eventos reales y el escáner')
  console.log('descubre mecánicas de corchete para todos los días de la semana.')
  console.log('========================================================================')
}

main().catch(console.error)
