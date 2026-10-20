import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { getTodayDateMadrid, getTimesRedisKey } from '../utils/time'

export interface TimeBucket {
  label: string
  min: number
  max: number | '+inf'
  count: number
}

export interface StatsDistributionResponse {
  publishDate: string
  totalPlayers: number
  fastestSeconds: number | null
  medianSeconds: number | null
  buckets: TimeBucket[]
}

const statsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export const BUCKET_DEFINITIONS: { label: string; min: number; max: number | '+inf' }[] = [
  { label: '< 1 min', min: 0, max: 60 },
  { label: '1 - 2 min', min: 61, max: 120 },
  { label: '2 - 3 min', min: 121, max: 180 },
  { label: '3 - 5 min', min: 181, max: 300 },
  { label: '5 - 10 min', min: 301, max: 600 },
  { label: '> 10 min', min: 601, max: '+inf' },
]

export const statsRoutes: FastifyPluginAsync = async (fastify) => {
  const distributionHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<StatsDistributionResponse> => {
    const query = statsQuerySchema.parse(request.query)
    const targetDate = query.date ?? getTodayDateMadrid()
    const redisKey = getTimesRedisKey(targetDate)

    // Breve caché de 30s para absorber ráfagas sin desactualizar los datos
    reply.header('Cache-Control', 'public, max-age=30, s-maxage=30')

    // 1. Total de participantes en el sorted set
    const totalPlayers = await fastify.redis.zcount(redisKey, '-inf', '+inf')

    // 2. Tiempos más rápido y mediana
    let fastestSeconds: number | null = null
    let medianSeconds: number | null = null

    if (totalPlayers > 0) {
      const fastest = await fastify.redis.zrange(redisKey, 0, 0, { withScores: true })
      if (fastest.length > 0 && typeof fastest[0] === 'object' && fastest[0] !== null) {
        fastestSeconds = (fastest[0] as { score: number }).score
      }

      const midIndex = Math.floor(totalPlayers / 2)
      const median = await fastify.redis.zrange(redisKey, midIndex, midIndex, { withScores: true })
      if (median.length > 0 && typeof median[0] === 'object' && median[0] !== null) {
        medianSeconds = (median[0] as { score: number }).score
      }
    }

    // 3. Distribución por cubetas de tiempo mediante ZCOUNT
    const buckets: TimeBucket[] = []
    for (const def of BUCKET_DEFINITIONS) {
      const count = await fastify.redis.zcount(redisKey, def.min, def.max)
      buckets.push({
        label: def.label,
        min: def.min,
        max: def.max,
        count,
      })
    }

    return {
      publishDate: targetDate,
      totalPlayers,
      fastestSeconds,
      medianSeconds,
      buckets,
    }
  }

  fastify.get('/api/stats/today/distribution', distributionHandler)
  fastify.get('/stats/today/distribution', distributionHandler)
}
