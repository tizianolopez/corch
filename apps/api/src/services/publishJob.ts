/**
 * @module publishJob
 *
 * Servicio de publicación automática de puzles programados (SCHEDULED -> PUBLISHED)
 * e invalidación de caché en el CDN de Cloudflare.
 *
 * Diseñado para ser ejecutado a las 00:00 h (hora de Madrid) mediante cron job
 * o bajo demanda a través del endpoint administrativo POST /api/admin/publish-scheduled.
 *
 * Fuente de verdad: docs/tasks.md §4.3
 */

import { eq, and, lte } from 'drizzle-orm'
import { puzzles, type DbClient } from '@corchetes/db'
import type { PipelineResultSuccess } from './puzzleCompiler'

export interface CloudflareConfig {
  zoneId?: string
  apiToken?: string
}

export interface PublishJobOptions {
  /** Fecha de corte en formato YYYY-MM-DD (hora de Madrid) */
  todayDate: string
  /** Cliente de base de datos Drizzle ORM */
  db?: DbClient | null
  /** Almacén en memoria de puzles (para fallback/tests) */
  memoryStore?: Map<string, PipelineResultSuccess>
  /** Configuración de CDN Cloudflare */
  cloudflare?: CloudflareConfig
  /** Función fetch inyectable para pruebas sin llamadas externas */
  fetchFn?: typeof fetch
}

export interface PublishJobResult {
  success: boolean
  publishedCount: number
  publishedIds: string[]
  cacheInvalidated: boolean
  errors: string[]
}

/**
 * Invalida la caché de Cloudflare para las rutas del puzle diario.
 */
export async function purgeCloudflareCache(
  config: CloudflareConfig,
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const { zoneId, apiToken } = config
  if (!zoneId || !apiToken) {
    return false
  }

  const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Purga específica de los endpoints de puzle diario
        files: [
          'https://corchetes.es/api/puzzle/today',
          'https://corchetes.es/puzzle/today',
        ],
      }),
    })

    return res.ok
  } catch {
    return false
  }
}

/**
 * Ejecuta el trabajo de publicación programada:
 *  1. Identifica los puzles con status SCHEDULED cuya publishDate sea menor o igual a hoy.
 *  2. Actualiza su estado a PUBLISHED y asigna publishedAt = new Date().
 *  3. Invalida la caché del CDN de Cloudflare si está configurado.
 */
export async function executePublishJob(
  options: PublishJobOptions,
): Promise<PublishJobResult> {
  const {
    todayDate,
    db,
    memoryStore,
    cloudflare = {},
    fetchFn = fetch,
  } = options

  const publishedIds: string[] = []
  const errors: string[] = []

  // 1. Procesar en base de datos PostgreSQL si está conectada
  if (db) {
    try {
      const scheduledPuzzles = await db
        .select()
        .from(puzzles)
        .where(
          and(
            eq(puzzles.status, 'SCHEDULED'),
            lte(puzzles.publishDate, todayDate),
          ),
        )

      for (const p of scheduledPuzzles) {
        await db
          .update(puzzles)
          .set({
            status: 'PUBLISHED',
            publishedAt: new Date(),
          })
          .where(eq(puzzles.id, p.id))

        publishedIds.push(p.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Error al actualizar puzles en DB: ${msg}`)
    }
  }

  // 2. Procesar en almacén en memoria (para tests o modo sin PostgreSQL)
  if (memoryStore) {
    for (const [id, puzzle] of memoryStore.entries()) {
      if (puzzle.status === 'SCHEDULED' && puzzle.publishDate <= todayDate) {
        puzzle.status = 'PUBLISHED' as unknown as 'DRAFT'
        if (!publishedIds.includes(id)) {
          publishedIds.push(id)
        }
      }
    }
  }

  // 3. Invalidar caché en Cloudflare si se publicó al menos un puzle
  let cacheInvalidated = false
  if (publishedIds.length > 0 && cloudflare.zoneId && cloudflare.apiToken) {
    cacheInvalidated = await purgeCloudflareCache(cloudflare, fetchFn)
  }

  return {
    success: errors.length === 0,
    publishedCount: publishedIds.length,
    publishedIds,
    cacheInvalidated,
    errors,
  }
}
