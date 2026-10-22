/**
 * @module routes/generate
 *
 * Endpoints protegidos para el pipeline de generación de puzles con IA:
 *  - POST /api/generate: genera y compila un puzle para una fecha específica (estado DRAFT)
 *  - POST /api/generate/batch: genera y compila puzles en lote para los próximos N días
 *
 * Ambos endpoints requieren autenticación mediante token de administración:
 *  - Cabecera `Authorization: Bearer <ADMIN_JWT_SECRET>` o `x-admin-token: <ADMIN_JWT_SECRET>`
 *
 * Fuente de verdad: docs/tasks.md §3.4
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { config } from '../config'
import { getTodayDateMadrid } from '../utils/time'
import {
  runGeneratePipeline,
  type PipelineResult,
} from '../services/puzzleCompiler'
import type { ILlmModel } from '../services/puzzleGenerator'

// ─── Esquemas de validación ───────────────────────────────────────────────────

export const generateSingleSchema = z.object({
  /** Fecha de publicación esperada (YYYY-MM-DD). Por defecto: hoy */
  publishDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (debe ser YYYY-MM-DD)')
    .optional(),
  /** Número de edición correlativo. Por defecto: auto-calculado */
  editionNumber: z.number().int().positive().optional(),
  /** Índice de la efeméride histórica a seleccionar de la lista */
  eventIndex: z.number().int().nonnegative().default(0),
  /** Salt diario para cifrado */
  dailySalt: z.string().optional(),
})

export const generateBatchSchema = z.object({
  /** Fecha de inicio para la tanda (YYYY-MM-DD). Por defecto: mañana */
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (debe ser YYYY-MM-DD)')
    .optional(),
  /** Número de días a generar (1 a 30). Por defecto: 7 */
  days: z.number().int().min(1).max(30).default(7),
  /** Número de edición inicial */
  startEditionNumber: z.number().int().positive().optional(),
})

// ─── Middleware de autenticación de administración ────────────────────────────

/**
 * Valida la cabecera de autenticación del administrador.
 */
export function checkAdminAuth(request: FastifyRequest): boolean {
  const authHeader = request.headers['authorization']
  const tokenHeader = request.headers['x-admin-token']

  const expectedSecret = config.ADMIN_JWT_SECRET

  if (typeof tokenHeader === 'string' && tokenHeader === expectedSecret) {
    return true
  }

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim()
    if (bearer === expectedSecret) {
      return true
    }
  }

  return false
}

// ─── Plugin de rutas ──────────────────────────────────────────────────────────

export interface GenerateRoutesOptions {
  /** Modelo inyectable para tests */
  injectedModel?: ILlmModel
}

export const generateRoutes: FastifyPluginAsync<GenerateRoutesOptions> = async (
  fastify,
  options,
) => {
  // Hook de autenticación para todas las rutas de /api/generate
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/generate')) {
      if (!checkAdminAuth(request)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Se requiere token de administración válido para generar puzles.',
        })
      }
    }
  })

  // ── 1. POST /api/generate ───────────────────────────────────────────────────
  fastify.post('/api/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = generateSingleSchema.parse(request.body ?? {})
    const publishDate = body.publishDate ?? getTodayDateMadrid()
    const editionNumber = body.editionNumber ?? 100

    const result = await runGeneratePipeline({
      publishDate,
      editionNumber,
      dailySalt: body.dailySalt,
      eventIndex: body.eventIndex,
      db: fastify.db,
      redis: fastify.redis,
      model: options.injectedModel,
    })

    if (!result.success) {
      return reply.status(422).send({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'No se pudo generar un puzle válido para la efeméride seleccionada.',
        details: result.errors,
        attempts: result.attempts,
      })
    }

    return reply.status(201).send(result)
  })

  // ── 2. POST /api/generate/batch ─────────────────────────────────────────────
  fastify.post('/api/generate/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = generateBatchSchema.parse(request.body ?? {})
    const days = body.days

    // Calcular fecha inicial
    const baseDate = body.startDate
      ? new Date(body.startDate)
      : new Date()
    
    // Si no se proporcionó startDate, comenzar a partir de mañana
    if (!body.startDate) {
      baseDate.setDate(baseDate.getDate() + 1)
    }

    const successful: PipelineResult[] = []
    const failed: { date: string; errors: string[] }[] = []

    let currentEdition = body.startEditionNumber ?? 101

    for (let i = 0; i < days; i++) {
      const d = new Date(baseDate)
      d.setDate(baseDate.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]!

      const result = await runGeneratePipeline({
        publishDate: dateStr,
        editionNumber: currentEdition++,
        db: fastify.db,
        redis: fastify.redis,
        model: options.injectedModel,
      })

      if (result.success) {
        successful.push(result)
      } else {
        failed.push({ date: dateStr, errors: result.errors })
      }
    }

    return reply.status(200).send({
      requestedDays: days,
      generatedCount: successful.length,
      failedCount: failed.length,
      successful,
      failed,
    })
  })
}
