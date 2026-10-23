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
    rootTemplate: 'Un día como hoy, pero en 1940, nace en {{n1}} el {{n2}}, recordado por anotar más de mil {{n4}}.',
    dailySalt: `salt-${today}`,
    nodes: {
      n1: {
        id: 'n1',
        clueText: 'la patria de la samba y el carnaval',
        children: [],
        parent: null,
        type: 'reference',
        solutionHash: '88c1ed0828cfc28d5b785f2c440034c543225dcd9c5da5a7b280e500f862641f',
        solutionCipher: '6b8cf57d28e3b26686736dca:84BGpbtTaPrXXabFQO1j8NP5RaYhRg==',
      },
      n2: {
        id: 'n2',
        clueText: 'delantero de Santos que alzó tres {{n3}}',
        children: ['n3'],
        parent: null,
        type: 'reference',
        solutionHash: 'ff5a727fd01736936f8f8dc11295de87b1d51051daea35e9a61501eb8eddb202',
        solutionCipher: 'cf4ecd65555160f27f0b4b6a:avQQfyoJQZqHIjj+YjC9yFcswtSr',
      },
      n3: {
        id: 'n3',
        clueText: 'campeonatos universales de selecciones de fútbol',
        children: [],
        parent: 'n2',
        type: 'definition',
        solutionHash: '184db3b5b3fb585bd5a72c0ab0618bab8ad7df4e9372d889601209a99c19a931',
        solutionCipher: 'a87b31b603b13b056b53d568:85pBKsEy0xE7WkZmJJZCe+mbDTCMs5Wmng==',
      },
      n4: {
        id: 'n4',
        clueText: 'tantos introducidos en la portería',
        children: [],
        parent: null,
        type: 'definition',
        solutionHash: 'be5ef6e06b65b7327fd89c493cd39493c3df89c45c08d86fa0578339b4c22242',
        solutionCipher: '7c6fece1a5c68f2fe6c8bf5e:tX/uF555J1fOQ0+lA2aQhO1s/9s=',
      },
    },
    quoteAuthor: 'Efeméride deportiva y cultural',
    quoteWork: 'Nacimiento de Edson Arantes do Nascimento (Pelé)',
    quoteYear: 1940,
    editorialNote:
      'Un día como hoy en 1940 nace Pelé en Três Corações, coronado como "O Rei" y tricampeón mundial.',
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
