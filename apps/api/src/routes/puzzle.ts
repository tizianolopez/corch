import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { puzzles } from '@corchetes/db'
import type { ClientPayload, ClientClueNode } from '@corchetes/core'
import { getTodayDateMadrid, getSecondsUntilMidnightMadrid } from '../utils/time'

/**
 * Puzle de demostración utilizado como fallback para desarrollo local y tests
 * cuando la base de datos PostgreSQL no contiene una edición publicada para hoy.
 */
function getFallbackDailyPayload(today: string): ClientPayload {
  return {
    puzzleId: `corchetes-daily-${today}`,
    editionNumber: 1,
    publishDate: today,
    rootTemplate: '«En un lugar de la {{n1}} de cuyo nombre no quiero acordarme...»',
    dailySalt: `salt-${today}`,
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'región histórica española donde cabalgaba el {{n2}}',
        children: ['n2'],
        parent: null,
        type: 'definition',
        solutionHash: 'hash_n1_mancha',
        solutionCipher: 'Mancha',
      },
      n2: {
        id: 'n2',
        clueText: 'hidalgo que desafió a los {{n3}}',
        children: ['n3'],
        parent: 'n1',
        type: 'definition',
        solutionHash: 'hash_n2_quijote',
        solutionCipher: 'Quijote',
      },
      n3: {
        id: 'n3',
        clueText: 'gigantes con aspas de viento',
        children: [],
        parent: 'n2',
        type: 'definition',
        solutionHash: 'hash_n3_molinos',
        solutionCipher: 'molinos',
      },
    },
    quoteAuthor: 'Miguel de Cervantes',
    quoteWork: 'Don Quijote de la Mancha',
    quoteYear: 1605,
    editorialNote:
      'Primera frase de la obra cumbre de la literatura en español. ' +
      'El enigma inicial rinde homenaje a Don Quijote y su singular geografía.',
  }
}

/**
 * Filtra y sanitiza estrictamente el payload asegurando que NUNCA contenga
 * campos de solución en texto plano ni metadatos internos del CMS o base de datos.
 */
export function sanitizeClientPayload(payload: ClientPayload): ClientPayload {
  const sanitizedNodes: Record<string, ClientClueNode> = {}

  for (const [id, node] of Object.entries(payload.nodes)) {
    sanitizedNodes[id] = {
      id: node.id,
      clueText: node.clueText,
      children: [...node.children],
      parent: node.parent,
      type: node.type,
      solutionHash: node.solutionHash,
      solutionCipher: node.solutionCipher,
    }
  }

  return {
    puzzleId: payload.puzzleId,
    editionNumber: payload.editionNumber,
    publishDate: payload.publishDate,
    rootTemplate: payload.rootTemplate,
    nodes: sanitizedNodes,
    dailySalt: payload.dailySalt,
    quoteAuthor: payload.quoteAuthor,
    quoteWork: payload.quoteWork,
    quoteYear: payload.quoteYear,
    editorialNote: payload.editorialNote,
  }
}

export const puzzleRoutes: FastifyPluginAsync = async (fastify) => {
  const handler = async (_request: unknown, reply: FastifyReply) => {
    const today = getTodayDateMadrid()
    const ttlSeconds = getSecondsUntilMidnightMadrid()

    // Cabecera Cache-Control optimizada para Cloudflare y navegadores
    reply.header(
      'Cache-Control',
      `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}`,
    )

    let clientPayload: ClientPayload | null = null

    // 1. Intentar consultar desde PostgreSQL si db está disponible
    if (fastify.db) {
      try {
        const rows = await fastify.db
          .select()
          .from(puzzles)
          .where(
            and(
              eq(puzzles.publishDate, today),
              eq(puzzles.status, 'PUBLISHED'),
            ),
          )
          .limit(1)

        const match = rows[0]
        if (match?.clientPayload) {
          clientPayload = match.clientPayload as ClientPayload
        }
      } catch (err) {
        fastify.log.error(
          { err },
          'Error al consultar el puzle de hoy en la base de datos',
        )
      }
    }

    // 2. Si no se encontró en DB y no estamos en producción, usar fallback
    if (!clientPayload) {
      // En producción estricta, devolver 404 si no hay edición para hoy
      if (process.env.NODE_ENV === 'production' && fastify.db) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'No hay ninguna edición publicada para el día de hoy',
        })
      }

      // En desarrollo / tests / fallback:
      fastify.log.info(
        { today },
        'Usando fallback de puzle diario para desarrollo/test',
      )
      clientPayload = getFallbackDailyPayload(today)
    }

    // 3. Sanitizar y retornar únicamente el payload seguro
    return sanitizeClientPayload(clientPayload)
  }

  // Rutas disponibles
  fastify.get('/api/puzzle/today', handler)
  fastify.get('/puzzle/today', handler)
}
