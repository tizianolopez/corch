import 'dotenv/config'
import { generatePuzzleFromEvent } from '../apps/api/src/services/puzzleGenerator'
import type { EphemerisEvent } from '../apps/api/src/services/ephemeris'

async function runLiveGeneration() {
  console.log('--- INICIANDO GENERACIÓN REAL CON GEMINI Y VENTANA DESLIZANTE ---')

  const event: EphemerisEvent = {
    year: 1940,
    text: 'Nace en Brasil Edson Arantes do Nascimento, conocido como Pelé, considerado uno de los mejores futbolistas de todos los tiempos.',
    extract: 'Edson Arantes do Nascimento, más conocido como Pelé, fue un futbolista brasileño que jugó como delantero. Es reconocido mundialmente como uno de los mejores jugadores de la historia tras conquistar tres Copas Mundiales de la FIFA.',
  }

  console.log('Evento de efemérides (Hoy):', event.text)
  console.log('Llamando a Gemini con modelo gemini-3.5-flash-lite...')

  const result = await generatePuzzleFromEvent(event, {
    apiKey: process.env.GEMINI_API_KEY,
    modelName: 'gemini-3.5-flash-lite',
  })

  if (result.success) {
    console.log('\n¡PUZLE GENERADO CON ÉXITO POR GEMINI!')
    console.log('Intentos requeridos:', result.attempts)
    console.log('\n--- Cita original: ---')
    console.log(result.draft.originalQuote)
    console.log('\n--- Markup con corchetes anidados: ---')
    console.log(result.draft.markup)
    console.log('\n--- Nodos y Soluciones: ---')
    result.draft.nodes.forEach((n) => {
      console.log(`  [${n.id}] -> Solución: "${n.solution}" (${n.type}) | Razón: ${n.reasoning || 'N/A'}`)
    })
    console.log('\n--- Métricas del Árbol: ---')
    console.log('  Total de nodos:', result.validation.totalNodes)
    console.log('  Profundidad máxima:', result.validation.maxDepth)
    console.log('  Nodos hoja iniciales:', result.validation.initialLeaves)
  } else {
    console.error('\nError en la generación:', result.errors)
    if (result.lastRawResponse) {
      console.log('\n--- Respuesta cruda de Gemini: ---')
      console.log(result.lastRawResponse)
    }
  }
}

runLiveGeneration().catch(console.error)
