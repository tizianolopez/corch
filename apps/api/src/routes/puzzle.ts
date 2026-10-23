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
    rootTemplate: 'En Corchetes se avanza siempre hacia {{n1}}, descifrando cada {{n3}} con {{n4}} por el lenguaje.',
    dailySalt: `salt-${today}`,
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'el destino al que sales desde {{n2}}',
        children: ['n2'],
        parent: null,
        type: 'reference',
        solutionHash: 'f126f80b3601c4effbf6f0bf0a4ba8a33dfba60e8259f08b2a9b637f7e6ef65a',
        solutionCipher: '67a6e0b3389fb73db1242e13:+RBwdYMGB9SrDbOM6c12nbf6+2l6kg==',
      },
      n2: {
        id: 'n2',
        clueText: 'lo contrario de fuera',
        children: [],
        parent: 'n1',
        type: 'definition',
        solutionHash: 'd369d51bfe8e83ed9d3903b7affad7aafd4145ef37232ebb058039faf3fa49d3',
        solutionCipher: '5adfa928dbc759e6505a6d0f:hI5k5/rEdLP8GxZyGov5HRG2neD80A==',
      },
      n3: {
        id: 'n3',
        clueText: 'misterio que se guarda oculto',
        children: [],
        parent: null,
        type: 'definition',
        solutionHash: 'e96151def46afe4211366c1b10092937abc4cf74f37f13b801779ef3230cb4ac',
        solutionCipher: '1fb97dd4f47506274c3ace72:Ev+YjG6pgcZYLzGXw3PhDPPJHv3HVvg=',
      },
      n4: {
        id: 'n4',
        clueText: 'el deshojado y revuelto RAMO',
        children: [],
        parent: null,
        type: 'anagram',
        solutionHash: '3199e42d0f6b656014a762ce0ccf8efe416a1d2c4bcb73d9a956e305b1963d5e',
        solutionCipher: '67a5e88897642bb6c6a1cc11:rZrmjbJ+mT6lH66SkR1udkGK/UE=',
      },
    },
    quoteAuthor: 'Guía del iniciado',
    quoteWork: 'Cómo jugar a Corchetes',
    quoteYear: 2026,
    editorialNote:
      '¡Enhorabuena! Has completado el tutorial. Recuerda: en Corchetes se resuelve de dentro hacia afuera. Al resolver «dentro», desbloqueaste la pista exterior para hallar «afuera».',
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
