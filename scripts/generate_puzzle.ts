import 'dotenv/config'
import { generateCascadePuzzle } from '../apps/api/src/services/cascadePuzzleGenerator'
import { validatePuzzleDraft } from '../apps/api/src/services/puzzleValidator'
import type { EphemerisEvent } from '../apps/api/src/services/ephemeris'

async function fetchWikimediaForDate(month: number, day: number): Promise<EphemerisEvent> {
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
  const valid = events.filter((e: any) => typeof e.year === 'number' && e.text && e.text.length > 35)
  const chosen = valid[0] || events[0]
  const page = chosen?.pages?.[0]

  return {
    year: chosen.year,
    text: chosen.text.trim(),
    wikipediaUrl: page?.content_urls?.desktop?.page,
    extract: page?.extract ? page.extract.slice(0, 300) : undefined,
  }
}

async function main() {
  const args = process.argv.slice(2)
  let apiKey = process.env.GEMINI_API_KEY
  let dateStr = new Date().toISOString().slice(0, 10)
  let mode: 'claudators' | 'express' = 'claudators'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key' && args[i + 1]) {
      apiKey = args[i + 1]
      i++
    } else if (args[i] === '--date' && args[i + 1]) {
      dateStr = args[i + 1]
      i++
    } else if (args[i] === '--mode' && args[i + 1]) {
      mode = args[i + 1] === 'express' ? 'express' : 'claudators'
      i++
    }
  }

  if (!apiKey) {
    console.error('\n❌ ERROR: No se encontró GEMINI_API_KEY.')
    console.error('Puedes proporcionarla en el archivo .env o con --key.\n')
    process.exit(1)
  }

  const [year, month, day] = dateStr.split('-').map(Number)
  console.log(`\n📅 Consultando efemérides de Wikimedia para el día ${day}/${month}...`)
  const event = await fetchWikimediaForDate(month, day)

  console.log(`\n📜 Hecho histórico seleccionado:`)
  console.log(`   «Un día como hoy, pero en ${event.year}, ${event.text}»`)

  const targetRoots = mode === 'claudators' ? 10 : 4
  const targetChildren = mode === 'claudators' ? 7 : 3
  const targetGrandchildren = mode === 'claudators' ? 3 : 1
  const expectedTotal = targetRoots + targetChildren + targetGrandchildren

  console.log(`\n🚀 Modo de generación: ${mode.toUpperCase()} (Objetivo: ~${expectedTotal} preguntas)`)
  console.log(`   - Raíces en la cita: ${targetRoots}`)
  console.log(`   - Hijos en pistas: ${targetChildren}`)
  console.log(`   - Nietos: ${targetGrandchildren}`)
  console.log(`\n🤖 Ejecutando motor en cascada con escáner de caracteres continuo...`)

  const startTime = Date.now()

  const draft = await generateCascadePuzzle(event, {
    apiKey,
    modelName: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    targetRoots,
    targetChildren,
    targetGrandchildren,
  })

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)

  // Validar con el validador AST
  const validation = validatePuzzleDraft(draft, { maxNodes: 25 })

  console.log(`\n========================================================================`)
  console.log(`✨ ¡PUZLE GENERADO CON ÉXITO EN ${elapsedSec}s!`)
  console.log(`========================================================================\n`)

  console.log(`📖 1. Frase literaria («originalQuote»):`)
  console.log(`   ${draft.originalQuote}\n`)

  console.log(`🧩 2. Marcado concéntrico final («markup»):`)
  console.log(`   ${draft.markup}\n`)

  console.log(`🔍 3. Desglose de Nodos (${draft.nodes.length} preguntas en total):`)
  draft.nodes.forEach((node) => {
    console.log(`   • [${node.id}] Solución: "${node.solution}" (${node.type})`)
    if (node.reasoning) {
      console.log(`     Razonamiento: ${node.reasoning}`)
    }
  })

  console.log(`\n📊 4. Métricas estructurales del árbol:`)
  if (validation.valid) {
    console.log(`   • Total de nodos: ${validation.totalNodes}`)
    console.log(`   • Profundidad máxima: ${validation.maxDepth} niveles`)
    console.log(`   • Nodos hoja iniciales: ${validation.initialLeaves} (activos al comenzar)`)
    console.log(`   • Validación sintáctica y de concordancia: SÍ ✓ (100% válida)`)
  } else {
    console.log(`   • Errores detectados:`, validation.errors)
  }

  console.log(`\n📝 5. Ficha editorial:`)
  console.log(`   • Autor/Tema: ${draft.quoteAuthor}`)
  console.log(`   • Obra/Contexto: ${draft.quoteWork} (${draft.quoteYear})`)
  console.log(`   • Nota explicativa: ${draft.editorialNote}\n`)
}

main().catch(console.error)
