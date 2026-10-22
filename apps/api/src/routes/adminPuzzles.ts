/**
 * @module routes/adminPuzzles
 *
 * Endpoints administrativos del CMS para supervisión editorial de puzles:
 *  - GET /api/admin/puzzles: listado de puzles con filtro por estado (DRAFT, SCHEDULED, etc.)
 *  - PATCH /api/admin/puzzles/:id/status: cambio de estado (p. ej. DRAFT -> SCHEDULED)
 *  - PATCH /api/admin/puzzles/:id/clue: edición inline del texto de una pista
 *  - POST /api/admin/puzzles/:id/regenerate: regeneración de un borrador con IA
 *
 * Fuente de verdad: docs/tasks.md §4.2
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, desc, asc } from 'drizzle-orm'
import { z } from 'zod'
import { puzzles } from '@corchetes/db'
import type { ClientPayload } from '@corchetes/core'
import { checkAdminAuth } from './generate'
import {
  memoryGeneratedPuzzles,
  runGeneratePipeline,
  type PipelineResultSuccess,
} from '../services/puzzleCompiler'
import type { ILlmModel } from '../services/puzzleGenerator'

// ─── Esquemas de validación ───────────────────────────────────────────────────

export const listPuzzlesQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'REJECTED']).optional(),
})

export const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'REJECTED']),
})

export const updateClueSchema = z.object({
  nodeId: z.string().min(1, 'nodeId es obligatorio'),
  newClueText: z.string().min(1, 'El texto de la pista no puede estar vacío'),
})

// ─── Plugin de rutas ──────────────────────────────────────────────────────────

export interface AdminPuzzlesOptions {
  injectedModel?: ILlmModel
}

export const adminPuzzlesRoutes: FastifyPluginAsync<AdminPuzzlesOptions> = async (
  fastify,
  options,
) => {
  // Hook de autenticación admin para todas las rutas de /api/admin/puzzles
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/admin/puzzles')) {
      if (!checkAdminAuth(request)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Se requiere token de administración válido para acceder al CMS.',
        })
      }
    }
  })

  // ── 1. GET /api/admin/puzzles ───────────────────────────────────────────────
  fastify.get('/api/admin/puzzles', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listPuzzlesQuerySchema.parse(request.query ?? {})
    const targetStatus = query.status

    const results: Array<{
      id: string
      editionNumber: number
      publishDate: string
      status: string
      source: string
      quoteAuthor: string | null
      quoteWork: string | null
      quoteYear: number | null
      editorialNote: string | null
      maxDepth: number | null
      totalNodes: number | null
      initialLeaves: number | null
      rawMarkup: string
      clientPayload: ClientPayload
    }> = []

    // 1. Intentar consultar desde base de datos
    if (fastify.db) {
      try {
        const queryBuilder = fastify.db.select().from(puzzles)
        const rows = targetStatus
          ? await queryBuilder.where(eq(puzzles.status, targetStatus)).orderBy(asc(puzzles.publishDate))
          : await queryBuilder.orderBy(asc(puzzles.publishDate))

        for (const row of rows) {
          const compiledAst = row.compiledAst as { source?: string } | null
          results.push({
            id: row.id,
            editionNumber: row.editionNumber,
            publishDate: row.publishDate,
            status: row.status ?? 'DRAFT',
            source: compiledAst?.source ?? 'AI',
            quoteAuthor: row.quoteAuthor,
            quoteWork: row.quoteWork,
            quoteYear: row.quoteYear,
            editorialNote: row.editorialNote,
            maxDepth: row.maxDepth,
            totalNodes: row.totalNodes,
            initialLeaves: row.initialLeaves,
            rawMarkup: row.rawMarkup,
            clientPayload: row.clientPayload as ClientPayload,
          })
        }
      } catch (err) {
        fastify.log.error({ err }, 'Error al consultar puzles en base de datos')
      }
    }

    // 2. Si no hay BD o está vacía, incluir los guardados en memoria
    if (results.length === 0) {
      for (const [id, item] of memoryGeneratedPuzzles.entries()) {
        if (!targetStatus || item.status === targetStatus) {
          results.push({
            id,
            editionNumber: item.editionNumber,
            publishDate: item.publishDate,
            status: item.status,
            source: item.source,
            quoteAuthor: item.clientPayload.quoteAuthor,
            quoteWork: item.clientPayload.quoteWork,
            quoteYear: item.clientPayload.quoteYear,
            editorialNote: item.clientPayload.editorialNote,
            maxDepth: item.meta.maxDepth,
            totalNodes: item.meta.totalNodes,
            initialLeaves: item.meta.initialLeaves,
            rawMarkup: item.rawMarkup,
            clientPayload: item.clientPayload,
          })
        }
      }
    }

    return reply.status(200).send(results)
  })

  // ── 2. PATCH /api/admin/puzzles/:id/status ──────────────────────────────────
  fastify.patch(
    '/api/admin/puzzles/:id/status',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const body = updateStatusSchema.parse(request.body ?? {})
      const newStatus = body.status

      let found = false

      // 1. Actualizar en DB
      if (fastify.db) {
        try {
          const result = await fastify.db
            .update(puzzles)
            .set({ status: newStatus })
            .where(eq(puzzles.id, id))
          found = true
        } catch (err) {
          fastify.log.error({ err }, 'Error al actualizar status de puzle en DB')
        }
      }

      // 2. Actualizar en memoria
      const inMemory = memoryGeneratedPuzzles.get(id)
      if (inMemory) {
        inMemory.status = newStatus as 'DRAFT'
        found = true
      }

      if (!found && !inMemory) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `No se encontró el puzle con ID '${id}'.`,
        })
      }

      return reply.status(200).send({
        success: true,
        id,
        status: newStatus,
      })
    },
  )

  // ── 3. PATCH /api/admin/puzzles/:id/clue ────────────────────────────────────
  fastify.patch(
    '/api/admin/puzzles/:id/clue',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params
      const body = updateClueSchema.parse(request.body ?? {})
      const { nodeId, newClueText } = body

      let updatedPayload: ClientPayload | null = null

      // 1. Si existe en memoria
      const inMemory = memoryGeneratedPuzzles.get(id)
      if (inMemory) {
        const node = inMemory.clientPayload.nodes[nodeId]
        if (!node) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `El corchete '${nodeId}' no existe en este puzle.`,
          })
        }
        node.clueText = newClueText
        if (inMemory.compiledAst.nodes[nodeId]) {
          inMemory.compiledAst.nodes[nodeId]!.clueText = newClueText
        }
        updatedPayload = inMemory.clientPayload
      }

      // 2. Si existe en DB
      if (fastify.db) {
        try {
          const rows = await fastify.db.select().from(puzzles).where(eq(puzzles.id, id))
          const row = rows[0]
          if (row) {
            const clientPayload = row.clientPayload as ClientPayload
            if (clientPayload?.nodes[nodeId]) {
              clientPayload.nodes[nodeId]!.clueText = newClueText
              await fastify.db
                .update(puzzles)
                .set({ clientPayload })
                .where(eq(puzzles.id, id))
              updatedPayload = clientPayload
            }
          }
        } catch (err) {
          fastify.log.error({ err }, 'Error al actualizar pista en base de datos')
        }
      }

      if (!updatedPayload) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `No se pudo encontrar el puzle o el nodo especificado.`,
        })
      }

      return reply.status(200).send({
        success: true,
        id,
        nodeId,
        newClueText,
        clientPayload: updatedPayload,
      })
    },
  )

  // ── 4. POST /api/admin/puzzles/:id/regenerate ───────────────────────────────
  fastify.post(
    '/api/admin/puzzles/:id/regenerate',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params

      // Obtener datos del puzle original para reutilizar fecha y edición
      let publishDate = '2026-10-22'
      let editionNumber = 100

      const inMemory = memoryGeneratedPuzzles.get(id)
      if (inMemory) {
        publishDate = inMemory.publishDate
        editionNumber = inMemory.editionNumber
      } else if (fastify.db) {
        const rows = await fastify.db.select().from(puzzles).where(eq(puzzles.id, id))
        if (rows[0]) {
          publishDate = rows[0].publishDate
          editionNumber = rows[0].editionNumber
        }
      }

      const result = await runGeneratePipeline({
        publishDate,
        editionNumber,
        db: fastify.db,
        redis: fastify.redis,
        model: options.injectedModel,
      })

      if (!result.success) {
        return reply.status(422).send({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Error al regenerar el puzle con la IA',
          details: result.errors,
        })
      }

      return reply.status(200).send(result)
    },
  )
}
