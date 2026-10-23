/**
 * @module seed
 *
 * Script ejecutable para sembrar los 7 puzles canónicos de la semana de lanzamiento
 * en la base de datos PostgreSQL / Supabase de Corchetes.
 *
 * Uso:
 *   npm run db:seed --workspace=@corchetes/db
 *
 * Fuente de verdad: docs/tasks.md §7.4
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { eq } from 'drizzle-orm'
import { createDb } from './index'
import { puzzles } from './schema/puzzles'
import { LAUNCH_PUZZLES, compileLaunchPuzzle } from './seedData'

import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function runSeed(connectionString?: string) {
  const dbUrl = connectionString || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL

  console.log('--- Iniciando compilación de puzles de la semana de lanzamiento ---')

  const compiledPuzzles = []
  for (const def of LAUNCH_PUZZLES) {
    console.log(`Compilando Edición #${def.editionNumber}: ${def.quoteAuthor} (${def.quoteWork})...`)
    const compiled = await compileLaunchPuzzle(def)
    compiledPuzzles.push(compiled)
  }

  // Guardar siempre una copia compilada offline en JSON para CMS / respaldos
  try {
    const candidateDirs = [
      path.resolve(process.cwd(), 'data'),
      path.resolve(__dirname, '../../../data'),
    ]
    const outDir = candidateDirs.find((d) => fs.existsSync(d))
    if (outDir) {
      const backupPath = path.join(outDir, 'launch_puzzles_seed.json')
      fs.writeFileSync(backupPath, JSON.stringify(compiledPuzzles, null, 2), 'utf-8')
      console.log(`Copia de respaldo offline guardada en: ${backupPath}`)
    }
  } catch (err) {
    console.warn('No se pudo guardar la copia JSON offline:', err)
  }

  if (!dbUrl) {
    console.warn(
      'AVISO: No se encontró la variable DATABASE_URL ni SUPABASE_DB_URL en el entorno.',
    )
    console.warn(
      'Los 7 puzles fueron compilados y validados con éxito en memoria y guardados en JSON.',
    )
    console.warn(
      'Para persistirlos en la base de datos de producción, configura DATABASE_URL en tu .env o Railway.',
    )
    return { success: true, count: compiledPuzzles.length, dbInserted: false }
  }

  console.log(`Conectando a la base de datos para sembrar ${compiledPuzzles.length} puzles...`)
  const db = createDb(dbUrl)

  let insertedCount = 0
  let updatedCount = 0

  for (const puzzleData of compiledPuzzles) {
    const existing = await db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(eq(puzzles.editionNumber, puzzleData.editionNumber))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(puzzles)
        .set({
          publishDate: puzzleData.publishDate,
          rawMarkup: puzzleData.rawMarkup,
          compiledAst: puzzleData.compiledAst,
          clientPayload: puzzleData.clientPayload,
          quoteAuthor: puzzleData.quoteAuthor,
          quoteWork: puzzleData.quoteWork,
          quoteYear: puzzleData.quoteYear,
          editorialNote: puzzleData.editorialNote,
          difficultyScore: puzzleData.difficultyScore,
          maxDepth: puzzleData.maxDepth,
          totalNodes: puzzleData.totalNodes,
          initialLeaves: puzzleData.initialLeaves,
          status: puzzleData.status,
          publishedAt: puzzleData.publishedAt,
        })
        .where(eq(puzzles.editionNumber, puzzleData.editionNumber))
      updatedCount++
      console.log(`  Actualizada Edición #${puzzleData.editionNumber} (${puzzleData.publishDate})`)
    } else {
      await db.insert(puzzles).values(puzzleData)
      insertedCount++
      console.log(`  Insertada Edición #${puzzleData.editionNumber} (${puzzleData.publishDate})`)
    }
  }

  console.log(
    `Sembrado completado: ${insertedCount} insertados, ${updatedCount} actualizados. Total: ${compiledPuzzles.length} puzles.`,
  )

  return { success: true, count: compiledPuzzles.length, dbInserted: true, insertedCount, updatedCount }
}

// Ejecución directa si se invoca desde CLI
if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  runSeed()
    .then(() => {
      console.log('Proceso de seed finalizado exitosamente.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('Error durante la ejecución del seed:', err)
      process.exit(1)
    })
}
